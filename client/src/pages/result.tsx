import { useEffect, useState, useRef, useCallback } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Download, LogOut, Loader2, ArrowLeft, Save, RotateCcw } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { supabase, MenuGeneration, isSupabaseConfigured } from "@/lib/supabase";

function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  doc.querySelectorAll('script').forEach(el => el.remove());
  doc.querySelectorAll('[onclick], [onerror], [onload], [onmouseover]').forEach(el => {
    el.removeAttribute('onclick');
    el.removeAttribute('onerror');
    el.removeAttribute('onload');
    el.removeAttribute('onmouseover');
  });
  
  return doc.documentElement.outerHTML;
}

export default function Result() {
  const { toast } = useToast();
  const { user, profile, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const generationId = params.id;

  const [generation, setGeneration] = useState<MenuGeneration | null>(null);
  const [generationLoading, setGenerationLoading] = useState(true);
  const [editedHtml, setEditedHtml] = useState<string>("");
  const [originalHtml, setOriginalHtml] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
        
        const html = data.html_variations?.[0] || "";
        setEditedHtml(html);
        setOriginalHtml(html);
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

  const setupEditableIframe = useCallback((html: string) => {
    if (!iframeRef.current) return;
    
    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    
    if (iframeDoc) {
      const sanitized = sanitizeHtml(html);
      iframeDoc.open();
      iframeDoc.write(sanitized);
      iframeDoc.close();

      iframeDoc.body.contentEditable = "true";
      iframeDoc.body.style.cursor = "text";
      
      const handleInput = () => {
        const newHtml = `<!DOCTYPE html><html>${iframeDoc.documentElement.innerHTML}</html>`;
        setEditedHtml(newHtml);
      };

      iframeDoc.body.addEventListener('input', handleInput);
    }
  }, []);

  useEffect(() => {
    if (editedHtml && iframeRef.current) {
      const timer = setTimeout(() => {
        setupEditableIframe(editedHtml);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [iframeKey, editedHtml, setupEditableIframe]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      setLocation("/");
    }
  };

  const handleSave = async () => {
    if (!supabase || !generationId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('menu_generations')
        .update({ html_variations: [editedHtml] })
        .eq('id', generationId);

      if (error) throw error;
      
      setOriginalHtml(editedHtml);
      toast({
        title: "Saved",
        description: "Your menu changes have been saved",
      });
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setEditedHtml(originalHtml);
    setIframeKey(prev => prev + 1);
    toast({
      title: "Reset",
      description: "Menu content has been reset to original",
    });
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window. Please allow popups.');
      }
      
      printWindow.document.write(editedHtml);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
      
      toast({
        title: "Print Dialog Opened",
        description: "Select 'Save as PDF' in the print dialog to download your menu",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Could not generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadHtml = () => {
    try {
      const blob = new Blob([editedHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menu-${generation?.file_name || 'design'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Downloaded",
        description: "HTML file has been downloaded",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
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
  const hasChanges = editedHtml !== originalHtml;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background shrink-0">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
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
                <span className="text-sm font-medium hidden sm:inline">{userName}</span>
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b bg-muted/30 shrink-0">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" data-testid="button-back">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-xl font-semibold" data-testid="text-result-title">
                    Edit Your Menu
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Click on text to edit. Download as PDF when done.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {hasChanges && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    data-testid="button-reset"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  data-testid="button-save"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadHtml}
                  data-testid="button-download-html"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download HTML
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isDownloading}
                  data-testid="button-download-pdf"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Save as PDF
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl">
            {generationLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading your menu...</p>
                </div>
              </div>
            ) : !editedHtml ? (
              <Card className="p-12 text-center">
                <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-medium mb-2">Menu Still Generating</h3>
                <p className="text-muted-foreground mb-6">
                  Your AI-powered menu design is being created. This usually takes 30-60 seconds.
                </p>
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </Card>
            ) : (
              <Card className="overflow-hidden shadow-lg">
                <div className="bg-white">
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    className="w-full border-0"
                    style={{ minHeight: '800px', height: 'auto' }}
                    title="Menu Preview"
                    sandbox="allow-same-origin"
                    data-testid="iframe-menu-preview"
                  />
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
