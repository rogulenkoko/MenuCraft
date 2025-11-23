import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Check, LogOut, Loader2 } from "lucide-react";
import { Link } from "wouter";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function SubscribeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    setIsProcessing(false);

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "You are now subscribed!",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Subscribe Now"
        )}
      </Button>
    </form>
  );
}

export default function Subscribe() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (isAuthenticated) {
      apiRequest("POST", "/api/create-subscription")
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch((error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        });
    }
  }, [isAuthenticated, toast]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-semibold tracking-tight">Claude Menu</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" data-testid="button-dashboard">
                  Dashboard
                </Button>
              </Link>
              <ThemeToggle />
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

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-4" data-testid="text-subscribe-title">
            Subscribe to Claude Menu Pro
          </h1>
          <p className="text-xl text-muted-foreground">
            Unlock unlimited menu generations and premium features
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 mb-12">
          <Card className="p-8">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-semibold mb-2">Pro Plan</h3>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold">$29</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Unlimited menu generations</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>3 AI-designed variations per generation</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Custom color palettes</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Multiple size formats (A4, Letter, Web, etc.)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Download as HTML</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>Priority support</span>
              </li>
            </ul>
          </Card>

          <Card className="p-8">
            <h3 className="text-xl font-semibold mb-6">Payment Details</h3>
            {!clientSecret ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <SubscribeForm />
              </Elements>
            )}
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>By subscribing, you agree to our Terms of Service and Privacy Policy.</p>
          <p className="mt-2">Cancel anytime from your account settings.</p>
        </div>
      </div>
    </div>
  );
}
