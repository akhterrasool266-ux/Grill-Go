import { Badge, statusTone } from '@/components/ui/primitives';
import { fmtDate, fmtDateTime, fmtTime, pkr, titleCase } from '@/lib/format';
import type { ColType } from '@/lib/resources/types';

export function Cell({ type = 'text', value }: { type?: ColType; value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted">—</span>;
  switch (type) {
    case 'money': return <span className="tabular">{pkr(value as number)}</span>;
    case 'number': return <span className="tabular">{String(value)}</span>;
    case 'date': return <>{fmtDate(String(value))}</>;
    case 'datetime': return <>{fmtDateTime(String(value))}</>;
    case 'time': return <>{fmtTime(String(value))}</>;
    case 'bool': return value ? <span className="text-ok" aria-label="Yes">✓</span> : <span className="text-muted" aria-label="No">—</span>;
    case 'badge': return typeof value === 'boolean' ? (value ? <Badge tone="ok">Current</Badge> : <span className="text-muted">—</span>) : <Badge tone={statusTone(String(value))}>{titleCase(String(value))}</Badge>;
    default: return <>{String(value)}</>;
  }
}
