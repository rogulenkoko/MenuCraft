import { useEffect, useState, useRef, useCallback } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useCredits } from "@/hooks/useCredits";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Sparkles, 
  FileText, 
  LogOut, 
  Plus, 
  Download, 
  Save, 
  RotateCcw,
  Loader2,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Coins,
  Menu,
  X
} from "lucide-react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { supabase, MenuGeneration, isSupabaseConfigured } from "@/lib/supabase";
import { format } from "date-fns";

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

export default function Dashboard() {
  const { toast } = useToast();
  const { user, profile, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const { hasActivated, menuCredits, paymentRequired, canDownload, refreshCredits, isLoading: creditsLoading } = useCredits();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const search = useSearch();
  const successToastShown = useRef(false);

  const [generations, setGenerations] = useState<MenuGeneration[]>([]);
  const [generationsLoading, setGenerationsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(params.id || null);
  const [editedHtml, setEditedHtml] = useState<string>("");
  const [originalHtml, setOriginalHtml] = useState<string>("");
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasInitializedIframe = useRef(false);
  const lastSavedHtmlRef = useRef<string>("");

  // Handle payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(search);
    const paymentParam = params.get('payment');
    const paymentType = params.get('type');
    const quantity = params.get('quantity');
    
    if (paymentParam === 'success' && !successToastShown.current) {
      successToastShown.current = true;
      
      if (paymentType === 'activation') {
        toast({
          title: "Activation Successful!",
          description: "Your account is now activated with 5 credits. You can start generating menus!",
        });
      } else if (paymentType === 'credits') {
        toast({
          title: "Credits Added!",
          description: `${quantity || 5} credits have been added to your account.`,
        });
      }
      
      refreshCredits();
      window.history.replaceState({}, '', '/dashboard');
    } else if (paymentParam === 'cancelled') {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. No charges were made.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [search, toast, refreshCredits]);

  // Redirect if not authenticated
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

  // Fetch all generations
  // IMPORTANT: Wait for creditsLoading to finish - this ensures profile exists before querying menu_generations
  useEffect(() => {
    async function fetchGenerations() {
      if (!isAuthenticated || !isSupabaseConfigured || !supabase || creditsLoading) {
        if (!creditsLoading && isAuthenticated) {
          setGenerationsLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('menu_generations')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const generationsList = data || [];
        setGenerations(generationsList);
        
        // If we have generations and no selected ID, select the most recent
        if (generationsList.length > 0 && !selectedId) {
          setSelectedId(generationsList[0].id);
        }
        
        // If no generations exist, redirect to generate page
        if (generationsList.length === 0) {
          toast({
            title: "No menus yet",
            description: "Create your first menu design",
          });
          setTimeout(() => setLocation("/"), 1000);
        }
      } catch (error) {
        console.error('Error fetching generations:', error);
      } finally {
        setGenerationsLoading(false);
      }
    }

    if (isAuthenticated && !creditsLoading) {
      fetchGenerations();
    }
  }, [isAuthenticated, creditsLoading, selectedId, toast, setLocation]);

  // Load selected generation HTML
  useEffect(() => {
    const selected = generations.find(g => g.id === selectedId);
    if (selected) {
      const html = selected.html_variations?.[0] || "";
      setEditedHtml(html);
      setOriginalHtml(html);
      lastSavedHtmlRef.current = html;
      hasInitializedIframe.current = false;
    }
  }, [selectedId, generations]);

  // Setup editable iframe - only runs once when HTML changes
  const setupEditableIframe = useCallback(() => {
    if (!iframeRef.current || !editedHtml || hasInitializedIframe.current) return;
    
    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    
    if (iframeDoc) {
      const sanitized = sanitizeHtml(editedHtml);
      iframeDoc.open();
      iframeDoc.write(sanitized);
      iframeDoc.close();

      // Make the body editable
      iframeDoc.body.contentEditable = "true";
      iframeDoc.body.style.cursor = "text";
      iframeDoc.body.style.outline = "none";
      
      // Add some basic styling for better editing experience
      const style = iframeDoc.createElement('style');
      style.textContent = `
        body { outline: none !important; }
        *:focus { outline: none !important; }
        [contenteditable]:focus { outline: none !important; }
      `;
      iframeDoc.head.appendChild(style);
      
      hasInitializedIframe.current = true;
    }
  }, [editedHtml]);

  // Initialize iframe when HTML is ready
  useEffect(() => {
    if (editedHtml && iframeRef.current && !hasInitializedIframe.current) {
      const timer = setTimeout(() => {
        setupEditableIframe();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [editedHtml, setupEditableIframe]);

  // Get current HTML from iframe without causing re-render
  const getCurrentHtmlFromIframe = useCallback(() => {
    if (!iframeRef.current) return editedHtml;
    
    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    
    if (iframeDoc) {
      return `<!DOCTYPE html><html>${iframeDoc.documentElement.innerHTML}</html>`;
    }
    return editedHtml;
  }, [editedHtml]);

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

  const handleSelectGeneration = (id: string) => {
    if (id !== selectedId) {
      setSelectedId(id);
      hasInitializedIframe.current = false;
      // Update URL without triggering navigation
      window.history.replaceState({}, '', `/dashboard/${id}`);
    }
    // Switch to editor view on mobile when a menu is selected
    setMobileView('editor');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  const handleSave = async () => {
    if (!supabase || !selectedId) return;
    
    setIsSaving(true);
    try {
      const currentHtml = getCurrentHtmlFromIframe();
      
      const { error } = await supabase
        .from('menu_generations')
        .update({ html_variations: [currentHtml] })
        .eq('id', selectedId);

      if (error) throw error;
      
      setOriginalHtml(currentHtml);
      setEditedHtml(currentHtml);
      lastSavedHtmlRef.current = currentHtml;
      
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
    hasInitializedIframe.current = false;
    toast({
      title: "Reset",
      description: "Menu content has been reset to last saved version",
    });
  };

  const handleDownloadPdf = async () => {
    // Redirect to subscribe if payment required and not activated
    if (paymentRequired && !canDownload) {
      setLocation('/subscribe');
      return;
    }
    
    setIsDownloading(true);
    
    try {
      const currentHtml = getCurrentHtmlFromIframe();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Could not open print window. Please allow popups.');
      }
      
      printWindow.document.write(currentHtml);
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
    // Redirect to subscribe if payment required and not activated
    if (paymentRequired && !canDownload) {
      setLocation('/subscribe');
      return;
    }
    
    try {
      const currentHtml = getCurrentHtmlFromIframe();
      const selected = generations.find(g => g.id === selectedId);
      
      const blob = new Blob([currentHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menu-${selected?.file_name || 'design'}.html`;
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
  const selectedGeneration = generations.find(g => g.id === selectedId);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background shrink-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <img src="/logo.png" alt="Menu Craft" className="h-8 w-8 object-contain" />
                <span className="text-xl font-semibold tracking-tight hidden sm:inline">Menu Craft</span>
              </div>
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" data-testid="button-new-menu">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">New Menu</span>
                </Button>
              </Link>
              <ThemeToggle />
              
              {/* Credits display */}
              {paymentRequired && (
                <div className="flex items-center gap-2">
                  {hasActivated ? (
                    <Link href="/subscribe">
                      <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-credits">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="font-medium">{menuCredits}</span>
                        <span className="text-muted-foreground hidden sm:inline">credits</span>
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/subscribe">
                      <Button size="sm" data-testid="button-activate-header">
                        Activate
                      </Button>
                    </Link>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {userAvatar && (
                  <img
                    src={userAvatar}
                    alt={userName || "User"}
                    className="h-8 w-8 rounded-full object-cover"
                    data-testid="img-user-avatar"
                  />
                )}
                <span className="text-sm font-medium hidden md:inline" data-testid="text-user-name">
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

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left sidebar - Menu list (hidden on mobile when viewing editor) */}
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-64 xl:w-80 border-r bg-muted/30 flex-col shrink-0 h-full`}>
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg" data-testid="text-my-menus-title">My Menus</h2>
            <p className="text-sm text-muted-foreground">{generations.length} menu{generations.length !== 1 ? 's' : ''}</p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2">
              {generationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : generations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No menus yet</p>
                  <Link href="/">
                    <Button variant="outline" size="sm" className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first menu
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {generations.map((generation) => (
                    <button
                      key={generation.id}
                      onClick={() => handleSelectGeneration(generation.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedId === generation.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted'
                      }`}
                      data-testid={`button-menu-${generation.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate" data-testid={`text-menu-name-${generation.id}`}>
                            {generation.file_name || 'Untitled Menu'}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {generation.created_at && format(new Date(generation.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 lg:hidden" />
                        {selectedId === generation.id && (
                          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5 hidden lg:block" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

        </div>

        {/* Right side - Menu editor (full width on mobile) */}
        <div className={`${mobileView === 'editor' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col overflow-hidden h-full`}>
          {/* Editor toolbar */}
          <div className="border-b bg-background shrink-0">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Back button for mobile */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToList}
                    className="lg:hidden shrink-0"
                    data-testid="button-back-to-list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0">
                    <h1 className="text-base sm:text-lg font-semibold truncate" data-testid="text-menu-title">
                      {selectedGeneration?.file_name || 'Select a menu'}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                      Click on text in the preview to edit
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Reset button - icon only on mobile */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleReset}
                        className="sm:hidden"
                        data-testid="button-reset-mobile"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset changes</p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="hidden sm:flex"
                    data-testid="button-reset"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  
                  {/* Save button - icon only on mobile */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="sm:hidden"
                        data-testid="button-save-mobile"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Save changes</p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="hidden sm:flex"
                    data-testid="button-save"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                  
                  {/* Download HTML button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadHtml}
                    className="hidden sm:flex"
                    data-testid="button-download-html"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    HTML
                  </Button>
                  
                  {/* Download PDF button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                        className="sm:hidden"
                        data-testid="button-download-pdf-mobile"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download as PDF</p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={isDownloading}
                    className="hidden sm:flex"
                    data-testid="button-download-pdf"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Menu preview/editor */}
          <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-4 bg-muted/20">
            <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col min-h-0">
              {generationsLoading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center">
                    <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading your menus...</p>
                  </div>
                </div>
              ) : !selectedId ? (
                <div className="flex items-center justify-center flex-1">
                  <Card className="p-6 sm:p-12 text-center">
                    <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-medium mb-2">Select a Menu</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-4">
                      <span className="hidden lg:inline">Choose a menu from the list to view and edit</span>
                      <span className="lg:hidden">Use the back button to see your menu list</span>
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleBackToList}
                      className="lg:hidden"
                      data-testid="button-view-menus"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      View My Menus
                    </Button>
                  </Card>
                </div>
              ) : !editedHtml ? (
                <div className="flex items-center justify-center flex-1">
                  <Card className="p-6 sm:p-12 text-center">
                    <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 text-primary animate-spin mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-medium mb-2">Loading Menu</h3>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      Please wait while we load your menu design...
                    </p>
                  </Card>
                </div>
              ) : (
                <Card className="overflow-hidden shadow-lg flex-1 flex flex-col min-h-0">
                  <div className="bg-white flex-1 flex flex-col min-h-0">
                    <iframe
                      ref={iframeRef}
                      className="w-full border-0 flex-1"
                      style={{ minHeight: '400px' }}
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
    </div>
  );
}
