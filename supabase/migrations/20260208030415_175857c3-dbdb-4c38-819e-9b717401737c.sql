-- Insert the Word Shooter game
INSERT INTO public.games (id, game_type, name, description, icon_name, rules)
VALUES (
  'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b',
  'word_shooter',
  'Word Shooter',
  'Race against the clock! Pick the correct synonym or antonym before the cards flip.',
  'Crosshair',
  '{"content_type": "word", "questions_per_game": 10}'::jsonb
);

-- Link to all 4 test types in the Challenge section (display_order 5)
INSERT INTO public.test_type_games (test_type_id, game_id, section_id, display_order, required_for_unlock, contributes_to_xp, is_enabled)
VALUES
  ('9269e375-597f-41e6-b6f0-18a53c554fb8', 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', 'f4647010-db8d-4097-a19e-91c6c1ff122b', 5, true, true, true),
  ('9a18065d-d51c-466e-bafa-2728c0586ab0', 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', 'f4647010-db8d-4097-a19e-91c6c1ff122b', 5, true, true, true),
  ('42779ffe-837a-4545-8d2d-1214b623a080', 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', 'f4647010-db8d-4097-a19e-91c6c1ff122b', 5, true, true, true),
  ('497b4056-f691-4800-aa50-4c151c9b25e5', 'e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', 'f4647010-db8d-4097-a19e-91c6c1ff122b', 5, true, true, true);
