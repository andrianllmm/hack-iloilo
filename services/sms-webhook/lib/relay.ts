import { smsReceivedSchema, verifySignature } from "./verify.js";

export type InboundRow = { phone: string; body: string; gatewayId: string };

export type RelayDeps = {
  signingKey: string;
  /** Logs the text; returns its id, or `"duplicate"` if the gateway id exists. */
  insert: (row: InboundRow) => Promise<{ id: string } | "duplicate">;
  /** Asks the app to process the logged text. */
  forward: (id: string) => Promise<void>;
  /** Keeps work running after the response is sent. */
  waitUntil: (promise: Promise<unknown>) => void;
  now?: number;
};

/**
 * SMSGate `sms:received` webhook: verify, log once, reply 2xx fast, then
 * forward to the app. SMSGate needs a 2xx within 30 s.
 */
export async function relay(request: Request, deps: RelayDeps) {
  const rawBody = await request.text();
  if (
    !verifySignature({
      rawBody,
      timestamp: request.headers.get("x-timestamp"),
      signature: request.headers.get("x-signature"),
      signingKey: deps.signingKey,
      now: deps.now,
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

  const { sender, message, messageId } = parsed.data.payload;
  const result = await deps.insert({
    phone: sender,
    body: message,
    gatewayId: messageId,
  });
  if (result === "duplicate") return new Response("Duplicate", { status: 200 });

  deps.waitUntil(
    deps.forward(result.id).catch((error) => {
      // The row stays `received` in sms_messages.
      console.error("[sms-webhook] forward failed", result.id, error);
    }),
  );
  return new Response("OK", { status: 200 });
}
