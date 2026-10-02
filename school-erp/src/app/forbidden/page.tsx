import Link from 'next/link';
import { getT } from '@/lib/i18n';

export default async function Forbidden() {
  const { t } = await getT();
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-5xl">🔒</p>
        <h1 className="text-xl font-semibold">{t('state.denied')}</h1>
        <p className="text-sm text-muted">{t('state.deniedHelp')}</p>
        <Link href="/" className="inline-block rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg">{t('nav.home')}</Link>
      </div>
    </div>
  );
}
