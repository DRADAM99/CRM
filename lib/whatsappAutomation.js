import { Timestamp } from "firebase/firestore";
import { normalizePhoneNumber } from "@/lib/phoneUtils";

export const LEAD_STATUS_NEW = "חדש";
export const LEAD_STATUS_NOT_FIT = "לא מתאים";
export const LEAD_STATUS_CALL_BOOKED = "נקבעה שיחה";
export const LEGACY_LEAD_STATUS_CALL_BOOKED = "תור נקבע";

export const APPOINTMENT_LEAD_STATUSES = [
  LEAD_STATUS_CALL_BOOKED,
  LEGACY_LEAD_STATUS_CALL_BOOKED,
];

export const REENGAGEMENT_STATES = {
  idle: "idle",
  pending: "pending_response",
  interested: "interested",
  booked: "booked",
  notInterested: "not_interested",
};

export function isAppointmentLeadStatus(status) {
  return APPOINTMENT_LEAD_STATUSES.includes(status);
}

export function normalizePhoneForWhatsapp(rawPhone) {
  const localPhone = normalizePhoneNumber(String(rawPhone || ""));
  if (!localPhone) return "";
  return localPhone.startsWith("0") ? `972${localPhone.slice(1)}` : localPhone;
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  if (value instanceof Timestamp) {
    const converted = value.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isLeadStale(lead, staleDays = 10) {
  if (!lead || lead.status !== LEAD_STATUS_NEW) return false;
  if (lead.waOptOut) return false;

  const staleMs = Math.max(1, Number(staleDays) || 10) * 24 * 60 * 60 * 1000;
  const baseline =
    toDate(lead.lastOutboundTemplateAt) ||
    toDate(lead.updatedAt) ||
    toDate(lead.createdAt);

  if (!baseline) return false;
  return Date.now() - baseline.getTime() >= staleMs;
}

export function getLeadAutomationDefaults() {
  return {
    waOptOut: false,
    waLastReply: null,
    reengagementState: REENGAGEMENT_STATES.idle,
    reengagementCampaignId: null,
    bookingSource: null,
    bookingConversationId: null,
    assignedStaffId: null,
    whatsappConsent: true,
  };
}

export function buildLeadAutomationUpdate(partial = {}) {
  return {
    ...getLeadAutomationDefaults(),
    ...partial,
  };
}

