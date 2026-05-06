import { RequestHandler } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: unknown;
}

interface ClientBucket {
  count: number;
  resetAt: number;
}

function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const trimmed = ip.trim();
  const mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : trimmed;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, ClientBucket>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(options.windowMs, 1000));
  cleanup.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = normalizeIp(req.ip);
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(options.max - bucket.count, 0);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json(options.message);
      return;
    }

    next();
  };
}
