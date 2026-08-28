
-- Allow anyone (including unauthenticated users) to view class names for signup
CREATE POLICY "Anyone can view classes for signup"
ON public.classes
FOR SELECT
TO anon, authenticated
USING (true);
