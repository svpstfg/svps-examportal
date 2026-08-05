export interface Class {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  createdAt: Date;
  studentCount: number;
  inviteCode: string;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  classId: string;
  chapterCount: number;
  createdAt: Date;
}

export interface Chapter {
  id: string;
  name: string;
  description: string;
  courseId: string;
  testCount: number;
}

export interface Question {
  id: string;
  question: string;
  questionImage?: string;
  options: string[];
  optionImages?: string[];
  correctAnswer: number;
  explanation: string;
  explanationImage?: string;
}

export interface Test {
  id: string;
  title: string;
  duration: number;
  chapterId: string;
  questions: Question[];
  createdAt: Date;
  scheduledDate?: Date;
  scheduledTime?: string;
  isScheduled: boolean;
  isPro: boolean;
  isLocked?: boolean;
  closeAfterSchedule?: boolean;
  singleAttempt?: boolean;
  negativeMarking?: number;
}

export interface StudentEnrollment {
  id: string;
  studentId: string;
  classId: string;
  tier: 'free' | 'pro';
  enrolledAt: Date;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  classId: string;
  enrolledAt: Date;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  answers: number[];
  score: number;
  completedAt: Date;
  timeSpent: number;
  questionTimes?: number[];
  status?: 'completed' | 'unfinished';
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  classes: string[];
}