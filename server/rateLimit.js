/**
 * Simple in-memory sliding-window rate limiter per client IP.
 */
export function createRateLimiter({ windowMs = 60_000, maxRequests = 30 } = {}) {
  const hits = new Map();

  // Periodic cleanup to avoid unbounded memory growth
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const recent = timestamps.filter((ts) => now - ts < windowMs);
      if (recent.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, recent);
      }
    }
  }, windowMs);
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return function rateLimitMiddleware(req, res, next) {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' && forwarded.split(',')[0]?.trim()) ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const recent = (hits.get(clientIp) || []).filter((ts) => now - ts < windowMs);

    if (recent.length >= maxRequests) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: `Rate limit exceeded. Please wait ${retryAfterSeconds}s before analyzing more chats.`,
        code: 'RATE_LIMITED',
        retryAfterSeconds,
      });
    }

    recent.push(now);
    hits.set(clientIp, recent);
    next();
  };
}
