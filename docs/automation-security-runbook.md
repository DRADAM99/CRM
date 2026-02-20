# Automation Security Runbook

## Immediate Actions
- Rotate `WHATSAPP_META_TOKEN` and `CHATFUEL_BROADCAST_TOKEN` if they were shared outside secure channels.
- Keep secrets only in local/server environment variables (`.env.local` is gitignored).
- Use long random values for `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

## Production Credentials Strategy
- Prefer server credentials scoped to automation endpoints only.
- Restrict who can view/deploy environment variables.
- Rotate tokens on schedule and after any incident.

## Rollback Switches
- `WHATSAPP_CAMPAIGNS_ENABLED=false`
- `WHATSAPP_WEBHOOK_ENABLED=false`
- `CHATFUEL_HANDOFF_ENABLED=false`
- `BOOKING_CONFIRM_ENABLED=false`

## Readiness Endpoint
- Check current env readiness and switches:
  - `GET /api/automation/readiness`
- Expected go-live response:
  - `ready: true`
  - no missing required keys
  - all switches enabled

