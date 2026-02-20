import { NextResponse } from "next/server";

function asBool(value, defaultValue = true) {
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() !== "false";
}

export async function GET() {
  const checks = {
    whatsappMetaToken: Boolean(process.env.WHATSAPP_META_TOKEN),
    whatsappPhoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    whatsappTemplateName: Boolean(process.env.WHATSAPP_REENGAGEMENT_TEMPLATE_NAME || "oldleads"),
    webhookVerifyToken: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    chatfuelBotId: Boolean(process.env.CHATFUEL_BOT_ID),
    chatfuelBroadcastToken: Boolean(process.env.CHATFUEL_BROADCAST_TOKEN),
    firebaseAdminCredentials:
      Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON) ||
      Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) ||
      Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  };

  const switches = {
    campaignsEnabled: asBool(process.env.WHATSAPP_CAMPAIGNS_ENABLED, true),
    webhookEnabled: asBool(process.env.WHATSAPP_WEBHOOK_ENABLED, true),
    chatfuelHandoffEnabled: asBool(process.env.CHATFUEL_HANDOFF_ENABLED, true),
    bookingConfirmEnabled: asBool(process.env.BOOKING_CONFIRM_ENABLED, true),
  };

  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  return NextResponse.json({
    ready: missing.length === 0,
    missing,
    checks,
    switches,
    hints: missing.includes("firebaseAdminCredentials")
      ? [
          "Set FIREBASE_SERVICE_ACCOUNT_KEY_JSON or FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 for server-side booking/availability routes.",
        ]
      : [],
  });
}

