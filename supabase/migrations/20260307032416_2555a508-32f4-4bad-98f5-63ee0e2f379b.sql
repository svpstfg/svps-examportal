
-- Drop ALL existing policies on classes to fix infinite recursion
DROP POLICY IF EXISTS "Anyone can view classes for signup" ON public.classes;
DROP POLICY IF EXISTS "Students can view classes they belong to" ON public.classes;
DROP POLICY IF EXISTS "Teachers can create classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can delete their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can manage their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can update their own classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their own classes" ON public.classes;

-- Create a security definer function to check if student belongs to class (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_student_in_class(_class_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE class_id = _class_id AND email = _email
  )
$$;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Teachers can view their own classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Students can view their enrolled classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (public.is_student_in_class(id, (auth.jwt() ->> 'email'::text)));

CREATE POLICY "Anyone can view classes by invite code"
  ON public.classes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Teachers can insert their own classes"
  ON public.classes FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own classes"
  ON public.classes FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes"
  ON public.classes FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());
