import { useEffect, useState, useRef } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, FileText, Clock, LogOut, Plus, CheckCircle } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { supabase, MenuGeneration, isSupabaseConfigured } from "@/lib/supabase";
import { format } from "date-fns";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, profile, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const { hasActiveSubscription, subscriptionRequired, canDownload, refreshSubscription } = useSubscription();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const successToastShown = useRef(false);

  const [generations, setGenerations] = useState<MenuGeneration[]>([]);
  const [generationsLoading, setGenerationsLoading] = useState(true);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const subscriptionParam = params.get('subscription');
    const storedSuccess = localStorage.getItem('subscription_success');
    
    if ((subscriptionParam === 'success' || storedSuccess === 'true') && !successToastShown.current) {
      successToastShown.current = true;
      setShowSuccessBanner(true);
      toast({
        title: "Payment Successful!",
        description: "Thank you for subscribing to Claude Menu Pro!",
      });
      refreshSubscription?.();
      localStorage.removeItem('subscription_success');
      if (subscriptionParam) {
        localStorage.setItem('subscription_success', 'true');
        window.history.replaceState({}, '', '/dashboard');
      }
    }
  }, [search, toast, refreshSubscription]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && isSupabaseReady) {
      toast({
        title: "Please sign in",
        description: "Redirecting to home page...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/");
      }, 500);
    }
  }, [isAuthenticated, isLoading, isSupabaseReady, toast, setLocation]);

  useEffect(() => {
    async function fetchGenerations() {
      if (!isAuthenticated || !isSupabaseConfigured || !supabase) {
        setGenerationsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('menu_generations')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setGenerations(data || []);
      } catch (error) {
        console.error('Error fetching generations:', error);
      } finally {
        setGenerationsLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchGenerations();
    }
  }, [isAuthenticated]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setLocation("/");
    }
  };

  if (isLoading || !isSupabaseReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-xl font-semibold mb-4">Setup Required</h2>
          <p className="text-muted-foreground">
            Please configure Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) to use this application.
          </p>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userName = profile?.name || user.user_metadata?.full_name || user.email;
  const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold tracking-tight">Claude Menu</span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="flex items-center gap-2">
                {userAvatar && (
                  <img
                    src={userAvatar}
                    alt={userName || "User"}
                    className="h-8 w-8 rounded-full object-cover"
                    data-testid="img-user-avatar"
                  />
                )}
                <span className="text-sm font-medium" data-testid="text-user-name">
                  {userName}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {showSuccessBanner && (
          <Card className="mb-8 p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  Payment Successful!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Thank you for subscribing to Claude Menu Pro. You now have full access to all features.
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto" 
                onClick={() => setShowSuccessBanner(false)}
              >
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        <div className="mb-12">
          <h1 className="text-4xl font-semibold mb-8" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Menus</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold" data-testid="text-total-menus">
                {generations.length}
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Subscription</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-semibold" data-testid="text-subscription-status">
                {!subscriptionRequired ? "Free" : hasActiveSubscription ? "Active" : "Free"}
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">Quick Action</span>
                  <Link href="/generate">
                    <Button data-testid="button-new-menu">
                      <Plus className="h-4 w-4 mr-2" />
                      New Menu
                    </Button>
                  </Link>
                  {subscriptionRequired && !hasActiveSubscription && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Subscribe to download designs
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold" data-testid="text-recent-title">
              Recent Generations
            </h2>
            <Link href="/generate">
              <Button data-testid="button-create-new">
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </Link>
          </div>

          {generationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : generations.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2" data-testid="text-empty-state-title">
                No menus generated yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Create your first beautiful menu design for free
              </p>
              <Link href="/generate">
                <Button data-testid="button-generate-first">
                  Generate Your First Menu
                </Button>
              </Link>
              {subscriptionRequired && !hasActiveSubscription && (
                <p className="text-xs text-muted-foreground mt-4">
                  Note: Subscription required to download final designs
                </p>
              )}
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {generations.map((generation) => (
                <Link key={generation.id} href={`/result/${generation.id}`}>
                  <Card
                    className="p-6 hover-elevate cursor-pointer"
                    data-testid={`card-generation-${generation.id}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-medium mb-1 line-clamp-1" data-testid={`text-menu-name-${generation.id}`}>
                          {generation.file_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {generation.created_at && format(new Date(generation.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
                        {generation.size}
                      </span>
                      <span className="text-muted-foreground">
                        {generation.colors?.length || 0} colors
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {subscriptionRequired && !hasActiveSubscription && (
          <Card className="mt-12 p-8 bg-primary/5 border-primary/20">
            <div className="text-center max-w-2xl mx-auto">
              <h3 className="text-2xl font-semibold mb-2">Upgrade to Pro</h3>
              <p className="text-muted-foreground mb-6">
                Subscribe to unlock unlimited menu downloads and premium features
              </p>
              <Link href="/subscribe">
                <Button size="lg" data-testid="button-upgrade-pro">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
