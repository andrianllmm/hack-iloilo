import "server-only";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";
import { env } from "@/lib/env";

const model = google("gemini-3.5-flash");

// TODO(M3): confirm IRPC's sack weight.
const SACK_KG = 50;

/**
 * Words a prescription's computed numbers as one or two plain sentences.
 * Returns null on failure (or without an API key) so callers use a template.
 */
export async function explain(
  facts: Record<string, unknown>,
): Promise<string | null> {
  if (!env().GOOGLE_GENERATIVE_AI_API_KEY) return null;
  try {
    const { text } = await generateText({
      model,
      system:
        "You explain rice-facility capacity suggestions to a plant manager in one or two plain English sentences. Use only the numbers given. Never invent, round differently, or compute new figures.",
      prompt: JSON.stringify(facts),
    });
    return text.trim() || null;
  } catch (error) {
    console.error("[ai:explain]", error);
    return null;
  }
}

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
