-- Core tables
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  chapter_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  test_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

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

CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

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

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own classes" ON public.classes
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view classes they belong to" ON public.classes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE students.class_id = classes.id AND students.email = auth.jwt() ->> 'email'
    )
  );

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

CREATE POLICY "Teachers can manage students in their classes" ON public.students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = students.class_id AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own record" ON public.students
  FOR SELECT USING (email = auth.jwt() ->> 'email');

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

CREATE POLICY "Users can manage their own profile" ON public.profiles
  FOR ALL USING (auth.uid() = user_id);

-- updated_at helper + triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_chapters_updated_at BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- new user -> profile
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- class policy cleanup
DROP POLICY IF EXISTS "Users can view classes they teach" ON public.classes;
DROP POLICY IF EXISTS "Users can create classes" ON public.classes;
DROP POLICY IF EXISTS "Users can update classes they teach" ON public.classes;
DROP POLICY IF EXISTS "Users can delete classes they teach" ON public.classes;

CREATE POLICY "Teachers can view their own classes"
ON public.classes FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create classes"
ON public.classes FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own classes"
ON public.classes FOR UPDATE USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes"
ON public.classes FOR DELETE USING (teacher_id = auth.uid());

-- slides
CREATE TABLE public.slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  serial_number INTEGER NOT NULL DEFAULT 1,
  chapter_id UUID REFERENCES chapters(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage slides in their chapters"
ON public.slides FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM chapters ch
    JOIN courses co ON ch.course_id = co.id
    JOIN classes cl ON co.class_id = cl.id
    WHERE ch.id = slides.chapter_id AND cl.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view slides in their chapters"
ON public.slides FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chapters ch
    JOIN courses co ON ch.course_id = co.id
    JOIN classes cl ON co.class_id = cl.id
    JOIN students s ON s.class_id = cl.id
    WHERE ch.id = slides.chapter_id AND s.email = (auth.jwt() ->> 'email')
  )
);

CREATE TRIGGER update_slides_updated_at
  BEFORE UPDATE ON public.slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- students RLS recursion fixes
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage students in their classes" ON public.students;

CREATE POLICY "Teachers can insert students in their classes"
ON public.students FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = students.class_id AND c.teacher_id = auth.uid())
);

CREATE POLICY "Teachers can update students in their classes"
ON public.students FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = students.class_id AND c.teacher_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = students.class_id AND c.teacher_id = auth.uid())
);

CREATE POLICY "Teachers can delete students in their classes"
ON public.students FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = students.class_id AND c.teacher_id = auth.uid())
);

CREATE POLICY "Teachers can view students (via profile role)"
ON public.students FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'teacher')
);

-- roles
CREATE TYPE public.app_role AS ENUM ('teacher', 'student');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'teacher'::app_role)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, name, email, role)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'teacher')
  );
  RETURN NEW;
END;
$$;