# MenuCraft: Complete $0 Hosting Setup

Deploy your full-stack app for **absolutely free** using Railway + Supabase.

## 🎯 Best Option: Railway + Supabase ($0/month)

**Why Railway?**
- Free $5/month credit (enough for light app)
- Auto-deploys from GitHub
- No cold starts on hobby tier
- Perfect for Node.js + React
- Includes SSL/HTTPS

---

## 🚀 Quick Start (10 minutes)

### Step 1: Create Railway Account
```
1. Visit https://railway.app
2. Click "Login" → "GitHub"
3. Authorize Railway
4. Done! ✓
```

### Step 2: Deploy Your App
```
1. Click "+ New Project"
2. Select "Deploy from GitHub repo"
3. Search for your "MenuCraft" repo
4. Click "Deploy"
5. Railway starts building... (2-3 minutes)
```

### Step 3: Add Environment Variables
```
1. Go to your Railway project
2. Click "Variables" tab
3. Add all these (copy from your .env):

VITE_SUPABASE_URL=https://hmqiqgqfixwajpowytrc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSI...
SUPABASE_JWT_SECRET=vvXI+dxF//ys0s3RVUWNipLNWMAop94i...
STRIPE_SECRET_KEY=sk_test_51SWjmcCPllLyKm4F...
VITE_STRIPE_PUBLIC_KEY=pk_test_51SWjmcCPllLyKm4F...
ANTHROPIC_API_KEY=sk-ant-api03-hBVN84kijREn...
SESSION_SECRET=your-random-32-character-string
NODE_ENV=production
PORT=5000
PAYMENT_REQUIRED=true
ENABLE_DEV_SUBSCRIPTION_BYPASS=false

4. Click "Deploy" to redeploy with new variables
```

### Step 4: Your App is Live! 🎉
```
1. Go to "Deployments" tab
2. Click the green checkmark ✓
3. Click "View deployment"
4. Your app is live at: https://menucraft-xxxxxxx.railway.app
```

---

## 📊 Complete Free Tier Stack

| Service | Free Tier | Cost |
|---------|-----------|------|
| **Railway** (Backend + Frontend) | $5/month credit | $0 |
| **Supabase** (Database + Auth) | 500MB storage, 2M API calls | $0 |
| **Supabase Storage** (Files) | 1GB | $0 |
| **Stripe** (Payments - test mode) | Test transactions | $0 |
| **Anthropic** (AI API) | Pay-per-use (~$0.01/request) | ~$0-5/mo |
| **Cloudflare** (DNS) | Unlimited queries | $0 |
| **GitHub** (Repo + CI/CD) | Public repos | $0 |
| **Total** | | **~$0-5/month** |

---

## 💡 How It Works

### Railway Pricing
- **$0/month** base + **$5/month free credit**
- After credit expires: **$0.05/hour** (only if app is running)
- **500 hours/month** of compute included
- For a lightweight SaaS: **~$10-20/month** (after free tier)

### Example Monthly Usage
```
Your app running 24/7 = 730 hours/month
Cost after free tier = 730 hours × $0.05/hour = $36.50
BUT with $5 credit = $31.50/month

For light traffic (typical startup):
~200 hours/month = 200 × $0.05 = $10/month
```

---

## 🔄 Deploy Updates (Automatic)

```bash
# After making changes to your code:
git add .
git commit -m "My changes"
git push origin main

# Railway automatically:
# 1. Detects the push
# 2. Runs: npm run build
# 3. Runs: npm start
# 4. Deploys new version
# ✓ Done - no manual steps!
```

---

## 🛠️ Troubleshooting Free Tier

### App shows "Deploy error"
```bash
# Check build logs in Railway dashboard
1. Click your project
2. Go to "Deployments"
3. Click the failed deployment
4. Scroll to see error message
5. Common issues:
   - Missing environment variables → Add in Variables tab
   - Build script failed → Check npm run build locally
   - Port mismatch → Ensure PORT=5000 is set
```

### App crashes after deploy
```bash
# View logs in Railway dashboard
1. Click project
2. Go to "Logs" tab
3. See real-time errors
4. Or SSH in: railway shell

# Test build locally first:
npm run build
npm start
# If this works locally, should work on Railway
```

### "Free tier limit reached"
```
You've hit the $5/month free credit limit.
Options:
1. Add a credit card (pay for overages)
2. Reduce app resource usage
3. Switch to Render (see Alternative section)
4. Use free tier only - app sleeps after 15 mins inactivity
```

---

## 🌐 Optional: Custom Domain ($0)

### With Cloudflare Free Tier
```bash
# 1. Register domain (Namecheap: $0.88/yr) or use free domain
#    - Freedomain.one
#    - Freenom.com
#    - .ML/.GA/.CF domains

# 2. Point nameservers to Cloudflare
#    - Cloudflare.com → Add site
#    - Copy their nameservers
#    - Update domain registrar

# 3. In Railway → Settings → Custom Domain
#    - Add your domain
#    - Railway provides SSL automatically ✓

# Your app is now at: https://yourdomain.com
```

---

## 🔐 Security Checklist

- [ ] All sensitive keys in Railway Variables (not in code)
- [ ] `ENABLE_DEV_SUBSCRIPTION_BYPASS=false` in production
- [ ] Session secret is randomly generated (32+ chars)
- [ ] Stripe using test keys (until you go live)
- [ ] Anthropic API key is private (not exposed to frontend)

---

## 📈 Scaling Beyond Free Tier

When your app grows and free tier isn't enough:

### Option 1: Stay on Railway (Cheapest scaling)
- $0.05/hour for each unit
- Auto-scales horizontally
- ~$20-50/month for small production

### Option 2: Move to AWS (Better for high traffic)
- ~$50-100/month for 2-3 instances
- Better performance guarantees
- Use Elastic Beanstalk

### Option 3: Use Vercel + Separate Backend
- Vercel for frontend (free tier): $0-20/month
- Railway for backend: $5-20/month
- Total: $5-40/month

---

## 💾 Backups & Data Safety

Your data is safe with Supabase:
- ✅ Daily automated backups
- ✅ Point-in-time recovery (24 hours)
- ✅ Encrypted at rest
- ✅ Access backups from Supabase dashboard

---

## 📝 Deployment Checklist

- [ ] Railway account created
- [ ] GitHub repo connected to Railway
- [ ] All environment variables added to Railway
- [ ] First deploy completed (green checkmark ✓)
- [ ] App loads at railway.app URL
- [ ] Can generate menus (test Anthropic API)
- [ ] Stripe test payments work
- [ ] File uploads work
- [ ] Custom domain configured (optional)

---

## 🎯 Next Steps After Deployment

1. **Monitor Usage**: Railway dashboard shows compute hours
2. **Set Billing Alerts**: Prevent surprise charges
3. **Enable Database Backups**: Supabase → Settings → Backups
4. **Add Custom Domain**: Point your domain to Railway
5. **Setup Monitoring**: Railway has built-in error tracking

---

## 📞 Support Resources

- Railway Docs: https://docs.railway.app
- Supabase Docs: https://supabase.com/docs
- GitHub Issues: Report bugs here
- Railway Community: https://discord.gg/railway

---

## 🎉 You're Done!

Your app is now **live and completely free** (until it grows beyond free tier limits).

Share your Railway URL: `https://yourdomain.railway.app`

Celebrate! 🥳
