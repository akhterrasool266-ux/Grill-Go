export function pkr(n: number | string | null | undefined, opts: { symbol?: boolean; decimals?: number } = {}): string {
  const v = Number(n ?? 0);
  const s = new Intl.NumberFormat('en-PK', { minimumFractionDigits: opts.decimals ?? 0, maximumFractionDigits: opts.decimals ?? 0 }).format(Math.abs(v));
  return `${v < 0 ? '−' : ''}${opts.symbol === false ? '' : 'Rs '}${s}`;
}

export function fmtDate(d: string | Date | null | undefined, style: 'short' | 'long' = 'short'): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  if (style === 'long') return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' });
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
}
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' });
}
export function fmtTime(t: string | null | undefined): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ap = (h ?? 0) >= 12 ? 'pm' : 'am';
  return `${((h ?? 0) % 12) || 12}:${String(m ?? 0).padStart(2, '0')} ${ap}`;
}
export const pct = (n: number | string | null | undefined, d = 1) => (n == null ? '—' : `${Number(n).toFixed(d).replace(/\.0+$/, '')}%`);

/** Today in the school's timezone as YYYY-MM-DD. */
export function todayISO(tz = 'Asia/Karachi'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const monthStart = (iso: string) => iso.slice(0, 7) + '-01';
export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

/** Safe `.ilike` pattern from user input. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_,()]/g, ' ').trim()}%`;
