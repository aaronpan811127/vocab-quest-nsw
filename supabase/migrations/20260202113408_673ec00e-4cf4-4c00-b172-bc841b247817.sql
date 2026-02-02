-- Add content_type to games rules JSONB for database-driven game classification

-- Passage-based games
UPDATE games SET rules = COALESCE(rules, '{}'::jsonb) || '{"content_type": "passage"}'::jsonb 
WHERE game_type IN ('reading', 'linked_extracts', 'gap_fill_passage');

-- Word-based games (including flashcards)
UPDATE games SET rules = COALESCE(rules, '{}'::jsonb) || '{"content_type": "word"}'::jsonb 
WHERE game_type IN ('intuition', 'context_master', 'cloze_challenge', 'flashcards');

-- Excluded games (no reviewable questions)
UPDATE games SET rules = COALESCE(rules, '{}'::jsonb) || '{"content_type": "excluded"}'::jsonb 
WHERE game_type IN ('listening', 'matching', 'speaking', 'writing', 'oddoneout');