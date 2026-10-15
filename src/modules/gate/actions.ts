"use server";

// M6. Gate and Batches: Queue, batch record, dispatch. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/modules/accounts/auth";
import { ClientInputError } from "@/modules/accounts/queries";
import { checkInSchema, type CheckInInput } from "./checkin-schema";
import {
  checkIn,
  finish,
  GateError,
  markLeft,
  refPreview,
  start,
  type CheckInParams,
} from "./queries";
import type { RefPreview } from "./types";

type Failure = {
  status: "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof CheckInInput, string>>;
};
export type CheckInResult = { status: "ok"; entryId: string } | Failure;
export type StartResult =
  { status: "ok"; batch: { id: string; batch_no: string } } | Failure;
export type MoveResult = { status: "ok" } | Failure;
export type LookupRefResult =
  { status: "ok"; preview: RefPreview } | { status: "error"; message: string };

const invalidEntry: Failure = {
  status: "error",
  message: "Invalid queue entry. Refresh the queue.",
};

export async function checkInClient(input: unknown): Promise<CheckInResult> {
  await requireRole();
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
      ),
    };
  const { mode, ref, phone, service, ownership, estKg, name, kind } =
    parsed.data;
  const params: CheckInParams =
    mode === "booking"
      ? { bookingRef: ref }
      : mode === "offer"
        ? { offerRef: ref }
        : mode === "walkIn"
          ? {
              walkIn: {
                name,
                phone,
                kind,
                municipality_id: parsed.data.municipality_id,
              },
              service,
              ownership,
              estKg,
            }
          : { phone, service, ownership, estKg };
  try {
    const entry = await checkIn(params);
    revalidatePath("/queue");
    if (mode === "booking") revalidatePath("/bookings");
    if (mode === "offer") revalidatePath("/buying");
    return { status: "ok", entryId: entry.id };
  } catch (error) {
    if (error instanceof GateError)
      return { status: "error", fieldErrors: { ref: error.message } };
    if (error instanceof ClientInputError)
      return {
        status: "error",
        fieldErrors: {
          [error.field in parsed.data ? error.field : "phone"]: error.message,
        },
      };
    console.error("Unable to check in client", error);
    return {
      status: "error",
      message: "Unable to check in the client. Please try again.",
    };
  }
}

/** What a booking or offer ref would check in, for the card's summary. */
export async function lookupRef(ref: string): Promise<LookupRefResult> {
  await requireRole();
  if (typeof ref !== "string")
    return { status: "error", message: "Enter the ref." };
  try {
    return { status: "ok", preview: await refPreview(ref) };
  } catch (error) {
    if (error instanceof GateError)
      return { status: "error", message: error.message };
    console.error("Unable to look up ref", error);
    return {
      status: "error",
      message: "Unable to look up the ref. Please try again.",
    };
  }
}

async function run<T>(
  id: string,
  label: string,
  action: (id: string) => Promise<T>,
): Promise<T | Failure> {
  await requireRole();
  if (!z.guid().safeParse(id).success) return invalidEntry;
  try {
    const result = await action(id);
    revalidatePath("/queue");
    return result;
  } catch (error) {
    if (error instanceof GateError)
      return { status: "error", message: error.message };
    console.error(`Unable to ${label}`, error);
    return {
      status: "error",
      message: `Unable to ${label}. Please try again.`,
    };
  }
}

/** Starts service for the entry and opens its batch. */
export async function startEntry(id: string): Promise<StartResult> {
  return run(id, "start service", async (entryId) => {
    const batch = await start(entryId);
    revalidatePath("/batches");
    return {
      status: "ok" as const,
      batch: { id: batch.id, batch_no: batch.batch_no },
    };
  });
}

export async function finishEntry(id: string): Promise<MoveResult> {
  return run(id, "finish service", async (entryId) => {
    await finish(entryId);
    return { status: "ok" as const };
  });
}

export async function leaveEntry(id: string): Promise<MoveResult> {
  return run(id, "remove the client", async (entryId) => {
    await markLeft(entryId);
    return { status: "ok" as const };
  });
}
