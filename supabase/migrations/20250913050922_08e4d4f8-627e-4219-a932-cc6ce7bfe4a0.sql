-- Fix RLS recursion causing errors when accessing classes via students policies

-- Ensure RLS is enabled on students (idempotent)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Drop the recursive ALL policy on students that references classes and causes recursion
DROP POLICY IF EXISTS "Teachers can manage students in their classes" ON public.students;

-- Re-create granular policies without SELECT to avoid recursion during class queries

-- Allow teachers to INSERT students into their own classes
CREATE POLICY "Teachers can insert students in their classes"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = students.class_id AND c.teacher_id = auth.uid()
  )
);

-- Allow teachers to UPDATE students in their own classes
CREATE POLICY "Teachers can update students in their classes"
ON public.students
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = students.class_id AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = students.class_id AND c.teacher_id = auth.uid()
  )
);

-- Allow teachers to DELETE students in their own classes
CREATE POLICY "Teachers can delete students in their classes"
ON public.students
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = students.class_id AND c.teacher_id = auth.uid()
  )
);

-- Keep existing student self-view policy (already present):
-- "Students can view their own record" FOR SELECT USING (email = auth.jwt()->>'email')
-- Add a teacher SELECT policy that avoids referencing classes to break recursion
CREATE POLICY "Teachers can view students (via profile role)"
ON public.students
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'teacher'
  )
);
