# 0002: SMSGate cloud with a separate webhook relay

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

M3 needs real SMS for clients on basic phones. The TRD planned a self-hosted SMSGate server (Docker + MariaDB) behind a Cloudflare Tunnel, with the SMSGate webhook calling the Next.js app directly.

- A self-hosted server needs an always-on Docker host with HTTPS, which the team doesn't have for the event.
- SMSGate needs a 2xx within 30 s, and retries otherwise. Routing a text (and, in P1, asking Gemini) runs in the app, which may be slow, redeploying or cold.
- Every inbound text should be logged, even when the app is down.

## Decision

- **Provider:** use the SMSGate cloud server (`https://api.sms-gate.app/3rdparty/v1`). `SMS_GATEWAY_URL` stays configurable, so the private server in `infra/sms-gateway/` still works.
- **Webhook:** a thin relay in `services/sms-webhook/`, deployed as its own Vercel project. It:
  1. verifies the HMAC signature,
  2. logs the text to `sms_messages` as `received` (the unique `gateway_id` dedupes retries),
  3. replies 200 right away,
  4. forwards the row id to the app's `POST /api/sms/process`, authenticated with a shared `SMS_RELAY_SECRET`.
- The app claims the row (`received` → `processed`) before routing, so a text is handled once. The simulator uses the same `handleInbound` path.

## Consequences

- Texts pass through SMSGate's cloud. That is acceptable for the pilot; the private server is the fallback.
- Two Vercel projects to deploy, with a shared secret and the same Supabase keys.
- If forwarding fails, the text stays `received` in the log. Nothing retries it yet.
