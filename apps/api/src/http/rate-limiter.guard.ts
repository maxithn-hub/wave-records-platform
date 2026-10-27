interface RateBucket {
  count: number;
  resetAtMs: number;
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  public constructor(maxAttempts = 5, windowMs = 60_000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  public consume(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAtMs <= now) {
      this.buckets.set(key, { count: 1, resetAtMs: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= this.maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  public resetAll(): void {
    this.buckets.clear();
  }
}
