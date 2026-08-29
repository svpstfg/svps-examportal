-- Make multi-class assignments the source of truth for student portal access.
-- A student assigned through Student Management can immediately see that class,
-- its courses, chapters and tests.

CREATE POLICY "Students can view enrolled classes"
ON public.classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_enrollments se
    JOIN public.students s ON s.id = se.student_id
    WHERE se.class_id = classes.id
      AND s.email = auth.email()
  )
);

CREATE POLICY "Students can view courses in enrolled classes"
ON public.courses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_enrollments se
    JOIN public.students s ON s.id = se.student_id
    WHERE se.class_id = courses.class_id
      AND s.email = auth.email()
  )
);

CREATE POLICY "Students can view chapters in enrolled classes"
ON public.chapters
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses co
    JOIN public.student_enrollments se ON se.class_id = co.class_id
    JOIN public.students s ON s.id = se.student_id
    WHERE co.id = chapters.course_id
      AND s.email = auth.email()
  )
);

CREATE POLICY "Students can view tests in enrolled classes"
ON public.tests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chapters ch
    JOIN public.courses co ON co.id = ch.course_id
    JOIN public.student_enrollments se ON se.class_id = co.class_id
    JOIN public.students s ON s.id = se.student_id
    WHERE ch.id = tests.chapter_id
      AND s.email = auth.email()
  )
);

-- Deliver assignment and content changes to active student portal sessions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'student_enrollments'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.student_enrollments; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'classes'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.classes; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'courses'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.courses; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chapters'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.chapters; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tests'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.tests; END IF;
END $$;
