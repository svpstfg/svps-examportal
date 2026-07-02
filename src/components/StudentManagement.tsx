import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Crown, Search, UserPlus, Trash2, Mail, CalendarClock, Download, ShieldCheck, ShieldAlert, BadgeCheck, Lock, LockOpen, Settings2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Class } from "@/types";
import { BulkStudentImport } from "./BulkStudentImport";
import { BulkStudentSignup } from "./BulkStudentSignup";
import { downloadCSV } from "@/lib/csv";

interface ClassAssignment {
  classId: string;
  enrolledAt: Date;
  tier: 'free' | 'pro';
  enrollmentId: string;
  subscriptionExpiresAt: Date | null;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  isLocked: boolean;
  classAssignments: ClassAssignment[];
}

interface StudentManagementProps {
  classes: Class[];
}

export const StudentManagement = ({ classes }: StudentManagementProps) => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [addStudentEmail, setAddStudentEmail] = useState('');
  const [addStudentName, setAddStudentName] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [manageClassesStudentId, setManageClassesStudentId] = useState<string | null>(null);
  const [classModalSearch, setClassModalSearch] = useState('');

  interface PendingStudent {
    enrollmentId: string;
    studentId: string;
    name: string;
    email: string;
    classId: string;
    enrolledAt: string;
    status: 'unconfirmed' | 'no-account';
  }
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);

  useEffect(() => {
    loadStudents();
    loadPending();
  }, [classes]);

  const loadPending = async () => {
    const classIds = classes.map(c => c.id);
    if (classIds.length === 0) {
      setPendingStudents([]);
      return;
    }
    setLoadingPending(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-student-verification', {
        body: { action: 'list-pending', classIds },
      });
      if (error) throw error;
      setPendingStudents(data?.pending || []);
    } catch (error) {
      console.error('Error loading pending students:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleVerifyStudent = async (email: string) => {
    setVerifyingEmail(email);
    try {
      const { data, error } = await supabase.functions.invoke('manage-student-verification', {
        body: { action: 'verify', email },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success('Student verified — they can now sign in without email confirmation');
      setPendingStudents(prev => prev.filter(p => p.email.toLowerCase() !== email.toLowerCase()));
    } catch (error: any) {
      console.error('Error verifying student:', error);
      toast.error(error.message || 'Failed to verify student');
    } finally {
      setVerifyingEmail(null);
    }
  };


  const loadStudents = async () => {
    try {
      const classIds = classes.map(c => c.id);
      if (classIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: enrollments, error: enrollError } = await supabase
        .from('student_enrollments')
        .select('id, student_id, class_id, tier, enrolled_at, subscription_expires_at')
        .in('class_id', classIds);

      if (enrollError) throw enrollError;

      const studentIds = [...new Set((enrollments || []).map(e => e.student_id))];
      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, email, is_locked')
        .in('id', studentIds);

      if (studentsError) throw studentsError;

      const rowsByStudent = new Map<string, StudentRow>();
      (enrollments || []).forEach(e => {
        const student = studentsData?.find(s => s.id === e.student_id);
        const row = rowsByStudent.get(e.student_id) || {
          id: student?.id || '',
          name: student?.name || 'Unknown',
          email: student?.email || '',
          isLocked: (student as any)?.is_locked ?? false,
          classAssignments: []
        };

        row.classAssignments.push({
          classId: e.class_id,
          enrolledAt: new Date(e.enrolled_at),
          tier: (e as any).tier || 'free',
          enrollmentId: e.id,
          subscriptionExpiresAt: (e as any).subscription_expires_at ? new Date((e as any).subscription_expires_at) : null
        });

        rowsByStudent.set(e.student_id, row);
      });

      setStudents(Array.from(rowsByStudent.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTier = async (enrollmentId: string, currentTier: string) => {
    const newTier = currentTier === 'pro' ? 'free' : 'pro';
    try {
      const { error } = await supabase
        .from('student_enrollments')
        .update({ tier: newTier } as any)
        .eq('id', enrollmentId);

      if (error) throw error;

      setStudents(prev => prev.map(s => ({
        ...s,
        classAssignments: s.classAssignments.map(assignment =>
          assignment.enrollmentId === enrollmentId
            ? { ...assignment, tier: newTier as 'free' | 'pro' }
            : assignment
        )
      })));
      toast.success(`Student ${newTier === 'pro' ? 'upgraded to Pro' : 'downgraded to Free'}`);
    } catch (error) {
      console.error('Error updating tier:', error);
      toast.error('Failed to update student tier');
    }
  };

  const handleSetExpiry = async (enrollmentId: string, date: Date | undefined) => {
    try {
      const { error } = await supabase
        .from('student_enrollments')
        .update({ subscription_expires_at: date ? date.toISOString() : null } as any)
        .eq('id', enrollmentId);

      if (error) throw error;

      setStudents(prev => prev.map(s => ({
        ...s,
        classAssignments: s.classAssignments.map(assignment =>
          assignment.enrollmentId === enrollmentId
            ? { ...assignment, subscriptionExpiresAt: date || null }
            : assignment
        )
      })));
      toast.success(date ? `Subscription valid until ${format(date, 'PPP')}` : 'Subscription set to unlimited');
    } catch (error) {
      console.error('Error updating expiry:', error);
      toast.error('Failed to update subscription validity');
    }
  };

  const isExpired = (subscriptionExpiresAt: Date | null | undefined) => {
    if (!subscriptionExpiresAt) return false;
    return new Date() > subscriptionExpiresAt;
  };

  const handleAddStudent = async () => {
    if (!addStudentEmail || !addStudentName || !selectedClassIds.length) {
      toast.error('Please fill all fields and select at least one class');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('email', addStudentEmail)
        .maybeSingle();

      let studentId: string;

      if (existing) {
        studentId = existing.id;
      } else {
        const primaryClassId = selectedClassIds[0];
        const { data: newStudent, error: insertError } = await supabase
          .from('students')
          .insert({
            name: addStudentName,
            email: addStudentEmail,
            class_id: primaryClassId
          })
          .select()
          .single();

        if (insertError) throw insertError;
        studentId = newStudent.id;
      }

      const { data: existingEnrollments } = await supabase
        .from('student_enrollments')
        .select('class_id')
        .eq('student_id', studentId)
        .in('class_id', selectedClassIds);

      const existingClassIds = new Set((existingEnrollments || []).map(item => item.class_id));
      const missingClassIds = selectedClassIds.filter(classId => !existingClassIds.has(classId));

      if (missingClassIds.length > 0) {
        const { error: enrollError } = await supabase
          .from('student_enrollments')
          .insert(missingClassIds.map(classId => ({ student_id: studentId, class_id: classId })));

        if (enrollError) throw enrollError;
      }

      setAddStudentEmail('');
      setAddStudentName('');
      setSelectedClassIds([]);
      loadStudents();
      toast.success('Student added successfully!');
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast.error(error.message || 'Failed to add student');
    }
  };

  const handleUpdateClassAssignment = async (studentId: string, classId: string, isAssigned: boolean) => {
    const student = students.find(item => item.id === studentId);
    if (!student) return;

    try {
      if (isAssigned) {
        const assignment = student.classAssignments.find(item => item.classId === classId);
        if (!assignment) return;

        const { error } = await supabase
          .from('student_enrollments')
          .delete()
          .eq('id', assignment.enrollmentId);

        if (error) throw error;

        const updatedAssignments = student.classAssignments.filter(item => item.classId !== classId);
        if (updatedAssignments.length === 0) {
          const { error: studentDeleteError } = await supabase.from('students').delete().eq('id', studentId);
          if (studentDeleteError) throw studentDeleteError;
        }

        setStudents(prev => prev.filter(item => item.id !== studentId || item.classAssignments.some(a => a.classId !== classId))
          .map(item => item.id === studentId
            ? { ...item, classAssignments: item.classAssignments.filter(a => a.classId !== classId) }
            : item));

        toast.success('Student removed from class');
        return;
      }

      const { data, error } = await supabase
        .from('student_enrollments')
        .insert({ student_id: studentId, class_id: classId })
        .select('id, tier, subscription_expires_at')
        .single();

      if (error) throw error;

      setStudents(prev => prev.map(item => item.id === studentId
        ? {
            ...item,
            classAssignments: [
              ...item.classAssignments,
              {
                classId,
                enrolledAt: new Date(),
                tier: (data as any).tier || 'free',
                enrollmentId: data.id,
                subscriptionExpiresAt: (data as any).subscription_expires_at ? new Date((data as any).subscription_expires_at) : null
              }
            ]
          }
        : item));

      toast.success('Student assigned to class');
    } catch (error) {
      console.error('Error updating class assignment:', error);
      toast.error('Failed to update class assignment');
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student?.isLocked) {
      toast.error('This student is locked. Unlock it first to delete.');
      return;
    }
    if (!window.confirm('Remove this student from all assigned classes? They will lose access to every class.')) return;
    try {
      const { error } = await supabase
        .from('student_enrollments')
        .delete()
        .eq('student_id', studentId);

      if (error) throw error;

      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (deleteError) throw deleteError;

      setStudents(prev => prev.filter(s => s.id !== studentId));
      toast.success('Student removed and access revoked');
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error('Failed to remove student');
    }
  };

  const handleToggleStudentLock = async (studentId: string, currentLocked: boolean) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_locked: !currentLocked } as any)
        .eq('id', studentId);

      if (error) throw error;

      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, isLocked: !currentLocked } : s));
      toast.success(!currentLocked ? 'Student locked — delete disabled' : 'Student unlocked');
    } catch (error) {
      console.error('Error toggling student lock:', error);
      toast.error('Failed to update lock');
    }
  };

  const getClassName = (classId: string) => classes.find(c => c.id === classId)?.name || 'Unknown';

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'all' || s.classAssignments.some(assignment => assignment.classId === filterClass);
    return matchesSearch && matchesClass;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bulk sign up students (Excel) — creates login accounts */}
      <BulkStudentSignup classes={classes} onImported={loadStudents} />

      {/* Bulk CSV import (records only) */}
      <BulkStudentImport classes={classes} onImported={loadStudents} />

      {/* Add Student */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Add Student Manually</span>
          </CardTitle>
          <CardDescription>Add a student to one of your classes by email</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={addStudentName}
                onChange={(e) => setAddStudentName(e.target.value)}
                placeholder="Student name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={addStudentEmail}
                onChange={(e) => setAddStudentEmail(e.target.value)}
                placeholder="student@email.com"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddStudent} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            <div className="space-y-2 sm:col-span-2 xl:col-span-4">
              <Label>Assign to Classes</Label>
              <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                {classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Create a class first to assign students.</p>
                ) : (
                  classes.map(cls => (
                    <label key={cls.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedClassIds.includes(cls.id)}
                        onCheckedChange={() => {
                          setSelectedClassIds(prev => prev.includes(cls.id)
                            ? prev.filter(id => id !== cls.id)
                            : [...prev, cls.id]);
                        }}
                      />
                      <span>{cls.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students with tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 max-w-2xl">
          <TabsTrigger value="all" className="flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            <span>All Students</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center justify-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>Pending Verification</span>
            {pendingStudents.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingStudents.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
      {/* Student List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Students ({filteredStudents.length})</span>
              </CardTitle>
              <CardDescription>Manage your students and their access tiers</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                downloadCSV(
                  `students-${filterClass === 'all' ? 'all' : getClassName(filterClass).replace(/\s+/g, '_')}.csv`,
                  filteredStudents.map(s => ({
                    Name: s.name,
                    Email: s.email,
                    Classes: s.classAssignments.map(assignment => getClassName(assignment.classId)).join(', '),
                    Tier: s.classAssignments[0]?.tier || 'free',
                    Enrolled: s.classAssignments[0] ? format(s.classAssignments[0].enrolledAt, 'yyyy-MM-dd') : '—',
                    'Subscription Expires': s.classAssignments[0]?.subscriptionExpiresAt ? format(s.classAssignments[0].subscriptionExpiresAt, 'yyyy-MM-dd') : 'Unlimited',
                  }))
                );
              }}
              disabled={!filteredStudents.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10 w-full"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No students found</p>
              <p className="text-sm text-muted-foreground mt-1">Share your class invite code or add students manually</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map(student => (
                <div key={student.id} className={`flex flex-col gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors ${student.classAssignments.some(assignment => isExpired(assignment.subscriptionExpiresAt)) ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {student.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium break-all">{student.name}</p>
                          {student.isLocked && (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Locked
                            </Badge>
                          )}
                          {student.classAssignments.some(assignment => isExpired(assignment.subscriptionExpiresAt)) && (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="break-all">{student.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start sm:self-auto"
                        onClick={() => { setManageClassesStudentId(student.id); setClassModalSearch(''); }}
                      >
                        <Settings2 className="h-4 w-4 mr-2" />
                        Manage Classes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="self-start sm:self-auto"
                        title={student.isLocked ? 'Unlock student' : 'Lock student (prevent delete)'}
                        onClick={() => handleToggleStudentLock(student.id, student.isLocked)}
                      >
                        {student.isLocked ? <Lock className="h-4 w-4 text-amber-500" /> : <LockOpen className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive self-start sm:self-auto disabled:opacity-40"
                        disabled={student.isLocked}
                        title={student.isLocked ? 'Locked — unlock to delete' : 'Remove student'}
                        onClick={() => handleRemoveStudent(student.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {student.classAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No classes assigned. Use "Manage Classes" to assign.</p>
                    ) : student.classAssignments.map(assignment => (
                      <div key={assignment.enrollmentId} className="rounded-md border bg-background/70 p-3 space-y-2 min-w-[220px]">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{getClassName(assignment.classId)}</Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Free</span>
                            <Switch
                              checked={assignment.tier === 'pro'}
                              onCheckedChange={() => handleToggleTier(assignment.enrollmentId, assignment.tier)}
                            />
                            <span className="text-sm font-medium flex items-center space-x-1">
                              <Crown className={`h-3 w-3 ${assignment.tier === 'pro' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                              <span className={assignment.tier === 'pro' ? 'text-yellow-600' : 'text-muted-foreground'}>Pro</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Validity:</span>
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className={`h-7 text-xs w-full sm:w-auto ${isExpired(assignment.subscriptionExpiresAt) ? 'border-destructive text-destructive' : ''}`}>
                                {assignment.subscriptionExpiresAt
                                  ? format(assignment.subscriptionExpiresAt, 'PPP')
                                  : 'Unlimited'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={assignment.subscriptionExpiresAt || undefined}
                                onSelect={(date) => handleSetExpiry(assignment.enrollmentId, date)}
                                initialFocus
                              />
                              {assignment.subscriptionExpiresAt && (
                                <div className="p-2 border-t">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => handleSetExpiry(assignment.enrollmentId, undefined)}
                                  >
                                    Set to Unlimited
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <span>Pending Email Verification ({pendingStudents.length})</span>
              </CardTitle>
              <CardDescription>
                Students who haven't confirmed their email yet. Verify them manually so they can sign in without confirming via email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : pendingStudents.length === 0 ? (
                <div className="text-center py-12">
                  <BadgeCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No students pending verification</p>
                  <p className="text-sm text-muted-foreground mt-1">All your students have confirmed their email or been verified</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingStudents.map(student => (
                    <div key={student.enrollmentId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/10">
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <span className="text-sm font-semibold text-amber-600">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{student.name}</p>
                            <Badge variant="outline">{getClassName(student.classId)}</Badge>
                            {student.status === 'no-account' ? (
                              <Badge variant="secondary" className="text-xs">No account yet</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Email unconfirmed</Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{student.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {student.status === 'no-account' ? (
                          <span className="text-xs text-muted-foreground">Student must sign up first</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleVerifyStudent(student.email)}
                            disabled={verifyingEmail === student.email}
                          >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            {verifyingEmail === student.email ? 'Verifying...' : 'Verify Student'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!manageClassesStudentId} onOpenChange={(open) => { if (!open) setManageClassesStudentId(null); }}>
        <DialogContent className="max-w-md">
          {(() => {
            const student = students.find(s => s.id === manageClassesStudentId);
            if (!student) return null;
            const search = classModalSearch.trim().toLowerCase();
            const filtered = classes.filter(c => c.name.toLowerCase().includes(search));
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Assign Classes</DialogTitle>
                  <DialogDescription>
                    Search and select classes to assign to <span className="font-medium">{student.name}</span>.
                  </DialogDescription>
                </DialogHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search classes..."
                    value={classModalSearch}
                    onChange={(e) => setClassModalSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1 mt-2">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No classes found</p>
                  ) : filtered.map(cls => {
                    const isAssigned = student.classAssignments.some(a => a.classId === cls.id);
                    return (
                      <label key={cls.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm">
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={() => handleUpdateClassAssignment(student.id, cls.id, isAssigned)}
                        />
                        <span>{cls.name}</span>
                        {isAssigned && <Badge variant="outline" className="ml-auto text-xs">Assigned</Badge>}
                      </label>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
