-- question_papers
CREATE TABLE public.question_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage question papers"
ON public.question_papers FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = question_papers.class_id AND c.teacher_id = auth.uid())
);

CREATE POLICY "Students can view question papers"
ON public.question_papers FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.class_id = question_papers.class_id AND s.email = (auth.jwt() ->> 'email'::text))
);

CREATE POLICY "Teachers can upload question papers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'question-papers' AND
  EXISTS (SELECT 1 FROM public.classes c WHERE c.teacher_id = auth.uid())
);

CREATE POLICY "Authenticated users can read question papers"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-papers' AND auth.role() = 'authenticated');

CREATE POLICY "Teachers can delete question papers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'question-papers' AND
  EXISTS (SELECT 1 FROM public.classes c WHERE c.teacher_id = auth.uid())
);

-- doubts + messages
CREATE TABLE public.doubts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.doubt_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id UUID NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own doubts"
ON public.doubts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = doubts.student_id AND s.email = (auth.jwt() ->> 'email'::text)));

CREATE POLICY "Students can create doubts"
ON public.doubts FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = doubts.student_id AND s.email = (auth.jwt() ->> 'email'::text)));

CREATE POLICY "Students can update their own doubts"
ON public.doubts FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = doubts.student_id AND s.email = (auth.jwt() ->> 'email'::text)));

CREATE POLICY "Teachers can view doubts for their classes"
ON public.doubts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = doubts.class_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Teachers can update doubts for their classes"
ON public.doubts FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = doubts.class_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Students can view messages for their doubts"
ON public.doubt_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.doubts d JOIN public.students s ON s.id = d.student_id
  WHERE d.id = doubt_messages.doubt_id AND s.email = (auth.jwt() ->> 'email'::text)
));

CREATE POLICY "Students can send messages"
ON public.doubt_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.doubts d JOIN public.students s ON s.id = d.student_id
  WHERE d.id = doubt_messages.doubt_id AND s.email = (auth.jwt() ->> 'email'::text)
));

CREATE POLICY "Teachers can view messages for their class doubts"
ON public.doubt_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.doubts d JOIN public.classes c ON c.id = d.class_id
  WHERE d.id = doubt_messages.doubt_id AND c.teacher_id = auth.uid()
));

CREATE POLICY "Teachers can send messages"
ON public.doubt_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.doubts d JOIN public.classes c ON c.id = d.class_id
  WHERE d.id = doubt_messages.doubt_id AND c.teacher_id = auth.uid()
));

CREATE POLICY "Authenticated users can upload doubt images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'doubt-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view doubt images"
ON storage.objects FOR SELECT
USING (bucket_id = 'doubt-images');

ALTER PUBLICATION supabase_realtime ADD TABLE public.doubt_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubts;

CREATE TRIGGER update_doubts_updated_at
  BEFORE UPDATE ON public.doubts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- class student count maintenance
CREATE OR REPLACE FUNCTION public.update_class_student_count()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
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

CREATE TRIGGER trg_update_class_student_count
AFTER INSERT OR DELETE ON public.student_enrollments
FOR EACH ROW EXECUTE FUNCTION public.update_class_student_count();

UPDATE public.classes SET student_count = (
  SELECT COUNT(*) FROM public.student_enrollments WHERE class_id = classes.id
);

ALTER TABLE public.student_enrollments DROP CONSTRAINT student_enrollments_student_id_fkey;
ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE public.student_enrollments ADD COLUMN subscription_expires_at timestamp with time zone DEFAULT NULL;

-- notices
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

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage notices" ON public.notices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = notices.class_id AND c.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = notices.class_id AND c.teacher_id = auth.uid()));

CREATE POLICY "Students can view notices" ON public.notices
  FOR SELECT TO authenticated
  USING (is_student_in_class(class_id, (auth.jwt() ->> 'email'::text)));

CREATE POLICY "Authenticated users can upload notice attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notice-attachments');

CREATE POLICY "Anyone can view notice attachments"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'notice-attachments');

CREATE POLICY "Teachers can delete notice attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notice-attachments');