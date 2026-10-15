// M6. Gate and Batches: Queue, batch record, dispatch. See TRD.md.
// SMS commands owned by this module, registered with M3.

import { z } from "zod";
import { registerCommand } from "@/modules/sms/registry";
import { queueStatusBySms } from "./queries";

registerCommand({
  keywords: ["STATUS"],
  schema: z.object({}),
  // Trailing words are ignored ("STATUS pls").
  parse: () => ({}),
  handle: queueStatusBySms,
});
