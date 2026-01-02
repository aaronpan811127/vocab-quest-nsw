-- Add back SELECT policy on question_bank for authenticated users
-- The view questions_for_play already filters out correct_answer column
-- This policy allows the view to function with SECURITY INVOKER
CREATE POLICY "Authenticated users can select questions" 
ON public.question_bank 
FOR SELECT 
TO authenticated
USING (true);