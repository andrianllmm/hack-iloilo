# SMSGate private server

Self-hosted [SMS Gateway for Android](https://docs.sms-gate.app) server. Clients text a SIM in an Android phone running the SMSGate app; the phone syncs with this server, which calls the app's webhook.

## Run

```sh
cp config.example.yml config.yml   # set private_token
docker compose up -d
```

## HTTPS

The phone needs HTTPS.

- **Event:** a team laptop behind a Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3000`.
- **Pilot:** a small VPS with a reverse proxy.

## Phone

In the SMSGate app, **Settings → Cloud Server**:

- API URL: `https://<host>/api/mobile/v1`
- Private token: the `private_token` from `config.yml`

## App

Set in the app's env: `SMS_GATEWAY=smsgate`, `SMSGATE_URL=https://<host>`, `SMSGATE_USERNAME`/`SMSGATE_PASSWORD` (shown in the phone app after it registers) and `SMSGATE_SIGNING_KEY` (Settings → Webhooks → Signing Key).

Register the inbound webhook once:

```sh
curl -u "$SMSGATE_USERNAME:$SMSGATE_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<app-host>/api/sms/inbound","event":"sms:received"}' \
  "$SMSGATE_URL/3rdparty/v1/webhooks"
```
