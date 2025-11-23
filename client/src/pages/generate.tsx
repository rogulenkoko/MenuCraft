import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sparkles, Upload, FileText, LogOut, Loader2, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useDropzone } from "react-dropzone";
import { HexColorPicker } from "react-colorful";
import { MENU_SIZES } from "@shared/schema";

const DEFAULT_COLORS = ["#1e40af", "#dc2626", "#16a34a", "#eab308"];

export default function Generate() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [customColorIndex, setCustomColorIndex] = useState<number | null>(null);
  const [size, setSize] = useState("a4");
  const [stylePrompt, setStylePrompt] = useState("");

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

  const { data: subscription, refetch: refetchSubscription } = useQuery<{ hasActiveSubscription: boolean; isDevelopmentBypass?: boolean }>({
    queryKey: ["/api/subscription/status"],
    enabled: isAuthenticated,
  });

  // Refetch subscription status when page loads to ensure fresh data
  useEffect(() => {
    if (isAuthenticated) {
      refetchSubscription();
    }
  }, [isAuthenticated, refetchSubscription]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedText(data.text);
      toast({
        title: "Success",
        description: "File uploaded and text extracted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/generate", {
        fileName: file?.name || "menu.pdf",
        extractedText,
        colors,
        size,
        stylePrompt,
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({
        title: "Success",
        description: "Your menu designs are ready!",
      });
      setLocation(`/result/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      uploadMutation.mutate(selectedFile);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  });

  const updateColor = (index: number, newColor: string) => {
    const newColors = [...colors];
    newColors[index] = newColor;
    setColors(newColors);
  };

  const handleGenerate = () => {
    if (!extractedText) {
      toast({
        title: "No Content",
        description: "Please upload a menu file first",
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
    generateMutation.mutate();
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasActiveSubscription = subscription?.hasActiveSubscription ?? false;

  if (!hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-lg p-8 text-center">
          <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Subscription Required</h2>
          <p className="text-muted-foreground mb-6">
            Subscribe to start generating beautiful menu designs with AI
          </p>
          <Link href="/subscribe">
            <Button size="lg" data-testid="button-subscribe-required">
              Subscribe Now
            </Button>
          </Link>
        </Card>
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

      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-4xl font-semibold mb-8" data-testid="text-generate-title">
          Generate Menu Design
        </h1>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Upload and Text Preview */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-medium mb-4">Upload Menu</h2>
              <div
                {...getRootProps()}
                className={`
                  min-h-[300px] border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                `}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} data-testid="input-file" />
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                    <p className="text-sm text-muted-foreground">Uploading and extracting text...</p>
                  </>
                ) : file ? (
                  <>
                    <FileText className="h-12 w-12 text-primary mb-4" />
                    <p className="font-medium mb-2" data-testid="text-file-name">{file.name}</p>
                    <p className="text-sm text-muted-foreground mb-4">Click or drag to replace</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setExtractedText("");
                      }}
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-medium mb-2">Drag and drop or click to browse</p>
                    <p className="text-sm text-muted-foreground">
                      Supports PDF and DOCX files
                    </p>
                  </>
                )}
              </div>
            </Card>

            {extractedText && (
              <Card className="p-6">
                <h2 className="text-lg font-medium mb-4">Extracted Text Preview</h2>
                <Textarea
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="Extracted menu text will appear here..."
                  data-testid="textarea-extracted-text"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  You can edit the extracted text if needed
                </p>
              </Card>
            )}
          </div>

          {/* Right Column - Settings */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-medium mb-4">Color Palette</h2>
              <div className="grid grid-cols-4 gap-4 mb-4">
                {colors.map((color, index) => (
                  <div key={index} className="space-y-2">
                    <button
                      onClick={() => setCustomColorIndex(customColorIndex === index ? null : index)}
                      className="w-full h-16 rounded-lg border-2 hover-elevate active-elevate-2 transition-all"
                      style={{ backgroundColor: color, borderColor: customColorIndex === index ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
                      data-testid={`button-color-${index}`}
                    />
                    <Input
                      type="text"
                      value={color}
                      onChange={(e) => updateColor(index, e.target.value)}
                      className="text-xs text-center"
                      data-testid={`input-color-${index}`}
                    />
                  </div>
                ))}
              </div>
              {customColorIndex !== null && (
                <div className="mt-4">
                  <HexColorPicker
                    color={colors[customColorIndex]}
                    onChange={(newColor) => updateColor(customColorIndex, newColor)}
                  />
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-medium mb-4">Menu Size</h2>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger data-testid="select-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MENU_SIZES.map((menuSize) => (
                    <SelectItem key={menuSize.value} value={menuSize.value}>
                      {menuSize.label} - {menuSize.dimensions}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-medium mb-4">Style Prompt</h2>
              <Label htmlFor="style-prompt" className="text-sm text-muted-foreground mb-2 block">
                Describe how your menu should look
              </Label>
              <Textarea
                id="style-prompt"
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                className="min-h-[120px]"
                placeholder="Example: Modern and elegant with clean typography, ample white space, and sophisticated color scheme. Organize sections clearly with beautiful dividers..."
                data-testid="textarea-style-prompt"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stylePrompt.length} / 500 characters
              </p>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={!extractedText || generateMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Designs...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate 3 Designs
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
