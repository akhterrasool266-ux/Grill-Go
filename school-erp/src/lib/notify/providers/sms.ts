import type { MessageProvider, OutMessage, SendResult } from '../types';

/** Twilio (SMS and WhatsApp-via-Twilio). */
const twilioCreds = () => (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM ? { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM } : null);
async function twilioSend(m: OutMessage, whatsapp: boolean): Promise<SendResult> {
  const c = twilioCreds(); if (!c) return { ok: false, error: 'provider_not_configured: twilio' };
  const form = new URLSearchParams({ To: `${whatsapp ? 'whatsapp:' : ''}+${m.to}`, From: whatsapp ? `whatsapp:${c.from}` : c.from, Body: m.body });
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${c.sid}:${c.token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(15000) });
    const j = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    return res.ok && j.sid ? { ok: true, messageId: j.sid } : { ok: false, error: `twilio ${res.status}: ${j.message ?? 'rejected'}`.slice(0, 300) };
  } catch (e) { return { ok: false, error: `twilio network: ${(e as Error).message}`.slice(0, 300) }; }
}
export const twilioSms: MessageProvider = { id: 'twilio_sms', channel: 'sms', configured: () => !!twilioCreds(), send: (m) => twilioSend(m, false) };
export const twilioWhatsapp: MessageProvider = { id: 'twilio_whatsapp', channel: 'whatsapp', configured: () => !!twilioCreds(), send: (m) => twilioSend(m, true) };

/**
 * Generic HTTP SMS gateway (most Pakistani bulk-SMS vendors expose a simple JSON/GET API).
 * POSTs { to, message, sender } with a bearer key — adapt the body/headers here to your vendor's documentation.
 */
export const httpSms: MessageProvider = {
  id: 'http_sms', channel: 'sms',
  configured: () => Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY),
  async send(m) {
    try {
      const res = await fetch(process.env.SMS_API_URL!, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SMS_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: m.to, message: m.body, sender: process.env.SMS_SENDER_ID ?? undefined }), signal: AbortSignal.timeout(15000) });
      const j = (await res.json().catch(() => ({}))) as { id?: string; message_id?: string; error?: string };
      return res.ok ? { ok: true, messageId: String(j.id ?? j.message_id ?? '') || undefined } : { ok: false, error: `sms ${res.status}: ${j.error ?? 'rejected'}`.slice(0, 300) };
    } catch (e) { return { ok: false, error: `sms network: ${(e as Error).message}`.slice(0, 300) }; }
  },
};
