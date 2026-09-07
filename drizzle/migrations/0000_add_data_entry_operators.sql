ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';

CREATE TABLE public.teacher_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, operator_user_id),
  CHECK (teacher_id <> operator_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_operators TO authenticated;
GRANT ALL ON public.teacher_operators TO service_role;

ALTER TABLE public.teacher_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their operators"
ON public.teacher_operators
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Operators can view their assignment"
ON public.teacher_operators
FOR SELECT
TO authenticated
USING (operator_user_id = auth.uid());

CREATE INDEX teacher_operators_teacher_id_idx ON public.teacher_operators (teacher_id);
CREATE INDEX teacher_operators_operator_user_id_idx ON public.teacher_operators (operator_user_id);

CREATE OR REPLACE FUNCTION public.is_workspace_member(_teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _teacher_id
    OR EXISTS (
      SELECT 1
      FROM public.teacher_operators
      WHERE teacher_id = _teacher_id
        AND operator_user_id = auth.uid()
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;

CREATE POLICY "Operators can view assigned classes"
ON public.classes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_operators op
    WHERE op.teacher_id = classes.teacher_id
      AND op.operator_user_id = auth.uid()
  )
);

CREATE POLICY "Operators can view assigned courses"
ON public.courses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes cl
    JOIN public.teacher_operators op ON op.teacher_id = cl.teacher_id
    WHERE cl.id = courses.class_id
      AND op.operator_user_id = auth.uid()
  )
);

CREATE POLICY "Operators can view assigned chapters"
ON public.chapters
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses co
    JOIN public.classes cl ON cl.id = co.class_id
    JOIN public.teacher_operators op ON op.teacher_id = cl.teacher_id
    WHERE co.id = chapters.course_id
      AND op.operator_user_id = auth.uid()
  )
);

CREATE POLICY "Operators can manage assigned tests"
ON public.tests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chapters ch
    JOIN public.courses co ON co.id = ch.course_id
    JOIN public.classes cl ON cl.id = co.class_id
    JOIN public.teacher_operators op ON op.teacher_id = cl.teacher_id
    WHERE ch.id = tests.chapter_id
      AND op.operator_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chapters ch
    JOIN public.courses co ON co.id = ch.course_id
    JOIN public.classes cl ON cl.id = co.class_id
    JOIN public.teacher_operators op ON op.teacher_id = cl.teacher_id
    WHERE ch.id = tests.chapter_id
      AND op.operator_user_id = auth.uid()
  )
);