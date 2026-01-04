-- Add current_unit_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN current_unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;