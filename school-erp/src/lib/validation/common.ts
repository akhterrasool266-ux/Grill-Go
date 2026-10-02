import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (s: string) => { const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** HTML forms send "" for empty inputs; treat that as "not provided". */
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const text = (label: string, max = 200) =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
export const optText = (max = 500) => z.preprocess(blank, z.string().trim().max(max, 'Too long.').optional());
export const uuid = (label = 'Selection') =>
  z.string({ error: `${label} is required.` }).regex(UUID_RE, `${label} is required.`);
export const optUuid = () => z.preprocess(blank, z.string().regex(UUID_RE, 'Invalid selection.').optional());
export const date = (label = 'Date') =>
  z.string({ error: `${label} is required.` }).regex(DATE_RE, `${label} must be a valid date.`).refine(realDate, `${label} must be a valid date.`);
export const optDate = () => z.preprocess(blank, z.string().regex(DATE_RE, 'Must be a valid date.').refine(realDate, 'Must be a valid date.').optional());
export const time = (label = 'Time') => z.string({ error: `${label} is required.` }).regex(TIME_RE, `${label} must be a valid time.`);
export const optTime = () => z.preprocess(blank, z.string().regex(TIME_RE, 'Must be a valid time.').optional());
export const num = (label = 'Value', min = 0, max = 1e9) =>
  z.preprocess(blank, z.coerce.number({ error: `${label} must be a number.` }).min(min, `${label} must be at least ${min}.`).max(max, `${label} is too large.`));
export const optNum = (min = 0, max = 1e9) =>
  z.preprocess(blank, z.coerce.number({ error: 'Must be a number.' }).min(min, `Must be at least ${min}.`).max(max, 'Too large.').optional());
export const int = (label = 'Value', min = 0, max = 1e6) =>
  z.preprocess(blank, z.coerce.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min).max(max));
// Checkboxes post a hidden "false" first and "true" when ticked → the last value wins.
export const bool = () => z.preprocess((v) => { const x = Array.isArray(v) ? v[v.length - 1] : v; return x === true || x === 'true' || x === 'on' || x === '1'; }, z.boolean());
export const oneOf = <T extends readonly [string, ...string[]]>(vals: T, label = 'Choice') =>
  z.enum(vals, { error: (i) => (i.input === undefined || i.input === '' ? `${label} is required.` : `${label} is not valid.`) });

/** Pakistani CNIC / B-Form: 13 digits, dashes optional → stored as 12345-1234567-1. */
export const normalizeCnic = (v: string) => {
  const d = v.replace(/\D/g, '');
  return d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : v;
};
export const optCnic = () =>
  z.preprocess((v) => { const b = blank(v); return typeof b === 'string' ? normalizeCnic(b.trim()) : b; },
    z.string().regex(/^\d{5}-\d{7}-\d$/, 'Must be 13 digits, e.g. 35202-1234567-1.').optional());

/** Pakistani mobile: 03XX-XXXXXXX, +92 3XX XXXXXXX, 0092… → normalised to 03XXXXXXXXX where possible. */
export function normalizePhone(v: string): string {
  const d = v.replace(/[^\d+]/g, '');
  if (/^(\+92|0092)3\d{9}$/.test(d)) return '0' + d.replace(/^(\+92|0092)/, '');
  if (/^92 ?3\d{9}$/.test(d)) return '0' + d.slice(2);
  return d;
}
export const phone = (label = 'Phone') =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`)
    .transform(normalizePhone).refine((v) => /^\d{9,15}$/.test(v), `${label} must be a valid phone number.`);
export const optPhone = () =>
  z.preprocess((v) => { const b = blank(v); return typeof b === 'string' ? normalizePhone(b) : b; },
    z.string().regex(/^\d{9,15}$/, 'Must be a valid phone number.').optional());
export const optEmail = () => z.preprocess(blank, z.string().trim().toLowerCase().email('Enter a valid email address.').max(160).optional());

export type FieldErrors = Record<string, string>;
export function fieldErrorsOf(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** FormData → plain object; repeated keys become arrays; Next's internal $ACTION_* keys are dropped. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('$ACTION')) continue;
    if (typeof v !== 'string') { out[k] = v; continue; }
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  }
  return out;
}
