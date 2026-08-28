
-- Create doubts table
CREATE TABLE public.doubts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create doubt_messages table
CREATE TABLE public.doubt_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id UUID NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL,
  message TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_messages ENABLE ROW LEVEL SECURITY;

-- RLS for doubts: students can see their own doubts
CREATE POLICY "Students can view their own doubts"
ON public.doubts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = doubts.student_id AND s.email = (auth.jwt() ->> 'email'::text)
));

-- Students can create doubts
CREATE POLICY "Students can create doubts"
ON public.doubts FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = doubts.student_id AND s.email = (auth.jwt() ->> 'email'::text)
));

-- Students can update their own doubts
CREATE POLICY "Students can update their own doubts"
ON public.doubts FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = doubts.student_id AND s.email = (auth.jwt() ->> 'email'::text)
));

-- Teachers can see doubts for their classes
CREATE POLICY "Teachers can view doubts for their classes"
ON public.doubts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.id = doubts.class_id AND c.teacher_id = auth.uid()
));

-- Teachers can update doubts for their classes
CREATE POLICY "Teachers can update doubts for their classes"
ON public.doubts FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.id = doubts.class_id AND c.teacher_id = auth.uid()
));

-- RLS for doubt_messages: students can see messages for their doubts
CREATE POLICY "Students can view messages for their doubts"
ON public.doubt_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.doubts d
  JOIN public.students s ON s.id = d.student_id
  WHERE d.id = doubt_messages.doubt_id AND s.email = (auth.jwt() ->> 'email'::text)
));

-- Students can send messages for their doubts
CREATE POLICY "Students can send messages"
ON public.doubt_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.doubts d
  JOIN public.students s ON s.id = d.student_id
  WHERE d.id = doubt_messages.doubt_id AND s.email = (auth.jwt() ->> 'email'::text)
));

-- Teachers can view messages for doubts in their classes
CREATE POLICY "Teachers can view messages for their class doubts"
ON public.doubt_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.doubts d
  JOIN public.classes c ON c.id = d.class_id
  WHERE d.id = doubt_messages.doubt_id AND c.teacher_id = auth.uid()
));

-- Teachers can send messages for doubts in their classes
CREATE POLICY "Teachers can send messages"
ON public.doubt_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.doubts d
  JOIN public.classes c ON c.id = d.class_id
  WHERE d.id = doubt_messages.doubt_id AND c.teacher_id = auth.uid()
));

-- Create storage bucket for doubt images
INSERT INTO storage.buckets (id, name, public) VALUES ('doubt-images', 'doubt-images', true);

-- Storage policies for doubt-images bucket
CREATE POLICY "Authenticated users can upload doubt images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'doubt-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view doubt images"
ON storage.objects FOR SELECT
USING (bucket_id = 'doubt-images');

-- Enable realtime for doubt_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubt_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubts;

-- Add updated_at trigger for doubts
CREATE TRIGGER update_doubts_updated_at
  BEFORE UPDATE ON public.doubts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
