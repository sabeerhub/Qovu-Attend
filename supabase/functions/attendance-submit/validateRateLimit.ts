// Validate-action rate limiter for attendance-submit (v0.5.5).
//
// The validate action (`{ action: 'validate', passcode }`) is a
// brute-force oracle for a 6-digit code, so it is rate-limited
// separately from the submission limiter: 60 attempts per client IP
// per minute, plus a 2000-per-minute global cap. The per-IP number
// is deliberately above a single student's honest use: a whole
// lecture hall on shared campus WiFi shares one public IP, so a
// 30/min cap could block honest students who mistype. It is still
// safe because a code lives only 5 minutes (300 s) — at most ~300
// guesses per code lifetime per IP out of 900,000 possible codes —
// and the global cap stays as flood protection. The submission
// limiter (300 per session per minute) is unchanged.
//
// This module has no imports on purpose, like resolveSession.ts:
// it is the one other piece of Edge Function logic that can be
// unit-tested under vitest (Deno is not installed in this
// workspace). The caller passes the client IP (first entry of
// `x-forwarded-for`, or 'unknown' when the header is absent).
//
// Honest limit, same as the submission limiter: in-memory per
// function instance, best-effort, resets when the instance is
// recycled. If abuse is a concern, put a managed limiter
// (e.g. Supabase rate limits / Cloudflare) in front of this
// function.

export interface ValidateRateLimitOptions {
  /** Attempts allowed per client IP per window. Default 60. */
  maxPerIpPerWindow?: number;
  /** Attempts allowed across all callers per window. Default 2000. */
  maxGlobalPerWindow?: number;
  /** Window length in milliseconds. Default 60_000. */
  windowMs?: number;
}

export interface ValidateRateLimiter {
  /**
   * True when this attempt is over the limit and must be refused
   * with 429. Counting an attempt and checking the limit are one
   * step: every call consumes one attempt from both buckets.
   */
  isLimited: (clientIp: string, nowMs?: number) => boolean;
  /** Test/support hook: drop all buckets. */
  reset: () => void;
}

interface Bucket {
  count: number;
  windowStart: number;
}

export function createValidateRateLimiter(
  options: ValidateRateLimitOptions = {},
): ValidateRateLimiter {
  const maxPerIp = options.maxPerIpPerWindow ?? 60;
  const maxGlobal = options.maxGlobalPerWindow ?? 2000;
  const windowMs = options.windowMs ?? 60_000;

  const perIp = new Map<string, Bucket>();
  let globalBucket: Bucket | null = null;

  function take(bucket: Bucket, nowMs: number): number {
    if (nowMs - bucket.windowStart >= windowMs) {
      bucket.count = 1;
      bucket.windowStart = nowMs;
      return bucket.count;
    }
    bucket.count += 1;
    return bucket.count;
  }

  return {
    isLimited(clientIp: string, nowMs: number = Date.now()): boolean {
      const ip = clientIp.trim() || 'unknown';
      let bucket = perIp.get(ip);
      if (!bucket) {
        bucket = { count: 0, windowStart: nowMs };
        perIp.set(ip, bucket);
      }
      if (!globalBucket) {
        globalBucket = { count: 0, windowStart: nowMs };
      }
      const ipCount = take(bucket, nowMs);
      const globalCount = take(globalBucket, nowMs);
      return ipCount > maxPerIp || globalCount > maxGlobal;
    },
    reset(): void {
      perIp.clear();
      globalBucket = null;
    },
  };
}
