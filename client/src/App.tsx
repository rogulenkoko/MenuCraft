import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Generate from "@/pages/generate";
import Result from "@/pages/result";
import Subscribe from "@/pages/subscribe";
import AuthCallback from "@/pages/auth-callback";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useSupabaseAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Landing />}
      </Route>
      
      <Route path="/auth/callback">
        <AuthCallback />
      </Route>
      
      <Route path="/dashboard">
        {isAuthenticated ? <Dashboard /> : <Redirect to="/" />}
      </Route>
      
      <Route path="/generate">
        {isAuthenticated ? <Generate /> : <Redirect to="/" />}
      </Route>
      
      <Route path="/result/:id">
        {isAuthenticated ? <Result /> : <Redirect to="/" />}
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
