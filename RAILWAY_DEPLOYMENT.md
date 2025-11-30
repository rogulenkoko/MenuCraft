# Deploy to Railway in 10 Minutes (Step-by-Step)

**Goal**: Get your app live for free using Railway's $5/month credit.

---

## ✅ Pre-Deployment Checklist

- [ ] GitHub account (with MenuCraft repo)
- [ ] All your `.env` variables ready (Supabase, Stripe, Anthropic keys)
- [ ] `package.json` has `start` script (already ✓ in your project)
- [ ] Your code is pushed to GitHub main branch

---

## 🚀 Step 1: Create Railway Account (2 minutes)

### Via GitHub (Easiest)
1. Open https://railway.app
2. Click **"Login"** button (top right)
3. Select **"Continue with GitHub"**
4. Click **"Authorize railway"**
5. ✅ Done! You're logged in

---

## 🚀 Step 2: Deploy Your App (3 minutes)

### Create New Railway Project

1. Click **"+ New Project"** (top left of dashboard)

   ![Railway: New Project]

2. Select **"Deploy from GitHub repo"**

   ![Select: Deploy from GitHub]

3. **Authorize Railway** (if prompted)
   - Click "Authorize railway-app"
   - Select your GitHub account
   - Click "Authorize"

4. **Find your repo:**
   - Search for: **"MenuCraft"** (or your repo name)
   - Click your repo to select it

5. **Click "Deploy"**
   - Railway clones your repo
   - Runs: `npm ci` (installs dependencies)
   - Runs: `npm run build` (builds your app)
   - Runs: `npm start` (starts your app)
   - You see the logs in real-time ✓

6. **Wait for deployment:**
   - You'll see: `Listening on port 5000` ✓
   - Status changes to: **"Running"** (green checkmark)

---

## 🚀 Step 3: Add Environment Variables (4 minutes)

### In Railway Dashboard

1. Go to your newly created **MenuCraft** project
2. Click **"Variables"** tab (in the top menu)

3. **Add each variable** (copy-paste from your `.env`):

```
VITE_SUPABASE_URL
=
https://hmqiqgqfixwajpowytrc.supabase.co

VITE_SUPABASE_ANON_KEY
=
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

SUPABASE_SERVICE_ROLE_KEY
=
eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSI...

SUPABASE_JWT_SECRET
=
vvXI+dxF//ys0s3RVUWNipLNWMAop94i...

STRIPE_SECRET_KEY
=
sk_test_51SWjmcCPllLyKm4F...

VITE_STRIPE_PUBLIC_KEY
=
pk_test_51SWjmcCPllLyKm4F...

ANTHROPIC_API_KEY
=
sk-ant-api03-hBVN84kijREn...

SESSION_SECRET
=
your-random-32-character-string-here

NODE_ENV
=
production

PORT
=
5000

PAYMENT_REQUIRED
=
true

ENABLE_DEV_SUBSCRIPTION_BYPASS
=
false
```

4. **Click "Deploy"** button (red button, bottom right)
   - Railway redeploys with new variables
   - Watch the logs build again

5. Wait for status: **"Running"** ✓

---

## 🎉 Step 4: Your App is Live! (Done!)

### Get Your Live URL

1. In Railway dashboard, go to **"Deployments"** tab
2. Click the **green checkmark** ✓ deployment
3. Click **"View Deployment"** button
4. Your app opens in a new tab!

**Your URL**: `https://menucraft-xxxxxxx.railway.app`

---

## 🧪 Test Your App

In the live app:

1. ✅ **Landing page loads** (should see hero section)
2. ✅ **Sign up works** (uses Supabase auth)
3. ✅ **File upload works** (uses Supabase storage)
4. ✅ **Generate menu works** (calls Anthropic API)
5. ✅ **Stripe payment works** (in test mode)

If something breaks:
- Go to Railway → **"Logs"** tab
- See the error message
- Fix locally: `npm run dev`
- Push to GitHub: `git push origin main`
- Railway auto-redeploys

---

## 📊 Monitor Your App

### View Logs (Real-Time)

1. Railway dashboard → Your project
2. Click **"Logs"** tab
3. See all app output in real-time
4. Search for errors

### View Usage

1. Railway dashboard → Your project
2. Click **"Metrics"** tab
3. See compute hours used
4. You have ~500 hours/month

### View Environment Variables

1. Railway dashboard → Your project
2. Click **"Variables"** tab
3. See all variables (values hidden for security)

---

## 🔄 Deploy Updates (After Changes)

