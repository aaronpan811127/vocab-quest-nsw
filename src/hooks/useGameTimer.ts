import { useState, useEffect, useCallback, useRef } from 'react';

interface UseGameTimerProps {
  totalQuestions: number;
  secondsPerQuestion: number;
  onTimeUp: () => void;
  isActive: boolean;
  initialTimeRemaining?: number; // For resuming sessions
}

export const useGameTimer = ({
  totalQuestions,
  secondsPerQuestion,
  onTimeUp,
  isActive,
  initialTimeRemaining
}: UseGameTimerProps) => {
  const totalTime = totalQuestions * secondsPerQuestion;
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining ?? totalTime);
  const onTimeUpRef = useRef(onTimeUp);
  const hasTriggeredRef = useRef(false);
  const initializedRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Handle initial time remaining from resumed session
  useEffect(() => {
    if (initialTimeRemaining !== undefined && !initializedRef.current) {
      initializedRef.current = true;
      setTimeRemaining(initialTimeRemaining);
      hasTriggeredRef.current = false;
      
      // Check if already expired on load
      if (initialTimeRemaining <= 0) {
        hasTriggeredRef.current = true;
        setTimeout(() => onTimeUpRef.current(), 0);
      }
    }
  }, [initialTimeRemaining]);

  // Reset timer when total time changes (but not if we have initial time remaining)
  useEffect(() => {
    if (initialTimeRemaining === undefined) {
      setTimeRemaining(totalTime);
      hasTriggeredRef.current = false;
    }
  }, [totalTime, initialTimeRemaining]);

  useEffect(() => {
    if (!isActive || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            // Use setTimeout to avoid state update during render
            setTimeout(() => onTimeUpRef.current(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeRemaining]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const percentage = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0;

  const getTimerColor = useCallback(() => {
    if (percentage > 50) return 'text-success';
    if (percentage > 25) return 'text-warning';
    return 'text-destructive';
  }, [percentage]);

  const getProgressColor = useCallback(() => {
    if (percentage > 50) return 'bg-success';
    if (percentage > 25) return 'bg-warning';
    return 'bg-destructive';
  }, [percentage]);

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    percentage,
    timerColor: getTimerColor(),
    progressColor: getProgressColor(),
    isExpired: timeRemaining <= 0
  };
};
