
-- Add invite_code to classes for teacher sharing
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Generate random 6-char invite codes for existing classes
UPDATE public.classes SET invite_code = upper(substr(md5(random()::text), 1, 6)) WHERE invite_code IS NULL;

-- Make invite_code NOT NULL with default
ALTER TABLE public.classes ALTER COLUMN invite_code SET DEFAULT upper(substr(md5(random()::text), 1, 6));
ALTER TABLE public.classes ALTER COLUMN invite_code SET NOT NULL;

-- Add tier to student_enrollments (free/pro)
ALTER TABLE public.student_enrollments ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';

-- Add is_pro flag to tests (pro-only content)
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;

-- Add is_pro flag to chapters (pro-only content)  
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT false;

-- Create index on invite_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_classes_invite_code ON public.classes(invite_code);
