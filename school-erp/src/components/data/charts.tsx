import { cn } from '@/components/ui/cn';

export interface Point { label: string; value: number }
const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** Accessible, text-crisp bar chart built from HTML (no distortion on phones). */
export function BarChart({ data, title, format = compact, tone = 'brand', empty = 'No data yet' }: {
  data: Point[]; title: string; format?: (n: number) => string; tone?: 'brand' | 'warn' | 'info'; empty?: string;
}) {
  if (!data.length || data.every((d) => d.value === 0)) return <p className="grid h-40 place-items-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const color = tone === 'warn' ? 'var(--chart-2)' : tone === 'info' ? 'var(--chart-3)' : 'var(--chart-1)';
  return (
    <figure role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`} className="scroll-x">
      <div className="flex h-44 items-end gap-1.5 border-b border-line pt-6" style={{ minWidth: Math.max(data.length * 34, 0) }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="tabular mb-1 text-center text-[11px] leading-none text-muted">{format(d.value)}</span>
            <div className="w-full rounded-t-md transition-[height]" style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%`, background: color }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 pt-1.5" style={{ minWidth: Math.max(data.length * 34, 0) }}>
        {data.map((d) => <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted" title={d.label}>{d.label}</span>)}
      </div>
    </figure>
  );
}

/** Two series per category (e.g. income vs expense). */
export function GroupedBars({ data, series, title, format = compact }: {
  data: { label: string; a: number; b: number }[]; series: [string, string]; title: string; format?: (n: number) => string;
}) {
  if (!data.length || data.every((d) => d.a === 0 && d.b === 0)) return <p className="grid h-40 place-items-center text-sm text-muted">No data yet</p>;
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  return (
    <figure role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${series[0]} ${format(d.a)}, ${series[1]} ${format(d.b)}`).join('; ')}`}>
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: 'var(--chart-1)' }} />{series[0]}</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: 'var(--chart-2)' }} />{series[1]}</span>
      </div>
      <div className="flex h-40 items-end gap-3 border-b border-line">
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 items-end justify-center gap-1">
            <div title={`${series[0]} ${format(d.a)}`} className="w-full max-w-5 rounded-t-md" style={{ height: `${(d.a / max) * 100}%`, background: 'var(--chart-1)' }} />
            <div title={`${series[1]} ${format(d.b)}`} className="w-full max-w-5 rounded-t-md" style={{ height: `${(d.b / max) * 100}%`, background: 'var(--chart-2)' }} />
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-1.5">{data.map((d) => <span key={d.label} className="flex-1 text-center text-[11px] text-muted">{d.label}</span>)}</div>
    </figure>
  );
}

export function LineChart({ data, title, suffix = '', min = 0, max = 100 }: { data: Point[]; title: string; suffix?: string; min?: number; max?: number }) {
  if (data.length < 2) return <p className="grid h-40 place-items-center text-sm text-muted">Not enough data yet</p>;
  const w = 100, h = 40, pad = 3;
  const xs = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const ys = (v: number) => h - pad - ((Math.min(Math.max(v, min), max) - min) / (max - min || 1)) * (h - pad * 2);
  const pts = data.map((d, i) => `${xs(i).toFixed(2)},${ys(d.value).toFixed(2)}`);
  const last = data[data.length - 1]!;
  return (
    <figure role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}${suffix}`).join(', ')}`}>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-40 w-full overflow-visible">
          {[0, 0.5, 1].map((g) => <line key={g} x1="0" x2={w} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke="var(--chart-grid)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
          <polyline points={`${xs(0)},${h - pad} ${pts.join(' ')} ${xs(data.length - 1)},${h - pad}`} fill="var(--chart-1)" opacity="0.12" />
          <polyline points={pts.join(' ')} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="tabular absolute end-0 top-0 rounded-md bg-surface/90 px-1.5 text-xs font-semibold" style={{ color: 'var(--chart-1)' }}>{last.value}{suffix}</span>
      </div>
      <div className="flex justify-between pt-1 text-[11px] text-muted"><span>{data[0]!.label}</span><span>{last.label}</span></div>
    </figure>
  );
}

/** Horizontal share bars — good for class-wise distribution on narrow screens. */
export function HBars({ data, format = compact, tone = 'brand' }: { data: Point[]; format?: (n: number) => string; tone?: 'brand' | 'warn' }) {
  if (!data.length) return <p className="grid h-24 place-items-center text-sm text-muted">No data yet</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted" title={d.label}>{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2"><span className={cn('block h-full rounded-full')} style={{ width: `${(d.value / max) * 100}%`, background: tone === 'warn' ? 'var(--chart-2)' : 'var(--chart-1)' }} /></span>
          <span className="tabular text-xs font-medium">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}
