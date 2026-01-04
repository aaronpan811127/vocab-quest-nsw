-- Allow Learn-section game types in user_progress
ALTER TABLE public.user_progress
  DROP CONSTRAINT IF EXISTS user_progress_game_type_check;

ALTER TABLE public.user_progress
  ADD CONSTRAINT user_progress_game_type_check
  CHECK (
    game_type IN (
      'reading',
      'listening',
      'speaking',
      'writing',
      'intuition',
      'flashcards',
      'matching',
      'oddoneout'
    )
  );