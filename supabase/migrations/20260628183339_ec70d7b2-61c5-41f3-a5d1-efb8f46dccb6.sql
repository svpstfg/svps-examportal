-- student_enrollments
CREATE TABLE public.student_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id)
);

ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own enrollments"
ON public.student_enrollments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM students s WHERE s.id = student_enrollments.student_id AND s.email = (auth.jwt() ->> 'email'::text))
);

CREATE POLICY "Students can insert their own enrollments"
ON public.student_enrollments FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM students s WHERE s.id = student_enrollments.student_id AND s.email = (auth.jwt() ->> 'email'::text))
);

CREATE POLICY "Students can delete their own enrollments"
ON public.student_enrollments FOR DELETE
USING (
  EXISTS (SELECT 1 FROM students s WHERE s.id = student_enrollments.student_id AND s.email = (auth.jwt() ->> 'email'::text))
);

CREATE POLICY "Teachers can view enrollments for their classes"
ON public.student_enrollments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM classes c WHERE c.id = student_enrollments.class_id AND c.teacher_id = auth.uid())
);

CREATE POLICY "Teachers can manage enrollments in their classes"
ON public.student_enrollments FOR ALL
USING (
  EXISTS (SELECT 1 FROM classes c WHERE c.id = student_enrollments.class_id AND c.teacher_id = auth.uid())
);

-- new student handler
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _class_id uuid;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'role', '') = 'student'
     AND NEW.raw_user_meta_data->>'class_id' IS NOT NULL THEN
    _class_id := (NEW.raw_user_meta_data->>'class_id')::uuid;
    INSERT INTO public.students (name, email, class_id)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email, _class_id);
    INSERT INTO public.student_enrollments (student_id, class_id)
    SELECT s.id, _class_id FROM public.students s WHERE s.email = NEW.email LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_student
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_student();

-- classes public select for signup
CREATE POLICY "Anyone can view classes for signup"
ON public.classes FOR SELECT TO anon, authenticated USING (true);

-- invite code + tier + pro flags
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
UPDATE public.classes SET invite_code = upper(substr(md5(random()::text), 1, 6)) WHERE invite_code IS NULL;
ALTER TABLE public.classes ALTER COLUMN invite_code SET DEFAULT upper(substr(md5(random()::text), 1, 6));
ALTER TABLE public.classes ALTER COLUMN invite_code SET NOT NULL;

ALTER TABLE public.student_enrollments ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_classes_invite_code ON public.classes(invite_code);

-- students select policy churn
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students (via profile role)" ON public.students;

CREATE POLICY "Students can view their own record"
  ON public.students FOR SELECT TO authenticated
  USING (email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Teachers can view students in their classes"
  ON public.students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = students.class_id AND c.teacher_id = auth.uid()));

-- classes recursion fix
DROP POLICY IF EXISTS "Anyone can view classes for signup" ON public.classes;
DROP POLICY IF EXISTS "Students can view classes they belong to" ON public.classes;
DROP POLICY IF EXISTS "Teachers can create classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can delete their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can manage their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can update their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their own classes" ON public.classes;

CREATE OR REPLACE FUNCTION public.is_student_in_class(_class_id uuid, _email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.students WHERE class_id = _class_id AND email = _email)
$$;

CREATE POLICY "Teachers can view their own classes"
  ON public.classes FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "Students can view their enrolled classes"
  ON public.classes FOR SELECT TO authenticated USING (public.is_student_in_class(id, (auth.jwt() ->> 'email'::text)));
CREATE POLICY "Anyone can view classes by invite code"
  ON public.classes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Teachers can insert their own classes"
  ON public.classes FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can update their own classes"
  ON public.classes FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Teachers can delete their own classes"
  ON public.classes FOR DELETE TO authenticated USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view classes by invite code" ON public.classes;
DROP POLICY IF EXISTS "Students can view their enrolled classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their own classes" ON public.classes;

CREATE POLICY "Teachers can view their own classes"
  ON public.classes FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "Students can view their enrolled classes"
  ON public.classes FOR SELECT TO authenticated USING (public.is_student_in_class(id, (auth.jwt() ->> 'email'::text)));
CREATE POLICY "Anyone can view classes by invite code"
  ON public.classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view classes by invite code" ON public.classes;

CREATE POLICY "Authenticated users can find classes by invite code"
  ON public.classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can find classes by invite code" ON public.classes;

CREATE POLICY "Students can insert own record for new class"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Students can enroll themselves"
  ON public.student_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_enrollments.student_id AND s.email = (auth.jwt() ->> 'email'::text))
  );

CREATE OR REPLACE FUNCTION public.find_class_by_invite_code(_invite_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name FROM public.classes c WHERE c.invite_code = _invite_code LIMIT 1;
$$;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_email_key;
ALTER TABLE public.students ADD CONSTRAINT students_email_class_unique UNIQUE (email, class_id);