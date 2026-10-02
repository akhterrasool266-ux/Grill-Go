import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { login } from '@/app/actions/auth';
import { ActionForm, SubmitButton, TextField } from '@/components/ui/action-form';
import { Alert } from '@/components/ui/primitives';
import { configured, getIdentity, homeFor } from '@/lib/auth/session';
import { getT } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const { t } = await getT();
  if (!configured()) {
    return <Alert tone="warn" title="Not configured yet">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example and the README), then reload.</Alert>;
  }
  const id = await getIdentity();
  if (id?.profile) redirect(homeFor({ roles: id.roles, permissions: id.permissions }));
  if (id?.platform_admin) redirect('/platform');
  const errors: Record<string, string> = {
    no_profile: 'Your login is not linked to a school yet. Ask your administrator to finish setting up your account.',
    link_expired: 'That link has expired. Please request a new one.',
  };
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">{t('auth.welcome')}</h1><p className="mt-1 text-sm text-muted">{t('auth.signIn')}</p></div>
      {sp.error && errors[sp.error] && <Alert tone="warn">{errors[sp.error]}</Alert>}
      <ActionForm action={login}>
        <input type="hidden" name="next" value={sp.next ?? ''} />
        <TextField name="email" type="email" label={t('auth.email')} autoComplete="username" inputMode="email" autoFocus />
        <TextField name="password" type="password" label={t('auth.password')} autoComplete="current-password" />
        <SubmitButton className="w-full" size="lg" pendingText="…">{t('auth.signIn')}</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm"><Link href="/forgot-password" className="text-brand hover:underline">{t('auth.forgot')}</Link></p>
    </div>
  );
}
