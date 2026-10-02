import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from './cn';

export function Card({ className, children, ...p }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-[14px] border border-line bg-surface', className)} {...p}>{children}</div>;
}
export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-6">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export const CardBody = ({ className, ...p }: React.ComponentProps<'div'>) => <div className={cn('p-4 sm:p-5', className)} {...p} />;

const tones = {
  neutral: 'bg-surface-2 text-muted', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info', brand: 'bg-brand-soft text-brand',
} as const;
export type Tone = keyof typeof tones;
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-ink">← {back.label}</Link>}
        <h1 className="text-[22px] font-semibold leading-8 tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'ok' | 'warn' | 'bad'; title?: string; children?: ReactNode }) {
  const map = { info: 'bg-info-soft text-info', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad' } as const;
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cn('rounded-[10px] px-4 py-3 text-sm', map[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone, href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; href?: string }) {
  const body = (
    <div className="flex h-full flex-col gap-1 rounded-[14px] border border-line bg-surface p-4 transition-colors hover:border-brand/40">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={cn('tabular whitespace-nowrap text-xl font-semibold tracking-tight sm:text-2xl', tone === 'bad' && 'text-bad', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn')}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function DescriptionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-[15px]">{v === null || v === undefined || v === '' ? <span className="text-muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, active }: { tabs: { id: string; label: string; href: string }[]; active: string }) {
  return (
    <div className="no-print scroll-x -mx-4 mb-4 border-b border-line px-4 sm:mx-0 sm:px-0" role="tablist">
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <Link key={t.id} href={t.href} role="tab" aria-selected={t.id === active} scroll={false}
            className={cn('-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap',
              t.id === active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="px-4 py-3 text-xs text-muted">{total} {total === 1 ? 'row' : 'rows'}</p>;
  return (
    <nav className="no-print flex items-center justify-between gap-3 px-4 py-3 text-sm" aria-label="Pagination">
      <span className="text-muted tabular">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2" href={hrefFor(page - 1)} rel="prev">←</Link> : <span className="rounded-lg border border-line px-3 py-1.5 opacity-40">←</span>}
        <span className="px-1 py-1.5 tabular">{page} / {pages}</span>
        {page < pages ? <Link className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2" href={hrefFor(page + 1)} rel="next">→</Link> : <span className="rounded-lg border border-line px-3 py-1.5 opacity-40">→</span>}
      </div>
    </nav>
  );
}

/** Responsive table wrapper: horizontal scroll on phones, sticky header. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="scroll-x"><table className="w-full min-w-[560px] border-collapse text-sm">{children}</table></div>;
}
export const Th = ({ className, ...p }: React.ComponentProps<'th'>) => <th className={cn('whitespace-nowrap border-b border-line bg-surface-2/60 px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-muted first:ps-4 last:pe-4', className)} {...p} />;
export const Td = ({ className, ...p }: React.ComponentProps<'td'>) => <td className={cn('border-b border-line px-3 py-2.5 align-middle first:ps-4 last:pe-4', className)} {...p} />;

export function statusTone(status: string): Tone {
  switch (status) {
    case 'paid': case 'active': case 'present': case 'approved': case 'published': case 'admitted': case 'completed': case 'delivered': case 'pass': case 'sent': case 'returned': return 'ok';
    case 'partial': case 'pending': case 'late': case 'half_day': case 'queued': case 'marks_entry': case 'scheduled': case 'sending': case 'trialing': return 'warn';
    case 'unpaid': case 'overdue': case 'absent': case 'rejected': case 'failed': case 'fail': case 'left': case 'suspended': case 'lost': case 'past_due': return 'bad';
    case 'leave': case 'draft': case 'transferred': case 'graduated': case 'waitlisted': case 'locked': case 'issued': return 'info';
    default: return 'neutral';
  }
}
