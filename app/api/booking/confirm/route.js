import { NextResponse } from "next/server";
import { getAdminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import { collectConflicts, overlaps } from "@/lib/availability";
import {
  LEAD_STATUS_CALL_BOOKED,
  REENGAGEMENT_STATES,
} from "@/lib/whatsappAutomation";
import {
  hasProcessedIdempotencyKey,
  markIdempotencyKey,
  resolveStaffUser,
  writeAutomationEvent,
} from "@/lib/automationServer";
import { normalizePhoneNumber } from "@/lib/phoneUtils";

function normalizeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req) {
  try {
    if (process.env.BOOKING_CONFIRM_ENABLED === "false") {
      return NextResponse.json(
        { error: "Booking confirmation is disabled by configuration" },
        { status: 503 }
      );
    }
    const body = await req.json();
    const {
      leadId,
      staffId: staffIdParam,
      staffEmail,
      staffAlias,
      phoneNumber,
      startAt,
      duration = 20,
      chatSessionId = null,
      idempotencyKey,
      createTask = true,
    } = body || {};

    if (!leadId || !startAt) {
      await writeAutomationEvent("booking_confirm_invalid_payload", {
        leadId: leadId || null,
        hasStartAt: Boolean(startAt),
      });
      return NextResponse.json(
        { error: "leadId and startAt are required" },
        { status: 400 }
      );
    }

    if (await hasProcessedIdempotencyKey(idempotencyKey, "booking_confirm")) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const appointmentStart = normalizeDate(startAt);
    if (!appointmentStart) {
      return NextResponse.json({ error: "Invalid startAt value" }, { status: 400 });
    }
    const durationMinutes = Math.max(10, Number(duration) || 20);
    const appointmentEnd = new Date(
      appointmentStart.getTime() + durationMinutes * 60 * 1000
    );

    const db = getAdminDb();
    const resolvedStaff = await resolveStaffUser({
      staffId: staffIdParam,
      email: staffEmail,
      alias: staffAlias,
      fallbackEmail: process.env.DEFAULT_BOOKING_STAFF_EMAIL || "tamardayaan@gmail.com",
      fallbackAlias: process.env.DEFAULT_BOOKING_STAFF_ALIAS || "תמר",
    });
    if (!resolvedStaff?.id) {
      return NextResponse.json(
        {
          error: "No matching staff user for booking",
          details: "Pass staffId/staffEmail/staffAlias or set DEFAULT_BOOKING_STAFF_EMAIL",
        },
        { status: 400 }
      );
    }
    const effectiveStaffId = resolvedStaff.id;

    const [leadDoc, tasksDocs, leadsDocs, staffDoc] = await Promise.all([
      db.collection("leads").doc(leadId).get(),
      db.collection("tasks").get(),
      db.collection("leads").get(),
      Promise.resolve(resolvedStaff),
    ]);

    if (!leadDoc.exists) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const leadData = leadDoc.data();
    const requestPhone = normalizePhoneNumber(String(phoneNumber || ""));
    const leadPhone = normalizePhoneNumber(String(leadData.phoneNumber || ""));
    if (requestPhone && leadPhone && requestPhone !== leadPhone) {
      await writeAutomationEvent("booking_confirm_phone_conflict", {
        leadId,
        requestPhone,
        leadPhone,
      });
      return NextResponse.json(
        { error: "Phone does not match leadId" },
        { status: 409 }
      );
    }
    const tasks = tasksDocs.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const leads = leadsDocs.docs
      .filter((entry) => entry.id !== leadId)
      .map((entry) => ({ id: entry.id, ...entry.data() }));
    const conflicts = collectConflicts(tasks, leads, effectiveStaffId);
    const hasConflict = conflicts.some((conflict) =>
      overlaps(appointmentStart, appointmentEnd, conflict.start, conflict.end)
    );
    if (hasConflict) {
      return NextResponse.json(
        { error: "Requested slot is no longer available" },
        { status: 409 }
      );
    }

    await db.collection("leads").doc(leadId).update({
      status: LEAD_STATUS_CALL_BOOKED,
      appointmentDateTime: appointmentStart,
      meetingDurationMinutes: durationMinutes,
      assignedStaffId: effectiveStaffId,
      bookingSource: "whatsapp_chatfuel",
      bookingConversationId: chatSessionId,
      reengagementState: REENGAGEMENT_STATES.booked,
      updatedAt: adminServerTimestamp(),
    });

    if (createTask) {
      const taskRef = db.collection("tasks").doc();
      await taskRef.set({
        id: taskRef.id,
        userId: effectiveStaffId,
        creatorId: effectiveStaffId,
        creatorAlias: staffDoc?.alias || staffDoc?.email || "Chatfuel",
        assignTo: staffDoc?.alias || staffDoc?.email || effectiveStaffId,
        title: leadData.fullName || "פגישת ייעוץ",
        subtitle: `פגישת ייעוץ | טלפון: ${leadData.phoneNumber || ""}`,
        priority: "רגיל",
        category: "לקבוע סדרה",
        status: "פתוח",
        createdAt: adminServerTimestamp(),
        updatedAt: adminServerTimestamp(),
        dueDate: appointmentStart,
        durationMinutes,
        leadId,
        branch: leadData.branch || "",
        bookingSource: "whatsapp_chatfuel",
        done: false,
      });
    }

    await db.collection("bookingAuditLogs").add({
      leadId,
      staffId: effectiveStaffId,
      startAt: appointmentStart,
      durationMinutes,
      chatSessionId,
      createdAt: adminServerTimestamp(),
    });

    await writeAutomationEvent("booking_confirmed", {
      leadId,
      staffId: effectiveStaffId,
      chatSessionId,
      durationMinutes,
    });
    await markIdempotencyKey(idempotencyKey, "booking_confirm", { leadId, staffId: effectiveStaffId });

    return NextResponse.json({
      success: true,
      leadId,
      status: LEAD_STATUS_CALL_BOOKED,
    });
  } catch (error) {
    const details = error.message || "Unknown error";
    if (details.includes("Missing or insufficient permissions")) {
      return NextResponse.json(
        {
          error: "Booking backend lacks Firestore write permissions",
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
      { error: "Failed to confirm booking", details },
      { status: 500 }
    );
  }
}

