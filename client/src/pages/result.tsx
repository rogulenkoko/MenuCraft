import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Download, Check, LogOut, Loader2, ArrowLeft } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { supabase, MenuGeneration, isSupabaseConfigured } from "@/lib/supabase";

export default function Result() {
  const { toast } = useToast();
  const { user, profile, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const { canDownload, subscriptionRequired, hasActiveSubscription } = useSubscription();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const generationId = params.id;

  const [generation, setGeneration] = useState<MenuGeneration | null>(null);
  const [generationLoading, setGenerationLoading] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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
    async function fetchGeneration() {
      if (!isAuthenticated || !isSupabaseConfigured || !supabase || !generationId) {
        setGenerationLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('menu_generations')
          .select('*')
          .eq('id', generationId)
          .single();

        if (error) throw error;
        setGeneration(data);
        setSelectedVariation(data.selected_variation);
      } catch (error) {
        console.error('Error fetching generation:', error);
        toast({
          title: "Error",
          description: "Could not load menu generation",
          variant: "destructive",
        });
      } finally {
        setGenerationLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchGeneration();
    }
  }, [isAuthenticated, generationId, toast]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      setLocation("/");
    }
  };

  const handleSelectVariation = async (index: number) => {
    if (!supabase || !generationId) return;
    
    setIsSelecting(true);
    try {
      const { error } = await supabase
        .from('menu_generations')
        .update({ selected_variation: index })
        .eq('id', generationId);

      if (error) throw error;
      setSelectedVariation(index);
      toast({
        title: "Design Selected",
        description: `You've selected design variation ${index + 1}`,
      });
    } catch (error: any) {
      toast({
        title: "Selection Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSelecting(false);
    }
  };

  const handleDownload = async (index: number) => {
    if (!canDownload) {
      toast({
        title: "Subscription Required",
        description: "Please subscribe to download your menu designs",
        variant: "destructive",
      });
      return;
    }

    if (!generation?.html_variations?.[index]) {
      toast({
        title: "Error",
        description: "Design not found",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    try {
      const html = generation.html_variations[index];
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menu-design-${index + 1}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (supabase && generationId) {
        await supabase
          .from('menu_generations')
          .update({ is_downloaded: true })
          .eq('id', generationId);
      }

      toast({
        title: "Download Started",
        description: "Your menu design is downloading",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
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
            Please configure Supabase credentials to use this application.
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
  const htmlVariations = generation?.html_variations || [];

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

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-4xl font-semibold mb-2" data-testid="text-result-title">
            Your Menu Designs
          </h1>
          <p className="text-muted-foreground text-lg">
            {generation?.file_name || "Menu"} - Select your favorite design
          </p>
        </div>

        {generationLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your designs...</p>
            </div>
          </div>
        ) : htmlVariations.length === 0 ? (
          <Card className="p-12 text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Designs Still Generating</h3>
            <p className="text-muted-foreground mb-6">
              Your AI-powered menu designs are being created. This usually takes 30-60 seconds.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid gap-8 md:grid-cols-3 mb-8">
              {htmlVariations.map((html, index) => (
                <Card
                  key={index}
                  onClick={() => handleSelectVariation(index)}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(index);
                            }}
                            disabled={isDownloading}
                            data-testid={`button-download-${index}`}
                          >
                            {isDownloading ? (
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectVariation(index);
                        }}
                        disabled={isSelecting}
                        data-testid={`button-select-${index}`}
                      >
                        {isSelecting ? (
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
              <Link href="/dashboard">
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
