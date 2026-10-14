type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > limit) {
    return { retryAfter: Math.ceil((current.reset - now) / 1000) };
  }
  return null;
}

export function clientIp(request: Request) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 80);
  }
  return "local";
}
