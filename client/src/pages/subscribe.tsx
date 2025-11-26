import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useCredits, PAYMENT_REQUIRED } from "@/hooks/useCredits";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Check, LogOut, ArrowLeft, Coins, Zap, Plus, Minus } from "lucide-react";
import { Link, useLocation } from "wouter";

const ACTIVATION_FEATURES = [
  "5 menu generation credits included",
  "Unlimited menu downloads forever",
  "3 AI-generated design variations per menu",
  "All menu sizes (A4, Letter, A5, Half-Letter)",
  "Custom color palettes & themes",
];

export default function Subscribe() {
  const { toast } = useToast();
  const { user, profile, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const { 
    hasActivated, 
    menuCredits, 
    purchaseActivation, 
    purchaseCredits, 
    isLoading: creditsLoading,
    paymentRequired 
  } = useCredits();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditQuantity, setCreditQuantity] = useState(5);

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
    if (!paymentRequired) {
      toast({
        title: "Free Mode",
        description: "All features are free! No payment needed.",
      });
      setLocation("/dashboard");
    }
  }, [paymentRequired, toast, setLocation]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      setLocation("/");
    }
  };

  const handleActivate = async () => {
    setIsProcessing(true);
    const { error } = await purchaseActivation();
    setIsProcessing(false);
    if (error) {
      toast({
        title: "Payment Error",
        description: error.message || "Could not start activation process",
        variant: "destructive",
      });
    }
  };

  const handleBuyCredits = async () => {
    setIsProcessing(true);
    const { error } = await purchaseCredits(creditQuantity);
    setIsProcessing(false);
    if (error) {
      toast({
        title: "Payment Error",
        description: error.message || "Could not start credits purchase",
        variant: "destructive",
      });
    }
  };

  const adjustCredits = (delta: number) => {
    setCreditQuantity(prev => Math.max(1, Math.min(100, prev + delta)));
  };

  if (isLoading || !isSupabaseReady || creditsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!paymentRequired) {
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
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-semibold tracking-tight">Claude Menu</span>
              </div>
            </Link>
            <div className="flex items-center gap-4 flex-wrap">
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

      <div className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        {hasActivated && (
          <Card className="p-4 mb-8 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                  <Coins className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Your Credits</p>
                  <p className="text-2xl font-bold text-primary">{menuCredits} remaining</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Account Activated</span>
              </div>
            </div>
          </Card>
        )}

        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-4" data-testid="text-subscribe-title">
            {hasActivated ? "Buy More Credits" : "Get Started with Claude Menu"}
          </h1>
          <p className="text-xl text-muted-foreground">
            {hasActivated
              ? "Purchase additional credits to generate more menus"
              : "One-time activation unlocks unlimited downloads"}
          </p>
        </div>

        <div className={`grid gap-6 ${!hasActivated ? 'md:grid-cols-2' : ''}`}>
          {!hasActivated && (
            <Card className="p-8 border-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-sm font-medium rounded-bl-lg">
                Best Value
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold">Activation</h2>
              </div>
              
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold">$10</span>
                <span className="text-muted-foreground">one-time</span>
              </div>

              <ul className="space-y-4 mb-8">
                {ACTIVATION_FEATURES.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className="w-full"
                onClick={handleActivate}
                disabled={isProcessing}
                data-testid="button-activate"
              >
                {isProcessing ? (
                  "Processing..."
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Activate Now
                  </>
                )}
              </Button>
            </Card>
          )}

          <Card className={`p-8 ${hasActivated ? 'max-w-md mx-auto w-full' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
              <Coins className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold">Credits</h2>
            </div>
            
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-5xl font-bold">$1</span>
              <span className="text-muted-foreground">per credit</span>
            </div>

            <p className="text-muted-foreground mb-6">
              Each credit generates 3 unique menu design variations
            </p>

            <div className="flex items-center justify-center gap-4 mb-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustCredits(-1)}
                disabled={creditQuantity <= 1}
                data-testid="button-decrease-credits"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[100px]">
                <p className="text-4xl font-bold">{creditQuantity}</p>
                <p className="text-sm text-muted-foreground">credits</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustCredits(1)}
                disabled={creditQuantity >= 100}
                data-testid="button-increase-credits"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center mb-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold">${creditQuantity}</p>
            </div>

            <Button
              size="lg"
              variant={hasActivated ? "default" : "outline"}
              className="w-full"
              onClick={handleBuyCredits}
              disabled={isProcessing || !hasActivated}
              data-testid="button-buy-credits"
            >
              {isProcessing ? (
                "Processing..."
              ) : !hasActivated ? (
                "Activate first to buy credits"
              ) : (
                <>
                  <Coins className="h-5 w-5 mr-2" />
                  Buy {creditQuantity} Credits
                </>
              )}
            </Button>

            {!hasActivated && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Activation required before purchasing additional credits
              </p>
            )}
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Secure payment powered by Stripe
        </p>
      </div>
    </div>
  );
}
