import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, __resetRateLimit } from '../api/_lib/ratelimit';

beforeEach(() => {
  __resetRateLimit();
});

describe('checkRateLimit', () => {
  it('admits 10 requests then rejects the 11th in the same window', () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('1.2.3.4', now).allowed).toBe(true);
    }
    const rejected = checkRateLimit('1.2.3.4', now);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterSec).toBeGreaterThan(0);
  });

  it('admits again after the window resets', () => {
    const now = 1_000_000;
    for (let i = 0; i < 11; i++) checkRateLimit('5.6.7.8', now);
    expect(checkRateLimit('5.6.7.8', now).allowed).toBe(false);
    // 10 minutes + 1 ms later the window has rolled over
    const later = now + 10 * 60 * 1000 + 1;
    expect(checkRateLimit('5.6.7.8', later).allowed).toBe(true);
  });

  it('tracks IPs independently', () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) checkRateLimit('a', now);
    expect(checkRateLimit('a', now).allowed).toBe(false);
    expect(checkRateLimit('b', now).allowed).toBe(true);
  });

  it('sequential increments never admit more than 10', () => {
    const now = 1_000_000;
    let admitted = 0;
    for (let i = 0; i < 25; i++) {
      if (checkRateLimit('9.9.9.9', now).allowed) admitted++;
    }
    expect(admitted).toBe(10);
  });

  it('collapses a missing IP into a shared bucket rather than going unlimited', () => {
    const now = 1_000_000;
    let admitted = 0;
    for (let i = 0; i < 15; i++) {
      if (checkRateLimit('', now).allowed) admitted++;
    }
    expect(admitted).toBe(10);
  });
});
