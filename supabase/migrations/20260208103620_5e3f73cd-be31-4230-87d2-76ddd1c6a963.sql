-- Set Word Intuition content_type to 'excluded' to remove from admin generation/review
UPDATE games 
SET rules = COALESCE(rules, '{}'::jsonb) || '{"content_type": "excluded"}'::jsonb
WHERE id = '05155f78-2977-44cd-8d77-b6ec5a7b78cc';