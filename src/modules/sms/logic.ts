// M3. SMS: Sending, receiving and parsing texts; command registry. See TRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import { addDays } from "@/lib/dates";

/** Max SMS length (two GSM-7 segments). */
export const SMS_MAX_CHARS = 320;

export type ParsedInbound = {
  /** First word, uppercased; "" for an empty text. */
  keyword: string;
  /** Tokens after the keyword, with a trailing `FOR <phone>` removed. */
  args: string[];
  /** Raw phone from a trailing `FOR <phone>`; normalize before use. */
  forPhone?: string;
};

/** Splits a text into keyword, args and an optional trailing `FOR <phone>`. */
export function parseInbound(body: string): ParsedInbound {
  const tokens = body.trim().split(/\s+/).filter(Boolean);
  const [first = "", ...rest] = tokens;
  let forPhone: string | undefined;
  if (rest.length >= 2 && rest.at(-2)!.toUpperCase() === "FOR") {
    forPhone = rest.at(-1);
    rest.splice(-2);
  }
  return { keyword: first.toUpperCase(), args: rest, forPhone };
}

/** `YES <ref>` / `NO <ref>`; null for anything else. */
export function parseAnswer({
  keyword,
  args,
}: ParsedInbound): { yes: boolean; ref: string } | null {
  if (keyword !== "YES" && keyword !== "NO") return null;
  if (args.length !== 1) return null;
  return { yes: keyword === "YES", ref: args[0].toUpperCase() };
}

/**
 * `dd/mm` (or `d/m`) as the next occurrence on or after `today`, as `YYYY-MM-DD`.
 * Null when the day can never exist (e.g. `31/02`).
 */
export function parseDayMonth(token: string, today: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(token.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const year = Number(today.slice(0, 4));
  // 29/02 may be up to 8 years away (e.g. across 2100).
  for (let y = year; y <= year + 8; y++) {
    const date = `${y}-${pad(month)}-${pad(day)}`;
    if (!isRealDate(date)) continue;
    if (date >= today) return date;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

// A date is real when it survives a round trip (2026-02-31 does not).
const isRealDate = (date: string) => addDays(date, 0) === date;

/** Fills `{key}` placeholders; unknown keys are left as-is. */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/** Reply to unknown texts: the registered commands. */
export function helpText(keywords: string[]): string {
  const list = [...new Set(keywords.map((k) => k.toUpperCase()))].sort();
  const text = list.length
    ? `IRPC: Unknown command. Text one of: ${list.join(", ")}. Reply YES <ref> or NO <ref> to answer a question.`
    : "IRPC: Unknown command. Reply YES <ref> or NO <ref> to answer a question.";
  return text.slice(0, SMS_MAX_CHARS);
}

// GSM 03.38 basic set plus extension table (which costs 2 chars each).
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€\f";

/** True when the text uses only GSM-7 characters. */
export function isGsm7(text: string): boolean {
  return [...text].every((c) => GSM7.includes(c) || GSM7_EXT.includes(c));
}
