-- Add optional passage_id column to game_attempts
ALTER TABLE public.game_attempts 
ADD COLUMN passage_id uuid REFERENCES public.reading_passages(id);

-- Create index for faster lookups
CREATE INDEX idx_game_attempts_passage_id ON public.game_attempts(passage_id);

-- Create index for user + passage lookups
CREATE INDEX idx_game_attempts_user_passage ON public.game_attempts(user_id, passage_id);