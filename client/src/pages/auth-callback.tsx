import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState('Processing...');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLocation('/');
        return;
      }

      try {
        // Check if there's an error in the URL (both query params and hash)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        const error = urlParams.get('error') || hashParams.get('error');
        const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
        
        if (error) {
          console.error('Auth error:', error, errorDescription);
          setHasError(true);
          setErrorMessage(errorDescription?.replace(/\+/g, ' ') || 'Authentication failed');
          setStatus('Authentication failed');
          return;
        }

        // Wait a moment for Supabase to process the URL hash
        setStatus('Completing sign in...');
        
        // Give Supabase time to process the hash and set the session
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now check for the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setHasError(true);
          setErrorMessage(sessionError.message);
          setStatus('Session error');
          return;
        }

        // Check if there's a pending menu generation
        const pendingGeneration = localStorage.getItem('claude_menu_pending_generation');
        const redirectPath = pendingGeneration === 'true' ? '/' : '/dashboard';
        const redirectMessage = pendingGeneration === 'true' 
          ? 'Success! Starting menu generation...' 
          : 'Success! Redirecting to dashboard...';

        if (session) {
          setStatus(redirectMessage);
          // Clear the URL params before redirecting
          window.history.replaceState(null, '', '/auth/callback');
          setTimeout(() => setLocation(redirectPath), 500);
        } else {
          // Try to exchange the code if present
          const code = urlParams.get('code');
          if (code) {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (exchangeError) {
              console.error('Code exchange error:', exchangeError);
              setHasError(true);
              setErrorMessage(exchangeError.message);
              setStatus('Failed to complete sign in');
              return;
            }
            
            if (data?.session) {
              setStatus(redirectMessage);
              window.history.replaceState(null, '', '/auth/callback');
              setTimeout(() => setLocation(redirectPath), 500);
              return;
            }
          }
          
          // No session found
          setStatus('No session found. Please try again.');
          setHasError(true);
          setErrorMessage('Could not establish a session. Please try signing in again.');
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setHasError(true);
        setErrorMessage(err.message || 'An unexpected error occurred');
        setStatus('An error occurred');
      }
    };

    handleCallback();
  }, [setLocation]);

  const handleRetry = () => {
    setLocation('/');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">Claude Menu</span>
        </div>
        
        {hasError ? (
          <>
            <div className="text-destructive mb-4">
              <p className="font-medium text-lg">{status}</p>
              <p className="text-sm mt-2">{errorMessage}</p>
            </div>
            <Button onClick={handleRetry} data-testid="button-retry-login">
              Try Again
            </Button>
          </>
        ) : (
          <>
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
