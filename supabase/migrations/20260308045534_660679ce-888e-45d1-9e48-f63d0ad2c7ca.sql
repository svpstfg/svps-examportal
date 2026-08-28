
-- Fix 1: Remove the overly broad SELECT policy that shows all classes to everyone
DROP POLICY IF EXISTS "Authenticated users can find classes by invite code" ON public.classes;

-- Fix 2: Allow students to insert their own records when joining a new class
CREATE POLICY "Students can insert own record for new class"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (email = (auth.jwt() ->> 'email'::text));

-- Fix 3: Allow students to insert their own enrollments
-- (existing policy checks via students table which may fail for new inserts, so add a direct check)
CREATE POLICY "Students can enroll themselves"
  ON public.student_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_enrollments.student_id
        AND s.email = (auth.jwt() ->> 'email'::text)
    )
  );
