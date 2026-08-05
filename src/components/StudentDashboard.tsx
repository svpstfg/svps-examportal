import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Clock, BookOpen, Play, CheckCircle, AlertCircle, Trophy, Target, GraduationCap, User, LogOut, Calendar, FileText, Lock, Crown, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Class, Course, Chapter, Question, Test, TestAttempt, Student } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { RichTextDisplay } from "./RichTextDisplay";
import { isAnswered, isAnswerCorrect, normalizeQuestionTime, getQuestionRemark } from "@/lib/answers";
import { AnswerSheetView } from "./AnswerSheetView";
import { useAuth } from "@/hooks/useAuth";
import { JoinClassCard } from "./JoinClassCard";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeftClose, PanelLeftOpen, Bell, History, RefreshCw, MessageCircle } from "lucide-react";


import { QuestionPaperDownload } from "./QuestionPaperDownload";
import { StudentDoubtChat } from "./StudentDoubtChat";
import { ClassLeaderboard } from "./ClassLeaderboard";
import { TestResults } from "./TestResults";
import { UpgradeBanner } from "./UpgradeBanner";
import { ReexamRequestButton } from "./ReexamRequestButton";

const RESUME_KEY = (studentId: string, testId: string) => `test_progress_${studentId}_${testId}`;

const CollapseToggle = ({ className }: { className?: string }) => {
  const { state, toggleSidebar, isMobile, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : state === "expanded";
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggleSidebar}
      aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
    >
      {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
    </Button>
  );
};

