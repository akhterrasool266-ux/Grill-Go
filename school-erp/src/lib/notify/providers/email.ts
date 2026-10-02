import type { MessageProvider } from '../types';

/** Resend (https://resend.com). Swap this file for SendGrid/SES/SMTP if you prefer — the interface is the same. */
export const resendEmail: MessageProvider = {
  id: 'resend', channel: 'email',
  configured: () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  async send(m) {
    try {
      const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.to], subject: m.subject ?? 'Message from school', text: m.body }), signal: AbortSignal.timeout(15000) });
      const j = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      return res.ok && j.id ? { ok: true, messageId: j.id } : { ok: false, error: `email ${res.status}: ${j.message ?? 'rejected'}`.slice(0, 300) };
    } catch (e) { return { ok: false, error: `email network: ${(e as Error).message}`.slice(0, 300) }; }
  },
};
