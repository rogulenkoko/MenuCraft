# Menu Craft - AI-Powered Restaurant Menu Designer

## Overview
Menu Craft is a SaaS application that transforms restaurant menus into stunning, professional designs using AI. Users follow a multi-step wizard to configure their menu design, upload PDF/DOCX files or paste text, and receive AI-generated HTML menus.

## Current State
**Status**: Production-ready with Supabase architecture and credit-based payment system

## Payment Model
- **$10 one-time activation fee** - Unlocks unlimited downloads + 5 menu generation credits
- **$1 per additional credit** - Each credit generates 3 unique menu design variations
- **Stripe Checkout** - One-time payments via Stripe (not subscriptions)

## User Flow
1. **Landing page IS the generator** - Users start designing immediately without signing in
2. **Multi-step wizard** - 9 steps with skip functionality for most steps
3. **Login on generate** - Users sign in only when clicking "Generate Menu"
4. **Activation required** - Users must pay $10 activation to generate and download menus
5. **Credits system** - Each generation uses 1 credit; buy more as needed

## Architecture

### Current Stack
- **Frontend**: React + Vite + TailwindCSS + Shadcn/UI
- **Backend**: Express with Supabase JWT verification
- **Authentication**: Supabase Auth with Google OAuth
- **Database**: Supabase PostgreSQL with Row Level Security
- **AI Generation**: Claude API (claude-sonnet-4) via Express backend
- **Payments**: Stripe one-time payments (activation + credits)

### Frontend (`client/`)
- **Framework**: React with Wouter for routing
- **UI Library**: Shadcn/UI components with Tailwind CSS
- **State**: React hooks + direct Supabase client calls
- **Pages**:
  - `/` - Menu generator wizard (public, login on generate)
  - `/auth/callback` - OAuth callback handler
  - `/dashboard` or `/dashboard/:id` - Combined dashboard with menu list and editor (auth required)
  - `/generate` - Alias for landing page
  - `/subscribe` - Stripe payment page for activation and credits (auth required)

### Backend Routes (`server/routes.ts`)
- **Auth**: `GET /api/auth/user` - Get current user profile
- **Credits**: `GET /api/credits` - Get credits status (hasActivated, menuCredits, totalGenerated)
- **Payment**: 
  - `POST /api/pay/activate` - Create Stripe checkout for $10 activation
  - `POST /api/pay/credits` - Create Stripe checkout for additional credits ($1 each)
- **Webhook**: `POST /api/webhook/stripe` - Handle Stripe payment confirmations
- **Generation**: `POST /api/generate` - Generate menu (requires activation + credits)
- **Download**: `GET /api/generations/:id/download/:variation` - Download HTML (requires activation)

### Dashboard Page Features
- **Left sidebar**: List of all previously generated menus, sorted by date
- **Credits display**: Shows current credit balance with buy more button
- **Right panel**: Full-screen menu editor with:
  - Inline contentEditable editing (click text to edit)
  - Save, Reset, Download HTML, Save as PDF buttons
  - Real-time preview of the menu design
- **Access control**: Redirects to generate page if not logged in

## Menu Generation Wizard (9 Steps)
1. **Content** (required) - Upload PDF/DOCX/TXT or paste menu text
2. **Restaurant Name** (skippable) - Name displayed on menu header
3. **Slogan** (skippable) - Tagline under restaurant name
4. **Visual Theme** (skippable) - Select up to 3 themes + custom description
5. **Color Palette** (skippable) - 5 presets + custom colors option
6. **Font Style** (skippable) - 5 typography presets
7. **Page Layout** (skippable) - Single column, two columns, or card grid
8. **Menu Size** (skippable) - A4, Letter, A5, Half-letter
9. **Description** (skippable) - Additional design requests

