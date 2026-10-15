import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { processInbound } from "@/modules/sms/queries";

// Room for an AI-assisted reply (P1) on top of the gateway call.
export const maxDuration = 60;

const bodySchema = z.object({ id: z.uuid() });

/**
 * Processes an inbound text logged by the webhook relay (services/sms-webhook).
 * Authenticated with the shared `SMS_RELAY_SECRET` in `x-relay-secret`.
 */
export async function POST(request: Request) {
  const { SMS_RELAY_SECRET } = env();
  if (
    !SMS_RELAY_SECRET ||
    !secretsMatch(request.headers.get("x-relay-secret"), SMS_RELAY_SECRET)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });

  await processInbound(parsed.data.id);
  return new Response("OK", { status: 200 });
}

// Hash first so lengths always match for timingSafeEqual.
function secretsMatch(given: string | null, expected: string): boolean {
  if (!given) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(given), hash(expected));
}
