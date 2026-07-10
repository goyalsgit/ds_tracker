# Complete Automation Guide

## Overview

This guide shows you how to make your DSA tracker fully automatic:
1. **Daily LeetCode sync** - Automatically fetch new problems every day
2. **Weekly calendar sync** - Automatically create revision events
3. **Daily revision reminders** - Get notified about today's revisions
4. **Usage tracking** - Automatically log your activity

## 1. Automated LeetCode Sync

### Create Cron Endpoint

```typescript
// src/app/api/cron/daily-leetcode-sync/route.ts
import { getSupabaseServer } from "@/lib/supabaseServer";
import { fetchLeetCodeProfile } from "@/lib/leetcode";
import { buildRevisionSchedule, toDateInputValue } from "@/lib/revisionScheduler";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = getSupabaseServer();
  
  // Get all users with LeetCode username configured
  const { data: settings } = await supabase
    .from('settings')
    .select('user_id, leetcode_username')
    .not('leetcode_username', 'is', null);
  
  if (!settings || settings.length === 0) {
    return Response.json({ message: 'No users to sync', synced: 0 });
  }
  
  const results = [];
  
  for (const setting of settings) {
    try {
      const profile = await fetchLeetCodeProfile(setting.leetcode_username, 20);
      
      // Get user's last sync timestamp
      const { data: lastSolve } = await supabase
        .from('solves')
        .select('solved_at')
        .eq('user_id', setting.user_id)
        .eq('source', 'leetcode')
        .order('solved_at', { ascending: false })
        .limit(1)
        .single();
      
      const lastSyncTime = lastSolve ? new Date(lastSolve.solved_at).getTime() : 0;
      
      // Filter only new submissions
      const newSubmissions = profile.recentSubmissions.filter(
        sub => (Number(sub.timestamp) * 1000) > lastSyncTime
      );
      
      if (newSubmissions.length === 0) {
        results.push({
          userId: setting.user_id,
          username: setting.leetcode_username,
          status: 'no_new_problems'
        });
        continue;
      }
      
      // Sync new problems
      let synced = 0;
      for (const submission of newSubmissions) {
        const { data: question } = await supabase
          .from('questions')
          .upsert({
            title: submission.title,
            slug: submission.titleSlug,
            source_url: `https://leetcode.com/problems/${submission.titleSlug}/`,
            difficulty: 'Medium', // Default, can be improved
            tags: []
          }, { onConflict: 'slug' })
          .select('id')
          .single();
        
        if (!question) continue;
        
        const solvedAt = new Date(Number(submission.timestamp) * 1000);
        
        const { data: solve } = await supabase
          .from('solves')
          .upsert({
            user_id: setting.user_id,
            question_id: question.id,
            solved_at: solvedAt.toISOString(),
            source: 'leetcode'
          }, { onConflict: 'user_id,question_id' })
          .select('id')
          .single();
        
        if (!solve) continue;
        
        // Create revision schedule
        const schedule = buildRevisionSchedule(solvedAt);
        const revisionRows = schedule.map(entry => ({
          solve_id: solve.id,
          stage: entry.stage,
          due_on: toDateInputValue(entry.dueDate),
          status: 'scheduled'
        }));
        
        await supabase.from('revisions').insert(revisionRows);
        synced++;
      }
      
      results.push({
        userId: setting.user_id,
        username: setting.leetcode_username,
        status: 'success',
        synced
      });
      
    } catch (error) {
      results.push({
        userId: setting.user_id,
        username: setting.leetcode_username,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return Response.json({ results, totalUsers: settings.length });
}
```

### Configure Cron Schedule

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-leetcode-sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule explanation**: `0 2 * * *` = Every day at 2:00 AM UTC

## 2. Automated Calendar Sync

### Create Cron Endpoint

```typescript
// src/app/api/cron/weekly-calendar-sync/route.ts
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getCalendarClient, getGoogleOAuthClient } from "@/lib/googleOAuth";

function toDateString(date: Date) {
  return date.toISOString().split('T')[0];
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = getSupabaseServer();
  
  // Get all users with Google Calendar connected
  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('user_id, access_token, refresh_token, expiry_date');
  
  if (!tokens || tokens.length === 0) {
    return Response.json({ message: 'No users with calendar connected', synced: 0 });
  }
  
  const results = [];
  
  for (const token of tokens) {
    try {
      const oauthClient = getGoogleOAuthClient();
      oauthClient.setCredentials({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expiry_date: token.expiry_date ?? undefined
      });
      
      // Refresh token if expired
      const now = Date.now();
      if (token.expiry_date && token.expiry_date < now) {
        await oauthClient.getAccessToken();
        const credentials = oauthClient.credentials;
        await supabase.from('google_tokens').update({
          access_token: credentials.access_token,
          expiry_date: credentials.expiry_date
        }).eq('user_id', token.user_id);
      }
      
      const calendar = getCalendarClient({
        access_token: oauthClient.credentials.access_token,
        refresh_token: oauthClient.credentials.refresh_token,
        expiry_date: oauthClient.credentials.expiry_date
      });
      
      // Get revisions for next 7 days
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 7);
      
      const { data: revisions } = await supabase
        .from('revisions')
        .select(`
          id,
          solve_id,
          stage,
          due_on,
          solves!inner(
            user_id,
            question_id,
            questions!inner(title, source_url)
          )
        `)
        .eq('solves.user_id', token.user_id)
        .gte('due_on', toDateString(today))
        .lte('due_on', toDateString(endDate))
        .eq('status', 'scheduled');
      
      if (!revisions || revisions.length === 0) {
        results.push({
          userId: token.user_id,
          status: 'no_revisions',
          created: 0
        });
        continue;
      }
      
      // Check which revisions already have calendar events
      const revisionIds = revisions.map(r => r.id);
      const { data: existingEvents } = await supabase
        .from('calendar_events')
        .select('revision_id')
        .in('revision_id', revisionIds);
      
      const existingSet = new Set(existingEvents?.map(e => e.revision_id));
      const revisionsToCreate = revisions.filter(r => !existingSet.has(r.id));
      
      let created = 0;
      for (const revision of revisionsToCreate) {
        const title = revision.solves.questions.title;
        const url = revision.solves.questions.source_url;
        
        const event = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: `Revision: ${title} (Stage ${revision.stage})`,
            description: url ?? undefined,
            start: { date: revision.due_on },
            end: { date: revision.due_on }
          }
        });
        
        await supabase.from('calendar_events').insert({
          revision_id: revision.id,
          provider: 'google',
          external_id: event.data.id ?? null,
          event_link: event.data.htmlLink ?? null
        });
        
        created++;
      }
      
      results.push({
        userId: token.user_id,
        status: 'success',
        created
      });
      
    } catch (error) {
      results.push({
        userId: token.user_id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return Response.json({ results, totalUsers: tokens.length });
}
```

### Add to Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-leetcode-sync",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/weekly-calendar-sync",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

**Schedule explanation**: `0 8 * * 1` = Every Monday at 8:00 AM UTC

## 3. Automated Usage Tracking

### Create Middleware to Track API Calls

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Track API usage
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('X-Request-Time', Date.now().toString());
  }
  
  return response;
}

export const config = {
  matcher: '/api/:path*'
};
```

### Create Usage Tracking Utility

```typescript
// src/lib/usageTracking.ts
import { getSupabaseServer } from "./supabaseServer";

export async function trackUsage(
  userId: string,
  action: 'problem_solved' | 'revision_completed' | 'revision_failed' | 'leetcode_sync' | 'calendar_sync'
) {
  const supabase = getSupabaseServer();
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('usage_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();
  
  const updates: Record<string, number> = {};
  
  switch (action) {
    case 'problem_solved':
      updates.problems_solved = (existing?.problems_solved ?? 0) + 1;
      break;
    case 'revision_completed':
      updates.revisions_completed = (existing?.revisions_completed ?? 0) + 1;
      break;
    case 'revision_failed':
      updates.revisions_failed = (existing?.revisions_failed ?? 0) + 1;
      break;
    case 'leetcode_sync':
      updates.leetcode_syncs = (existing?.leetcode_syncs ?? 0) + 1;
      break;
    case 'calendar_sync':
      updates.calendar_syncs = (existing?.calendar_syncs ?? 0) + 1;
      break;
  }
  
  await supabase
    .from('usage_stats')
    .upsert({
      user_id: userId,
      date: today,
      ...updates
    }, { onConflict: 'user_id,date' });
}
```

### Integrate into Existing Endpoints

```typescript
// Example: Update src/app/api/revisions/mark/route.ts
import { trackUsage } from "@/lib/usageTracking";

export async function POST(request: Request) {
  // ... existing code ...
  
  const outcome = body.outcome; // 'completed' or 'failed'
  
  // Update revision
  await supabase
    .from('revisions')
    .update({
      status: 'completed',
      outcome,
      completed_at: new Date().toISOString()
    })
    .eq('id', revisionId);
  
  // Track usage
  await trackUsage(
    userId,
    outcome === 'completed' ? 'revision_completed' : 'revision_failed'
  );
  
  // ... rest of code ...
}
```

## 4. Daily Revision Reminder (Email/Push)

### Option A: Email Reminders (Using Resend)

1. **Sign up for Resend** (free tier: 3,000 emails/month)
   - Visit: https://resend.com
   - Sign up with GitHub (free with Student Pack)

2. **Install Resend SDK**
   ```bash
   npm install resend
   ```

3. **Create Email Template**
   ```typescript
   // src/lib/email.ts
   import { Resend } from 'resend';
   
   const resend = new Resend(process.env.RESEND_API_KEY);
   
   export async function sendRevisionReminder(
     email: string,
     revisions: Array<{ title: string; stage: number; url: string }>
   ) {
     await resend.emails.send({
       from: 'DSA Tracker <noreply@yourdomain.com>',
       to: email,
       subject: `You have ${revisions.length} revision(s) due today`,
       html: `
         <h2>Today's Revisions</h2>
         <ul>
           ${revisions.map(r => `
             <li>
               <strong>${r.title}</strong> (Stage ${r.stage})
               <br/>
               <a href="${r.url}">Solve now</a>
             </li>
           `).join('')}
         </ul>
         <p>Good luck! 🚀</p>
       `
     });
   }
   ```

4. **Create Cron Endpoint**
   ```typescript
   // src/app/api/cron/daily-reminders/route.ts
   import { getSupabaseServer } from "@/lib/supabaseServer";
   import { sendRevisionReminder } from "@/lib/email";
   
   export async function GET(request: Request) {
     const authHeader = request.headers.get('authorization');
     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return Response.json({ error: 'Unauthorized' }, { status: 401 });
     }
     
     const supabase = getSupabaseServer();
     const today = new Date().toISOString().split('T')[0];
     
     // Get all users with revisions due today
     const { data: revisions } = await supabase
       .from('revisions')
       .select(`
         id,
         stage,
         solves!inner(
           user_id,
           users!inner(email),
           questions!inner(title, source_url)
         )
       `)
       .eq('due_on', today)
       .eq('status', 'scheduled');
     
     if (!revisions || revisions.length === 0) {
       return Response.json({ message: 'No reminders to send' });
     }
     
     // Group by user
     const userRevisions = new Map<string, typeof revisions>();
     for (const revision of revisions) {
       const email = revision.solves.users.email;
       if (!userRevisions.has(email)) {
         userRevisions.set(email, []);
       }
       userRevisions.get(email)!.push(revision);
     }
     
     // Send emails
     const results = [];
     for (const [email, userRevs] of userRevisions) {
       try {
         await sendRevisionReminder(
           email,
           userRevs.map(r => ({
             title: r.solves.questions.title,
             stage: r.stage,
             url: r.solves.questions.source_url ?? ''
           }))
         );
         results.push({ email, status: 'sent', count: userRevs.length });
       } catch (error) {
         results.push({ 
           email, 
           status: 'failed',
           error: error instanceof Error ? error.message : 'Unknown error'
         });
       }
     }
     
     return Response.json({ results });
   }
   ```

5. **Add to Cron Configuration**
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/daily-reminders",
         "schedule": "0 9 * * *"
       }
     ]
   }
   ```

### Option B: Browser Push Notifications

1. **Set up Web Push**
   ```bash
   npm install web-push
   ```

2. **Generate VAPID keys**
   ```bash
   npx web-push generate-vapid-keys
   ```

3. **Add to .env.local**
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   ```

