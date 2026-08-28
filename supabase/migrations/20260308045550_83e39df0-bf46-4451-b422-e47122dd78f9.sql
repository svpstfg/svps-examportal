
-- Create a security definer function to look up class by invite code
-- This bypasses RLS so students can find classes they're not yet enrolled in
CREATE OR REPLACE FUNCTION public.find_class_by_invite_code(_invite_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM public.classes c
  WHERE c.invite_code = _invite_code
  LIMIT 1;
$$;
