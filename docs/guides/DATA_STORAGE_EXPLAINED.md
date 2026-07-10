# 🗄️ Data Storage Explained

## Where is Everything Stored?

### **🌐 INTERNET (Supabase Cloud Database)**

All your data is stored in **Supabase PostgreSQL** database in the cloud.

```
Database URL: https://rbddecjzztgpdfyjfbmh.supabase.co
Location: Cloud (Supabase servers)
Type: PostgreSQL (Relational Database)
Access: Via API calls from your Next.js app
```

---

## 📊 Database Tables & What They Store:

### **1. `users` Table**
```sql
┌──────────────────────────────────────────────┐
│ users                                        │
├──────────────────────────────────────────────┤
│ id          | uuid (primary key)             │
│ auth_user_id| uuid (from Google OAuth)       │
│ email       | your@email.com                 │
│ name        | Your Name                      │
│ created_at  | 2025-01-15 10:30:00           │
└──────────────────────────────────────────────┘
```
**Stores:** Your account information

---

### **2. `questions` Table**
```sql
┌──────────────────────────────────────────────┐
│ questions                                    │
├──────────────────────────────────────────────┤
│ id             | uuid (primary key)          │
│ title          | "Two Sum"                   │
│ slug           | "two-sum"                   │
│ source_url     | "https://leetcode.com/..."  │
│ difficulty     | "Easy"                      │
│ tags           | ["array", "hash-table"]     │
│ last_solved_at | 2025-01-20 (NEW!)          │ ← NEW COLUMN
│ created_at     | 2025-01-15 10:30:00        │
└──────────────────────────────────────────────┘
```
**Stores:** All DSA problems (shared across users)

---

### **3. `solves` Table** ⭐ (YOUR SOLUTIONS)
```sql
┌──────────────────────────────────────────────┐
│ solves                                       │
├──────────────────────────────────────────────┤
│ id          | uuid (primary key)             │
│ user_id     | → links to users.id            │
│ question_id | → links to questions.id        │
│ solved_at   | 2025-01-15 14:30:00           │
│ source      | "manual" or "leetcode"         │
│ notes       | "Used two pointers"            │
│ code        | "class Solution { ... }"       │ ← NEW COLUMN
│ language    | "cpp"                          │ ← NEW COLUMN
│ created_at  | 2025-01-15 14:30:00           │
└──────────────────────────────────────────────┘
```
**Stores:** Your solve records + YOUR C++ CODE

**Example Row:**
```json
{
  "id": "abc-123",
  "user_id": "user-xyz",
  "question_id": "question-456",
  "solved_at": "2025-01-15T14:30:00Z",
  "source": "manual",
  "code": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> map;\n        for (int i = 0; i < nums.size(); i++) {\n            int complement = target - nums[i];\n            if (map.count(complement)) {\n                return {map[complement], i};\n            }\n            map[nums[i]] = i;\n        }\n        return {};\n    }\n};",
  "language": "cpp"
}
```

---

### **4. `revisions` Table**
```sql
┌──────────────────────────────────────────────┐
│ revisions                                    │
├──────────────────────────────────────────────┤
│ id           | uuid (primary key)            │
│ solve_id     | → links to solves.id          │
│ stage        | 1, 2, 3, 4, or 5              │
│ due_on       | 2025-01-16 (date)             │
│ status       | "scheduled" / "done" / "failed"│
│ completed_at | 2025-01-16 09:00:00           │
│ outcome      | "done" or "failed"            │
│ created_at   | 2025-01-15 14:30:00           │
└──────────────────────────────────────────────┘
```
**Stores:** Your revision schedule (5 stages per problem)

**Example: One Problem = 5 Revisions**
```
Problem: "Two Sum" (solved on 2025-01-15)
├─ Revision 1: due 2025-01-16 (Day 1)  → status: done
├─ Revision 2: due 2025-01-18 (Day 3)  → status: scheduled
├─ Revision 3: due 2025-01-22 (Day 7)  → status: scheduled
├─ Revision 4: due 2025-01-29 (Day 14) → status: scheduled
└─ Revision 5: due 2025-02-14 (Day 30) → status: scheduled
```

---

### **5. `settings` Table**
```sql
┌──────────────────────────────────────────────┐
│ settings                                     │
├──────────────────────────────────────────────┤
│ id                  | uuid (primary key)     │
│ user_id             | → links to users.id    │
│ timezone            | "UTC"                  │
│ daily_revision_limit| 6                      │
│ leetcode_username   | "your_username"        │
│ intervals           | [1, 3, 7, 14, 30]      │
│ created_at          | 2025-01-15 10:30:00   │
└──────────────────────────────────────────────┘
```
**Stores:** Your preferences (LeetCode username, etc.)

---

### **6. `ai_summaries` Table** (Cache)
```sql
┌──────────────────────────────────────────────┐
│ ai_summaries                                 │
├──────────────────────────────────────────────┤
│ id            | uuid (primary key)           │
│ question_slug | "two-sum"                    │
│ summary       | "CONCEPT: Hash table..."     │
│ hint          | "Think about complements..." │
│ generated_at  | 2025-01-15 14:35:00         │
└──────────────────────────────────────────────┘
```
**Stores:** Cached AI responses (saves API calls)

---

### **7. `google_tokens` Table**
```sql
┌──────────────────────────────────────────────┐
│ google_tokens                                │
├──────────────────────────────────────────────┤
│ id            | uuid (primary key)           │
│ user_id       | → links to users.id          │
│ access_token  | "ya29.a0AfH6..."             │
│ refresh_token | "1//0gXXX..."                │
│ scope         | "calendar.events"            │
│ token_type    | "Bearer"                     │
│ expiry_date   | 1705334400000                │
└──────────────────────────────────────────────┘
```
**Stores:** Google Calendar OAuth tokens

