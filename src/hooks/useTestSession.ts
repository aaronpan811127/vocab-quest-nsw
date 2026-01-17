import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TestSession {
  sessionId: string;
  startedAt: string;
  totalDurationSeconds: number;
  remainingSeconds: number;
  isExpired: boolean;
  resumed: boolean;
}

interface UseTestSessionResult {
  session: TestSession | null;
  isLoading: boolean;
  error: string | null;
  alreadyCompleted: boolean;
  previousScore: number | null;
  startSession: (params: {
    unitId: string;
    gameId: string;
    totalQuestions: number;
    secondsPerQuestion: number;
  }) => Promise<TestSession | null>;
}

export const useTestSession = (): UseTestSessionResult => {
  const [session, setSession] = useState<TestSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const { user } = useAuth();

  const startSession = useCallback(async ({
    unitId,
    gameId,
    totalQuestions,
    secondsPerQuestion
  }: {
    unitId: string;
    gameId: string;
    totalQuestions: number;
    secondsPerQuestion: number;
  }): Promise<TestSession | null> => {
    if (!user) {
      setError('Please log in to take this test.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('start-test-session', {
        body: {
          unit_id: unitId,
          game_id: gameId,
          total_questions: totalQuestions,
          seconds_per_question: secondsPerQuestion
        }
      });

      if (invokeError) throw invokeError;

      if (!data.success) {
        if (data.already_completed) {
          setAlreadyCompleted(true);
          setPreviousScore(data.score);
          return null;
        }
        throw new Error(data.error || 'Failed to start test session');
      }

      const testSession: TestSession = {
        sessionId: data.session_id,
        startedAt: data.started_at,
        totalDurationSeconds: data.total_duration_seconds,
        remainingSeconds: data.remaining_seconds,
        isExpired: data.is_expired,
        resumed: data.resumed
      };

      setSession(testSession);
      return testSession;

    } catch (err: any) {
      console.error('Error starting test session:', err);
      setError(err.message || 'Failed to start test session');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    session,
    isLoading,
    error,
    alreadyCompleted,
    previousScore,
    startSession
  };
};
