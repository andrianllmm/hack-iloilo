import { describe, expect, it } from "vitest";
import { newRef } from "./ref";

describe("newRef", () => {
  it("is 6 characters with no look-alikes (0/O, 1/I)", () => {
    for (let i = 0; i < 1000; i++) {
      expect(newRef()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("varies between calls", () => {
    const refs = new Set(Array.from({ length: 1000 }, () => newRef()));
    expect(refs.size).toBeGreaterThan(990);
  });
});
