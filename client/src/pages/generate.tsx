import { useState, useEffect, useRef } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useCredits } from "@/hooks/useCredits";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Upload, FileText, LogOut, Loader2, X, Type, ChevronLeft, SkipForward, Check, Coins, Image, Copy, Lightbulb } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { SiGoogle } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const FORM_STATE_KEY = "claude_menu_form_state";
const PENDING_GENERATION_KEY = "claude_menu_pending_generation";

const THEME_PRESETS = [
  { id: "minimalism", name: "Minimalism", description: "Clean, simple, elegant" },
  { id: "scandinavian", name: "Scandinavian", description: "Light, airy, natural" },
  { id: "loft", name: "Loft / Industrial", description: "Raw, urban, modern" },
  { id: "neon", name: "Neon Retrowave", description: "Bold, vibrant, 80s style" },
  { id: "japanese", name: "Japanese Zen", description: "Peaceful, balanced, refined" },
  { id: "greek", name: "Greek Tavern", description: "Mediterranean, warm, rustic" },
  { id: "fine-dining", name: "Classic Fine Dining", description: "Luxurious, sophisticated" },
  { id: "eco", name: "Eco / Organic", description: "Green, sustainable, fresh" },
];

const COLOR_PALETTES = [
  { id: "natural", name: "Natural / Earthy", colors: ["#6B705C", "#A5A58D", "#B7B7A4"] },
  { id: "coffee", name: "Coffeehouse", colors: ["#4E3629", "#D9CAB3", "#F5ECE3"] },
  { id: "japanese-minimal", name: "Japanese Minimal", colors: ["#000000", "#F2F2F2", "#D72638"] },
  { id: "vintage-rose", name: "Vintage Rose", colors: ["#462255", "#E0B1CB", "#D4A5A5"] },
  { id: "ocean", name: "Ocean Breeze", colors: ["#003459", "#007EA7", "#E3F2FD"] },
];

const FONT_STYLES = [
  { id: "elegant", name: "Elegant & Thin", description: "Refined serif fonts with delicate strokes" },
  { id: "bold", name: "Bold & Strong", description: "Impactful sans-serif fonts with weight" },
  { id: "handwritten", name: "Handwritten", description: "Personal, artisanal script fonts" },
  { id: "modern", name: "Modern Geometric", description: "Clean, contemporary sans-serif" },
  { id: "retro", name: "Retro Signage", description: "Vintage-inspired display fonts" },
];

const LAYOUT_OPTIONS = [
  { id: "single", name: "Single Column", description: "Clean minimalist layout, easy to read" },
  { id: "two-column", name: "Two Columns", description: "Compact and easy to scan" },
  { id: "card-grid", name: "Card Grid", description: "Great for menus with images" },
];

const MENU_SIZES = ["a4", "letter", "a5", "half-letter"] as const;

const SIMILARITY_LABELS = [
  { value: 0, label: "Just inspired", description: "Use reference for inspiration only" },
  { value: 25, label: "Loosely similar", description: "Similar style, different layout" },
  { value: 50, label: "Moderately similar", description: "Similar style and structure" },
  { value: 75, label: "Closely matched", description: "Very similar design approach" },
  { value: 100, label: "Near replica", description: "Match as closely as possible" },
];

type WizardStep = "content" | "name" | "slogan" | "theme" | "colors" | "fonts" | "layout" | "size" | "reference" | "description";

const STEPS: WizardStep[] = ["content", "name", "slogan", "theme", "colors", "fonts", "layout", "size", "reference", "description"];

interface FormState {
  inputMethod: "file" | "text";
  extractedText: string;
  manualText: string;
  fileName: string | null;
  restaurantName: string;
  slogan: string;
  selectedThemes: string[];
  customThemeDescription: string;
  selectedPalette: string;
  customColors: string[];
  selectedFont: string;
  selectedLayout: string;
  size: string;
  referenceImageBase64: string | null;
  referenceImageName: string | null;
  similarityLevel: number;
  generalDescription: string;
}