---

### **8. `calendar_events` Table**
```sql
┌──────────────────────────────────────────────┐
│ calendar_events                              │
├──────────────────────────────────────────────┤
│ id          | uuid (primary key)             │
│ revision_id | → links to revisions.id        │
│ provider    | "google"                       │
│ external_id | "abc123xyz" (Google event ID)  │
│ event_link  | "https://calendar.google.com/..."│
└──────────────────────────────────────────────┘
```
**Stores:** Synced calendar events

---

## 🔄 How Data Flows:

### **When You Add a Problem:**

```
1. You fill form in Dashboard
   ↓
2. POST /api/solves/manual
   ↓
3. Creates row in `questions` table
   ↓
4. Creates row in `solves` table (with your code!)
   ↓
5. Creates 5 rows in `revisions` table
   ↓
6. All saved to Supabase PostgreSQL
   ↓
7. Dashboard reloads and shows your problem
```

### **When You Mark Revision Done:**

```
1. You click "✓ Mark Done"
   ↓
2. POST /api/revisions/mark
   ↓
3. Updates `revisions` table:
      - status: "scheduled" → "done"
      - completed_at: current timestamp
   ↓
4. Trigger updates `questions.last_solved_at`
   ↓
5. Dashboard reloads
   ↓
6. Streak counter increments
```

### **When You Export CSV:**

```
1. You click "↓ Export CSV"
   ↓
2. JavaScript reads `solves` array (already loaded)
   ↓
3. Formats data including code column
   ↓
4. Creates CSV blob in browser memory
   ↓
5. Downloads to your computer
   ↓
6. You open in Excel/Google Sheets
```

---

## 💾 What's NOT Stored Locally:

### **❌ NOT on Your Disk:**
- No SQLite files
- No JSON files
- No localStorage (except temp auth tokens)
- No cookies with data

### **❌ NOT in Browser:**
- Only temporary session data
- Auth tokens (cleared on logout)
- No persistent storage

### **✅ Everything is in Supabase Cloud:**
- Questions
- Your solves
- Your code
- Revision schedules
- Settings
- AI summaries

---

## 🌍 Why Cloud Storage?

### **Advantages:**
1. **Access Anywhere** - Login from any device
2. **No Data Loss** - Browser clear won't delete data
3. **Automatic Backups** - Supabase handles it
4. **Multi-device Sync** - Real-time updates
5. **Scalable** - Can store unlimited problems
6. **Secure** - Row-level security (RLS)

### **Free Tier Limits:**
- **Database**: 500 MB (plenty for text)
- **Bandwidth**: 5 GB/month
- **API Requests**: Unlimited
- **Auth Users**: Unlimited

**Your usage:** ~1 KB per problem with code = 500,000 problems! 🚀

---

## 🔐 Security:

### **Row-Level Security (RLS):**
```sql
-- Only you can see your solves
CREATE POLICY "Users can only see their own solves"
ON solves FOR SELECT
USING (auth.uid() = user_id);

-- Only you can update your revisions
CREATE POLICY "Users can only update their own revisions"
ON revisions FOR UPDATE
USING (
  solve_id IN (
    SELECT id FROM solves WHERE user_id = auth.uid()
  )
);
```

**Result:** Your code is private. Other users can't see it.

---

## 📊 Example: Your Data After 1 Month

```
You solved 30 problems:

questions table:
  30 rows (shared, but you only see yours in UI)

solves table:
  30 rows (your solve records + code)
  ~30 KB of code storage

revisions table:
  150 rows (30 problems × 5 stages)
  ~15 KB

Total storage: ~50 KB (0.01% of 500 MB limit!)
```

---

## 🎯 Summary:

### **Where is my code stored?**
→ Supabase `solves` table, `code` column

### **Where is last solved date?**
→ Supabase `questions` table, `last_solved_at` column

### **Where is revision history?**
→ Supabase `revisions` table, filtered by date

### **Can I access offline?**
→ No, need internet to load from Supabase
→ But you can export CSV for offline use

### **Is my data safe?**
→ Yes, Supabase has automatic backups
→ Row-level security protects your data
→ Only you can see your code

### **Can I switch to local storage?**
→ Yes, but not recommended
→ Would need to replace Supabase with SQLite
→ Lose multi-device sync

---

## 📁 Data Flow Diagram:

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR BROWSER                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Next.js App (localhost:3000)                   │   │
│  │  - Dashboard UI                                 │   │
│  │  - Forms, Tables, Buttons                       │   │
│  └─────────────────────────────────────────────────┘   │
│                        ↕ HTTP/HTTPS                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  API Routes (/api/*)                            │   │
│  │  - /api/solves/manual                           │   │
│  │  - /api/revisions/mark                          │   │
│  │  - /api/solves/code                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        ↕ Supabase Client
┌─────────────────────────────────────────────────────────┐
│              SUPABASE CLOUD (Internet)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                            │   │
│  │  - users                                        │   │
│  │  - questions (with last_solved_at)              │   │
│  │  - solves (with code + language)                │   │
│  │  - revisions                                    │   │
│  │  - settings                                     │   │
│  │  - ai_summaries                                 │   │
│  │  - google_tokens                                │   │
│  │  - calendar_events                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  URL: https://rbddecjzztgpdfyjfbmh.supabase.co         │
└─────────────────────────────────────────────────────────┘
```

---

**Your data is safe, accessible, and backed up in the cloud!** ☁️
