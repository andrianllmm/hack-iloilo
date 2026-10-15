// M6. Gate and Batches: Queue, batch record, dispatch. See TRD.md.
// Server-side reads. May call other modules' queries.

import "server-only";
import { todayManila } from "@/lib/dates";
import { db } from "@/lib/supabase/admin";
import {
  findOrRegisterByPhone,
  registerClientRecord,
} from "@/modules/accounts/queries";
import type { ClientKind } from "@/modules/accounts/types";
import { currentFacility } from "@/modules/setup/queries";
import { batchOwnership, batchPrefix, nextBatchNo } from "./logic";
import type {
  Batch,
  BatchOwnership,
  BatchSummary,
  QueueEntry,
  QueueRow,
  Service,
} from "./types";
export { municipalities } from "@/modules/accounts/queries";
export type { Batch, QueueEntry, QueueRow } from "./types";

const BATCH_NO_ATTEMPTS = 5;

/** The entry is no longer in the state the action expects (another staff member moved it). */
export class GateError extends Error {
  constructor(
    public reason: "not_found" | "not_waiting" | "not_serving",
    message: string,
  ) {
    super(message);
  }
}

export type CheckInParams = (
  | { phone: string }
  | {
      walkIn: {
        name: string;
        phone: string;
        kind: ClientKind;
        municipality_id: string | null;
      };
    }
) & {
  service: Service;
  ownership: BatchOwnership;
  estKg?: number | null;
};

/**
 * Adds a client to the back of a service line. Unknown phones are registered;
 * existing clients keep their details. #28 adds booking and offer refs.
 */
export async function checkIn(input: CheckInParams): Promise<QueueEntry> {
  const client =
    "walkIn" in input
      ? (
          await registerClientRecord(input.walkIn.phone, {
            name: input.walkIn.name,
            kind: input.walkIn.kind,
            municipality_id: input.walkIn.municipality_id,
          })
        ).client
      : await findOrRegisterByPhone(input.phone);
  const facility = await currentFacility();
  const { data, error } = await db()
    .from("queue_entries")
    .insert({
      facility_id: facility.id,
      service: input.service,
      client_id: client.id,
      ownership: input.ownership,
      est_kg: input.estKg ?? null,
      status: "waiting",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function issuedToday(today: string): Promise<string[]> {
  const { data, error } = await db()
    .from("batches")
    .select("batch_no")
    .like("batch_no", `${batchPrefix(today)}%`);
  if (error) throw error;
  return data.map((row) => row.batch_no);
}

/** Marks the entry serving and opens its batch at stage `received`. */
export async function start(entryId: string): Promise<Batch> {
  const { data: entry, error } = await db()
    .from("queue_entries")
    .update({ status: "serving", started_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("status", "waiting")
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!entry)
    throw new GateError(
      "not_waiting",
      "This client is no longer waiting. Refresh the queue.",
    );
  try {
    const today = todayManila();
    for (let attempt = 1; ; attempt++) {
      const { data: batch, error: batchError } = await db()
        .from("batches")
        .insert({
          facility_id: entry.facility_id,
          batch_no: nextBatchNo(today, await issuedToday(today)),
          queue_entry_id: entry.id,
          client_id: entry.client_id,
          ownership: batchOwnership(entry),
          stage: "received",
        })
        .select()
        .single();
      // Another start took the same number; count again.
      if (batchError?.code === "23505" && attempt < BATCH_NO_ATTEMPTS) continue;
      if (batchError) throw batchError;
      return batch;
    }
  } catch (cause) {
    // Put the client back in line so the start can be retried.
    await db()
      .from("queue_entries")
      .update({ status: "waiting", started_at: null })
      .eq("id", entry.id)
      .eq("status", "serving");
    throw cause;
  }
}

async function move(
  entryId: string,
  from: "waiting" | "serving",
  update: Partial<QueueEntry>,
): Promise<QueueEntry> {
  const { data, error } = await db()
    .from("queue_entries")
    .update(update)
    .eq("id", entryId)
    .eq("status", from)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new GateError(
      from === "waiting" ? "not_waiting" : "not_serving",
      `This client is no longer ${from}. Refresh the queue.`,
    );
  return data;
}

export function finish(entryId: string): Promise<QueueEntry> {
  return move(entryId, "serving", {
    status: "done",
    finished_at: new Date().toISOString(),
  });
}

export function markLeft(entryId: string): Promise<QueueEntry> {
  return move(entryId, "waiting", {
    status: "left",
    finished_at: new Date().toISOString(),
  });
}

/** Everyone waiting or being served, with their client and open batch. */
export async function liveQueue(): Promise<QueueRow[]> {
  const facility = await currentFacility();
  const { data, error } = await db()
    .from("queue_entries")
    .select("*, client:clients(name, phone, kind), batch:batches(id, batch_no)")
    .eq("facility_id", facility.id)
    .in("status", ["waiting", "serving"])
    .order("checked_in_at");
  if (error) throw error;
  return data;
}

export async function batchSummary(id: string): Promise<BatchSummary | null> {
  const { data, error } = await db()
    .from("batches")
    .select(
      "*, client:clients(name, phone, kind), entry:queue_entries(service, started_at, est_kg)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
