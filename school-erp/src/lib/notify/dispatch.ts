import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { providerFor } from './registry';
import { renderTemplate, toE164Pk } from './render';
import type { Channel } from './types';

interface Row { id: string; school_id: string; channel: Channel; to_address: string; template_key: string | null; language: 'en' | 'ur'; subject: string | null; body: string | null; meta: Record<string, string> }

/**
 * Sends queued messages. Honest by construction:
 *  - no provider configured  → status 'failed' with a clear reason (never "sent")
 *  - provider accepted it    → status 'sent' (delivery is confirmed later by the provider's webhook)
 *  - plan limit reached      → left queued, reported
 */
export async function dispatchQueued(opts: { school?: string; limit?: number } = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_notifications', { p_limit: opts.limit ?? 25, p_school: opts.school ?? null });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const out = { claimed: rows.length, sent: 0, failed: 0, deferred: 0 };
  const tplCache = new Map<string, { body: string; subject: string | null; provider_template: string | null } | null>();

  for (const r of rows) {
    const fail = async (msg: string, provider = 'none') => { out.failed++; await admin.rpc('finish_notification', { p_id: r.id, p_status: 'failed', p_provider: provider, p_error: msg }); };
    const provider = providerFor(r.channel);
    if (!provider) { await fail(`provider_not_configured: ${r.channel}`); continue; }

    const metric = r.channel === 'sms' ? 'sms' : r.channel === 'whatsapp' ? 'whatsapp_messages' : null;
    if (metric) {
      const { data: ok } = await admin.rpc('within_limit', { p_school: r.school_id, p_metric: metric, p_needed: 1 });
      if (ok === false) { out.deferred++; await admin.rpc('finish_notification', { p_id: r.id, p_status: 'failed', p_provider: provider.id, p_error: `provider_not_configured: plan limit for ${metric} reached` }); continue; }
    }

    let body = r.body, subject = r.subject, providerTemplate: string | null = null;
    if (r.template_key) {
      const ck = `${r.school_id}|${r.template_key}|${r.channel}|${r.language}`;
      if (!tplCache.has(ck)) {
        const { data: t } = await admin.from('notification_templates').select('body,subject,provider_template,language').eq('school_id', r.school_id).eq('key', r.template_key).eq('channel', r.channel).in('language', [r.language, 'en']).eq('is_active', true);
        tplCache.set(ck, ((t ?? []).find((x: { language: string }) => x.language === r.language) ?? (t ?? [])[0] ?? null) as never);
      }
      const t = tplCache.get(ck);
      if (!t && !body) { await fail(`no active template "${r.template_key}" for ${r.channel}`); continue; }
      if (t) { body = body ?? renderTemplate(t.body, r.meta); subject = subject ?? (t.subject ? renderTemplate(t.subject, r.meta) : null); providerTemplate = t.provider_template; }
    }
    const to = r.channel === 'email' ? r.to_address : toE164Pk(r.to_address);
    if (!to) { await fail('invalid_recipient: not a valid Pakistani mobile number'); continue; }

    const res = await provider.send({ channel: r.channel, to, body: body ?? '', subject: subject ?? undefined, language: r.language, providerTemplate, vars: r.meta });
    if (res.ok) {
      out.sent++;
      await admin.rpc('finish_notification', { p_id: r.id, p_status: 'sent', p_provider: provider.id, p_message_id: res.messageId ?? null });
      if (metric) await admin.rpc('bump_usage', { p_school: r.school_id, p_metric: metric, p_n: 1 });
    } else await fail(res.error ?? 'send failed', provider.id);
  }
  return out;
}
