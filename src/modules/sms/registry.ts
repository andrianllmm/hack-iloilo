// M3. SMS: command and prompt-answer registry. Modules register from their `sms.ts`.

import type { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import type { Client } from "@/modules/accounts/types";

export type CommandContext = {
  /** Sender, E.164. */
  phone: string;
  /** Sender's client record (self-registered if new). */
  client: Client;
  /** Normalized phone from a trailing `FOR <phone>`. */
  forPhone?: string;
};

export type Command<T> = {
  /** Matched on the first word, case-insensitive, e.g. `["BOOK"]`. */
  keywords: string[];
  /** Validates the parsed args; a failure gets the help reply. */
  schema: z.ZodType<T>;
  /** Raw tokens after the keyword, `FOR <phone>` already stripped. */
  parse: (args: string[]) => unknown;
  /** Returns the reply text. */
  handle: (cmd: T, ctx: CommandContext) => Promise<string>;
};

export type SmsPrompt = Database["public"]["Tables"]["sms_prompts"]["Row"];
export type SmsPromptKind = SmsPrompt["kind"];
export type PromptHandler = (
  prompt: SmsPrompt,
  yes: boolean,
  ctx: CommandContext,
) => Promise<string>;

/**
 * Thrown by a prompt handler to refuse an answer (e.g. from a phone that
 * doesn't own the booking). The prompt stays open and `reply` is sent.
 */
export class PromptRefusal extends Error {
  constructor(public readonly reply: string) {
    super(reply);
  }
}

// Handled by M3 itself.
const RESERVED = new Set(["YES", "NO", "HELP"]);

const commands = new Map<string, Command<unknown>>();
const promptHandlers = new Map<SmsPromptKind, PromptHandler>();

export function registerCommand<T>(command: Command<T>): void {
  for (const keyword of command.keywords) {
    const key = keyword.toUpperCase();
    if (RESERVED.has(key)) throw new Error(`SMS keyword ${key} is reserved`);
    commands.set(key, command as unknown as Command<unknown>);
  }
}

export function findCommand(keyword: string): Command<unknown> | undefined {
  return commands.get(keyword.toUpperCase());
}

export function commandKeywords(): string[] {
  return [...commands.keys()];
}

export function onPromptAnswer(kind: SmsPromptKind, fn: PromptHandler): void {
  promptHandlers.set(kind, fn);
}

export function promptHandler(kind: SmsPromptKind): PromptHandler | undefined {
  return promptHandlers.get(kind);
}
