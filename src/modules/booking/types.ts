import type { Database } from "@/lib/supabase/database.types";

export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Service = Database["public"]["Enums"]["service"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type BookingChannel = Database["public"]["Enums"]["booking_channel"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
/** A booking with the client fields the list shows. */
export type BookingRow = Booking & {
  client: Pick<ClientRow, "name" | "phone" | "kind">;
};
export type BookingClient = Pick<ClientRow, "id" | "name" | "phone" | "kind">;
