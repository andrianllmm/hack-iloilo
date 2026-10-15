import "server-only";
import { z } from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SMS_GATEWAY: z.enum(["simulator", "smsgate"]).default("simulator"),
    // 3rdparty API base. Private server: https://<host>/api/3rdparty/v1
    SMS_GATEWAY_URL: z.url().default("https://api.sms-gate.app/3rdparty/v1"),
    SMS_GATEWAY_USERNAME: z.string().min(1).optional(),
    SMS_GATEWAY_PASSWORD: z.string().min(1).optional(),
    SMS_GATEWAY_DEVICE_ID: z.string().min(1).optional(),
    SMS_GATEWAY_SIM_NUMBER: z.coerce.number().int().positive().optional(),
    // Gateway phone's number, shown to clients on the landing page.
    SMS_GATEWAY_PHONE_NUMBER: z.string().min(1).optional(),
    // Used by the webhook relay (services/sms-webhook), not this app.
    SMS_GATEWAY_WEBHOOK_SIGNING_KEY: z.string().min(1).optional(),
    // Shared with the webhook relay; authenticates POST /api/sms/process.
    SMS_RELAY_SECRET: z.string().min(16).optional(),
    SMS_GATEWAY_WEBHOOK_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(3000),
    // Optional: AI features fall back to templates without it.
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEYS: z.string().optional(),
    GOOGLE_GENERATIVE_AI_RPM_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    GOOGLE_GENERATIVE_AI_RPD_LIMIT: z.coerce
      .number()
      .int()
      .positive()
      .default(250),
    GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD: z.coerce
      .number()
      .gt(0)
      .max(1)
      .default(0.9),
  })
  .refine(
    (env) =>
      env.SMS_GATEWAY !== "smsgate" ||
      (env.SMS_GATEWAY_USERNAME &&
        env.SMS_GATEWAY_PASSWORD &&
        env.SMS_RELAY_SECRET),
    {
      message:
        "SMS_GATEWAY_USERNAME, SMS_GATEWAY_PASSWORD and SMS_RELAY_SECRET are required when SMS_GATEWAY=smsgate",
    },
  )
  // Keep existing gateway consumers working with the renamed environment inputs.
  .transform((env) => {
    const keys =
      env.GOOGLE_GENERATIVE_AI_API_KEYS?.split(",")
        .map((key) => key.trim())
        .filter(Boolean) ?? [];
    const legacy = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    return {
      ...env,
      GOOGLE_GENERATIVE_AI_API_KEYS: [
        ...new Set(keys.length ? keys : legacy ? [legacy] : []),
      ],
      SMSGATE_USERNAME: env.SMS_GATEWAY_USERNAME,
      SMSGATE_PASSWORD: env.SMS_GATEWAY_PASSWORD,
      SMSGATE_SIGNING_KEY: env.SMS_GATEWAY_WEBHOOK_SIGNING_KEY,
    };
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Parsed on first use so builds don't need secrets. */
export function env(): Env {
  // Treat empty values (as in .env.example) as unset.
  const vars = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ""),
  );
  cached ??= schema.parse(vars);
  return cached;
}
