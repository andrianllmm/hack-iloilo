import { Cog, Sun } from "lucide-react";
import type { Service } from "../types";

export const serviceIcons = { drying: Sun, milling: Cog } satisfies Record<
  Service,
  unknown
>;
