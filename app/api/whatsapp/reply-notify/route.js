import { NextResponse } from "next/server";
import { getAdminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import {
  LEAD_STATUS_NEW,
  LEAD_STATUS_NOT_FIT,
  REENGAGEMENT_STATES,
} from "@/lib/whatsappAutomation";
import { findLeadByPhone, writeAutomationEvent } from "@/lib/automationServer";
import { normalizePhoneNumber } from "@/lib/phoneUtils";

export async function POST(req) {
  try {
    const { phone, reply, leadId, chatfuelUserId } = await req.json();
    const replyCode = String(reply || "").toUpperCase();
    const normalizedPhone = normalizePhoneNumber(phone || "");

    if (!normalizedPhone && !leadId) {
      return NextResponse.json(
        { error: "Missing phone number or lead ID" },
        { status: 400 }
      );
    }

    // Find the lead
    let lead = null;
    if (leadId) {
      const doc = await getAdminDb().collection("leads").doc(leadId).get();
      if (doc.exists) lead = { id: doc.id, ...doc.data() };
    }
    
    if (!lead && normalizedPhone) {
      lead = await findLeadByPhone(normalizedPhone);
    }

    if (!lead) {
      await writeAutomationEvent("chatfuel_notify_unmatched", {
        phone,
        replyCode,
      });
      return NextResponse.json({ success: false, reason: "Lead not found" });
    }

    const updates = {
      waLastReply: adminServerTimestamp(),
      updatedAt: adminServerTimestamp(),
    };

    // Store Chatfuel's internal user ID so Broadcasting API calls can use it
    if (chatfuelUserId && String(chatfuelUserId).trim()) {
      updates.chatfuelUserId = String(chatfuelUserId).trim();
    }

    let eventType = "chatfuel_notify_unknown";

    if (replyCode === "A" || replyCode.includes("INTERESTED") || replyCode.includes("כן")) {
      updates.status = LEAD_STATUS_NEW;
      updates.reengagementState = REENGAGEMENT_STATES.interested;
      eventType = "chatfuel_notify_interested";
    } else if (replyCode === "B" || replyCode.includes("NOT") || replyCode.includes("לא")) {
      updates.status = LEAD_STATUS_NOT_FIT;
      updates.waOptOut = true;
      updates.reengagementState = REENGAGEMENT_STATES.notInterested;
      eventType = "chatfuel_notify_not_interested";
    }

    await getAdminDb().collection("leads").doc(lead.id).update(updates);
    
    await writeAutomationEvent(eventType, {
      leadId: lead.id,
      phone: normalizedPhone,
      replyCode,
      source: "chatfuel_api"
    });

    return NextResponse.json({ success: true, leadId: lead.id, status: updates.status });

  } catch (error) {
    console.error("Reply notify error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
