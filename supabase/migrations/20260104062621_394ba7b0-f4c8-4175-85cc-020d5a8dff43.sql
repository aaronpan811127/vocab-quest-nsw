-- Drop the existing check constraint and add a new one that includes 'intuition'
ALTER TABLE public.game_attempts DROP CONSTRAINT IF EXISTS game_attempts_game_type_check;

ALTER TABLE public.game_attempts ADD CONSTRAINT game_attempts_game_type_check 
CHECK (game_type IN ('reading', 'listening', 'writing', 'speaking', 'matching', 'flashcard', 'oddoneout', 'intuition'));

-- Also update user_progress table if it has the same constraint
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_game_type_check;

ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_game_type_check 
CHECK (game_type IN ('reading', 'listening', 'writing', 'speaking', 'matching', 'flashcard', 'oddoneout', 'intuition'));