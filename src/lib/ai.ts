import "server-only";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";
import { env } from "@/lib/env";

const model = google("gemini-3.5-flash");

// TODO(M3): confirm IRPC's sack weight.
const SACK_KG = 50;

/**
 * Turns free-text SMS into data matching a command's schema.
 * Returns null on failure so callers fall back to the help text.
 */
export async function extract<T>(
  schema: z.ZodType<T>,
  text: string,
): Promise<T | null> {
  if (!env().GOOGLE_GENERATIVE_AI_API_KEY) return null;
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema }),
      system: `Extract the farmer's request from this SMS. Convert sacks to kg at ${SACK_KG} kg per sack. Leave out anything not stated.`,
      prompt: text,
    });
    return output;
  } catch (error) {
    console.error("[ai:extract]", error);
    return null;
  }
}
