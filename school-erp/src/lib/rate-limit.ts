import 'server-only';

/**
 * Sliding-window limiter, per server instance (in-memory).
 * On serverless platforms each instance has its own memory, so this slows down
 * casual abuse but is NOT a hard guarantee. For production put a shared store
 * (Upstash Redis, Cloudflare Rate Limiting, Vercel Firewall) in front of
 * /login, /api/chat and the public admission form — see README → Security.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - list[0]!)) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return { ok: true, retryAfter: 0 };
}
