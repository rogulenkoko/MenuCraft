import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
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
async function getSubscriptionPrice(): Promise<string> {
  // Use configured price if available
  if (CLAUDE_MENU_PRO_PRICE_ID) {
    return CLAUDE_MENU_PRO_PRICE_ID;
  }
  
  // Otherwise create price on the fly (for development)
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: 2900, // $29.00
    recurring: {
      interval: 'month',
    },
    product_data: {
      name: 'Claude Menu Pro',
      description: 'Unlimited menu generations with AI',
    },
  });
  
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
async function ensureActiveSubscription(userId: string): Promise<{ hasAccess: boolean; user: any }> {
  // If subscription is not required, grant access to everyone without checking user status
  if (!isSubscriptionRequired()) {
    const user = await storage.getUser(userId);
    return { hasAccess: true, user };
  }
  
  let user = await storage.getUser(userId);
  
  if (!user) {
    return { hasAccess: false, user: null };
  }
  
  // Check if development bypass should apply
  const enableDevBypass = process.env.ENABLE_DEV_SUBSCRIPTION_BYPASS === 'true';
  const isDevMode = process.env.NODE_ENV === 'development';
  const isDevelopmentBypass = enableDevBypass && isDevMode && !process.env.STRIPE_WEBHOOK_SECRET;
  
  // If bypass applies and user has subscription, ensure status is active
  if (isDevelopmentBypass && user.stripeSubscriptionId && user.subscriptionStatus !== 'active') {
    console.log(`Development bypass: Activating subscription for user ${userId}`);
    await storage.updateUserStripeInfo(
      userId,
      user.stripeCustomerId || '',
      user.stripeSubscriptionId,
      'active'
    );
    user = await storage.getUser(userId); // Refetch
  }
  
  return {
    hasAccess: user.subscriptionStatus === 'active',
    user
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
  
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
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

  // Subscription status route
  app.get('/api/subscription/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Create subscription route
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If user already has active subscription, return existing
      if (user.stripeSubscriptionId && user.subscriptionStatus === 'active') {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice as string);
        const paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent as string);
        
        return res.send({
          subscriptionId: subscription.id,
          clientSecret: paymentIntent.client_secret,
        });
      }

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || undefined,
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
      // In development with bypass enabled, set to 'active' immediately for testing
      // Otherwise, use Stripe's status (typically 'incomplete' until webhook confirms payment)
      const enableDevBypass = process.env.ENABLE_DEV_SUBSCRIPTION_BYPASS === 'true';
      const isDevMode = process.env.NODE_ENV === 'development';
      const isDevelopmentBypass = enableDevBypass && isDevMode && !process.env.STRIPE_WEBHOOK_SECRET;
      
      const initialStatus = isDevelopmentBypass ? 'active' : subscription.status;
      
      if (isDevelopmentBypass) {
        console.log(`Development bypass: Creating subscription with immediate 'active' status for user ${userId}`);
      }
      
      // Update user with Stripe info
      await storage.updateUserStripeInfo(
        userId,
        customerId,
        subscription.id,
        initialStatus
      );

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

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Find user by Stripe customer ID
        const users = await storage.getUserByStripeCustomer(customerId);
        if (users) {
          await storage.updateUserStripeInfo(
            users.id,
            customerId,
            subscription.id,
            subscription.status
          );
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedCustomerId = deletedSubscription.customer as string;
        
        const deletedUsers = await storage.getUserByStripeCustomer(deletedCustomerId);
        if (deletedUsers) {
          await storage.updateUserStripeInfo(
            deletedUsers.id,
            deletedCustomerId,
            deletedSubscription.id,
            'canceled'
          );
        }
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const invoiceCustomerId = sub.customer as string;
          
          const invoiceUsers = await storage.getUserByStripeCustomer(invoiceCustomerId);
          if (invoiceUsers) {
            await storage.updateUserStripeInfo(
              invoiceUsers.id,
              invoiceCustomerId,
              subscriptionId,
              'active'
            );
          }
        }
        break;

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
      const { generationId, menuText, colors, size, stylePrompt } = req.body;

      if (!menuText || !colors || !size || !stylePrompt) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      console.log(`Generating menu designs for user: ${req.supabaseUser?.email || req.supabaseUser?.id}`);

      // Generate AI designs synchronously (takes ~30 seconds)
      const htmlVariations = await generateMenuDesigns(menuText, colors, size, stylePrompt);

      res.json({ htmlVariations, generationId });
    } catch (error: any) {
      console.error("Error generating designs:", error);
      
      // Provide user-friendly error message instead of raw API errors
      let userMessage = "We encountered an issue generating your menu designs. Please try again later.";
      
      // Check if it's an Anthropic API error about credits
      if (error.message && error.message.includes("credit balance")) {
        userMessage = "Menu generation is temporarily unavailable. Please try again in a few moments.";
      }
      
      res.status(500).json({ message: userMessage });
    }
  });

  // Get user's generations
  app.get('/api/generations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generations = await storage.getUserGenerations(userId);
      res.json(generations);
    } catch (error) {
      console.error("Error fetching generations:", error);
      res.status(500).json({ message: "Failed to fetch generations" });
    }
  });

  // Get specific generation
  app.get('/api/generations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generation = await storage.getMenuGeneration(req.params.id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      if (generation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(generation);
    } catch (error) {
      console.error("Error fetching generation:", error);
      res.status(500).json({ message: "Failed to fetch generation" });
    }
  });

  // Select variation
  app.post('/api/generations/:id/select', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generation = await storage.getMenuGeneration(req.params.id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      if (generation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { variation } = req.body;
      if (typeof variation !== 'number' || variation < 0 || variation > 2) {
        return res.status(400).json({ message: "Invalid variation" });
      }

      await storage.selectGenerationVariation(req.params.id, variation);
      res.json({ success: true });
    } catch (error) {
      console.error("Error selecting variation:", error);
      res.status(500).json({ message: "Failed to select variation" });
    }
  });

  // Download HTML (requires subscription if SUBSCRIPTION_REQUIRED=true)
  app.get('/api/generations/:id/download/:variation', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check subscription if required
      if (isSubscriptionRequired()) {
        const { hasAccess } = await ensureActiveSubscription(userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Active subscription required to download designs" });
        }
      }
      
      const generation = await storage.getMenuGeneration(req.params.id);

      if (!generation) {
        return res.status(404).json({ message: "Generation not found" });
      }

      if (generation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const variation = parseInt(req.params.variation);
      if (isNaN(variation) || variation < 0 || variation > 2) {
        return res.status(400).json({ message: "Invalid variation" });
      }

      if (!generation.htmlDesigns || !generation.htmlDesigns[variation]) {
        return res.status(404).json({ message: "Design not found" });
      }

      const html = generation.htmlDesigns[variation];
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

// Function to generate menu designs with Claude
async function generateMenuDesigns(
  menuText: string,
  colors: string[],
  size: string,
  stylePrompt: string
): Promise<string[]> {
  const htmlDesigns: string[] = [];
  
  try {
    const prompts = [
      `Create a modern, elegant HTML menu design. ${stylePrompt}. Use variation 1 style: Clean and minimalist with subtle elegance.`,
      `Create a modern, elegant HTML menu design. ${stylePrompt}. Use variation 2 style: Bold and creative with artistic flair.`,
      `Create a modern, elegant HTML menu design. ${stylePrompt}. Use variation 3 style: Classic and sophisticated with traditional elements.`,
    ];

    for (let i = 0; i < 3; i++) {
      const systemPrompt = `You are an expert HTML/CSS designer specializing in restaurant menus. Create a complete, standalone HTML file with embedded CSS that displays a beautiful, professional menu.

Requirements:
- Complete HTML document with <!DOCTYPE html>, proper structure
- All CSS must be embedded in <style> tags
- Use the provided color palette: ${colors.join(', ')}
- Target size: ${size}
- Make it print-ready if applicable
- Use elegant typography and proper spacing
- Organize menu items clearly with sections
- NO external dependencies, NO JavaScript
- Professional, restaurant-quality design`;

      const userPrompt = `${prompts[i]}

Menu Content:
${menuText}

Create a complete HTML file that can be opened directly in a browser and printed if needed. Make it absolutely beautiful and professional.`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: userPrompt
        }],
        system: systemPrompt,
      });

      const htmlContent = message.content[0].type === 'text' ? message.content[0].text : '';
      
      // Extract HTML if it's wrapped in code blocks
      let cleanHtml = htmlContent;
      const htmlMatch = htmlContent.match(/```html\n([\s\S]*?)```/) || htmlContent.match(/```\n([\s\S]*?)```/);
      if (htmlMatch) {
        cleanHtml = htmlMatch[1];
      }

      htmlDesigns.push(cleanHtml);
    }

    return htmlDesigns;
  } catch (error) {
    console.error("Error generating menu designs:", error);
    throw error;
  }
}
