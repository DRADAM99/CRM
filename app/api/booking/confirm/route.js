import { NextResponse } from "next/server";
import { getAdminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import { collectConflicts, overlaps } from "@/lib/availability";
import {
  LEAD_STATUS_CALL_BOOKED,
  REENGAGEMENT_STATES,
} from "@/lib/whatsappAutomation";
import {
  findLeadByPhone,
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
      startAt,
      duration = 20,
      chatSessionId = null,
      idempotencyKey,
      createTask = true,
    } = body || {};

    // Accept phone/phoneNumber interchangeably (Chatfuel sends "phone")
    const phoneNumber = body.phoneNumber || body.phone || "";

    if (!startAt || (!leadId && !phoneNumber)) {
      await writeAutomationEvent("booking_confirm_invalid_payload", {
        leadId: leadId || null,
        hasPhone: Boolean(phoneNumber),
        hasStartAt: Boolean(startAt),
      });
      return NextResponse.json(
        { error: "startAt and either leadId or phone are required" },
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

    // Lead lookup: prefer leadId, fall back to phone
    let resolvedLeadId = leadId || null;
    let leadDoc = null;

    if (resolvedLeadId) {
      leadDoc = await db.collection("leads").doc(resolvedLeadId).get();
      if (!leadDoc.exists) leadDoc = null;
    }
    if (!leadDoc && phoneNumber) {
      const found = await findLeadByPhone(normalizePhoneNumber(String(phoneNumber)));
      if (found) {
        resolvedLeadId = found.id;
        leadDoc = await db.collection("leads").doc(resolvedLeadId).get();
      }
    }
    if (!leadDoc || !leadDoc.exists) {
      await writeAutomationEvent("booking_confirm_lead_not_found", {
        leadId: resolvedLeadId || null,
        phone: phoneNumber || null,
      });
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const leadData = leadDoc.data();

    // Conflict check — use only this staff member's tasks for speed
    const [tasksDocs] = await Promise.all([
      db.collection("tasks").where("assignedTo", "==", effectiveStaffId).limit(50).get(),
    ]);
    const tasks = tasksDocs.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const conflicts = collectConflicts(tasks, [], effectiveStaffId);
    const hasConflict = conflicts.some((conflict) =>
      overlaps(appointmentStart, appointmentEnd, conflict.start, conflict.end)
    );
    if (hasConflict) {
      return NextResponse.json(
        { error: "Requested slot is no longer available" },
        { status: 409 }
      );
    }

    await db.collection("leads").doc(resolvedLeadId).update({
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
      const displayPhone = normalizePhoneNumber(leadData.phoneNumber || "") || leadData.phoneNumber || "";
      const taskRef = db.collection("tasks").doc();
      await taskRef.set({
        id: taskRef.id,
        userId: effectiveStaffId,
        creatorId: effectiveStaffId,
        creatorAlias: staffDoc?.alias || staffDoc?.email || "Chatfuel",
        assignTo: staffDoc?.alias || staffDoc?.email || effectiveStaffId,
        title: leadData.fullName || "פגישת ייעוץ",
        subtitle: `פגישת ייעוץ | טלפון: ${displayPhone}`,
        priority: "רגיל",
        category: "לקבוע סדרה",
        status: "פתוח",
        createdAt: adminServerTimestamp(),
        updatedAt: adminServerTimestamp(),
        dueDate: appointmentStart,
        durationMinutes,
        leadId: resolvedLeadId,
        branch: leadData.branch || "",
        bookingSource: "whatsapp_chatfuel",
        done: false,
      });
    }

    await db.collection("bookingAuditLogs").add({
      leadId: resolvedLeadId,
      staffId: effectiveStaffId,
      startAt: appointmentStart,
      durationMinutes,
      chatSessionId,
      createdAt: adminServerTimestamp(),
    });

    await writeAutomationEvent("booking_confirmed", {
      leadId: resolvedLeadId,
      staffId: effectiveStaffId,
      chatSessionId,
      durationMinutes,
    });
    await markIdempotencyKey(idempotencyKey, "booking_confirm", { leadId: resolvedLeadId, staffId: effectiveStaffId });

    return NextResponse.json({
      success: true,
      leadId: resolvedLeadId,
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