### Database Schema (Supabase)
```sql
-- profiles (linked to auth.users)
- id (UUID, PK, references auth.users)
- email, name, avatar_url
- stripe_customer_id
- has_activated (boolean, default false)
- menu_credits (integer, default 0)
- total_generated (integer, default 0)
- created_at, updated_at

-- menu_generations
- id (UUID, PK)
- user_id (FK to profiles)
- file_name, extracted_text, colors, size, style_prompt
- html_variations (text array)
- selected_variation, is_downloaded
- created_at
```

### Required Migration
Run this SQL in your Supabase SQL Editor to add credit fields:
```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_activated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS menu_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_generated INTEGER DEFAULT 0;
```

## Environment Variables

### Required for Supabase:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)

### Required for Payments:
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (for production)

### Required for AI:
- `ANTHROPIC_API_KEY` - Claude AI API key

### Optional:
- `VITE_PAYMENT_REQUIRED` - Set to "false" to disable payment system (default: "true")
- `PAYMENT_REQUIRED` - Backend version of payment toggle

## Payment Modes

### 1. Payment Required (default)
When `VITE_PAYMENT_REQUIRED=true` or not set:
- Users must pay $10 activation to generate menus
- Activation grants 5 credits + unlimited downloads
- Additional credits cost $1 each
- Webhook confirms payments before granting access

### 2. Payment Disabled (free mode)
When `VITE_PAYMENT_REQUIRED=false`:
- Everything is FREE
- No Stripe integration needed
- All payment UI is hidden
- Perfect for development/testing

## Setup Instructions

### 1. Create Supabase Project
1. Go to https://supabase.com and create a new project
2. Copy the project URL, anon key, and service role key from Settings > API

### 2. Set Up Database
1. Run the SQL from `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor
2. Run the SQL from `supabase/migrations/002_add_credits_system.sql` to add credit fields

### 3. Enable Google OAuth
1. Go to Authentication > Providers > Google
2. Enable Google provider
3. Add Google OAuth credentials (from Google Cloud Console)
4. Copy the Redirect URL and add it to Google Cloud Console

### 4. Configure Stripe
1. Create Stripe products for "Claude Menu Activation" and "Claude Menu Credit"
2. Set up webhook endpoint pointing to `/api/webhook/stripe`
3. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to environment

### 5. Configure Environment
Add to Replit Secrets:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret
- `ANTHROPIC_API_KEY` - Your Claude API key

## Key Features
1. **Google OAuth**: Sign in with Google via Supabase Auth
2. **Credit System**: Pay $10 activation + $1 per generation credit
3. **Unlimited Downloads**: After activation, download any menu anytime
4. **File Upload**: Drag-and-drop PDF, DOCX, or TXT files
5. **AI Generation**: Claude creates 3 unique professional HTML designs per credit
6. **Customization**: Color palette picker, size selection, style prompts
7. **Dashboard**: View generation history and credit balance

## Development

### Local Development
```bash
npm run dev
```

### Type Checking
```bash
npm run check
```

## Hooks Reference

### useCredits Hook
```typescript
const { 
  hasActivated,    // boolean - has user paid activation fee
  menuCredits,     // number - remaining credits
  totalGenerated,  // number - total menus generated
  canGenerate,     // boolean - can user generate (activated + has credits)
  canDownload,     // boolean - can user download (activated)
  paymentRequired, // boolean - is payment system enabled
  purchaseActivation, // () => Promise - redirect to activation checkout
  purchaseCredits,    // (quantity) => Promise - redirect to credits checkout
  refreshCredits,     // () => void - refresh credits from server
} = useCredits();
```

## Important Implementation Notes
- **Webhook is source of truth**: Never grant credits based on redirect success; only webhook
- **Atomic credit usage**: Credits are decremented before AI generation starts
- **Profile creation**: Handled server-side via admin client (RLS blocks client inserts)
- **Auth timeouts**: 3-5 second timeouts on profile fetch to prevent infinite loading
- **Session recovery**: Uses localStorage session when valid, falls back to getSession API
