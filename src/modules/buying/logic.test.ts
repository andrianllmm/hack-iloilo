import { describe, expect, it } from "vitest";
import { parseOfferForm } from "./logic";

const valid = {
  clientId: "c3000000-0000-0000-0000-000000000001",
  varietyId: "11111111-1111-1111-1111-111111111111",
  estKg: "3000",
  harvestDate: "2026-11-25",
  bookedByPhone: "+639171234567",
};

describe("parseOfferForm", () => {
  it("accepts valid input and coerces kg to a positive integer", () => {
    const result = parseOfferForm(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.estKg).toBe(3000);
      expect(result.value.clientId).toBe(valid.clientId);
      expect(result.value.varietyId).toBe(valid.varietyId);
      expect(result.value.harvestDate).toBe("2026-11-25");
      expect(result.value.bookedByPhone).toBe("+639171234567");
    }
  });

  it("treats a blank variety as null", () => {
    const result = parseOfferForm({ ...valid, varietyId: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.varietyId).toBeNull();
  });

  it.each(["0", "-100", "abc", "10.5", ""])(
    "rejects a non-positive, non-integer kg: %s",
    (estKg) => {
      expect(parseOfferForm({ ...valid, estKg }).ok).toBe(false);
    },
  );

  it.each(["", "25/11/2026", "2026-13-01", "not-a-date"])(
    "rejects a bad harvest date: %s",
    (harvestDate) => {
      expect(parseOfferForm({ ...valid, harvestDate }).ok).toBe(false);
    },
  );

  it.each(["", "09171234567", "+0171234567", "+63 917 123 4567"])(
    "rejects a phone that is not E.164: %s",
    (bookedByPhone) => {
      expect(parseOfferForm({ ...valid, bookedByPhone }).ok).toBe(false);
    },
  );

  it("rejects a missing client id", () => {
    expect(parseOfferForm({ ...valid, clientId: "" }).ok).toBe(false);
  });
});
