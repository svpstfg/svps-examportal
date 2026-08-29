ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;
