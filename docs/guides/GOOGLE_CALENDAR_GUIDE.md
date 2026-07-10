# 📅 Google Calendar Integration Guide

## 🎯 Overview

Your DSA Tracker automatically syncs revision reminders to Google Calendar to help you stay on track with your spaced repetition schedule.

---

## 📆 When Are Events Added?

### **Automatic Triggers:**

Events are **NOT** added automatically when you start the server. You need to manually trigger the sync.

### **Manual Triggers:**

1. **"🔔 Auto-Sync" Button** (Recommended)
   - Location: Dashboard → Calendar card
   - Syncs: **Today's revisions only**
   - Time: Events created at **9:00 AM** (1-hour duration)
   - Reminders: 
     - 📱 Popup: 30 minutes before
     - 📧 Email: 1 hour before

2. **"↻ Manual Sync" Button**
   - Location: Dashboard → Calendar card
   - Syncs: **Next 7 days** of revisions
   - Time: All-day events (no specific time)
   - Reminders: None

---

## 🗓️ Revision Schedule (Default Intervals)

When you solve a problem, 3 revision stages are automatically scheduled:

| Stage | Days After Solving | Purpose |
|-------|-------------------|---------|
| **Stage 1** | **Day 3** | Short-term recall |
| **Stage 2** | **Day 7** | Medium-term recall |
| **Stage 3** | **Day 21** | Long-term retention |

### **Example:**
If you solve a problem on **May 9**:
- Stage 1: **May 12** (3 days later)
- Stage 2: **May 16** (7 days later)
- Stage 3: **May 30** (21 days later)

---

## 🔔 Auto-Sync vs Manual Sync

### **🔔 Auto-Sync (Recommended)**

