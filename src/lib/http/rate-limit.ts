export const DEFAULT_PUBLIC_MAX_PER_MINUTE = 60;
export const ADMIN_MAX_PER_MINUTE = 10;

const MINUTE_MS = 60_000;
const DEFAULT_IDLE_HORIZON_MS = 5 * MINUTE_MS;
const DEFAULT_SWEEP_INTERVAL_MS = MINUTE_MS;

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Whole seconds until the next token is available; only meaningful when denied. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitDecision;
  /** Live bucket count; exposed so tests can assert the idle sweep evicts. */
  size(): number;
}

export interface RateLimiterOptions {
  readonly maxPerMinute: number;
  readonly now?: () => number;
  readonly idleHorizonMs?: number;
  readonly sweepIntervalMs?: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/** Parses RATE_LIMIT_MAX_PER_MINUTE; any invalid or absent value falls back to the default. */
export function parseMaxPerMinute(value: string | undefined): number {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return DEFAULT_PUBLIC_MAX_PER_MINUTE;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return DEFAULT_PUBLIC_MAX_PER_MINUTE;
  }

  return parsed;
}

/** Last x-forwarded-for entry is appended by our own proxy; earlier entries are client-forgeable. */
export function getClientKey(
  forwardedFor: string | null | undefined,
): string {
  if (!forwardedFor) {
    return "unknown";
  }

  const parts = forwardedFor.split(",");
  const last = parts[parts.length - 1]?.trim();
  return last || "unknown";
}

/**
 * Token-bucket limiter with an injectable clock. State is an in-memory Map,
 * which is correct for the single-node standalone deployment; a lazy sweep on
 * access evicts idle buckets so the map cannot grow unbounded.
 */
export function createRateLimiter({
  maxPerMinute,
  now = Date.now,
  idleHorizonMs = DEFAULT_IDLE_HORIZON_MS,
  sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS,
}: RateLimiterOptions): RateLimiter {
  const capacity = maxPerMinute;
  const refillPerMs = capacity / MINUTE_MS;
  const buckets = new Map<string, Bucket>();
  let lastSweptAt: number | undefined;

  function sweep(currentTime: number): void {
    for (const [bucketKey, bucket] of buckets) {
      if (currentTime - bucket.lastRefill > idleHorizonMs) {
        buckets.delete(bucketKey);
      }
    }
  }

  return {
    check(key) {
      const currentTime = now();

      if (lastSweptAt === undefined) {
        lastSweptAt = currentTime;
      } else if (currentTime - lastSweptAt >= sweepIntervalMs) {
        sweep(currentTime);
        lastSweptAt = currentTime;
      }

      const bucket = buckets.get(key) ?? {
        tokens: capacity,
        lastRefill: currentTime,
      };

      const elapsed = currentTime - bucket.lastRefill;
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
      bucket.lastRefill = currentTime;
      buckets.set(key, bucket);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true, retryAfterSeconds: 0 };
      }

      const msUntilToken = (1 - bucket.tokens) / refillPerMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(msUntilToken / 1_000)),
      };
    },
    size() {
      return buckets.size;
    },
  };
}

/** Public /api/* limiter; env override is read once at module init. */
export const publicRateLimiter = createRateLimiter({
  maxPerMinute: parseMaxPerMinute(process.env.RATE_LIMIT_MAX_PER_MINUTE),
});

/** Stricter fixed cap for /api/admin/* to blunt ADMIN_API_KEY brute-force. */
export const adminRateLimiter = createRateLimiter({
  maxPerMinute: ADMIN_MAX_PER_MINUTE,
});
