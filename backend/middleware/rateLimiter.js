function createRateLimiter(options) {
  const windowMs = options.windowMs;
  const max = options.max;
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const key = `${req.ip}:${options.keyPrefix || 'global'}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ message: 'Too many requests, please retry later' });
    }

    return next();
  };
}

module.exports = createRateLimiter;