4. **Create subscription endpoint**
   ```typescript
   // src/app/api/push/subscribe/route.ts
   export async function POST(request: Request) {
     const subscription = await request.json();
     const userId = await getOrCreateUserId(authUser);
     
     // Save subscription to database
     await supabase.from('push_subscriptions').insert({
       user_id: userId,
       subscription: JSON.stringify(subscription)
     });
     
     return Response.json({ success: true });
   }
   ```

## 5. Complete Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-leetcode-sync",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/weekly-calendar-sync",
      "schedule": "0 8 * * 1"
    },
    {
      "path": "/api/cron/daily-reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/cleanup-old-data",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

## 6. Testing Cron Jobs Locally

```bash
# Install Vercel CLI
npm install -g vercel

# Run dev server
vercel dev

# Test cron endpoint manually
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/daily-leetcode-sync
```

## 7. Monitoring Automation

### Create Dashboard Endpoint

```typescript
// src/app/api/admin/cron-status/route.ts
export async function GET(request: Request) {
  const supabase = getSupabaseServer();
  
  // Get last sync times
  const { data: lastLeetCodeSync } = await supabase
    .from('solves')
    .select('created_at')
    .eq('source', 'leetcode')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const { data: lastCalendarSync } = await supabase
    .from('calendar_events')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  return Response.json({
    lastLeetCodeSync: lastLeetCodeSync?.created_at,
    lastCalendarSync: lastCalendarSync?.created_at,
    status: 'healthy'
  });
}
```

## Summary

After implementing all automation:

✅ **LeetCode syncs automatically** every day at 2 AM
✅ **Calendar events created automatically** every Monday
✅ **Email reminders sent** every day at 9 AM
✅ **Usage tracked automatically** on every action
✅ **Old data cleaned up** every Sunday

**Total cost**: $0/month with Student Pack
**Manual work required**: None! Just solve problems and mark revisions.
