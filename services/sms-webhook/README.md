# SMS webhook relay

A tiny Vercel project that receives SMSGate `sms:received` webhooks for the IRPC app.

```
Phone -> SMSGate cloud -> POST /api/inbound (this project)
  verify X-Signature, log to sms_messages (status `received`, dedupe on gateway_id)
  200 OK, then POST {APP_URL}/api/sms/process {id} with x-relay-secret
IRPC app -> routes the text and replies through SMSGate
```

SMSGate gets its 2xx right away. If the app is down, the text is still logged as `received`.

## Environment

| Name                              | Value                                                     |
| --------------------------------- | --------------------------------------------------------- |
| `SUPABASE_URL`                    | Same project as the app (`NEXT_PUBLIC_SUPABASE_URL`)      |
| `SUPABASE_SERVICE_ROLE_KEY`       | Same as the app                                           |
| `SMS_GATEWAY_WEBHOOK_SIGNING_KEY` | Android app → Settings → Webhooks → Signing Key           |
| `APP_URL`                         | The IRPC app, e.g. `https://irpc.vercel.app`              |
| `SMS_RELAY_SECRET`                | Same value as the app's `SMS_RELAY_SECRET` (min 16 chars) |

## Deploy

Create a second Vercel project from this repo with **Root Directory** `services/sms-webhook` (framework: Other), set the env above, and deploy. Or from the CLI:

```sh
vercel --cwd services/sms-webhook          # preview
vercel --cwd services/sms-webhook --prod   # production
```

Check it with `curl https://<relay>/api/inbound` (`sms-webhook ok`).

## Register the webhook (SMSGate cloud)

Credentials are in the Android app under **Home → Cloud Server**.

```sh
curl -u "$SMS_GATEWAY_USERNAME:$SMS_GATEWAY_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<relay>/api/inbound","event":"sms:received"}' \
  https://api.sms-gate.app/3rdparty/v1/webhooks
```

List with `GET …/3rdparty/v1/webhooks`; delete with `DELETE …/3rdparty/v1/webhooks/<id>`.

## Test

`pnpm test` from the repo root runs `lib/*.test.ts`.
