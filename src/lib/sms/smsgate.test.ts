import { describe, expect, it, vi } from "vitest";
import { SmsGateGateway } from "./smsgate";

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
