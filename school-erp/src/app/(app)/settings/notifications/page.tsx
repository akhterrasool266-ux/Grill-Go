import type { Metadata } from 'next';
import { NotificationSettings } from '@/components/data/settings-forms';
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { jazzcash } from '@/lib/payments/jazzcash';
import { easypaisa } from '@/lib/payments/easypaisa';
import { providerStatus } from '@/lib/notify/registry';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Notifications & integrations' };

export default async function NotificationSettingsPage() {
  const ctx = await requirePerm('settings.view');
  const sb = await createClient();
  const { data } = await sb.from('settings').select('value').eq('key', 'notifications').maybeSingle();
  const status = providerStatus();
  const names: Record<string, string> = { whatsapp_cloud: 'WhatsApp Business Cloud API (Meta)', twilio_whatsapp: 'Twilio WhatsApp', twilio_sms: 'Twilio SMS', http_sms: 'HTTP SMS gateway', resend: 'Resend email' };
  const row = (label: string, ok: boolean, active?: boolean, note?: string) => <tr key={label}><Td>{label}{note && <span className="block text-xs text-muted">{note}</span>}</Td><Td>{ok ? <Badge tone="ok">Credentials present{active ? ' · in use' : ''}</Badge> : <Badge>Not configured</Badge>}</Td></tr>;
  return (<><PageHeader title="Notifications & integrations" back={{ href: '/settings', label: 'Settings' }} />
    <Alert tone="info" title="Credentials never live in the database or the browser">API keys are server environment variables (Vercel / Netlify settings). This page only reports whether they are present — it can never show them. Nothing here claims a live connection that has not been configured.</Alert>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="Messaging providers" /><TableWrap><thead><tr><Th>Provider</Th><Th>Status</Th></tr></thead><tbody>{status.map((p) => row(names[p.id] ?? p.id, p.configured, p.active))}</tbody></TableWrap></Card>
      <Card><CardHeader title="Payment gateways" /><TableWrap><thead><tr><Th>Gateway</Th><Th>Status</Th></tr></thead><tbody>{row('JazzCash', jazzcash.enabled(), jazzcash.enabled(), 'Code-complete; verify against the JazzCash sandbox before going live (docs/payments.md)')}{row('Easypaisa', false, false, easypaisa.disabledReason)}{row('Cash / bank deposit', true, true, 'Recorded manually at the counter')}</tbody></TableWrap></Card>
      <Card><CardHeader title="Other" /><TableWrap><tbody>{row('AI assistant (Anthropic)', Boolean(process.env.ANTHROPIC_API_KEY))}{row('Web push (VAPID keys)', Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), false, 'Service worker is ready; sending push needs a web-push sender — see README')}{row('Scheduled dispatch (CRON_SECRET)', (process.env.CRON_SECRET ?? '').length >= 24, false, 'Call /api/cron/dispatch every few minutes')}</tbody></TableWrap></Card>
      <Card><CardHeader title="Which messages go out, and how" /><CardBody><fieldset disabled={!can(ctx, 'settings.edit')}><NotificationSettings v={(data?.value ?? {}) as never} /></fieldset></CardBody></Card>
    </div></>);
}
