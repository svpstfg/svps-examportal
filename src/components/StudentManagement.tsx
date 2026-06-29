import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Users, Crown, Search, UserPlus, Trash2, Mail, CalendarClock, Download, ShieldCheck, ShieldAlert, BadgeCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Class } from "@/types";
import { BulkStudentImport } from "./BulkStudentImport";
import { downloadCSV } from "@/lib/csv";

interface StudentRow {
  id: string;
  name: string;
  email: string;
  classId: string;
  enrolledAt: Date;
  tier: 'free' | 'pro';
  enrollmentId: string;
  subscriptionExpiresAt: Date | null;
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
  const [addStudentClass, setAddStudentClass] = useState('');

  useEffect(() => {
    loadStudents();
  }, [classes]);

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
        .select('id, name, email')
        .in('id', studentIds);

      if (studentsError) throw studentsError;

      const rows: StudentRow[] = (enrollments || []).map(e => {
        const student = studentsData?.find(s => s.id === e.student_id);
        return {
          id: student?.id || '',
          name: student?.name || 'Unknown',
          email: student?.email || '',
          classId: e.class_id,
          enrolledAt: new Date(e.enrolled_at),
          tier: (e as any).tier || 'free',
          enrollmentId: e.id,
          subscriptionExpiresAt: (e as any).subscription_expires_at ? new Date((e as any).subscription_expires_at) : null
        };
      });

      setStudents(rows);
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

      setStudents(prev => prev.map(s =>
        s.enrollmentId === enrollmentId ? { ...s, tier: newTier as 'free' | 'pro' } : s
      ));
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

      setStudents(prev => prev.map(s =>
        s.enrollmentId === enrollmentId ? { ...s, subscriptionExpiresAt: date || null } : s
      ));
      toast.success(date ? `Subscription valid until ${format(date, 'PPP')}` : 'Subscription set to unlimited');
    } catch (error) {
      console.error('Error updating expiry:', error);
      toast.error('Failed to update subscription validity');
    }
  };

  const isExpired = (student: StudentRow) => {
    if (!student.subscriptionExpiresAt) return false;
    return new Date() > student.subscriptionExpiresAt;
  };

  const handleAddStudent = async () => {
    if (!addStudentEmail || !addStudentName || !addStudentClass) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      // Check if student already exists
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('email', addStudentEmail)
        .maybeSingle();

      let studentId: string;

      if (existing) {
        studentId = existing.id;
      } else {
        const { data: newStudent, error: insertError } = await supabase
          .from('students')
          .insert({
            name: addStudentName,
            email: addStudentEmail,
            class_id: addStudentClass
          })
          .select()
          .single();

        if (insertError) throw insertError;
        studentId = newStudent.id;
      }

      // Create enrollment
      const { error: enrollError } = await supabase
        .from('student_enrollments')
        .insert({
          student_id: studentId,
          class_id: addStudentClass
        });

      if (enrollError) throw enrollError;

      setAddStudentEmail('');
      setAddStudentName('');
      setAddStudentClass('');
      loadStudents();
      toast.success('Student added successfully!');
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast.error(error.message || 'Failed to add student');
    }
  };

  const handleRemoveStudent = async (enrollmentId: string) => {
    if (!window.confirm('Remove this student from the class? They will lose all access to this class.')) return;
    try {
      const studentToRemove = students.find(s => s.enrollmentId === enrollmentId);
      if (!studentToRemove) return;

      // Delete from students table — CASCADE will auto-delete enrollment
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentToRemove.id)
        .eq('class_id', studentToRemove.classId);

      if (error) throw error;

      setStudents(prev => prev.filter(s => s.enrollmentId !== enrollmentId));
      toast.success('Student removed and access revoked');
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error('Failed to remove student');
    }
  };

  const getClassName = (classId: string) => classes.find(c => c.id === classId)?.name || 'Unknown';

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'all' || s.classId === filterClass;
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
      {/* Bulk CSV import */}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={addStudentClass} onValueChange={setAddStudentClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddStudent} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
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
              onClick={() => {
                downloadCSV(
                  `students-${filterClass === 'all' ? 'all' : getClassName(filterClass).replace(/\s+/g, '_')}.csv`,
                  filteredStudents.map(s => ({
                    Name: s.name,
                    Email: s.email,
                    Class: getClassName(s.classId),
                    Tier: s.tier,
                    Enrolled: format(s.enrolledAt, 'yyyy-MM-dd'),
                    'Subscription Expires': s.subscriptionExpiresAt ? format(s.subscriptionExpiresAt, 'yyyy-MM-dd') : 'Unlimited',
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
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[200px]">
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
                <div key={student.enrollmentId} className={`flex flex-col gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors ${isExpired(student) ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {student.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{student.name}</p>
                          {isExpired(student) && (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{student.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">{getClassName(student.classId)}</Badge>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Free</span>
                        <Switch
                          checked={student.tier === 'pro'}
                          onCheckedChange={() => handleToggleTier(student.enrollmentId, student.tier)}
                        />
                        <span className="text-sm font-medium flex items-center space-x-1">
                          <Crown className={`h-3 w-3 ${student.tier === 'pro' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                          <span className={student.tier === 'pro' ? 'text-yellow-600' : 'text-muted-foreground'}>Pro</span>
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveStudent(student.enrollmentId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Subscription Validity */}
                  <div className="flex items-center gap-3 pl-14">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Validity:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-7 text-xs ${isExpired(student) ? 'border-destructive text-destructive' : ''}`}>
                          {student.subscriptionExpiresAt
                            ? format(student.subscriptionExpiresAt, 'PPP')
                            : 'Unlimited'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={student.subscriptionExpiresAt || undefined}
                          onSelect={(date) => handleSetExpiry(student.enrollmentId, date)}
                          initialFocus
                        />
                        {student.subscriptionExpiresAt && (
                          <div className="p-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => handleSetExpiry(student.enrollmentId, undefined)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};
