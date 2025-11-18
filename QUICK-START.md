# Category Fix - Quick Start Guide

## What Was Fixed?

Two category name issues causing tasks to be invisible between admin and regular users:
1. `"תוכנית טיפול"` → `"תוכניות טיפול"` (singular → plural)
2. `"תשלומים"` → `"תשלומים וזיכויים"` (short → full)

## What You Need to Do

### 1️⃣ Install Dependency (30 seconds)
```bash
npm install firebase-admin
```

### 2️⃣ Get Service Account Key (2 minutes)
- Firebase Console → Project Settings → Service Accounts
- Click "Generate new private key"
- Save as `serviceAccountKey.json` in project root

### 3️⃣ Run Migration (1 minute)
```bash
node scripts/migrate-categories.js
```

### 4️⃣ Verify Fix (5 minutes)
- Login as admin → TaskManager → Check category dropdown
- Should see exactly **6 categories** (not 7)
- Login as regular user → TaskManager → Check category dropdown  
- Should see same **6 categories**
- Create a task in "תוכניות טיפול" as admin, assign to user
- User should see the task ✅

## That's It! 🎉

### Before:
- Admin: 7 categories ❌
- User: 6 categories ❌
- Tasks invisible across users ❌

### After:
- Admin: 6 categories ✅
- User: 6 categories ✅
- All tasks visible ✅

## Need Details?

- **Full documentation:** `CATEGORY-FIX-SUMMARY.md`
- **Testing checklist:** `TESTING-CATEGORY-FIX.md`
- **Migration docs:** `scripts/README.md`

## Problems?

Check console for errors and review the detailed docs above.

