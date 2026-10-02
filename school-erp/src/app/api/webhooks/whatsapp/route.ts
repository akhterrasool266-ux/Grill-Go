import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/** Meta webhook: GET answers the one-time verification; POST carries delivery/read receipts (signature-checked). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === token) return new NextResponse(sp.get('hub.challenge') ?? '', { status: 200 });
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const raw = await req.text();
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const sig = (req.headers.get('x-hub-signature-256') ?? '').replace('sha256=', '');
  const expect = createHmac('sha256', secret).update(raw).digest('hex');
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  const body = JSON.parse(raw) as { entry?: { changes?: { value?: { statuses?: { id: string; status: string; errors?: { title?: string }[] }[] } }[] }[] };
  const admin = createAdminClient();
  for (const e of body.entry ?? []) for (const c of e.changes ?? []) for (const s of c.value?.statuses ?? []) {
    const map: Record<string, string> = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
    if (map[s.status]) await admin.rpc('update_delivery_status', { p_provider: 'whatsapp_cloud', p_message_id: s.id, p_status: map[s.status], p_error: s.errors?.[0]?.title ?? null });
  }
  return NextResponse.json({ ok: true });
}
