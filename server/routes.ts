import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabaseStorage } from "./supabaseStorage";
import { verifySupabaseToken } from "./supabaseAuth";
import Stripe from "stripe";
import Anthropic from '@anthropic-ai/sdk';
import multer from "multer";
import type { Result } from "pdf-parse";
import mammoth from "mammoth";

// Dynamic import for pdf-parse (CommonJS module)
const pdfParse = async (dataBuffer: Buffer): Promise<Result> => {
  const pdfParseModule = await import("pdf-parse");
  const parse = pdfParseModule.default || pdfParseModule;
  return parse(dataBuffer);
};

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Create or retrieve the subscription price
// In production, this should be a configured price ID
const CLAUDE_MENU_PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || null;
let cachedPriceId: string | null = null;

async function getSubscriptionPrice(): Promise<string> {
  // Use configured price if available
  if (CLAUDE_MENU_PRO_PRICE_ID) {
    return CLAUDE_MENU_PRO_PRICE_ID;
  }
  
  // Return cached price if already created
  if (cachedPriceId) {
    return cachedPriceId;
  }
  
  // Create product first, then price (for development)
  const product = await stripe.products.create({
    name: 'Claude Menu Pro',
  });
  
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: 2900, // $29.00
    recurring: {
      interval: 'month',
    },
    product: product.id,
  });
  
  cachedPriceId = price.id;
  return price.id;
}

// Initialize Anthropic
if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing required Anthropic API key: ANTHROPIC_API_KEY');
}
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Check if subscription feature is required
function isSubscriptionRequired(): boolean {
  return process.env.SUBSCRIPTION_REQUIRED !== 'false';
}

