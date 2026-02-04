import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type SubscriptionTier = 'free' | 'premium';
export type BillingInterval = 'monthly' | 'annual' | null;

interface SubscriptionState {
  tier: SubscriptionTier;
  subscribed: boolean;
  subscriptionEnd: string | null;
  billingInterval: BillingInterval;
  loading: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialExpired: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  maxChildren: number;
  maxUnitsPerTestType: number;
  canViewProgressReports: boolean;
  hasFullProgressReports: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Tier limits
const TIER_LIMITS = {
  free: {
    maxChildren: 1,
    maxUnitsPerTestType: 2, // Limited to first 2 units during trial
    canViewProgressReports: true, // High-level reports only
    hasFullProgressReports: false,
  },
  premium: {
    maxChildren: 3,
    maxUnitsPerTestType: Infinity,
    canViewProgressReports: true,
    hasFullProgressReports: true,
  },
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    subscribed: false,
    subscriptionEnd: null,
    billingInterval: null,
    loading: true,
    isTrialActive: false,
    trialDaysRemaining: 0,
    trialExpired: true,
  });

  const checkSubscription = async () => {
    if (!user) {
      setState({
        tier: 'free',
        subscribed: false,
        subscriptionEnd: null,
        billingInterval: null,
        loading: false,
        isTrialActive: false,
        trialDaysRemaining: 0,
        trialExpired: true,
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        // On error, default to free tier rather than blocking the app
        setState({
          tier: 'free',
          subscribed: false,
          subscriptionEnd: null,
          billingInterval: null,
          loading: false,
          isTrialActive: false,
          trialDaysRemaining: 0,
          trialExpired: true,
        });
        return;
      }

      setState({
        tier: data?.tier || 'free',
        subscribed: data?.subscribed || false,
        subscriptionEnd: data?.subscription_end || null,
        billingInterval: data?.billing_interval || null,
        loading: false,
        isTrialActive: data?.is_trial_active || false,
        trialDaysRemaining: data?.trial_days_remaining || 0,
        trialExpired: data?.trial_expired ?? true,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      // On error, default to free tier rather than blocking the app
      setState({
        tier: 'free',
        subscribed: false,
        subscriptionEnd: null,
        billingInterval: null,
        loading: false,
        isTrialActive: false,
        trialDaysRemaining: 0,
        trialExpired: true,
      });
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
        hasFullProgressReports: limits.hasFullProgressReports,
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
