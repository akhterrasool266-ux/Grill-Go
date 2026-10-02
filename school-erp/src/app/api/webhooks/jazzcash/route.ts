import { NextResponse, type NextRequest } from 'next/server';
import { verifyCallback } from '@/lib/payments/jazzcash';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * JazzCash posts the customer's browser back here. A payment is recorded ONLY if
 *   1. the secure hash verifies with our integrity salt,
 *   2. the response code is success (000),
 *   3. the reference matches a pending intent that WE created, and
 *   4. the amount equals our own record (enforced inside complete_online_payment).
 * Every callback — valid or not — is logged in payment_gateway_events.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const f: Record<string, string> = {};
  form.forEach((v, k) => { if (typeof v === 'string') f[k] = v; });
  const admin = createAdminClient();
  const ref = f.pp_TxnRefNo ?? '';
  const { data: intent } = ref ? await admin.from('payment_intents').select('id,school_id,amount,status').eq('reference', ref).maybeSingle() : { data: null };
  const valid = verifyCallback(f);
  const safeLog = { ...f }; delete safeLog.pp_Password;
  let outcome = 'ignored';
  const redirect = (s: string) => NextResponse.redirect(new URL(`/pay/result?s=${s}`, process.env.NEXT_PUBLIC_APP_URL ?? req.url), 303);
  try {
    if (!valid) outcome = 'rejected: bad signature';
    else if (!intent) outcome = 'rejected: unknown reference';
    else if (f.pp_ResponseCode !== '000') { outcome = `declined: ${f.pp_ResponseCode ?? ''}`; await admin.from('payment_intents').update({ status: 'failed' }).eq('id', intent.id).eq('status', 'pending'); }
    else {
      const { error } = await admin.rpc('complete_online_payment', { p_reference: ref, p_gateway: 'jazzcash', p_gateway_txn: f.pp_RetreivalReferenceNo || f.pp_TxnRefNo, p_amount: Number(f.pp_Amount) / 100 });
      outcome = error ? `rejected: ${error.message.slice(0, 80)}` : 'paid';
    }
  } finally {
    await admin.from('payment_gateway_events').insert({ school_id: intent?.school_id ?? null, gateway: 'jazzcash', intent_id: intent?.id ?? null, signature_valid: valid, payload: safeLog, outcome });
  }
  return redirect(outcome === 'paid' ? 'ok' : outcome.startsWith('declined') ? 'declined' : 'error');
}
