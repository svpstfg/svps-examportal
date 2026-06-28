
-- Remove the overly permissive policy that lets everyone see all classes
DROP POLICY IF EXISTS "Anyone can view classes by invite code" ON public.classes;
