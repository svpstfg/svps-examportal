
-- Function to update student_count on classes when enrollments change
CREATE OR REPLACE FUNCTION public.update_class_student_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.classes SET student_count = (
      SELECT COUNT(*) FROM public.student_enrollments WHERE class_id = NEW.class_id
    ) WHERE id = NEW.class_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.classes SET student_count = (
      SELECT COUNT(*) FROM public.student_enrollments WHERE class_id = OLD.class_id
    ) WHERE id = OLD.class_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger on student_enrollments
CREATE TRIGGER trg_update_class_student_count
AFTER INSERT OR DELETE ON public.student_enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_class_student_count();

-- Backfill existing counts
UPDATE public.classes SET student_count = (
  SELECT COUNT(*) FROM public.student_enrollments WHERE class_id = classes.id
);
