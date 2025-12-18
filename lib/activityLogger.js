// lib/activityLogger.js
// Utility for logging user activity to Firestore

import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Log a user activity to Firestore
 * @param {string} userId - The user's Firebase UID
 * @param {string} userEmail - The user's email or alias
 * @param {string} action - "create" | "update"
 * @param {string} entity - "lead" | "task" | "note" | "candidate"
 * @param {string} entityId - The ID of the entity being acted upon
 * @param {object} details - Optional metadata (e.g., field changes, status)
 */
export async function logActivity(userId, userEmail, action, entity, entityId, details = {}) {
  try {
    // Don't log if no user
    if (!userId || !userEmail) {
      console.warn("ActivityLogger: No user provided, skipping log");
      return;
    }

    // Create activity log entry
    const activityRef = collection(db, "userActivity");
    await addDoc(activityRef, {
      userId,
      userEmail,
      timestamp: serverTimestamp(),
      action, // "create" | "update"
      entity, // "lead" | "task" | "note" | "candidate"
      entityId,
      details, // Optional metadata
    });

    // Silent success (fire-and-forget pattern)
    // console.log(`✅ Activity logged: ${action} ${entity} ${entityId}`);
  } catch (error) {
    // Silent failure - don't block main operations
    console.error("ActivityLogger: Failed to log activity", {
      userId,
      action,
      entity,
      entityId,
      error: error.message
    });
  }
}

