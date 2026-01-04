-- Drop the existing unique constraint on unit_number
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_unit_number_key;

-- Create a new composite unique constraint on unit_number and test_type_id
ALTER TABLE public.units ADD CONSTRAINT units_unit_number_test_type_id_key UNIQUE (unit_number, test_type_id);