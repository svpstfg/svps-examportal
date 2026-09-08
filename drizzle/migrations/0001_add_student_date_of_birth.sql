ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_birth date;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;