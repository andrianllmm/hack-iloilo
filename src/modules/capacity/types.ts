// Public contract of M9 (owned by #32). Comment on each ticket that uses it before changing its shape.

export type Pool = "dryer" | "storage" | "mill";
export type Source = "confirmed" | "offer" | "forecast";
/** Kilograms. Confirmed and offer loads have low = mid = high. */
export type Range = { low: number; mid: number; high: number };

export type DayPool = {
  /** `YYYY-MM-DD`, Asia/Manila. */
  date: string;
  pool: Pool;
  load: Record<Source, Range>;
  capacityKg: number;
  /** Firm load (confirmed + offer, mid) is above capacity. */
  overloaded: boolean;
  /** Firm load above capacity; 0 unless overloaded. */
  overflowKg: number;
  /** Sum of highs is below `idle_threshold_pct` of capacity. */
  idle: boolean;
};
