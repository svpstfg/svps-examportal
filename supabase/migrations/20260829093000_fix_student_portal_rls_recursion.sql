-- Prevent RLS recursion between students, classes and multi-class enrollments.
-- Membership is evaluated in one SECURITY DEFINER function, so student portal
-- access does not recursively re-evaluate row-level policies.

CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_enrollments se
    JOIN public.students s ON s.id = se.student_id
    WHERE se.class_id = _class_id
      AND s.email = auth.email()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_enrolled_in_class(uuid) TO authenticated;

-- Remove policy expressions that traverse students/classes directly. They can
-- recurse when multiple historic policy versions exist in the same project.
DROP POLICY IF EXISTS "Students can view classes they belong to" ON public.classes;
DROP POLICY IF EXISTS "Students can view enrolled classes" ON public.classes;
DROP POLICY IF EXISTS "Students can view courses in their class" ON public.courses;
DROP POLICY IF EXISTS "Students can view courses in enrolled classes" ON public.courses;
DROP POLICY IF EXISTS "Students can view chapters in their courses" ON public.chapters;
DROP POLICY IF EXISTS "Students can view chapters in enrolled classes" ON public.chapters;
DROP POLICY IF EXISTS "Students can view tests in their chapters" ON public.tests;
DROP POLICY IF EXISTS "Students can view tests in enrolled classes" ON public.tests;

CREATE POLICY "Students can view enrolled classes"
ON public.classes FOR SELECT TO authenticated
USING (public.is_enrolled_in_class(id));

CREATE POLICY "Students can view courses in enrolled classes"
ON public.courses FOR SELECT TO authenticated
USING (public.is_enrolled_in_class(class_id));

CREATE POLICY "Students can view chapters in enrolled classes"
ON public.chapters FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses co
    WHERE co.id = chapters.course_id
      AND public.is_enrolled_in_class(co.class_id)
  )
);

CREATE POLICY "Students can view tests in enrolled classes"
ON public.tests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chapters ch
    JOIN public.courses co ON co.id = ch.course_id
    WHERE ch.id = tests.chapter_id
      AND public.is_enrolled_in_class(co.class_id)
  )
);
