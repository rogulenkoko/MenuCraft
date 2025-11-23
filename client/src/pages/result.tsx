import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Download, LogOut, Loader2, Check } from "lucide-react";
import { Link, useRoute } from "wouter";
import type { MenuGeneration } from "@shared/schema";

export default function Result() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/result/:id");
  const generationId = params?.id;
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);

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

  const { data: generation, isLoading: generationLoading } = useQuery<MenuGeneration>({
    queryKey: ["/api/generations", generationId],
    enabled: !!generationId && isAuthenticated,
  });

  const { data: subscription } = useQuery<{ hasActiveSubscription: boolean; subscriptionRequired: boolean }>({
    queryKey: ["/api/subscription/status"],
    enabled: isAuthenticated,
  });

  const subscriptionRequired = subscription?.subscriptionRequired ?? true;
  const hasActiveSubscription = subscription?.hasActiveSubscription ?? false;
  const canDownload = !subscriptionRequired || hasActiveSubscription;

  useEffect(() => {
    if (generation?.selectedVariation !== null && generation?.selectedVariation !== undefined) {
      setSelectedVariation(generation.selectedVariation);
    }
  }, [generation]);

  const selectMutation = useMutation({
    mutationFn: async (variation: number) => {
      await apiRequest("POST", `/api/generations/${generationId}/select`, { variation });
    },
    onSuccess: (_, variation) => {
      setSelectedVariation(variation);
      queryClient.invalidateQueries({ queryKey: ["/api/generations", generationId] });
      toast({
        title: "Design Selected",
        description: "You can now download this design",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Selection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (variation: number) => {
      const response = await fetch(`/api/generations/${generationId}/download/${variation}`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error("Download failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `menu-design-${variation + 1}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Download Started",
        description: "Your menu design is being downloaded",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading || !user || generationLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Generation Not Found</h2>
          <p className="text-muted-foreground mb-4">This menu generation doesn't exist</p>
          <Link href="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const htmlDesigns = generation.htmlDesigns || [];

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

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold mb-2" data-testid="text-result-title">
            Your Menu Designs
          </h1>
          <p className="text-muted-foreground">
            {generation.fileName} • {generation.size}
          </p>
        </div>

        {htmlDesigns.length === 0 ? (
          <Card className="p-12 text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Generating Designs...</h3>
            <p className="text-muted-foreground">
              This usually takes about 30 seconds
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3 mb-8">
              {htmlDesigns.map((html, index) => (
                <Card
                  key={index}
                  className={`p-6 hover-elevate cursor-pointer transition-all ${
                    selectedVariation === index ? 'ring-2 ring-primary' : ''
                  }`}
                  data-testid={`card-design-${index}`}
                >
                  <div className="aspect-[8.5/11] bg-muted rounded-lg mb-4 overflow-hidden border">
                    <iframe
                      srcDoc={html}
                      className="w-full h-full"
                      title={`Design ${index + 1}`}
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium" data-testid={`text-design-title-${index}`}>
                      Design Variation {index + 1}
                    </h3>
                    {selectedVariation === index && (
                      <Check className="h-5 w-5 text-primary" data-testid={`icon-selected-${index}`} />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedVariation === index ? (
                      <>
                        {canDownload ? (
                          <Button
                            variant="default"
                            className="w-full"
                            onClick={() => downloadMutation.mutate(index)}
                            disabled={downloadMutation.isPending}
                            data-testid={`button-download-${index}`}
                          >
                            {downloadMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            Download HTML
                          </Button>
                        ) : (
                          <Link href="/subscribe" className="w-full">
                            <Button
                              variant="default"
                              className="w-full"
                              data-testid={`button-subscribe-to-download-${index}`}
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              Subscribe to Download
                            </Button>
                          </Link>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => selectMutation.mutate(index)}
                        disabled={selectMutation.isPending}
                        data-testid={`button-select-${index}`}
                      >
                        {selectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          "Select This Design"
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-center gap-4">
              <Link href="/generate">
                <Button variant="outline" size="lg" data-testid="button-generate-new">
                  Generate New Menu
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="lg" data-testid="button-back-dashboard">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