**What it does:**
- Syncs **only today's revisions**
- Creates events at **9:00 AM - 10:00 AM**
- Adds **reminders** (30 min popup + 1 hour email)
- Color-coded: **Blue** (#9)
- Includes problem details, difficulty, tags, and link

**Event Format:**
```
Title: 🔄 DSA Revision: Two Sum
Time: 9:00 AM - 10:00 AM
Description:
  Stage 1 Revision
  Difficulty: Easy
  Topics: array, hash-table
  
  Problem Link: https://leetcode.com/problems/two-sum
  
  Complete this revision in your DSA Tracker dashboard.
```

**When to use:**
- Daily routine (run once per day)
- Want reminders and notifications
- Prefer scheduled time blocks

---

### **↻ Manual Sync**

**What it does:**
- Syncs **next 7 days** of revisions
- Creates **all-day events** (no specific time)
- **No reminders**
- Basic event format

**Event Format:**
```
Title: Revision: Two Sum (Stage 1)
Date: May 12 (all day)
Description: https://leetcode.com/problems/two-sum
```

**When to use:**
- Want to see upcoming revisions in calendar
- Don't need reminders
- Prefer flexibility in timing

---

## 🚀 How to Use

### **First Time Setup:**

1. **Connect Google Calendar:**
   - Click "Connect Calendar" button
   - Sign in with Google
   - Grant calendar permissions

2. **Sync Your Revisions:**
   - Click "🔔 Auto-Sync" for today's revisions
   - OR click "↻ Manual Sync" for next 7 days

### **Daily Routine:**

1. **Morning:**
   - Click "🔔 Auto-Sync" to add today's revisions
   - Check your Google Calendar for reminders

2. **Complete Revisions:**
   - You'll get popup reminder 30 min before (8:30 AM)
   - You'll get email reminder 1 hour before (8:00 AM)
   - Complete the revision in DSA Tracker
   - Mark as "Done" or "Failed"

---

## 📊 What Gets Synced?

### **Included:**
- ✅ Revisions with status: **"scheduled"**
- ✅ Revisions due: **today** (Auto-Sync) or **next 7 days** (Manual Sync)
- ✅ Only **your problems** (not other users')

### **Excluded:**
- ❌ Already completed revisions (status: "done")
- ❌ Failed revisions (status: "failed")
- ❌ Overdue revisions (status: "overdue")
- ❌ Revisions already synced to calendar

---

## 🔄 Re-Sync Behavior

### **Smart Duplicate Prevention:**
- Events are **never duplicated**
- System checks if revision already has a calendar event
- Only creates new events for unsynced revisions

### **When You Re-Solve a Problem:**
1. Old revisions are marked as "done"
2. New revision schedule is created (Day 3, 7, 21)
3. Old calendar events remain (you can delete manually)
4. New events can be synced with Auto-Sync

---

## ⚙️ Customization Options

### **Change Revision Intervals:**

Currently set to: **3, 7, 21 days**

To customize:
1. Go to Settings (future feature)
2. Or modify `DEFAULT_INTERVALS` in code:

```typescript
// src/lib/revisionScheduler.ts
export const DEFAULT_INTERVALS: RevisionInterval[] = [
  { dayOffset: 3, label: "Stage 1" },   // Change to 1, 2, 5, etc.
  { dayOffset: 7, label: "Stage 2" },   // Change to any number
  { dayOffset: 21, label: "Stage 3" },  // Change to any number
];
```

### **Change Event Time:**

Currently set to: **9:00 AM - 10:00 AM**

To customize:
1. Edit `src/app/api/google/auto-sync/route.ts`
2. Change these lines:

```typescript
const startTime = new Date(revision.due_on + "T09:00:00"); // Change 09:00:00
const endTime = new Date(revision.due_on + "T10:00:00");   // Change 10:00:00
```

### **Change Reminder Times:**

Currently set to: **30 min popup + 1 hour email**

To customize:
1. Edit `src/app/api/google/auto-sync/route.ts`
2. Change these lines:

```typescript
reminders: {
  useDefault: false,
  overrides: [
    { method: "popup", minutes: 30 },  // Change 30 to any number
    { method: "email", minutes: 60 },  // Change 60 to any number
  ],
}
```

---

## 🐛 Troubleshooting

### **Events Not Appearing:**

1. **Check Connection:**
   - Calendar card should show "✓ Connected"
   - If not, click "Connect Calendar"

2. **Check Revisions:**
   - Go to Dashboard tab
   - Check "Today's Revision Queue"
   - If empty, no events to sync

3. **Check Calendar:**
   - Open Google Calendar
   - Look for events starting with "🔄 DSA Revision:"
   - Check if they're in the correct date

### **Duplicate Events:**

- System prevents duplicates automatically
- If you see duplicates, they might be from:
  - Manual calendar entries
  - Old events before re-solving
  - Multiple sync button clicks (should be prevented)

### **Wrong Time Zone:**

- Events use UTC by default
- To change, edit the `timeZone` field in auto-sync route
- Or use all-day events (Manual Sync)

---

## 📈 Best Practices

### **Recommended Workflow:**

1. **Morning (8:00 AM):**
   - Open DSA Tracker
   - Click "🔔 Auto-Sync"
   - Check Google Calendar for today's revisions

2. **During Day:**
   - Get reminders from Google Calendar
   - Complete revisions when reminded
   - Mark as Done/Failed in DSA Tracker

3. **Evening:**
   - Review completed revisions
   - Check tomorrow's queue

### **Tips:**

- ✅ Use Auto-Sync daily for best results
- ✅ Enable Google Calendar notifications on phone
- ✅ Set consistent revision time (e.g., 9 AM daily)
- ✅ Mark revisions immediately after completing
- ✅ Re-sync after solving new problems

---

## 🔐 Privacy & Permissions

### **What We Access:**
- ✅ Google Calendar (read/write events)
- ✅ Your email (for identification)

### **What We DON'T Access:**
- ❌ Other Google services (Gmail, Drive, etc.)
- ❌ Your contacts
- ❌ Your files

### **Data Storage:**
- OAuth tokens stored securely in Supabase
- Encrypted in transit (HTTPS)
- Only you can access your data

---

## 📞 Support

If you have issues:
1. Check browser console for errors
2. Check Supabase logs
3. Verify Google Calendar permissions
4. Try disconnecting and reconnecting

---

**Summary:**
- 📅 Events are added **manually** (not on server start)
- 🔔 Use **Auto-Sync** for today's revisions with reminders
- ↻ Use **Manual Sync** for next 7 days without reminders
- 📆 Default schedule: **Day 3, 7, 21** after solving
- ⏰ Auto-Sync creates events at **9:00 AM** with **30 min + 1 hour reminders**
