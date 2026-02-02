-- Add is_enabled column to test_types
ALTER TABLE public.test_types
ADD COLUMN is_enabled boolean NOT NULL DEFAULT true;

-- Disable all test types except Selective
UPDATE public.test_types
SET is_enabled = false
WHERE code != 'selective';