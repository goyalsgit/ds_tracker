# 🎯 Complete Guide: Your Enhanced DSA Tracker

## ✅ What's Been Added:

### 1. **C++ Code Storage**
- Store your solution code for every problem
- Supports C++, Python, Java, JavaScript
- Code saved in Supabase database
- Accessible from anywhere

### 2. **Last Solved Date Tracking**
- See when you last solved each problem
- Auto-updates when you re-solve
- Helps identify stale problems

### 3. **Extended History (20 Days)**
- Dashboard now shows past 20 days (was 10)
- More comprehensive activity tracking
- Better revision pattern analysis

### 4. **Enhanced CSV Export**
- Now includes: Code, Language, Last Solved
- All columns: #, Title, Difficulty, Tags, Solved On, Last Solved, Language, Code, S1-S5, URL
- Opens in Excel/Google Sheets

---

## 🚀 How to Use:

### **Step 1: Apply Database Migration**

**IMPORTANT: Do this first!**

1. Open your browser and go to: https://supabase.com/dashboard
2. Select your project: `rbddecjzztgpdfyjfbmh`
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button
5. Open the file: `src/db/migrations/001_add_code_storage.sql`
6. Copy the entire contents
7. Paste into the SQL Editor
8. Click **"Run"** (or press Cmd/Ctrl + Enter)
9. You should see: ✅ Success message

**Verification:**
Run this query to verify:
```sql
select column_name, data_type 
from information_schema.columns 
where table_name = 'solves' 
and column_name in ('code', 'language');
```

You should see:
```
code     | text
language | text
```

---

### **Step 2: Restart Your Dev Server**

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

---

### **Step 3: Start Using New Features**

#### **A. Add Code When Solving Manually:**

1. Go to **Dashboard** tab
2. Scroll to **"Add Manually"** section
3. Fill in:
   - **Title**: Two Sum
   - **URL**: https://leetcode.com/problems/two-sum
   - **Difficulty**: Easy
   - **Tags**: array, hash-table
   - **Code**: (Paste your C++ solution)
   ```cpp
   class Solution {
   public:
       vector<int> twoSum(vector<int>& nums, int target) {
           unordered_map<int, int> map;
           for (int i = 0; i < nums.size(); i++) {
               int complement = target - nums[i];
               if (map.count(complement)) {
                   return {map[complement], i};
               }
               map[nums[i]] = i;
           }
           return {};
       }
   };
   ```
   - **Language**: C++ (or select Python/Java/JavaScript)
4. Click **"Save + Schedule Revisions"**

#### **B. View Your Data:**

**Questions Tab:**
- See all problems in a table
- New column: **"Last Solved"** shows when you last solved it
- Click any problem title to open on LeetCode

**Export to Excel:**
- Click **"↓ Export CSV"** button
- Opens in Excel/Google Sheets
- Contains ALL data including your code
- Perfect for printing or offline review

#### **C. Track Your Progress:**

**Dashboard Tab:**
- **Today's Queue**: Problems due today
- **Past 20 Days**: Extended activity history (was 10 days)
- **Upcoming**: Next 7 days of revisions

**Analysis Tab:**
- **Streak**: Days you've completed revisions
- **Today's Problems**: All problems you touched today
- **AI Analysis**: Weak areas and daily plan

---

## 📊 Where Your Data is Stored:

### **Supabase Database Tables:**

```
┌─────────────────────────────────────────────────────────┐
│ questions                                               │
├─────────────────────────────────────────────────────────┤
│ id | title | difficulty | tags | last_solved_at | ...  │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ solves                                                  │
├─────────────────────────────────────────────────────────┤
│ id | user_id | question_id | solved_at | code |        │
│    |         |             |           | language | ... │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ revisions                                               │
├─────────────────────────────────────────────────────────┤
│ id | solve_id | stage | due_on | status | ...          │
└─────────────────────────────────────────────────────────┘
```

