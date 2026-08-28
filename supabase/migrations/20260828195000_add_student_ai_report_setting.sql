ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS student_ai_reports_enabled boolean NOT NULL DEFAULT true;

CREATE POLICY "Students can view enrolled teacher settings"
ON public.teacher_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE c.teacher_id = teacher_settings.teacher_id
      AND s.email = auth.email()
  )
);
