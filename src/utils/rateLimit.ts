interface RateLimitRule {
  points: number; // Number of requests allowed
  duration: number; // Time window in milliseconds
  blockDuration: number; // How long to block when limit exceeded
}

interface RateLimitEntry {
  points: number;
  lastReset: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limits: Map<string, RateLimitEntry> = new Map();

  private constructor(
    private rules: RateLimitRule = {
      points: 30, // 30 requests
      duration: 60000, // per minute
      blockDuration: 300000, // block for 5 minutes
    }
  ) {}

  static getInstance(rules?: RateLimitRule): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter(rules);
    }
    return RateLimiter.instance;
  }

  consume(key: string): boolean {
    this.cleanup();

    let entry = this.limits.get(key);
    const now = Date.now();

    if (!entry) {
      entry = { points: this.rules.points, lastReset: now };
      this.limits.set(key, entry);
    }

    if (entry.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    if (now - entry.lastReset >= this.rules.duration) {
      entry.points = this.rules.points;
      entry.lastReset = now;
    }

    if (entry.points <= 0) {
      entry.blockedUntil = now + this.rules.blockDuration;
      return false;
    }

    entry.points--;
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (entry.blockedUntil && now >= entry.blockedUntil) {
        this.limits.delete(key);
      }
    }
  }
}
