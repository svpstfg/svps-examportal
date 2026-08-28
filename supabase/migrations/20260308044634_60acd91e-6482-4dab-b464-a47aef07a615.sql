
-- Drop all existing SELECT policies on classes
DROP POLICY IF EXISTS "Anyone can view classes by invite code" ON public.classes;
DROP POLICY IF EXISTS "Students can view their enrolled classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their own classes" ON public.classes;

-- Recreate as PERMISSIVE so ANY match grants access
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
  TO authenticated
  USING (true);
