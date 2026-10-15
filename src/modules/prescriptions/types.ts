// Public contract of M10 (owned by #36). Comment on each ticket that uses it before changing its shape.

export type PrescriptionKind =
  "move_bookings" | "fill_idle" | "mill_full_loads" | "store_mill_later";

export type Decision = "accepted" | "dismissed";

type Base = {
  kind: PrescriptionKind;
  /** Stable hash of the inputs; same inputs → same key. */
  key: string;
  /** e.g. "Oct 20 is 30 t over". */
  title: string;
  /** Every number the card shows; the only input to its note. */
  facts: Record<string, string | number>;
  decision: Decision | null;
};

/** One booking moved off an overloaded day. */
export type Move = {
  bookingId: string;
  ref: string;
  client: string;
  /** `YYYY-MM-DD`: the overloaded day it leaves. */
  from: string;
  /** `YYYY-MM-DD`: the nearest day in its flex window with room. */
  to: string;
  kg: number;
};

export type MoveBookingsPrescription = Base & {
  kind: "move_bookings";
  /** The overloaded dryer day. */
  date: string;
  moves: Move[];
  /** Overflow left after the moves, kg. */
  remainderKg: number;
  /** Bookings already asked to move onto this day, counted in the overflow, kg. */
  incomingKg: number;
};

/** A farmer or co-op texted before an idle stretch. */
export type Recipient = {
  clientId: string;
  name: string;
  phone: string;
  municipality: string | null;
  /** Palay received from them at the gate, kg. */
  pastKg: number;
};

export type FillIdlePrescription = Base & {
  kind: "fill_idle";
  /** First and last idle dryer day still ahead. */
  from: string;
  to: string;
  /** By past volume, then municipality. */
  recipients: Recipient[];
  /** The text each recipient gets: GSM-7, at most 320 characters. */
  message: string;
};

export type MillFullLoadsPrescription = Base & {
  kind: "mill_full_loads";
  /** IRPC palay the mill is planned to take over the window, kg. */
  kg: number;
  /** Days the plan mills it on now (partial loads), and the full-load days. */
  spreadDates: string[];
  fullDates: string[];
  /** Electricity per kg, base load included (M7 `electricityPerKg`), centavos. */
  spreadMinorPerKg: number;
  fullMinorPerKg: number;
};

export type Prescription =
  MoveBookingsPrescription | FillIdlePrescription | MillFullLoadsPrescription;

/** A prescription as the rules compute it, before any decision is read. */
export type Suggestion = Prescription extends infer P
  ? P extends unknown
    ? Omit<P, "decision">
    : never
  : never;
