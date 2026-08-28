
-- Allow authenticated users to look up classes by invite_code for joining
CREATE POLICY "Authenticated users can find classes by invite code"
  ON public.classes FOR SELECT
  TO authenticated
  USING (true);
