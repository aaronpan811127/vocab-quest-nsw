-- Add review fields to vocabulary table
ALTER TABLE public.vocabulary 
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS review_score INTEGER,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by UUID,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for filtering by review status
CREATE INDEX IF NOT EXISTS idx_vocabulary_review_status ON public.vocabulary(review_status);