import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, FileText, Clock, LogOut, Plus } from "lucide-react";
import { Link } from "wouter";
import type { MenuGeneration, User } from "@shared/schema";
import { format } from "date-fns";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: generations = [], isLoading: generationsLoading } = useQuery<MenuGeneration[]>({
    queryKey: ["/api/generations"],
    enabled: isAuthenticated,
  });

  const { data: subscription, refetch: refetchSubscription } = useQuery<{ hasActiveSubscription: boolean; isDevelopmentBypass?: boolean; subscriptionRequired: boolean }>({
    queryKey: ["/api/subscription/status"],
    enabled: isAuthenticated,
  });

  // Refetch subscription status when component mounts to ensure fresh data
  useEffect(() => {
    if (isAuthenticated) {
      refetchSubscription();
    }
  }, [isAuthenticated, refetchSubscription]);

  const subscriptionRequired = subscription?.subscriptionRequired ?? true;

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasActiveSubscription = subscription?.hasActiveSubscription ?? false;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
                {user.profileImageUrl && (
                  <img
                    src={user.profileImageUrl}
                    alt={user.firstName || "User"}
                    className="h-8 w-8 rounded-full object-cover"
                    data-testid="img-user-avatar"
                  />
                )}
                <span className="text-sm font-medium" data-testid="text-user-name">
                  {user.firstName || user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.href = "/api/logout"}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Stats Overview */}
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
                {hasActiveSubscription ? "Active" : "Free"}
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

        {/* Recent Generations */}
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
                <Card
                  key={generation.id}
                  className="p-6 hover-elevate cursor-pointer"
                  onClick={() => window.location.href = `/result/${generation.id}`}
                  data-testid={`card-generation-${generation.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-medium mb-1 line-clamp-1" data-testid={`text-menu-name-${generation.id}`}>
                        {generation.fileName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {generation.createdAt && format(new Date(generation.createdAt), "MMM d, yyyy")}
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
              ))}
            </div>
          )}
        </div>

        {/* Subscription Info */}
        {!hasActiveSubscription && (
          <Card className="mt-12 p-8 bg-primary/5 border-primary/20">
            <div className="text-center max-w-2xl mx-auto">
              <h3 className="text-2xl font-semibold mb-2">Upgrade to Pro</h3>
              <p className="text-muted-foreground mb-6">
                Subscribe to unlock unlimited menu generations and premium features
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
