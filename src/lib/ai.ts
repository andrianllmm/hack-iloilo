import "server-only";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";
import { todayManila } from "@/lib/dates";
import { env } from "@/lib/env";

const model = google("gemini-3.5-flash");

// Past this, the sender gets the rule-based help reply instead.
const TIMEOUT_MS = 8000;

/** True when a Gemini key is set. Without it, SMS is keyword-only. */
export function aiEnabled(): boolean {
  return Boolean(env().GOOGLE_GENERATIVE_AI_API_KEY);
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
  try {
    const { output } = await generateText({
      model,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
      output: Output.object({ schema }),
      system: `Extract the farmer's request from this SMS, which may be in Hiligaynon, Tagalog, English or a mix. Today is ${todayManila()}. Copy amounts exactly as stated, in the farmer's unit; never convert units or calculate. Leave out anything not stated.`,
      prompt: text,
    });
    return output;
  } catch (error) {
    console.error("[ai:extract]", error);
    return null;
  }
}
