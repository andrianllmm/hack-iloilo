// The demo SMS threads (supabase/seeds/91_sms.sql) copy reply templates by hand;
// fail when a template changes and the seeded text no longer matches it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { bookingSms } from "@/modules/booking/logic";
import { buyingSms } from "@/modules/buying/logic";

const seed = readFileSync(
  join(process.cwd(), "supabase/seeds/91_sms.sql"),
  "utf8",
);

/** Seeded outbound bodies, with each SQL expression (dates) as `§`. */
const outbound = [
  ...seed.matchAll(/'outbound',\s+(.+?),\s+interval '[^']*'\)/g),
].map(([, expr]) =>
  expr
    .split("||")
    .map((part) => part.trim())
    .map((part) =>
      /^'.*'$/.test(part) ? part.slice(1, -1).replaceAll("''", "'") : "§",
    )
    .join(""),
);

/** A template as a regex: any placeholder matches any filled value. */
const pattern = (template: string) =>
  new RegExp(
    `^${template
      .replace(/[.*+?^$()[\]\\|]/g, "\\$&")
      .replace(/\{\w+\}/g, ".+")}$`,
  );
const templates = [...Object.values(bookingSms), ...Object.values(buyingSms)];

it("finds the seeded outbound texts", () => {
  expect(outbound.length).toBeGreaterThan(5);
});

it.each(outbound)("seeded text matches a reply template: %s", (body) => {
  expect(templates.some((t) => pattern(t).test(body))).toBe(true);
});
