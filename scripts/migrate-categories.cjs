/**
 * Firebase Category Migration Script
 * 
 * This script standardizes task category names across the database:
 * - "תוכנית טיפול" (singular) → "תוכניות טיפול" (plural)
 * - "תשלומים" → "תשלומים וזיכויים"
 * 
 * Run once to fix category discrepancies.
 * 
 * Usage: node scripts/migrate-categories.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Category name mappings (old → new)
const categoryMappings = {
  'תוכנית טיפול': 'תוכניות טיפול',
  'תשלומים': 'תשלומים וזיכויים'
};

/**
 * Replaces old category names with standardized ones
 */
function normalizeCategory(category) {
  return categoryMappings[category] || category;
}

/**
 * Migrates task categories
 */
async function migrateTasks() {
  console.log('\n🔄 Starting task migration...\n');
  
  const tasksRef = db.collection('tasks');
  const snapshot = await tasksRef.get();
  
  let updatedCount = 0;
  const batch = db.batch();
  let batchCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const oldCategory = data.category;
    
    if (oldCategory && categoryMappings[oldCategory]) {
      const newCategory = categoryMappings[oldCategory];
      console.log(`  📝 Task ${doc.id}: "${oldCategory}" → "${newCategory}"`);
      
      batch.update(doc.ref, { 
        category: newCategory,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      updatedCount++;
      batchCount++;
      
      // Commit batch every 500 operations (Firestore limit)
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  ✅ Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }
    }
  }
  
  // Commit remaining updates
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  ✅ Committed final batch of ${batchCount} updates`);
  }
  
  console.log(`\n✅ Task migration complete: ${updatedCount} tasks updated\n`);
  return updatedCount;
}

/**
 * Migrates user preferences (kanbanCategoryOrder and tm_selectedTaskCategories)
 */
async function migrateUserPreferences() {
  console.log('\n🔄 Starting user preferences migration...\n');
  
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  let updatedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const updates = {};
    
    // Migrate kanbanCategoryOrder
    if (Array.isArray(data.kanbanCategoryOrder)) {
      const newOrder = data.kanbanCategoryOrder.map(normalizeCategory);
      if (JSON.stringify(newOrder) !== JSON.stringify(data.kanbanCategoryOrder)) {
        updates.kanbanCategoryOrder = newOrder;
        needsUpdate = true;
        console.log(`  📝 User ${doc.id} kanbanCategoryOrder:`);
        console.log(`     Old: [${data.kanbanCategoryOrder.join(', ')}]`);
        console.log(`     New: [${newOrder.join(', ')}]`);
      }
    }
    
    // Migrate tm_selectedTaskCategories
    if (Array.isArray(data.tm_selectedTaskCategories)) {
      const newSelected = data.tm_selectedTaskCategories.map(normalizeCategory);
      if (JSON.stringify(newSelected) !== JSON.stringify(data.tm_selectedTaskCategories)) {
        updates.tm_selectedTaskCategories = newSelected;
        needsUpdate = true;
        console.log(`  📝 User ${doc.id} tm_selectedTaskCategories:`);
        console.log(`     Old: [${data.tm_selectedTaskCategories.join(', ')}]`);
        console.log(`     New: [${newSelected.join(', ')}]`);
      }
    }
    
    if (needsUpdate) {
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await doc.ref.update(updates);
      updatedCount++;
    }
  }
  
  console.log(`\n✅ User preferences migration complete: ${updatedCount} users updated\n`);
  return updatedCount;
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Firebase Category Standardization Migration         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    const tasksUpdated = await migrateTasks();
    const usersUpdated = await migrateUserPreferences();
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   Migration Summary                        ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Tasks updated:           ${tasksUpdated.toString().padStart(4)} tasks                      ║`);
    console.log(`║  Users updated:           ${usersUpdated.toString().padStart(4)} users                      ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Standardized categories:                                  ║');
    console.log('║    • "תוכנית טיפול" → "תוכניות טיפול"                      ║');
    console.log('║    • "תשלומים" → "תשלומים וזיכויים"                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    console.log('\n✅ Migration completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();

