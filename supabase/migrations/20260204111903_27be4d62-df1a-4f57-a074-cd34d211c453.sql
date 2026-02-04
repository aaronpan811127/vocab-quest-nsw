-- Fix 1: Replace the "Anyone can view leaderboard" policy with one that requires authentication
-- This prevents unauthenticated users from accessing user_ids in the leaderboard table

DROP POLICY IF EXISTS "Anyone can view leaderboard" ON public.leaderboard;

CREATE POLICY "Authenticated users can view leaderboard"
ON public.leaderboard
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Add RLS policy to questions_for_play view
-- First enable RLS on the view (it's currently a view without RLS)
-- Views inherit RLS from underlying tables, but we should add explicit protection

-- Since questions_for_play is a VIEW that selects from question_bank (which has admin-only SELECT),
-- we need to create a policy that allows authenticated users to read questions during gameplay
-- The view filters out rejected questions (only approved or pending)

-- Drop the view and recreate it with security barrier
DROP VIEW IF EXISTS public.questions_for_play;

CREATE VIEW public.questions_for_play 
WITH (security_barrier = true, security_invoker = true)
AS
SELECT 
  qb.id,
  qb.unit_id,
  qb.passage_id,
  qb.game_id,
  qb.question_text,
  qb.options,
  qb.word,
  qb.created_at
FROM public.question_bank qb
WHERE qb.review_status IS NULL 
   OR qb.review_status = 'approved'
   OR qb.review_status = 'pending';

-- Grant access to authenticated users only (not public/anon)
REVOKE ALL ON public.questions_for_play FROM anon;
REVOKE ALL ON public.questions_for_play FROM public;
GRANT SELECT ON public.questions_for_play TO authenticated;