-- Create reading_passages table for storing passages per unit
CREATE TABLE public.reading_passages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  highlighted_words TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create question_bank table with optional passage reference
CREATE TABLE public.question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  passage_id UUID REFERENCES public.reading_passages(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attempt_incorrect_answers table
CREATE TABLE public.attempt_incorrect_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.game_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reading_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_incorrect_answers ENABLE ROW LEVEL SECURITY;

-- RLS policies for reading_passages (public read)
CREATE POLICY "Anyone can view passages" ON public.reading_passages FOR SELECT USING (true);

-- RLS policies for question_bank (public read)
CREATE POLICY "Anyone can view questions" ON public.question_bank FOR SELECT USING (true);

-- RLS policies for attempt_incorrect_answers
CREATE POLICY "Users can view own incorrect answers" ON public.attempt_incorrect_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_attempts WHERE id = attempt_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own incorrect answers" ON public.attempt_incorrect_answers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.game_attempts WHERE id = attempt_id AND user_id = auth.uid())
);

-- Add indexes for performance
CREATE INDEX idx_question_bank_unit ON public.question_bank(unit_id);
CREATE INDEX idx_question_bank_passage ON public.question_bank(passage_id);
CREATE INDEX idx_question_bank_game_type ON public.question_bank(game_type);
CREATE INDEX idx_reading_passages_unit ON public.reading_passages(unit_id);
CREATE INDEX idx_attempt_incorrect_answers_attempt ON public.attempt_incorrect_answers(attempt_id);