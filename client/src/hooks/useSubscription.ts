import { useState, useEffect, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { useSupabaseAuth } from './useSupabaseAuth';

const SUBSCRIPTION_REQUIRED = import.meta.env.VITE_SUBSCRIPTION_REQUIRED !== 'false';

interface SubscriptionState {
  hasActiveSubscription: boolean;
  subscriptionRequired: boolean;
  canDownload: boolean;
  isLoading: boolean;
}

export function useSubscription() {
  const { profile, isAuthenticated, refreshProfile } = useSupabaseAuth();
  const [state, setState] = useState<SubscriptionState>({
    hasActiveSubscription: false,
    subscriptionRequired: SUBSCRIPTION_REQUIRED,
    canDownload: !SUBSCRIPTION_REQUIRED,
    isLoading: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setState({
        hasActiveSubscription: false,
        subscriptionRequired: SUBSCRIPTION_REQUIRED,
        canDownload: !SUBSCRIPTION_REQUIRED,
        isLoading: false,
      });
      return;
    }

    const hasActive = profile?.subscription_status === 'active';
    const canDownload = !SUBSCRIPTION_REQUIRED || hasActive;

    setState({
      hasActiveSubscription: hasActive,
      subscriptionRequired: SUBSCRIPTION_REQUIRED,
      canDownload,
      isLoading: false,
    });
  }, [profile, isAuthenticated]);

  const createCheckoutSession = useCallback(async () => {
    if (!SUBSCRIPTION_REQUIRED) {
      return { error: new Error('Subscriptions are disabled') };
    }

    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { returnUrl: window.location.origin },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (error: any) {
      console.error('Checkout error:', error);
      return { error };
    }
  }, []);

  const openCustomerPortal = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: { returnUrl: window.location.origin },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (error: any) {
      console.error('Portal error:', error);
      return { error };
    }
  }, []);

  return {
    ...state,
    createCheckoutSession,
    openCustomerPortal,
    refreshSubscription: refreshProfile,
  };
}

export { SUBSCRIPTION_REQUIRED };
