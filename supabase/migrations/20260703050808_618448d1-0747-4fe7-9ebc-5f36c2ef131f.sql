CREATE TABLE public.teacher_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  student_email_domain text NOT NULL DEFAULT 'svps.com',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_settings TO authenticated;
GRANT ALL ON public.teacher_settings TO service_role;

ALTER TABLE public.teacher_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own settings"
ON public.teacher_settings
FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE TRIGGER update_teacher_settings_updated_at
BEFORE UPDATE ON public.teacher_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();