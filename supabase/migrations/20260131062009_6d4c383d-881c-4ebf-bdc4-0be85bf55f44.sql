-- Add review fields to question_bank table
ALTER TABLE public.question_bank 
ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS review_score integer CHECK (review_score >= 0 AND review_score <= 10),
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create index for filtering by review status
CREATE INDEX IF NOT EXISTS idx_question_bank_review_status ON public.question_bank(review_status);

-- Create a security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'admin'
  )
$$;

-- Add RLS policy for admins to manage questions
CREATE POLICY "Admins can update questions"
ON public.question_bank
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add RLS policy for admins to delete questions
CREATE POLICY "Admins can delete questions"
ON public.question_bank
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to view all user progress
CREATE POLICY "Admins can view all user progress"
ON public.user_progress
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to delete user progress
CREATE POLICY "Admins can delete user progress"
ON public.user_progress
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to view all game attempts
CREATE POLICY "Admins can view all game attempts"
ON public.game_attempts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to delete game attempts
CREATE POLICY "Admins can delete game attempts"
ON public.game_attempts
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to update game attempts
CREATE POLICY "Admins can update game attempts"
ON public.game_attempts
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to view all leaderboard entries
CREATE POLICY "Admins can view all leaderboard"
ON public.leaderboard
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to update leaderboard
CREATE POLICY "Admins can update all leaderboard"
ON public.leaderboard
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to view all snapshots
CREATE POLICY "Admins can view all snapshots"
ON public.user_unit_game_snapshots
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to delete snapshots
CREATE POLICY "Admins can delete snapshots"
ON public.user_unit_game_snapshots
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to view all incorrect answers
CREATE POLICY "Admins can view all incorrect answers"
ON public.attempt_incorrect_answers
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to delete incorrect answers
CREATE POLICY "Admins can delete incorrect answers"
ON public.attempt_incorrect_answers
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to view all dictation incorrect answers
CREATE POLICY "Admins can view all dictation incorrect answers"
ON public.attempt_incorrect_answers_dictation
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add policy for admins to delete dictation incorrect answers
CREATE POLICY "Admins can delete dictation incorrect answers"
ON public.attempt_incorrect_answers_dictation
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));