### Easiest Way: Git Push

```bash
# Make changes to your code
vim client/src/App.tsx

# Commit and push
git add .
git commit -m "Updated landing page"
git push origin main

# Railway automatically:
# 1. Detects the push
# 2. Pulls latest code
# 3. Runs: npm run build
# 4. Runs: npm start
# 5. Deploys new version
# ✓ Your app updates automatically!
```

### Manual Redeploy (If needed)

1. Railway dashboard → Your project
2. Click **"Deploy"** tab
3. Click **"Redeploy"** on latest
4. Wait for it to start

---

## 🆓 Using Your Free $5 Credit

- Your $5 free credit lasts **until used up**
- Cost: $0.05/hour when running
- For light usage: **lasts ~100 hours** (~3 months)
- When credit expires: Optional to add card
  - Just add card if you want to keep running
  - Or let app sleep (won't charge you)

### Monitor Your Credit

1. Railway dashboard (top left)
2. Click your username → **"Billing"**
3. See current balance
4. Set spending limit to prevent surprise charges

---

## 🌐 Optional: Add Custom Domain (10 minutes)

### Via Cloudflare (Free)

1. Register domain:
   - Namecheap: $0.88/year
   - Freenom: Free (.ML, .GA, .CF)
   - Your registrar

2. In Railway:
   - Go to your project
   - Click **"Settings"** tab
   - Scroll to **"Custom Domain"**
   - Enter your domain: `yourdomain.com`
   - Railway shows you what to do next

3. In Cloudflare:
   - Create account: cloudflare.com
   - "Add a Site" → your domain
   - Update nameservers (copy from Railway)
   - Update in your domain registrar
   - Wait 5-10 minutes for DNS to propagate

4. ✅ Your app is at: `https://yourdomain.com`

---

## ❌ Troubleshooting

### App shows "Deploy Failed"

**Check the build logs:**
1. Railway → Deployments
2. Click the failed deployment (red X)
3. Scroll down to see the error
4. Common causes:
   - Missing environment variable
   - npm build command failed
   - Wrong Node.js version

**Fix it:**
```bash
# Test locally first
npm run build
npm start
# If it works locally, it works on Railway
```

### App is "Running" but shows blank page

**Check the logs:**
1. Railway → Logs
2. Look for error messages
3. Common causes:
   - Missing SUPABASE keys → Add in Variables
   - Port not 5000 → Set PORT=5000 in Variables
   - Build didn't include files → Check npm run build

**Fix it:**
1. Update variables in Railway
2. Click "Deploy" to redeploy
3. Test again

### Getting "Error: ENOENT" in logs

**The app can't find a file:**
1. Check: Are all files committed to GitHub?
2. Run: `git status` (should be clean)
3. Run: `git push origin main`
4. Railway will redeploy

### Supabase connection fails

**Check Supabase credentials:**
1. Get from: supabase.co dashboard
2. Compare with Railway Variables
3. Make sure they're exactly the same
4. Click "Deploy" to redeploy

---

## 📞 Getting Help

### Railway Docs
- https://docs.railway.app/
- Common issues: https://docs.railway.app/troubleshooting

### My App Logs
- See exact error: Railway → Logs
- Fix the error locally first
- Push to GitHub
- Railway redeploys automatically

### Your Repo Issues
- Push code with comments: `git commit -m "fixed xyz"`
- Use descriptive commit messages
- Check GitHub workflow (if using CI/CD)

---

## ✅ Deployment Checklist

- [ ] Railroad account created ✓
- [ ] GitHub repo connected ✓
- [ ] App deployed (green "Running" status) ✓
- [ ] All environment variables added ✓
- [ ] App loads at railway.app URL ✓
- [ ] Sign up works ✓
- [ ] File upload works ✓
- [ ] Menu generation works ✓
- [ ] Share your live URL with friends! 🎉

---

## 🎯 Next Steps

1. **Monitor**: Check Railway dashboard weekly for usage
2. **Set Budget Alert**: Prevent surprise charges (Railway → Billing)
3. **Add Custom Domain**: Point yourdomain.com to your app
4. **Backup Database**: Supabase handles this automatically
5. **Track API Usage**: Anthropic and Stripe dashboards

---

## 🎉 You're Done!

Your app is **live and free**. 

Share your URL: `https://menucraft-xxxxx.railway.app`

**That's it!** No DevOps, no Docker, no servers to manage.

When you push to GitHub, Railway automatically rebuilds and deploys.

Enjoy your $0 hosting! 🚀

