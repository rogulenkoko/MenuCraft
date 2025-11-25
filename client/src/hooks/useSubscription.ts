import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from './useSupabaseAuth';

const SUBSCRIPTION_REQUIRED = import.meta.env.VITE_SUBSCRIPTION_REQUIRED !== 'false';

interface SubscriptionState {
  hasActiveSubscription: boolean;
  subscriptionRequired: boolean;
  canDownload: boolean;
  isLoading: boolean;
}

export function useSubscription() {
  const { profile, isAuthenticated, refreshProfile, session } = useSupabaseAuth();
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
      // Get the current session token
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (error: any) {
      console.error('Checkout error:', error);
      return { error };
    }
  }, [session]);

  const openCustomerPortal = useCallback(async () => {
    try {
      // Get the current session token
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to open customer portal');
      }

      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (error: any) {
      console.error('Portal error:', error);
      return { error };
    }
  }, [session]);

  return {
    ...state,
    createCheckoutSession,
    openCustomerPortal,
    refreshSubscription: refreshProfile,
  };
}

export { SUBSCRIPTION_REQUIRED };
