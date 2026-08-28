
-- Create storage bucket for question papers
INSERT INTO storage.buckets (id, name, public) VALUES ('question-papers', 'question-papers', true);

-- Create question_papers table
CREATE TABLE public.question_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;

-- Teachers can manage question papers for their classes
CREATE POLICY "Teachers can manage question papers"
ON public.question_papers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = question_papers.class_id AND c.teacher_id = auth.uid()
  )
);

-- Students can view question papers for their enrolled classes
CREATE POLICY "Students can view question papers"
ON public.question_papers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.class_id = question_papers.class_id AND s.email = (auth.jwt() ->> 'email'::text)
  )
);

-- Storage policies: teachers can upload
CREATE POLICY "Teachers can upload question papers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'question-papers' AND
  EXISTS (
    SELECT 1 FROM public.classes c WHERE c.teacher_id = auth.uid()
  )
);

-- Anyone authenticated can read question papers
CREATE POLICY "Authenticated users can read question papers"
ON storage.objects
FOR SELECT
USING (bucket_id = 'question-papers' AND auth.role() = 'authenticated');

-- Teachers can delete their uploads
CREATE POLICY "Teachers can delete question papers"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'question-papers' AND
  EXISTS (
    SELECT 1 FROM public.classes c WHERE c.teacher_id = auth.uid()
  )
);
