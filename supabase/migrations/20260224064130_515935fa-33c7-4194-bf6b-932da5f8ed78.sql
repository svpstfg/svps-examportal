
-- Create student_enrollments junction table for multi-class enrollment
CREATE TABLE public.student_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id)
);

-- Enable RLS
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;

-- Students can view their own enrollments
CREATE POLICY "Students can view their own enrollments"
ON public.student_enrollments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_enrollments.student_id
    AND s.email = (auth.jwt() ->> 'email'::text)
  )
);

-- Students can insert their own enrollments
CREATE POLICY "Students can insert their own enrollments"
ON public.student_enrollments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_enrollments.student_id
    AND s.email = (auth.jwt() ->> 'email'::text)
  )
);

-- Students can delete their own enrollments
CREATE POLICY "Students can delete their own enrollments"
ON public.student_enrollments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_enrollments.student_id
    AND s.email = (auth.jwt() ->> 'email'::text)
  )
);

-- Teachers can view enrollments for their classes
CREATE POLICY "Teachers can view enrollments for their classes"
ON public.student_enrollments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = student_enrollments.class_id
    AND c.teacher_id = auth.uid()
  )
);

-- Teachers can manage enrollments in their classes
CREATE POLICY "Teachers can manage enrollments in their classes"
ON public.student_enrollments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = student_enrollments.class_id
    AND c.teacher_id = auth.uid()
  )
);
