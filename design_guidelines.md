# Design Guidelines: Claude Menu SaaS Application

## Design Approach

**Reference-Based:** Drawing inspiration from **Vercel** (minimalist SaaS aesthetic), **Linear** (clean typography and hierarchy), and **Canva** (creative tools UX) to create a polished, professional menu generation platform.

**Core Principles:**
- Minimalist sophistication with generous whitespace
- Clear visual hierarchy prioritizing user workflow
- Professional credibility balanced with creative energy
- Efficient, distraction-free generation process

---

## Typography System

**Font Families:**
- Primary: Inter (interface, body text)
- Display: Cal Sans or similar geometric sans (hero headlines only)

**Type Scale:**
- Hero Display: text-6xl md:text-7xl font-bold tracking-tight
- Page Titles: text-4xl font-semibold
- Section Headers: text-2xl font-semibold
- Card Titles: text-lg font-medium
- Body: text-base leading-relaxed
- Captions/Labels: text-sm text-muted-foreground
- Micro-copy: text-xs

---

## Layout & Spacing System

**Spacing Primitives:** Tailwind units of **2, 4, 6, 8, 12, 16, 24**
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Grid gaps: gap-6 to gap-8
- Card spacing: p-6

**Container Strategy:**
- Landing: Full-width sections with max-w-7xl inner containers
- Dashboard/App: max-w-6xl centered
- Content areas: max-w-4xl for forms/settings

---

## Component Library

### Navigation
**Landing Header:**
- Fixed top, backdrop-blur-md with subtle border
- Logo left, nav links center, "Sign In" + "Get Started" CTA right
- py-4, max-w-7xl container

**App Dashboard Nav:**
- Left sidebar (w-64) with logo, menu items, user profile at bottom
- Top bar with breadcrumbs, notification bell, avatar
- Mobile: Collapsible hamburger menu

### Landing Page Structure

**Hero Section (80vh):**
- Centered two-column layout: headline/description left, hero illustration/screenshot right
- Headline: Display font, massive size
- Subheading: text-xl text-muted-foreground, max-w-2xl
- CTA pair: Primary "Start Generating" + Secondary "View Examples"
- Trust indicator below: "Trusted by 500+ restaurants" with small logos

**Features Section:**
- Three-column grid (grid-cols-1 md:grid-cols-3)
- Each card: Icon top, title, description, hover lift effect
- Icons: 48px, feature illustrations optional

**How It Works Section:**
- Numbered steps (1-2-3-4) in horizontal flow
- Each step: Large number, title, description, connecting arrows between
- Desktop: 4 columns, Mobile: stacked

**Pricing Section:**
- Two-column comparison (Free tier + Pro tier)
- Cards with list of features, prominent pricing, CTA button
- "Most Popular" badge on Pro tier

**CTA Footer Section:**
- Full-width with gradient background treatment
- Centered headline + description + primary CTA
- py-20

**Footer:**
- Four-column grid: Product links, Company, Resources, Social + Newsletter
- Copyright row at bottom

### File Upload Interface (/generate)

**Upload Area:**
- Large dashed border region (border-2 border-dashed)
- min-h-[400px] centered content
- Icon (upload cloud), headline, file type info
- "Drag and drop or click to browse"
- Active state: border solid, background shift on drag-over

**Settings Panel:**
- Left sidebar or top panel depending on viewport
- Sections: Color Palette, Size Selection, Style Prompt
- Each setting in card with label and control

**Color Palette Picker:**
- Grid of color swatches (4-5 selectable)
- Active state: ring-2 ring-offset-2
- Custom color input option

**Size Dropdown:**
- Shadcn Select component
- Options: A4, Letter, Square, Web Page, Tall Poster
- With dimension hints (e.g., "8.5 x 11 in")

**Style Prompt:**
- Textarea with placeholder examples
- Character counter at bottom right
- text-sm, min-h-[120px]

### Generation Results (/generate/result)

**Three-Column Preview Grid:**
- grid-cols-1 lg:grid-cols-3 gap-6
- Each preview card:
  - Aspect-ratio container with iframe/image preview
  - Title: "Design Variation 1, 2, 3"
  - "Select This Design" button below
  - Hover: subtle border glow, lift effect

**Selected State:**
- Ring highlight on selected card
- Show "Download HTML" and "Download PDF" buttons
- Swap "Select" button to "Selected" checkmark

### Dashboard Layout

**Stats Overview:**
- Grid of metric cards (grid-cols-1 md:grid-cols-3)
- Each card: Large number, label, trend indicator
- Minimal, clean presentation

**Recent Generations:**
- Table or card list of past menu generations
- Columns: Thumbnail, Name, Date, Size, Actions (view/download)
- Pagination at bottom

### Billing/Settings

**Subscription Status Card:**
- Current plan display
- Usage metrics (menus generated this month)
- "Manage Subscription" button to Stripe portal
- Upgrade CTA if on free tier

---

## Loading & Empty States

**Skeleton Loaders:**
- During AI generation: Three placeholder cards with pulsing animation
- Progress indicator: "Generating design variations... 30 seconds"
- Match actual card dimensions

**Empty States:**
- Dashboard with no generations: Illustration + "Generate your first menu" CTA
- Upload area when empty: Large icon + instructional text

---

## Interaction Patterns

**Form Validation:**
- Inline error messages below inputs
- Red border on invalid fields
- Success checkmarks on valid completion

**Toasts/Notifications:**
- Top-right corner, Shadcn toast component
- Success: green accent, Error: red accent
- Auto-dismiss after 5 seconds, closeable

**Buttons:**
- Primary: Solid fill, medium font-weight, px-6 py-3
- Secondary: Outline variant
- Ghost: Minimal for tertiary actions
- Loading state: Spinner icon + disabled

**CTAs:**
- Landing page: Larger buttons (px-8 py-4, text-lg)
- Hero CTA: Maximum prominence

---

## Responsive Behavior

**Breakpoints:**
- Mobile: Single column, stacked layouts
- Tablet (md:): Two columns for grids
- Desktop (lg:): Full three-column layouts

**Mobile Adjustments:**
- Sidebar navigation becomes bottom nav or hamburger
- Three-column previews stack vertically
- Hero switches to single column, image below text
- Reduce font sizes: Hero from text-7xl to text-4xl

---

## Images

**Hero Section:** 
Large hero image/illustration on the right side showing a beautifully designed restaurant menu mockup on a tablet or elegant display. Should convey professional quality and ease of use.

**Features Section:**
Optional small icons (48x48px) or simple illustrations for each feature card - upload icon, AI sparkle, download icon.

**How It Works Section:**
Step-by-step visual showing the workflow: PDF upload → AI processing → Three design previews → Download. Can be illustrated or use actual UI screenshots.

**Social Proof:**
Small restaurant logo badges or customer photos in testimonial section if included.

---

## Accessibility

- All interactive elements: min-h-[44px] touch targets
- Focus rings on all focusable elements
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels explicitly associated with inputs
- Alt text for all images
- ARIA labels for icon-only buttons