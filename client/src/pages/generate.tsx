import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Upload, FileText, LogOut, Loader2, X, Type, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { HexColorPicker } from "react-colorful";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const THEME_PRESETS = [
  { id: "minimalism", name: "Minimalism", icon: "✨", description: "Clean, simple, elegant" },
  { id: "scandinavian", name: "Scandinavian", icon: "🌿", description: "Light, airy, natural" },
  { id: "loft", name: "Loft / Industrial", icon: "🏭", description: "Raw, urban, modern" },
  { id: "neon", name: "Neon Retrowave", icon: "🎮", description: "Bold, vibrant, 80s style" },
  { id: "japanese", name: "Japanese Zen", icon: "🎋", description: "Peaceful, balanced, refined" },
  { id: "greek", name: "Greek Tavern", icon: "🏛️", description: "Mediterranean, warm, rustic" },
  { id: "fine-dining", name: "Classic Fine Dining", icon: "🍷", description: "Luxurious, sophisticated" },
  { id: "eco", name: "Eco / Organic", icon: "🌱", description: "Green, sustainable, fresh" },
];

const COLOR_PALETTES = [
  { id: "natural", name: "Natural / Earthy", icon: "🍃", colors: ["#6B705C", "#A5A58D", "#B7B7A4"] },
  { id: "coffee", name: "Coffeehouse", icon: "☕", colors: ["#4E3629", "#D9CAB3", "#F5ECE3"] },
  { id: "japanese-minimal", name: "Japanese Minimal", icon: "🍣", colors: ["#000000", "#F2F2F2", "#D72638"] },
  { id: "vintage-rose", name: "Vintage Rose", icon: "🍇", colors: ["#462255", "#E0B1CB", "#D4A5A5"] },
  { id: "ocean", name: "Ocean Breeze", icon: "🌊", colors: ["#003459", "#007EA7", "#E3F2FD"] },
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

type WizardStep = "content" | "name" | "slogan" | "theme" | "colors" | "fonts" | "layout" | "size";

const STEPS: WizardStep[] = ["content", "name", "slogan", "theme", "colors", "fonts", "layout", "size"];

export default function Generate() {
  const { toast } = useToast();
  const { user, profile, session, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  const [currentStep, setCurrentStep] = useState<WizardStep>("content");
  
  const [inputMethod, setInputMethod] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [manualText, setManualText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const [restaurantName, setRestaurantName] = useState("");
  const [wantSlogan, setWantSlogan] = useState<"yes" | "no" | null>(null);
  const [slogan, setSlogan] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [customTheme, setCustomTheme] = useState("");
  const [selectedPalette, setSelectedPalette] = useState<string>("");
  const [customColors, setCustomColors] = useState<string[]>(["#1e40af", "#dc2626", "#16a34a"]);
  const [customColorIndex, setCustomColorIndex] = useState<number | null>(null);
  const [selectedFont, setSelectedFont] = useState<string>("");
  const [customFont, setCustomFont] = useState("");
  const [selectedLayout, setSelectedLayout] = useState<string>("");
  const [size, setSize] = useState("a4");
  
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      setLocation("/");
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
          description: "File uploaded and text extracted successfully",
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
    return palette?.colors || customColors;
  };

  const getStylePrompt = () => {
    const parts: string[] = [];
    
    if (restaurantName) {
      parts.push(`Restaurant name: "${restaurantName}"`);
    }
    if (wantSlogan === "yes" && slogan) {
      parts.push(`Slogan: "${slogan}"`);
    }
    
    if (selectedTheme === "custom" && customTheme) {
      parts.push(`Theme/Style: ${customTheme}`);
    } else if (selectedTheme) {
      const theme = THEME_PRESETS.find(t => t.id === selectedTheme);
      if (theme) {
        parts.push(`Theme: ${theme.name} - ${theme.description}`);
      }
    }
    
    if (selectedFont === "custom" && customFont) {
      parts.push(`Font style: ${customFont}`);
    } else if (selectedFont) {
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
    
    return parts.join(". ");
  };

  const currentStepIndex = STEPS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const canProceed = () => {
    switch (currentStep) {
      case "content":
        return getMenuText().trim().length > 0;
      case "name":
        return restaurantName.trim().length > 0;
      case "slogan":
        return wantSlogan !== null && (wantSlogan === "no" || slogan.trim().length > 0);
      case "theme":
        return selectedTheme !== "" && (selectedTheme !== "custom" || customTheme.trim().length > 0);
      case "colors":
        return selectedPalette !== "";
      case "fonts":
        return selectedFont !== "" && (selectedFont !== "custom" || customFont.trim().length > 0);
      case "layout":
        return selectedLayout !== "";
      case "size":
        return size !== "";
      default:
        return false;
    }
  };

  const goNext = () => {
    if (isLastStep) return;
    setCurrentStep(STEPS[currentStepIndex + 1]);
  };

  const goBack = () => {
    if (isFirstStep) return;
    setCurrentStep(STEPS[currentStepIndex - 1]);
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
          restaurantName,
          slogan: wantSlogan === "yes" ? slogan : null,
          theme: selectedTheme === "custom" ? customTheme : selectedTheme,
          fontStyle: selectedFont === "custom" ? customFont : selectedFont,
          layout: selectedLayout,
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

      toast({
        title: "Success",
        description: "Your menu designs are ready!",
      });
      setLocation(`/result/${generation.id}`);
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
                {extractedText && (
                  <div className="mt-4">
                    <Label>Extracted Text Preview</Label>
                    <div className="mt-2 p-4 bg-muted rounded-lg max-h-40 overflow-y-auto">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {extractedText.substring(0, 500)}{extractedText.length > 500 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                )}
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
            <h2 className="text-2xl font-semibold">What is the name of your restaurant?</h2>
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
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Would you like to add a slogan or tagline?</h2>
            <p className="text-muted-foreground">A catchy phrase that represents your restaurant</p>
            
            <RadioGroup value={wantSlogan || ""} onValueChange={(v) => setWantSlogan(v as "yes" | "no")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="slogan-yes" />
                <Label htmlFor="slogan-yes" className="text-base cursor-pointer">Yes, I want to add a slogan</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="slogan-no" />
                <Label htmlFor="slogan-no" className="text-base cursor-pointer">No, skip this step</Label>
              </div>
            </RadioGroup>
            
            {wantSlogan === "yes" && (
              <Input
                placeholder="e.g., Where Every Meal Tells a Story..."
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                className="text-lg py-6"
                data-testid="input-slogan"
              />
            )}
          </div>
        );

      case "theme":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Choose Your Visual Theme</h2>
            <p className="text-muted-foreground">Select a style that matches your restaurant's atmosphere</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEME_PRESETS.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
                    selectedTheme === theme.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`theme-${theme.id}`}
                >
                  <div className="text-2xl mb-2">{theme.icon}</div>
                  <div className="font-medium text-sm">{theme.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{theme.description}</div>
                </button>
              ))}
            </div>
            
            <div className="pt-4 border-t">
              <button
                onClick={() => setSelectedTheme("custom")}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedTheme === "custom" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="font-medium">Custom Theme</div>
                <div className="text-sm text-muted-foreground">Describe your own style</div>
              </button>
              {selectedTheme === "custom" && (
                <Textarea
                  placeholder="Describe your desired theme... e.g., Rustic farmhouse with warm wood tones and vintage touches"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  className="mt-3 min-h-24"
                  data-testid="textarea-custom-theme"
                />
              )}
            </div>
          </div>
        );

      case "colors":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Choose Your Color Palette</h2>
            <p className="text-muted-foreground">Select 3 primary colors for your menu design</p>
            
            <div className="space-y-4">
              {COLOR_PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  onClick={() => setSelectedPalette(palette.id)}
                  className={`w-full p-4 rounded-lg border-2 flex items-center gap-4 transition-all hover-elevate ${
                    selectedPalette === palette.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`palette-${palette.id}`}
                >
                  <span className="text-2xl">{palette.icon}</span>
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
              >
                <div className="font-medium">Custom Colors</div>
                <div className="text-sm text-muted-foreground">Enter your own HEX color codes</div>
              </button>
              {selectedPalette === "custom" && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {customColors.map((color, index) => (
                    <div key={index} className="relative">
                      <button
                        onClick={() => setCustomColorIndex(customColorIndex === index ? null : index)}
                        className="w-full aspect-square rounded-lg border-2 transition-all hover:scale-105"
                        style={{ backgroundColor: color, borderColor: customColorIndex === index ? 'var(--primary)' : 'transparent' }}
                        data-testid={`custom-color-${index}`}
                      />
                      <Input
                        value={color}
                        onChange={(e) => {
                          const newColors = [...customColors];
                          newColors[index] = e.target.value;
                          setCustomColors(newColors);
                        }}
                        className="mt-2 text-center text-sm font-mono"
                        placeholder="#000000"
                      />
                      {customColorIndex === index && (
                        <div className="absolute top-full left-0 mt-2 z-10 p-3 bg-background border rounded-lg shadow-lg">
                          <HexColorPicker 
                            color={color} 
                            onChange={(newColor) => {
                              const newColors = [...customColors];
                              newColors[index] = newColor;
                              setCustomColors(newColors);
                            }} 
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "fonts":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Choose Your Font Style</h2>
            <p className="text-muted-foreground">Select the typography feel for your menu</p>
            
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
            
            <div className="pt-4 border-t">
              <button
                onClick={() => setSelectedFont("custom")}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectedFont === "custom" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="font-medium">Custom Font Style</div>
                <div className="text-sm text-muted-foreground">Describe your own typography preferences</div>
              </button>
              {selectedFont === "custom" && (
                <Textarea
                  placeholder="Describe your font preferences... e.g., Elegant calligraphy for headings with clean sans-serif for body text"
                  value={customFont}
                  onChange={(e) => setCustomFont(e.target.value)}
                  className="mt-3 min-h-20"
                  data-testid="textarea-custom-font"
                />
              )}
            </div>
          </div>
        );

      case "layout":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Choose Your Page Layout</h2>
            <p className="text-muted-foreground">How should your menu be organized?</p>
            
            <div className="grid gap-4">
              {LAYOUT_OPTIONS.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setSelectedLayout(layout.id)}
                  className={`p-6 rounded-lg border-2 text-left transition-all hover-elevate ${
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
            <h2 className="text-2xl font-semibold">Select Menu Size</h2>
            <p className="text-muted-foreground">Choose the paper size for your printed menu</p>
            
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

      default:
        return null;
    }
  };

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

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            {STEPS.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index < currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : index === currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-6 h-0.5 mx-1 ${index < currentStepIndex ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Step {currentStepIndex + 1} of {STEPS.length}
          </p>
        </div>

        <Card className="p-8">
          {renderStepContent()}
        </Card>

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={isFirstStep}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          {isLastStep ? (
            <Button
              size="lg"
              onClick={handleGenerate}
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
                  Generate Menu Designs
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
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
        
        {isLastStep && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Generation is free! You'll get 3 unique design variations.
          </p>
        )}
      </div>
    </div>
  );
}
