import { Switch, Route, Redirect, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import Dashboard from "@/pages/dashboard";
import Generate from "@/pages/generate";
import Subscribe from "@/pages/subscribe";
import AuthCallback from "@/pages/auth-callback";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, isSupabaseReady } = useSupabaseAuth();
  const [location] = useLocation();

  // Always allow auth callback to render without waiting for auth state
  if (location === '/auth/callback' || location.startsWith('/auth/callback')) {
    return <AuthCallback />;
  }

  // Show loading only if Supabase is configured and still loading
  if (isLoading && isSupabaseReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Generate page is now the landing page - accessible to everyone */}
      <Route path="/" component={Generate} />
      
      {/* Dashboard with optional menu ID - shows all menus with editor */}
      <Route path="/dashboard/:id?">
        {isAuthenticated ? <Dashboard /> : <Redirect to="/" />}
      </Route>
      
      {/* Generate is also accessible at /generate for direct links */}
      <Route path="/generate" component={Generate} />
      
      {/* Legacy result route redirects to dashboard */}
      <Route path="/result/:id">
        {({ id }) => <Redirect to={`/dashboard/${id}`} />}
      </Route>
      
      <Route path="/subscribe">
        {isAuthenticated ? <Subscribe /> : <Redirect to="/" />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}
