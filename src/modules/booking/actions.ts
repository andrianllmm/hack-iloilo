"use server";

// M4. Booking: Future drying and milling slots. See TRD.md.
// Server actions. Check the staff role first with requireRole().

import { revalidatePath } from "next/cache";
import { todayManila } from "@/lib/dates";
import { requireRole } from "@/modules/accounts/auth";
import { bookingSchema, type BookingInput } from "./booking-schema";
import { bookingClient, cancelBooking, createBooking } from "./queries";
import type { Booking } from "./types";

export type BookForClientResult =
  | { status: "created"; booking: Booking }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<keyof BookingInput, string>>;
    };

/** Staff booking for a walk-in or phone call; confirms instantly. */
export async function bookForClient(
  input: unknown,
): Promise<BookForClientResult> {
  await requireRole();
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
      ),
    };
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
