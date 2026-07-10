# Simple Test to Verify Sync

## Step 1: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

## Step 2: Open App
Go to: http://localhost:3000

## Step 3: Check Terminal
After clicking "Manual Sync", you should see in terminal:
```
[LeetCode Sync] Starting sync for username: Dev_code_01
[LeetCode Sync] Fetched 20 submissions (requested 100)
[LeetCode Sync] Updating Rotate Function: ... → ...
[LeetCode Sync] Summary - New: 0, Auto-marked: X
```

## Step 4: Check Browser Console
Press F12 → Console tab, you should see:
```
[Sync Response] { newProblems: 0, autoMarked: X, totalSolves: 20 }
[Sync] Setting solves: 20 problems
```

## Step 5: Check Message
Under "Manual Sync" button, you should see:
```
✓ Up to date · 20 total
```

## If You Don't See These:

### Terminal shows nothing
→ Dev server not running or sync endpoint not being called

### Browser console shows error
→ JavaScript error preventing sync

### Message shows "✗ Error"
→ API or database error

**Tell me which one you see!**
