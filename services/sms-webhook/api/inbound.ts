import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { relay } from "../lib/relay";

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SMS_GATEWAY_WEBHOOK_SIGNING_KEY: z.string().min(1),
  /** The IRPC app, e.g. `https://irpc.vercel.app`. */
  APP_URL: z.url(),
  SMS_RELAY_SECRET: z.string().min(16),
});

let supabase: SupabaseClient | undefined;

/** SMSGate `sms:received` webhook. */
export async function POST(request: Request) {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("[sms-webhook] bad env", z.prettifyError(parsed.error));
    return new Response("Misconfigured", { status: 500 });
  }
  const env = parsed.data;
  supabase ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = supabase;

  return relay(request, {
    signingKey: env.SMS_GATEWAY_WEBHOOK_SIGNING_KEY,
    waitUntil,
    async insert({ phone, body, gatewayId }) {
      const { data, error } = await db
        .from("sms_messages")
        .insert({
          direction: "inbound",
          phone,
          body,
          gateway_id: gatewayId,
          status: "received",
        })
        .select("id")
        .single();
      if (error?.code === "23505") return "duplicate";
      if (error) throw error;
      return { id: data.id as string };
    },
    async forward(id) {
      const res = await fetch(
        new URL("/api/sms/process", env.APP_URL).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-relay-secret": env.SMS_RELAY_SECRET,
          },
          body: JSON.stringify({ id }),
        },
      );
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    },
  });
}

/** Health check for the deployment. */
export function GET() {
  return new Response("sms-webhook ok");
}
