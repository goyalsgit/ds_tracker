# Service Limitations & Quotas

## Supabase Free Tier Limits

Your current Supabase setup (rbddecjzztgpdfyjfbmh.supabase.co) has these limits:

### Database
- **500 MB database space** - Your schema is lightweight, should handle 10,000+ problems easily
- **2 GB bandwidth/month** - Each API call is ~1-5 KB, so ~400,000-2,000,000 requests/month
- **50,000 monthly active users** - More than enough for personal use
- **Unlimited API requests** - No hard limit on queries
- **500 MB file storage** - Not using this currently

### Paused Projects
- **Inactive projects pause after 1 week** - You must access your project at least once per week
- **Solution**: Set up a weekly cron job to ping your database

### Row-Level Security (RLS)
- Currently **NOT enabled** on your tables - Anyone with your anon key can read/write all data
- **CRITICAL**: Enable RLS before deploying publicly

```sql
-- Enable RLS on all tables
alter table users enable row level security;
alter table questions enable row level security;
alter table solves enable row level security;
alter table revisions enable row level security;
alter table calendar_events enable row level security;
alter table google_tokens enable row level security;
alter table settings enable row level security;

-- Policy: Users can only see their own data
create policy "Users can view own data"
  on users for select
  using (auth.uid() = auth_user_id);

create policy "Users can view own solves"
  on solves for all
  using (user_id in (
    select id from users where auth_user_id = auth.uid()
  ));

create policy "Users can view own revisions"
  on revisions for all
  using (solve_id in (
    select s.id from solves s
    join users u on s.user_id = u.id
    where u.auth_user_id = auth.uid()
  ));

-- Similar policies for other tables...
```

## Google Calendar API Limits

### Free Tier (No billing account)
- **1,000,000 queries/day** - More than enough
- **10 queries/second/user** - Your sync creates ~10-50 events at once, well within limits

### Rate Limiting
- If you hit rate limits, implement exponential backoff:

```typescript
async function createEventWithRetry(calendar, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await calendar.events.insert(params);
    } catch (error) {
      if (error.code === 429 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

### OAuth Token Expiry
- **Access tokens expire after 1 hour** - Your code already handles refresh
- **Refresh tokens expire after 6 months of inactivity** - User must re-authenticate
- **Solution**: Prompt users to reconnect if refresh fails

## LeetCode GraphQL API Limits

### Unofficial API
- **No official rate limits published**
- **Observed limits**: ~60 requests/minute
- **Risk**: API can change without notice (it's not officially supported)

### Current Issues
1. **Only fetches last 20 submissions** - You're missing historical data
2. **No pagination in your current implementation**
3. **Private profiles return no data**

### Solutions
1. **Add pagination** (see ANALYSIS_AND_GUIDE.md)
2. **Cache results** to avoid repeated fetches
3. **Rate limit your requests** (1 request/second)

```typescript
// Add to .env.local
LEETCODE_RATE_LIMIT_MS=1000

