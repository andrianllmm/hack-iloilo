import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MAX_SKEW_SECONDS = 5 * 60;

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
