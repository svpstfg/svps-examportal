CREATE TABLE public.student_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  report TEXT NOT NULL,
  score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_analyses TO authenticated;
GRANT ALL ON public.student_analyses TO service_role;

ALTER TABLE public.student_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage analyses for their classes"
ON public.student_analyses FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = student_analyses.student_id AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = student_analyses.student_id AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "Students can read their own analysis"
ON public.student_analyses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_analyses.student_id AND s.email = auth.email()
  )
);

CREATE TRIGGER update_student_analyses_updated_at
BEFORE UPDATE ON public.student_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();