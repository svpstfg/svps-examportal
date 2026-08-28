CREATE POLICY "Students can view published test results"
ON public.test_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tests t
    JOIN public.chapters ch ON t.chapter_id = ch.id
    JOIN public.courses co ON ch.course_id = co.id
    WHERE t.id = test_attempts.test_id
      AND t.results_published = true
      AND EXISTS (
        SELECT 1
        FROM public.student_enrollments se
        JOIN public.students s ON s.id = se.student_id
        WHERE se.class_id = co.class_id
          AND s.email = (auth.jwt() ->> 'email')
      )
  )
);
