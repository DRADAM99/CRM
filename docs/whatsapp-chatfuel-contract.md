# WhatsApp + Chatfuel Contract

## Provider Ownership

- Meta WhatsApp Cloud API owns:
  - template send (`/api/whatsapp/campaign/send`)
  - webhook ingress (`/api/whatsapp/webhook`)
- Chatfuel owns:
  - conversational flow after `A`
  - booking UX and slot selection
- CRM owns:
  - lead state writes
  - availability and slot validation
  - final booking confirmation writeback

## Required Environment Variables

- `WHATSAPP_META_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `CHATFUEL_BOT_ID`
- `CHATFUEL_BROADCAST_TOKEN`
- `CHATFUEL_USER_ID_STRATEGY` (`wa_id` recommended)
- One of:
  - `CHATFUEL_BROADCAST_FLOW_NAME` (recommended)
  - `CHATFUEL_BROADCAST_BLOCK_NAME`
  - `CHATFUEL_BROADCAST_BLOCK_ID`
- Optional rollback switches:
  - `WHATSAPP_CAMPAIGNS_ENABLED`
  - `WHATSAPP_WEBHOOK_ENABLED`
  - `CHATFUEL_HANDOFF_ENABLED`
  - `BOOKING_CONFIRM_ENABLED`

## CRM API Contract For Chatfuel

- `GET /api/booking/options?days=3&duration=20&maxSlotsPerDay=5`
  - response: `{ options: [{ date, label, slots: [{ label, startAt, endAt }] }] }`
- `GET /api/booking/slots?staffId=<id>&date=YYYY-MM-DD&duration=20`
  - response: `{ staffId, date, durationMinutes, timezone, slots: [{ startAt, endAt }] }`
- `POST /api/booking/confirm`
  - request:
    - `leadId` (string, required)
    - `phoneNumber` (string, optional but recommended for continuity check)
    - `staffId` (string, optional, backend can resolve default)
    - `startAt` (ISO datetime, required)
    - `duration` (number, optional, default 20)
    - `chatSessionId` (string, optional)
    - `idempotencyKey` (string, optional but recommended)
  - response: `{ success: true, leadId, status: "נקבעה שיחה" }`

## Webhook Reply Rules

- `A`:
  - keep lead status `חדש`
  - set `reengagementState = interested`
  - route to Chatfuel via Broadcasting API
  - broadcast attributes required: `leadId`, `phoneNumber`, `fullName`, `campaignId`, `waReply`
- `B`:
  - set lead status `לא מתאים`
  - set `waOptOut = true`
  - set `reengagementState = not_interested`

## Chatfuel User ID Strategy

- Default: `wa_id`
  - Uses WhatsApp sender id from Meta webhook as `users/<USER_ID>` in Chatfuel Broadcasting API.
- Alternatives:
  - `chatfuel_user_id`: uses `lead.chatfuelUserId` when present.
  - `phone`: uses normalized phone number.

