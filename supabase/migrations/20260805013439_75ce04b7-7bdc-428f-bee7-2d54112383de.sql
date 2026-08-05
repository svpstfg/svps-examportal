CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_role text NOT NULL DEFAULT 'teacher',
  teacher_id uuid,
  student_id uuid,
  class_id uuid,
  feature text NOT NULL,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view their own AI usage"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR user_id = auth.uid());

CREATE INDEX idx_ai_usage_logs_teacher ON public.ai_usage_logs(teacher_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_student ON public.ai_usage_logs(student_id, created_at DESC);

CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid,
  course_id uuid,
  chapter_id uuid,
  title text,
  tags text[] NOT NULL DEFAULT '{}',
  question jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their own question bank"
  ON public.question_bank FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE INDEX idx_question_bank_teacher ON public.question_bank(teacher_id, created_at DESC);

CREATE TRIGGER update_question_bank_updated_at
  BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS negative_marking numeric NOT NULL DEFAULT 0;