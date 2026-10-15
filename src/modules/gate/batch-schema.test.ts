import { describe, expect, it } from "vitest";
import { finishDryingSchema, receivingSchema } from "./batch-schema";

const valid = {
  bags: 120,
  net_kg: 8763,
  variety_id: "a1b2c3d4-0000-0000-0000-000000000000",
  mc: 23,
  damaged_pct: 4,
  immature_pct: 5,
  foreign_pct: 2,
};

describe("receivingSchema", () => {
  it("parses a full Receiving Report", () => {
    const parsed = receivingSchema.parse(valid);
    expect(parsed.net_kg).toBe(8763);
    expect(parsed.bags).toBe(120);
    expect(parsed.variety_id).toBe(valid.variety_id);
  });

  it("accepts a blank variety (the action maps it to none)", () => {
    const parsed = receivingSchema.parse({ ...valid, variety_id: "  " });
    expect(parsed.variety_id).toBe("");
  });

  it("rejects a zero net weight", () => {
    expect(receivingSchema.safeParse({ ...valid, net_kg: 0 }).success).toBe(
      false,
    );
  });

  it("rejects a fractional sack count", () => {
    expect(receivingSchema.safeParse({ ...valid, bags: 1.5 }).success).toBe(
      false,
    );
  });

  it("rejects a moisture content above 100", () => {
    expect(receivingSchema.safeParse({ ...valid, mc: 101 }).success).toBe(
      false,
    );
  });

  it("rejects a deduction share above 100", () => {
    expect(
      receivingSchema.safeParse({ ...valid, damaged_pct: 150 }).success,
    ).toBe(false);
  });
});

it("requires a drying completion decision and preserves each choice", () => {
  const values = {
    dry_end: "2026-10-15T12:00:00+08:00",
    mc_out: 14,
    dried_kg: 890,
  };
  expect(finishDryingSchema.safeParse(values).success).toBe(false);
  for (const ready_for_pickup of [true, false])
    expect(
      finishDryingSchema.parse({ ...values, ready_for_pickup })
        .ready_for_pickup,
    ).toBe(ready_for_pickup);
});
