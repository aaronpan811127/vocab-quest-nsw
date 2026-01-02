-- Add default_test_type_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN default_test_type_id uuid REFERENCES public.test_types(id);

-- Create index for faster lookups
CREATE INDEX idx_profiles_default_test_type ON public.profiles(default_test_type_id);