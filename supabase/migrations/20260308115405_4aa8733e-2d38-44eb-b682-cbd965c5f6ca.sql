
ALTER TABLE public.student_enrollments
  DROP CONSTRAINT student_enrollments_student_id_fkey;

ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
