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
    console.log('[Auth] Starting auth initialization, isSupabaseConfigured:', isSupabaseConfigured);
    
    if (!isSupabaseConfigured || !supabase) {
      console.log('[Auth] Supabase not configured, setting isLoading to false');
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

    const initAuth = async (retryCount = 0) => {
      const maxRetries = 2;
      console.log(`[Auth] Calling getSession... (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      console.log(`[Auth] Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
      
      try {
        const startTime = Date.now();
        
        // Try to get session from localStorage first (faster than API call)
        const storageKey = `sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token`;
        console.log(`[Auth] Checking localStorage key: ${storageKey}`);
        
        const storedSession = localStorage.getItem(storageKey);
        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession);
            console.log(`[Auth] Found stored session, expires: ${new Date(parsed.expires_at * 1000).toISOString()}`);
            
            // Check if session is still valid
            if (parsed.expires_at * 1000 > Date.now()) {
              console.log('[Auth] Session still valid, using stored session');
              
              // Create user object from stored session
              const user = parsed.user;
              if (user) {
                let profile = null;
                try {
                  profile = await createOrUpdateProfile(user);
                } catch (profileError) {
                  console.error('[Auth] Profile fetch error:', profileError);
                }
                
                if (!isMounted) return;
                
                setAuthState({
                  user,
                  profile,
                  session: parsed,
                  isLoading: false,
                  isAuthenticated: true,
                  isSupabaseReady: true,
                });
                return;
              }
            } else {
              console.log('[Auth] Stored session expired');
            }
          } catch (parseError) {
            console.error('[Auth] Error parsing stored session:', parseError);
          }
        } else {
          console.log('[Auth] No stored session found');
        }
        
        console.log('[Auth] Starting getSession call...');
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => {
            console.log(`[Auth] Timeout triggered after ${Date.now() - startTime}ms`);
            reject(new Error('Auth request timeout after 15s'));
          }, 15000)
        );
        
        const sessionPromise = supabase.auth.getSession().then(result => {
          console.log(`[Auth] getSession resolved after ${Date.now() - startTime}ms`);
          return result;
        });
        
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        
        const { data, error } = result;
        
        if (error) {
          console.error('[Auth] getSession returned error:', JSON.stringify(error));
          throw error;
        }
        
        const session = data?.session;
        console.log('[Auth] getSession completed, session:', session ? 'exists' : 'null');
        
        if (!isMounted) return;

        if (session?.user) {
          console.log('[Auth] User found, fetching profile...');
          let profile = null;
          try {
            profile = await createOrUpdateProfile(session.user);
            console.log('[Auth] Profile fetched:', profile ? 'exists' : 'null');
          } catch (profileError) {
            console.error('[Auth] Profile fetch error:', profileError);
          }
          if (!isMounted) return;
          console.log('[Auth] Setting authenticated state');
          setAuthState({
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAuthenticated: true,
            isSupabaseReady: true,
          });
        } else {
          console.log('[Auth] No user, setting unauthenticated state');
          setAuthState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            isSupabaseReady: true,
          });
        }
      } catch (error: any) {
        console.error('[Auth] Auth initialization error:', error?.message || error);
        if (!isMounted) return;
        
        if (retryCount < maxRetries) {
          console.log(`[Auth] Retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return initAuth(retryCount + 1);
        }
        
        console.error('[Auth] All retries failed, setting unauthenticated state');
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

    initAuth(0);

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
