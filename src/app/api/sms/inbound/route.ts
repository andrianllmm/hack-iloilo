import { env } from "@/lib/env";
import { smsReceivedSchema, verifySignature } from "@/lib/sms/smsgate";

/** SMSGate `sms:received` webhook. Must reply 2xx within 30 s. */
export async function POST(request: Request) {
  const { SMSGATE_SIGNING_KEY } = env();
  const rawBody = await request.text();

  if (
    !SMSGATE_SIGNING_KEY ||
    !verifySignature({
      rawBody,
      timestamp: request.headers.get("x-timestamp"),
      signature: request.headers.get("x-signature"),
      signingKey: SMSGATE_SIGNING_KEY,
    })
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = smsReceivedSchema.safeParse(json);
  if (!parsed.success) return new Response("Ignored", { status: 200 });

  // TODO(M3): dedupe on payload.messageId, then route to the command handler.
  return new Response("OK", { status: 200 });
}