export default function Generate() {
  const { toast } = useToast();
  const { user, profile, session, isAuthenticated, isLoading, signOut, signInWithGoogle } = useSupabaseAuth();
  const { hasActivated, menuCredits, paymentRequired } = useCredits();
  const [, setLocation] = useLocation();
  const hasTriggeredAutoGenerate = useRef(false);

  const [currentStep, setCurrentStep] = useState<WizardStep>("content");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  const [inputMethod, setInputMethod] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [manualText, setManualText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const [restaurantName, setRestaurantName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [customThemeDescription, setCustomThemeDescription] = useState("");
  const [selectedPalette, setSelectedPalette] = useState<string>("");
  const [customColors, setCustomColors] = useState<string[]>(["#1e40af", "#dc2626", "#16a34a"]);
  const [selectedFont, setSelectedFont] = useState<string>("");
  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [size, setSize] = useState("a4");
  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
  const [referenceImageName, setReferenceImageName] = useState<string | null>(null);
  const [similarityLevel, setSimilarityLevel] = useState(50);
  const [generalDescription, setGeneralDescription] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);

  // Restore form state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(FORM_STATE_KEY);
      if (savedState) {
        const state: FormState = JSON.parse(savedState);
        setInputMethod(state.inputMethod);
        setExtractedText(state.extractedText);
        setManualText(state.manualText);
        setRestaurantName(state.restaurantName);
        setSlogan(state.slogan);
        setSelectedThemes(state.selectedThemes);
        setCustomThemeDescription(state.customThemeDescription);
        setSelectedPalette(state.selectedPalette);
        setCustomColors(state.customColors);
        setSelectedFont(state.selectedFont);
        setSelectedLayout(state.selectedLayout);
        setSize(state.size);
        setReferenceImageBase64(state.referenceImageBase64 || null);
        setReferenceImageName(state.referenceImageName || null);
        setSimilarityLevel(state.similarityLevel ?? 50);
        setGeneralDescription(state.generalDescription);
        
        // If we have a pending generation, go to final step
        const pendingGeneration = localStorage.getItem(PENDING_GENERATION_KEY);
        if (pendingGeneration === "true") {
          setCurrentStep("description");
        }
      }
    } catch (error) {
      console.error("Error restoring form state:", error);
    }
  }, []);

  // Auto-generate when user authenticates after requesting generation
  useEffect(() => {
    const pendingGeneration = localStorage.getItem(PENDING_GENERATION_KEY);
    
    if (
      pendingGeneration === "true" && 
      isAuthenticated && 
      !isLoading && 
      session && 
      user &&
      !hasTriggeredAutoGenerate.current &&
      !isGenerating
    ) {
      hasTriggeredAutoGenerate.current = true;
      // Don't clear pending flag here - it will be cleared after successful generation
      // This way if generation fails, user can retry
      handleGenerate();
    }
  }, [isAuthenticated, isLoading, session, user]);

  // Save form state to localStorage
  const saveFormState = () => {
    const state: FormState = {
      inputMethod,
      extractedText,
      manualText,
      fileName: file?.name || null,
      restaurantName,
      slogan,
      selectedThemes,
      customThemeDescription,
      selectedPalette,
      customColors,
      selectedFont,
      selectedLayout,
      size,
      referenceImageBase64,
      referenceImageName,
      similarityLevel,
      generalDescription,
    };
    localStorage.setItem(FORM_STATE_KEY, JSON.stringify(state));
  };

  // Clear saved form state
  const clearFormState = () => {
    localStorage.removeItem(FORM_STATE_KEY);
    localStorage.removeItem(PENDING_GENERATION_KEY);
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: "Could not sign in with Google. Please try again.",
        variant: "destructive",
      });
      setIsSigningIn(false);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.txt')) {
      return await file.text();
    }
    
    if (fileName.endsWith('.pdf') || fileName.endsWith('.docx')) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/extract-text', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to extract text');
        }
        
        const data = await response.json();
        return data.text;
      } catch (error) {
        throw new Error('Could not extract text. Please try pasting the text directly.');
      }
    }
    
    throw new Error('Unsupported file type. Please use PDF, DOCX, or TXT files.');
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setIsUploading(true);

      try {
        const text = await extractTextFromFile(selectedFile);
        setExtractedText(text);
        toast({
          title: "Success",
          description: "File uploaded and text extracted",
        });
      } catch (error: any) {
        toast({
          title: "Upload Failed",
          description: error.message,
          variant: "destructive",
        });
        setFile(null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const getMenuText = () => {
    return inputMethod === "file" ? extractedText : manualText;
  };

  const getCurrentColors = () => {
    if (selectedPalette === "custom") {
      return customColors;
    }
    const palette = COLOR_PALETTES.find(p => p.id === selectedPalette);
    return palette?.colors || ["#1e40af", "#dc2626", "#16a34a"];
  };

  const getStylePrompt = () => {
    const parts: string[] = [];
    
    if (restaurantName) {
      parts.push(`Restaurant name: "${restaurantName}"`);
    }
    if (slogan) {
      parts.push(`Slogan: "${slogan}"`);
    }
    
    if (selectedThemes.length > 0) {
      const themeNames = selectedThemes.map(id => {
        const theme = THEME_PRESETS.find(t => t.id === id);
        return theme ? `${theme.name} - ${theme.description}` : id;
      });
      parts.push(`Visual themes: ${themeNames.join(", ")}`);
    }
    
    if (customThemeDescription) {
      parts.push(`Custom style: ${customThemeDescription}`);
    }
    
    if (selectedFont) {
      const font = FONT_STYLES.find(f => f.id === selectedFont);
      if (font) {
        parts.push(`Font style: ${font.name} - ${font.description}`);
      }
    }
    
    if (selectedLayout) {
      const layout = LAYOUT_OPTIONS.find(l => l.id === selectedLayout);
      if (layout) {
        parts.push(`Layout: ${layout.name} - ${layout.description}`);
      }
    }
    
    if (generalDescription) {
      parts.push(`Additional requirements: ${generalDescription}`);
    }
    
    return parts.join(". ");
  };

  const currentStepIndex = STEPS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const canProceed = () => {
    if (currentStep === "content") {
      return getMenuText().trim().length > 0;
    }
    return true;
  };

  const canSkip = () => {
    return currentStep !== "content";
  };

  const goNext = () => {
    if (isLastStep) return;
    setCurrentStep(STEPS[currentStepIndex + 1]);
  };

  const goBack = () => {
    if (isFirstStep) return;
    setCurrentStep(STEPS[currentStepIndex - 1]);
  };

  const handleSkip = () => {
    if (!canSkip()) return;
    
    switch (currentStep) {
      case "name":
        setRestaurantName("");
        break;
      case "slogan":
        setSlogan("");
        break;
      case "theme":
        setSelectedThemes([]);
        setCustomThemeDescription("");
        break;
      case "colors":
        setSelectedPalette("");
        break;
      case "fonts":
        setSelectedFont("");
        break;
      case "layout":
        setSelectedLayout("");
        break;
      case "size":
        setSize("a4");
        break;
      case "reference":
        setReferenceImageBase64(null);
        setReferenceImageName(null);
        setSimilarityLevel(50);
        break;
      case "description":
        setGeneralDescription("");
        break;
    }
    goNext();
  };

  const toggleTheme = (themeId: string) => {
    setSelectedThemes(prev => {
      if (prev.includes(themeId)) {
        return prev.filter(id => id !== themeId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, themeId];
    });
  };

  const handleGenerateClick = () => {
    if (!isAuthenticated) {
      // Save form state before login
      saveFormState();
      localStorage.setItem(PENDING_GENERATION_KEY, "true");
      setShowLoginDialog(true);
      return;
    }
    handleGenerate();
  };

  const handleGenerate = async () => {
    const menuText = getMenuText();
    
    if (!menuText.trim()) {
      toast({
        title: "No Content",
        description: "Please add your menu content first",
        variant: "destructive",
      });
      return;
    }

    if (!isSupabaseConfigured || !supabase || !user || !session) {
      toast({
        title: "Error",
        description: "Please sign in to generate menus",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setShowLoginDialog(false);

    try {
      const colors = getCurrentColors();
      const stylePrompt = getStylePrompt();

      const { data: generation, error: insertError } = await supabase
        .from('menu_generations')
        .insert({
          user_id: user.id,
          file_name: file?.name || "menu.txt",
          extracted_text: menuText,
          colors,
          size,
          style_prompt: stylePrompt,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          generationId: generation.id,
          menuText,
          colors,
          size,
          stylePrompt,
          restaurantName: restaurantName || null,
          slogan: slogan || null,
          themes: selectedThemes.length > 0 ? selectedThemes : null,
          customThemeDescription: customThemeDescription || null,
          fontStyle: selectedFont || null,
          layout: selectedLayout || null,
          generalDescription: generalDescription || null,
          referenceImage: referenceImageBase64 || null,
          similarityLevel: referenceImageBase64 ? similarityLevel : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate menu designs');
      }

      const data = await response.json();

      if (data.htmlVariations) {
        const { error: updateError } = await supabase
          .from('menu_generations')
          .update({ html_variations: data.htmlVariations })
          .eq('id', generation.id);

        if (updateError) {
          console.error('Error saving designs:', updateError);
        }
      }

      // Clear saved form state after successful generation
      clearFormState();
      
      // Show warning toast if reference image was skipped
      if (data.warning) {
        toast({
          title: "Generated with Note",
          description: data.warning,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: "Your menu design is ready!",
        });
      }
      setLocation(`/dashboard/${generation.id}`);
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Show full-screen generating state
  if (isGenerating) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src="/logo.png" alt="Menu Craft" className="h-10 w-10 object-contain" />
            <span className="text-2xl font-semibold tracking-tight">Menu Craft</span>
          </div>
          
          <div className="relative mb-8">
            <div className="animate-spin w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-semibold mb-3">Creating Your Menu</h2>
          <p className="text-muted-foreground mb-2">
            Our AI is designing a beautiful, professional menu just for you.
          </p>
          <p className="text-sm text-muted-foreground">
            This usually takes about 20-30 seconds...
          </p>
        </div>
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

  const userName = profile?.name || user?.user_metadata?.full_name || user?.email;
  const userAvatar = profile?.avatar_url || user?.user_metadata?.avatar_url;

  const renderStepContent = () => {
    switch (currentStep) {
      case "content":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Add Your Menu Content</h2>
            <p className="text-muted-foreground">Upload a file or paste your menu text with all dishes and prices</p>
            
            <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as "file" | "text")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="file" data-testid="tab-file-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="text" data-testid="tab-paste-text">
                  <Type className="h-4 w-4 mr-2" />
                  Paste Text
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="file">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  data-testid="dropzone-file-upload"
                >
                  <input {...getInputProps()} />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-12 w-12 text-primary animate-spin" />
                      <p className="text-muted-foreground">Extracting text...</p>
                    </div>
                  ) : file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-12 w-12 text-primary" />
                      <p className="font-medium">{file.name}</p>
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        Text extracted successfully
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setExtractedText("");
                        }}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {isDragActive ? "Drop your file here" : "Drag & drop your menu file, or click to browse"}
                      </p>
                      <p className="text-sm text-muted-foreground">Supports PDF, DOCX, and TXT files</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="text">
                <Textarea
                  placeholder="APPETIZERS&#10;&#10;Bruschetta - $8&#10;Fresh tomatoes, basil, garlic on toasted bread&#10;&#10;MAIN COURSES&#10;&#10;Grilled Salmon - $24&#10;Atlantic salmon with lemon butter sauce&#10;..."
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  className="min-h-64 font-mono text-sm"
                  data-testid="textarea-menu-content"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {manualText.length} characters
                </p>
              </TabsContent>
            </Tabs>
          </div>
        );

      case "name":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Restaurant Name</h2>
            <p className="text-muted-foreground">This will appear prominently on your menu</p>
            <Input
              placeholder="e.g., The Golden Fork, Bella Italia, Sakura Garden..."
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="text-lg py-6"
              data-testid="input-restaurant-name"
            />
          </div>
        );

      case "slogan":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Slogan or Tagline</h2>
            <p className="text-muted-foreground">A catchy phrase that represents your restaurant</p>
            <Input
              placeholder="e.g., Where Every Meal Tells a Story..."
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              className="text-lg py-6"
              data-testid="input-slogan"
            />
          </div>
        );

      case "theme":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Visual Theme</h2>
              <p className="text-muted-foreground">Select up to 3 themes that match your restaurant's atmosphere</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEME_PRESETS.map((theme) => {
                const isSelected = selectedThemes.includes(theme.id);
                const isDisabled = !isSelected && selectedThemes.length >= 3;
                
                return (
                  <button
                    key={theme.id}
                    onClick={() => toggleTheme(theme.id)}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isSelected 
                        ? "border-primary bg-primary/10" 
                        : isDisabled 
                          ? "border-border opacity-50 cursor-not-allowed"
                          : "border-border hover-elevate"
                    }`}
                    data-testid={`theme-${theme.id}`}
                  >
                    <div className="font-medium text-sm">{theme.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{theme.description}</div>
                    {isSelected && (
                      <div className="mt-2">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {selectedThemes.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedThemes.length}/3 themes selected
              </p>
            )}
            
            <div className="pt-4 border-t">
              <Label className="text-base font-medium">Add your own style description</Label>
              <Textarea
                placeholder="Describe additional style elements... e.g., Rustic farmhouse touches, vintage botanical illustrations, gold foil accents..."
                value={customThemeDescription}
                onChange={(e) => setCustomThemeDescription(e.target.value)}
                className="mt-2 min-h-20"
                data-testid="textarea-custom-theme"
              />
            </div>
          </div>
        );

      case "colors":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Color Palette</h2>
              <p className="text-muted-foreground">Choose the colors for your menu design</p>
            </div>
            
            <div className="space-y-3">
              {COLOR_PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  onClick={() => setSelectedPalette(palette.id)}
                  className={`w-full p-4 rounded-lg border-2 flex items-center gap-4 transition-all hover-elevate ${
                    selectedPalette === palette.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`palette-${palette.id}`}
                >
                  <span className="font-medium flex-1 text-left">{palette.name}</span>
                  <div className="flex gap-2">
                    {palette.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-md border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="pt-4 border-t">
              <button
                onClick={() => setSelectedPalette("custom")}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedPalette === "custom" ? "border-primary bg-primary/5" : "border-border"
                }`}
                data-testid="palette-custom"
              >
                <div className="font-medium">Custom Colors</div>
                <div className="text-sm text-muted-foreground">Pick your own color palette</div>
              </button>
              
              {selectedPalette === "custom" && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Click on a color to change it, or enter HEX codes directly
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {customColors.map((color, index) => (
                      <div key={index} className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Color {index + 1}
                        </Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                              const newColors = [...customColors];
                              newColors[index] = e.target.value;
                              setCustomColors(newColors);
                            }}
                            className="w-12 h-12 rounded-lg border-2 cursor-pointer"
                            data-testid={`color-picker-${index}`}
                          />
                          <Input
                            value={color}
                            onChange={(e) => {
                              const newColors = [...customColors];
                              newColors[index] = e.target.value;
                              setCustomColors(newColors);
                            }}
                            className="font-mono text-sm uppercase"
                            placeholder="#000000"
                            data-testid={`color-input-${index}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case "fonts":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Font Style</h2>
              <p className="text-muted-foreground">Select the typography feel for your menu</p>
            </div>
            
            <div className="space-y-3">
              {FONT_STYLES.map((font) => (
                <button
                  key={font.id}
                  onClick={() => setSelectedFont(font.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
                    selectedFont === font.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`font-${font.id}`}
                >
                  <div className="font-medium">{font.name}</div>
                  <div className="text-sm text-muted-foreground">{font.description}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case "layout":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Page Layout</h2>
              <p className="text-muted-foreground">How should your menu be organized?</p>
            </div>
            
            <div className="space-y-3">
              {LAYOUT_OPTIONS.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setSelectedLayout(layout.id)}
                  className={`w-full p-6 rounded-lg border-2 text-left transition-all hover-elevate ${
                    selectedLayout === layout.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`layout-${layout.id}`}
                >
                  <div className="font-medium text-lg">{layout.name}</div>
                  <div className="text-muted-foreground">{layout.description}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case "size":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Menu Size</h2>
              <p className="text-muted-foreground">Choose the paper size for your printed menu</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {MENU_SIZES.map((sizeOption) => (
                <button
                  key={sizeOption}
                  onClick={() => setSize(sizeOption)}
                  className={`p-6 rounded-lg border-2 text-center transition-all hover-elevate ${
                    size === sizeOption ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`size-${sizeOption}`}
                >
                  <div className="font-medium text-lg">{sizeOption.toUpperCase()}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case "reference":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Reference Menu (Optional)</h2>
              <p className="text-muted-foreground">Upload an image of a menu you like as inspiration for your design</p>
            </div>
            
            {!referenceImageBase64 ? (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                      if (!supportedTypes.includes(file.type)) {
                        toast({
                          title: "Unsupported image format",
                          description: "Please upload a JPG, PNG, GIF, or WebP image",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        toast({
                          title: "File too large",
                          description: "Please upload an image smaller than 5MB",
                          variant: "destructive",
                        });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = reader.result as string;
                        setReferenceImageBase64(base64);
                        setReferenceImageName(file.name);
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                data-testid="upload-reference-image"
              >
                <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium">Click to upload a reference menu image</p>
                <p className="text-sm text-muted-foreground mt-2">JPG, PNG, GIF, or WebP up to 5MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border rounded-lg overflow-hidden bg-muted/20">
                  <img 
                    src={referenceImageBase64} 
                    alt="Reference menu" 
                    className="w-full max-h-64 object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setReferenceImageBase64(null);
                      setReferenceImageName(null);
                    }}
                    data-testid="button-remove-reference"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">{referenceImageName}</p>
                
                <div className="space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Similarity Level</Label>
                    <span className="text-sm font-medium text-primary">
                      {SIMILARITY_LABELS.find(s => {
                        const labels = SIMILARITY_LABELS.map(l => l.value);
                        const closest = labels.reduce((prev, curr) => 
                          Math.abs(curr - similarityLevel) < Math.abs(prev - similarityLevel) ? curr : prev
                        );
                        return s.value === closest;
                      })?.label}
                    </span>
                  </div>
                  
                  <div className="px-1">
                    <Slider
                      value={[similarityLevel]}
                      onValueChange={(values) => setSimilarityLevel(values[0])}
                      min={0}
                      max={100}
                      step={25}
                      className="w-full"
                      data-testid="slider-similarity"
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <div className="flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      <span>Inspired</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Copy className="h-3 w-3" />
                      <span>Replica</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground text-center">
                    {SIMILARITY_LABELS.find(s => {
                      const labels = SIMILARITY_LABELS.map(l => l.value);
                      const closest = labels.reduce((prev, curr) => 
                        Math.abs(curr - similarityLevel) < Math.abs(prev - similarityLevel) ? curr : prev
                      );
                      return s.value === closest;
                    })?.description}
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case "description":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Any Additional Requests?</h2>
              <p className="text-muted-foreground">Describe anything else you'd like to see in your menu design</p>
            </div>
            
            <Textarea
              placeholder="e.g., Include decorative borders, add space for a QR code, highlight vegetarian options with a leaf icon, make prices aligned to the right..."
              value={generalDescription}
              onChange={(e) => setGeneralDescription(e.target.value)}
              className="min-h-32"
              data-testid="textarea-general-description"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Menu Craft" className="h-8 w-8 object-contain" />
              <span className="text-xl font-semibold tracking-tight">Menu Craft</span>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <Button variant="ghost" data-testid="button-dashboard">
                      Dashboard
                    </Button>
                  </Link>
                  <ThemeToggle />
                  
                  {/* Credits display */}
                  {paymentRequired && (
                    <div className="flex items-center">
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
                </>
              ) : (
                <>
                  <ThemeToggle />
                  <Button
                    variant="outline"
                    onClick={() => setShowLoginDialog(true)}
                    data-testid="button-signin"
                  >
                    Sign In
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <Card className="p-8">
          {renderStepContent()}
        </Card>

        <div className="flex justify-between items-center mt-8 gap-4">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={isFirstStep}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex gap-3">
            {canSkip() && !isLastStep && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                data-testid="button-skip"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
            )}
            
            {isLastStep ? (
              <Button
                size="lg"
                onClick={handleGenerateClick}
                disabled={!canProceed() || isGenerating}
                data-testid="button-generate"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Menu
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={!canProceed()}
                data-testid="button-next"
              >
                Next
              </Button>
            )}
          </div>
        </div>
        
        {isLastStep && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isAuthenticated 
              ? "Generate your professional menu design" 
              : "Sign in to generate your first menu for free"}
          </p>
        )}
      </div>

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in to continue</DialogTitle>
            <DialogDescription>
              Create your free account to generate your first menu design
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full"
              data-testid="button-google-signin"
            >
              {isSigningIn ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <SiGoogle className="h-5 w-5 mr-2" />
              )}
              Continue with Google
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
