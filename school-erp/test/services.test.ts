import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTemplate, toE164Pk } from '@/lib/notify/render';
import { friendlyError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { checkoutFields, secureHash, verifyCallback } from '@/lib/payments/jazzcash';

describe('message templates', () => {
  it('fills placeholders', () => expect(renderTemplate('Dear {{guardian}}, {{student_name}} owes Rs {{amount}}', { guardian: 'Imran', student_name: 'Ali', amount: 4500 })).toBe('Dear Imran, Ali owes Rs 4500'));
  it('removes unknown placeholders rather than showing raw braces to parents', () => expect(renderTemplate('Hi {{nope}} there', {})).not.toContain('{{'));
  it('does not execute or expand anything', () => expect(renderTemplate('{{constructor}}', {})).toBe(''));
  it('renders Urdu unchanged', () => expect(renderTemplate('{{name}} آج غیر حاضر ہے', { name: 'علی' })).toBe('علی آج غیر حاضر ہے'));
});

describe('Pakistani mobile → WhatsApp number', () => {
  it.each([['0300-1234567', '923001234567'], ['+92 300 1234567', '923001234567'], ['923001234567', '923001234567'], ['0092 300 1234567', '923001234567'], ['3001234567', '923001234567']])('%s', (i, o) => expect(toE164Pk(i)).toBe(o));
  it.each(['12345', '', '0300-123', '04212345678901'])('rejects %s', (i) => expect(toE164Pk(i)).toBeNull());
});

describe('error messages shown to users', () => {
  it('maps our RPC tokens to plain language', () => expect(friendlyError({ message: 'permission_denied: students.create' })).toMatch(/permission/i));
  it('maps RLS violations to a permission message', () => expect(friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "students"' })).toMatch(/permission/i));
  it('never leaks SQL, table names or stack traces for unknown errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = friendlyError({ message: 'relation "secret_table" does not exist at character 15', code: '42P01' }, 'ABC123');
    expect(out).toContain('ABC123'); expect(out).not.toMatch(/secret_table|relation|character/);
    spy.mockRestore();
  });
  it('explains duplicate records', () => expect(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "x"' })).toMatch(/exists|already/i));
});

describe('rate limiter', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it('allows up to the limit then blocks, with retryAfter', () => {
    for (let i = 0; i < 3; i++) expect(rateLimit('t1', 3, 60_000).ok).toBe(true);
    const r = rateLimit('t1', 3, 60_000); expect(r.ok).toBe(false); expect(r.retryAfter).toBeGreaterThan(0);
  });
  it('keys are independent', () => { rateLimit('a', 1, 1000); expect(rateLimit('b', 1, 1000).ok).toBe(true); });
  it('recovers after the window', () => { rateLimit('w', 1, 1000); expect(rateLimit('w', 1, 1000).ok).toBe(false); vi.advanceTimersByTime(1100); expect(rateLimit('w', 1, 1000).ok).toBe(true); });
});

describe('JazzCash callback signature', () => {
  const SALT = 'unit-test-salt';
  beforeEach(() => { process.env.JAZZCASH_INTEGRITY_SALT = SALT; }); afterEach(() => { delete process.env.JAZZCASH_INTEGRITY_SALT; });
  const base = { pp_Amount: '50000', pp_TxnRefNo: 'T20260101', pp_ResponseCode: '000', pp_BillReference: 'INT-1' };
  const signed = () => ({ ...base, pp_SecureHash: secureHash(base, SALT) });
  it('accepts a correctly signed callback', () => expect(verifyCallback(signed())).toBe(true));
  it('rejects a tampered amount', () => expect(verifyCallback({ ...signed(), pp_Amount: '100' })).toBe(false));
  it('rejects a tampered response code', () => expect(verifyCallback({ ...signed(), pp_ResponseCode: '999' })).toBe(false));
  it('rejects a missing hash', () => expect(verifyCallback({ ...base })).toBe(false));
  it('rejects a hash made with another salt', () => expect(verifyCallback({ ...base, pp_SecureHash: secureHash(base, 'other-salt') })).toBe(false));
  it('does not throw on a short / garbage hash', () => expect(verifyCallback({ ...base, pp_SecureHash: 'abc' })).toBe(false));
  it('checkout form is signed and sends paisa', () => {
    process.env.JAZZCASH_MERCHANT_ID = 'M1'; process.env.JAZZCASH_PASSWORD = 'P1';
    const f = checkoutFields({ reference: 'INT-9', amountPkr: 1234.5, description: 'Fees', returnUrl: 'https://x.test/cb', billRef: 'B9' });
    expect(f.pp_Amount).toBe('123450'); expect(verifyCallback(f)).toBe(true);
    delete process.env.JAZZCASH_MERCHANT_ID; delete process.env.JAZZCASH_PASSWORD;
  });
});
