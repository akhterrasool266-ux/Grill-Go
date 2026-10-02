import { resendEmail } from './providers/email';
import { httpSms, twilioSms, twilioWhatsapp } from './providers/sms';
import { whatsappCloud } from './providers/whatsapp-cloud';
import type { Channel, MessageProvider } from './types';

/** Providers in order of preference per channel. The first one whose credentials exist is used. */
const ORDER: Record<string, MessageProvider[]> = { whatsapp: [whatsappCloud, twilioWhatsapp], sms: [twilioSms, httpSms], email: [resendEmail] };

export function providerFor(channel: Channel): MessageProvider | null {
  return (ORDER[channel] ?? []).find((p) => p.configured()) ?? null;
}
/** What the admin screen shows: which providers have credentials. Never exposes the credentials themselves. */
export function providerStatus() {
  return Object.entries(ORDER).flatMap(([channel, list]) => list.map((p) => ({ channel, id: p.id, configured: p.configured(), active: providerFor(channel as Channel)?.id === p.id })));
}
