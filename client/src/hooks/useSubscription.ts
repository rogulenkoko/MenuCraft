import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';
import { supabase } from '@/lib/supabase';

const SUBSCRIPTION_REQUIRED = import.meta.env.VITE_SUBSCRIPTION_REQUIRED !== 'false';

interface SubscriptionState {
  hasActiveSubscription: boolean;
  subscriptionRequired: boolean;
  canDownload: boolean;
  isLoading: boolean;
  isSyncing: boolean;
}

export function useSubscription() {
  const { profile, isAuthenticated, refreshProfile, user, session } = useSupabaseAuth();
  const [state, setState] = useState<SubscriptionState>({
    hasActiveSubscription: false,
    subscriptionRequired: SUBSCRIPTION_REQUIRED,
    canDownload: !SUBSCRIPTION_REQUIRED,
    isLoading: true,
    isSyncing: false,
  });
  const syncAttempted = useRef(false);

  // Sync subscription status from Stripe
  const syncSubscription = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) {
      console.log('[Subscription] Not authenticated, skipping sync');
      return false;
    }

    console.log('[Subscription] Syncing subscription status from Stripe...');
    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      const response = await fetch('/api/stripe/sync-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      console.log('[Subscription] Sync response:', data);

      if (response.ok && data.synced) {
        // Refresh the profile to get updated subscription status
        await refreshProfile();
        console.log('[Subscription] Profile refreshed after sync');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Subscription] Sync error:', error);
      return false;
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [isAuthenticated, session?.access_token, refreshProfile]);

  // Auto-sync subscription when user is authenticated
  useEffect(() => {
    if (!isAuthenticated || syncAttempted.current) {
      return;
    }

    // Mark sync as attempted to prevent multiple syncs
    syncAttempted.current = true;
    
    // Sync subscription status from Stripe
    syncSubscription();
  }, [isAuthenticated, syncSubscription]);

  // Update state when profile changes
  useEffect(() => {
    if (!isAuthenticated) {
      setState(prev => ({
        ...prev,
        hasActiveSubscription: false,
        subscriptionRequired: SUBSCRIPTION_REQUIRED,
        canDownload: !SUBSCRIPTION_REQUIRED,
        isLoading: false,
      }));
      return;
    }

    const hasActive = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
    const canDownload = !SUBSCRIPTION_REQUIRED || hasActive;

    console.log('[Subscription] Profile subscription_status:', profile?.subscription_status, 'hasActive:', hasActive);

    setState(prev => ({
      ...prev,
      hasActiveSubscription: hasActive,
      subscriptionRequired: SUBSCRIPTION_REQUIRED,
      canDownload,
      isLoading: false,
    }));
  }, [profile, isAuthenticated]);

  const createCheckoutSession = useCallback(async () => {
    if (!SUBSCRIPTION_REQUIRED) {
      return { error: new Error('Subscriptions are disabled') };
    }

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          returnUrl: window.location.origin,
          email: user?.email 
        }),
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
  }, [user?.email]);

  const openCustomerPortal = useCallback(async () => {
    try {
      const email = user?.email;
      if (!email) {
        throw new Error('Email is required to access billing portal');
      }

      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          returnUrl: window.location.origin,
          email 
        }),
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
  }, [user?.email]);

  return {
    ...state,
    createCheckoutSession,
    openCustomerPortal,
    refreshSubscription: refreshProfile,
    syncSubscription,
  };
}

export { SUBSCRIPTION_REQUIRED };
