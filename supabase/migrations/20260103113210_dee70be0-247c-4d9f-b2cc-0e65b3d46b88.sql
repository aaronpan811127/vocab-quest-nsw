-- Allow users to insert their own parent role
CREATE POLICY "Users can insert own parent role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id AND role = 'parent');