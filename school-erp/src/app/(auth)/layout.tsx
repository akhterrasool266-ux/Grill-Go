import { getT } from '@/lib/i18n';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-brand p-12 text-brand-fg lg:flex">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white/15 text-lg font-bold">S</span><span className="text-lg font-semibold">{t('app.name')}</span></div>
        <div className="max-w-md space-y-4">
          <p className="text-3xl font-semibold leading-tight">{t('auth.tagline')}</p>
          <p className="text-sm opacity-80">Admissions · Attendance · Fees · Exams · Payroll · Parent portal — for single schools and multi-campus groups.</p>
        </div>
        <p className="text-xs opacity-70">PKR · Asia/Karachi · English / اردو</p>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-sm">{children}</div></div>
    </div>
  );
}
