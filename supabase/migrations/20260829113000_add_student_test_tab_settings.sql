ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS student_new_tests_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS student_pro_tests_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS student_scheduled_tests_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS student_completed_tests_enabled boolean NOT NULL DEFAULT true;
