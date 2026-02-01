-- Add review_status column to reading_passages table
ALTER TABLE public.reading_passages 
ADD COLUMN review_status text DEFAULT 'pending';

-- Add rejection_reason column for admin notes
ALTER TABLE public.reading_passages 
ADD COLUMN rejection_reason text;

-- Add reviewed_by and reviewed_at for tracking
ALTER TABLE public.reading_passages 
ADD COLUMN reviewed_by uuid;

ALTER TABLE public.reading_passages 
ADD COLUMN reviewed_at timestamp with time zone;