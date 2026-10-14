import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  vi.stubEnv("SMS_GATEWAY", "simulator");
  for (const key of [
    "SMSGATE_URL",
    "SMS_GATEWAY_USERNAME",
    "SMS_GATEWAY_PASSWORD",
    "SMS_GATEWAY_DEVICE_ID",
    "SMS_GATEWAY_SIM_NUMBER",
    "SMS_GATEWAY_WEBHOOK_SIGNING_KEY",
    "SMS_GATEWAY_WEBHOOK_PORT",
  ])
    vi.stubEnv(key, "");
});
afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("accepts empty optional SMS values in simulator mode", async () => {
    const { env } = await import("./env");
    expect(env().SMS_GATEWAY_WEBHOOK_PORT).toBe(3000);
    expect(env().SMS_GATEWAY_SIM_NUMBER).toBeUndefined();
  });

  it("reads the renamed credentials and maps them for existing SMS consumers", async () => {
    vi.stubEnv("SMS_GATEWAY", "smsgate");
    vi.stubEnv("SMSGATE_URL", "https://gateway.example.com");
    vi.stubEnv("SMS_GATEWAY_USERNAME", "test-user");
    vi.stubEnv("SMS_GATEWAY_PASSWORD", "test-password");
    vi.stubEnv("SMS_GATEWAY_WEBHOOK_SIGNING_KEY", "test-signing-key");
    vi.stubEnv("SMS_GATEWAY_DEVICE_ID", "test-device");
    vi.stubEnv("SMS_GATEWAY_SIM_NUMBER", "2");
    vi.stubEnv("SMS_GATEWAY_WEBHOOK_PORT", "4000");
    const { env } = await import("./env");
    expect(env()).toMatchObject({
      SMSGATE_USERNAME: "test-user",
      SMSGATE_PASSWORD: "test-password",
      SMSGATE_SIGNING_KEY: "test-signing-key",
      SMS_GATEWAY_DEVICE_ID: "test-device",
      SMS_GATEWAY_SIM_NUMBER: 2,
      SMS_GATEWAY_WEBHOOK_PORT: 4000,
    });
  });

  it("rejects missing credentials in smsgate mode", async () => {
    vi.stubEnv("SMS_GATEWAY", "smsgate");
    const { env } = await import("./env");
    expect(() => env()).toThrow(/SMS_GATEWAY_USERNAME/);
  });

  it.each([
    ["SMS_GATEWAY_SIM_NUMBER", "0"],
    ["SMS_GATEWAY_SIM_NUMBER", "2.5"],
    ["SMS_GATEWAY_SIM_NUMBER", "banana"],
    ["SMS_GATEWAY_WEBHOOK_PORT", "65536"],
  ])("rejects invalid %s=%s", async (key, value) => {
    vi.stubEnv(key, value);
    const { env } = await import("./env");
    expect(() => env()).toThrow();
  });
});
