import { describe, expect, it } from "vitest";
import {
  createKeyPool,
  reserveKey,
  coolDownKey,
  quotaCooldown,
} from "./ai-keys";

const now = Date.parse("2026-10-15T12:00:10Z");
const limits = { perMinute: 10, perDay: 100, threshold: 0.9 };

describe("Gemini key selection", () => {
  it("reserves requests before I/O and switches at the minute threshold", () => {
    let pool = createKeyPool(2, now);
    for (let i = 0; i < 9; i++) {
      const selection = reserveKey(pool, limits, now);
      expect(selection.index).toBe(0);
      pool = selection.pool;
    }
    const original = structuredClone(pool);
    const next = reserveKey(pool, limits, now);
    expect(next.index).toBe(1);
    expect(next.pool.usage[1].minuteRequests).toBe(1);
    expect(pool).toEqual(original);
  });

  it("skips the daily threshold even after a minute reset", () => {
    const pool = createKeyPool(2, now);
    pool.usage[0].dayRequests = 90;
    expect(reserveKey(pool, limits, now + 60_000).index).toBe(1);
  });

  it("uses configurable limits and threshold", () => {
    let pool = createKeyPool(2, now);
    pool = reserveKey(
      pool,
      { ...limits, perMinute: 4, threshold: 0.5 },
      now,
    ).pool;
    pool = reserveKey(
      pool,
      { ...limits, perMinute: 4, threshold: 0.5 },
      now,
    ).pool;
    expect(
      reserveKey(pool, { ...limits, perMinute: 4, threshold: 0.5 }, now).index,
    ).toBe(1);
  });

  it("returns no key when every key has reached its threshold", () => {
    const pool = createKeyPool(2, now);
    for (const key of pool.usage) key.minuteRequests = 9;
    expect(reserveKey(pool, limits, now).index).toBeNull();
    expect(reserveKey(pool, limits, now + 60_000).index).toBe(0);
  });

  it("resets daily counts at Manila midnight, not UTC midnight", () => {
    const midnight = Date.parse("2026-10-15T16:00:00Z");
    const pool = createKeyPool(1, midnight - 1);
    pool.usage[0].dayRequests = 90;
    const next = reserveKey(pool, limits, midnight);
    expect(next.index).toBe(0);
    expect(next.pool.usage[0].dayRequests).toBe(1);
    expect(
      reserveKey(pool, limits, Date.parse("2026-10-15T15:59:59Z")).index,
    ).toBeNull();
  });

  it("keeps cooldowns across window resets and reuses a key at expiry", () => {
    const until = now + 90_000;
    const pool = coolDownKey(createKeyPool(1, now), 0, until);
    expect(reserveKey(pool, limits, until - 1).index).toBeNull();
    expect(reserveKey(pool, limits, until).index).toBe(0);
  });

  it("wraps to an earlier available key and excludes keys already tried", () => {
    const pool = createKeyPool(3, now);
    pool.current = 2;
    pool.usage[2].minuteRequests = 9;
    expect(reserveKey(pool, limits, now).index).toBe(0);
    expect(reserveKey(pool, limits, now, [0, 1]).index).toBeNull();
  });

  it("works with one key and with no configured keys", () => {
    expect(reserveKey(createKeyPool(1, now), limits, now).index).toBe(0);
    expect(reserveKey(createKeyPool(0, now), limits, now).index).toBeNull();
  });
});

function quota(details: unknown[] = []) {
  return {
    statusCode: 429,
    responseBody: JSON.stringify({
      error: { status: "RESOURCE_EXHAUSTED", details },
    }),
  };
}

describe("Gemini quota cooldown", () => {
  it("honors fractional retryDelay from Google's RetryInfo", () => {
    expect(
      quotaCooldown(
        quota([
          {
            "@type": "type.googleapis.com/google.rpc.RetryInfo",
            retryDelay: "12.5s",
          },
        ]),
        now,
      ),
    ).toBe(now + 12_500);
  });

  it("supports protobuf duration objects", () => {
    expect(
      quotaCooldown(
        quota([{ retryDelay: { seconds: "2", nanos: 500_000_000 } }]),
        now,
      ),
    ).toBe(now + 2500);
  });

  it("cools down until the next minute without retry metadata", () => {
    expect(quotaCooldown(quota(), now)).toBe(
      Date.parse("2026-10-15T12:01:00Z"),
    );
  });

  it("cools daily quota failures until the next Manila day", () => {
    expect(
      quotaCooldown(
        quota([
          {
            violations: [
              { quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" },
            ],
          },
        ]),
        now,
      ),
    ).toBe(Date.parse("2026-10-15T16:00:00Z"));
  });

  it("recognizes RESOURCE_EXHAUSTED without an HTTP status", () => {
    expect(
      quotaCooldown({ data: { error: { status: "RESOURCE_EXHAUSTED" } } }, now),
    ).not.toBeNull();
    expect(
      quotaCooldown({ error: { status: "RESOURCE_EXHAUSTED" } }, now),
    ).not.toBeNull();
  });

  it("uses Retry-After when available and ignores malformed retry metadata", () => {
    expect(
      quotaCooldown(
        { ...quota(), responseHeaders: { "retry-after": "15" } },
        now,
      ),
    ).toBe(now + 15_000);
    expect(quotaCooldown(quota([{ retryDelay: "banana" }]), now)).toBe(
      Date.parse("2026-10-15T12:01:00Z"),
    );
  });

  it("accepts an HTTP-date Retry-After and skips blank values", () => {
    expect(
      quotaCooldown(
        {
          ...quota(),
          responseHeaders: { "retry-after": "Thu, 15 Oct 2026 12:01:30 GMT" },
        },
        now,
      ),
    ).toBe(Date.parse("2026-10-15T12:01:30Z"));
    expect(
      quotaCooldown(
        { ...quota(), responseHeaders: { "retry-after": " " } },
        now,
      ),
    ).toBe(Date.parse("2026-10-15T12:01:00Z"));
  });

  it("ignores non-quota errors, including ones whose message contains quota text", () => {
    expect(
      quotaCooldown({ statusCode: 500, message: "RESOURCE_EXHAUSTED" }, now),
    ).toBeNull();
    expect(quotaCooldown(new Error("secret"), now)).toBeNull();
    expect(
      quotaCooldown({ statusCode: 429, responseBody: "invalid JSON" }, now),
    ).not.toBeNull();
  });
});
