# Database Migration Scripts

## Category Migration

### Purpose
Standardizes task category names across the Firebase database to fix visibility issues where tasks assigned in one category don't appear for users with different category name variants.

### What It Fixes
1. **"תוכנית טיפול" (singular) → "תוכניות טיפול" (plural)**
2. **"תשלומים" → "תשלומים וזיכויים"**

### Prerequisites
1. Firebase Admin SDK service account key file (`serviceAccountKey.json`) in the project root
2. Node.js installed
3. Install firebase-admin: `npm install firebase-admin`

### How to Run

```bash
# From project root
node scripts/migrate-categories.js
```

### What It Does
1. **Updates tasks collection:**
   - Finds all tasks with old category names
   - Updates them to use standardized names
   - Sets updatedAt timestamp

2. **Updates users collection:**
   - Updates `kanbanCategoryOrder` arrays
   - Updates `tm_selectedTaskCategories` arrays
   - Replaces old category names with standardized ones

### Safety
- Uses Firestore batching for efficient updates
- Handles up to 500 operations per batch (Firestore limit)
- Only updates documents that actually need changes
- Logs all changes for verification

### Expected Results
After running:
- Admin user will see exactly 6 categories (not 7)
- Regular user will continue to see 6 categories
- Tasks are visible to all users regardless of who created them
- Automated task creation uses correct category names

### Verification
After migration, check:
1. Login as admin → TaskManager → Should see 6 categories
2. Login as user → TaskManager → Should see 6 categories
3. Both users should see the same categories
4. Tasks created with "תוכנית טיפול" now appear in "תוכניות טיפול" filter