export const StudentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [reexamGrants, setReexamGrants] = useState<string[]>([]);
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTestActive, setIsTestActive] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState<TestAttempt | null>(null);
  const [viewingAnswerSheet, setViewingAnswerSheet] = useState<{ attempt: TestAttempt; test: Test } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  // Per-question time tracking (seconds spent on each question)
  const questionTimesRef = useRef<number[]>([]);
  const questionStartRef = useRef<number>(Date.now());
  // Refs used to persist an "unfinished" record if the student leaves mid-test
  const isTestActiveRef = useRef(false);
  const submittedRef = useRef(false);
  const abandonSavedRef = useRef(false);
  const selectedAnswersRef = useRef<number[]>([]);
  const timeLeftRef = useRef(0);
  const currentTestRef = useRef<Test | null>(null);
  const studentRef = useRef<Student | null>(null);

  const handleDownloadResultPdf = async () => {
    const node = resultRef.current;
    if (!node || !currentTest) return;
    setDownloadingPdf(true);
    try {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 100));
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        allowTaint: true,
        windowWidth: node.scrollWidth,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = pdfWidth / canvas.width;
      const totalPdfHeight = canvas.height * ratio;
      let position = 0;
      let remaining = totalPdfHeight;
      while (remaining > 0) {
        if (position > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, totalPdfHeight);
        position += pdfHeight;
        remaining -= pdfHeight;
      }
      pdf.save(`${currentTest.title.replace(/\s+/g, "_")}_Result.pdf`);
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };


  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        console.log('Loading student data for email:', user.email);
        
        // Get student profile (may have multiple rows for multi-class enrollment)
        const { data: studentRows, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('email', user.email);

        console.log('Student query result:', { studentRows, studentError });

        if (studentError) {
          console.error('Error fetching student:', studentError);
          toast.error('Error loading student profile. Please try again.');
          setLoading(false);
          return;
        }

        const studentData = studentRows && studentRows.length > 0 ? studentRows[0] : null;

        // If no student profile, check if user is a teacher
        if (!studentData) {
          console.log('No student profile found, checking teacher profile');
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          
          // Load all data for teacher viewing as student
          const [classesRes, coursesRes, chaptersRes, testsRes] = await Promise.all([
            supabase.from('classes').select('*').order('created_at', { ascending: false }),
            supabase.from('courses').select('*').order('created_at', { ascending: false }),
            supabase.from('chapters').select('*').order('created_at', { ascending: false }),
            supabase.from('tests').select('*').order('created_at', { ascending: false })
          ]);

          if (classesRes.error || coursesRes.error || chaptersRes.error || testsRes.error) {
            console.error('Error fetching data for teacher');
            toast.error('Error loading dashboard data');
            setLoading(false);
            return;
          }

          // Transform data for teacher
          const transformedClasses: Class[] = classesRes.data?.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            teacherId: c.teacher_id,
            createdAt: new Date(c.created_at),
            studentCount: c.student_count || 0,
            inviteCode: (c as any).invite_code || ''
          })) || [];

          const transformedCourses: Course[] = coursesRes.data?.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            classId: c.class_id,
            chapterCount: c.chapter_count || 0,
            createdAt: new Date(c.created_at)
          })) || [];

          const transformedChapters: Chapter[] = chaptersRes.data?.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            courseId: c.course_id,
            testCount: c.test_count || 0
          })) || [];

          const transformedTests: Test[] = testsRes.data?.map(t => ({
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
            closeAfterSchedule: (t as any).close_after_schedule || false,
            singleAttempt: (t as any).single_attempt || false,
            negativeMarking: Number((t as any).negative_marking) || 0
          })) || [];

          setClasses(transformedClasses);
          setCourses(transformedCourses);
          setChapters(transformedChapters);
          setTests(transformedTests);
          setAttempts([]);
          setLoading(false);
          return;
        }

        const transformedStudent: Student = {
          id: studentData.id,
          name: studentData.name,
          email: studentData.email,
          classId: studentData.class_id,
          enrolledAt: new Date(studentData.enrolled_at)
        };
        setStudent(transformedStudent);

        // Fetch attempts (student-specific) in parallel with shared content
        const sharedPromise = Promise.all([
          supabase.from('classes').select('*').order('created_at', { ascending: false }),
          supabase.from('courses').select('*').order('created_at', { ascending: false }),
          supabase.from('chapters').select('*').order('created_at', { ascending: false }),
          supabase.from('tests').select('*').order('created_at', { ascending: false }),
        ]);
        const attemptsPromise = supabase
          .from('test_attempts')
          .select('*')
          .eq('student_id', studentData.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false });

        // Render dashboard ASAP — don't block on full data load
        setLoading(false);

        const [classesRes, coursesRes, chaptersRes, testsRes] = await sharedPromise;
        const attemptsRes = await attemptsPromise;

        if (classesRes.error) console.error('Classes error:', classesRes.error);
        if (coursesRes.error) console.error('Courses error:', coursesRes.error);
        if (chaptersRes.error) console.error('Chapters error:', chaptersRes.error);
        if (testsRes.error) console.error('Tests error:', testsRes.error);
        if (attemptsRes.error) console.error('Attempts error:', attemptsRes.error);

        // Transform data
        const transformedClasses: Class[] = classesRes.data?.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          teacherId: c.teacher_id,
          createdAt: new Date(c.created_at),
          studentCount: c.student_count || 0,
          inviteCode: (c as any).invite_code || ''
        })) || [];

        const transformedCourses: Course[] = coursesRes.data?.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          classId: c.class_id,
          chapterCount: c.chapter_count || 0,
          createdAt: new Date(c.created_at)
        })) || [];

        const transformedChapters: Chapter[] = chaptersRes.data?.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          courseId: c.course_id,
          testCount: c.test_count || 0
        })) || [];

        const transformedTests: Test[] = testsRes.data?.map(t => ({
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
          closeAfterSchedule: (t as any).close_after_schedule || false,
          singleAttempt: (t as any).single_attempt || false
        })) || [];

        const transformedAttempts: TestAttempt[] = attemptsRes.data?.map(a => ({
          id: a.id,
          testId: a.test_id,
          studentId: a.student_id,
          answers: a.answers || [],
          score: a.score,
          completedAt: new Date(a.completed_at),
          timeSpent: a.time_spent,
          questionTimes: (a.question_times as any) || [],
          status: ((a as any).status as 'completed' | 'unfinished') || 'completed',
        })) || [];

        setClasses(transformedClasses);
        setCourses(transformedCourses);
        setChapters(transformedChapters);
        setTests(transformedTests);
        setAttempts(transformedAttempts);

        // Approved (unused) re-exam permissions
        const { data: grantRows } = await supabase
          .from('reexam_requests')
          .select('test_id')
          .eq('student_id', studentData.id)
          .eq('status', 'approved')
          .is('used_at', null);
        setReexamGrants((grantRows || []).map((g: any) => g.test_id));
        
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);


  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isTestActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            handleSubmitTest();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTestActive, timeLeft]);

  // Auto-save in-progress attempt every 10s (localStorage)
  useEffect(() => {
    if (!isTestActive || !currentTest || !student) return;
    const save = () => {
      try {
        localStorage.setItem(
          RESUME_KEY(student.id, currentTest.id),
          JSON.stringify({
            answers: selectedAnswers,
            currentIndex: currentQuestionIndex,
            timeLeft,
            questionTimes: questionTimesRef.current.slice(0, currentTest.questions.length),
            savedAt: Date.now(),
          })
        );
      } catch {
        /* quota — ignore */
      }
    };
    save();
    const id = setInterval(save, 10_000);
    return () => clearInterval(id);
  }, [isTestActive, currentTest, student, selectedAnswers, currentQuestionIndex, timeLeft]);

  // Track time spent per question while the test is active.
  useEffect(() => {
    if (!isTestActive || !currentTest) return;

    const idx = currentQuestionIndex;
    const interval = window.setInterval(() => {
      if (questionTimesRef.current[idx] !== undefined) {
        questionTimesRef.current[idx] += 1;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentQuestionIndex, isTestActive, currentTest]);

  // Keep refs in sync so the abandon handler always has the latest values.
  useEffect(() => { isTestActiveRef.current = isTestActive; }, [isTestActive]);
  useEffect(() => { selectedAnswersRef.current = selectedAnswers; }, [selectedAnswers]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { currentTestRef.current = currentTest; }, [currentTest]);
  useEffect(() => { studentRef.current = student; }, [student]);

  // Record an "unfinished" attempt when a student leaves mid-test without submitting.
  const saveUnfinishedAttempt = () => {
    const t = currentTestRef.current;
    const s = studentRef.current;
    if (!t || !s) return;
    if (!isTestActiveRef.current || submittedRef.current || abandonSavedRef.current) return;
    abandonSavedRef.current = true;

    const answers = (selectedAnswersRef.current && selectedAnswersRef.current.length)
      ? selectedAnswersRef.current
      : new Array(t.questions.length).fill(-1);
    const penalty = (t as any).negativeMarking || 0;
    const score = Math.max(0, answers.reduce((total, answer, index) => {
      if (answer === t.questions[index]?.correctAnswer) return total + 1;
      if (answer >= 0) return total - penalty;
      return total;
    }, 0));
    const percentage = t.questions.length ? Math.round((score / t.questions.length) * 100) : 0;
    const timeSpent = Math.max(0, t.duration * 60 - timeLeftRef.current);
    const questionTimes = questionTimesRef.current
      .slice(0, t.questions.length)
      .map(normalizeQuestionTime);

    // Fire-and-forget; best effort on unmount / tab close.
    supabase
      .from('test_attempts')
      .insert({
        test_id: t.id,
        student_id: s.id,
        answers,
        score: percentage,
        time_spent: timeSpent,
        question_times: questionTimes,
        status: 'unfinished',
      } as any)
      .then(() => {}, () => {});
  };

  useEffect(() => {
    const handler = () => saveUnfinishedAttempt();
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      saveUnfinishedAttempt();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);





  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleStartTest = async (test: Test) => {
    console.log('Starting test:', test);

    // Teacher-set access restrictions (closed after schedule / single attempt)
    const restriction = getRestriction(test);
    if (restriction && !reexamGrants.includes(test.id)) {
      toast.error(
        restriction === 'single'
          ? 'This test allows only one attempt. Request your teacher to reopen it.'
          : 'This test is closed after its scheduled time. Request your teacher to reopen it.'
      );
      return;
    }
    if (restriction && reexamGrants.includes(test.id) && student) {
      const { data: consumed, error: consumeError } = await supabase.rpc('consume_reexam_grant', {
        _test_id: test.id,
        _student_id: student.id,
      });
      if (consumeError || !consumed) {
        toast.error('Your re-exam permission is no longer valid. Please request again.');
        setReexamGrants(prev => prev.filter(id => id !== test.id));
        return;
      }
      setReexamGrants(prev => prev.filter(id => id !== test.id));
    }

    // Validate test has questions
    if (!test.questions || test.questions.length === 0) {
      toast.error("This test doesn't have any questions yet. Please contact your teacher.");
      return;
    }

    // Check if test is scheduled and not yet available
    if (test.isScheduled && test.scheduledDate) {
      const now = new Date();
      const scheduledDateTime = new Date(test.scheduledDate);

      if (test.scheduledTime) {
        const [hours, minutes] = test.scheduledTime.split(':');
        scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));
      }

      if (now < scheduledDateTime) {
        toast.error(`This test is scheduled for ${format(scheduledDateTime, "PPP 'at' p")}. Please wait until then.`);
        return;
      }
    }

    // Check for saved progress
    let savedAnswers: number[] | null = null;
    let savedIndex = 0;
    let savedTimeLeft = test.duration * 60;
    let savedQuestionTimes: number[] = [];
    if (student) {
      try {
        const raw = localStorage.getItem(RESUME_KEY(student.id, test.id));
        if (raw) {
          const saved = JSON.parse(raw);
          if (
            saved &&
            Array.isArray(saved.answers) &&
            saved.answers.length === test.questions.length &&
            typeof saved.timeLeft === 'number' &&
            saved.timeLeft > 0
          ) {
            const resume = window.confirm(
              `You have an unfinished attempt for "${test.title}" with ${Math.floor(saved.timeLeft / 60)}m ${saved.timeLeft % 60}s remaining. Resume?`
            );
            if (resume) {
              savedAnswers = saved.answers;
              savedIndex = Math.min(saved.currentIndex || 0, test.questions.length - 1);
              savedTimeLeft = saved.timeLeft;
              savedQuestionTimes = Array.isArray(saved.questionTimes) ? saved.questionTimes : [];
              toast.success('Resumed your previous attempt');
            } else {
              localStorage.removeItem(RESUME_KEY(student.id, test.id));
            }
          }
        }
      } catch (err) {
        console.warn('Failed to read saved progress', err);
      }
    }

    questionTimesRef.current = savedQuestionTimes.length
      ? savedQuestionTimes.slice(0, test.questions.length).concat(new Array(Math.max(0, test.questions.length - savedQuestionTimes.length)).fill(0))
      : new Array(test.questions.length).fill(0);
    questionStartRef.current = Date.now();
    // Reset abandon-tracking for the new attempt
    submittedRef.current = false;
    abandonSavedRef.current = false;
    isTestActiveRef.current = true;
    currentTestRef.current = test;
    studentRef.current = student;
    selectedAnswersRef.current = savedAnswers || new Array(test.questions.length).fill(-1);
    timeLeftRef.current = savedTimeLeft;
    setCurrentTest(test);
    setCurrentQuestionIndex(savedIndex);
    setSelectedAnswers(savedAnswers || new Array(test.questions.length).fill(-1));
    setTimeLeft(savedTimeLeft);
    setIsTestActive(true);
    setShowResults(false);

    toast.success(savedAnswers ? "Test resumed!" : "Test started! Good luck!");
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentTest && currentQuestionIndex < currentTest.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitTest = async () => {
    if (!currentTest || !student) return;

    // Mark as submitted so the abandon handler does not also record it as unfinished.
    submittedRef.current = true;
    isTestActiveRef.current = false;

    const penalty = (currentTest as any).negativeMarking || 0;
    const rawScore = selectedAnswers.reduce((total, answer, index) => {
      if (answer === currentTest.questions[index].correctAnswer) return total + 1;
      if (answer !== undefined && answer !== null && answer >= 0) return total - penalty;
      return total;
    }, 0);
    const score = Math.max(0, rawScore);

    const percentage = Math.round((score / currentTest.questions.length) * 100);
    const timeSpent = (currentTest.duration * 60) - timeLeft;

    const questionTimes = questionTimesRef.current.slice(0, currentTest.questions.length).map(normalizeQuestionTime);

    try {
      const { data, error } = await supabase
        .from('test_attempts')
        .insert({
          test_id: currentTest.id,
          student_id: student.id,
          answers: selectedAnswers,
          score: percentage,
          time_spent: timeSpent,
          question_times: questionTimes,
          status: 'completed',
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Clear saved progress on successful submission
      try {
        localStorage.removeItem(RESUME_KEY(student.id, currentTest.id));
      } catch { /* ignore */ }

      const attempt: TestAttempt = {
        id: data.id,
        testId: data.test_id,
        studentId: data.student_id,
        answers: data.answers || [],
        score: data.score,
        completedAt: new Date(data.completed_at),
        timeSpent: data.time_spent,
        questionTimes: data.question_times || [],
        status: 'completed',
      };

      setAttempts([...attempts, attempt]);
      setCurrentAttempt(attempt);
      setIsTestActive(false);
      setShowResults(true);
      toast.success(`Test completed! Score: ${percentage}%`);
    } catch (error) {
      console.error('Error saving test attempt:', error);
      toast.error('Error saving test results');
    }
  };

  const getTestProgress = () => {
    if (!currentTest) return 0;
    return ((currentQuestionIndex + 1) / currentTest.questions.length) * 100;
  };

  const getCourseProgress = (courseId: string) => {
    const courseChapters = chapters.filter(chapter => chapter.courseId === courseId);
    const courseTests = tests.filter(test => 
      courseChapters.some(chapter => chapter.id === test.chapterId)
    );
    const courseAttempts = attempts.filter(attempt => 
      courseTests.some(test => test.id === attempt.testId)
    );
    return courseTests.length > 0 ? (courseAttempts.length / courseTests.length) * 100 : 0;
  };

  const getChapterName = (chapterId: string) => {
    return chapters.find(chapter => chapter.id === chapterId)?.name || "Unknown Chapter";
  };

  const getCourseName = (chapterId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId);
    return chapter ? courses.find(course => course.id === chapter.courseId)?.name || "Unknown Course" : "Unknown Course";
  };

  const getTestClassName = (chapterId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId);
    const course = chapter ? courses.find(c => c.id === chapter.courseId) : undefined;
    return course ? classes.find(cls => cls.id === course.classId)?.name || "Unknown Class" : "Unknown Class";
  };

  const getTestClassId = (chapterId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId);
    const course = chapter ? courses.find(c => c.id === chapter.courseId) : undefined;
    return course?.classId || '';
  };

  // Teacher-set access restrictions
  const getRestriction = (test: Test): null | 'closed' | 'single' => {
    if (test.singleAttempt && attempts.some(a => a.testId === test.id)) return 'single';
    if (test.closeAfterSchedule && test.isScheduled) {
      const start = getScheduledDateTime(test);
      if (start) {
        const end = new Date(start.getTime() + (test.duration || 0) * 60 * 1000);
        if (new Date() > end) return 'closed';
      }
    }
    return null;
  };

  const isRestricted = (test: Test) => getRestriction(test) !== null && !reexamGrants.includes(test.id);

  const renderStartButton = (test: Test, label: string) => {
    if (isRestricted(test)) {
      const reason = getRestriction(test);
      return student ? (
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">
            {reason === 'single' ? 'Single attempt only' : 'Closed after scheduled time'}
          </span>
          <ReexamRequestButton
            testId={test.id}
            testTitle={test.title}
            studentId={student.id}
            classId={getTestClassId(test.chapterId)}
            onApproved={() => setReexamGrants(prev => prev.includes(test.id) ? prev : [...prev, test.id])}
          />
        </div>
      ) : (
        <Button size="sm" variant="outline" disabled><Lock className="h-4 w-4 mr-2" />Closed</Button>
      );
    }
    return (
      <Button size="sm" onClick={() => handleStartTest(test)}>
        <Play className="h-4 w-4 mr-2" />{label}
      </Button>
    );
  };


  // Filter tests based on student enrollments (multi-class support)
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
  const [studentTiers, setStudentTiers] = useState<Record<string, 'free' | 'pro'>>({});
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<Record<string, Date | null>>({});
  const [allStudentIds, setAllStudentIds] = useState<string[]>([]);
  const [studentIdByClass, setStudentIdByClass] = useState<Record<string, string>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  useEffect(() => {
    const loadEnrollments = async () => {
      if (!user?.email) return;
      
      // Get ALL student records for this email (one per class)
      const { data: allStudents } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('email', user.email);
      
      if (allStudents && allStudents.length > 0) {
        const classIds = allStudents.map(s => s.class_id);
        const studentIds = allStudents.map(s => s.id);
        const idByClass: Record<string, string> = {};
        allStudents.forEach(s => { idByClass[s.class_id] = s.id; });
        setEnrolledClassIds(classIds);
        setAllStudentIds(studentIds);
        setStudentIdByClass(idByClass);
        
        // Load tiers from enrollments for all student IDs
        const { data: enrollments } = await supabase
          .from('student_enrollments')
          .select('class_id, tier, subscription_expires_at')
          .in('student_id', studentIds);
        
        if (enrollments) {
          const tiers: Record<string, 'free' | 'pro'> = {};
          const expiries: Record<string, Date | null> = {};
          enrollments.forEach(e => {
            const expiry = (e as any).subscription_expires_at;
            const isExpired = expiry && new Date(expiry) < new Date();
            tiers[e.class_id] = isExpired ? 'free' : ((e as any).tier || 'free');
            expiries[e.class_id] = expiry ? new Date(expiry) : null;
          });
          setStudentTiers(tiers);
          setSubscriptionExpiry(expiries);
        }
      } else if (student) {
        setEnrolledClassIds([student.classId]);
        setAllStudentIds([student.id]);
      }
    };
    loadEnrollments();
  }, [user, student]);

  const isProStudent = Object.values(studentTiers).some(t => t === 'pro');

  const availableTests = tests.filter(test => {
    const chapter = chapters.find(ch => ch.id === test.chapterId);
    const course = chapter ? courses.find(c => c.id === chapter.courseId) : null;
    if (!course || !enrolledClassIds.includes(course.classId)) return false;
    if (selectedClassId !== 'all' && course.classId !== selectedClassId) return false;
    return true;
  });

  const handleLogout = async () => {
    await signOut();
  };

  // Force re-render every second so countdown timers update live
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getScheduledDateTime = (test: Test): Date | null => {
    if (!test.isScheduled || !test.scheduledDate) return null;
    const dateStr = test.scheduledDate instanceof Date 
      ? test.scheduledDate.toISOString().split('T')[0] 
      : String(test.scheduledDate).split('T')[0];
    const timeStr = test.scheduledTime || '00:00:00';
    const parts = timeStr.split(':');
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, parseInt(parts[0]), parseInt(parts[1]), 0);
  };

  const isTestAvailable = (test: Test) => {
    const scheduledDateTime = getScheduledDateTime(test);
    if (!scheduledDateTime) return true;
    return new Date() >= scheduledDateTime;
  };

  const getCountdown = (test: Test): string => {
    const scheduledDateTime = getScheduledDateTime(test);
    if (!scheduledDateTime) return '';
    const diff = scheduledDateTime.getTime() - new Date().getTime();
    if (diff <= 0) return '';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const scheduledTests = availableTests.filter(test => test.isScheduled && !attempts.some(a => a.testId === test.id));
  const readyTests = availableTests.filter(test => !test.isScheduled || isTestAvailable(test));
  const completedTests = readyTests.filter(test => attempts.some(a => a.testId === test.id));
  const newFreeTests = readyTests.filter(test => !test.isPro && !test.isScheduled && !attempts.some(a => a.testId === test.id));
  const newProTests = readyTests.filter(test => test.isPro && !test.isScheduled && !attempts.some(a => a.testId === test.id));
  const freeTests = newFreeTests;
  const proTests = newProTests;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-lg font-medium">Loading Student Dashboard...</div>
          <div className="text-sm text-muted-foreground">Fetching your tests and assignments</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-lg font-medium">Authentication Required</div>
          <div className="text-muted-foreground">Please log in to access the student dashboard</div>
        </div>
      </div>
    );
  }

  // Answer sheet view
  if (viewingAnswerSheet) {
    return (
      <AnswerSheetView
        attempt={viewingAnswerSheet.attempt}
        test={viewingAnswerSheet.test}
        studentName={student?.name || user?.email || 'Student'}
        onBack={() => setViewingAnswerSheet(null)}
      />
    );
  }

  // Check for active test BEFORE checking student profile
  if (isTestActive && currentTest) {
    const question = currentTest.questions[currentQuestionIndex];
    
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{currentTest.title}</CardTitle>
                    <CardDescription>
                      Question {currentQuestionIndex + 1} of {currentTest.questions.length}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-2 text-lg font-mono">
                      <Clock className="h-5 w-5" />
                      <span className={timeLeft < 300 ? "text-destructive" : ""}>
                        {formatTime(timeLeft)}
                      </span>
                    </div>
                  </div>
                </div>
                <Progress value={getTestProgress()} className="mt-4" />
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl"><RichTextDisplay content={question.question} as="div" /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {question.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={selectedAnswers[currentQuestionIndex] === index ? "default" : "outline"}
                      className="justify-start text-left h-auto p-4"
                      onClick={() => handleAnswerSelect(index)}
                    >
                      <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                      <RichTextDisplay content={option} />
                    </Button>
                  ))}
                </div>

                <div className="flex justify-between pt-6">
                  <Button 
                    variant="outline" 
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>
                  
                  <div className="flex space-x-3">
                    {currentQuestionIndex === currentTest.questions.length - 1 ? (
                      <Button 
                        onClick={handleSubmitTest}
                        className="bg-success hover:bg-success/90"
                      >
                        Submit Test
                      </Button>
                    ) : (
                      <Button onClick={handleNextQuestion}>
                        Next
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Check for results view
  if (showResults && currentTest && currentAttempt) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-end mb-4">
              <Button onClick={handleDownloadResultPdf} disabled={downloadingPdf} variant="outline" size="sm" title="Download as PDF">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{downloadingPdf ? "Preparing..." : "Download as PDF"}</span>
              </Button>
            </div>
            <div ref={resultRef} className="bg-background">
            <Card className="mb-6">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-8 w-8 text-success" />
                </div>
                <CardTitle className="text-2xl">Test Completed!</CardTitle>
                <CardDescription className="text-lg">
                  {currentTest.title}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-3xl font-bold text-primary">{currentAttempt.score}%</div>
                    <p className="text-muted-foreground">Final Score</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-accent">
                      {selectedAnswers.filter((answer, index) => 
                        Number(answer) === Number(currentTest.questions[index].correctAnswer)
                      ).length}/{currentTest.questions.length}
                    </div>
                    <p className="text-muted-foreground">Correct Answers</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-education-purple">
                      {formatTime(currentAttempt.timeSpent)}
                    </div>
                    <p className="text-muted-foreground">Time Spent</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Review</CardTitle>
                <CardDescription>Review your answers and explanations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentTest.questions.map((question, index) => {
                  const userAnswer = selectedAnswers[index];
                  const isCorrect = isAnswerCorrect(userAnswer, question.correctAnswer);
                  const answered = isAnswered(userAnswer);
                  const qTime = normalizeQuestionTime((currentAttempt.questionTimes || [])[index] ?? 0);

                  
                  return (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-start space-x-3 mb-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isCorrect ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'
                        }`}>
                          {isCorrect ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">
                            {index + 1}. <RichTextDisplay content={question.question} />
                          </h3>
                          
                          <div className="grid gap-2 mb-3">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`p-2 rounded border ${
                                    Number(question.correctAnswer) === optIndex
                                      ? 'bg-success/10 border-success'
                                      : Number(userAnswer) === optIndex && !isCorrect
                                      ? 'bg-destructive/10 border-destructive'
                                      : 'bg-muted'
                                  }`}
                              >
                                <span className="font-semibold mr-2">
                                  {String.fromCharCode(65 + optIndex)}.
                                </span>
                                <RichTextDisplay content={option} />
                                {Number(question.correctAnswer) === optIndex && (
                                  <Badge variant="default" className="ml-2">Correct</Badge>
                                )}
                                {Number(userAnswer) === optIndex && Number(userAnswer) !== Number(question.correctAnswer) && (
                                  <Badge variant="destructive" className="ml-2">Your Answer</Badge>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" /> Time to solve: {formatTime(qTime)}
                            </Badge>
                            <Badge variant={isCorrect && answered ? "default" : "outline"}>
                              {getQuestionRemark(isCorrect, qTime, answered)}
                            </Badge>
                          </div>

                          <div className="bg-muted/50 p-3 rounded">
                            <p className="text-sm font-medium mb-1">Explanation:</p>
                            <RichTextDisplay content={question.explanation} className="text-sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            </div>

            <Button 
              onClick={() => {
                setCurrentTest(null);
                setShowResults(false);
              }}
              className="w-full mt-6"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Welcome to Student Portal</h1>
            <p className="text-muted-foreground">
              Your student profile is being set up. Contact your teacher to be added to a class.
            </p>
          </div>
          
          {/* Show available public tests even without student profile */}
          <Card className="text-left">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Available Demo Tests</span>
              </CardTitle>
              <CardDescription>
                Practice with these sample tests while your profile is being set up
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tests.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No tests available at the moment</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Your teacher will add tests soon. Check back later!
                    </p>
                  </div>
                ) : (
                  tests.slice(0, 3).map((test) => (
                    <div key={test.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{test.title}</h3>
                        <Badge variant="secondary">Demo</Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        Class: {getTestClassName(test.chapterId)} • Subject: {getCourseName(test.chapterId)} • Chapter: {getChapterName(test.chapterId)}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{test.duration} minutes</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{test.questions.length} questions</span>
                          </div>
                        </div>
                        
                        {!isTestAvailable(test) ? (
                          <Button size="sm" disabled>
                            <Calendar className="h-4 w-4 mr-2" />
                            {format(new Date(test.scheduledDate!), "dd MMM")}{test.scheduledTime ? ` at ${test.scheduledTime.slice(0, 5)}` : ''}
                          </Button>
                        ) : (
                          renderStartButton(test, "Start Test")
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
        </div>
      </div>
    );
  }


  const enrolledClasses = classes.filter(c => enrolledClassIds.includes(c.id));
  const upgradeClasses = enrolledClasses
    .filter(c => studentTiers[c.id] !== 'pro')
    .filter(c => selectedClassId === 'all' || c.id === selectedClassId);

  return (
    <SidebarProvider defaultOpen={false} style={{ "--sidebar-width": "20rem" } as React.CSSProperties}>
      <div className="flex w-full min-h-screen">
        <Sidebar collapsible="icon">
          <SidebarHeader className="gap-2">
            <div className="flex items-center gap-2 px-1">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="font-bold text-sm truncate">Skyview Test Pro</p>
                <p className="text-[11px] text-muted-foreground truncate">Advanced Mock Testing Platform</p>
              </div>
            </div>
            <CollapseToggle />
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Dashboard" onClick={() => navigate('/student')}>
                      <Target />
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Notifications" onClick={() => navigate('/notifications')}>
                      <Bell />
                      <span>Notifications</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="My Profile" onClick={() => navigate('/profile')}>
                      <User />
                      <span>My Profile</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Test History"
                      onClick={() => document.getElementById('test-history')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <History />
                      <span>Test History ({attempts.length})</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Leaderboard"
                      onClick={() => document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <Trophy />
                      <span>Leaderboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Ask a Doubt"
                      onClick={() => document.getElementById('doubt-chat')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <MessageCircle />
                      <span>Ask a Doubt</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Refresh" onClick={() => window.location.reload()}>
                      <RefreshCw />
                      <span>Refresh Data</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                My Classes
              </SidebarGroupLabel>
              <SidebarGroupContent className="px-2 pb-2">
                {enrolledClasses.length > 0 ? (
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {enrolledClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No classes enrolled yet</p>
                )}
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupLabel>Join Another Class</SidebarGroupLabel>
              <SidebarGroupContent className="px-2 pb-2">
                <JoinClassCard
                  studentId={student.id}
                  studentName={student.name}
                  studentEmail={student.email}
                  onClassJoined={() => window.location.reload()}
                />
              </SidebarGroupContent>
            </SidebarGroup>

            {upgradeClasses.length > 0 && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Upgrade to Pro
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2 pb-2 space-y-3">
                  {upgradeClasses.map(c => (
                    <UpgradeBanner
                      key={`upg-${c.id}`}
                      studentId={studentIdByClass[c.id] || student.id}
                      classId={c.id}
                      className={c.name}
                    />
                  ))}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sign Out" onClick={handleLogout}>
                  <LogOut />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-8">
            <div className="mb-8 flex items-start gap-3">
              <CollapseToggle className="mt-1" />

              <div>
                <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {student.name}!</p>
                <p className="text-sm text-muted-foreground">{student.email}</p>
              </div>
            </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">


          {/* Tests with Tabs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-md font-bold">Available Tests</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="free">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="free">New ({freeTests.length})</TabsTrigger>
                  <TabsTrigger value="pro">
                    <Crown className="h-3 w-3 mr-1" />
                    Pro ({proTests.length})
                  </TabsTrigger>
                  <TabsTrigger value="scheduled">
                    <Calendar className="h-3 w-3 mr-1" />
                    Scheduled ({scheduledTests.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Done ({completedTests.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="free" className="space-y-4 mt-4">
                  {freeTests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No new tests available</p>
                  ) : (
                    freeTests.map((test) => {
                      const hasAttempted = attempts.some(a => a.testId === test.id);
                      const lastAttempt = attempts.find(a => a.testId === test.id);
                      return (
                        <div key={test.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{test.title}</h3>
                            <Badge variant={hasAttempted ? "default" : "secondary"}>
                              {hasAttempted ? "Completed" : "Pending"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Class: {getTestClassName(test.chapterId)} • Subject: {getCourseName(test.chapterId)} • Chapter: {getChapterName(test.chapterId)}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-1"><Clock className="h-4 w-4" /><span>{test.duration} min</span></div>
                              <div className="flex items-center space-x-1"><BookOpen className="h-4 w-4" /><span>{test.questions.length} Q</span></div>
                              {hasAttempted && lastAttempt && (
                                <div className="flex items-center space-x-1 text-primary"><Trophy className="h-4 w-4" /><span>{lastAttempt.score}%</span></div>
                              )}
                            </div>
                            {renderStartButton(test, hasAttempted ? "Retake" : "Start")}
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="pro" className="space-y-4 mt-4">
                  {proTests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No pro tests available</p>
                  ) : (
                    proTests.map((test) => {
                      const hasAttempted = attempts.some(a => a.testId === test.id);
                      const lastAttempt = attempts.find(a => a.testId === test.id);
                      return (
                        <div key={test.id} className={`border rounded-lg p-4 ${!isProStudent ? 'opacity-70 bg-muted/20' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{test.title}</h3>
                              <Badge variant="outline" className="text-warning border-warning/50">
                                <Crown className="h-3 w-3 mr-1" />Pro
                              </Badge>
                            </div>
                            <Badge variant={hasAttempted ? "default" : "secondary"}>
                              {hasAttempted ? "Completed" : "Pending"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Class: {getTestClassName(test.chapterId)} • Subject: {getCourseName(test.chapterId)} • Chapter: {getChapterName(test.chapterId)}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-1"><Clock className="h-4 w-4" /><span>{test.duration} min</span></div>
                              <div className="flex items-center space-x-1"><BookOpen className="h-4 w-4" /><span>{test.questions.length} Q</span></div>
                              {hasAttempted && lastAttempt && (
                                <div className="flex items-center space-x-1 text-primary"><Trophy className="h-4 w-4" /><span>{lastAttempt.score}%</span></div>
                              )}
                            </div>
                            {!isProStudent ? (
                              <Button size="sm" variant="outline" disabled><Lock className="h-4 w-4 mr-2" />Pro Only</Button>
                            ) : (
                              renderStartButton(test, hasAttempted ? "Retake" : "Start")
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="scheduled" className="space-y-4 mt-4">
                  {scheduledTests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No scheduled tests</p>
                  ) : (
                    scheduledTests.map((test) => {
                      const available = isTestAvailable(test);
                      const isLocked = test.isPro && !isProStudent;
                      const countdown = getCountdown(test);
                      return (
                        <div key={test.id} className={`border rounded-lg p-4 ${!available ? 'bg-muted/30' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{test.title}</h3>
                              {test.isPro && (
                                <Badge variant="outline" className="text-warning border-warning/50">
                                  <Crown className="h-3 w-3 mr-1" />Pro
                                </Badge>
                              )}
                            </div>
                            <Badge variant={available ? "default" : "outline"}>
                              <Calendar className="h-3 w-3 mr-1" />{available ? "Live Now" : "Scheduled"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Class: {getTestClassName(test.chapterId)} • Subject: {getCourseName(test.chapterId)} • Chapter: {getChapterName(test.chapterId)}
                          </p>
                          {!available && countdown && (
                            <div className="flex items-center space-x-2 mb-3 p-2 rounded-md bg-primary/5 border border-primary/20">
                              <Clock className="h-4 w-4 text-primary" />
                              <span className="text-sm font-mono font-medium text-primary">Starts in {countdown}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-1"><Clock className="h-4 w-4" /><span>{test.duration} min</span></div>
                              <div className="flex items-center space-x-1"><BookOpen className="h-4 w-4" /><span>{test.questions.length} Q</span></div>
                              {test.scheduledDate && (
                                <div className="flex items-center space-x-1 text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  <span>{format(new Date(test.scheduledDate), "dd MMM")}{test.scheduledTime ? ` at ${test.scheduledTime.slice(0, 5)}` : ''}</span>
                                </div>
                              )}
                            </div>
                            {!available ? (
                              <Button size="sm" disabled>
                                <Lock className="h-4 w-4 mr-2" />Wait
                              </Button>
                            ) : isLocked ? (
                              <Button size="sm" variant="outline" disabled><Lock className="h-4 w-4 mr-2" />Pro Only</Button>
                            ) : (
                              renderStartButton(test, "Start")
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4 mt-4">
                  {completedTests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No completed tests yet</p>
                  ) : (
                    completedTests.map((test) => {
                      const lastAttempt = attempts.find(a => a.testId === test.id);
                      return (
                        <div key={test.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{test.title}</h3>
                              {test.isPro && (
                                <Badge variant="outline" className="text-warning border-warning/50">
                                  <Crown className="h-3 w-3 mr-1" />Pro
                                </Badge>
                              )}
                            </div>
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />Completed
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Class: {getTestClassName(test.chapterId)} • Subject: {getCourseName(test.chapterId)} • Chapter: {getChapterName(test.chapterId)}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm">
                              <div className="flex items-center space-x-1"><Clock className="h-4 w-4" /><span>{test.duration} min</span></div>
                              <div className="flex items-center space-x-1"><BookOpen className="h-4 w-4" /><span>{test.questions.length} Q</span></div>
                              {lastAttempt && (
                                <div className="flex items-center space-x-1 text-primary"><Trophy className="h-4 w-4" /><span>{lastAttempt.score}%</span></div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {lastAttempt && (
                                <Button size="sm" variant="outline" onClick={() => setViewingAnswerSheet({ attempt: lastAttempt, test })}>
                                  <FileText className="h-4 w-4 mr-2" />Answer Sheet
                                </Button>
                              )}
                              {renderStartButton(test, "Retake")}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Previous Year Question Papers */}
          <QuestionPaperDownload enrolledClassIds={enrolledClassIds} selectedClassId={selectedClassId} classes={classes} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Classes:</span>
                  <div className="flex flex-wrap gap-1">
                    {classes.filter(c => enrolledClassIds.includes(c.id)).map(cls => (
                      <Badge key={cls.id} variant="default">{cls.name}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Enrolled:</span>
                  <span className="text-sm text-muted-foreground">
                    {student.enrolledAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {courses.filter(course => enrolledClassIds.includes(course.classId)).map((course) => (
                  <div key={course.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{course.name}</span>
                      <span>{Math.round(getCourseProgress(course.id))}%</span>
                    </div>
                    <Progress value={getCourseProgress(course.id)} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Class Leaderboard */}
          <div id="leaderboard" />
          {classes.filter(c => enrolledClassIds.includes(c.id)).length > 0 && (
            <ClassLeaderboard
              classes={classes.filter(c => enrolledClassIds.includes(c.id))}
              currentStudentEmail={student.email}
              defaultClassId={selectedClassId !== 'all' ? selectedClassId : undefined}
            />
          )}

          {/* Published Test Marks Lists */}
          {classes.filter(c => enrolledClassIds.includes(c.id)).length > 0 && (
            <TestResults
              classes={classes.filter(c => enrolledClassIds.includes(c.id))}
              mode="student"
              currentStudentEmail={student.email}
            />
          )}

          {/* Doubt Clearing Section */}
          <div id="doubt-chat" />
          <StudentDoubtChat
            studentIds={allStudentIds}
            enrolledClassIds={enrolledClassIds}
            classes={classes}
          />


          {attempts.length > 0 && (
            <Card id="test-history">
              <CardHeader>
                <CardTitle>Recent Results</CardTitle>
                <CardDescription className="text-xs">Click to view answer sheet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attempts.slice(-5).reverse().map((attempt) => {
                    const test = tests.find(t => t.id === attempt.testId);
                    return (
                      <button
                        key={attempt.id}
                        className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left"
                        onClick={() => {
                          if (test) {
                            setViewingAnswerSheet({ attempt, test });
                          } else {
                            toast.error('Test data not found');
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{test?.title || "Unknown Test"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(attempt.completedAt, "PPp")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge 
                            variant={attempt.score >= 80 ? "default" : attempt.score >= 60 ? "secondary" : "destructive"}
                          >
                            {attempt.score}%
                          </Badge>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );

};