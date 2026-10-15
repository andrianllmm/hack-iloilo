"use server";

// M4. Booking: Future drying and milling slots. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { normalizePhone } from "@/modules/accounts/logic";
import { findOrRegisterByPhone } from "@/modules/accounts/queries";
import {
  bookingSchema,
  webBookingSchema,
  type BookingInput,
  type WebBookingInput,
} from "./booking-schema";
import {
  bookingClient,
  cancelBooking,
  createBooking,
  notifyBookingConfirmation,
} from "./queries";
import type { Booking } from "./types";

export type BookForClientResult =
  | { status: "created"; booking: Booking }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof BookingInput, string>>;
    };

function fieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path[0], issue.message]),
  );
}

/** Staff booking for a walk-in or phone call; confirms instantly. */
export async function bookForClient(
  input: unknown,
): Promise<BookForClientResult> {
  await requireRole();
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { clientId, ...booking } = parsed.data;
  if (booking.preferredDate < todayManila())
    return {
      status: "error",
      fieldErrors: { preferredDate: "Choose today or a later date." },
    };
  try {
    const client = await bookingClient(clientId);
    if (!client)
      return {
        status: "error",
        fieldErrors: { clientId: "This client no longer exists." },
      };
    const created = await createBooking({
      ...booking,
      clientId,
      channel: "staff",
      bookedByPhone: client.phone,
    });
    await notifyBookingConfirmation(created, client.phone);
    revalidatePath("/bookings");
    return { status: "created", booking: created };
  } catch (error) {
    console.error("Unable to create booking", error);
    return {
      status: "error",
      message: "Unable to save the booking. Please try again.",
    };
  }
}

export type BookOnlineResult =
  | {
      status: "created";
      booking: Pick<Booking, "ref" | "service" | "est_kg" | "scheduled_date">;
    }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof WebBookingInput, string>>;
    };

/**
 * Client self-service booking from the public /book page. The only action
 * without requireRole(): like an SMS `BOOK`, it can only create a confirmed
 * booking for the entered phone, which is texted the ref.
 */
export async function bookOnline(input: unknown): Promise<BookOnlineResult> {
  const parsed = webBookingSchema.safeParse(input);
  if (!parsed.success)
    return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { phone, ...booking } = parsed.data;
  if (booking.preferredDate < todayManila())
    return {
      status: "error",
      fieldErrors: { preferredDate: "Choose today or a later date." },
    };
  const normalized = normalizePhone(phone)!;
  try {
    const client = await findOrRegisterByPhone(normalized);
    const created = await createBooking({
      ...booking,
      clientId: client.id,
      channel: "sms",
      bookedByPhone: normalized,
    });
    await notifyBookingConfirmation(created, normalized);
    revalidatePath("/bookings");
    const { ref, service, est_kg, scheduled_date } = created;
    return {
      status: "created",
      booking: { ref, service, est_kg, scheduled_date },
    };
  } catch (error) {
    console.error("Unable to create web booking", error);
    return {
      status: "error",
      message: "Unable to save the booking. Please try again.",
    };
  }
}

export type CancelBookingResult =
  { status: "cancelled" } | { status: "error"; message: string };

export async function cancelBookingByStaff(
  ref: string,
): Promise<CancelBookingResult> {
  await requireRole();
  try {
    const result = await cancelBooking(ref);
    if (result.status === "cancelled") {
      revalidatePath("/bookings");
      return { status: "cancelled" };
    }
    return {
      status: "error",
      message:
        result.status === "not_found"
          ? "This booking no longer exists. Refresh the list."
          : "Only confirmed bookings can be cancelled. Refresh the list.",
    };
  } catch (error) {
    console.error("Unable to cancel booking", error);
    return {
      status: "error",
      message: "Unable to cancel the booking. Please try again.",
    };
  }
}
