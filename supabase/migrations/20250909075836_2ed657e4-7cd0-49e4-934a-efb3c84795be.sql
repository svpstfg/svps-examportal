-- Fix infinite recursion in RLS policies for classes table
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view classes they teach" ON public.classes;
DROP POLICY IF EXISTS "Users can create classes" ON public.classes;
DROP POLICY IF EXISTS "Users can update classes they teach" ON public.classes;
DROP POLICY IF EXISTS "Users can delete classes they teach" ON public.classes;

-- Create corrected policies without recursion
CREATE POLICY "Teachers can view their own classes" 
ON public.classes 
FOR SELECT 
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create classes" 
ON public.classes 
FOR INSERT 
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own classes" 
ON public.classes 
FOR UPDATE 
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes" 
ON public.classes 
FOR DELETE 
USING (teacher_id = auth.uid());