// Helper to check if user has active subscription (with development bypass support)
async function ensureActiveSubscription(userId: string): Promise<{ hasAccess: boolean; profile: any }> {
  // If subscription is not required, grant access to everyone
  if (!isSubscriptionRequired()) {
    const profile = await supabaseStorage.getProfile(userId);
    return { hasAccess: true, profile };
  }
  
  let profile = await supabaseStorage.getProfile(userId);
  
  if (!profile) {
    return { hasAccess: false, profile: null };
  }
  
  return {
    hasAccess: profile.subscription_status === 'active',
    profile
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Critical: Production environment guard for development bypass
  // This prevents accidental security bypass in production or staging environments
  const nodeEnv = process.env.NODE_ENV || 'production';
  const bypassEnabled = process.env.ENABLE_DEV_SUBSCRIPTION_BYPASS === 'true';
  
  if (bypassEnabled && nodeEnv !== 'development') {
    throw new Error(
      `CRITICAL SECURITY ERROR: ENABLE_DEV_SUBSCRIPTION_BYPASS is enabled but NODE_ENV is "${nodeEnv}". ` +
      `This bypass must ONLY be enabled in development environments. ` +
      `Set ENABLE_DEV_SUBSCRIPTION_BYPASS=false or change NODE_ENV to "development".`
    );
  }
  
  if (bypassEnabled) {
    console.warn('⚠️  Development subscription bypass is ENABLED. This should NEVER be used in production!');
  }

  // Auth routes - Now uses Supabase auth (verified via verifySupabaseToken middleware)
  app.get('/api/auth/user', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      const profile = await supabaseStorage.getProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // App config route
  app.get('/api/config', async (_req, res) => {
    res.json({
      subscriptionRequired: isSubscriptionRequired(),
    });
  });

  // Subscription status route - uses Supabase auth
  app.get('/api/subscription/status', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      const { hasAccess } = await ensureActiveSubscription(userId);
      
      const enableDevBypass = process.env.ENABLE_DEV_SUBSCRIPTION_BYPASS === 'true';
      const isDevMode = process.env.NODE_ENV === 'development';
      const isDevelopmentBypass = enableDevBypass && isDevMode && !process.env.STRIPE_WEBHOOK_SECRET;
      
      res.json({ 
        hasActiveSubscription: hasAccess, 
        isDevelopmentBypass,
        subscriptionRequired: isSubscriptionRequired()
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      res.status(500).json({ message: "Failed to check subscription status" });
    }
  });

  // Stripe Checkout - Simple checkout session (no auth required)
  app.post('/api/stripe/checkout', async (req: any, res) => {
    try {
      const { returnUrl, email } = req.body;
      const baseUrl = returnUrl || `https://${req.headers.host}`;

      // Get subscription price
      const priceId = await getSubscriptionPrice();

      // Create checkout session - Stripe will collect email if not provided
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/dashboard?subscription=success`,
        cancel_url: `${baseUrl}/subscribe?subscription=cancelled`,
      };

      // Pre-fill email if provided
      if (email) {
        sessionConfig.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);
      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      res.status(500).json({ message: error.message || 'Failed to create checkout session' });
    }
  });

  // Stripe Customer Portal - Simple portal access by email
  app.post('/api/stripe/portal', async (req: any, res) => {
    try {
      const { returnUrl, email } = req.body;
      const baseUrl = returnUrl || `https://${req.headers.host}`;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find customer by email
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (existingCustomers.data.length === 0) {
        return res.status(404).json({ message: "No subscription found for this email" });
      }

      const customerId = existingCustomers.data[0].id;

      // Create portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/subscribe`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error('Stripe portal error:', error);
      res.status(500).json({ message: error.message || 'Failed to open customer portal' });
    }
  });

  // Sync subscription status from Stripe - called after checkout redirect
  app.post('/api/stripe/sync-subscription', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      const userEmail = req.supabaseUser.email;
      
      console.log(`Syncing subscription for user ${userId} (${userEmail})`);

      // Look up customer by email in Stripe
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (customers.data.length === 0) {
        console.log(`No Stripe customer found for ${userEmail}`);
        return res.json({ 
          synced: false, 
          subscription_status: null,
          message: 'No Stripe customer found' 
        });
      }

      const customer = customers.data[0];
      console.log(`Found Stripe customer: ${customer.id}`);

      // Get active subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1,
      });

      let subscriptionStatus = 'free';
      let subscriptionId = null;

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        subscriptionStatus = subscription.status; // 'active', 'trialing', etc.
        subscriptionId = subscription.id;
        console.log(`Found active subscription: ${subscriptionId} (${subscriptionStatus})`);
      } else {
        // Check for any subscription (including incomplete ones that just completed)
        const allSubscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          limit: 5,
        });
        
        // Find the most recent subscription that's not canceled
        for (const sub of allSubscriptions.data) {
          if (sub.status === 'active' || sub.status === 'trialing') {
            subscriptionStatus = sub.status;
            subscriptionId = sub.id;
            console.log(`Found subscription: ${subscriptionId} (${subscriptionStatus})`);
            break;
          }
        }
      }

      // Ensure profile exists first
      let profile = await supabaseStorage.getProfile(userId);
      if (!profile) {
        // Create profile if it doesn't exist
        console.log(`Creating profile for user ${userId}`);
        const newProfile = await supabaseStorage.createProfile({
          id: userId,
          email: userEmail,
          name: req.supabaseUser.user_metadata?.full_name || req.supabaseUser.user_metadata?.name || null,
          avatar_url: req.supabaseUser.user_metadata?.avatar_url || null,
        });
        if (!newProfile) {
          return res.status(500).json({ message: 'Failed to create profile' });
        }
        profile = newProfile;
      }

      // Update the profile with Stripe info
      if (subscriptionId) {
        const updated = await supabaseStorage.updateProfileStripeInfoById(
          userId,
          customer.id,
          subscriptionId,
          subscriptionStatus
        );
        
        if (updated) {
          console.log(`Updated profile with subscription status: ${subscriptionStatus}`);
        } else {
          console.error(`Failed to update profile stripe info`);
        }
      }

      res.json({ 
        synced: true, 
        subscription_status: subscriptionStatus,
        has_active_subscription: subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
      });
    } catch (error: any) {
      console.error('Stripe sync error:', error);
      res.status(500).json({ message: error.message || 'Failed to sync subscription' });
    }
  });

  // Create subscription route - uses Supabase auth
  app.post('/api/create-subscription', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      let profile = await supabaseStorage.getProfile(userId);

      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      // If user already has active subscription, return existing
      if (profile.stripe_subscription_id && profile.subscription_status === 'active') {
        const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice as string);
        const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent as string);
        
        return res.send({
          subscriptionId: subscription.id,
          clientSecret: paymentIntent.client_secret,
        });
      }

      // Create or retrieve Stripe customer
      let customerId = profile.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: profile.email || undefined,
          name: profile.name || undefined,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
      }

      // Get or create subscription price
      const priceId = await getSubscriptionPrice();

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: priceId,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      // Determine initial subscription status
      const enableDevBypass = process.env.ENABLE_DEV_SUBSCRIPTION_BYPASS === 'true';
      const isDevMode = process.env.NODE_ENV === 'development';
      const isDevelopmentBypass = enableDevBypass && isDevMode && !process.env.STRIPE_WEBHOOK_SECRET;
      
      const initialStatus = isDevelopmentBypass ? 'active' : subscription.status;
      
      if (isDevelopmentBypass) {
        console.log(`Development bypass: Creating subscription with immediate 'active' status for user ${userId}`);
      }
      
      // Update profile with Stripe info using user ID (more reliable than email)
      const updateSuccess = await supabaseStorage.updateProfileStripeInfoById(
        userId,
        customerId,
        subscription.id,
        initialStatus
      );
      
      if (!updateSuccess) {
        console.error(`Failed to update profile stripe info for user ${userId}`);
      }

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;

      if (!paymentIntent || !paymentIntent.client_secret) {
        throw new Error("Payment intent not found on subscription");
      }

      res.send({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      return res.status(400).send({ error: { message: error.message } });
    }
  });

  // Stripe webhook to handle subscription status updates
  app.post('/api/webhook/stripe', async (req, res) => {
    // Webhook secret is required for signature verification in production
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // In development, log and return success to avoid blocking Stripe testing
      if (process.env.NODE_ENV === 'development') {
        console.warn('STRIPE_WEBHOOK_SECRET not configured in development - webhook received but not processed');
        return res.status(200).json({ received: true, processed: false, reason: 'dev_mode_no_secret' });
      }
      // In production, this is a configuration error
      console.error('STRIPE_WEBHOOK_SECRET not configured - webhook cannot be processed');
      return res.status(500).send('Webhook secret not configured');
    }
    
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).send('Missing stripe signature');
    }

    let event;

    try {
      // Use raw body for signature verification
      const rawBody = (req as any).rawBody || req.body;
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event - update Supabase profiles only
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        
        console.log(`Checkout completed for ${customerEmail}, subscription: ${subscriptionId}`);
        
        if (customerEmail && subscriptionId) {
          await supabaseStorage.updateProfileStripeInfo(customerEmail, customerId, subscriptionId, 'active');
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const customer = await stripe.customers.retrieve(customerId);
        const customerEmail = (customer as Stripe.Customer).email;
        
        if (customerEmail) {
          await supabaseStorage.updateProfileStripeInfo(customerEmail, customerId, subscription.id, subscription.status);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedCustomerId = deletedSubscription.customer as string;
        
        const deletedCustomer = await stripe.customers.retrieve(deletedCustomerId);
        const deletedEmail = (deletedCustomer as Stripe.Customer).email;
        
        if (deletedEmail) {
          await supabaseStorage.updateProfileStripeInfo(deletedEmail, deletedCustomerId, deletedSubscription.id, 'canceled');
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const invoiceCustomerId = sub.customer as string;
          
          const invoiceCustomer = await stripe.customers.retrieve(invoiceCustomerId);
          const invoiceEmail = (invoiceCustomer as Stripe.Customer).email;
          
          if (invoiceEmail) {
            await supabaseStorage.updateProfileStripeInfo(invoiceEmail, invoiceCustomerId, subscriptionId, 'active');
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  // File upload route (no auth required - just text extraction)
  app.post('/api/upload', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;
      let text = "";

      // Extract text based on file type
      if (file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(file.buffer);
        text = pdfData.text;
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
      } else {
        return res.status(400).json({ message: "Unsupported file type. Please upload PDF or DOCX" });
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract text from file" });
      }

      res.json({ text: text.trim() });
    } catch (error: any) {
      console.error("Error processing file:", error);
      res.status(500).json({ message: "Failed to process file: " + error.message });
    }
  });

  // Text extraction route (alias for /api/upload)
  app.post('/api/extract-text', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;
      let text = "";

      // Extract text based on file type
      if (file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(file.buffer);
        text = pdfData.text;
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
      } else if (file.mimetype === 'text/plain') {
        text = file.buffer.toString('utf-8');
      } else {
        return res.status(400).json({ message: "Unsupported file type. Please upload PDF, DOCX, or TXT" });
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ message: "Could not extract text from file" });
      }

      res.json({ text: text.trim() });
    } catch (error: any) {
      console.error("Error processing file:", error);
      res.status(500).json({ message: "Failed to process file: " + error.message });
    }
  });

  // Generate menu designs route - requires Supabase auth
  // This route generates the 3 HTML variations using Claude AI
  app.post('/api/generate', verifySupabaseToken, async (req: any, res) => {
    try {
      const { 
        generationId, 
        menuText, 
        colors, 
        size, 
        stylePrompt,
        restaurantName,
        slogan,
        theme,
        fontStyle,
        layout
      } = req.body;

      if (!menuText || !colors || !size) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      console.log(`Generating menu designs for user: ${req.supabaseUser?.email || req.supabaseUser?.id}`);

      // Generate AI designs synchronously
      const htmlVariations = await generateMenuDesigns({
        menuText,
        colors,
        size,
        stylePrompt,
        restaurantName,
        slogan,
        theme,
        fontStyle,
        layout
      });

      res.json({ htmlVariations, generationId });
    } catch (error: any) {
      console.error("Error generating designs:", error);
      
      let userMessage = "We encountered an issue generating your menu designs. Please try again later.";
      
      if (error.message && (error.message.includes("credit balance") || error.message.includes("too low"))) {
        userMessage = "The AI service is temporarily unavailable due to API credit limits. Please contact the administrator.";
      }
      
      res.status(500).json({ message: userMessage });
    }
  });

  // Get user's generations - uses Supabase auth
  app.get('/api/generations', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      const generations = await supabaseStorage.getUserGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error("Error fetching generations:", error);
      res.status(500).json({ message: "Failed to fetch generations" });
    }
  });

  // Get specific generation - uses Supabase auth
  app.get('/api/generations/:id', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      const generation = await supabaseStorage.getMenuGeneration(req.params.id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      if (generation.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(generation);
    } catch (error) {
      console.error("Error fetching generation:", error);
      res.status(500).json({ message: "Failed to fetch generation" });
    }
  });

  // Select variation - uses Supabase auth
  app.post('/api/generations/:id/select', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      const generation = await supabaseStorage.getMenuGeneration(req.params.id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      if (generation.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { variation } = req.body;
      if (typeof variation !== 'number' || variation < 0 || variation > 2) {
        return res.status(400).json({ message: "Invalid variation" });
      }

      await supabaseStorage.selectGenerationVariation(req.params.id, variation);
      res.json({ success: true });
    } catch (error) {
      console.error("Error selecting variation:", error);
      res.status(500).json({ message: "Failed to select variation" });
    }
  });

  // Download HTML (requires subscription if SUBSCRIPTION_REQUIRED=true) - uses Supabase auth
  app.get('/api/generations/:id/download/:variation', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      
      // Check subscription if required
      if (isSubscriptionRequired()) {
        const { hasAccess } = await ensureActiveSubscription(userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Active subscription required to download designs" });
        }
      }
      
      const generation = await supabaseStorage.getMenuGeneration(req.params.id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      if (generation.user_id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const variation = parseInt(req.params.variation);
      if (isNaN(variation) || variation < 0 || variation > 2) {
        return res.status(400).json({ message: "Invalid variation" });
      }

      if (!generation.html_variations || !generation.html_variations[variation]) {
        return res.status(404).json({ message: "Design not found" });
      }

      const html = generation.html_variations[variation];
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="menu-design-${variation + 1}.html"`);
      res.send(html);
    } catch (error) {
      console.error("Error downloading design:", error);
      res.status(500).json({ message: "Failed to download design" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Theme descriptions for AI prompt
const THEME_DESCRIPTIONS: Record<string, string> = {
  "minimalism": "Clean, simple, elegant design with lots of white space, minimal decorations, and focus on typography",
  "scandinavian": "Light, airy, natural feel with soft colors, organic shapes, and cozy warmth",
  "loft": "Raw, urban, industrial style with exposed textures, bold typography, and modern edge",
  "neon": "Bold, vibrant 80s retrowave style with neon accents, dark backgrounds, and synthwave aesthetics",
  "japanese": "Peaceful, balanced, refined zen aesthetic with Japanese minimalism and harmonious layout",
  "greek": "Mediterranean warmth with terracotta tones, rustic textures, and tavern-style charm",
  "fine-dining": "Luxurious, sophisticated, classic elegance with gold accents and refined typography",
  "eco": "Green, sustainable, fresh organic feel with natural elements and earthy warmth",
};

// Font style descriptions for AI prompt
const FONT_DESCRIPTIONS: Record<string, string> = {
  "elegant": "Refined serif fonts with delicate strokes, thin weights, and sophisticated letterforms",
  "bold": "Impactful sans-serif fonts with heavy weights and strong visual presence",
  "handwritten": "Personal, artisanal script fonts that feel hand-lettered and warm",
  "modern": "Clean, contemporary geometric sans-serif with perfect circles and clean lines",
  "retro": "Vintage-inspired display fonts with nostalgic signage style and decorative elements",
};

// Layout descriptions for AI prompt
const LAYOUT_DESCRIPTIONS: Record<string, string> = {
  "single": "Single column layout - clean minimalist design with items stacked vertically, easy to read top to bottom",
  "two-column": "Two column layout - compact and scannable with dishes organized side by side",
  "card-grid": "Card grid layout - items displayed in card boxes, perfect for menus with images or featured items",
};

interface GenerateMenuParams {
  menuText: string;
  colors: string[];
  size: string;
  stylePrompt?: string;
  restaurantName?: string;
  slogan?: string;
  theme?: string;
  fontStyle?: string;
  layout?: string;
}

// Function to generate a single menu design with Claude
async function generateMenuDesigns(params: GenerateMenuParams): Promise<string[]> {
  const { menuText, colors, size, stylePrompt, restaurantName, slogan, theme, fontStyle, layout } = params;
  
  try {
    // Build theme description
    let themeDesc = "";
    if (theme) {
      themeDesc = THEME_DESCRIPTIONS[theme] || theme;
    }
    
    // Build font description
    let fontDesc = "";
    if (fontStyle) {
      fontDesc = FONT_DESCRIPTIONS[fontStyle] || fontStyle;
    }
    
    // Build layout description
    let layoutDesc = "";
    if (layout) {
      layoutDesc = LAYOUT_DESCRIPTIONS[layout] || layout;
    }

    const systemPrompt = `You are an expert HTML/CSS designer specializing in restaurant menus. Create a complete, standalone HTML file with embedded CSS that displays a beautiful, professional menu.

Requirements:
- Complete HTML document with <!DOCTYPE html>, proper structure
- All CSS must be embedded in <style> tags
- Use this color palette: ${colors.join(', ')}
- Target page size: ${size.toUpperCase()}
- Make it print-ready with @media print styles
- Use elegant typography (Google Fonts via @import recommended)
- Use proper spacing and visual hierarchy
- Organize menu items clearly with sections (Appetizers, Main Courses, Desserts, Drinks, etc.)
- Make text elements easy to identify for editing (use semantic tags like h1, h2, h3, p, span)
- NO JavaScript
- Professional, restaurant-quality design
- Ensure the design looks beautiful when printed as PDF

${restaurantName ? `Restaurant Name: "${restaurantName}" - Display prominently in the header` : ""}
${slogan ? `Slogan/Tagline: "${slogan}" - Display under the restaurant name` : ""}
${themeDesc ? `Visual Theme: ${themeDesc}` : ""}
${fontDesc ? `Typography Style: ${fontDesc}` : ""}
${layoutDesc ? `Page Layout: ${layoutDesc}` : ""}
${stylePrompt ? `Additional Style Notes: ${stylePrompt}` : ""}

IMPORTANT: Output ONLY the raw HTML code. Do NOT wrap it in markdown code blocks or add any explanations. Start directly with <!DOCTYPE html> and end with </html>.`;

    const userPrompt = `Create a stunning HTML restaurant menu design based on the specifications above.

Menu Content:
${menuText}

Create a complete HTML file that:
1. Opens directly in a browser
2. Prints beautifully as PDF
3. Follows the visual theme and style specifications exactly
4. Has a professional header with the restaurant name${slogan ? ' and slogan' : ''}
5. Organizes menu items into clear sections
6. Uses the specified color palette throughout
7. Applies the typography style consistently

Make it absolutely beautiful and suitable for a real upscale restaurant.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: userPrompt
      }],
      system: systemPrompt,
    });

    const htmlContent = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Extract HTML if it's wrapped in code blocks
    let cleanHtml = htmlContent.trim();
    
    const htmlMatch = cleanHtml.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
    if (htmlMatch) {
      cleanHtml = htmlMatch[1].trim();
    }
    
    // Ensure it starts with DOCTYPE or html tag
    if (!cleanHtml.toLowerCase().startsWith('<!doctype') && !cleanHtml.toLowerCase().startsWith('<html')) {
      const doctypeIndex = cleanHtml.toLowerCase().indexOf('<!doctype');
      const htmlIndex = cleanHtml.toLowerCase().indexOf('<html');
      const startIndex = Math.min(
        doctypeIndex >= 0 ? doctypeIndex : Infinity,
        htmlIndex >= 0 ? htmlIndex : Infinity
      );
      if (startIndex !== Infinity) {
        cleanHtml = cleanHtml.substring(startIndex);
      }
    }

    // Return as array for backwards compatibility
    return [cleanHtml];
  } catch (error) {
    console.error("Error generating menu design:", error);
    throw error;
  }
}
