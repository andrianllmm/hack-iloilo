import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type QueueEntry = Tables["queue_entries"]["Row"];
export type Batch = Tables["batches"]["Row"];
export type QueueStatus = Enums["queue_status"];
export type BatchOwnership = Enums["batch_ownership"];
export type Service = Enums["service"];
export type BookingStatus = Enums["booking_status"];
export type OfferStatus = Enums["sell_offer_status"];
export type RefKind = "booking" | "offer";
/** A live queue entry with what the gate columns show. */
export type QueueRow = QueueEntry & {
  client: Pick<Tables["clients"]["Row"], "name" | "phone" | "kind">;
  batch: Pick<Batch, "id" | "batch_no"> | null;
  booking: { ref: string } | null;
  offer: { ref: string } | null;
};
/** What the check-in card shows for a booking or offer ref before checking in. */
export type RefPreview = {
  kind: RefKind;
  ref: string;
  client: { name: string; kind: string; phone: string };
  service: Service;
  ownership: BatchOwnership;
  estKg: number;
  /** Scheduled date for a booking, harvest date for an offer. */
  date: string;
};
export type BatchSummary = Batch & {
  client: Pick<Tables["clients"]["Row"], "name" | "phone" | "kind">;
  entry: Pick<QueueEntry, "service" | "started_at" | "est_kg"> | null;
};
