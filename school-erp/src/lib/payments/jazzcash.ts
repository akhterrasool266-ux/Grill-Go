import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Gateway } from './gateway';

/**
 * JazzCash hosted-checkout ("page redirection") integration.
 * Secure hash = HMAC-SHA256(key = integrity salt, message = salt & every non-empty pp_* value ordered by field name, joined by "&"), upper-case hex.
 * STATUS: code-complete from JazzCash's public documentation but NOT yet verified against the JazzCash sandbox —
 * run the checklist in docs/payments.md with sandbox credentials before enabling it for parents.
 */
export const jazzcash: Gateway = {
  id: 'jazzcash', label: 'JazzCash',
  enabled: () => Boolean(process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT),
};

export function secureHash(fields: Record<string, string>, salt = process.env.JAZZCASH_INTEGRITY_SALT ?? ''): string {
  const values = Object.keys(fields).filter((k) => k.startsWith('pp_') && k !== 'pp_SecureHash' && fields[k] !== '').sort().map((k) => fields[k]);
  return createHmac('sha256', salt).update([salt, ...values].join('&')).digest('hex').toUpperCase();
}

export function verifyCallback(fields: Record<string, string>): boolean {
  const got = (fields.pp_SecureHash ?? '').toUpperCase();
  const want = secureHash(fields);
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

/** Form fields to POST to JazzCash. Amount is in rupees here; JazzCash wants paisa. */
export function checkoutFields(o: { reference: string; amountPkr: number; description: string; returnUrl: string; billRef: string }): Record<string, string> {
  const now = new Date(), exp = new Date(now.getTime() + 60 * 60 * 1000);
  const f: Record<string, string> = {
    pp_Version: '1.1', pp_TxnType: '', pp_Language: 'EN', pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID!, pp_Password: process.env.JAZZCASH_PASSWORD!,
    pp_TxnRefNo: o.reference, pp_Amount: String(Math.round(o.amountPkr * 100)), pp_TxnCurrency: 'PKR', pp_TxnDateTime: stamp(now), pp_BillReference: o.billRef.slice(0, 20),
    pp_Description: o.description.slice(0, 100), pp_TxnExpiryDateTime: stamp(exp), pp_ReturnURL: o.returnUrl,
  };
  f.pp_SecureHash = secureHash(f);
  return f;
}
