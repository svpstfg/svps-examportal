-- Student AI Report settings: complete manual Supabase SQL Editor setup.
-- Safe to run once on an existing project. It preserves existing settings.

CREATE TABLE IF NOT EXISTS public.teacher_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  student_email_domain text NOT NULL DEFAULT 'svps.com',
  student_ai_reports_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS student_ai_reports_enabled boolean NOT NULL DEFAULT true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_settings TO authenticated;
GRANT ALL ON public.teacher_settings TO service_role;

ALTER TABLE public.teacher_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_settings'
      AND policyname = 'Teachers manage their own settings'
  ) THEN
    CREATE POLICY "Teachers manage their own settings"
    ON public.teacher_settings
    FOR ALL
    TO authenticated
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_settings'
      AND policyname = 'Students can view enrolled teacher settings'
  ) THEN
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
  END IF;
END $$;

-- Verification query: after running the script, this should show the new column.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'teacher_settings'
ORDER BY ordinal_position;
