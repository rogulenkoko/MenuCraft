import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Sparkles, Download, Palette, ChevronRight } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const { signInWithGoogle } = useSupabaseAuth();
  const { toast } = useToast();

  const handleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold tracking-tight" data-testid="text-logo">
                Claude Menu
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Button
                variant="ghost"
                onClick={handleSignIn}
                data-testid="button-sign-in"
              >
                <SiGoogle className="h-4 w-4 mr-2" />
                Sign In
              </Button>
              <Button
                onClick={handleSignIn}
                data-testid="button-get-started-header"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="flex flex-col gap-8">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm w-fit">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-muted-foreground">Powered by Claude AI</span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight" data-testid="text-hero-title">
                Transform Your Menu Into Art
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl" data-testid="text-hero-subtitle">
                Upload your restaurant menu and watch AI create three stunning, professional designs in seconds. No design skills needed.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6"
                  onClick={handleSignIn}
                  data-testid="button-start-generating"
                >
                  <SiGoogle className="h-5 w-5 mr-2" />
                  Start with Google
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6"
                  data-testid="button-view-examples"
                >
                  View Examples
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background" />
                  <div className="h-8 w-8 rounded-full bg-primary/30 border-2 border-background" />
                  <div className="h-8 w-8 rounded-full bg-primary/40 border-2 border-background" />
                </div>
                <span>Trusted by 500+ restaurants worldwide</span>
              </div>
            </div>
            <div className="relative">
              <div className="relative aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8 border">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent" />
                <div className="relative h-full w-full flex items-center justify-center">
                  <Palette className="h-32 w-32 text-primary/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-semibold mb-4" data-testid="text-features-title">
              Everything You Need
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional menu designs in three simple steps
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="p-6 hover-elevate" data-testid="card-feature-upload">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Easy Upload</h3>
              <p className="text-muted-foreground leading-relaxed">
                Drag and drop your PDF or Word menu file. We'll extract the content automatically.
              </p>
            </Card>
            <Card className="p-6 hover-elevate" data-testid="card-feature-customize">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Customize Your Style</h3>
              <p className="text-muted-foreground leading-relaxed">
                Choose your colors, size, and describe your vision. AI handles the rest.
              </p>
            </Card>
            <Card className="p-6 hover-elevate" data-testid="card-feature-download">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Download & Use</h3>
              <p className="text-muted-foreground leading-relaxed">
                Get three unique designs instantly. Download as HTML ready to print or publish.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-semibold mb-4" data-testid="text-how-it-works-title">
              How It Works
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-4">
            <div className="text-center" data-testid="card-step-1">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-medium mb-2">Upload Menu</h3>
              <p className="text-sm text-muted-foreground">
                Upload your menu in PDF or DOCX format
              </p>
            </div>
            <div className="text-center" data-testid="card-step-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-medium mb-2">Set Preferences</h3>
              <p className="text-sm text-muted-foreground">
                Choose colors, size, and style
              </p>
            </div>
            <div className="text-center" data-testid="card-step-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-medium mb-2">AI Generates</h3>
              <p className="text-sm text-muted-foreground">
                Get 3 unique professional designs
              </p>
            </div>
            <div className="text-center" data-testid="card-step-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-lg font-medium mb-2">Download</h3>
              <p className="text-sm text-muted-foreground">
                Choose your favorite and download
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6" data-testid="text-cta-title">
            Ready to Create Beautiful Menus?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of restaurants creating stunning menu designs with AI
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-lg px-8 py-6"
            onClick={handleSignIn}
            data-testid="button-get-started-cta"
          >
            <SiGoogle className="h-5 w-5 mr-2" />
            Get Started with Google
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-semibold">Claude Menu</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered menu design for modern restaurants
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Examples</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 Claude Menu. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
