ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

COMMENT ON COLUMN public.test_attempts.status IS 'completed = submitted normally, unfinished = student left before submitting';