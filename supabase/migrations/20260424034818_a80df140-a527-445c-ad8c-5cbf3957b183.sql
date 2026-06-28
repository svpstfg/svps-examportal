-- Table to store student requests for Pro upgrade
CREATE TABLE public.upgrade_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  class_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  message TEXT,
  responded_at TIMESTAMPTZ,
  approved_duration_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate pending requests for same student+class
CREATE UNIQUE INDEX idx_upgrade_requests_unique_pending
  ON public.upgrade_requests (student_id, class_id)
  WHERE status = 'pending';

CREATE INDEX idx_upgrade_requests_teacher ON public.upgrade_requests (teacher_id, status);
CREATE INDEX idx_upgrade_requests_student ON public.upgrade_requests (student_id, status);

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Students can create their own requests
CREATE POLICY "Students create own upgrade requests"
ON public.upgrade_requests FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = upgrade_requests.student_id
      AND s.email = (auth.jwt() ->> 'email')
  )
);

-- Students can view their own requests
CREATE POLICY "Students view own upgrade requests"
ON public.upgrade_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = upgrade_requests.student_id
      AND s.email = (auth.jwt() ->> 'email')
  )
);

-- Students can cancel their own pending requests
CREATE POLICY "Students delete own pending requests"
ON public.upgrade_requests FOR DELETE TO authenticated
USING (
  status = 'pending' AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = upgrade_requests.student_id
      AND s.email = (auth.jwt() ->> 'email')
  )
);

-- Teachers can view requests for their classes
CREATE POLICY "Teachers view their class requests"
ON public.upgrade_requests FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

-- Teachers can update (approve/reject) requests for their classes
CREATE POLICY "Teachers update their class requests"
ON public.upgrade_requests FOR UPDATE TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Trigger to auto-update updated_at
CREATE TRIGGER update_upgrade_requests_updated_at
BEFORE UPDATE ON public.upgrade_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.upgrade_requests;
ALTER TABLE public.upgrade_requests REPLICA IDENTITY FULL;

-- RPC: approve a request — sets enrollment tier=pro with optional expiry
CREATE OR REPLACE FUNCTION public.approve_upgrade_request(
  _request_id UUID,
  _duration_days INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.upgrade_requests%ROWTYPE;
  _expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO _req FROM public.upgrade_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Request already handled'; END IF;

  IF _duration_days IS NOT NULL AND _duration_days > 0 THEN
    _expires := now() + (_duration_days || ' days')::interval;
  ELSE
    _expires := NULL;
  END IF;

  UPDATE public.student_enrollments
    SET tier = 'pro', subscription_expires_at = _expires
    WHERE student_id = _req.student_id AND class_id = _req.class_id;

  UPDATE public.upgrade_requests
    SET status = 'approved',
        responded_at = now(),
        approved_duration_days = _duration_days
    WHERE id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_upgrade_request(_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req public.upgrade_requests%ROWTYPE;
BEGIN
  SELECT * INTO _req FROM public.upgrade_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Request already handled'; END IF;

  UPDATE public.upgrade_requests
    SET status = 'rejected', responded_at = now()
    WHERE id = _request_id;
END;
$$;