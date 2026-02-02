-- Add Gap Fill Passage game
INSERT INTO public.games (game_type, name, description, icon_name, rules)
VALUES (
  'gap_fill_passage',
  'Gap Fill Passage',
  'Read a passage and fill in sentence-level gaps by selecting from a bank of options',
  'FileText',
  '{"questions_per_passage": 8, "passages_per_game": 3, "time_limit_minutes": 20, "options_count": 9}'::jsonb
);

-- Get the Selective test type ID, Test section ID, and newly created game ID
DO $$
DECLARE
  v_test_type_id UUID;
  v_section_id UUID;
  v_game_id UUID;
  v_max_order INT;
BEGIN
  SELECT id INTO v_test_type_id FROM public.test_types WHERE LOWER(code) = 'selective';
  SELECT id INTO v_section_id FROM public.game_sections WHERE code = 'test';
  SELECT id INTO v_game_id FROM public.games WHERE game_type = 'gap_fill_passage';
  SELECT COALESCE(MAX(display_order), 0) INTO v_max_order 
  FROM public.test_type_games 
  WHERE test_type_id = v_test_type_id AND section_id = v_section_id;

  INSERT INTO public.test_type_games (
    test_type_id,
    game_id,
    section_id,
    display_order,
    is_enabled,
    required_for_unlock,
    contributes_to_xp
  ) VALUES (
    v_test_type_id,
    v_game_id,
    v_section_id,
    v_max_order + 1,
    true,
    false,
    true
  );
END $$;