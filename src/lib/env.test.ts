import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  vi.stubEnv("SMS_GATEWAY", "simulator");
  for (const key of [
    "SMS_GATEWAY_URL",
    "SMS_GATEWAY_USERNAME",
    "SMS_GATEWAY_PASSWORD",
    "SMS_GATEWAY_DEVICE_ID",
    "SMS_GATEWAY_SIM_NUMBER",
    "SMS_GATEWAY_WEBHOOK_SIGNING_KEY",
    "SMS_GATEWAY_WEBHOOK_PORT",
    "SMS_RELAY_SECRET",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEYS",
    "GOOGLE_GENERATIVE_AI_RPM_LIMIT",
    "GOOGLE_GENERATIVE_AI_RPD_LIMIT",
    "GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD",
    "OPENROUTER_API_KEY",
    "OPENROUTER_MODEL",
  ])
    vi.stubEnv(key, "");
});
afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("defaults the OpenRouter model and leaves it disabled without a key", async () => {
    const { env } = await import("./env");
    expect(env().OPENROUTER_API_KEY).toBeUndefined();
    expect(env().OPENROUTER_MODEL).toBe("openai/gpt-5.4-nano");
  });

  it("accepts an OpenRouter key and model override", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", " router-key ");
    vi.stubEnv("OPENROUTER_MODEL", "openai/custom-model");
    const { env } = await import("./env");
    expect(env().OPENROUTER_API_KEY).toBe("router-key");
    expect(env().OPENROUTER_MODEL).toBe("openai/custom-model");
  });

  it("defaults to no AI keys and configurable local quota budgets", async () => {
    const { env } = await import("./env");
    expect(env()).toMatchObject({
      GOOGLE_GENERATIVE_AI_API_KEYS: [],
      GOOGLE_GENERATIVE_AI_RPM_LIMIT: 10,
      GOOGLE_GENERATIVE_AI_RPD_LIMIT: 250,
      GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD: 0.9,
    });
  });

  it("uses a trimmed legacy key when the list is empty", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", " legacy ");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEYS", " , ");
    const { env } = await import("./env");
    expect(env().GOOGLE_GENERATIVE_AI_API_KEYS).toEqual(["legacy"]);
  });

  it("prefers the comma-separated list and deduplicates keys", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "legacy");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEYS", " first , second, ,first ");
    const { env } = await import("./env");
    expect(env().GOOGLE_GENERATIVE_AI_API_KEYS).toEqual(["first", "second"]);
  });

  it.each([
    ["GOOGLE_GENERATIVE_AI_RPM_LIMIT", "0"],
    ["GOOGLE_GENERATIVE_AI_RPD_LIMIT", "1.5"],
    ["GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD", "0"],
    ["GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD", "1.1"],
  ])("rejects invalid AI quota setting %s=%s", async (key, value) => {
    vi.stubEnv(key, value);
    const { env } = await import("./env");
    expect(() => env()).toThrow();
  });
  it("accepts empty optional SMS values in simulator mode", async () => {
    const { env } = await import("./env");
    expect(env().SMS_GATEWAY_WEBHOOK_PORT).toBe(3000);
    expect(env().SMS_GATEWAY_SIM_NUMBER).toBeUndefined();
  });

  it("defaults to the SMSGate cloud API", async () => {
    const { env } = await import("./env");
    expect(env().SMS_GATEWAY_URL).toBe("https://api.sms-gate.app/3rdparty/v1");
  });

  it("reads the renamed credentials and maps them for existing SMS consumers", async () => {
    vi.stubEnv("SMS_GATEWAY", "smsgate");
    vi.stubEnv("SMS_GATEWAY_URL", "https://gateway.example.com");
    vi.stubEnv("SMS_GATEWAY_USERNAME", "test-user");
    vi.stubEnv("SMS_GATEWAY_PASSWORD", "test-password");
    vi.stubEnv("SMS_GATEWAY_WEBHOOK_SIGNING_KEY", "test-signing-key");
    vi.stubEnv("SMS_RELAY_SECRET", "test-relay-secret-123");
    vi.stubEnv("SMS_GATEWAY_DEVICE_ID", "test-device");
    vi.stubEnv("SMS_GATEWAY_SIM_NUMBER", "2");
    vi.stubEnv("SMS_GATEWAY_WEBHOOK_PORT", "4000");
    const { env } = await import("./env");
    expect(env()).toMatchObject({
      SMS_GATEWAY_URL: "https://gateway.example.com",
      SMSGATE_USERNAME: "test-user",
      SMSGATE_PASSWORD: "test-password",
      SMSGATE_SIGNING_KEY: "test-signing-key",
      SMS_RELAY_SECRET: "test-relay-secret-123",
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

  it("requires the relay secret in smsgate mode", async () => {
    vi.stubEnv("SMS_GATEWAY", "smsgate");
    vi.stubEnv("SMS_GATEWAY_USERNAME", "test-user");
    vi.stubEnv("SMS_GATEWAY_PASSWORD", "test-password");
    const { env } = await import("./env");
    expect(() => env()).toThrow(/SMS_RELAY_SECRET/);
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
