import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useExpiredSessionCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const { user, session } = useAuth();

  useEffect(() => {
    const checkExpiredSessions = async () => {
      // Only proceed if we have both a user and a valid session
      if (!user || !session?.access_token) return;

      setIsChecking(true);
      try {
        const { data, error } = await supabase.functions.invoke('complete-expired-sessions');

        // Handle any errors silently - this is a background check
        // FunctionsHttpError (401/403) means session expired, other errors are non-critical
        if (error) {
          console.log('Expired session check skipped due to error:', error.name || error.message);
          return;
        }

        if (data?.success && data.completed_count > 0) {
          setCompletedCount(data.completed_count);
          console.log(`Auto-completed ${data.completed_count} expired test session(s)`);
        }
      } catch (err) {
        // Silently handle errors - this is a background check
        console.log('Expired session check skipped:', err);
      } finally {
        setIsChecking(false);
      }
    };

    checkExpiredSessions();
  }, [user, session?.access_token]);

  return { isChecking, completedCount };
};
