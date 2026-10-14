import "server-only";
import { z } from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SMS_GATEWAY: z.enum(["simulator", "smsgate"]).default("simulator"),
    SMSGATE_URL: z.url().optional(),
    SMSGATE_USERNAME: z.string().optional(),
    SMSGATE_PASSWORD: z.string().optional(),
    SMSGATE_SIGNING_KEY: z.string().optional(),
    // Optional: AI features fall back to templates without it.
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  })
  .refine(
    (env) =>
      env.SMS_GATEWAY !== "smsgate" ||
      (env.SMSGATE_URL &&
        env.SMSGATE_USERNAME &&
        env.SMSGATE_PASSWORD &&
        env.SMSGATE_SIGNING_KEY),
    { message: "SMSGATE_* variables are required when SMS_GATEWAY=smsgate" },
  );

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
