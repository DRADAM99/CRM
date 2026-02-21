import { NextResponse } from "next/server";
import { getAdminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import {
  LEAD_STATUS_NEW,
  LEAD_STATUS_NOT_FIT,
  REENGAGEMENT_STATES,
} from "@/lib/whatsappAutomation";
import {
  findLeadByPhone,
  hasProcessedIdempotencyKey,
  markIdempotencyKey,
  writeAutomationEvent,
} from "@/lib/automationServer";
import { normalizePhoneForWhatsapp } from "@/lib/whatsappAutomation";
import { normalizePhoneNumber } from "@/lib/phoneUtils";

function extractReplySignal(message) {
  if (!message) return null;
  const buttonId = message?.interactive?.button_reply?.id;
  const buttonTitle = message?.interactive?.button_reply?.title;
  const buttonText = message?.button?.text;
  const textBody = message?.text?.body;

  const candidates = [buttonId, buttonTitle, buttonText, textBody]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  if (candidates.some((value) => value === "a" || value.includes("כן נשמח לדבר") || (value.includes("כן") && value.includes("לדבר")) || value.includes("interested") || value.includes("yes_talk"))) {
    return "A";
  }
  if (candidates.some((value) => value === "b" || value.includes("כבר לא רלוונטי") || value.includes("לא רלוונטי") || value.includes("not_relevant") || value.includes("not_interested"))) {
    return "B";
  }
  return candidates[0] ? String(candidates[0]).toUpperCase() : null;
}

function buildChatfuelBroadcastUrl({
  botId,
  userId,
  chatfuelToken,
  flowName,
  blockName,
  blockId,
  attributes = {},
}) {
  const url = new URL(`https://api.chatfuel.com/bots/${botId}/users/${userId}/send`);
  url.searchParams.set("chatfuel_token", chatfuelToken);
  if (flowName) url.searchParams.set("chatfuel_flow_name", flowName);
  else if (blockName) url.searchParams.set("chatfuel_block_name", blockName);
  else if (blockId) url.searchParams.set("chatfuel_block_id", blockId);

  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function notifyChatfuel({ lead, fromPhone }) {
  if (process.env.CHATFUEL_HANDOFF_ENABLED === "false") {
    await writeAutomationEvent("chatfuel_handoff_disabled", { leadId: lead.id });
    return;
  }
  const botId = process.env.CHATFUEL_BOT_ID;
  const chatfuelToken = process.env.CHATFUEL_BROADCAST_TOKEN;
  const flowName = process.env.CHATFUEL_BROADCAST_FLOW_NAME || "entry_from_whatsapp_a";
  const blockName = process.env.CHATFUEL_BROADCAST_BLOCK_NAME;
  const blockId = process.env.CHATFUEL_BROADCAST_BLOCK_ID;
  const strategy = (process.env.CHATFUEL_USER_ID_STRATEGY || "wa_id").toLowerCase();
  const fallbackPhone = normalizePhoneForWhatsapp(fromPhone || lead.phoneNumber);
  const normalizedPhone = normalizePhoneNumber(lead.phoneNumber || fromPhone || "");
  if (!lead?.id) {
    await writeAutomationEvent("chatfuel_handoff_skipped", {
      leadId: null,
      reason: "missing_lead_id",
      normalizedPhone,
    });
    return;
  }
  // Always prefer the stored Chatfuel internal user ID when available
  const userId =
    lead.chatfuelUserId ||
    (strategy === "chatfuel_user_id"
      ? fallbackPhone
      : strategy === "phone"
        ? normalizePhoneForWhatsapp(lead.phoneNumber) || fallbackPhone
        : fromPhone || fallbackPhone);

  if (!botId || !chatfuelToken || !userId) {
    await writeAutomationEvent("chatfuel_handoff_skipped", {
      leadId: lead.id,
      missing: {
        botId: !botId,
        token: !chatfuelToken,
        userId: !userId,
      },
      strategy,
    });
    return;
  }

  const requestUrl = buildChatfuelBroadcastUrl({
    botId,
    userId,
    chatfuelToken,
    flowName,
    blockName,
    blockId,
    attributes: {
      leadId: lead.id,
      phoneNumber: normalizedPhone || lead.phoneNumber || "",
      normalizedPhone,
      fullName: lead.fullName || "לקוח",
      assignedStaffId: lead.assignedStaffId || "",
      campaignId: lead.reengagementCampaignId || "unknown",
      waReply: "A",
    },
  });

  try {
    const response = await fetch(requestUrl, { method: "POST" });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || "Chatfuel Broadcasting API error");
    }
    await writeAutomationEvent("chatfuel_handoff_success", {
      leadId: lead.id,
      userId,
      flowName,
      blockName,
      blockId,
      strategy,
    });
  } catch (error) {
    console.error("chatfuel handoff failed:", error?.message || error);
    await writeAutomationEvent("chatfuel_handoff_failed", {
      leadId: lead.id,
      message: error?.message || String(error),
      strategy,
    });
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  try {
    const payload = await req.json();
    if (process.env.WHATSAPP_WEBHOOK_ENABLED === "false") {
      return NextResponse.json({ success: true, skipped: "webhook_disabled" });
    }
    const changes = payload?.entry?.flatMap((entry) => entry?.changes || []) || [];
    const messages = changes.flatMap((change) => change?.value?.messages || []);

    for (const message of messages) {
      try {
        const idempotencyKey = message?.id;
        if (await hasProcessedIdempotencyKey(idempotencyKey, "whatsapp_webhook")) {
          continue;
        }

        const fromPhone = message?.from;
        const replyCode = extractReplySignal(message);
        const lead = await findLeadByPhone(fromPhone);
        if (!lead) {
          await writeAutomationEvent("whatsapp_reply_unmatched", {
            fromPhone,
            replyCode,
          });
          await markIdempotencyKey(idempotencyKey, "whatsapp_webhook", {
            unmatched: true,
          });
          continue;
        }

        const updates = {
          waLastReply: adminServerTimestamp(),
          updatedAt: adminServerTimestamp(),
        };

        if (replyCode === "A") {
          updates.status = LEAD_STATUS_NEW;
          updates.reengagementState = REENGAGEMENT_STATES.interested;
          await getAdminDb().collection("leads").doc(lead.id).update(updates);
          await notifyChatfuel({ lead, fromPhone });
          await writeAutomationEvent("whatsapp_reply_interested", {
            leadId: lead.id,
            replyCode,
          });
        } else if (replyCode === "B") {
          updates.status = LEAD_STATUS_NOT_FIT;
          updates.waOptOut = true;
          updates.reengagementState = REENGAGEMENT_STATES.notInterested;
          await getAdminDb().collection("leads").doc(lead.id).update(updates);
          await writeAutomationEvent("whatsapp_reply_not_interested", {
            leadId: lead.id,
            replyCode,
          });
        } else {
          await writeAutomationEvent("whatsapp_reply_unknown", {
            leadId: lead.id,
            replyCode,
          });
        }

        await markIdempotencyKey(idempotencyKey, "whatsapp_webhook", {
          leadId: lead.id,
          replyCode,
        });
      } catch (messageError) {
        await writeAutomationEvent("whatsapp_reply_processing_failed", {
          messageId: message?.id || null,
          details: messageError?.message || String(messageError),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Webhook processing failed", details: error.message },
      { status: 500 }
    );
  }
}

