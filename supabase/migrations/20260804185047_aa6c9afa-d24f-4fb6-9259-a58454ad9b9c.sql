ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS close_after_schedule boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS single_attempt boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.reexam_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  responded_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reexam_requests TO authenticated;
GRANT ALL ON public.reexam_requests TO service_role;

ALTER TABLE public.reexam_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own reexam requests"
ON public.reexam_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.email = auth.email()));

CREATE POLICY "Students create own reexam requests"
ON public.reexam_requests FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.email = auth.email()));

CREATE POLICY "Students cancel own pending reexam requests"
ON public.reexam_requests FOR DELETE TO authenticated
USING (status = 'pending' AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.email = auth.email()));

CREATE POLICY "Teachers view class reexam requests"
ON public.reexam_requests FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers update class reexam requests"
ON public.reexam_requests FOR UPDATE TO authenticated
USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_reexam_requests_updated_at
BEFORE UPDATE ON public.reexam_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.consume_reexam_grant(_test_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _id uuid;
BEGIN
  SELECT r.id INTO _id FROM public.reexam_requests r
    JOIN public.students s ON s.id = r.student_id
   WHERE r.test_id = _test_id AND r.student_id = _student_id
     AND r.status = 'approved' AND r.used_at IS NULL
     AND s.email = auth.email()
   ORDER BY r.responded_at DESC LIMIT 1;
  IF _id IS NULL THEN RETURN false; END IF;
  UPDATE public.reexam_requests SET used_at = now() WHERE id = _id;
  RETURN true;
END;
$$;