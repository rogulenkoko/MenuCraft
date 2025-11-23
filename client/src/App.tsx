import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Generate from "@/pages/generate";
import Result from "@/pages/result";
import Subscribe from "@/pages/subscribe";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Landing page - only for unauthenticated users */}
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Landing />}
      </Route>
      
      {/* Dashboard - redirect to home if not authenticated */}
      <Route path="/dashboard">
        {isAuthenticated ? <Dashboard /> : <Redirect to="/" />}
      </Route>
      
      {/* Generate - protected route */}
      <Route path="/generate">
        {isAuthenticated ? <Generate /> : <Redirect to="/" />}
      </Route>
      
      {/* Result - protected route */}
      <Route path="/result/:id">
        {isAuthenticated ? <Result /> : <Redirect to="/" />}
      </Route>
      
      {/* Subscribe - protected route */}
      <Route path="/subscribe">
        {isAuthenticated ? <Subscribe /> : <Redirect to="/" />}
      </Route>
      
      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
