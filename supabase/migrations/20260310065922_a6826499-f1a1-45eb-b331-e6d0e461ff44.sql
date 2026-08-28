
-- Create notices table
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  link text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Teachers can manage notices in their classes
CREATE POLICY "Teachers can manage notices" ON public.notices
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = notices.class_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = notices.class_id AND c.teacher_id = auth.uid()
  ));

-- Students can view notices for their enrolled classes
CREATE POLICY "Students can view notices" ON public.notices
  FOR SELECT TO authenticated
  USING (
    is_student_in_class(class_id, (auth.jwt() ->> 'email'::text))
  );

-- Create storage bucket for notice attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('notice-attachments', 'notice-attachments', true);

-- Storage policies for notice attachments
CREATE POLICY "Authenticated users can upload notice attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notice-attachments');

CREATE POLICY "Anyone can view notice attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'notice-attachments');

CREATE POLICY "Teachers can delete notice attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notice-attachments');
