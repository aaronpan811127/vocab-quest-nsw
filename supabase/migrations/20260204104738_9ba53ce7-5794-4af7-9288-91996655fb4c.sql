-- Add trial_started_at column to profiles table for tracking 7-day free trial
ALTER TABLE public.profiles 
ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Set existing users' trial_started_at to their created_at date
UPDATE public.profiles 
SET trial_started_at = created_at 
WHERE trial_started_at IS NULL OR trial_started_at = now();