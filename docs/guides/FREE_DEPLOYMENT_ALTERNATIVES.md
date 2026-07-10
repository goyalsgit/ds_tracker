# Free Deployment Alternatives (No Student Pack Required)

## Overview

You can deploy your DSA tracker completely FREE using these alternatives:

1. **Vercel Free Tier** (no Student Pack needed)
2. **Supabase Free Tier** (you're already using this)
3. **Railway** (Alternative to Vercel)
4. **Render** (Alternative to Vercel)
5. **Netlify** (Alternative to Vercel)

## Option 1: Vercel Free Tier (Recommended)

### Why Vercel?
- ✅ **100 GB bandwidth/month** (enough for personal use)
- ✅ **Unlimited API requests**
- ✅ **Free custom domain**
- ✅ **Automatic HTTPS**
- ✅ **Best Next.js support** (made by same company)
- ✅ **Free cron jobs** (2 cron jobs)

### Limitations
- 100 GB bandwidth/month (plenty for 1-10 users)
- 6 hours build time/month (20-30 builds)
- No password protection for preview deployments

### Deployment Steps

1. **Create Vercel Account**
   ```bash
   # Go to https://vercel.com/signup
   # Sign up with GitHub (free)
   ```

2. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   vercel login
   ```

3. **Deploy**
   ```bash
   cd /path/to/your/project
   vercel --prod
   ```

4. **Set Environment Variables**
   - Go to: https://vercel.com/dashboard
   - Select your project → Settings → Environment Variables
   - Add all variables from `.env.local`
   - Update `GOOGLE_CALENDAR_REDIRECT_URI` to your Vercel URL

5. **Update Google OAuth**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Add redirect URI: `https://your-app.vercel.app/api/google/callback`

6. **Update Supabase Auth**
   - Go to: https://supabase.com/dashboard/project/rbddecjzztgpdfyjfbmh/auth/url-configuration
   - Add Site URL: `https://your-app.vercel.app`
   - Add Redirect URLs: `https://your-app.vercel.app/**`

### Cost
**$0/month forever**

---

## Option 2: Railway (Great Alternative)

### Why Railway?
- ✅ **$5 free credit/month** (enough for small apps)
- ✅ **Automatic deployments from GitHub**
- ✅ **Free PostgreSQL database** (1 GB)
- ✅ **Cron jobs supported**
- ✅ **Easy to use**

### Limitations
- $5/month credit (usually enough, but monitor usage)
- After $5, you need to add payment method

### Deployment Steps

1. **Create Railway Account**
   - Go to: https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add Environment Variables**
   - Click on your service
   - Go to "Variables" tab
   - Add all variables from `.env.local`

4. **Generate Domain**
   - Go to "Settings" tab
   - Click "Generate Domain"
   - Copy the URL (e.g., `your-app.up.railway.app`)

5. **Update Google OAuth**
   - Add redirect URI: `https://your-app.up.railway.app/api/google/callback`

6. **Update Supabase Auth**
   - Add Site URL: `https://your-app.up.railway.app`

### Cost
**$0/month** (if usage stays under $5/month)

---

## Option 3: Render (Completely Free)

### Why Render?
- ✅ **Completely free tier** (no credit card required)
- ✅ **Automatic deployments from GitHub**
- ✅ **Free PostgreSQL database** (90 days, then expires)
- ✅ **Free SSL certificates**
- ✅ **Cron jobs supported**

### Limitations
- ⚠️ **Service spins down after 15 minutes of inactivity** (cold starts)
- ⚠️ **First request after inactivity takes 30-60 seconds**
- Free PostgreSQL expires after 90 days (use Supabase instead)

### Deployment Steps

1. **Create Render Account**
   - Go to: https://render.com
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repo

3. **Configure Service**
   - **Name**: `dsa-tracker`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Add Environment Variables**
   - Scroll down to "Environment Variables"
   - Add all variables from `.env.local`

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)

6. **Get Your URL**
   - Copy URL (e.g., `https://dsa-tracker.onrender.com`)

7. **Update Google OAuth**
   - Add redirect URI: `https://dsa-tracker.onrender.com/api/google/callback`

8. **Update Supabase Auth**
   - Add Site URL: `https://dsa-tracker.onrender.com`

### Cost
**$0/month forever**

### Workaround for Cold Starts
Use a free uptime monitoring service to ping your app every 10 minutes:
- **UptimeRobot**: https://uptimerobot.com (free, 50 monitors)
- **Cron-job.org**: https://cron-job.org (free, unlimited)

---

## Option 4: Netlify (Good for Static Sites)

### Why Netlify?
- ✅ **100 GB bandwidth/month**
- ✅ **Automatic deployments from GitHub**
- ✅ **Free custom domain**
- ✅ **Free SSL certificates**

### Limitations
- ⚠️ **Serverless functions limited** (125,000 requests/month)
- ⚠️ **Not ideal for Next.js** (better for static sites)
- ⚠️ **No native cron jobs** (need external service)

### Deployment Steps

1. **Create Netlify Account**
   - Go to: https://netlify.com
   - Sign up with GitHub

2. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify login
   ```

3. **Deploy**
   ```bash
   cd /path/to/your/project
   netlify deploy --prod
   ```

4. **Add Environment Variables**
   - Go to: Site settings → Environment variables
   - Add all variables from `.env.local`

### Cost
**$0/month**

---

## Option 5: Self-Hosted (VPS)

### Free VPS Options

#### A. Oracle Cloud (Always Free)
- ✅ **2 VMs with 1 GB RAM each** (forever free)
- ✅ **200 GB storage**
- ✅ **10 TB bandwidth/month**
- ✅ **No credit card required** (in some regions)

**Steps:**
1. Sign up: https://www.oracle.com/cloud/free/
2. Create VM instance (Ubuntu 22.04)
3. Install Node.js and PostgreSQL
4. Deploy your app

#### B. Google Cloud (Free Tier)
- ✅ **1 f1-micro VM** (forever free)
- ✅ **30 GB storage**
- ✅ **1 GB egress/month**
- ⚠️ Requires credit card

**Steps:**
1. Sign up: https://cloud.google.com/free
2. Create Compute Engine instance
3. Install Node.js
4. Deploy your app

---

## Recommended Setup (100% Free)

### For Your Use Case:

**Option A: Best Performance**
```
Frontend + API: Vercel Free Tier
Database: Supabase Free Tier
Cron Jobs: Vercel Cron (free)
Email: Resend Free Tier (3,000 emails/month)
```
**Cost**: $0/month
**Limitations**: 100 GB bandwidth, project pauses after 1 week inactivity

**Option B: No Cold Starts**
```
Frontend + API: Railway
Database: Supabase Free Tier
Cron Jobs: Railway Cron
Email: Resend Free Tier
```
**Cost**: $0/month (if usage < $5/month)
**Limitations**: $5 credit/month

**Option C: Completely Free (with cold starts)**
```
Frontend + API: Render Free Tier
Database: Supabase Free Tier
Cron Jobs: Render Cron
Email: Resend Free Tier
Uptime Monitor: UptimeRobot (to prevent cold starts)
```
**Cost**: $0/month forever
**Limitations**: Cold starts after 15 min inactivity

---

## Comparison Table

| Service | Cost | Bandwidth | Cold Starts | Cron Jobs | Best For |
|---------|------|-----------|-------------|-----------|----------|
| **Vercel** | $0 | 100 GB/mo | No | Yes (2) | Next.js apps |
| **Railway** | $0* | Unlimited | No | Yes | Full-stack apps |
| **Render** | $0 | 100 GB/mo | Yes (15min) | Yes | Side projects |
| **Netlify** | $0 | 100 GB/mo | No | No | Static sites |
| **Oracle Cloud** | $0 | 10 TB/mo | No | Yes | Self-hosted |

*Railway: Free if usage < $5/month

---

## My Recommendation for You

### Use Vercel Free Tier + Supabase Free Tier

**Why?**
1. ✅ **Best Next.js support** (Vercel made Next.js)
2. ✅ **No cold starts** (instant response)
3. ✅ **Free cron jobs** (for automation)
4. ✅ **100 GB bandwidth** (enough for personal use)
5. ✅ **Easy deployment** (one command)
6. ✅ **Automatic HTTPS**
7. ✅ **Free custom domain**

**Limitations:**
- Supabase project pauses after 1 week inactivity
- **Solution**: Set up a cron job to ping your database weekly

---

## Keeping Supabase Active (Free Tier)

### Problem
Supabase free tier pauses after 1 week of inactivity.

### Solution 1: Weekly Cron Job (Vercel)

```typescript
// src/app/api/cron/keep-alive/route.ts
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = getSupabaseServer();
  
  // Simple query to keep database active
  const { data } = await supabase
    .from('users')
    .select('count')
    .limit(1);
  
  return Response.json({ 
    status: 'alive',
    timestamp: new Date().toISOString()
  });
}
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/keep-alive",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

### Solution 2: External Cron Service

Use **cron-job.org** (free):
1. Sign up: https://cron-job.org
2. Create new cron job
3. URL: `https://your-app.vercel.app/api/cron/keep-alive`
4. Schedule: Every 6 days
5. Add header: `Authorization: Bearer YOUR_CRON_SECRET`

---

## Deployment Checklist

- [ ] Choose deployment platform (Vercel recommended)
- [ ] Create account and deploy
- [ ] Set environment variables
- [ ] Update Google OAuth redirect URIs
- [ ] Update Supabase Auth settings
- [ ] Enable Row-Level Security on Supabase (CRITICAL)
- [ ] Set up cron jobs for automation
- [ ] Set up keep-alive cron for Supabase
- [ ] Test all features (login, sync, calendar)
- [ ] Monitor usage (check dashboards weekly)

---

## Next Steps

1. **Deploy to Vercel** (recommended)
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

2. **Enable RLS on Supabase** (CRITICAL)
   - See `DEPLOYMENT_GUIDE.md` Step 2

3. **Set up automation**
   - See `AUTOMATION_GUIDE.md`

4. **Monitor usage**
   - Vercel: https://vercel.com/dashboard
   - Supabase: https://supabase.com/dashboard

---

## Cost Projections

### Year 1 (Free Tier)
- **Vercel**: $0/month
- **Supabase**: $0/month
- **Total**: $0/month

### If You Exceed Free Tier
- **Vercel Pro**: $20/month (if >100 GB bandwidth)
- **Supabase Pro**: $25/month (if >500 MB database)
- **Total**: $45/month

### Recommendation
Start with free tier. You'll likely never exceed limits for personal use.

---

## Questions?

**Q: Which platform should I use?**
A: Vercel Free Tier (best for Next.js)

**Q: Will I need to pay?**
A: No, free tier is enough for personal use (1-10 users)

**Q: What if Supabase pauses my project?**
A: Set up weekly keep-alive cron job (see above)

**Q: Can I use a custom domain?**
A: Yes, all platforms support free custom domains

**Q: How do I set up automation?**
A: See `AUTOMATION_GUIDE.md`

**Q: Is my data secure?**
A: Enable RLS on Supabase first (see `DEPLOYMENT_GUIDE.md`)
