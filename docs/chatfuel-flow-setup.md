# Chatfuel Setup Blueprint

## Attributes

- `leadId`
- `phoneNumber`
- `fullName`
- `campaignId`
- `waReply`
- `staffId` (optional, backend resolves default staff)
- `selectedDate`
- `selectedSlotStart`
- `selectedSlotEnd`
- `meetingDuration`
- `bookingConfirmed`
- `chatSessionId`

## Broadcast Trigger (for reply A)

Use Chatfuel Broadcasting API from CRM webhook:

`POST https://api.chatfuel.com/bots/<BOT_ID>/users/<USER_ID>/send?chatfuel_token=<TOKEN>&chatfuel_flow_name=entry_from_whatsapp_a&leadId=<LEAD_ID>&phoneNumber=<PHONE>&assignedStaffId=<STAFF_ID>`

- `<BOT_ID>` from Chatfuel dashboard URL
- `<USER_ID>` should be Chatfuel user id if available, or WhatsApp user identifier synced in Chatfuel
- `chatfuel_flow_name` can be replaced with `chatfuel_block_name` or `chatfuel_block_id`

## Block Map

1. `entry_from_whatsapp_a`
   - receives `leadId`, `phoneNumber`, `fullName`, `campaignId`, `waReply`
   - if `leadId` is missing -> route to `booking_fallback_missing_identity` (do not call confirm)
2. `fetch_day_options`
   - JSON API call to `/api/booking/options` (no manual date typing)
3. `choose_day`
   - quick replies only (today/tomorrow/etc.)
4. `fetch_slots`
   - JSON API call to `/api/booking/slots` with selected day
5. `choose_slot`
   - quick replies only (button values = ISO `startAt`)
6. `confirm_booking`
   - JSON API call to `/api/booking/confirm`
7. `booking_success`
   - confirmation message + summary
8. `booking_fallback`
   - if no slots or API failure

## API Request Examples

### Button-ready day + time options (recommended)

`GET /api/booking/options?days=3&duration=20&maxSlotsPerDay=5`

- returns:
  - `options[0].label = "היום"`
  - `options[1].label = "מחר"`
  - `options[2].label = "מחרתיים"`
  - each option contains `slots[]` with `label` and `startAt`

### Slots

`GET /api/booking/slots?staffId={{staffId}}&date={{selectedDate}}&duration={{meetingDuration}}`

#### Slot response mapping for Chatfuel buttons
- Parse `slots[*].startAt` into human time labels.
- Store selected slot in attribute: `selectedSlotStart`.
- Recommended quick-reply value: exact ISO string from `startAt`.

### Confirm

`POST /api/booking/confirm`

```json
{
  "leadId": "{{leadId}}",
  "phoneNumber": "{{phoneNumber}}",
  "staffId": "{{staffId}}",
  "startAt": "{{selectedSlotStart}}",
  "duration": "{{meetingDuration}}",
  "chatSessionId": "{{chatSessionId}}",
  "idempotencyKey": "{{chatSessionId}}-{{selectedSlotStart}}"
}
```

### Chatfuel block wiring checklist
1. `entry_from_whatsapp_a` sets attributes from broadcast payload (`leadId`, `fullName`, `phoneNumber`, `campaignId`, `waReply`).
2. Add condition immediately after entry:
   - if `leadId` is empty -> `booking_fallback_missing_identity` and stop booking flow.
2. `fetch_day_options` (JSON API):
   - URL: `/api/booking/options?days=3&duration={{meetingDuration}}&maxSlotsPerDay=5`
   - Save:
     - `day1Label = options[0].label`, `day1Date = options[0].date`
     - `day2Label = options[1].label`, `day2Date = options[1].date`
     - `day3Label = options[2].label`, `day3Date = options[2].date`
3. `choose_day` block with 3 quick replies (no manual typing):
   - quick reply text: `{{day1Label}}` -> set `selectedDate = {{day1Date}}`
   - quick reply text: `{{day2Label}}` -> set `selectedDate = {{day2Date}}`
   - quick reply text: `{{day3Label}}` -> set `selectedDate = {{day3Date}}`
4. `fetch_slots_for_selected_day` (JSON API):
   - URL: `/api/booking/slots?date={{selectedDate}}&duration={{meetingDuration}}`
   - Save first 3-5 `slots[*].label` and `slots[*].startAt` into attributes.
5. `choose_slot` sets `selectedSlotStart` from slot quick replies.
6. `confirm_booking` (JSON API):
   - Sends `leadId`, `phoneNumber`, `staffId`, `startAt={{selectedSlotStart}}`, `duration`, `chatSessionId`, `idempotencyKey`.
7. `booking_success` confirms consultation was booked.
8. `booking_fallback` handles no-slot/409/500 responses.

## QA Checklist

- A reply from WhatsApp keeps status `חדש` before bot booking.
- B reply updates status `לא מתאים`.
- Successful Chatfuel booking sets status `נקבעה שיחה`.
- Chat ends without booking keeps status `חדש`.
- Duplicate confirm call does not create duplicate bookings.

