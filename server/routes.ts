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

// Check if payment is required (used before Stripe initialization)
const isPaymentEnabled = process.env.PAYMENT_REQUIRED !== 'false';

// Initialize Stripe only if payment is enabled
let stripe: Stripe | null = null;
if (isPaymentEnabled) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY not configured - payment features will be disabled');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
  }
}

// Pricing constants
const ACTIVATION_PRICE_CENTS = 1000; // $10 one-time activation
const CREDIT_PRICE_CENTS = 100; // $1 per credit

// Cached Stripe product IDs for one-time payments
let activationProductId: string | null = null;
let creditProductId: string | null = null;

async function getOrCreateActivationProduct(): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');
  if (activationProductId) return activationProductId;
  
  // Try to find existing product
  const products = await stripe.products.search({
    query: "name:'Claude Menu Activation'",
    limit: 1,
  });
  
  if (products.data.length > 0) {
    activationProductId = products.data[0].id;
    return activationProductId;
  }
  
  // Create new product
  const product = await stripe.products.create({
    name: 'Claude Menu Activation',
    description: 'One-time activation fee for Claude Menu - includes unlimited downloads + 5 menu generation credits',
  });
  
  activationProductId = product.id;
  return activationProductId;
}

async function getOrCreateCreditProduct(): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');
  if (creditProductId) return creditProductId;
  
  // Try to find existing product
  const products = await stripe.products.search({
    query: "name:'Claude Menu Credit'",
    limit: 1,
  });
  
  if (products.data.length > 0) {
    creditProductId = products.data[0].id;
    return creditProductId;
  }
  
  // Create new product
  const product = await stripe.products.create({
    name: 'Claude Menu Credit',
    description: 'Menu generation credit for Claude Menu',
  });
  
  creditProductId = product.id;
  return creditProductId;
}

// Legacy subscription price (kept for backwards compatibility)
let subscriptionPriceId: string | null = null;
async function getSubscriptionPrice(): Promise<string> {
  if (!stripe) throw new Error('Stripe not configured');
  if (subscriptionPriceId) return subscriptionPriceId;
  
  // Search for existing subscription price
  const prices = await stripe.prices.search({
    query: "product.name:'Claude Menu Pro'",
    limit: 1,
  });
  
  if (prices.data.length > 0) {
    subscriptionPriceId = prices.data[0].id;
    return subscriptionPriceId;
  }
  
  // Create product and price for subscription
  const product = await stripe.products.create({
    name: 'Claude Menu Pro',
    description: 'Monthly subscription for Claude Menu',
  });
  
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 999, // $9.99/month
    currency: 'usd',
    recurring: { interval: 'month' },
  });
  
  subscriptionPriceId = price.id;
  return subscriptionPriceId;
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

// Check if payment system is required (can be disabled for development)
function isPaymentRequired(): boolean {
  return process.env.PAYMENT_REQUIRED !== 'false';
}

// Helper to check if user can generate menus (has credits)
async function checkCanGenerate(userId: string): Promise<{ canGenerate: boolean; profile: any; reason?: string }> {
  // If payments not required, grant access to everyone
  if (!isPaymentRequired()) {
    const profile = await supabaseStorage.getProfile(userId);
    return { canGenerate: true, profile };
  }
  
  const profile = await supabaseStorage.getProfile(userId);
  
  if (!profile) {
    return { canGenerate: false, profile: null, reason: 'Profile not found' };
  }
  
  // Check if user has activated and has credits
  if (!profile.has_activated) {
    return { canGenerate: false, profile, reason: 'Account not activated. Please purchase an activation to start generating menus.' };
  }
  
  if ((profile.menu_credits || 0) <= 0) {
    return { canGenerate: false, profile, reason: 'No credits remaining. Please purchase more credits.' };
  }
  
  return { canGenerate: true, profile };
}

