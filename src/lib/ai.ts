import "server-only";
import { createGoogle } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";
import { todayManila } from "@/lib/dates";
import { env } from "@/lib/env";
import {
  createKeyPool,
  reserveKey,
  coolDownKey,
  quotaCooldown,
} from "./ai-keys";

function createPool() {
  const config = env();
  return {
    models: config.GOOGLE_GENERATIVE_AI_API_KEYS.map((apiKey) =>
      createGoogle({ apiKey })("gemini-3.5-flash"),
    ),
    state: createKeyPool(
      config.GOOGLE_GENERATIVE_AI_API_KEYS.length,
      Date.now(),
    ),
    limits: {
      perMinute: config.GOOGLE_GENERATIVE_AI_RPM_LIMIT,
      perDay: config.GOOGLE_GENERATIVE_AI_RPD_LIMIT,
      threshold: config.GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD,
    },
  };
}

// Per server instance only: counters reset on cold starts and are not shared
// between instances. Keys from the same Google project still share its quota.
let pool: ReturnType<typeof createPool> | undefined;

// Past this, the sender gets the rule-based help reply instead.
const TIMEOUT_MS = 8000;

/** True when a Gemini key is set. Without it, SMS is keyword-only. */
export function aiEnabled(): boolean {
  return env().GOOGLE_GENERATIVE_AI_API_KEYS.length > 0;
}

/**
 * Turns free-text SMS into data matching a command's schema.
 * Returns null on failure so callers fall back to the help text.
 */
export async function extract<T>(
  schema: z.ZodType<T>,
  text: string,
): Promise<T | null> {
  if (!aiEnabled()) return null;
  pool ??= createPool();
  const deadline = Date.now() + TIMEOUT_MS;
  const attempted: number[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const now = Date.now();
    if (now >= deadline) return null;
    const previous = pool.state.current;
    const selection = reserveKey(pool.state, pool.limits, now, attempted);
    pool.state = selection.pool;
    const index = selection.index;
    if (index === null) return null;
    attempted.push(index);
    if (index !== previous) console.info("[ai:key]", index);
    try {
      const { output } = await generateText({
        model: pool.models[index],
        timeout: deadline - now,
        // Reserve/count each API attempt ourselves, including quota failover.
        maxRetries: 0,
        output: Output.object({ schema }),
        system: `Extract the farmer's request from this SMS, which may be in Hiligaynon, Tagalog, English or a mix. Today is ${todayManila()}. Copy amounts exactly as stated, in the farmer's unit; never convert units or calculate. Leave out anything not stated.`,
        prompt: text,
      });
      return output;
    } catch (error) {
      const until = quotaCooldown(error, Date.now());
      if (until !== null) {
        pool.state = coolDownKey(pool.state, index, until);
      } else {
        // Provider errors may contain credentials or the farmer's SMS.
        console.error("[ai:extract]", "request failed");
        return null;
      }
    }
  }
  return null;
}
