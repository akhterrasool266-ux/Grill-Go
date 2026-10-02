import type { NextRequest } from 'next/server';

/**
 * CSRF guard for state-changing route handlers: the request must come from our own origin.
 * (Server Actions already enforce this in Next.js; cookies are SameSite=Lax as a second layer.)
 */
export function assertSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') === 'same-origin';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
}
