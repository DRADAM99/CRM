import { NextResponse } from "next/server";
import { db } from "@/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  LEAD_STATUS_NEW,
  REENGAGEMENT_STATES,
  isLeadStale,
  normalizePhoneForWhatsapp,
} from "@/lib/whatsappAutomation";
import { writeAutomationEvent } from "@/lib/automationServer";

async function sendTemplateMessage({
  phoneNumber,
  templateName,
  languageCode,
  components = [],
  campaignId,
}) {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error("Missing WHATSAPP_META_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
  }

  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode || "he" },
      components,
    },
    metadata: {
      campaign_id: campaignId,
    },
  };

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Meta send failed");
  }
  return data;
}

async function resolveTargetLeads(leadIds = [], staleDays = 10) {
  if (Array.isArray(leadIds) && leadIds.length > 0) {
    const resolved = await Promise.all(
      leadIds.map(async (leadId) => {
        const snapshot = await getDoc(doc(db, "leads", leadId));
        if (!snapshot.exists()) return null;
        return { id: snapshot.id, ...snapshot.data() };
      })
    );
    return resolved.filter(Boolean);
  }

  const allNewLeads = await getDocs(
    query(collection(db, "leads"), where("status", "==", LEAD_STATUS_NEW))
  );
  return allNewLeads.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((lead) => isLeadStale(lead, staleDays));
}

export async function POST(req) {
  try {
    if (process.env.WHATSAPP_CAMPAIGNS_ENABLED === "false") {
      return NextResponse.json(
        { error: "Campaign sending is disabled by configuration" },
        { status: 503 }
      );
    }
    const body = await req.json();
    const defaultTemplateName = process.env.WHATSAPP_REENGAGEMENT_TEMPLATE_NAME || "oldleads";
    const defaultLanguageCode = process.env.WHATSAPP_REENGAGEMENT_TEMPLATE_LANGUAGE || "he";
    const {
      targets = [],
      leadIds = [],
      staleDays = 10,
      templateName,
      languageCode = defaultLanguageCode,
      components = [],
      dryRun = false,
      campaignName = "re_engagement",
    } = body || {};
    const resolvedTemplateName = String(templateName || defaultTemplateName).trim();

    if (!resolvedTemplateName) {
      return NextResponse.json(
        { error: "No WhatsApp template configured", details: "Set WHATSAPP_REENGAGEMENT_TEMPLATE_NAME" },
        { status: 400 }
      );
    }

    const resolvedTargetsFromPayload = Array.isArray(targets) && targets.length > 0
      ? targets
          .map((target) => ({
            id: target?.leadId || target?.id || null,
            phoneNumber: target?.phoneNumber || "",
            waOptOut: !!target?.waOptOut,
          }))
          .filter((target) => target.id && target.phoneNumber)
      : null;

    const targetsToSend = resolvedTargetsFromPayload || (await resolveTargetLeads(leadIds, staleDays));
    const campaignId = `${campaignName}_${Date.now()}`;
    const results = [];

    for (const lead of targetsToSend) {
      if (lead.waOptOut) {
        results.push({ leadId: lead.id, skipped: true, reason: "opt_out" });
        continue;
      }

      const phone = normalizePhoneForWhatsapp(lead.phoneNumber);
      if (!phone) {
        results.push({ leadId: lead.id, skipped: true, reason: "invalid_phone" });
        continue;
      }

      try {
        const providerResponse = dryRun
          ? { dryRun: true }
          : await sendTemplateMessage({
              phoneNumber: phone,
              templateName: resolvedTemplateName,
              languageCode,
              components,
              campaignId,
            });

        if (!resolvedTargetsFromPayload) {
          await updateDoc(doc(db, "leads", lead.id), {
            lastOutboundTemplateAt: serverTimestamp(),
            lastOutboundTemplateName: resolvedTemplateName,
            reengagementCampaignId: campaignId,
            reengagementState: REENGAGEMENT_STATES.pending,
            updatedAt: serverTimestamp(),
          });

          await addDoc(collection(db, "whatsappCampaignLogs"), {
            leadId: lead.id,
            phoneNumber: phone,
            templateName: resolvedTemplateName,
            campaignId,
            provider: "meta_cloud_api",
            dryRun,
            providerResponse,
            createdAt: serverTimestamp(),
          });
        }

        results.push({ leadId: lead.id, success: true });
      } catch (error) {
        results.push({
          leadId: lead.id,
          success: false,
          error: error.message,
        });
      }
    }

    await writeAutomationEvent("campaign_send_complete", {
      campaignId,
      requested: targetsToSend.length,
      sent: results.filter((item) => item.success).length,
      dryRun,
      source: resolvedTargetsFromPayload ? "client_targets" : "server_query",
    });

    return NextResponse.json({
      success: true,
      templateName: resolvedTemplateName,
      campaignId,
      requested: targetsToSend.length,
      sent: results.filter((item) => item.success).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to send campaign", details: error.message },
      { status: 500 }
    );
  }
}

