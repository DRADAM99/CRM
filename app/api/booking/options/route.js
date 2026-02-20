import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  collectConflicts,
  generateSlotsForDate,
  getDefaultAvailability,
  normalizeAvailability,
} from "@/lib/availability";
import { resolveStaffUser } from "@/lib/automationServer";

function toDateKey(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabel(index, dateKey, timeZone) {
  if (index === 0) return "היום";
  if (index === 1) return "מחר";
  if (index === 2) return "מחרתיים";
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("he-IL", {
    timeZone,
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function slotLabel(startAt, timeZone) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(startAt));
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(7, Number(url.searchParams.get("days") || 3)));
    const duration = Math.max(10, Number(url.searchParams.get("duration") || 20));
    const maxSlotsPerDay = Math.max(1, Math.min(8, Number(url.searchParams.get("maxSlotsPerDay") || 5)));
    const staffIdParam = url.searchParams.get("staffId");
    const staffEmailParam = url.searchParams.get("staffEmail");
    const staffAliasParam = url.searchParams.get("staffAlias");
    const db = getAdminDb();

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
    const timeZone = availability.timezone || "Asia/Jerusalem";

    const options = [];
    const now = new Date();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const date = toDateKey(d, timeZone);
      const generated = generateSlotsForDate({
        date,
        availability,
        durationMinutes: duration,
        conflicts,
      }).slice(0, maxSlotsPerDay);
      options.push({
        index: i,
        date,
        label: dayLabel(i, date, timeZone),
        hasSlots: generated.length > 0,
        slots: generated.map((slot) => ({
          label: slotLabel(slot.startAt, timeZone),
          startAt: slot.startAt,
          endAt: slot.endAt,
        })),
      });
    }

    return NextResponse.json({
      staffId: effectiveStaffId,
      staffEmail: resolvedStaff.email || null,
      staffAlias: resolvedStaff.alias || null,
      durationMinutes: duration,
      timezone: timeZone,
      options,
    });
  } catch (error) {
    const details = error.message || "Unknown error";
    if (
      details.includes("Missing or insufficient permissions") ||
      details.includes("Unable to detect a Project Id") ||
      details.includes("Could not load the default credentials")
    ) {
      return NextResponse.json(
        {
          error: "Booking options backend is not fully configured",
          details,
          hint: "Configure Firebase Admin credentials in environment variables",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to build booking options", details },
      { status: 500 }
    );
  }
}

