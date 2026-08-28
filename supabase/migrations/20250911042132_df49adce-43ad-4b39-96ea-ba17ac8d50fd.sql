-- Create slides table for the text editor
CREATE TABLE public.slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  serial_number INTEGER NOT NULL DEFAULT 1,
  chapter_id UUID REFERENCES chapters(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

-- Create policies for slides
CREATE POLICY "Teachers can manage slides in their chapters"
ON public.slides
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM chapters ch
    JOIN courses co ON ch.course_id = co.id
    JOIN classes cl ON co.class_id = cl.id
    WHERE ch.id = slides.chapter_id 
    AND cl.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can view slides in their chapters"
ON public.slides
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM chapters ch
    JOIN courses co ON ch.course_id = co.id
    JOIN classes cl ON co.class_id = cl.id
    JOIN students s ON s.class_id = cl.id
    WHERE ch.id = slides.chapter_id 
    AND s.email = (auth.jwt() ->> 'email')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_slides_updated_at
  BEFORE UPDATE ON public.slides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();