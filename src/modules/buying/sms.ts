// M5. Buying: Quotes, sell offers, purchases. See TRD.md.
// SMS commands owned by this module, registered with M3.

import { z } from "zod";
import { registerCommand } from "@/modules/sms/registry";
import {
  parseQuoteArgs,
  parseSellArgs,
  quoteSmsSchema,
  sellSmsSchema,
} from "./logic";
import { priceBySms, quoteBySms, sellBySms, varietiesBySms } from "./queries";

registerCommand({
  keywords: ["PRICE"],
  schema: z.object({}),
  // Trailing words are ignored ("PRICE today").
  parse: () => ({}),
  handle: priceBySms,
});

registerCommand({
  keywords: ["QUOTE"],
  schema: quoteSmsSchema,
  parse: parseQuoteArgs,
  handle: quoteBySms,
});

registerCommand({
  keywords: ["SELL"],
  schema: sellSmsSchema,
  parse: parseSellArgs,
  handle: sellBySms,
});

registerCommand({
  keywords: ["VARIETIES", "VARIETY"],
  schema: z.object({}),
  // Trailing words are ignored ("VARIETIES please").
  parse: () => ({}),
  handle: varietiesBySms,
});
