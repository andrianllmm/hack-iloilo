// M3. SMS: Sending, receiving and parsing texts; command registry. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { z } from "zod";
import { aiEnabled, extract } from "@/lib/ai";
import { newRef } from "@/lib/ref";
import { smsGateway } from "@/lib/sms";
import { db } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { normalizePhone } from "@/modules/accounts/logic";
import {
  findClientByPhone,
  findOrRegisterByPhone,
} from "@/modules/accounts/queries";
import {
  aiConfirmText,
  fillTemplate,
  helpText,
  isGsm7,
  parseAnswer,
  parseInbound,
  SMS_MAX_CHARS,
  type ParsedInbound,
} from "./logic";
import {
  aiCommands,
  commandUsages,
  findCommand,
  onPromptAnswer,
  promptHandler,
  PromptRefusal,
  type Command,
  type CommandContext,
  type SmsPromptKind,
} from "./registry";

// Command registrations: each module's `sms.ts` calls `registerCommand()`.
import "@/modules/booking/sms";
import "@/modules/buying/sms";
import "@/modules/gate/sms";
import "@/modules/pricing/sms";

export type SmsMessage = Database["public"]["Tables"]["sms_messages"]["Row"];

const ERROR_REPLY =
  "IRPC: Sorry, we could not process your text. Please try again later.";

/** Fills `{name}` and `vars`, logs to `sms_messages` and sends via the gateway. */
export async function send(
  phone: string,
  template: string,
  vars: Record<string, string | number> = {},
): Promise<void> {
  const filled = { ...vars };
  if (template.includes("{name}") && filled.name === undefined)
    filled.name = (await findClientByPhone(phone))?.name ?? "there";
  const body = fillTemplate(template, filled);
  if (body.length > SMS_MAX_CHARS || !isGsm7(body))
    console.warn(`[sms] not GSM-7 or over ${SMS_MAX_CHARS} chars:`, body);

  const { data: row, error } = await db()
    .from("sms_messages")
    .insert({ direction: "outbound", phone, body, status: "queued" })
    .select("id")
    .single();
  if (error) throw error;

  try {
    const { id } = await smsGateway().send(phone, body);
    await update(row.id, { status: "sent", gateway_id: id });
  } catch (error) {
    console.error("[sms] send failed", error);
    await update(row.id, { status: "failed" });
  }
}

/**
 * Opens a yes/no prompt, answered within 24 h by a plain yes or no (the
 * sender's latest prompt) or `YES <ref>` / `NO <ref>`.
 * Returns the ref. Passing a ref (e.g. a booking's) replaces its open prompt.
 */
export async function openPrompt({
  phone,
  kind,
  payload,
  ref,
}: {
  phone: string;
  kind: SmsPromptKind;
  payload: Json;
  ref?: string;
}): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const candidate = (ref ?? newRef()).toUpperCase();
    if (ref) {
      const { error } = await db()
        .from("sms_prompts")
        .update({ status: "expired" })
        .eq("ref", candidate)
        .eq("status", "open");
      if (error) throw error;
    }
    const { error } = await db()
      .from("sms_prompts")
      .insert({ phone, kind, payload: payload ?? {}, ref: candidate });
    if (!error) return candidate;
    // A random ref collided with another open prompt: draw again.
    if (error.code !== "23505" || ref || attempt >= 3) throw error;
  }
}

/** Shared by the simulator and the webhook relay. Dedupes on `gatewayId`. */
export async function handleInbound({
  phone,
  body,
  gatewayId,
}: {
  phone: string;
  body: string;
  gatewayId?: string;
}): Promise<void> {
  const { data, error } = await db()
    .from("sms_messages")
    .insert({
      direction: "inbound",
      phone,
      body,
      gateway_id: gatewayId ?? null,
      status: "received",
    })
    .select("id")
    .single();
  if (error?.code === "23505") return;
  if (error) throw error;
  await processInbound(data.id);
}

/** Routes a logged inbound text once and sends the reply. */
export async function processInbound(id: string): Promise<void> {
  // Claim the row so retries and duplicate relays process it once.
  const { data: message, error } = await db()
    .from("sms_messages")
    .update({ status: "processed" })
    .eq("id", id)
    .eq("direction", "inbound")
    .eq("status", "received")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!message) return;

  const phone = normalizePhone(message.phone);
  const parsed = parseInbound(message.body);
  if (!phone) {
    // Network shortcodes and foreign numbers get no reply.
    console.warn("[sms] ignored text from", message.phone);
    await update(id, { parsed: toJson(parsed) });
    return;
  }

  let reply: string;
  try {
    const client = await findOrRegisterByPhone(phone);
    const routed = await route(parsed, message.body, { phone, client });
    reply = routed.reply;
    await update(id, {
      phone,
      parsed: toJson(parsed),
      via_ai: routed.viaAi ?? false,
    });
  } catch (error) {
    console.error("[sms] inbound failed", error);
    await update(id, { phone, parsed: toJson(parsed), status: "failed" });
    reply = ERROR_REPLY;
  }
  if (reply) await send(phone, reply);
}

async function route(
  parsed: ParsedInbound,
  body: string,
  ctx: CommandContext,
): Promise<{ reply: string; viaAi?: boolean }> {
  const answer = parseAnswer(parsed);
  if (answer) return { reply: await answerPrompt(answer, ctx) };

  const command = findCommand(parsed.keyword);
  if (!command) {
    if (!parsed.keyword || parsed.keyword === "HELP")
      return { reply: help(aiEnabled()) };
    return interpret(body, ctx);
  }
  return { reply: await runKeyword(command, parsed, ctx) };
}

