-- Add a column to track if a passage was AI-generated and by whom
ALTER TABLE public.reading_passages 
ADD COLUMN IF NOT EXISTS generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_reading_passages_generated_by ON public.reading_passages(generated_by) WHERE is_generated = true;

-- Add policy for users to insert their own generated passages
CREATE POLICY "Users can insert own generated passages" 
ON public.reading_passages 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = generated_by AND is_generated = true);

-- Also need to allow inserting questions for generated passages
CREATE POLICY "Users can insert questions for own generated passages" 
ON public.question_bank 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reading_passages 
    WHERE id = passage_id 
    AND generated_by = auth.uid() 
    AND is_generated = true
  )
);