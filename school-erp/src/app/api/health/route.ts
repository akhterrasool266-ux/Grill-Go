import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** For uptime monitors and for you after a release: is the app up, is the database reachable, which version is running. No school data. */
export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown';
  let database: 'ok' | 'down' | 'not_configured' = 'not_configured';
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try { const { error } = await createAdminClient().from('plans').select('id', { head: true, count: 'exact' }).limit(1); database = error ? 'down' : 'ok'; } catch { database = 'down'; }
  }
  return NextResponse.json({ ok: database !== 'down', version, database }, { status: database === 'down' ? 503 : 200, headers: { 'cache-control': 'no-store' } });
}
