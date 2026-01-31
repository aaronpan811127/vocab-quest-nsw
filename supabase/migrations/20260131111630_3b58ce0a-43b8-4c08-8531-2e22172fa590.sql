-- Insert the new Cloze Passage game
INSERT INTO public.games (game_type, name, description, icon_name, rules)
VALUES (
  'cloze_passage',
  'Cloze Passage',
  'Read multiple extracts and identify which passage matches each description',
  'FileText',
  '{"num_extracts": 4, "num_questions": 10, "time_limit_minutes": 15}'::jsonb
);

-- Add to test_type_games for SELECTIVE in learn section
INSERT INTO public.test_type_games (test_type_id, game_id, section_id, display_order, is_enabled, contributes_to_xp, required_for_unlock)
SELECT 
  '42779ffe-837a-4545-8d2d-1214b623a080'::uuid, -- SELECTIVE test type
  g.id,
  '3db8f9da-a298-4f14-9cf6-8122b7d22432'::uuid, -- learn section
  COALESCE((SELECT MAX(display_order) + 1 FROM public.test_type_games WHERE test_type_id = '42779ffe-837a-4545-8d2d-1214b623a080' AND section_id = '3db8f9da-a298-4f14-9cf6-8122b7d22432'), 1),
  true,
  true,
  true
FROM public.games g
WHERE g.game_type = 'cloze_passage';