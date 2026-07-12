// in-memory fixed-window per-IP rate limiter. increment-first then reject, so
// there is no check-then-set race. per warm instance only: buckets reset on cold
// start and are not shared across instances. acceptable for a personal tool; the
// follow-up if abuse ever appears is Upstash / Vercel KV. a provider spend cap is
// the real backstop.

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  // missing ip collapses to a shared bucket rather than going unlimited
  const key = ip && ip.trim() ? ip.trim() : 'unknown';

  // prune stale buckets on access
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > LIMIT) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

// test-only reset so unit tests do not leak state between cases.
export function __resetRateLimit(): void {
  buckets.clear();
}
