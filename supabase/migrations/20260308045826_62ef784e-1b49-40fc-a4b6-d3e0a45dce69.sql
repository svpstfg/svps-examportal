
-- The students table has a unique constraint on email alone, 
-- but multi-class enrollment needs one student row per class.
-- Replace with composite unique on (email, class_id).
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_email_key;
ALTER TABLE public.students ADD CONSTRAINT students_email_class_unique UNIQUE (email, class_id);