// Helper to check if user can download (has activated account)
async function checkCanDownload(userId: string): Promise<{ canDownload: boolean; profile: any; reason?: string }> {
  // If payments not required, grant access to everyone
  if (!isPaymentRequired()) {
    const profile = await supabaseStorage.getProfile(userId);
    return { canDownload: true, profile };
  }
  
  const profile = await supabaseStorage.getProfile(userId);
  
  if (!profile) {
    return { canDownload: false, profile: null, reason: 'Profile not found' };
  }
  
  if (!profile.has_activated) {
    return { canDownload: false, profile, reason: 'Account not activated. Activation required for downloads.' };
  }
  
  return { canDownload: true, profile };
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
      paymentRequired: isPaymentRequired(),
      activationPrice: ACTIVATION_PRICE_CENTS / 100,
      creditPrice: CREDIT_PRICE_CENTS / 100,
    });
  });

  // Credits status route - uses Supabase auth
  app.get('/api/credits', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      const userEmail = req.supabaseUser.email;
      
      // Try to get credits status first
      let creditsStatus = await supabaseStorage.getCreditsStatus(userId);
      
      // If no profile exists, create one
      if (!creditsStatus) {
        console.log(`[Credits] No profile found for user ${userId} (${userEmail}), creating one...`);
        try {
          const newProfile = await supabaseStorage.createProfile({
            id: userId,
            email: userEmail,
            name: req.supabaseUser.user_metadata?.full_name || req.supabaseUser.user_metadata?.name || null,
            avatar_url: req.supabaseUser.user_metadata?.avatar_url || null,
          });
          
          if (newProfile) {
            console.log(`[Credits] Profile created successfully for user ${userId}`);
            creditsStatus = {
              hasActivated: newProfile.has_activated || false,
              menuCredits: newProfile.menu_credits || 0,
              totalGenerated: newProfile.total_generated || 0,
            };
          } else {
            console.error(`[Credits] Failed to create profile for user ${userId} - createProfile returned null`);
            // If profile creation failed, return defaults
            return res.json({
              hasActivated: false,
              menuCredits: 0,
              totalGenerated: 0,
              paymentRequired: isPaymentRequired(),
            });
          }
        } catch (profileError) {
          console.error(`[Credits] Error creating profile for user ${userId}:`, profileError);
          return res.json({
            hasActivated: false,
            menuCredits: 0,
            totalGenerated: 0,
            paymentRequired: isPaymentRequired(),
          });
        }
      }
      
      res.json({ 
        ...creditsStatus,
        paymentRequired: isPaymentRequired(),
      });
    } catch (error) {
      console.error("Error checking credits:", error);
      res.status(500).json({ message: "Failed to check credits status" });
    }
  });

  // Pay for activation ($10 one-time) - requires auth
  app.post('/api/pay/activate', verifySupabaseToken, async (req: any, res) => {
    try {
      // Check if payment system is enabled
      if (!isPaymentRequired() || !stripe) {
        return res.status(400).json({ message: 'Payment system is not enabled' });
      }

      const userId = req.supabaseUser.id;
      const userEmail = req.supabaseUser.email;
      const { returnUrl } = req.body;
      const baseUrl = returnUrl || `https://${req.headers.host}`;

      // Check if already activated
      const profile = await supabaseStorage.getProfile(userId);
      if (profile?.has_activated) {
        return res.status(400).json({ message: 'Account already activated' });
      }

      // Get or create Stripe customer
      let customerId = profile?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId },
        });
        customerId = customer.id;
      }

      // Get activation product
      const productId = await getOrCreateActivationProduct();

      // Create checkout session for one-time activation
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product: productId,
              unit_amount: ACTIVATION_PRICE_CENTS,
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId,
          type: 'activation',
        },
        success_url: `${baseUrl}/dashboard?payment=success&type=activation`,
        cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Activation checkout error:', error);
      res.status(500).json({ message: error.message || 'Failed to create activation checkout' });
    }
  });

  // Pay for additional credits ($1 each) - requires auth
  app.post('/api/pay/credits', verifySupabaseToken, async (req: any, res) => {
    try {
      // Check if payment system is enabled
      if (!isPaymentRequired() || !stripe) {
        return res.status(400).json({ message: 'Payment system is not enabled' });
      }

      const userId = req.supabaseUser.id;
      const userEmail = req.supabaseUser.email;
      const { returnUrl, quantity = 5 } = req.body;
      const baseUrl = returnUrl || `https://${req.headers.host}`;

      // Validate quantity (1-100)
      const creditQuantity = Math.min(Math.max(parseInt(quantity) || 5, 1), 100);

      // Check if activated (must be activated to buy credits)
      const profile = await supabaseStorage.getProfile(userId);
      if (!profile?.has_activated) {
        return res.status(400).json({ message: 'Please activate your account first before purchasing credits' });
      }

      // Get or create Stripe customer
      let customerId = profile?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId },
        });
        customerId = customer.id;
      }

      // Get credit product
      const productId = await getOrCreateCreditProduct();

      // Create checkout session for credits
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product: productId,
              unit_amount: CREDIT_PRICE_CENTS,
            },
            quantity: creditQuantity,
          },
        ],
        metadata: {
          userId,
          type: 'credits',
          quantity: creditQuantity.toString(),
        },
        success_url: `${baseUrl}/dashboard?payment=success&type=credits&quantity=${creditQuantity}`,
        cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Credits checkout error:', error);
      res.status(500).json({ message: error.message || 'Failed to create credits checkout' });
    }
  });

  // Stripe Customer Portal - Simple portal access by email
  app.post('/api/stripe/portal', async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(400).json({ message: "Stripe not configured" });
      }

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
      if (!stripe) {
        return res.status(400).json({ message: "Stripe not configured" });
      }

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

  // Create subscription route - uses Supabase auth (legacy - kept for backwards compatibility)
  app.post('/api/create-subscription', verifySupabaseToken, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(400).json({ message: "Stripe not configured" });
      }

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
      // Stripe must be configured for webhook processing
      if (!stripe) {
        return res.status(500).send('Stripe not configured');
      }
      
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

    // Handle the event - process one-time payments for activation and credits
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const metadata = session.metadata || {};
        const paymentType = metadata.type;
        const userId = metadata.userId;
        
        console.log(`Checkout completed: type=${paymentType}, userId=${userId}, customerId=${customerId}`);
        
        if (!userId) {
          console.error('No userId in session metadata');
          break;
        }

        // Handle one-time payment types
        if (paymentType === 'activation') {
          console.log(`Processing activation for user ${userId}`);
          const activated = await supabaseStorage.activateUser(userId, customerId);
          if (activated) {
            console.log(`Successfully activated user ${userId} with 5 credits`);
          } else {
            console.error(`Failed to activate user ${userId}`);
          }
        } else if (paymentType === 'credits') {
          const quantity = parseInt(metadata.quantity || '5');
          console.log(`Processing ${quantity} credits for user ${userId}`);
          const added = await supabaseStorage.addCredits(userId, quantity);
          if (added) {
            console.log(`Successfully added ${quantity} credits to user ${userId}`);
          } else {
            console.error(`Failed to add credits to user ${userId}`);
          }
        } else if (session.subscription) {
          // Legacy subscription handling (for backwards compatibility)
          const customerEmail = session.customer_email || session.customer_details?.email;
          const subscriptionId = session.subscription as string;
          if (customerEmail && subscriptionId) {
            await supabaseStorage.updateProfileStripeInfo(customerEmail, customerId, subscriptionId, 'active');
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Keep for backwards compatibility with existing subscriptions
        if (!stripe) break;
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
        // Keep for backwards compatibility
        if (!stripe) break;
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedCustomerId = deletedSubscription.customer as string;
        
        const deletedCustomer = await stripe.customers.retrieve(deletedCustomerId);
        const deletedEmail = (deletedCustomer as Stripe.Customer).email;
        
        if (deletedEmail) {
          await supabaseStorage.updateProfileStripeInfo(deletedEmail, deletedCustomerId, deletedSubscription.id, 'canceled');
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
      const userId = req.supabaseUser.id;
      
      // Check if user can generate (has credits)
      const { canGenerate, reason } = await checkCanGenerate(userId);
      if (!canGenerate) {
        return res.status(403).json({ 
          message: reason || 'Cannot generate menu',
          needsActivation: reason?.includes('not activated'),
          needsCredits: reason?.includes('No credits'),
        });
      }

      const { 
        generationId, 
        menuText, 
        colors, 
        size, 
        stylePrompt,
        restaurantName,
        slogan,
        themes,
        customThemeDescription,
        fontStyle,
        layout,
        generalDescription
      } = req.body;

      if (!menuText || !colors || !size) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      console.log(`Generating menu designs for user: ${req.supabaseUser?.email || req.supabaseUser?.id}`);
      
      // Use a credit before generating
      const creditUsed = await supabaseStorage.useCredit(userId);
      if (!creditUsed) {
        return res.status(403).json({ 
          message: 'Failed to use credit. Please check your credit balance.',
          needsCredits: true,
        });
      }
      console.log(`Used 1 credit for user ${userId}`);

      // Generate AI designs synchronously
      const htmlVariations = await generateMenuDesigns({
        menuText,
        colors,
        size,
        stylePrompt,
        restaurantName,
        slogan,
        themes,
        customThemeDescription,
        fontStyle,
        layout,
        generalDescription
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

  // Download HTML (requires activation if payment is required) - uses Supabase auth
  app.get('/api/generations/:id/download/:variation', verifySupabaseToken, async (req: any, res) => {
    try {
      const userId = req.supabaseUser.id;
      
      // Check if user can download (has activated account)
      const { canDownload, reason } = await checkCanDownload(userId);
      if (!canDownload) {
        return res.status(403).json({ 
          message: reason || "Activation required to download designs",
          needsActivation: true,
        });
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
  themes?: string[];
  customThemeDescription?: string;
  fontStyle?: string;
  layout?: string;
  generalDescription?: string;
}

// Function to generate a single menu design with Claude
async function generateMenuDesigns(params: GenerateMenuParams): Promise<string[]> {
  const { 
    menuText, 
    colors, 
    size, 
    stylePrompt, 
    restaurantName, 
    slogan, 
    themes, 
    customThemeDescription,
    fontStyle, 
    layout,
    generalDescription 
  } = params;
  
  try {
    // Build theme description from multiple themes
    let themeDesc = "";
    if (themes && themes.length > 0) {
      const themeDescriptions = themes.map(t => THEME_DESCRIPTIONS[t] || t);
      themeDesc = themeDescriptions.join("; ");
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
${themeDesc ? `Visual Themes to blend: ${themeDesc}` : ""}
${customThemeDescription ? `Custom style elements: ${customThemeDescription}` : ""}
${fontDesc ? `Typography Style: ${fontDesc}` : ""}
${layoutDesc ? `Page Layout: ${layoutDesc}` : ""}
${generalDescription ? `Additional requirements: ${generalDescription}` : ""}
${stylePrompt ? `Extra notes: ${stylePrompt}` : ""}

IMPORTANT: Output ONLY the raw HTML code. Do NOT wrap it in markdown code blocks or add any explanations. Start directly with <!DOCTYPE html> and end with </html>.`;

    const userPrompt = `Create a stunning HTML restaurant menu design based on the specifications above.

Menu Content:
${menuText}

Create a complete HTML file that:
1. Opens directly in a browser
2. Prints beautifully as PDF
3. Follows the visual theme and style specifications exactly
4. ${restaurantName ? `Has a professional header with the restaurant name "${restaurantName}"${slogan ? ` and slogan "${slogan}"` : ''}` : 'Has a clean header area'}
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
