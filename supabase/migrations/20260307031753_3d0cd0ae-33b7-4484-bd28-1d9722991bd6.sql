
-- Drop all existing restrictive SELECT policies on students
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students (via profile role)" ON public.students;

-- Recreate as PERMISSIVE policies so ANY match grants access
CREATE POLICY "Students can view their own record"
  ON public.students FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Teachers can view students in their classes"
  ON public.students FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = students.class_id AND c.teacher_id = auth.uid()
  ));
