// M11. Rice Buying: rice requests from buyers. See PRD.md.
// Pure functions only: no I/O and no imports from other modules. Unit-test here.

import type { Database } from "@/lib/supabase/database.types";
import type { StatusTone } from "@/lib/status";

export type OrderStatus = Database["public"]["Enums"]["rice_order_status"];

export const orderStatusLabels: Record<OrderStatus, string> = {
  requested: "Requested",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Cancelled",
  picked_up: "Picked up",
};
export const orderStatusTones: Record<OrderStatus, StatusTone> = {
  requested: "warning",
  accepted: "info",
  declined: "danger",
  cancelled: "neutral",
  picked_up: "success",
};

/** Buyers and staff can cancel until the rice is picked up or the request is closed. */
export function canCancel(status: OrderStatus): boolean {
  return status === "requested" || status === "accepted";
}

/** Today's rice price × kg, in centavos. An estimate: the dispatch sets the final price. */
export function estimateMinor(kg: number, riceMinorPerKg: number): number {
  return kg * riceMinorPerKg;
}

export const orderSms = {
  recorded:
    "IRPC: Nalista na ang request mo. Code {ref}: {kg} bugas, kuha sa {date}. I-text ka namon kon may desisyon na.",
  accepted:
    "IRPC: Accepted ang request {ref}: {kg} bugas, kuha sa {date} sa IRPC, Amamaros, Pototan. Bayad sa planta.",
  declined:
    "IRPC: Pasensya, indi ma-serve ang request {ref} ({kg} bugas, {date}). I-text ang PRICE para sa presyo subong.",
  cancelled: "IRPC: Kanselado na ang request {ref}.",
} as const;
