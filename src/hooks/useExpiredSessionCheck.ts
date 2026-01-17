import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useExpiredSessionCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const checkExpiredSessions = async () => {
      if (!user) return;

      setIsChecking(true);
      try {
        const { data, error } = await supabase.functions.invoke('complete-expired-sessions');

        if (error) {
          console.error('Error checking expired sessions:', error);
          return;
        }

        if (data?.success && data.completed_count > 0) {
          setCompletedCount(data.completed_count);
          console.log(`Auto-completed ${data.completed_count} expired test session(s)`);
        }
      } catch (err) {
        console.error('Failed to check expired sessions:', err);
      } finally {
        setIsChecking(false);
      }
    };

    checkExpiredSessions();
  }, [user]);

  return { isChecking, completedCount };
};
