
-- 1. Leaderboard: drop blanket authenticated SELECT, add owner-only policy
DROP POLICY IF EXISTS "Authenticated users can view leaderboard" ON public.leaderboard;
CREATE POLICY "Users can view own leaderboard"
  ON public.leaderboard
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Parents can view their children's incorrect answers
CREATE POLICY "Parents can view children incorrect answers"
  ON public.attempt_incorrect_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_attempts ga
      JOIN public.parent_children pc ON pc.student_user_id = ga.user_id
      JOIN public.parent_profiles pp ON pp.id = pc.parent_id
      WHERE ga.id = attempt_incorrect_answers.attempt_id
        AND pp.user_id = auth.uid()
        AND pc.relationship_status = 'active'
    )
  );

CREATE POLICY "Parents can view children incorrect dictation answers"
  ON public.attempt_incorrect_answers_dictation
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_attempts ga
      JOIN public.parent_children pc ON pc.student_user_id = ga.user_id
      JOIN public.parent_profiles pp ON pp.id = pc.parent_id
      WHERE ga.id = attempt_incorrect_answers_dictation.attempt_id
        AND pp.user_id = auth.uid()
        AND pc.relationship_status = 'active'
    )
  );

-- 3. Storage: remove broad public SELECT on avatars bucket
-- Public bucket files remain reachable via their public URLs (CDN); this only prevents listing via the API.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

-- 4. Lock down SECURITY DEFINER functions
-- Trigger-only helpers: revoke from all callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_parent_role_creation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_profile_role_creation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Internal helpers: only authenticated may call (RLS/app code)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_premium_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_child_availability(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_game_attempt_allowed(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_questions_for_game(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_test_type_games(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_game_submission(uuid, uuid, uuid, uuid, jsonb, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_game_submission(uuid, uuid, uuid, jsonb, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_dictation_game_submission(uuid, uuid, uuid, jsonb, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_dictation_game_submission(uuid, uuid, text, jsonb, integer) FROM PUBLIC, anon;
