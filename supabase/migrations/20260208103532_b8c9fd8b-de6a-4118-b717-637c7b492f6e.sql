-- Disable Word Intuition from all test types
UPDATE test_type_games 
SET is_enabled = false 
WHERE game_id = '05155f78-2977-44cd-8d77-b6ec5a7b78cc';