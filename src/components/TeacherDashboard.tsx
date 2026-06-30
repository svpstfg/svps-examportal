import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, BookOpen, Clock, Users, Edit, Trash2, Image, GraduationCap, FolderOpen, CalendarIcon, Eye, Copy, Crown, FileText, BarChart3, Trophy, Download, UsersRound, MessageCircle, Megaphone, FileQuestion, Sparkles, LayoutDashboard, Share2, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { QuestionAnalytics } from "@/components/QuestionAnalytics";
import { TestParticipation } from "@/components/TestParticipation";
import { ClassLeaderboard } from "@/components/ClassLeaderboard";
import { TestResults } from "@/components/TestResults";
import { downloadCSV } from "@/lib/csv";
import { QuestionPaperUpload } from "@/components/QuestionPaperUpload";
import { TeacherDoubtChat } from "@/components/TeacherDoubtChat";
import { TeacherNotices } from "@/components/TeacherNotices";
import { EnhancedQuestionFormV2 } from "@/components/EnhancedQuestionFormV2";
import { TestEditor } from "@/components/TestEditor";
import { TestPreview } from "@/components/TestPreview";
import { TestPaperPDF } from "@/components/TestPaperPDF";
import { StudentManagement } from "@/components/StudentManagement";
import { UpgradeRequestsManager } from "@/components/UpgradeRequestsManager";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Class, Course, Chapter, Question, Test } from "@/types";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [previewingTest, setPreviewingTest] = useState<Test | null>(null);
  const [analyticsTest, setAnalyticsTest] = useState<Test | null>(null);
  const [downloadingTest, setDownloadingTest] = useState<Test | null>(null);
  const [participationTest, setParticipationTest] = useState<Test | null>(null);
  const [testToDelete, setTestToDelete] = useState<Test | null>(null);
  const [sidebarSection, setSidebarSection] = useState<null | 'pyq' | 'doubts' | 'notices' | 'leaderboard' | 'upgrades' | 'share-signup'>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'classes' | 'students' | 'courses' | 'chapters' | 'create-test' | 'tests'>('classes');
  const [testFilterClassId, setTestFilterClassId] = useState('');
  const [testFilterCourseId, setTestFilterCourseId] = useState('');
  const [testFilterChapterId, setTestFilterChapterId] = useState('');
  const [newCourseClassId, setNewCourseClassId] = useState('');

  const [newChapter, setNewChapter] = useState({ name: '', description: '', courseId: '' });
  const [newTest, setNewTest] = useState({
    title: '',
    duration: 30,
    chapterId: '',
    questions: [] as Question[],
    scheduledDate: undefined as Date | undefined,
    scheduledTime: '',
    isScheduled: false,
    isPro: false,
  });

  // Load data from Supabase
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Parallel fetch — ~4x faster than sequential
        const [classesRes, coursesRes, chaptersRes, testsRes] = await Promise.all([
          supabase.from('classes').select('*').order('created_at', { ascending: false }),
          supabase.from('courses').select('*').order('created_at', { ascending: false }),
          supabase.from('chapters').select('*').order('created_at', { ascending: false }),
          supabase.from('tests').select('*').order('created_at', { ascending: false }),
        ]);

        if (classesRes.error) throw classesRes.error;
        if (coursesRes.error) throw coursesRes.error;
        if (chaptersRes.error) throw chaptersRes.error;
        if (testsRes.error) throw testsRes.error;

        const classesData = classesRes.data;
        const coursesData = coursesRes.data;
        const chaptersData = chaptersRes.data;
        const testsData = testsRes.data;

        // Transform data to match frontend types
        const transformedClasses: Class[] = classesData?.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          teacherId: c.teacher_id,
          createdAt: new Date(c.created_at),
          studentCount: c.student_count || 0,
          inviteCode: (c as any).invite_code || ''
        })) || [];

        const transformedCourses: Course[] = coursesData?.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          classId: c.class_id,
          chapterCount: chaptersData?.filter(ch => ch.course_id === c.id).length || 0,
          createdAt: new Date(c.created_at)
        })) || [];

        const transformedChapters: Chapter[] = chaptersData?.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          courseId: c.course_id,
          testCount: testsData?.filter(t => t.chapter_id === c.id).length || 0
        })) || [];

        const transformedTests: Test[] = testsData?.map(t => ({
          id: t.id,
          title: t.title,
          duration: t.duration,
          chapterId: t.chapter_id,
          questions: (t.questions as any as Question[]) || [],
          createdAt: new Date(t.created_at),
          scheduledDate: t.scheduled_date ? new Date(t.scheduled_date) : undefined,
          scheduledTime: t.scheduled_time || undefined,
          isScheduled: t.is_scheduled || false,
          isPro: (t as any).is_pro || false,
          isLocked: (t as any).is_locked || true
        })) || [];

        setClasses(transformedClasses);
        setCourses(transformedCourses);
        setChapters(transformedChapters);
        setTests(transformedTests);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Class management functions
  const handleClassCreate = async (newClass: Omit<Class, 'id' | 'createdAt'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('classes')
        .insert({
          name: newClass.name,
          description: newClass.description,
          teacher_id: user.id,
          student_count: newClass.studentCount
        })
        .select()
        .single();

      if (error) throw error;

      const transformedClass: Class = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        teacherId: data.teacher_id,
        createdAt: new Date(data.created_at),
        studentCount: data.student_count || 0,
        inviteCode: (data as any).invite_code || ''
      };

      setClasses(prev => [transformedClass, ...prev]);
      toast.success('Class created successfully!');
    } catch (error) {
      console.error('Error creating class:', error);
      toast.error('Failed to create class');
    }
  };

  const handleClassUpdate = async (updatedClass: Class) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({
          name: updatedClass.name,
          description: updatedClass.description,
          student_count: updatedClass.studentCount
        })
        .eq('id', updatedClass.id);

      if (error) throw error;

      setClasses(prev => prev.map(c => c.id === updatedClass.id ? updatedClass : c));
      toast.success('Class updated successfully!');
    } catch (error) {
      console.error('Error updating class:', error);
      toast.error('Failed to update class');
    }
  };

  const handleClassDelete = async (classId: string) => {
    const targetClass = classes.find((cls) => cls.id === classId);
    if (targetClass && targetClass.studentCount > 0) {
      toast.error('Cannot delete a class that already has students enrolled.');
      return;
    }

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;

      setClasses(prev => prev.filter(c => c.id !== classId));
      toast.success('Class deleted successfully!');
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Failed to delete class');
    }
  };

  // Course management functions
  const handleCourseCreate = async (newCourse: Omit<Course, 'id' | 'createdAt'>) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert({
          name: newCourse.name,
          description: newCourse.description,
          class_id: newCourse.classId,
          chapter_count: newCourse.chapterCount
        })
        .select()
        .single();

      if (error) throw error;

      const transformedCourse: Course = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        classId: data.class_id,
        chapterCount: data.chapter_count || 0,
        createdAt: new Date(data.created_at)
      };

      setCourses(prev => [transformedCourse, ...prev]);
      setNewCourseClassId('');
      toast.success('Course created successfully!');
    } catch (error) {
      console.error('Error creating course:', error);
      toast.error('Failed to create course');
    }
  };

  const handleCourseUpdate = async (updatedCourse: Course) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({
          name: updatedCourse.name,
          description: updatedCourse.description,
          class_id: updatedCourse.classId,
          chapter_count: updatedCourse.chapterCount
        })
        .eq('id', updatedCourse.id);

      if (error) throw error;

      setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
      toast.success('Course updated successfully!');
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course');
    }
  };

  const handleCourseDelete = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      setCourses(prev => prev.filter(c => c.id !== courseId));
      toast.success('Course deleted successfully!');
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
    }
  };

  // Chapter management functions
  const handleCreateChapter = async () => {
    if (!newChapter.name || !newChapter.courseId) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chapters')
        .insert({
          name: newChapter.name,
          description: newChapter.description,
          course_id: newChapter.courseId,
          test_count: 0
        })
        .select()
        .single();

      if (error) throw error;

      const transformedChapter: Chapter = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        courseId: data.course_id,
        testCount: data.test_count || 0
      };

      setChapters(prev => [transformedChapter, ...prev]);
      setCourses(prev => prev.map(course => course.id === newChapter.courseId ? { ...course, chapterCount: course.chapterCount + 1 } : course));
      setNewChapter({ name: '', description: '', courseId: '' });
      toast.success('Chapter created successfully!');
    } catch (error) {
      console.error('Error creating chapter:', error);
      toast.error('Failed to create chapter');
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    try {
      const { error } = await supabase
        .from('chapters')
        .delete()
        .eq('id', chapterId);

      if (error) throw error;

      const deletedChapter = chapters.find((chapter) => chapter.id === chapterId);
      setChapters(prev => prev.filter(c => c.id !== chapterId));
      if (deletedChapter) {
        setCourses(prev => prev.map(course => course.id === deletedChapter.courseId ? { ...course, chapterCount: Math.max(0, course.chapterCount - 1) } : course));
      }
      toast.success('Chapter deleted successfully!');
    } catch (error) {
      console.error('Error deleting chapter:', error);
      toast.error('Failed to delete chapter');
    }
  };

  // Test management functions
  const handleCreateTest = async () => {
    if (!newTest.title || !newTest.chapterId || newTest.questions.length === 0) {
      toast.error('Please fill all required fields and add at least one question');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tests')
        .insert({
          title: newTest.title,
          duration: newTest.duration,
          chapter_id: newTest.chapterId,
          questions: newTest.questions as any,
          scheduled_date: newTest.scheduledDate?.toISOString().split('T')[0],
          scheduled_time: newTest.scheduledTime || null,
          is_scheduled: newTest.isScheduled,
          is_pro: newTest.isPro
        } as any)
        .select()
        .single();

      if (error) throw error;

      const transformedTest: Test = {
        id: data.id,
        title: data.title,
        duration: data.duration,
        chapterId: data.chapter_id,
        questions: (data.questions as any as Question[]) || [],
        createdAt: new Date(data.created_at),
        scheduledDate: data.scheduled_date ? new Date(data.scheduled_date) : undefined,
        scheduledTime: data.scheduled_time || undefined,
        isScheduled: data.is_scheduled || false,
        isPro: (data as any).is_pro || false
      };

      setTests(prev => [transformedTest, ...prev]);
      setChapters(prev => prev.map(chapter => chapter.id === newTest.chapterId ? { ...chapter, testCount: chapter.testCount + 1 } : chapter));
      setNewTest({
        title: '',
        duration: 30,
        chapterId: '',
        questions: [],
        scheduledDate: undefined,
        scheduledTime: '',
        isScheduled: false,
        isPro: false,
      });
      toast.success('Test created successfully!');
    } catch (error) {
      console.error('Error creating test:', error);
      toast.error('Failed to create test');
    }
  };

  const handleToggleTestLock = async (test: Test, locked: boolean) => {
    setTests(prev => prev.map(t => t.id === test.id ? { ...t, isLocked: locked } : t));
    try {
      const { error } = await supabase
        .from('tests')
        .update({ is_locked: locked } as any)
        .eq('id', test.id);
      if (error) throw error;
      toast.success(locked ? 'Test locked — delete disabled' : 'Test unlocked');
    } catch (error) {
      console.error('Error updating test lock:', error);
      setTests(prev => prev.map(t => t.id === test.id ? { ...t, isLocked: !locked } : t));
      toast.error('Failed to update lock state');
    }
  };

  const handleDeleteTest = async (testId: string) => {
    try {
      const { error } = await supabase
        .from('tests')
        .delete()
        .eq('id', testId);

      if (error) throw error;

      const deletedTest = tests.find((test) => test.id === testId);
      setTests(prev => prev.filter(t => t.id !== testId));
      if (deletedTest) {
        setChapters(prev => prev.map(chapter => chapter.id === deletedTest.chapterId ? { ...chapter, testCount: Math.max(0, chapter.testCount - 1) } : chapter));
      }
      toast.success('Test deleted successfully!');
    } catch (error) {
      console.error('Error deleting test:', error);
      toast.error('Failed to delete test');
    }
  };

  const handleConfirmDeleteTest = async () => {
    if (!testToDelete) return;
    await handleDeleteTest(testToDelete.id);
    setTestToDelete(null);
  };

  const handleEditTest = (test: Test) => {
    setEditingTest(test);
  };

  const handleSaveEditedTest = (updatedTest: Test) => {
    setTests(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
    setEditingTest(null);
  };

  const handleCancelEdit = () => {
    setEditingTest(null);
  };

  // Helper functions
  const getCourseName = (courseId: string) => {
    return courses.find(c => c.id === courseId)?.name || 'Unknown Course';
  };

  const getChapterName = (chapterId: string) => {
    return chapters.find(c => c.id === chapterId)?.name || 'Unknown Chapter';
  };

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || 'Unknown Class';
  };

  const getAvailableCourses = () => {
    return courses.filter(course => 
      classes.some(cls => cls.id === course.classId)
    );
  };

  const selectedClassCourses = courses.filter((course) => course.classId === selectedClassId);
  const selectedCourseTests = selectedCourseId
    ? tests.filter((test) => {
        const chapter = chapters.find((item) => item.id === test.chapterId);
        return chapter?.courseId === selectedCourseId;
      })
    : [];

  const filteredTests = tests.filter((test) => {
    const chapter = chapters.find((item) => item.id === test.chapterId);
    const course = courses.find((item) => item.id === chapter?.courseId);
    const matchesClass = !testFilterClassId || testFilterClassId === 'all' || course?.classId === testFilterClassId;
    const matchesCourse = !testFilterCourseId || testFilterCourseId === 'all' || chapter?.courseId === testFilterCourseId;
    const matchesChapter = !testFilterChapterId || testFilterChapterId === 'all' || test.chapterId === testFilterChapterId;
    return matchesClass && matchesCourse && matchesChapter;
  });

  const availableTestCourses = courses.filter((course) => !testFilterClassId || testFilterClassId === 'all' || course.classId === testFilterClassId);
  const availableTestChapters = chapters.filter((chapter) => !testFilterCourseId || testFilterCourseId === 'all' || chapter.courseId === testFilterCourseId);

  const getAvailableChapters = () => {
    return chapters.filter(chapter => 
      courses.some(course => course.id === chapter.courseId)
    );
  };

  const handleOpenManageTests = (classId?: string, courseId?: string) => {
    setSelectedClassId(classId ?? null);
    setSelectedCourseId(courseId ?? null);
    setTestFilterClassId(classId ?? '');
    setTestFilterCourseId(courseId ?? '');
    setTestFilterChapterId('');
    setActiveTab('tests');
  };

  // Question management for tests
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: '',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: '',
  });

  const addQuestionToTest = () => {
    if (!currentQuestion.question || currentQuestion.options.some(opt => !opt.trim())) {
      toast.error('Please fill all question fields');
      return;
    }

    const newQuestion: Question = {
      ...currentQuestion,
      id: Date.now().toString(),
    };

    setNewTest(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));

    setCurrentQuestion({
      id: '',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
    });

    toast.success('Question added to test!');
  };

  const removeQuestionFromTest = (questionId: string) => {
    setNewTest(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId)
    }));
    toast.success('Question removed from test!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-lg font-medium">Loading dashboard...</div>
          <div className="text-sm text-muted-foreground">Fetching your classes, courses, and tests</div>
        </div>
      </div>
    );
  }

  // Show TestPreview if previewing a test
  if (previewingTest) {
    return <TestPreview test={previewingTest} onClose={() => setPreviewingTest(null)} />;
  }

  // Show TestEditor if editing a test
  if (editingTest) {
    return (
      <div className="container mx-auto p-6">
        <TestEditor 
          test={editingTest}
          chapters={chapters}
          courses={courses}
          classes={classes}
          onSave={handleSaveEditedTest}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  const sidebarItems = [
    { key: 'pyq' as const, label: 'PYQ Papers', icon: FileQuestion },
    { key: 'doubts' as const, label: 'Doubts', icon: MessageCircle },
    { key: 'notices' as const, label: 'Notices', icon: Megaphone },
    { key: 'leaderboard' as const, label: 'Leaderboard', icon: Trophy },
    { key: 'upgrades' as const, label: 'Upgrades', icon: Sparkles },
    { key: 'share-signup' as const, label: 'Share Signup Link', icon: Share2 },
  ];

  const renderSidebarSection = () => {
    switch (sidebarSection) {
      case 'pyq':
        return <QuestionPaperUpload classes={classes} userId={user?.id || ''} />;
      case 'doubts':
        return <TeacherDoubtChat classes={classes} userId={user?.id || ''} />;
      case 'notices':
        return <TeacherNotices classes={classes} />;
      case 'leaderboard':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" /> Class Leaderboard
            </h2>
            {classes.length === 0 ? (
              <p className="text-muted-foreground">Create a class first to see rankings.</p>
            ) : (
              <>
                <ClassLeaderboard
                  classes={classes}
                  onSelectStudent={(id, name) =>
                    navigate(`/student-history/${id}?name=${encodeURIComponent(name)}`)
                  }
                />
                <TestResults classes={classes} mode="teacher" />
              </>
            )}
          </div>
        );
      case 'upgrades':
        return <UpgradeRequestsManager />;
      case 'share-signup':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Share2 className="h-6 w-6 text-primary" /> Share Signup Links
              </h2>
              <p className="text-sm text-muted-foreground">
                Send these links to students so they can sign up and join your classes directly.
              </p>
            </div>

            {classes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Create a class first to generate a signup link.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {classes.map((cls) => {
                  const signupLink = `${window.location.origin}/auth?inviteCode=${cls.inviteCode}`;
                  return (
                    <Card key={cls.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{cls.name}</CardTitle>
                        <CardDescription>{cls.description || 'Open signup link for this class'}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-md border bg-muted/40 p-3 text-sm break-all">
                          {signupLink}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            navigator.clipboard.writeText(signupLink);
                            toast.success(`Signup link copied for ${cls.name}`);
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Signup Link
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AlertDialog open={!!testToDelete} onOpenChange={(open) => !open && setTestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this test?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {testToDelete?.title || 'this test'} and all its associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteTest}
            >
              Delete Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={sidebarSection === null}
                      onClick={() => setSidebarSection(null)}
                      tooltip="Management"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Management</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sidebarItems.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={sidebarSection === item.key}
                        onClick={() => setSidebarSection(item.key)}
                        tooltip={item.label}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
            <SidebarTrigger />
            <span className="text-sm font-medium">Menu</span>
          </div>
          <div className="container mx-auto p-6 space-y-8">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hidden md:inline-flex" />
              <div className="flex flex-col space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
                <p className="text-muted-foreground">
                  Manage your classes, subjects, chapters, and create tests for your students.
                </p>
              </div>
            </div>

            {sidebarSection ? (
              <div className="space-y-6">{renderSidebarSection()}</div>
            ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
              <TabsList className="flex flex-wrap h-auto gap-1 w-full">
                <TabsTrigger value="classes" className="flex-1 min-w-[80px] text-xs sm:text-sm">Classes</TabsTrigger>
                <TabsTrigger value="students" className="flex-1 min-w-[80px] text-xs sm:text-sm">Students</TabsTrigger>
                <TabsTrigger value="courses" className="flex-1 min-w-[80px] text-xs sm:text-sm">Subjects</TabsTrigger>
                <TabsTrigger value="chapters" className="flex-1 min-w-[80px] text-xs sm:text-sm">Chapters</TabsTrigger>
                <TabsTrigger value="create-test" className="flex-1 min-w-[80px] text-xs sm:text-sm">Create Test</TabsTrigger>
                <TabsTrigger value="tests" className="flex-1 min-w-[80px] text-xs sm:text-sm">Tests</TabsTrigger>
              </TabsList>


        {/* Classes Tab */}
        <TabsContent value="classes" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Manage Classes</h2>
          </div>
          
          {/* Create New Class Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GraduationCap className="h-5 w-5" />
                <span>Create New Class</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleClassCreate({
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  teacherId: user?.id || '',
                  studentCount: 0,
                  inviteCode: ''
                });
                e.currentTarget.reset();
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Class Name</Label>
                    <Input 
                      id="name"
                      name="name"
                      placeholder="e.g., Mathematics Class 10A" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input 
                      id="description"
                      name="description"
                      placeholder="Brief description of the class" 
                    />
                  </div>
                </div>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Class
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Classes List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Card
                key={cls.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md",
                  selectedClassId === cls.id && "border-primary shadow-md"
                )}
                onClick={() => {
                  setSelectedClassId((current) => (current === cls.id ? null : cls.id));
                  setSelectedCourseId(null);
                }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{cls.name}</span>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleClassDelete(cls.id);
                        }}
                        disabled={cls.studentCount > 0}
                        title={cls.studentCount > 0 ? 'This class has students enrolled and cannot be deleted' : 'Delete class'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>{cls.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{cls.studentCount} students</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Created {format(cls.createdAt, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="pt-2">
                      <div className="text-sm text-muted-foreground">Subjects:</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {courses.filter((c) => c.classId === cls.id).slice(0, 6).map((c) => (
                          <Badge key={c.id} variant="secondary">{c.name}</Badge>
                        ))}
                        {courses.filter((c) => c.classId === cls.id).length === 0 && (
                          <div className="text-sm text-muted-foreground">No subjects yet</div>
                        )}
                      </div>
                    </div>
                    {cls.inviteCode && (
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">Invite Code:</span>
                          <code className="text-sm font-mono font-bold tracking-wider text-primary">{cls.inviteCode}</code>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigator.clipboard.writeText(cls.inviteCode);
                            toast.success('Invite code copied!');
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedClassId && (
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{getClassName(selectedClassId)} subjects</h3>
                  <p className="text-sm text-muted-foreground">Click a subject to view its tests.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenManageTests(selectedClassId ?? undefined)}
                  >
                    Open in Manage Tests
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedClassId(null); setSelectedCourseId(null); }}>
                    Clear view
                  </Button>
                </div>
              </div>

              {selectedClassCourses.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No subjects created for this class yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {selectedClassCourses.map((course) => (
                    <Card
                      key={course.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md",
                        selectedCourseId === course.id && "border-primary shadow-md"
                      )}
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        handleOpenManageTests(course.classId, course.id);
                      }}
                    >
                      <CardHeader>
                        <CardTitle className="text-base">{course.name}</CardTitle>
                        <CardDescription>{course.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{course.chapterCount} chapters</span>
                          <span>{format(course.createdAt, 'MMM dd')}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenManageTests(course.classId, course.id);
                          }}
                        >
                          Open in Manage Tests
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {selectedCourseId && (
                <div className="space-y-3 rounded-lg border bg-background/80 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Tests for {courses.find((course) => course.id === selectedCourseId)?.name}</h4>
                      <p className="text-sm text-muted-foreground">These are the tests connected to the selected subject.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCourseId(null)}>
                      Back to subjects
                    </Button>
                  </div>

                  {selectedCourseTests.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No tests created for this subject yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCourseTests.map((test) => (
                        <Card key={test.id} className="hover:border-primary/50 transition-colors">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">{test.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <span>Duration</span>
                              <span>{test.duration} mins</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Chapter</span>
                              <span>{getChapterName(test.chapterId)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Manage Students</h2>
          </div>
          <StudentManagement classes={classes} />
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Manage Subjects</h2>
          </div>

          {/* Create New Course Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>Create New Subject</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!newCourseClassId) {
                  toast.error('Please select a class for this subject');
                  return;
                }
                const formData = new FormData(e.currentTarget);
                handleCourseCreate({
                  name: formData.get('name') as string,
                  description: formData.get('description') as string,
                  classId: newCourseClassId,
                  chapterCount: 0
                });
                e.currentTarget.reset();
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="course-name">Subject Name</Label>
                    <Input 
                      id="course-name"
                      name="name"
                      placeholder="e.g., Algebra" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course-description">Description</Label>
                    <Input 
                      id="course-description"
                      name="description"
                      placeholder="Brief description" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course-class">Select Class</Label>
                    <Select value={newCourseClassId} onValueChange={setNewCourseClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Subject
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Courses List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{course.name}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCourseDelete(course.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>{course.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Class:</span>
                      <Badge variant="secondary">{getClassName(course.classId)}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="h-4 w-4" />
                        <span>{course.chapterCount} chapters</span>
                      </div>
                      <span>Created {format(course.createdAt, 'MMM dd')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Chapters Tab */}
        <TabsContent value="chapters" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Manage Chapters</h2>
          </div>

          {/* Create New Chapter Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FolderOpen className="h-5 w-5" />
                <span>Create New Chapter</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chapter-name">Chapter Name</Label>
                    <Input 
                      id="chapter-name"
                      value={newChapter.name}
                      onChange={(e) => setNewChapter(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Linear Equations" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chapter-description">Description</Label>
                    <Input 
                      id="chapter-description"
                      value={newChapter.description}
                      onChange={(e) => setNewChapter(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chapter-course">Select Subject</Label>
                    <Select 
                      value={newChapter.courseId} 
                      onValueChange={(value) => setNewChapter(prev => ({ ...prev, courseId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableCourses().map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name} ({getClassName(course.classId)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCreateChapter}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Chapter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Chapters List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chapters.map((chapter) => (
              <Card key={chapter.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{chapter.name}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteChapter(chapter.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>{chapter.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subject:</span>
                      <Badge variant="secondary">{getCourseName(chapter.courseId)}</Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{chapter.testCount} tests</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Manage Tests</h2>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={testFilterClassId} onValueChange={(value) => {
                    setTestFilterClassId(value);
                    setTestFilterCourseId('');
                    setTestFilterChapterId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={testFilterCourseId} onValueChange={(value) => {
                    setTestFilterCourseId(value);
                    setTestFilterChapterId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {availableTestCourses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chapter</Label>
                  <Select value={testFilterChapterId} onValueChange={setTestFilterChapterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All chapters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All chapters</SelectItem>
                      {availableTestChapters.map((chapter) => (
                        <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={() => {
                    setTestFilterClassId('all');
                    setTestFilterCourseId('all');
                    setTestFilterChapterId('all');
                  }}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tests List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTests.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <div className="text-muted-foreground">No tests match the current filters</div>
                <p className="text-sm text-muted-foreground mt-2">Try a different class, subject, or chapter selection</p>
              </div>
            ) : (
              filteredTests.map((test) => (
                <Card key={test.id} className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50" onClick={() => handleEditTest(test)}>
                          <CardHeader>
                            {/* Icons line */}
                            <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Who attempted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setParticipationTest(test);
                          }}
                        >
                          <UsersRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Question analytics"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnalyticsTest(test);
                          }}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Preview as student"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewingTest(test);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Download PDF (with answers)"
                          disabled={!!downloadingTest}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!test.questions || test.questions.length === 0) {
                              toast.error("No questions in this test");
                              return;
                            }
                            toast.info("Generating PDF...");
                            setDownloadingTest(test);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTest(test);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive disabled:opacity-40"
                          disabled={!!test.isLocked}
                          title={test.isLocked ? "Unlock to delete" : "Delete test"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (test.isLocked) return;
                            setTestToDelete(test);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Lock checkbox */}
                      <div
                        className="flex items-center gap-2 mt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          id={`lock-${test.id}`}
                          checked={!!test.isLocked}
                          onCheckedChange={(checked) => handleToggleTestLock(test, checked === true)}
                        />
                        <Label
                          htmlFor={`lock-${test.id}`}
                          className="text-xs flex items-center gap-1 cursor-pointer text-muted-foreground"
                        >
                          <Lock className="h-3 w-3" /> Lock (disable delete)
                        </Label>
                      </div>
                      {/* Test title below the icons line, above the subject */}
                      <div className="mt-2 min-w-0">
                        <div className="text-xs text-muted-foreground">Test</div>
                        <CardTitle className="font-semibold leading-6 break-words">{test.title}</CardTitle>
                      </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Subject:</span>
                          <Badge variant="secondary">{(() => {
                            const chapter = chapters.find((ch) => ch.id === test.chapterId);
                            return getCourseName(chapter?.courseId || '');
                          })()}</Badge>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-muted-foreground">Class:</span>
                          <Badge variant="outline">{(() => {
                            const chapter = chapters.find((ch) => ch.id === test.chapterId);
                            const course = courses.find((co) => co.id === chapter?.courseId);
                            return getClassName(course?.classId || '');
                          })()}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Chapter:</span>
                        <Badge variant="secondary">{getChapterName(test.chapterId)}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Access:</span>
                        {test.isPro ? (
                          <Badge variant="outline" className="text-warning border-warning/50">
                            <Crown className="h-3 w-3 mr-1" />Pro
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-500/50">Free</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>{test.duration} minutes</span>
                        </div>
                        <span>{test.questions.length} questions</span>
                      </div>
                      {test.isScheduled && test.scheduledDate && (
                        <div className="text-sm text-muted-foreground">
                          <CalendarIcon className="h-3 w-3 inline mr-1" />
                          Scheduled: {format(test.scheduledDate, 'MMM dd, yyyy')}
                          {test.scheduledTime && ` at ${test.scheduledTime}`}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground border-t pt-2">
                        Created {format(test.createdAt, 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Create Test Tab */}
        <TabsContent value="create-test" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Create New Test</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Test Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="test-title">Test Title</Label>
                  <Input 
                    id="test-title"
                    value={newTest.title}
                    onChange={(e) => setNewTest(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Linear Equations Quiz" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-duration">Duration (minutes)</Label>
                  <Input 
                    id="test-duration"
                    type="number"
                    value={newTest.duration}
                    onChange={(e) => setNewTest(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-chapter">Select Chapter</Label>
                  <Select 
                    value={newTest.chapterId} 
                    onValueChange={(value) => setNewTest(prev => ({ ...prev, chapterId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a chapter" />
                    </SelectTrigger>
                    <SelectContent>
  {getAvailableChapters().map((chapter) => (
    <SelectItem key={chapter.id} value={chapter.id}>
      {chapter.name} ({getCourseName(chapter.courseId)})({getClassName(
        courses.find(c => c.id === chapter.courseId)?.classId || ''
      )})
    </SelectItem>
  ))}
</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Scheduling Options */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="schedule-test"
                    checked={newTest.isScheduled}
                    onChange={(e) => setNewTest(prev => ({ ...prev, isScheduled: e.target.checked }))}
                  />
                  <Label htmlFor="schedule-test">Schedule this test</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="pro-test"
                    checked={newTest.isPro}
                    onChange={(e) => setNewTest(prev => ({ ...prev, isPro: e.target.checked }))}
                  />
                  <Label htmlFor="pro-test" className="flex items-center space-x-1">
                    <Crown className="h-4 w-4 text-warning" />
                    <span>Pro-only test (only available to Pro students)</span>
                  </Label>
                </div>

                {newTest.isScheduled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Scheduled Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newTest.scheduledDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newTest.scheduledDate ? format(newTest.scheduledDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarUI
                            mode="single"
                            selected={newTest.scheduledDate}
                            onSelect={(date) => setNewTest(prev => ({ ...prev, scheduledDate: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduled-time">Scheduled Time</Label>
                      <Input 
                        id="scheduled-time"
                        type="time"
                        value={newTest.scheduledTime}
                        onChange={(e) => setNewTest(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Question Creation */}
          <EnhancedQuestionFormV2 
            onAddQuestion={(question) => {
              setNewTest(prev => ({
                ...prev,
                questions: [...prev.questions, question]
              }));
            }}
            onRemoveQuestion={removeQuestionFromTest}
            onUpdateQuestion={(question) => {
              setNewTest(prev => ({
                ...prev,
                questions: prev.questions.map(q => q.id === question.id ? question : q)
              }));
            }}
            existingQuestions={newTest.questions}
          />

          {/* Create Test Button */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleCreateTest} 
                className="w-full"
                disabled={!newTest.title || !newTest.chapterId || newTest.questions.length === 0}
              >
                Create Test ({newTest.questions.length} questions)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
            </Tabs>
            )}

            <QuestionAnalytics test={analyticsTest} onClose={() => setAnalyticsTest(null)} />
            <TestParticipation test={participationTest} onClose={() => setParticipationTest(null)} />
            {downloadingTest && (
              <TestPaperPDF
                test={downloadingTest}
                onDone={() => {
                  setDownloadingTest(null);
                  toast.success("PDF downloaded");
                }}
              />
            )}
          </div>
        </div>
      </div>
      </SidebarProvider>
    </>
  );
};
