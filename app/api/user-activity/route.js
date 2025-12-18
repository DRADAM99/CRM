// /app/api/user-activity/route.js
// API endpoint for fetching user activity logs

import { db } from "../../../firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";

// Helper function to create a response with CORS headers
function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return createResponse({});
}

export async function POST(req) {
  try {
    const data = await req.json();
    const { userId, startDate, endDate } = data;

    // Validate required fields
    if (!userId) {
      return createResponse({ 
        error: "Missing required fields",
        details: "userId is required"
      }, 400);
    }

    if (!startDate || !endDate) {
      return createResponse({ 
        error: "Missing required fields",
        details: "startDate and endDate are required (YYYY-MM-DD format)"
      }, 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return createResponse({ 
        error: "Invalid date format",
        details: "Dates must be in YYYY-MM-DD format"
      }, 400);
    }

    // Convert dates to Firestore Timestamps
    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    const startTimestamp = Timestamp.fromDate(startDateTime);
    const endTimestamp = Timestamp.fromDate(endDateTime);

    // Query userActivity collection
    let snapshot;
    try {
      const activityRef = collection(db, "userActivity");
      const q = query(
        activityRef,
        where("userId", "==", userId),
        where("timestamp", ">=", startTimestamp),
        where("timestamp", "<=", endTimestamp)
      );

      snapshot = await getDocs(q);
    } catch (queryError) {
      // Collection might not exist yet - return empty data
      return createResponse({
        success: true,
        data: [],
        count: 0,
        hourlyActivity: {},
        dateRange: { startDate, endDate },
        userId,
        note: "userActivity collection not yet initialized"
      });
    }
    
    if (snapshot.empty) {
      return createResponse({
        success: true,
        data: [],
        count: 0,
        hourlyActivity: {},
        dateRange: { startDate, endDate },
        userId
      });
    }

    // Process activities and group by date and hour
    const activities = [];
    const hourlyActivity = {}; // { "2024-12-18": { 8: 5, 9: 12, ... } }

    snapshot.forEach(doc => {
      const activity = doc.data();
      
      // Convert Firestore Timestamp to JS Date
      const timestamp = activity.timestamp?.toDate();
      if (!timestamp) return;

      const dateStr = formatDateForApi(timestamp);
      const hour = timestamp.getHours();

      // Initialize date if not exists
      if (!hourlyActivity[dateStr]) {
        hourlyActivity[dateStr] = {};
      }

      // Initialize hour if not exists
      if (!hourlyActivity[dateStr][hour]) {
        hourlyActivity[dateStr][hour] = 0;
      }

      // Increment activity count for this hour
      hourlyActivity[dateStr][hour]++;

      // Add to activities array
      activities.push({
        id: doc.id,
        userId: activity.userId,
        userEmail: activity.userEmail,
        timestamp: timestamp.toISOString(),
        action: activity.action,
        entity: activity.entity,
        entityId: activity.entityId,
        details: activity.details || {}
      });
    });

    // Sort activities by timestamp descending (newest first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return createResponse({
      success: true,
      data: activities,
      count: activities.length,
      hourlyActivity, // Main output: { "2024-12-18": { 8: 5, 9: 12, ... } }
      dateRange: { startDate, endDate },
      userId
    });

  } catch (error) {
    console.error("Error fetching user activity:", {
      error: error.message,
      stack: error.stack,
      name: error.name,
      userId: data?.userId,
      startDate: data?.startDate,
      endDate: data?.endDate
    });
    
    // Return empty data instead of error - don't break the dashboard
    return createResponse({ 
      success: true,
      data: [],
      count: 0,
      hourlyActivity: {},
      dateRange: { startDate: data?.startDate, endDate: data?.endDate },
      userId: data?.userId,
      error: error.message,
      note: "Error fetching activity, returning empty data"
    }, 200);
  }
}

// Helper to format date as YYYY-MM-DD
function formatDateForApi(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

