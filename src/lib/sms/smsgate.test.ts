import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { SmsGateGateway, verifySignature } from "./smsgate";

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

describe("SmsGateGateway", () => {
  it("posts to the API base with device and SIM", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ id: "msg-1" }, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    const gateway = new SmsGateGateway({
      url: "https://api.sms-gate.app/3rdparty/v1/",
      username: "u",
      password: "p",
      deviceId: "dev",
      simNumber: 2,
    });

    await expect(gateway.send("+639171234567", "Hi")).resolves.toEqual({
      id: "msg-1",
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.sms-gate.app/3rdparty/v1/messages");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("u:p").toString("base64")}`,
    );
    expect(JSON.parse(init.body)).toEqual({
      textMessage: { text: "Hi" },
      phoneNumbers: ["+639171234567"],
      deviceId: "dev",
      simNumber: 2,
    });
    vi.unstubAllGlobals();
  });
});
