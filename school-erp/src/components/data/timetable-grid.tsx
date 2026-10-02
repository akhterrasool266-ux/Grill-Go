import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { fmtTime } from '@/lib/format';

export interface Period { id: string; name: string; start_time: string; end_time: string; is_break: boolean }
export interface Cell { day: number; period_id: string; subject?: string | null; staff?: string | null; room?: string | null; section?: string | null }
export const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat']] as const;

/** Read-only weekly grid; with `editHref` each lesson cell links to its editor. */
export function TimetableGrid({ periods, cells, editHref, activeCell, showSection }: { periods: Period[]; cells: Cell[]; editHref?: (day: number, periodId: string) => string; activeCell?: string; showSection?: boolean }) {
  const at = (d: number, p: string) => cells.find((c) => c.day === d && c.period_id === p);
  return (
    <div className="scroll-x rounded-[14px] border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead><tr><th className="w-28 border-b border-line bg-surface-2/60 p-2.5 text-start text-xs font-semibold uppercase text-muted">Period</th>{DAYS.map(([d, n]) => <th key={d} className="border-b border-line bg-surface-2/60 p-2.5 text-start text-xs font-semibold uppercase text-muted">{n}</th>)}</tr></thead>
        <tbody>
          {periods.map((p) => p.is_break ? (
            <tr key={p.id}><th className="border-b border-line bg-warn-soft/50 p-2 text-start text-xs font-medium text-warn">{p.name}<span className="block font-normal">{fmtTime(p.start_time)}</span></th><td colSpan={6} className="border-b border-line bg-warn-soft/50 p-2 text-center text-xs text-warn">{p.name}</td></tr>
          ) : (
            <tr key={p.id}>
              <th className="border-b border-line p-2.5 text-start text-xs font-medium">{p.name}<span className="block font-normal text-muted">{fmtTime(p.start_time)}–{fmtTime(p.end_time)}</span></th>
              {DAYS.map(([d]) => {
                const c = at(d, p.id);
                const body = c ? <><span className="block font-medium">{c.subject ?? '—'}</span><span className="block text-xs text-muted">{showSection ? c.section : c.staff}{c.room ? ` · ${c.room}` : ''}</span></> : <span className="text-xs text-muted">{editHref ? '+ add' : ''}</span>;
                const cls = cn('block min-h-[3.25rem] rounded-lg p-2', c ? 'bg-brand-soft/60' : editHref ? 'border border-dashed border-line hover:bg-surface-2' : '', activeCell === `${d}:${p.id}` && 'ring-2 ring-brand');
                return <td key={d} className="border-b border-line p-1.5 align-top">{editHref ? <Link href={editHref(d, p.id)} scroll={false} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
