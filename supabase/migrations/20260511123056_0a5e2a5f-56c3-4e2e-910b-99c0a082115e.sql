UPDATE public.test_types SET is_enabled = false WHERE code IN ('NAPLAN_Y5', 'OC');
UPDATE public.test_types SET is_enabled = true WHERE code IN ('NAPLAN_Y3', 'SELECTIVE');

-- Verify: all rows should have the expected status
SELECT code, name, is_enabled FROM public.test_types ORDER BY code;

-- Remove any references to disabled test types from profiles default
UPDATE public.profiles 
SET default_test_type_id = (
    SELECT id FROM public.test_types WHERE code = 'NAPLAN_Y3' AND is_enabled = true LIMIT 1
)
WHERE default_test_type_id IN (
    SELECT id FROM public.test_types WHERE code IN ('NAPLAN_Y5', 'OC')
);