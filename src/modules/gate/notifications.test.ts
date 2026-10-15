import { describe, expect, it } from "vitest";
import { isGsm7, SMS_MAX_CHARS } from "@/modules/sms/logic";
import {
  dispatchText,
  nextInLineTexts,
  weightConfirmationText,
  weightAnswerText,
} from "./logic";

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
  const sale = {
    batchNo: "261015-001",
    ownership: "irpc" as const,
    kg: 1500,
    priceMinorPerKg: 4500,
    orRef: " OR-123 ",
  };
  it("includes saved sale values in bilingual text", () => {
    const body = dispatchText(sale);
    for (const value of [
      "Nabaton / Collected",
      "1,500 kg",
      "261015-001",
      "PHP 45.00/kg",
      "PHP 67,500.00",
      "OR OR-123.",
    ])
      expect(body).toContain(value);
    expect(isGsm7(body)).toBe(true);
    expect(
      dispatchText({ ...sale, orRef: "9".repeat(50) }).length,
    ).toBeLessThanOrEqual(SMS_MAX_CHARS);
  });
  it.each([null, "", "  "])("omits missing OR: %s", (orRef) => {
    expect(dispatchText({ ...sale, orRef })).not.toMatch(/OR|receipt/i);
  });
  it("omits money and OR for owner pickups", () => {
    const body = dispatchText({ ...sale, ownership: "custom" });
    expect(body).toContain("1,500 kg");
    expect(body).not.toMatch(/PHP|OR|Price|Total/);
  });
});

describe("weight confirmation texts", () => {
  const input = {
    batchNo: "261015-001",
    stage: "receiving" as const,
    measurements: { bags: 120, kg: 8763, mc: 23 },
    ref: "ABC123",
  };
  it("contains receiving measurements and explicit answer references", () => {
    const text = weightConfirmationText(input);
    for (const part of [
      "Nabaton / Received",
      "120 bags",
      "8,763 kg",
      "MC 23%",
      "YES ABC123",
      "NO ABC123",
    ])
      expect(text).toContain(part);
  });
  it("includes purchase figures without dropping the weight or prompt", () => {
    const text = weightConfirmationText({
      ...input,
      purchase: {
        paid_kg: 8763,
        price_minor_per_kg: 2100,
        total_minor: 18402300,
      },
    });
    expect(text).toContain("PHP 184,023.00");
    expect(text).toContain("PHP 21.00/kg");
    expect(text).toContain("YES ABC123");
  });
  it("describes dried weight, not receiving bags", () => {
    const text = weightConfirmationText({
      ...input,
      stage: "drying",
      measurements: { kg: 7500, mc: 14 },
    });
    expect(text).toContain("Na-dry / Dried: 7,500 kg, MC 14%");
    expect(text).not.toContain("bags");
  });
  it("keeps large valid values and replies within the SMS limit", () => {
    for (const text of [
      weightConfirmationText({
        ...input,
        measurements: { bags: 2147483647, kg: 2147483647, mc: 99.9 },
        purchase: {
          paid_kg: 2147483647,
          price_minor_per_kg: 2147483647,
          total_minor: 2147483647,
        },
      }),
      weightAnswerText(true),
      weightAnswerText(false),
    ]) {
      expect(isGsm7(text)).toBe(true);
      expect(text.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
    }
  });
});
