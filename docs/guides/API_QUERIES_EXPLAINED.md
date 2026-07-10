# API Queries Explained

## What the `/api/database/usage` endpoint does:

### Step 1: Get Your Solve IDs
```typescript
const { data: userSolves } = await supabaseServer
  .from("solves")
  .select("id")
  .eq("user_id", userId);
```

**SQL Equivalent:**
```sql
SELECT id 
FROM solves 
WHERE user_id = 'your-user-id';
```

**What it does:** Gets all your solve record IDs (e.g., [1, 2, 3, 4, ...])

---

### Step 2: Count Total Questions
```typescript
const { count: questionsCount } = await supabaseServer
  .from("questions")
  .select("*", { count: "exact", head: true });
```

**SQL Equivalent:**
```sql
SELECT COUNT(*) 
FROM questions;
```

**What it does:** Counts ALL questions in the database (shared by all users)

---

### Step 3: Count Your Solves
```typescript
const solvesCount = userSolves?.length || 0;
```

**What it does:** Counts how many problems YOU have solved (from Step 1)

---

### Step 4: Count Your Revisions
```typescript
const { count } = await supabaseServer
  .from("revisions")
  .select("*", { count: "exact", head: true })
  .in("solve_id", solveIds);
```

**SQL Equivalent:**
```sql
SELECT COUNT(*) 
FROM revisions 
WHERE solve_id IN (1, 2, 3, 4, ...);  -- Your solve IDs from Step 1
```

**What it does:** Counts all revision records for YOUR solves

---

### Step 5: Calculate Storage
```typescript
const questionSize = (questionsCount || 0) * 500;  // 500 bytes per question
const solveSize = solvesCount * 200;               // 200 bytes per solve
const revisionSize = revisionsCount * 100;         // 100 bytes per revision

const totalBytes = questionSize + solveSize + revisionSize;
const totalMB = totalBytes / 1024 / 1024;
```

**What it does:** 
- Estimates storage based on average record sizes
- Converts bytes → KB → MB

---

## Example Calculation

If you have:
- **325 questions** in database (shared)
- **325 solves** (your records)
- **975 revisions** (325 problems × 3 stages)

**Storage calculation:**
```
Questions: 325 × 500 bytes = 162,500 bytes
Solves:    325 × 200 bytes = 65,000 bytes
Revisions: 975 × 100 bytes = 97,500 bytes
─────────────────────────────────────────
Total:                       325,000 bytes
                           = 317.38 KB
                           = 0.31 MB
```

**Percentage of 500 MB free tier:**
```
0.31 MB / 500 MB × 100 = 0.062%
```

**Remaining capacity:**
```
500 MB - 0.31 MB = 499.69 MB
499.69 MB ÷ 0.001 MB per problem = 499,690 more problems
```

---

## Why Use Estimates?

PostgreSQL's actual storage includes:
- **Indexes** (for fast lookups)
- **Metadata** (table structure info)
- **Overhead** (alignment, padding)

So actual storage is **higher** than raw data size.

Our estimates are **conservative** - they show the minimum storage needed for your data.

---

## To See REAL Storage Usage

Run the SQL queries in `CHECK_DATABASE_USAGE.sql` in Supabase SQL Editor:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor"
4. Paste the queries from `CHECK_DATABASE_USAGE.sql`
5. Replace `'devanshgoyal7344@gmail.com'` with your email
6. Click "Run"

This will show you:
- ✅ Exact record counts
- ✅ Real table sizes (with indexes)
- ✅ Total database size
- ✅ Breakdown by difficulty

---

## Summary

The API does 4 simple queries:
1. **Get your solve IDs** → `SELECT id FROM solves WHERE user_id = ?`
2. **Count all questions** → `SELECT COUNT(*) FROM questions`
3. **Count your solves** → Count from step 1
4. **Count your revisions** → `SELECT COUNT(*) FROM revisions WHERE solve_id IN (?)`

Then it multiplies by average sizes and converts to MB.

Simple! 🎯
