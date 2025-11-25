import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Upload, FileText, LogOut, Loader2, X, Type } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { HexColorPicker } from "react-colorful";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";

const DEFAULT_COLORS = ["#1e40af", "#dc2626", "#16a34a", "#eab308"];
const MENU_SIZES = ["a4", "letter", "a5", "half-letter"] as const;

export default function Generate() {
  const { toast } = useToast();
  const { user, profile, session, isAuthenticated, isLoading, signOut, isSupabaseReady } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  const [inputMethod, setInputMethod] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [manualText, setManualText] = useState("");
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [customColorIndex, setCustomColorIndex] = useState<number | null>(null);
  const [size, setSize] = useState("a4");
  const [stylePrompt, setStylePrompt] = useState("");
  const [isUploading, setIsUploading] = useState(false);
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
    
    if (fileName.endsWith('.pdf')) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/extract-text', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to extract text from PDF');
        }
        
        const data = await response.json();
        return data.text;
      } catch (error) {
        throw new Error('Could not extract text from PDF. Please try pasting the text directly.');
      }
    }
    
    if (fileName.endsWith('.docx')) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/extract-text', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to extract text from DOCX');
        }
        
        const data = await response.json();
        return data.text;
      } catch (error) {
        throw new Error('Could not extract text from DOCX. Please try pasting the text directly.');
      }
    }
    
    throw new Error('Unsupported file type. Please use PDF, DOCX, or TXT files, or paste your menu text directly.');
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
          description: error.message || "Failed to extract text from file. Try pasting the text directly.",
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

  const updateColor = (index: number, newColor: string) => {
    const newColors = [...colors];
    newColors[index] = newColor;
    setColors(newColors);
  };

  const getMenuText = () => {
    return inputMethod === "file" ? extractedText : manualText;
  };

  const handleGenerate = async () => {
    const menuText = getMenuText();
    
    if (!menuText.trim()) {
      toast({
        title: "No Content",
        description: inputMethod === "file" 
          ? "Please upload a menu file first" 
          : "Please enter your menu text",
        variant: "destructive",
      });
      return;
    }
    if (!stylePrompt.trim()) {
      toast({
        title: "Missing Style",
        description: "Please describe how your menu should look",
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
        description: error.message || "We encountered an issue generating your menu designs. Please try again later.",
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
  const menuText = getMenuText();

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

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold mb-2" data-testid="text-generate-title">
            Generate Menu Design
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload your menu or paste your menu text, then customize the design
          </p>
        </div>

        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="text-xl font-medium mb-4">1. Add Your Menu Content</h2>
            
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
                    <div className="mt-2 p-4 bg-muted rounded-lg max-h-32 overflow-y-auto">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                        {extractedText.substring(0, 500)}{extractedText.length > 500 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="text">
                <div>
                  <Label htmlFor="menu-text">Paste your menu content below</Label>
                  <Textarea
                    id="menu-text"
                    placeholder="APPETIZERS

Bruschetta - $8
Fresh tomatoes, basil, garlic on toasted bread

Soup of the Day - $6
Ask your server for today's selection

MAIN COURSES

Grilled Salmon - $24
Atlantic salmon with lemon butter sauce

Ribeye Steak - $32
12oz prime cut with herb butter

..."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="min-h-64 mt-2 font-mono text-sm"
                    data-testid="textarea-menu-content"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {manualText.length} characters
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-medium mb-4">2. Choose Your Colors</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {colors.map((color, index) => (
                <div key={index} className="relative">
                  <button
                    onClick={() => setCustomColorIndex(customColorIndex === index ? null : index)}
                    className="w-full aspect-square rounded-lg border-2 transition-all hover:scale-105"
                    style={{ backgroundColor: color, borderColor: customColorIndex === index ? 'var(--primary)' : 'transparent' }}
                    data-testid={`button-color-${index}`}
                  />
                  {customColorIndex === index && (
                    <div className="absolute top-full left-0 mt-2 z-10 p-3 bg-background border rounded-lg shadow-lg">
                      <HexColorPicker color={color} onChange={(newColor) => updateColor(index, newColor)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-medium mb-4">3. Select Menu Size</h2>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger data-testid="select-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MENU_SIZES.map((sizeOption) => (
                  <SelectItem key={sizeOption} value={sizeOption}>
                    {sizeOption.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-medium mb-4">4. Describe Your Style</h2>
            <Textarea
              placeholder="e.g., Modern and elegant with clean lines, rustic Italian trattoria feel, minimalist Japanese aesthetic..."
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              className="min-h-24"
              data-testid="input-style-prompt"
            />
          </Card>

          <Button
            size="lg"
            className="w-full text-lg py-6"
            onClick={handleGenerate}
            disabled={!menuText.trim() || !stylePrompt.trim() || isGenerating}
            data-testid="button-generate"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Designs...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate Menu Designs
              </>
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Generation is free! You'll get 3 unique design variations.
          </p>
        </div>
      </div>
    </div>
  );
}
