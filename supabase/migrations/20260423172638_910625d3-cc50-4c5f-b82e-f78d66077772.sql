-- Visitor counter for Auth page
CREATE TABLE public.visitor_counts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page text NOT NULL UNIQUE,
  count bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.visitor_counts ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read the visitor count
CREATE POLICY "Anyone can view visitor counts"
ON public.visitor_counts
FOR SELECT
USING (true);

-- Seed the auth page row
INSERT INTO public.visitor_counts (page, count) VALUES ('auth', 0)
ON CONFLICT (page) DO NOTHING;

-- RPC to increment safely (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.increment_visitor_count(_page text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT count FROM public.visitor_counts WHERE page = _page), 0);
$$;