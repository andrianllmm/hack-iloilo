import { describe, expect, it } from "vitest";
import { isGsm7, SMS_MAX_CHARS } from "@/modules/sms/logic";
import { dispatchText, nextInLineTexts } from "./logic";

const waiting = (id: string, changes = {}) => ({
  id,
  facility_id: "f1",
  service: "drying" as const,
  status: "waiting" as const,
  checked_in_at: "2026-10-15T08:00:00+08:00",
  client: { phone: `+63917${id}` },
  ...changes,
});

describe("next-in-line texts", () => {
  it("selects the next N waiting entries in this facility and service using the queue order", () => {
    const rows = [
      waiting("3", { checked_in_at: "2026-10-15T08:01:00+08:00" }),
      waiting("2"),
      waiting("1"),
      waiting("4", { service: "milling" }),
      waiting("5", { facility_id: "f2" }),
      waiting("6", { status: "serving" }),
      waiting("7", { status: "left" }),
      waiting("8", { status: "done" }),
    ];
    expect(nextInLineTexts(rows, "f1", "drying", 2)).toEqual([
      {
        phone: "+639171",
        body: "IRPC: Your turn for drying is near. You are 1 in the waiting line. Please be ready.",
      },
      {
        phone: "+639172",
        body: "IRPC: Your turn for drying is near. You are 2 in the waiting line. Please be ready.",
      },
    ]);
    expect(rows[0].id).toBe("3");
  });
  it("handles zero, empty and shorter lines", () => {
    expect(nextInLineTexts([waiting("1")], "f1", "drying", 0)).toEqual([]);
    expect(nextInLineTexts([], "f1", "drying", 3)).toEqual([]);
    const texts = nextInLineTexts(
      [waiting("1", { service: "milling" })],
      "f1",
      "milling",
      3,
    );
    expect(texts).toHaveLength(1);
    expect(texts[0].body).toContain("milling");
    expect(isGsm7(texts[0].body)).toBe(true);
    expect(texts[0].body.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
  });
});

describe("dispatch texts", () => {
  it("includes the batch and saved receipt reference", () => {
    const body = dispatchText("261015-001", " OR-123 ");
    expect(body).toBe(
      "IRPC: Dispatch recorded. Batch 261015-001. Receipt: OR-123.",
    );
    expect(isGsm7(body)).toBe(true);
    expect(
      dispatchText("261015-001", "9".repeat(50)).length,
    ).toBeLessThanOrEqual(SMS_MAX_CHARS);
  });
  it.each([null, "", "  "])("labels a missing receipt: %s", (receipt) => {
    expect(dispatchText("261015-001", receipt)).toBe(
      "IRPC: Dispatch recorded. Batch 261015-001. No receipt recorded.",
    );
  });
});
