
-- Create a function to handle student creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _class_id uuid;
BEGIN
  -- Only create student record if role is 'student' and class_id is provided
  IF COALESCE(NEW.raw_user_meta_data->>'role', '') = 'student' 
     AND NEW.raw_user_meta_data->>'class_id' IS NOT NULL THEN
    
    _class_id := (NEW.raw_user_meta_data->>'class_id')::uuid;
    
    -- Insert into students table
    INSERT INTO public.students (name, email, class_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      NEW.email,
      _class_id
    );
    
    -- Also create enrollment record
    INSERT INTO public.student_enrollments (student_id, class_id)
    SELECT s.id, _class_id
    FROM public.students s
    WHERE s.email = NEW.email
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for student creation
CREATE TRIGGER on_auth_user_created_student
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_student();
