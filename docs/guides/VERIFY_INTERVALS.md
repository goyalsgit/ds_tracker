# Verify Your Revision Intervals Are Correct

## Current Issue
Your screenshot shows revisions scheduled for **May 5, May 7, May 11** for a problem solved on **May 4**.

This is **WRONG** ❌ - it's using the old intervals [1, 3, 7, 14, 30]

## Expected Behavior
For a problem solved on **May 4**, revisions should be:
- **Stage 1 (Day 3):** May 7 ✅
- **Stage 2 (Day 7):** May 11 ✅
- **Stage 3 (Day 21):** May 25 ✅

## How to Fix

### Option 1: Manual Re-sync (Easiest)
1. Go to your dashboard
2. Click the **"↻ Manual Sync"** button in the LeetCode Profile section
3. This will regenerate ALL revision schedules with the correct [3, 7, 21] intervals

### Option 2: Run SQL Script (If sync doesn't work)
1. Go to Supabase Dashboard → SQL Editor
2. Open the file `FIX_REVISION_INTERVALS.sql`
3. Copy and paste the SQL
4. Click "Run"
5. This will delete old revisions and recreate them with correct intervals

## Verify It Worked

After fixing, check the Questions tab. For any problem:
- **S1 column** should show a date that is **3 days** after "Solved On"
- **S2 column** should show a date that is **7 days** after "Solved On"
- **S3 column** should show a date that is **21 days** after "Solved On"

Example:
```
Solved On: May 4
S1: May 7  (May 4 + 3 days) ✅
S2: May 11 (May 4 + 7 days) ✅
S3: May 25 (May 4 + 21 days) ✅
```

## Why This Happened

You previously had intervals set to [1, 3, 7, 14, 30] days. When you changed to [3, 7, 21], the **code** was updated but the **database** still had old revision schedules.

The sync button will regenerate everything with the new intervals.

## Confirmation

After fixing, your "Today's Revision Queue" should only show problems that are:
- **3 days old** (Stage 1)
- **7 days old** (Stage 2)
- **21 days old** (Stage 3)

NOT problems that are 1 day old!