**Storage Location:**
- **Cloud**: Supabase PostgreSQL (https://rbddecjzztgpdfyjfbmh.supabase.co)
- **NOT local**: No files on your disk
- **Accessible**: From any device after login
- **Backed up**: Automatic Supabase backups

---

## 📝 Example Workflow:

### **Day 1: Solve a Problem**
```
1. Solve "Two Sum" on LeetCode
2. Copy your C++ solution
3. Dashboard → Add Manually
4. Paste code, fill details
5. Click "Save + Schedule Revisions"
```

**Result:**
- Problem saved to database
- 5 revisions scheduled (Day 1, 3, 7, 14, 30)
- Code stored for future reference

### **Day 2: Revision Day**
```
1. Open Dashboard
2. See "Two Sum" in Today's Queue
3. Click "Attempt on LeetCode"
4. Solve it again
5. Click "✓ Mark Done"
```

**Result:**
- Revision marked complete
- Streak increments
- `last_solved_at` updates to today
- Next revision scheduled

### **Day 30: Export for Printing**
```
1. Go to Questions tab
2. Click "↓ Export CSV"
3. Open in Excel
4. Print the "Code" column
5. Use for offline revision
```

**Result:**
- Excel file with all problems
- Code column has your solutions
- Can print and study offline

---

## 🔍 Tracking Your Revisions:

### **Dashboard View:**

**Today's Queue:**
- Shows all problems due today
- Status: Pending / Done / Failed
- Progress bar shows completion %

**Past 20 Days:**
- Grouped by date
- Shows: Done count, Failed count
- Click problem to open on LeetCode

**Upcoming:**
- Next 7 days of revisions
- Sorted by due date
- Shows stage (S1-S5)

### **Questions Table:**

| # | Problem | Difficulty | Concepts | Solved | Last Solved | S1 | S2 | S3 | S4 | S5 |
|---|---------|------------|----------|--------|-------------|----|----|----|----|-----|
| 1 | Two Sum | Easy | array, hash | 2025-01-15 | 2025-01-16 | ✓ | ✓ | · | · | · |
| 2 | Add Two Numbers | Medium | linked-list | 2025-01-14 | 2025-01-14 | ✓ | · | · | · | · |

**Legend:**
- ✓ = Done
- ✗ = Failed
- ! = Overdue
- · = Scheduled

---

## 💾 Excel Export Format:

```csv
#,Title,Difficulty,Tags,Solved On,Last Solved,Language,Code,S1,S2,S3,S4,S5,URL
1,"Two Sum",Easy,"array, hash-table",2025-01-15,2025-01-16,cpp,"class Solution { ... }",2025-01-16 [done],2025-01-18 [scheduled],...
```

**Use Cases:**
- Print code for offline study
- Share with study group
- Backup your solutions
- Track progress in Excel

---

## 🎨 Features Summary:

### **Data Entry:**
- ✅ Manual add with code
- ✅ LeetCode auto-sync (last 20 submissions)
- ✅ Auto-tick on re-solve

### **Tracking:**
- ✅ 5-stage spaced repetition
- ✅ Streak counter
- ✅ Last solved date
- ✅ 20-day history

### **AI Features:**
- ✅ Gemini 2.5 Flash summaries
- ✅ Hints for stuck problems
- ✅ Weak area analysis
- ✅ Daily study plan

### **Export:**
- ✅ CSV with code
- ✅ PDF revision sheets
- ✅ Excel-compatible format

### **Integrations:**
- ✅ Google Calendar sync
- ✅ LeetCode GraphQL API
- ✅ Supabase Auth (Google OAuth)

---

## 🐛 Troubleshooting:

### **"Code not saving"**
- Did you run the migration? (Step 1)
- Check Supabase SQL Editor for errors
- Verify columns exist: `select * from solves limit 1;`

### **"Last Solved shows —"**
- Normal for newly added problems
- Will update after first solve
- Trigger runs automatically

### **"Export doesn't include code"**
- Restart dev server after migration
- Clear browser cache
- Check if code field has data in Supabase

### **"20 days not showing"**
- Restart dev server
- Check `/api/revisions/history?days=20` in browser
- Should return 20 days of data

---

## 📚 Next Steps:

1. ✅ Apply migration (Step 1 above)
2. ✅ Restart dev server
3. ✅ Add a problem with code
4. ✅ Export to CSV to verify
5. ✅ Check "Last Solved" column in Questions tab

---

## 🎯 Your System is Now:

- ✅ **Complete**: All features of Codio.io + more
- ✅ **Free**: No paid subscriptions
- ✅ **Cloud-based**: Access from anywhere
- ✅ **AI-powered**: Gemini summaries & hints
- ✅ **Print-friendly**: PDF + Excel export
- ✅ **Production-ready**: Deployed on Vercel

**You have a professional-grade DSA tracker!** 🚀
