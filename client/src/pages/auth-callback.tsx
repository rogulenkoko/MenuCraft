import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Sparkles } from 'lucide-react';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLocation('/');
        return;
      }

      try {
        // Check if there's an error in the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.error('Auth error:', error, errorDescription);
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => setLocation('/'), 2000);
          return;
        }

        // Wait a moment for Supabase to process the URL hash
        setStatus('Completing sign in...');
        
        // Give Supabase time to process the hash and set the session
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now check for the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setStatus('Session error. Redirecting...');
          setTimeout(() => setLocation('/'), 2000);
          return;
        }

        if (session) {
          setStatus('Success! Redirecting to dashboard...');
          // Clear the hash from URL before redirecting
          window.history.replaceState(null, '', window.location.pathname);
          setTimeout(() => setLocation('/dashboard'), 500);
        } else {
          // No session yet, try to exchange the code
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            // The session might already be set via the hash, check again
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setStatus('Success! Redirecting to dashboard...');
              window.history.replaceState(null, '', window.location.pathname);
              setTimeout(() => setLocation('/dashboard'), 500);
              return;
            }
          }
          
          if (data?.session) {
            setStatus('Success! Redirecting to dashboard...');
            window.history.replaceState(null, '', window.location.pathname);
            setTimeout(() => setLocation('/dashboard'), 500);
          } else {
            setStatus('No session found. Redirecting...');
            setTimeout(() => setLocation('/'), 2000);
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('An error occurred. Redirecting...');
        setTimeout(() => setLocation('/'), 2000);
      }
    };

    handleCallback();
  }, [setLocation]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">Claude Menu</span>
        </div>
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
