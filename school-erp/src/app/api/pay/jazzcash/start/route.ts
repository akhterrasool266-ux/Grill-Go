import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getCtx } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/csrf';
import { checkoutFields, jazzcash } from '@/lib/payments/jazzcash';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Starts an online payment. The AMOUNT IS COMPUTED HERE from the database (all open vouchers) — never taken from the browser. */
export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const ctx = await getCtx();
  if (!ctx) return NextResponse.redirect(new URL('/login', req.url), 303);
  if (!jazzcash.enabled()) return NextResponse.json({ error: 'Online payment is not enabled.' }, { status: 503 });
  if (!rateLimit(`pay:${ctx.userId}`, 6, 10 * 60_000).ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const form = await req.formData();
  const studentId = String(form.get('student_id') ?? '');
  if (!ctx.studentIds.includes(studentId) && !ctx.permissions.includes('payments.create')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = await createClient();
  const { data: s } = await sb.from('students').select('id,campus_id,school_id').eq('id', studentId).maybeSingle();
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: inv } = await sb.from('fee_invoices').select('balance').eq('student_id', studentId).in('status', ['unpaid', 'partial']).gt('balance', 0);
  const amount = (inv ?? []).reduce((a: number, i: { balance: number }) => a + Number(i.balance), 0);
  if (amount <= 0) return NextResponse.redirect(new URL('/portal/parent', req.url), 303);

  const reference = 'T' + randomBytes(9).toString('hex').slice(0, 15).toUpperCase();
  const admin = createAdminClient();
  const { error } = await admin.from('payment_intents').insert({ school_id: s.school_id, campus_id: s.campus_id, student_id: studentId, gateway: 'jazzcash', amount, reference, status: 'pending', created_by: ctx.userId });
  if (error) return NextResponse.json({ error: 'Could not start payment' }, { status: 500 });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const fields = checkoutFields({ reference, amountPkr: amount, description: 'School fee', returnUrl: `${base}/api/webhooks/jazzcash`, billRef: studentId.slice(0, 8) });
  const endpoint = process.env.JAZZCASH_ENDPOINT ?? 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';
  const html = `<!doctype html><meta charset="utf-8"><title>Redirecting to JazzCash…</title><body style="font-family:system-ui;text-align:center;padding:3rem"><p>Redirecting to JazzCash…</p><form id="f" method="post" action="${esc(endpoint)}">${Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}<noscript><button>Continue to JazzCash</button></noscript></form><script>document.getElementById('f').submit()</script>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
