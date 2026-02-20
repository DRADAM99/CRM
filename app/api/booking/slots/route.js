import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  collectConflicts,
  generateSlotsForDate,
  getDefaultAvailability,
  normalizeAvailability,
} from "@/lib/availability";
import { resolveStaffUser } from "@/lib/automationServer";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const staffIdParam = url.searchParams.get("staffId");
    const staffEmailParam = url.searchParams.get("staffEmail");
    const staffAliasParam = url.searchParams.get("staffAlias");
    const date = url.searchParams.get("date");
    const duration = Number(url.searchParams.get("duration") || "20");
    const db = getAdminDb();
    if (!date) {
      return NextResponse.json(
        { error: "date is a required query param" },
        { status: 400 }
      );
    }

    const resolvedStaff = await resolveStaffUser({
      staffId: staffIdParam,
      email: staffEmailParam,
      alias: staffAliasParam,
      fallbackEmail: process.env.DEFAULT_BOOKING_STAFF_EMAIL || "tamardayaan@gmail.com",
      fallbackAlias: process.env.DEFAULT_BOOKING_STAFF_ALIAS || "תמר",
    });
    if (!resolvedStaff?.id) {
      return NextResponse.json(
        {
          error: "No matching staff user for scheduling",
          details: "Pass staffId/staffEmail/staffAlias or set DEFAULT_BOOKING_STAFF_EMAIL",
        },
        { status: 400 }
      );
    }
    const effectiveStaffId = resolvedStaff.id;

    const [availabilityDoc, taskDocs, leadDocs] = await Promise.all([
      db.collection("staffAvailability").doc(effectiveStaffId).get(),
      db.collection("tasks").get(),
      db.collection("leads").get(),
    ]);

    const availability = availabilityDoc.exists
      ? normalizeAvailability(availabilityDoc.data()?.availability)
      : getDefaultAvailability();

    const tasks = taskDocs.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const leads = leadDocs.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const conflicts = collectConflicts(tasks, leads, effectiveStaffId);
    const slots = generateSlotsForDate({
      date,
      availability,
      durationMinutes: duration,
      conflicts,
    });

    return NextResponse.json({
      staffId: effectiveStaffId,
      staffEmail: resolvedStaff.email || null,
      staffAlias: resolvedStaff.alias || null,
      date,
      durationMinutes: duration,
      timezone: availability.timezone,
      slots,
    });
  } catch (error) {
    const details = error.message || "Unknown error";
    if (details.includes("Missing or insufficient permissions")) {
      return NextResponse.json(
        {
          error: "Booking slots backend lacks Firestore read permissions",
          details,
          hint: "Configure server-side admin credentials for booking endpoints",
        },
        { status: 503 }
      );
    }
    if (details.includes("Unable to detect a Project Id") || details.includes("Could not load the default credentials")) {
      return NextResponse.json(
        {
          error: "Firebase Admin credentials are not configured",
          details,
          hint: "Set FIREBASE_SERVICE_ACCOUNT_KEY_JSON (or BASE64) in environment",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate slots", details },
      { status: 500 }
    );
  }
}

