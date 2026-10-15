import { describe, expect, it } from "vitest";
import { isGsm7, SMS_MAX_CHARS } from "@/modules/sms/logic";
import { purchasePriceChanged, purchaseText } from "./logic";

const price = {
  paid_kg: 8763,
  price_minor_per_kg: 2100,
  total_minor: 18402300,
};

describe("purchase price texts", () => {
  it("formats saved paid kg, centavos per kg and total", () => {
    const body = purchaseText(price);
    expect(body).toBe(
      "IRPC: Palay purchase recorded. Paid weight: 8,763 kg at PHP 21.00/kg. Total: PHP 184,023.00.",
    );
    expect(isGsm7(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
  });
  it("notifies on first save and skips unchanged amounts", () => {
    expect(purchasePriceChanged(null, price)).toBe(true);
    expect(purchasePriceChanged(price, { ...price })).toBe(false);
  });
  it.each(["paid_kg", "price_minor_per_kg", "total_minor"] as const)(
    "notifies when %s changes",
    (key) => {
      expect(
        purchasePriceChanged(price, { ...price, [key]: price[key] + 1 }),
      ).toBe(true);
    },
  );
});
