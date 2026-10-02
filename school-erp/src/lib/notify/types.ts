export type Channel = 'whatsapp' | 'sms' | 'email' | 'in_app' | 'push';

export interface OutMessage {
  channel: Channel;
  to: string;              // E.164 digits for phone channels, address for email
  body: string;
  subject?: string;
  language: 'en' | 'ur';
  /** WhatsApp Business requires a pre-approved template for business-initiated messages. */
  providerTemplate?: string | null;
  vars: Record<string, string>;
}
export interface SendResult { ok: boolean; messageId?: string; error?: string }

export interface MessageProvider {
  id: string;
  channel: Channel;
  /** True only when every credential it needs is present. Nothing is sent otherwise. */
  configured(): boolean;
  send(m: OutMessage): Promise<SendResult>;
}
