import type { ReactNode } from 'react';
import { initials } from '@/lib/format';
import { logoUrl, type SchoolInfo } from '@/lib/school';

/** Branded letterhead used by every printable document (voucher, receipt, result card, payslip, certificates). */
export function Letterhead({ school, title, right }: { school: SchoolInfo; title: string; right?: ReactNode }) {
  const logo = logoUrl(school);
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 border-[#0b6b5f] pb-3">
      <div className="flex items-center gap-3">
        {logo /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={logo} alt="" className="size-14 object-contain" /> : <span className="grid size-14 place-items-center rounded-full bg-[#0b6b5f] text-lg font-bold text-white" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>{initials(school.name)}</span>}
        <div className="leading-tight"><p className="text-lg font-bold">{school.name}</p><p className="text-xs text-neutral-600">{[school.address, school.city].filter(Boolean).join(', ')}</p><p className="text-xs text-neutral-600">{[school.phone, school.email].filter(Boolean).join(' · ')}</p></div>
      </div>
      <div className="text-end"><p className="text-base font-bold uppercase tracking-wide text-[#0b6b5f]">{title}</p>{right}</div>
    </header>
  );
}

export function Sheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`print-sheet mx-auto w-full max-w-[210mm] space-y-4 rounded-[14px] border border-line p-5 shadow-sm sm:p-8 ${className}`}>{children}</article>;
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">{items.map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wide text-neutral-500">{k}</dt><dd className="font-medium">{v ?? '—'}</dd></div>)}</dl>;
}
