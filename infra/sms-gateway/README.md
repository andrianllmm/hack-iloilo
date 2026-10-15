# SMS gateway

Clients text a SIM in an Android phone running the [SMS Gateway for Android](https://docs.sms-gate.app) (SMSGate) app. By default the phone uses the **SMSGate cloud server**, so nothing here needs to run. See [0002](../../docs/decisions/0002-sms-gateway-cloud-and-relay.md).

## Cloud (default)

1. Install the SMSGate app on the gateway phone, turn on **Cloud Server**, and note the username and password on **Home**.
2. Set the app's env: `SMS_GATEWAY=smsgate`, `SMS_GATEWAY_USERNAME`, `SMS_GATEWAY_PASSWORD` and `SMS_RELAY_SECRET`. `SMS_GATEWAY_URL` defaults to `https://api.sms-gate.app/3rdparty/v1`.
3. Deploy the webhook relay and register it: [`services/sms-webhook`](../../services/sms-webhook/README.md).

## Private server (optional)

Use this only if texts must not pass through the SMSGate cloud. It runs `ghcr.io/android-sms-gateway/server` with MariaDB.

```sh
cp config.example.yml config.yml   # set private_token
docker compose up -d
```

- **HTTPS:** the phone needs it. Use a Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) or a small VPS with a reverse proxy.
- **Phone:** **Settings → Cloud Server** with API URL `https://<host>/api/mobile/v1` and the private token.
- **App:** `SMS_GATEWAY_URL=https://<host>/api/3rdparty/v1`. Register the relay's webhook against that base instead of the cloud one.
