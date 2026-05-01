type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type RateLimitOptions = {
  limit: number;      // Maximum number of requests
  windowMs: number;   // Window size in milliseconds
};

class RateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();

  public limit(ip: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const record = this.cache.get(ip);

    if (!record || now > record.resetTime) {
      this.cache.set(ip, { count: 1, resetTime: now + options.windowMs });
      return {
        success: true,
        limit: options.limit,
        remaining: options.limit - 1,
        reset: now + options.windowMs,
      };
    }

    const isSuccess = record.count < options.limit;
    if (isSuccess) {
      record.count += 1;
    }

    return {
      success: isSuccess,
      limit: options.limit,
      remaining: Math.max(0, options.limit - record.count),
      reset: record.resetTime,
    };
  }

  // Optional: cleanup old entries periodically to prevent memory leaks
  public cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.cache.entries()) {
      if (now > record.resetTime) {
        this.cache.delete(ip);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Setup cleanup interval (e.g. every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
}
