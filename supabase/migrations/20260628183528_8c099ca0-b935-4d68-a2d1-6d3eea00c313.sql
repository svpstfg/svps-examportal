-- visitor_counts
CREATE TABLE public.visitor_counts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page text NOT NULL UNIQUE,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.visitor_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visitor counts"
ON public.visitor_counts FOR SELECT USING (true);

INSERT INTO public.visitor_counts (page, count) VALUES ('auth', 0)
ON CONFLICT (page) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_visitor_count(_page text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_count bigint;
BEGIN
  INSERT INTO public.visitor_counts (page, count)
  VALUES (_page, 1)
  ON CONFLICT (page)
  DO UPDATE SET count = public.visitor_counts.count + 1, updated_at = now()
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_visitor_count(_page text)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT count FROM public.visitor_counts WHERE page = _page), 0);
$$;

CREATE OR REPLACE FUNCTION public.list_public_classes()
RETURNS TABLE(id uuid, name text, description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.description FROM public.classes c ORDER BY c.name;
$$;

-- upgrade_requests
CREATE TABLE public.upgrade_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  class_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  responded_at TIMESTAMPTZ,
  approved_duration_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_upgrade_requests_unique_pending
  ON public.upgrade_requests (student_id, class_id)
  WHERE status = 'pending';
CREATE INDEX idx_upgrade_requests_teacher ON public.upgrade_requests (teacher_id, status);
CREATE INDEX idx_upgrade_requests_student ON public.upgrade_requests (student_id, status);

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students create own upgrade requests"
ON public.upgrade_requests FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = upgrade_requests.student_id AND s.email = (auth.jwt() ->> 'email'))
);

CREATE POLICY "Students view own upgrade requests"
ON public.upgrade_requests FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = upgrade_requests.student_id AND s.email = (auth.jwt() ->> 'email'))
);

CREATE POLICY "Students delete own pending requests"
ON public.upgrade_requests FOR DELETE TO authenticated
USING (
  status = 'pending' AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = upgrade_requests.student_id AND s.email = (auth.jwt() ->> 'email'))
);

CREATE POLICY "Teachers view their class requests"
ON public.upgrade_requests FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers update their class requests"
ON public.upgrade_requests FOR UPDATE TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_upgrade_requests_updated_at
BEFORE UPDATE ON public.upgrade_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.upgrade_requests;
ALTER TABLE public.upgrade_requests REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.approve_upgrade_request(
  _request_id UUID,
  _duration_days INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
    SET status = 'approved', responded_at = now(), approved_duration_days = _duration_days
    WHERE id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_upgrade_request(_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

-- Fix mutable search_path on the updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Data API GRANTs (required for PostgREST access on the Cloud DB)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON public.classes TO anon;
GRANT SELECT ON public.visitor_counts TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;