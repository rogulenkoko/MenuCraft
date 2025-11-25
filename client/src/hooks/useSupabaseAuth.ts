import { useState, useEffect, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, Profile, isSupabaseConfigured } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSupabaseReady: boolean;
}

export function useSupabaseAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: isSupabaseConfigured,
    isAuthenticated: false,
    isSupabaseReady: isSupabaseConfigured,
  });

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured || !supabase) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    }

    return data as Profile | null;
  }, []);

  const createOrUpdateProfile = useCallback(async (user: User) => {
    if (!isSupabaseConfigured || !supabase) return null;

    // First try to fetch existing profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      return existingProfile as Profile;
    }

    // Profile doesn't exist, create it
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
    });

    // Ignore duplicate key error (23505) - profile might have been created by another request
    if (error && error.code !== '23505') {
      console.error('Error creating profile:', error);
    }

    // Fetch and return the profile
    return fetchProfile(user.id);
  }, [fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState({
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        isSupabaseReady: false,
      });
      return;
    }

    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (session?.user) {
          const profile = await createOrUpdateProfile(session.user);
          if (!isMounted) return;
          setAuthState({
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAuthenticated: true,
            isSupabaseReady: true,
          });
        } else {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            isSupabaseReady: true,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (!isMounted) return;
        setAuthState({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          isSupabaseReady: true,
        });
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        if (session?.user) {
          const profile = await createOrUpdateProfile(session.user);
          if (!isMounted) return;
          setAuthState({
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAuthenticated: true,
            isSupabaseReady: true,
          });
        } else {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            isSupabaseReady: true,
          });
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [createOrUpdateProfile]);

  const signInWithGoogle = useCallback(async (): Promise<{ error: AuthError | null }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: { message: 'Supabase not configured', name: 'ConfigError', status: 500 } as AuthError };
    }
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async (): Promise<{ error: AuthError | null }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: { message: 'Supabase not configured', name: 'ConfigError', status: 500 } as AuthError };
    }
    
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setAuthState({
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        isSupabaseReady: true,
      });
    }
    return { error };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (authState.user) {
      const profile = await fetchProfile(authState.user.id);
      setAuthState(prev => ({ ...prev, profile }));
    }
  }, [authState.user, fetchProfile]);

  return {
    ...authState,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };
}
