# 🔧 Complete Fix for "Failed to Save Settings" Error

## 🎯 Problem
Your user account exists, but the `settings` table has no row for your user. This causes the "Failed to save settings" error when trying to save your LeetCode username.

## ✅ Solution (2 Steps)

### Step 1: Create Settings Row in Database

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `rbddecjzztgpdfyjfbmh`
3. **Click**: SQL Editor → New query
4. **Copy-paste this SQL**:

```sql
-- Create settings row for your user
INSERT INTO settings (user_id, timezone, daily_revision_limit, leetcode_username)
SELECT id, 'UTC', 6, NULL
FROM users 
WHERE email = 'devanshgoyal7344@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Verify it was created
SELECT * FROM settings 
WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');
```

5. **Click "Run"**
6. **Expected result**: You should see 1 row with your user_id, timezone=UTC, daily_revision_limit=6, leetcode_username=NULL

### Step 2: Restart Your Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## 🎉 What's Fixed

### 1. **Immediate Fix** (FIX_SETTINGS_ROW.sql)
- Creates the missing settings row for your existing user
- You can now save your LeetCode username

### 2. **Future Fix** (src/lib/userProfile.ts)
- Updated `getOrCreateUserId()` to auto-create settings row for new users
- Any new users will automatically get a settings row
- Prevents this error from happening again

## 🧪 Test It

1. **Go to your app**: http://localhost:3000
2. **Sign in** with your Google account
3. **Enter LeetCode username** in the onboarding modal
4. **Click "Continue"**
5. **Expected**: Username saves successfully ✅

## 📊 What Changed

### Before:
```
users table:
  ✅ devanshgoyal7344@gmail.com exists

settings table:
  ❌ No row for your user_id
  → "Failed to save settings" error
```

### After:
```
users table:
  ✅ devanshgoyal7344@gmail.com exists

settings table:
  ✅ Row created with default values
  → Username saves successfully
```

## 🔍 Why This Happened

The original code created a user in the `users` table but didn't create a corresponding row in the `settings` table. The settings API expected the row to exist, causing the save to fail.

**Now fixed**: New users automatically get a settings row when their account is created.

## 🚀 Next Steps

After fixing this:
1. ✅ Save your LeetCode username
2. ✅ Auto-sync will work on every login
3. ✅ No more "Failed to save settings" error
4. ✅ Future users won't have this problem

---

**Need help?** Check if the settings row exists:
```sql
SELECT * FROM settings WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');
```

If you see 0 rows, run the INSERT query again.
