const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MANILA_OFFSET_MS = 8 * 60 * MINUTE_MS;

export type QuotaLimits = {
  perMinute: number;
  perDay: number;
  threshold: number;
};

type KeyUsage = {
  minute: number;
  minuteRequests: number;
  day: number;
  dayRequests: number;
  cooldownUntil: number;
};

export type KeyPool = { current: number; usage: KeyUsage[] };

function windows(now: number) {
  return {
    minute: Math.floor(now / MINUTE_MS) * MINUTE_MS,
    day:
      Math.floor((now + MANILA_OFFSET_MS) / DAY_MS) * DAY_MS - MANILA_OFFSET_MS,
  };
}

export function createKeyPool(count: number, now: number): KeyPool {
  return {
    current: 0,
    usage: Array.from({ length: count }, () => ({
      ...windows(now),
      minuteRequests: 0,
      dayRequests: 0,
      cooldownUntil: 0,
    })),
  };
}

/** Reserve synchronously before I/O so concurrent requests see each other's usage. */
export function reserveKey(
  pool: KeyPool,
  limits: QuotaLimits,
  now: number,
  excluded: readonly number[] = [],
): { pool: KeyPool; index: number | null } {
  const window = windows(now);
  const usage = pool.usage.map((key) => ({
    ...key,
    ...window,
    minuteRequests: key.minute === window.minute ? key.minuteRequests : 0,
    dayRequests: key.day === window.day ? key.dayRequests : 0,
  }));
  for (let offset = 0; offset < usage.length; offset++) {
    const index = (pool.current + offset) % usage.length;
    const key = usage[index];
    if (
      excluded.includes(index) ||
      key.cooldownUntil > now ||
      key.minuteRequests >= limits.perMinute * limits.threshold ||
      key.dayRequests >= limits.perDay * limits.threshold
    )
      continue;
    key.minuteRequests++;
    key.dayRequests++;
    return { index, pool: { current: index, usage } };
  }
  return { index: null, pool: { ...pool, usage } };
}

export function coolDownKey(
  pool: KeyPool,
  index: number,
  until: number,
): KeyPool {
  return {
    ...pool,
    usage: pool.usage.map((key, i) =>
      i === index
        ? { ...key, cooldownUntil: Math.max(key.cooldownUntil, until) }
        : key,
    ),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function durationMs(value: unknown): number | null {
  let seconds: number;
  if (typeof value === "string" && /^\d+(?:\.\d+)?s$/.test(value)) {
    seconds = Number(value.slice(0, -1));
  } else if (typeof value === "object" && value !== null) {
    const duration = record(value);
    seconds = Number(duration.seconds ?? 0) + Number(duration.nanos ?? 0) / 1e9;
    if (!("seconds" in duration || "nanos" in duration)) return null;
  } else return null;
  const ms = seconds * 1000;
  return Number.isFinite(ms) && ms >= 0 && ms <= Number.MAX_SAFE_INTEGER
    ? ms
    : null;
}

/** Read only structured quota metadata; never expose provider messages or keys. */
export function quotaCooldown(error: unknown, now: number): number | null {
  const outer = record(error);
  let body = record(outer.data);
  if (typeof outer.responseBody === "string") {
    try {
      body = record(JSON.parse(outer.responseBody));
    } catch {
      /* Use the status code. */
    }
  }
  const payload = Object.keys(body).length ? body : outer;
  const failure = record(payload.error ?? payload);
  if (
    outer.statusCode !== 429 &&
    failure.code !== 429 &&
    failure.status !== "RESOURCE_EXHAUSTED"
  )
    return null;
  const details = Array.isArray(failure.details)
    ? failure.details.map(record)
    : [];
  for (const detail of details) {
    const delay = durationMs(detail.retryDelay);
    if (delay !== null) return now + delay;
  }
  const retryAfter = record(outer.responseHeaders)["retry-after"];
  if (typeof retryAfter === "string" && retryAfter.trim()) {
    const seconds = Number(retryAfter);
    const until = Number.isFinite(seconds)
      ? now + seconds * 1000
      : Date.parse(retryAfter);
    if (Number.isFinite(until) && until >= now) return until;
  }
  const daily = details.some(
    (detail) =>
      Array.isArray(detail.violations) &&
      detail.violations.some((violation) => {
        const { quotaId, quotaMetric } = record(violation);
        return [quotaId, quotaMetric].some(
          (value) => typeof value === "string" && /per.?day|daily/i.test(value),
        );
      }),
  );
  const window = windows(now);
  return daily ? window.day + DAY_MS : window.minute + MINUTE_MS;
}
