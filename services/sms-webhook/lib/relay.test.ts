import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { relay, type RelayDeps } from "./relay";

const signingKey = "test-key";
const now = 1_760_000_000_000;
const timestamp = String(now / 1000);
const received = {
  deviceId: "dev",
  event: "sms:received",
  id: "evt",
  payload: {
    messageId: "msg-1",
    message: "BOOK dry 500",
    sender: "+639171234567",
    recipient: null,
    simNumber: 1,
    receivedAt: "2026-10-15T10:00:00.000+08:00",
  },
  webhookId: "wh",
};

function request(body: unknown, signature?: string) {
  const raw = JSON.stringify(body);
  const sig =
    signature ??
    createHmac("sha256", signingKey)
      .update(raw + timestamp)
      .digest("hex");
  return new Request("https://relay.test/api/inbound", {
    method: "POST",
    headers: { "x-timestamp": timestamp, "x-signature": sig },
    body: raw,
  });
}

function deps(insert: RelayDeps["insert"]) {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    deps: {
      signingKey,
      now,
      insert: vi.fn(insert),
      forward: vi.fn(async () => {}),
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
    },
  };
}

describe("relay", () => {
  it("logs and forwards a verified text", async () => {
    const { deps: d, pending } = deps(async () => ({ id: "row-1" }));
    const res = await relay(request(received), d);
    expect(res.status).toBe(200);
    expect(d.insert).toHaveBeenCalledWith({
      phone: "+639171234567",
      body: "BOOK dry 500",
      gatewayId: "msg-1",
    });
    await Promise.all(pending);
    expect(d.forward).toHaveBeenCalledWith("row-1");
  });

  it("rejects a bad signature without logging", async () => {
    const { deps: d } = deps(async () => ({ id: "row-1" }));
    const res = await relay(request(received, "00"), d);
    expect(res.status).toBe(401);
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("does not forward duplicates", async () => {
    const { deps: d } = deps(async () => "duplicate");
    const res = await relay(request(received), d);
    expect(await res.text()).toBe("Duplicate");
    expect(d.forward).not.toHaveBeenCalled();
  });

  it("ignores other events", async () => {
    const { deps: d } = deps(async () => ({ id: "row-1" }));
    const res = await relay(
      request({ ...received, event: "sms:delivered" }),
      d,
    );
    expect(await res.text()).toBe("Ignored");
    expect(d.insert).not.toHaveBeenCalled();
  });

  it("still replies 200 when forwarding fails", async () => {
    const { deps: d, pending } = deps(async () => ({ id: "row-1" }));
    d.forward.mockRejectedValueOnce(new Error("app down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await relay(request(received), d);
    expect(res.status).toBe(200);
    await expect(Promise.all(pending)).resolves.toBeDefined();
  });
});
