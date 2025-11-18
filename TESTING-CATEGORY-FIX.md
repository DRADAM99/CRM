# Category Fix Testing Checklist

## Pre-Migration Verification

### Before running the migration script, document current state:

**As Admin User:**
1. ✅ Open TaskManager
2. ✅ Open the category filter dropdown
3. ✅ Count total categories displayed
   - Expected to see: **7 categories** (including duplicate singular/plural)
   - Note which categories you see

**As Regular User:**
1. ✅ Open TaskManager
2. ✅ Open the category filter dropdown
3. ✅ Count total categories displayed
   - Expected to see: **6 categories**
   - Note which categories you see

**Cross-User Task Visibility Issue:**
1. ✅ As Admin: Create a task in category "תוכנית טיפול" (singular)
2. ✅ Assign it to the regular user
3. ✅ As Regular User: Try to find the task
   - Expected: **Task should NOT be visible** in "תוכניות טיפול" (plural) filter
   - This is the bug we're fixing

---

## Migration Steps

### Step 1: Install Dependencies
```bash
npm install firebase-admin
```

### Step 2: Prepare Service Account Key
1. Get your Firebase service account key JSON file
2. Save it as `serviceAccountKey.json` in the project root
3. **IMPORTANT:** Ensure this file is in `.gitignore`

### Step 3: Run Migration Script
```bash
node scripts/migrate-categories.js
```

Expected output:
- Number of tasks updated
- Number of users updated
- List of category mappings applied

**Save the output** for verification.

---

## Post-Migration Verification

### Test 1: Category Count Consistency

**As Admin User:**
1. ✅ Log out and log back in (to clear cache)
2. ✅ Open TaskManager
3. ✅ Open the category filter dropdown
4. ✅ **Expected:** See exactly **6 categories**:
   - תוכניות טיפול (plural)
   - לקבוע סדרה
   - תשלומים וזיכויים (full name)
   - דוחות
   - להתקשר
   - אחר

**As Regular User:**
1. ✅ Log out and log back in (to clear cache)
2. ✅ Open TaskManager
3. ✅ Open the category filter dropdown
4. ✅ **Expected:** See exactly **6 categories** (same as admin)

**Verification:** Both users should see identical category lists.

---

### Test 2: Cross-User Task Visibility

**As Admin User:**
1. ✅ Create a new task
2. ✅ Set category to "תוכניות טיפול"
3. ✅ Assign to regular user
4. ✅ Note the task title

**As Regular User:**
1. ✅ Open TaskManager
2. ✅ Ensure "תוכניות טיפול" is selected in category filter
3. ✅ **Expected:** See the task created by admin
4. ✅ Click on the task to verify details

**Verification:** Task should be visible and accessible.

---

### Test 3: Legacy Tasks Migration

**Check existing tasks:**
1. ✅ As Admin: Filter by "תוכניות טיפול"
2. ✅ **Expected:** See ALL treatment plan tasks (including old ones)
3. ✅ Open a task that was created before migration
4. ✅ **Expected:** Task opens without errors

**Verification:** Old tasks with "תוכנית טיפול" (singular) are now visible in "תוכניות טיפול" (plural) filter.

---

### Test 4: Automated Task Creation from Leads

**In CandidatesBlock:**
1. ✅ Edit a lead
2. ✅ Change status to "נקבעה סדרה"
3. ✅ Save the lead
4. ✅ **Expected:** Automated task is created in "תוכניות טיפול" category

**Verify in TaskManager:**
1. ✅ Filter by "תוכניות טיפול"
2. ✅ **Expected:** New automated task appears
3. ✅ Task is assigned to dradamwinter@gmail.com
4. ✅ Both admin and assigned user can see the task

---

### Test 5: Category Persistence

**As Admin:**
1. ✅ Uncheck some categories in the filter dropdown
2. ✅ Refresh the page
3. ✅ **Expected:** Selected categories remain unchecked

**As Regular User:**
1. ✅ Uncheck different categories in the filter dropdown
2. ✅ Refresh the page
3. ✅ **Expected:** Selected categories remain unchecked

**Verification:** Category preferences persist correctly for each user.

---

### Test 6: Kanban View Category Order

**In Full View Mode:**
1. ✅ Switch to full kanban view
2. ✅ **Expected:** See 6 category columns (not 7)
3. ✅ Drag a category column to reorder
4. ✅ Refresh the page
5. ✅ **Expected:** Column order is preserved

**Verification:** No duplicate category columns exist.

---

### Test 7: Task Drag & Drop Between Categories

**In Full View Mode:**
1. ✅ Create a test task in "להתקשר"
2. ✅ Drag it to "תוכניות טיפול" column
3. ✅ **Expected:** Task moves successfully
4. ✅ Refresh and verify task is in new category

**As Another User:**
1. ✅ Open TaskManager
2. ✅ Filter by "תוכניות טיפול"
3. ✅ **Expected:** See the moved task

---

## Rollback Procedure (If Needed)

If the migration causes issues:

1. **Restore from Firebase backup** (if available)
2. **Revert code changes:**
   ```bash
   git checkout HEAD components/TaskManager.js
   git checkout HEAD components/CandidatesBlock.js
   git checkout HEAD components/LeadManager.js
   ```
3. **Remove migration script:**
   ```bash
   rm -rf scripts/
   ```

---

## Success Criteria

✅ All tests pass
✅ No duplicate categories
✅ Tasks visible across users
✅ Category preferences persist
✅ No console errors
✅ Automated task creation works

---

## Known Issues After Migration

None expected. If you encounter issues, please document:
- User role (admin/user)
- Browser and version
- Console error messages
- Steps to reproduce
- Screenshot if applicable

