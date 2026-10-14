import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature } from "./smsgate";

const signingKey = "test-key";
const rawBody = '{"event":"sms:received"}';
const now = 1_760_000_000_000;
const timestamp = String(now / 1000);
const sign = (body: string, ts: string) =>
  createHmac("sha256", signingKey)
    .update(body + ts)
    .digest("hex");

describe("verifySignature", () => {
  it("accepts a valid signature", () => {
    const signature = sign(rawBody, timestamp);
    expect(
      verifySignature({ rawBody, timestamp, signature, signingKey, now }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = sign(rawBody, timestamp);
    expect(
      verifySignature({
        rawBody: rawBody + " ",
        timestamp,
        signature,
        signingKey,
        now,
      }),
    ).toBe(false);
  });

  it("rejects timestamps more than 5 minutes off", () => {
    const old = String(now / 1000 - 301);
    const signature = sign(rawBody, old);
    expect(
      verifySignature({ rawBody, timestamp: old, signature, signingKey, now }),
    ).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(
      verifySignature({
        rawBody,
        timestamp: null,
        signature: null,
        signingKey,
        now,
      }),
    ).toBe(false);
  });
});