// In leetcode.ts
const RATE_LIMIT = parseInt(process.env.LEETCODE_RATE_LIMIT_MS ?? '1000');
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options: RequestInit) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT) {
    await new Promise(resolve => 
      setTimeout(resolve, RATE_LIMIT - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
  return fetch(url, options);
}
```

## Vercel Deployment Limits (Free Hobby Plan)

### Bandwidth
- **100 GB/month** - Each page load is ~500 KB, so ~200,000 page views/month
- **Your usage**: Likely <1 GB/month for personal use

### Build Time
- **6 hours/month** - Each build takes ~2-5 minutes
- **Your usage**: ~10-20 builds/month = 20-100 minutes

### Serverless Function Execution
- **100 GB-hours/month** - Each API call runs for ~100-500ms
- **Your usage**: ~200,000-1,000,000 API calls/month

### Cron Jobs
- **Free on Hobby plan** - Up to 2 cron jobs
- **Limitation**: Max 1 execution/minute

### Edge Functions
- **500,000 requests/month** - Not using these currently

## GitHub Student Developer Pack Benefits

You have access to these FREE services:

### 1. **Vercel Pro** (Free for 12 months)
- **Unlimited bandwidth** (vs 100 GB)
- **Unlimited build minutes** (vs 6 hours)
- **Unlimited serverless execution** (vs 100 GB-hours)
- **Password protection** for staging
- **Analytics**

**How to activate**: 
1. Go to https://vercel.com/github-students
2. Sign in with GitHub
3. Verify student status

### 2. **Supabase Pro** (Free for 12 months)
- **8 GB database** (vs 500 MB)
- **250 GB bandwidth** (vs 2 GB)
- **100 GB file storage** (vs 500 MB)
- **No project pausing**
- **Daily backups**

**How to activate**:
1. Go to https://supabase.com/github-students
2. Sign in with GitHub
3. Apply credits to your project

### 3. **DigitalOcean** ($200 credit for 12 months)
- Can host your own PostgreSQL database
- More control than Supabase
- **Not recommended** unless you need >8 GB database

### 4. **MongoDB Atlas** (Free $50 credit)
- Alternative to PostgreSQL
- **Not recommended** - your schema is relational

### 5. **Heroku** (Free credits)
- Alternative to Vercel
- **Not recommended** - Vercel is better for Next.js

## Recommended Setup for Your Use Case

### Current (Free Tier)
✅ Supabase Free (500 MB database)
✅ Vercel Hobby (100 GB bandwidth)
✅ Google Calendar API (free)
✅ LeetCode GraphQL (unofficial, free)

**Cost**: $0/month
**Limitations**: 
- Supabase pauses after 1 week inactivity
- 100 GB Vercel bandwidth
- Only last 20 LeetCode submissions

### Recommended (Student Pack)
✅ Supabase Pro (8 GB database, no pausing)
✅ Vercel Pro (unlimited bandwidth)
✅ Google Calendar API (free)
✅ LeetCode GraphQL (unofficial, free)

**Cost**: $0/month for 12 months
**Benefits**:
- No project pausing
- Daily backups
- Unlimited bandwidth
- Analytics

### Activation Steps

1. **Verify GitHub Student Pack**
   ```bash
   # Check if you have it
   # Go to: https://education.github.com/pack
   ```

2. **Activate Vercel Pro**
   - Visit: https://vercel.com/github-students
   - Sign in with GitHub
   - Link your account

3. **Activate Supabase Pro**
   - Visit: https://supabase.com/github-students
   - Sign in with GitHub
   - Apply credits to project `rbddecjzztgpdfyjfbmh`

4. **Deploy to Vercel**
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

5. **Set up environment variables in Vercel**
   - Go to Vercel dashboard → Settings → Environment Variables
   - Add all variables from `.env.local`
   - Add `CRON_SECRET` for automated syncs

6. **Update Google OAuth redirect URIs**
   - Go to Google Cloud Console
   - Add production URL: `https://your-app.vercel.app/api/google/callback`

## Monitoring & Alerts

### Supabase
- Dashboard: https://supabase.com/dashboard/project/rbddecjzztgpdfyjfbmh
- Check: Database size, bandwidth usage, API requests

### Vercel
- Dashboard: https://vercel.com/dashboard
- Check: Bandwidth, function execution time, build minutes

### Google Calendar API
- Console: https://console.cloud.google.com/apis/dashboard
- Check: Quota usage, error rates

## Cost Projections (After Student Pack Expires)

### Supabase Pro
- **$25/month** - 8 GB database, 250 GB bandwidth
- **Alternative**: Stay on free tier if usage is low

### Vercel Pro
- **$20/month** - Unlimited bandwidth
- **Alternative**: Stay on Hobby if <100 GB bandwidth

### Total
- **$45/month** after 12 months
- **$0/month** if you stay on free tiers

## Recommendations

1. **Activate Student Pack NOW** - Get 12 months free
2. **Enable RLS on Supabase** - Critical security issue
3. **Set up Vercel cron jobs** - Automate LeetCode sync
4. **Monitor usage** - Check dashboards monthly
5. **Plan for expiry** - Decide if you'll pay or downgrade after 12 months
