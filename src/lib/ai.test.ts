import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const sdk = vi.hoisted(() => ({
  generateText: vi.fn(),
  createGoogle: vi.fn(({ apiKey }: { apiKey: string }) =>
    vi.fn(() => ({ testKey: apiKey })),
  ),
}));
vi.mock("server-only", () => ({}));
vi.mock("@ai-sdk/google", () => ({ createGoogle: sdk.createGoogle }));
vi.mock("ai", () => ({
  generateText: sdk.generateText,
  Output: { object: (value: unknown) => value },
}));

const schema = z.object({ command: z.literal("PRICE") });
const output = { command: "PRICE" };
const exhausted = {
  statusCode: 429,
  responseBody: JSON.stringify({
    error: { status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "30s" }] },
  }),
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.generateText.mockReset().mockResolvedValue({ output });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:10Z"));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service");
  vi.stubEnv("SMS_GATEWAY", "simulator");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  vi.stubEnv(
    "GOOGLE_GENERATIVE_AI_API_KEYS",
    "test-key-a,test-key-b,test-key-c",
  );
  vi.stubEnv("GOOGLE_GENERATIVE_AI_RPM_LIMIT", "10");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_RPD_LIMIT", "250");
  vi.stubEnv("GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD", "0.9");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("AI extraction key failover", () => {
  it("supports the legacy single key", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEYS", "");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-legacy");
    const { extract, aiEnabled } = await import("./ai");
    expect(aiEnabled()).toBe(true);
    expect(await extract(schema, "Presyo sang palay?")).toEqual(output);
    expect(sdk.createGoogle).toHaveBeenCalledExactlyOnceWith({
      apiKey: "test-legacy",
    });
  });

  it("disables AI without configured keys and makes no API call", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEYS", " , ");
    const { extract, aiEnabled } = await import("./ai");
    expect(aiEnabled()).toBe(false);
    expect(await extract(schema, "banana")).toBeNull();
    expect(sdk.generateText).not.toHaveBeenCalled();
  });

  it("retries a quota failure on the next key with the same request", async () => {
    sdk.generateText.mockRejectedValueOnce(exhausted);
    const { extract } = await import("./ai");
    expect(await extract(schema, "Presyo sang palay?")).toEqual(output);
    expect(sdk.generateText).toHaveBeenCalledTimes(2);
    expect(
      sdk.generateText.mock.calls.map(([args]) => args.model.testKey),
    ).toEqual(["test-key-a", "test-key-b"]);
    expect(sdk.generateText.mock.calls.map(([args]) => args.prompt)).toEqual([
      "Presyo sang palay?",
      "Presyo sang palay?",
    ]);
    expect(console.info).toHaveBeenCalledExactlyOnceWith("[ai:key]", 1);
    expect(sdk.generateText).toHaveBeenLastCalledWith(
      expect.objectContaining({ maxRetries: 0 }),
    );
  });

  it("skips the minute threshold proactively", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_RPM_LIMIT", "2");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_QUOTA_THRESHOLD", "0.5");
    const { extract } = await import("./ai");
    await extract(schema, "price");
    await extract(schema, "price");
    expect(
      sdk.generateText.mock.calls.map(([args]) => args.model.testKey),
    ).toEqual(["test-key-a", "test-key-b"]);
  });

  it("returns null without another call when all keys are exhausted, keeping AI enabled", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEYS", "test-key-a,test-key-b");
    sdk.generateText.mockRejectedValue(exhausted);
    const { extract, aiEnabled } = await import("./ai");
    expect(await extract(schema, "price")).toBeNull();
    expect(await extract(schema, "price")).toBeNull();
    expect(sdk.generateText).toHaveBeenCalledTimes(2);
    expect(aiEnabled()).toBe(true);
  });

  it("retries at most once even when a third key is available", async () => {
    sdk.generateText.mockRejectedValue(exhausted);
    const { extract } = await import("./ai");
    expect(await extract(schema, "price")).toBeNull();
    expect(sdk.generateText).toHaveBeenCalledTimes(2);
  });

  it("uses a previously cooling key after expiry", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEYS", "test-key-a,test-key-b");
    sdk.generateText.mockRejectedValue(exhausted);
    const { extract } = await import("./ai");
    await extract(schema, "price");
    vi.setSystemTime(Date.now() + 30_000);
    sdk.generateText.mockResolvedValue({ output });
    expect(await extract(schema, "price")).toEqual(output);
    expect(sdk.generateText).toHaveBeenCalledTimes(3);
  });

  it("shares the existing eight-second budget across attempts", async () => {
    sdk.generateText.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 3000);
      throw exhausted;
    });
    const { extract } = await import("./ai");
    expect(await extract(schema, "price")).toEqual(output);
    expect(sdk.generateText.mock.calls.map(([args]) => args.timeout)).toEqual([
      8000, 5000,
    ]);
  });

  it("does not retry after the request budget has elapsed", async () => {
    sdk.generateText.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 8000);
      throw exhausted;
    });
    const { extract } = await import("./ai");
    expect(await extract(schema, "price")).toBeNull();
    expect(sdk.generateText).toHaveBeenCalledTimes(1);
  });

  it("reserves usage before overlapping requests finish", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_RPM_LIMIT", "1");
    let finish!: (value: { output: typeof output }) => void;
    sdk.generateText.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { extract } = await import("./ai");
    const first = extract(schema, "price");
    expect(await extract(schema, "price")).toEqual(output);
    expect(
      sdk.generateText.mock.calls.map(([args]) => args.model.testKey),
    ).toEqual(["test-key-a", "test-key-b"]);
    finish({ output });
    await first;
  });

  it("never logs credentials or raw provider errors", async () => {
    sdk.generateText.mockRejectedValueOnce({
      ...exhausted,
      message: "test-key-a",
      requestBodyValues: { key: "test-key-b" },
    });
    sdk.generateText.mockRejectedValueOnce(new Error("test-key-b test-key-c"));
    const { extract } = await import("./ai");
    expect(await extract(schema, "private farmer text")).toBeNull();
    const logs = JSON.stringify([
      vi.mocked(console.info).mock.calls,
      vi.mocked(console.error).mock.calls,
    ]);
    for (const secret of [
      "test-key-a",
      "test-key-b",
      "test-key-c",
      "private farmer text",
    ])
      expect(logs).not.toContain(secret);
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "[ai:extract]",
      "request failed",
    );
  });
});
