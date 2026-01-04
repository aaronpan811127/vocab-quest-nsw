import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type SubscriptionTier = 'free' | 'premium';

interface SubscriptionState {
  tier: SubscriptionTier;
  subscribed: boolean;
  subscriptionEnd: string | null;
  loading: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  maxChildren: number;
  maxUnitsPerTestType: number;
  canViewProgressReports: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Tier limits
const TIER_LIMITS = {
  free: {
    maxChildren: 1,
    maxUnitsPerTestType: 2,
    canViewProgressReports: false,
  },
  premium: {
    maxChildren: 3,
    maxUnitsPerTestType: Infinity,
    canViewProgressReports: true,
  },
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    subscribed: false,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = async () => {
    if (!user) {
      setState({
        tier: 'free',
        subscribed: false,
        subscriptionEnd: null,
        loading: false,
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      setState({
        tier: data.tier || 'free',
        subscribed: data.subscribed || false,
        subscriptionEnd: data.subscription_end || null,
        loading: false,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  // Refresh subscription status every minute
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const limits = TIER_LIMITS[state.tier];

  return (
    <SubscriptionContext.Provider
      value={{
        ...state,
        checkSubscription,
        maxChildren: limits.maxChildren,
        maxUnitsPerTestType: limits.maxUnitsPerTestType,
        canViewProgressReports: limits.canViewProgressReports,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
