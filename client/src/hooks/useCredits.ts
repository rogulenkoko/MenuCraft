import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';

const PAYMENT_REQUIRED = import.meta.env.VITE_PAYMENT_REQUIRED !== 'false';

interface CreditsState {
  hasActivated: boolean;
  menuCredits: number;
  totalGenerated: number;
  paymentRequired: boolean;
  canGenerate: boolean;
  canDownload: boolean;
  isLoading: boolean;
}

export function useCredits() {
  const { isAuthenticated, session, refreshProfile } = useSupabaseAuth();
  const [state, setState] = useState<CreditsState>({
    hasActivated: false,
    menuCredits: 0,
    totalGenerated: 0,
    paymentRequired: PAYMENT_REQUIRED,
    canGenerate: !PAYMENT_REQUIRED,
    canDownload: !PAYMENT_REQUIRED,
    isLoading: true,
  });

  const fetchCredits = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) {
      setState(prev => ({
        ...prev,
        hasActivated: false,
        menuCredits: 0,
        totalGenerated: 0,
        canGenerate: !PAYMENT_REQUIRED,
        canDownload: !PAYMENT_REQUIRED,
        isLoading: false,
      }));
      return;
    }

    try {
      const response = await fetch('/api/credits', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const hasActivated = data.hasActivated || false;
        const menuCredits = data.menuCredits || 0;
        
        setState({
          hasActivated,
          menuCredits,
          totalGenerated: data.totalGenerated || 0,
          paymentRequired: data.paymentRequired ?? PAYMENT_REQUIRED,
          canGenerate: !PAYMENT_REQUIRED || (hasActivated && menuCredits > 0),
          canDownload: !PAYMENT_REQUIRED || hasActivated,
          isLoading: false,
        });
      } else {
        console.error('[Credits] Failed to fetch credits:', response.status);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('[Credits] Error fetching credits:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isAuthenticated, session?.access_token]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const purchaseActivation = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) {
      return { error: new Error('Must be logged in to purchase activation') };
    }

    try {
      const response = await fetch('/api/pay/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          returnUrl: window.location.origin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create activation checkout');
      }

      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (error: any) {
      console.error('[Credits] Activation checkout error:', error);
      return { error };
    }
  }, [isAuthenticated, session?.access_token]);

  const purchaseCredits = useCallback(async (quantity: number = 5) => {
    if (!isAuthenticated || !session?.access_token) {
      return { error: new Error('Must be logged in to purchase credits') };
    }

    try {
      const response = await fetch('/api/pay/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          returnUrl: window.location.origin,
          quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create credits checkout');
      }

      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (error: any) {
      console.error('[Credits] Credits checkout error:', error);
      return { error };
    }
  }, [isAuthenticated, session?.access_token]);

  return {
    ...state,
    purchaseActivation,
    purchaseCredits,
    refreshCredits: fetchCredits,
  };
}

export { PAYMENT_REQUIRED };
