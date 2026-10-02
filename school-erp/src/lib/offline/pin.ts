/**
 * Optional device PIN for the offline area (/offline-work).
 * Offline, the server cannot confirm who is holding the phone, so the offline screens ask for a PIN the user chose.
 * Only a salted PBKDF2 hash is stored. Honest limit: this keeps a casual user of an unlocked phone out; it is NOT
 * encryption of the data at rest — the phone's own screen lock is the real protection.
 */
import { getMeta, setMeta, wipeAll } from './db';

const ITER = 210_000, MAX_FAILS = 10;
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer), (x) => x.toString(16).padStart(2, '0')).join('');
async function derive(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITER }, key, 256));
}
export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

export async function hasPin() { return Boolean(await getMeta('pin')); }
export async function setPin(pin: string) {
  if (!validPin(pin)) throw new Error('PIN must be 4–8 digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await setMeta('pin', { salt: hex(salt), hash: await derive(pin, salt) });
  await setMeta('pinFails', { n: 0, until: 0 });
}
export type PinResult = { ok: true } | { ok: false; reason: 'wrong' | 'locked' | 'wiped'; waitSeconds?: number; left?: number };
export async function checkPin(pin: string): Promise<PinResult> {
  const rec = await getMeta<{ salt: string; hash: string }>('pin');
  if (!rec) return { ok: true };
  const f = (await getMeta<{ n: number; until: number }>('pinFails')) ?? { n: 0, until: 0 };
  if (f.until > Date.now()) return { ok: false, reason: 'locked', waitSeconds: Math.ceil((f.until - Date.now()) / 1000) };
  const salt = new Uint8Array(rec.salt.match(/../g)!.map((h) => parseInt(h, 16)));
  if ((await derive(pin, salt)) === rec.hash) { await setMeta('pinFails', { n: 0, until: 0 }); return { ok: true }; }
  const n = f.n + 1;
  if (n >= MAX_FAILS) { await wipeAll(); return { ok: false, reason: 'wiped' }; }
  await setMeta('pinFails', { n, until: n % 3 === 0 ? Date.now() + 60_000 * n : 0 });
  return { ok: false, reason: 'wrong', left: MAX_FAILS - n };
}
