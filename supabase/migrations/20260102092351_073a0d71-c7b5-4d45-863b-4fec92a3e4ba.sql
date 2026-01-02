-- Add a vocabulary table to store word details for flashcards
CREATE TABLE public.vocabulary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  definition TEXT NOT NULL,
  synonyms TEXT[] DEFAULT '{}',
  antonyms TEXT[] DEFAULT '{}',
  examples TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

-- Everyone can view vocabulary (it's shared content)
CREATE POLICY "Authenticated users can view vocabulary" 
ON public.vocabulary 
FOR SELECT 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_vocabulary_unit_id ON public.vocabulary(unit_id);
CREATE INDEX idx_vocabulary_word ON public.vocabulary(word);