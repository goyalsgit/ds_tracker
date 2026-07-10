# 🚨 URGENT: Fix "Failed to Save Username" Error

## The Problem
Your settings table has **NO ROW** for your user. That's why it keeps failing.

## ✅ Solution (Follow These Exact Steps)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard
2. Click on your project: `rbddecjzztgpdfyjfbmh`
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

### Step 2: Run Diagnostic Check
Copy-paste this SQL and click **"Run"**:

```sql
-- Check if settings row exists
SELECT * FROM settings 
WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');
```

**Expected Result**: 
- If you see **0 rows** → Continue to Step 3
- If you see **1 row** → Skip to Step 4

### Step 3: Create Settings Row
Copy-paste this SQL and click **"Run"**:

```sql
-- Create settings row for your user
INSERT INTO settings (user_id, timezone, daily_revision_limit, leetcode_username)
SELECT id, 'UTC', 6, NULL
FROM users 
WHERE email = 'devanshgoyal7344@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
```

**Expected Result**: `INSERT 0 1` (means 1 row inserted)

### Step 4: Verify Settings Row Was Created
Copy-paste this SQL and click **"Run"**:

```sql
-- Verify settings row exists
SELECT * FROM settings 
WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');
```

**Expected Result**: You should see **1 row** with:
- `user_id`: (some UUID)
- `timezone`: UTC
- `daily_revision_limit`: 6
- `leetcode_username`: NULL

### Step 5: Restart Your Dev Server
In your terminal:
```bash
# Press Ctrl+C to stop the server
# Then restart:
npm run dev
```

### Step 6: Test the App
1. Go to: http://localhost:3000
2. The onboarding modal should appear
3. Enter your LeetCode username: `Dev_code_01`
4. Click **"Continue"**
5. **Expected**: Username saves successfully ✅

---

## 🔍 Why This Keeps Happening

The error message now shows the **actual error** from the database. Before, it just said "Failed to save username" which wasn't helpful.

**Root Cause**: Your user was created in the `users` table, but no corresponding row was created in the `settings` table. The API tries to save the username but can't find where to save it.

**Fix Applied**: 
1. ✅ Created SQL to manually add the settings row
2. ✅ Updated `src/lib/userProfile.ts` to auto-create settings for new users
3. ✅ Improved error handling to show actual error messages

---

## 📊 Quick Diagnostic

Run this in Supabase SQL Editor to see your full database state:

```sql
-- See everything
SELECT 'USER' as type, email, id FROM users WHERE email = 'devanshgoyal7344@gmail.com'
UNION ALL
SELECT 'SETTINGS' as type, 
       COALESCE(leetcode_username, 'NULL') as email,
       user_id as id
FROM settings 
WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');
```

**Expected Result**: 2 rows
- Row 1: USER | devanshgoyal7344@gmail.com | (your user_id)
- Row 2: SETTINGS | NULL | (same user_id)

---

## ❓ Still Not Working?

If you still see the error after following all steps:

1. **Check browser console** (F12 → Console tab)
2. **Copy the error message** and send it to me
3. **Run the diagnostic SQL** above and send me the results

The new error handling will show you the **exact error** from the database, which will help us fix it.
