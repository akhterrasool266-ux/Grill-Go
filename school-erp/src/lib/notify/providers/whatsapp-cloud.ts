import type { MessageProvider, OutMessage, SendResult } from '../types';

/**
 * WhatsApp Business Cloud API (Meta).
 * - With a `providerTemplate` the message is sent as a template (required to start a conversation);
 *   the template's body variables are filled, in order, from the placeholders of our template text.
 * - Without one it is a free-form text message, which Meta only delivers inside the 24-hour customer window.
 * Delivery status arrives later through /api/webhooks/whatsapp — we never mark a message delivered ourselves.
 */
export const whatsappCloud: MessageProvider = {
  id: 'whatsapp_cloud', channel: 'whatsapp',
  configured: () => Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
  async send(m: OutMessage): Promise<SendResult> {
    const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const params = Object.values(m.vars).slice(0, 10).map((v) => ({ type: 'text', text: String(v).slice(0, 200) }));
    const payload = m.providerTemplate
      ? { messaging_product: 'whatsapp', to: m.to, type: 'template', template: { name: m.providerTemplate, language: { code: m.language === 'ur' ? 'ur' : 'en' }, components: params.length ? [{ type: 'body', parameters: params }] : [] } }
      : { messaging_product: 'whatsapp', to: m.to, type: 'text', text: { body: m.body, preview_url: false } };
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      const j = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
      if (!res.ok || !j.messages?.[0]) return { ok: false, error: `whatsapp ${res.status}: ${j.error?.message ?? 'rejected'}`.slice(0, 300) };
      return { ok: true, messageId: j.messages[0].id };
    } catch (e) { return { ok: false, error: `whatsapp network: ${(e as Error).message}`.slice(0, 300) }; }
  },
};
