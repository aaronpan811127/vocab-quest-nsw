-- Backfill unit_config for existing snapshots
UPDATE public.user_unit_game_snapshots s
SET unit_config = jsonb_build_object(
  'title', u.title,
  'description', u.description,
  'words', u.words,
  'unit_number', u.unit_number
)
FROM public.units u
WHERE s.unit_id = u.id
AND (s.unit_config IS NULL OR s.unit_config = '{}'::jsonb);