-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  chapter_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chapters table
CREATE TABLE public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  test_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tests table
CREATE TABLE public.tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  duration INTEGER NOT NULL,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  scheduled_date DATE,
  scheduled_time TIME,
  is_scheduled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test attempts table
CREATE TABLE public.test_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  answers INTEGER[] NOT NULL,
  score INTEGER NOT NULL,
  time_spent INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes
CREATE POLICY "Teachers can manage their own classes" ON public.classes
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view classes they belong to" ON public.classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students 
      WHERE students.class_id = classes.id AND students.email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for courses
CREATE POLICY "Teachers can manage courses in their classes" ON public.courses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes 
      WHERE classes.id = courses.class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view courses in their class" ON public.courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes c ON s.class_id = c.id
      WHERE c.id = courses.class_id AND s.email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for chapters
CREATE POLICY "Teachers can manage chapters in their courses" ON public.chapters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.courses co
      JOIN public.classes cl ON co.class_id = cl.id
      WHERE co.id = chapters.course_id AND cl.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view chapters in their courses" ON public.chapters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes cl ON s.class_id = cl.id
      JOIN public.courses co ON co.class_id = cl.id
      WHERE co.id = chapters.course_id AND s.email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for tests
CREATE POLICY "Teachers can manage tests in their chapters" ON public.tests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.chapters ch
      JOIN public.courses co ON ch.course_id = co.id
      JOIN public.classes cl ON co.class_id = cl.id
      WHERE ch.id = tests.chapter_id AND cl.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view tests in their chapters" ON public.tests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.classes cl ON s.class_id = cl.id
      JOIN public.courses co ON co.class_id = cl.id
      JOIN public.chapters ch ON ch.course_id = co.id
      WHERE ch.id = tests.chapter_id AND s.email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for students
CREATE POLICY "Teachers can manage students in their classes" ON public.students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes 
      WHERE classes.id = students.class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own record" ON public.students
  FOR SELECT USING (email = auth.jwt() ->> 'email');

-- RLS Policies for test attempts
CREATE POLICY "Students can manage their own attempts" ON public.test_attempts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.students 
      WHERE students.id = test_attempts.student_id AND students.email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Teachers can view attempts for their tests" ON public.test_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.chapters ch ON t.chapter_id = ch.id
      JOIN public.courses co ON ch.course_id = co.id
      JOIN public.classes cl ON co.class_id = cl.id
      WHERE t.id = test_attempts.test_id AND cl.teacher_id = auth.uid()
    )
  );

-- RLS Policies for profiles
CREATE POLICY "Users can manage their own profile" ON public.profiles
  FOR ALL USING (auth.uid() = user_id);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'User'),
    NEW.email,
    'teacher'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();