ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS student_portal_title text NOT NULL DEFAULT 'Skyview Test Pro';

ALTER TABLE public.teacher_settings
  ADD CONSTRAINT teacher_settings_student_portal_title_length
  CHECK (char_length(trim(student_portal_title)) BETWEEN 1 AND 60);
