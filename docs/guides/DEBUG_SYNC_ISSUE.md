# 🔍 Debug LeetCode Sync Not Working

## Possible Issues

### 1. **LeetCode Profile is Private**
LeetCode profiles can be set to private, which blocks API access.

**Check**:
- Go to: https://leetcode.com/Dev_code_01/
- Can you see the profile publicly?
- If you see "This profile is private", that's the issue

**Fix**:
1. Go to LeetCode Settings: https://leetcode.com/profile/
2. Scroll to "Privacy Settings"
3. Make sure "Show my profile to the public" is **enabled**

---

### 2. **Username is Incorrect**
The username might be slightly different (case-sensitive, underscores, etc.)

**Check**:
- Your LeetCode username: `Dev_code_01`
- Go to your LeetCode profile and copy the exact username from the URL
- Example: `https://leetcode.com/YOUR_EXACT_USERNAME/`

---

### 3. **Recent Submissions Not Showing**
The sync only fetches the **last 50 accepted submissions**.

**Check**:
- When did you solve the problem?
- Have you solved more than 50 problems since then?
- The API only returns the 50 most recent accepted submissions

---

### 4. **Submission Not Accepted**
The sync only tracks **accepted** submissions (green checkmark).

**Check**:
- Is the submission status "Accepted"?
- Wrong Answer, Time Limit Exceeded, etc. are not synced

---

### 5. **Browser Console Errors**
There might be JavaScript errors preventing the sync.

**Check**:
1. Open browser console: Press **F12** → **Console** tab
2. Click "Manual Sync" button
3. Look for red error messages
4. Copy and send me the error

---

## 🧪 Test the Sync Manually

### Step 1: Check LeetCode API Directly
Open this URL in your browser (replace username):
```
https://leetcode.com/Dev_code_01/
```

**Expected**: You should see the profile page with stats

### Step 2: Test the GraphQL API
Run this in your browser console (F12 → Console):

```javascript
fetch('https://leetcode.com/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Referer': 'https://leetcode.com'
  },
  body: JSON.stringify({
    query: `query userProfile($username: String!, $limit: Int!) {
      matchedUser(username: $username) {
        username
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        timestamp
        statusDisplay
      }
    }`,
    variables: { username: 'Dev_code_01', limit: 50 }
  })
})
.then(r => r.json())
.then(d => console.log(d))
```

**Expected Output**:
```json
{
  "data": {
    "matchedUser": {
      "username": "Dev_code_01",
      "submitStats": { ... }
    },
    "recentAcSubmissionList": [
      {
        "title": "Two Sum",
        "titleSlug": "two-sum",
        "timestamp": 1234567890,
        "statusDisplay": "Accepted"
      },
      ...
    ]
  }
}
```

**If you see an error**:
- `"matchedUser": null` → Username doesn't exist or profile is private
- `"recentAcSubmissionList": []` → No accepted submissions found

---

## 🔧 Quick Fixes

### Fix 1: Make Profile Public
1. Go to: https://leetcode.com/profile/
2. Enable "Show my profile to the public"
3. Save changes
4. Try sync again

### Fix 2: Verify Username
1. Go to your LeetCode profile
2. Copy the exact username from the URL
3. Update in the app
4. Try sync again

### Fix 3: Check Browser Console
1. Press F12 → Console tab
2. Click "Manual Sync"
3. Look for errors
4. Send me the error message

---

## 📊 What the Sync Does

1. **Fetches last 50 accepted submissions** from LeetCode GraphQL API
2. **For each submission**:
   - Creates question in database (if new)
   - Creates solve record
   - Creates 5-stage revision schedule (Day 1, 3, 7, 14, 30)
3. **Updates UI** with new problems and stats

---

## 🚨 Common Error Messages

### "LeetCode user not found or profile is private"
→ Profile is private or username is wrong

### "LeetCode request failed"
→ LeetCode API is down or rate-limited

### "Sync failed"
→ Generic error, check browser console for details

---

## 📝 Debug Checklist

- [ ] Profile is public (not private)
- [ ] Username is correct (case-sensitive)
- [ ] Problem was solved recently (within last 50 submissions)
- [ ] Submission status is "Accepted" (green checkmark)
- [ ] Browser console shows no errors
- [ ] Manual sync button shows success message
- [ ] Dev server is running (`npm run dev`)

---

## 🆘 Still Not Working?

Send me:
1. **LeetCode username**: (exact from URL)
2. **Profile URL**: https://leetcode.com/YOUR_USERNAME/
3. **Browser console output**: (F12 → Console → copy errors)
4. **Sync message**: (what does it say after clicking "Manual Sync"?)
5. **GraphQL test result**: (from Step 2 above)

I'll help you debug further!
