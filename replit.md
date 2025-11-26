# Claude Menu - AI-Powered Restaurant Menu Designer

## Overview
Claude Menu is a SaaS application that transforms restaurant menus into stunning, professional designs using AI. Users follow a multi-step wizard to configure their menu design, upload PDF/DOCX files or paste text, and receive AI-generated HTML menus.

## Current State
**Status**: Production-ready with Supabase architecture

## User Flow
1. **Landing page IS the generator** - Users start designing immediately without signing in
2. **Multi-step wizard** - 9 steps with skip functionality for most steps
3. **Login on generate** - Users sign in only when clicking "Generate Menu"
4. **First menu free** - New users get one free menu generation
5. **Subscription for more** - Upgrade required for downloads or additional generations

## Architecture

### Current Stack
- **Frontend**: React + Vite + TailwindCSS + Shadcn/UI
- **Backend**: Express with Supabase JWT verification
- **Authentication**: Supabase Auth with Google OAuth
- **Database**: Supabase PostgreSQL with Row Level Security
- **AI Generation**: Claude API (claude-sonnet-4) via Express backend
- **Payments**: Stripe API integration (optional)

### Frontend (`client/`)
- **Framework**: React with Wouter for routing
- **UI Library**: Shadcn/UI components with Tailwind CSS
- **State**: React hooks + direct Supabase client calls
- **Pages**:
  - `/` - Menu generator wizard (public, login on generate)
  - `/auth/callback` - OAuth callback handler
  - `/dashboard` - User dashboard with generation history (auth required)
  - `/generate` - Alias for landing page
  - `/result/:id` - View and download generated designs (auth required)
  - `/subscribe` - Stripe subscription checkout (auth required)

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

### Supabase Configuration
- **Tables**: `profiles`, `menu_generations`
- **Storage**: `menu-files` bucket for uploads (optional)
- **Edge Functions**:
  - `generate-menu` - Claude AI menu generation
  - `extract-text` - PDF/DOCX text extraction
  - `stripe-checkout` - Create Stripe checkout session
  - `stripe-portal` - Open Stripe customer portal

### Database Schema (Supabase)
```sql
-- profiles (linked to auth.users)
- id (UUID, PK, references auth.users)
- email, name, avatar_url
- stripe_customer_id, stripe_subscription_id, subscription_status

-- menu_generations
- id (UUID, PK)
- user_id (FK to profiles)
- file_name, extracted_text, colors, size, style_prompt
- html_variations (text array)
- selected_variation, is_downloaded
- created_at
```

## Environment Variables

### Required for Supabase:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

### Required in Supabase Edge Function secrets:
- `ANTHROPIC_API_KEY` - Claude AI API key
- `STRIPE_SECRET_KEY` - Stripe secret key (if subscriptions enabled)

### Optional:
- `VITE_SUBSCRIPTION_REQUIRED` - Set to "false" to disable subscription system (default: "true")
- `STRIPE_PRICE_ID` - Reusable Stripe price ID

## Subscription Modes

### 1. Subscription Required (default)
When `VITE_SUBSCRIPTION_REQUIRED=true` or not set:
- Users can generate menus for FREE
- Subscription required only for DOWNLOADING designs
- Uses Stripe checkout via Supabase Edge Function

### 2. Subscription Disabled
When `VITE_SUBSCRIPTION_REQUIRED=false`:
- Everything is FREE
- No Stripe integration needed
- All subscription UI is hidden
- Perfect for free/open-source deployments

## Setup Instructions

### 1. Create Supabase Project
1. Go to https://supabase.com and create a new project
2. Copy the project URL and anon key from Settings > API

### 2. Set Up Database
Run the SQL from `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor

### 3. Enable Google OAuth
1. Go to Authentication > Providers > Google
2. Enable Google provider
3. Add Google OAuth credentials (from Google Cloud Console)
4. Copy the Redirect URL and add it to Google Cloud Console

### 4. Deploy Edge Functions (optional, for AI generation)
```bash
supabase functions deploy generate-menu
supabase functions deploy extract-text
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
```

### 5. Set Edge Function Secrets
```bash
supabase secrets set ANTHROPIC_API_KEY=your-key
supabase secrets set STRIPE_SECRET_KEY=your-key
```

### 6. Configure Environment
Add to Replit Secrets or .env:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

## Key Features
1. **Google OAuth**: Sign in with Google via Supabase Auth
2. **Free Generation**: Generate menu designs for FREE
3. **Optional Subscription**: Pay only to download (configurable)
4. **File Upload**: Drag-and-drop PDF, DOCX, or TXT files
5. **AI Generation**: Claude creates 3 unique professional HTML designs
6. **Customization**: Color palette picker, size selection, style prompts
7. **Download**: Export designs as standalone HTML files
8. **Dashboard**: View generation history

## Development

### Local Development
```bash
npm run dev
```

### Type Checking
```bash
npm run check
```

## Migration Notes

### From Previous Architecture
The app previously used:
- Replit Auth → Now uses Supabase Auth with Google OAuth
- Express backend → Now uses Supabase Edge Functions
- Direct PostgreSQL → Now uses Supabase PostgreSQL with RLS
- Server-side sessions → Now uses Supabase JWT sessions

### Benefits of New Architecture
- **Single database** - Supabase PostgreSQL for all data (profiles, generations)
- **Secure API keys** - Server-side admin client handles writes, client only reads
- **Row Level Security** - Database automatically enforces user access for reads
- **Auth with fallbacks** - localStorage session recovery with timeouts
- **Automatic scaling** - Supabase handles database and auth scaling

### Important Implementation Notes
- **Profile creation**: Handled server-side via admin client (RLS blocks client inserts)
- **Auth timeouts**: 3-5 second timeouts on profile fetch to prevent infinite loading
- **Session recovery**: Uses localStorage session when valid, falls back to getSession API
