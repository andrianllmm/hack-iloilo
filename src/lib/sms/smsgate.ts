import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SmsGateway } from "./gateway";

const MAX_SKEW_SECONDS = 5 * 60;

/**
 * SMSGate 3rdparty API (https://docs.sms-gate.app): the cloud server
 * (`https://api.sms-gate.app/3rdparty/v1`) or a private one.
 */
export class SmsGateGateway implements SmsGateway {
  constructor(
    private readonly options: {
      /** API base, e.g. `https://api.sms-gate.app/3rdparty/v1`. */
      url: string;
      username: string;
      password: string;
      deviceId?: string;
      simNumber?: number;
    },
  ) {}

  async send(to: string, body: string) {
    const { url, username, password, deviceId, simNumber } = this.options;
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const res = await fetch(`${url.replace(/\/+$/, "")}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        textMessage: { text: body },
        phoneNumbers: [to],
        ...(deviceId && { deviceId }),
        ...(simNumber && { simNumber }),
      }),
    });
    if (!res.ok) {
      throw new Error(`SMSGate send failed: ${res.status} ${await res.text()}`);
    }
    const { id } = (await res.json()) as { id: string };
    return { id };
  }
}

/**
 * Verifies an SMSGate webhook: hex HMAC-SHA256 of raw body + X-Timestamp,
 * with the timestamp (Unix seconds) within 5 minutes of now.
 */
export function verifySignature({
  rawBody,
  timestamp,
  signature,
  signingKey,
  now = Date.now(),
}: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  signingKey: string;
  now?: number;
}): boolean {
  if (!timestamp || !signature) return false;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  if (Math.abs(now / 1000 - seconds) > MAX_SKEW_SECONDS) return false;

  const expected = createHmac("sha256", signingKey)
    .update(rawBody + timestamp)
    .digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const smsReceivedSchema = z.object({
  event: z.literal("sms:received"),
  payload: z.object({
    messageId: z.string(),
    message: z.string(),
    sender: z.string(),
    receivedAt: z.string().optional(),
  }),
});

export type SmsReceived = z.infer<typeof smsReceivedSchema>;
