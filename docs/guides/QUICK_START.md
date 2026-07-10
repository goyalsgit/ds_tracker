# Quick Start Guide

## What You've Built

A DSA (Data Structures & Algorithms) tracker that:
- ✅ Syncs problems from LeetCode
- ✅ Creates spaced repetition revision schedules
- ✅ Syncs revision events to Google Calendar
- ✅ Tracks your progress

## Current Limitations

### 1. **LeetCode Sync**
- ❌ Only fetches last 20 submissions
- ❌ No automatic daily sync
- ✅ **Fix**: See `AUTOMATION_GUIDE.md` for batch sync + cron jobs

### 2. **Usage Tracking**
- ❌ No dashboard to see your stats
- ❌ No analytics on weak areas
- ✅ **Fix**: See `ANALYSIS_AND_GUIDE.md` for usage tracking

### 3. **Revision Recommendations**
- ❌ No intelligent recommendations
- ❌ No "problems you frequently fail" list
- ✅ **Fix**: See `ANALYSIS_AND_GUIDE.md` for AI recommendations

### 4. **Security**
- ❌ Row-Level Security (RLS) NOT enabled on Supabase
- ⚠️ **CRITICAL**: Anyone with your anon key can access all data
- ✅ **Fix**: See `DEPLOYMENT_GUIDE.md` Step 2 for RLS setup

### 5. **Automation**
- ❌ Manual LeetCode sync required
- ❌ Manual calendar sync required
- ✅ **Fix**: See `AUTOMATION_GUIDE.md` for cron jobs

## Service Limits

### Supabase (Free Tier)
- 500 MB database → ~10,000+ problems
- 2 GB bandwidth/month → ~400,000-2M requests
- ⚠️ **Project pauses after 1 week inactivity**
- ✅ **Upgrade**: Free with Student Pack (8 GB database, no pausing)

### Google Calendar API (Free)
- 1,000,000 queries/day → More than enough
- 10 queries/second/user → No issues

### LeetCode API (Unofficial)
- ~60 requests/minute → Add rate limiting
- ⚠️ **Can change without notice** (not officially supported)

### Vercel (Free Hobby)
- 100 GB bandwidth/month → ~200,000 page views
- 6 hours build time/month → ~10-20 builds
- ✅ **Upgrade**: Free with Student Pack (unlimited)

## GitHub Student Developer Pack

You have access to **$300+ in free credits**:

### 1. **Vercel Pro** (Free for 12 months)
- Unlimited bandwidth
- Unlimited builds
- Analytics
- **Activate**: https://vercel.com/github-students

### 2. **Supabase Pro** (Free for 12 months)
- 8 GB database (vs 500 MB)
- 250 GB bandwidth (vs 2 GB)
- No project pausing
- Daily backups
- **Activate**: https://supabase.com/github-students

### 3. **DigitalOcean** ($200 credit)
- Can host your own database
- **Not recommended** unless you need >8 GB

## How to Deploy

### Quick Deploy (5 minutes)

1. **Activate Student Pack**
   - Go to: https://education.github.com/pack
   - Verify with student ID or school email

2. **Upgrade Supabase**
   - Visit: https://supabase.com/github-students
   - Apply $300 credits to your project

3. **Enable RLS (CRITICAL)**
   ```sql
   -- Run in Supabase SQL Editor
   alter table users enable row level security;
   alter table questions enable row level security;
   alter table solves enable row level security;
   alter table revisions enable row level security;
   alter table calendar_events enable row level security;
   alter table google_tokens enable row level security;
   alter table settings enable row level security;
   ```
   See `DEPLOYMENT_GUIDE.md` for complete RLS policies.

4. **Deploy to Vercel**
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

5. **Set Environment Variables**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Copy all variables from `.env.local`
   - Update `GOOGLE_CALENDAR_REDIRECT_URI` to production URL

6. **Update Google OAuth**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Add redirect URI: `https://your-app.vercel.app/api/google/callback`

### Full Deployment Guide
See `DEPLOYMENT_GUIDE.md` for complete step-by-step instructions.

## How to Add Automation

### 1. Daily LeetCode Sync
```bash
# Create cron endpoint
# See AUTOMATION_GUIDE.md Section 1
```

### 2. Weekly Calendar Sync
```bash
# Create cron endpoint
# See AUTOMATION_GUIDE.md Section 2
```

### 3. Daily Email Reminders
```bash
# Set up Resend (free 3,000 emails/month)
# See AUTOMATION_GUIDE.md Section 4
```

### Complete Automation Guide
See `AUTOMATION_GUIDE.md` for all automation features.

## How to Add Features

### 1. Usage Tracking Dashboard
- Track problems solved per day
- Track revision success rate
- See weak areas
- **Guide**: `ANALYSIS_AND_GUIDE.md` Section 1

### 2. Revision Recommendations
- Problems you frequently fail
- Topics you haven't practiced
- Difficulty progression
- **Guide**: `ANALYSIS_AND_GUIDE.md` Section 2

### 3. Batch LeetCode Sync
- Fetch ALL problems (not just last 20)
- One-time full history import
- **Guide**: `ANALYSIS_AND_GUIDE.md` Section 3

### 4. Analytics Dashboard
- Success rate by difficulty
- Success rate by topic
- Revision completion trends
- **Guide**: `ANALYSIS_AND_GUIDE.md` Section 5

## Cost After Student Pack Expires (12 months)

### Option 1: Stay on Free Tier
- **Cost**: $0/month
- **Limitations**: 
  - 500 MB database
  - 100 GB bandwidth
  - Project pauses after 1 week

### Option 2: Upgrade to Pro
- **Vercel Pro**: $20/month
- **Supabase Pro**: $25/month
- **Total**: $45/month

### Recommendation
Start with free tier, upgrade only if you exceed limits.

## Next Steps

1. **Deploy to production** (see `DEPLOYMENT_GUIDE.md`)
2. **Enable RLS** (CRITICAL for security)
3. **Add automation** (see `AUTOMATION_GUIDE.md`)
4. **Add features** (see `ANALYSIS_AND_GUIDE.md`)
5. **Monitor usage** (check Vercel + Supabase dashboards)

## Support

- **Vercel**: https://vercel.com/docs
- **Supabase**: https://supabase.com/docs
- **Next.js**: https://nextjs.org/docs
- **Student Pack**: https://education.github.com/pack

## Files to Read

1. **QUICK_START.md** (this file) - Overview
2. **LIMITATIONS_AND_QUOTAS.md** - Service limits
3. **DEPLOYMENT_GUIDE.md** - How to deploy
4. **AUTOMATION_GUIDE.md** - How to automate
5. **ANALYSIS_AND_GUIDE.md** - How to add features

## Questions?

Common questions answered in:
- "How do I deploy?" → `DEPLOYMENT_GUIDE.md`
- "What are the limits?" → `LIMITATIONS_AND_QUOTAS.md`
- "How do I automate?" → `AUTOMATION_GUIDE.md`
- "How do I add features?" → `ANALYSIS_AND_GUIDE.md`
- "How do I use Student Pack?" → `DEPLOYMENT_GUIDE.md` Step 1-2
