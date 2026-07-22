import { describe, expect, it } from "vitest";

import {
  createRateLimiter,
  getClientKey,
  parseMaxPerMinute,
} from "./rate-limit";

function fakeClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxPerMinute: 3, now: clock.now });

    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(true);
  });

  it("denies the request that exceeds the limit", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxPerMinute: 2, now: clock.now });

    limiter.check("ip");
    limiter.check("ip");
    const decision = limiter.check("ip");

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("refills tokens as time passes", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxPerMinute: 2, now: clock.now });

    limiter.check("ip");
    limiter.check("ip");
    expect(limiter.check("ip").allowed).toBe(false);

    // 2 tokens/min => one token refills after 30s.
    clock.advance(30_000);
    expect(limiter.check("ip").allowed).toBe(true);
  });

  it("isolates buckets per key", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxPerMinute: 1, now: clock.now });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("reports Retry-After as seconds until the next token", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxPerMinute: 60, now: clock.now });

    for (let i = 0; i < 60; i += 1) {
      expect(limiter.check("ip").allowed).toBe(true);
    }

    // 60 tokens/min => one token per second.
    expect(limiter.check("ip").retryAfterSeconds).toBe(1);
  });

  it("sweeps idle buckets so the map stays bounded", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({
      maxPerMinute: 5,
      now: clock.now,
      idleHorizonMs: 10_000,
      sweepIntervalMs: 10_000,
    });

    limiter.check("a");
    limiter.check("b");
    limiter.check("c");
    expect(limiter.size()).toBe(3);

    // Past both the sweep interval and the idle horizon: a fresh access evicts the stale keys.
    clock.advance(30_000);
    limiter.check("d");

    expect(limiter.size()).toBe(1);
  });
});

describe("parseMaxPerMinute", () => {
  it("parses a positive integer", () => {
    expect(parseMaxPerMinute("120")).toBe(120);
  });

  it("falls back to the default for absent or invalid values", () => {
    expect(parseMaxPerMinute(undefined)).toBe(60);
    expect(parseMaxPerMinute("")).toBe(60);
    expect(parseMaxPerMinute("abc")).toBe(60);
    expect(parseMaxPerMinute("0")).toBe(60);
    expect(parseMaxPerMinute("-5")).toBe(60);
    expect(parseMaxPerMinute("12.5")).toBe(60);
  });
});

describe("getClientKey", () => {
  it("uses the last x-forwarded-for entry, trimmed", () => {
    expect(getClientKey("1.1.1.1, 2.2.2.2, 3.3.3.3")).toBe("3.3.3.3");
    expect(getClientKey("  9.9.9.9  ")).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when the header is absent or empty", () => {
    expect(getClientKey(null)).toBe("unknown");
    expect(getClientKey(undefined)).toBe("unknown");
    expect(getClientKey("")).toBe("unknown");
    expect(getClientKey("  ")).toBe("unknown");
  });
});
