import type { Metadata } from 'next';
import Link from 'next/link';
import { requestReset } from '@/app/actions/auth';
import { ActionForm, SubmitButton, TextField } from '@/components/ui/action-form';
import { getT } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ForgotPage() {
  const { t } = await getT();
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">{t('auth.forgot')}</h1><p className="mt-1 text-sm text-muted">We will email you a link to choose a new password.</p></div>
      <ActionForm action={requestReset}>
        <TextField name="email" type="email" label={t('auth.email')} autoComplete="email" inputMode="email" />
        <SubmitButton className="w-full" size="lg">{t('auth.sendLink')}</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm"><Link href="/login" className="text-brand hover:underline">← {t('auth.signIn')}</Link></p>
    </div>
  );
}
