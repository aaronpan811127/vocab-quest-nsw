
-- Insert the Lingo game
INSERT INTO public.games (game_type, name, description, icon_name, rules)
VALUES (
  'lingo',
  'Lingo',
  'Guess the vocabulary word letter by letter, Wordle-style! Green = correct position, yellow = wrong position.',
  'LayoutGrid',
  '{"content_type": "word", "questions_per_word": 1}'::jsonb
);

-- Link Lingo to all 4 test types in the Challenge section (display_order 6)
INSERT INTO public.test_type_games (test_type_id, game_id, section_id, display_order, contributes_to_xp, required_for_unlock, is_enabled)
SELECT 
  tt.id,
  g.id,
  'f4647010-db8d-4097-a19e-91c6c1ff122b',
  6,
  true,
  true,
  true
FROM public.test_types tt
CROSS JOIN public.games g
WHERE tt.is_enabled = true
  AND g.game_type = 'lingo';