async function runKeyword(
  command: Command<unknown>,
  parsed: ParsedInbound,
  ctx: CommandContext,
): Promise<string> {
  let forPhone: string | undefined;
  if (parsed.forPhone) {
    const normalized = normalizePhone(parsed.forPhone);
    if (!normalized) return help();
    forPhone = normalized;
  }

  let args: unknown;
  try {
    args = command.parse(parsed.args);
  } catch {
    return help();
  }
  const result = command.schema.safeParse(args);
  if (!result.success) return help();
  return command.handle(result.data, { ...ctx, forPhone });
}

/**
 * Reads free text as a command with AI. Commands with a summary ask first and
 * run on a yes; AI failure gets the help reply.
 */
async function interpret(
  body: string,
  ctx: CommandContext,
): Promise<{ reply: string; viaAi?: boolean }> {
  const commands = aiCommands();
  if (!aiEnabled() || !commands.length) return { reply: help() };

  const options = commands.map(({ keyword, command }) =>
    z
      .object({ command: z.literal(keyword), args: command.schema })
      .describe(command.ai!.description),
  );
  const none = z
    .object({ command: z.literal("NONE") })
    .describe("The text matches none of the other commands.");
  const intent = await extract(
    z.object({ intent: z.union([none, ...options]) }),
    body,
  );
  // AI down or timed out: fall back to the keyword formats.
  if (!intent) return { reply: help() };
  if (intent.intent.command === "NONE") return { reply: help(true) };

  const { command: keyword, args } = intent.intent as {
    command: string;
    args: unknown;
  };
  const command = findCommand(keyword);
  const valid = command?.schema.safeParse(args);
  if (!command?.ai || !valid?.success) return { reply: help(true) };

  const { summary } = command.ai;
  if (!summary)
    return { reply: await command.handle(valid.data, ctx), viaAi: true };
  await openPrompt({
    phone: ctx.phone,
    kind: "ai_confirm",
    payload: { keyword, args: valid.data as Json },
  });
  return { reply: aiConfirmText(summary(valid.data)), viaAi: true };
}

onPromptAnswer("ai_confirm", async (prompt, yes, ctx) => {
  if (prompt.phone !== ctx.phone) throw new PromptRefusal(help());
  if (!yes) return "IRPC: Okay, we didn't save anything.";

  const { keyword, args } = prompt.payload as { keyword: string; args: Json };
  const command = findCommand(keyword);
  const valid = command?.schema.safeParse(args);
  if (!command || !valid?.success) return help();
  return command.handle(valid.data, ctx);
});

async function answerPrompt(
  { yes, ref }: { yes: boolean; ref?: string },
  ctx: CommandContext,
): Promise<string> {
  // A ref may just be a word ("yes please"), so fall back to the latest.
  const prompt =
    (ref && (await openPromptByRef(ref))) ||
    (await latestOpenPrompt(ctx.phone));
  const handler = prompt && promptHandler(prompt.kind);
  if (!prompt || !handler)
    return "IRPC: We have no question waiting for your answer.";

  if (new Date(prompt.expires_at) <= new Date()) {
    await setPromptStatus(prompt.id, "open", "expired");
    return "IRPC: Sorry, that question has expired. Please text us again.";
  }

  const claimed = await setPromptStatus(
    prompt.id,
    "open",
    yes ? "accepted" : "declined",
  );
  if (!claimed) return "IRPC: You already answered that one.";
  try {
    return await handler(claimed, yes, ctx);
  } catch (error) {
    // Reopen so the rightful phone can still answer.
    await setPromptStatus(prompt.id, claimed.status, "open");
    if (error instanceof PromptRefusal) return error.reply;
    throw error;
  }
}

async function openPromptByRef(ref: string) {
  const { data, error } = await db()
    .from("sms_prompts")
    .select()
    .eq("ref", ref)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** The phone's newest unexpired open prompt. */
async function latestOpenPrompt(phone: string) {
  const { data, error } = await db()
    .from("sms_prompts")
    .select()
    .eq("phone", phone)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** `natural` only when AI is up to read plain language. */
function help(natural = false): string {
  return helpText(commandUsages(), natural);
}

type PromptStatus = Database["public"]["Enums"]["sms_prompt_status"];

async function setPromptStatus(
  id: string,
  from: PromptStatus,
  to: PromptStatus,
) {
  const { data, error } = await db()
    .from("sms_prompts")
    .update({ status: to })
    .eq("id", id)
    .eq("status", from)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function update(
  id: string,
  values: Database["public"]["Tables"]["sms_messages"]["Update"],
) {
  const { error } = await db().from("sms_messages").update(values).eq("id", id);
  if (error) throw error;
}

const toJson = (parsed: ParsedInbound): Json => ({
  keyword: parsed.keyword,
  args: parsed.args,
  ...(parsed.forPhone && { forPhone: parsed.forPhone }),
});

/** Phones with their latest message, newest first. */
export async function smsThreads(): Promise<SmsMessage[]> {
  const { data, error } = await db()
    .from("sms_messages")
    .select()
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const latest = new Map<string, SmsMessage>();
  for (const message of data)
    if (!latest.has(message.phone)) latest.set(message.phone, message);
  return [...latest.values()];
}

/** One phone's messages, oldest first (last 200). */
export async function smsThread(phone: string): Promise<SmsMessage[]> {
  const { data, error } = await db()
    .from("sms_messages")
    .select()
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.reverse();
}
