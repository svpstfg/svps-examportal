import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit, Trash2, BookOpen, GraduationCap, ChevronDown, ChevronUp, Mail, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Class } from "@/types";

interface ClassManagementProps {
  classes: Class[];
  onClassCreate: (cls: Class) => void;
  onClassUpdate: (cls: Class) => void;
  onClassDelete: (classId: string) => void;
}

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  enrolledAt: string;
  tier: string;
}

export const ClassManagement = ({ classes, onClassCreate, onClassUpdate, onClassDelete }: ClassManagementProps) => {
  const [newClass, setNewClass] = useState({
    name: '',
    description: ''
  });

  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<StudentInfo[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const handleToggleStudents = async (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      return;
    }

    setExpandedClassId(classId);
    setLoadingStudents(true);

    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from('student_enrollments')
        .select('id, student_id, tier, enrolled_at')
        .eq('class_id', classId);

      if (enrollError) throw enrollError;

      const studentIds = [...new Set((enrollments || []).map(e => e.student_id))];
      if (studentIds.length === 0) {
        setClassStudents([]);
        setLoadingStudents(false);
        return;
      }

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, email')
        .in('id', studentIds);

      if (studentsError) throw studentsError;

      const mapped: StudentInfo[] = (enrollments || []).map(e => {
        const s = students?.find(st => st.id === e.student_id);
        return {
          id: e.id,
          name: s?.name || 'Unknown',
          email: s?.email || '',
          enrolledAt: new Date(e.enrolled_at).toLocaleDateString(),
          tier: (e as any).tier || 'free',
        };
      });

      setClassStudents(mapped);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };

  const handleCreateClass = () => {
    if (!newClass.name.trim()) {
      toast.error("Class name is required");
      return;
    }

    const classToCreate: Class = {
      id: Date.now().toString(),
      name: newClass.name,
      description: newClass.description,
      teacherId: "teacher-1",
      createdAt: new Date(),
      studentCount: 0,
      inviteCode: ''
    };

    onClassCreate(classToCreate);
    setNewClass({ name: '', description: '' });
    toast.success("Class created successfully!");
  };

  const handleUpdateClass = () => {
    if (!editingClass || !editingClass.name.trim()) {
      toast.error("Class name is required");
      return;
    }

    onClassUpdate(editingClass);
    setEditingClass(null);
    toast.success("Class updated successfully!");
  };

  const handleDeleteClass = (classId: string) => {
    if (window.confirm("Are you sure you want to delete this class? This action cannot be undone.")) {
      onClassDelete(classId);
      toast.success("Class deleted successfully!");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GraduationCap className="h-5 w-5" />
            <span>Create New Class</span>
          </CardTitle>
          <CardDescription>
            Create a class to organize students and courses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="class-name">Class Name</Label>
              <Input
                id="class-name"
                value={newClass.name}
                onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                placeholder="e.g., Mathematics Class 10A"
              />
            </div>
            <div>
              <Label htmlFor="class-description">Description</Label>
              <Input
                id="class-description"
                value={newClass.description}
                onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                placeholder="Brief description of the class"
              />
            </div>
          </div>
          <Button onClick={handleCreateClass}>
            <Plus className="h-4 w-4 mr-2" />
            Create Class
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Your Classes</span>
          </CardTitle>
          <CardDescription>
            Click on a class card to see enrolled students
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No classes created yet</p>
              <p className="text-sm text-muted-foreground">Create your first class to get started</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <Card
                  key={cls.id}
                  className={`hover:shadow-md transition-shadow cursor-pointer ${expandedClassId === cls.id ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardHeader onClick={() => handleToggleStudents(cls.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{cls.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {cls.description || "No description"}
                        </CardDescription>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); setEditingClass(cls); }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">
                          <Users className="h-3 w-3 mr-1" />
                          {cls.studentCount} students
                        </Badge>
                        {cls.inviteCode && (
                          <Badge
                            variant="outline"
                            className="cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); copyInviteCode(cls.inviteCode); }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            {cls.inviteCode}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <span>{cls.createdAt.toLocaleDateString()}</span>
                        {expandedClassId === cls.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    {/* Expanded student list */}
                    {expandedClassId === cls.id && (
                      <div className="mt-4 border-t pt-4 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Enrolled Students</p>
                        {loadingStudents ? (
                          <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                          </div>
                        ) : classStudents.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-3">No students enrolled yet</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {classStudents.map((student) => (
                              <div key={student.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                                <div className="flex items-center space-x-2">
                                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-xs font-semibold text-primary">
                                      {student.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{student.name}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {student.email}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge variant={student.tier === 'pro' ? 'default' : 'secondary'} className="text-xs">
                                    {student.tier}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">{student.enrolledAt}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Class Dialog */}
      {editingClass && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Class</CardTitle>
            <CardDescription>Update class information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-class-name">Class Name</Label>
                <Input
                  id="edit-class-name"
                  value={editingClass.name}
                  onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-class-description">Description</Label>
                <Input
                  id="edit-class-description"
                  value={editingClass.description}
                  onChange={(e) => setEditingClass({ ...editingClass, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleUpdateClass}>
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditingClass(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};