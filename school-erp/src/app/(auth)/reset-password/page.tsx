import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { updatePassword } from '@/app/actions/auth';
import { ActionForm, SubmitButton, TextField } from '@/components/ui/action-form';
import { getIdentity } from '@/lib/auth/session';
import { getT } from '@/lib/i18n';

export const metadata: Metadata = { title: 'New password' };

export default async function ResetPage() {
  const { t } = await getT();
  if (!(await getIdentity())) redirect('/login?error=link_expired');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('auth.newPassword')}</h1>
      <ActionForm action={updatePassword}>
        <TextField name="password" type="password" label={t('auth.newPassword')} autoComplete="new-password" hint="At least 10 characters, with a letter and a number." />
        <TextField name="confirm" type="password" label="Confirm password" autoComplete="new-password" />
        <SubmitButton className="w-full" size="lg">{t('common.save')}</SubmitButton>
      </ActionForm>
    </div>
  );
}
