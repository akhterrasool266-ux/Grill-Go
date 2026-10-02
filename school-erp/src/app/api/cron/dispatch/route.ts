import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { dispatchQueued } from '@/lib/notify/dispatch';

/** Called by a scheduler (Vercel Cron, cron-job.org, GitHub Actions) every few minutes with `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (secret.length < 24 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json(await dispatchQueued({ limit: 50 })); } catch { return NextResponse.json({ error: 'dispatch failed' }, { status: 500 }); }
}
export const GET = handle;
export const POST = handle;
