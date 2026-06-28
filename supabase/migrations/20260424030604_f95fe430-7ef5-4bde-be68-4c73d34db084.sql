-- RPC to list all classes for student class-picker during signup/enrollment
CREATE OR REPLACE FUNCTION public.list_public_classes()
RETURNS TABLE(id uuid, name text, description text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.description
  FROM public.classes c
  ORDER BY c.name;
$$;