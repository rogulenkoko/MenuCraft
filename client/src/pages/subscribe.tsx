import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSubscription, SUBSCRIPTION_REQUIRED } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Check, LogOut, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";

const FEATURES = [
  "Unlimited menu downloads",
  "3 AI-generated design variations per menu",
  "All menu sizes (A4, Letter, A5, Half-Letter)",
  "Custom color palettes",
  "Premium support",
];

export default function Subscribe() {
  const { toast } = useToast();
  const { user, profile, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const { hasActiveSubscription, createCheckoutSession, openCustomerPortal, isLoading: subscriptionLoading } = useSubscription();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

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
    if (!SUBSCRIPTION_REQUIRED) {
      toast({
        title: "Free Mode",
        description: "All features are free! No subscription needed.",
      });
      setLocation("/dashboard");
    }
  }, [toast, setLocation]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      setLocation("/");
    }
  };

  const handleSubscribe = async () => {
    setIsProcessing(true);
    const { error } = await createCheckoutSession();
    setIsProcessing(false);
    if (error) {
      toast({
        title: "Subscription Error",
        description: error.message || "Could not start subscription process",
        variant: "destructive",
      });
    }
  };

  const handleManageSubscription = async () => {
    setIsProcessing(true);
    const { error } = await openCustomerPortal();
    setIsProcessing(false);
    if (error) {
      toast({
        title: "Portal Error",
        description: error.message || "Could not open billing portal",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !isSupabaseReady || subscriptionLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!SUBSCRIPTION_REQUIRED) {
    return null;
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
            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-semibold tracking-tight">Claude Menu</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" data-testid="button-dashboard">
                  Dashboard
                </Button>
              </Link>
              <ThemeToggle />
              <div className="flex items-center gap-2">
                {userAvatar && (
                  <img
                    src={userAvatar}
                    alt={userName || "User"}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                )}
                <span className="text-sm font-medium">{userName}</span>
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

      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-4" data-testid="text-subscribe-title">
            {hasActiveSubscription ? "Manage Subscription" : "Upgrade to Pro"}
          </h1>
          <p className="text-xl text-muted-foreground">
            {hasActiveSubscription
              ? "You have an active subscription"
              : "Unlock unlimited menu downloads"}
          </p>
        </div>

        <Card className="p-8">
          <div className="text-center mb-8">
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl font-bold">$29</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-muted-foreground">Cancel anytime</p>
          </div>

          <ul className="space-y-4 mb-8">
            {FEATURES.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {hasActiveSubscription ? (
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={handleManageSubscription}
              disabled={isProcessing}
              data-testid="button-manage-subscription"
            >
              {isProcessing ? "Loading..." : "Manage Subscription"}
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={handleSubscribe}
              disabled={isProcessing}
              data-testid="button-start-subscription"
            >
              {isProcessing ? (
                "Processing..."
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Subscription
                </>
              )}
            </Button>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Secure payment powered by Stripe
        </p>
      </div>
    </div>
  );
}
