import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type QueueEntry = Tables["queue_entries"]["Row"];
export type Batch = Tables["batches"]["Row"];
export type QueueStatus = Enums["queue_status"];
export type BatchOwnership = Enums["batch_ownership"];
export type Service = Enums["service"];
/** A live queue entry with what the gate columns show. */
export type QueueRow = QueueEntry & {
  client: Pick<Tables["clients"]["Row"], "name" | "phone" | "kind">;
  batch: Pick<Batch, "id" | "batch_no"> | null;
};
export type BatchSummary = Batch & {
  client: Pick<Tables["clients"]["Row"], "name" | "phone" | "kind">;
  entry: Pick<QueueEntry, "service" | "started_at" | "est_kg"> | null;
};
