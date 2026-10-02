import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { can, type Ctx } from '@/lib/auth/session';

/**
 * Read-only tools the assistant may call. Every tool runs with the *signed-in user's* Supabase client,
 * so Row Level Security and the permission checks inside the RPCs apply exactly as they do on the pages.
 * The `perm` list is a second, earlier gate (so the model is never even offered a tool the user can't use).
 * Tools never write anything.
 */
export interface ToolEnv { sb: SupabaseClient; ctx: Ctx; campus: string | null }
export interface Tool {
  name: string; description: string; perm: string[]; // user needs ANY of these
  input: Record<string, unknown>; // JSON schema "properties"
  run: (env: ToolEnv, args: Record<string, any>) => Promise<unknown>;
  /** plain-text rendering used when no LLM key is configured */
  text: (data: any) => string;
}

const MAX_ROWS = 15;
const money = (n: unknown) => `Rs ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const isoDate = (s: unknown, fallback: string) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const ok = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

export const TOOLS: Tool[] = [
  {
    name: 'school_snapshot', perm: ['students.view', 'fees.view', 'attendance.view'],
    description: 'Headline numbers for today: students, staff, attendance today, fees collected today/this month, outstanding fees, defaulter count, upcoming exams. Only the figures the user is allowed to see are returned.',
    input: {},
    run: async ({ sb, campus }) => ok(await sb.rpc('dashboard_stats', { p_campus: campus })),
    text: (d) => Object.keys(d ?? {}).length === 0 ? 'No figures available for your role.' : [
      d.active_students != null && `Active students: ${d.active_students}`, d.total_staff != null && `Staff: ${d.total_staff}`,
      d.present_today != null && `Today: ${d.present_today} present, ${d.absent_today} absent, ${d.late_today} late`,
      d.fee_collected_today != null && `Fees collected today: ${money(d.fee_collected_today)}; this month: ${money(d.fee_collected_month)}`,
      d.outstanding_fees != null && `Outstanding fees: ${money(d.outstanding_fees)} (${d.defaulters} students past due)`,
      d.upcoming_exams != null && `Exams in the next 14 days: ${d.upcoming_exams}`,
    ].filter(Boolean).join('\n'),
  },
  {
    name: 'fee_defaulters', perm: ['fees.view'],
    description: 'Students with overdue fee balances, largest first. Returns at most 15 rows plus the total count and amount.',
    input: { class_name: { type: 'string', description: 'Optional class name filter, e.g. "Class 5"' } },
    run: async ({ sb, campus }, a) => {
      const amt = (r: any) => Number(r.outstanding ?? 0);
      const rows = (ok(await sb.rpc('fee_defaulters', { p_campus: campus })) ?? []) as any[];
      const f = typeof a.class_name === 'string' ? a.class_name.toLowerCase() : '';
      const list = rows.filter((r) => !f || String(r.class_name ?? '').toLowerCase().includes(f)).sort((x, y) => amt(y) - amt(x));
      return { count: list.length, total: list.reduce((s, r) => s + amt(r), 0), top: list.slice(0, MAX_ROWS).map((r) => ({ code: r.student_code, name: r.student_name, class: r.class_name, section: r.section_name, amount: amt(r), days_overdue: r.max_days_overdue })) };
    },
    text: (d) => `${d.count} students have overdue fees, ${money(d.total)} in total.\n` + d.top.map((r: any, i: number) => `${i + 1}. ${r.name} (${r.code}, ${r.class ?? '—'}) — ${money(r.amount)}`).join('\n'),
  },
  {
    name: 'fee_collection', perm: ['payments.view'],
    description: 'Fee collection between two dates (default: last 7 days): total, by method and by day.',
    input: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } },
    run: async ({ sb, campus }, a) => ok(await sb.rpc('collection_report', { p_campus: campus, p_from: isoDate(a.from, daysAgo(6)), p_to: isoDate(a.to, today()) })),
    text: (d) => `Collected ${money(d?.total)} in the period.\n` + (d?.by_method ?? []).map((m: any) => `• ${m.label}: ${money(m.value)}`).join('\n'),
  },
  {
    name: 'absentees_today', perm: ['attendance.view'],
    description: 'Students marked absent on a date (default today), by class. Max 15 names.',
    input: { date: { type: 'string', description: 'YYYY-MM-DD' } },
    run: async ({ sb, campus }, a) => {
      let q = sb.from('student_attendance').select('students(student_code,full_name)').eq('date', isoDate(a.date, today())).eq('status', 'absent').limit(200);
      if (campus) q = q.eq('campus_id', campus);
      const rows = (ok(await q) ?? []) as any[];
      return { count: rows.length, sample: rows.slice(0, MAX_ROWS).map((r) => ({ code: r.students?.student_code, name: r.students?.full_name })) };
    },
    text: (d) => `${d.count} students absent.\n` + d.sample.map((r: any) => `• ${r.name} (${r.code})`).join('\n'),
  },
  {
    name: 'chronic_absentees', perm: ['attendance.view'],
    description: 'Students absent on 5+ days in the last 30 days.',
    input: {},
    run: async ({ sb, campus }) => {
      if (!campus) return { note: 'Pick a single campus in the top bar first.' };
      const rows = (ok(await sb.rpc('chronic_absentees', { p_campus: campus, p_from: daysAgo(30), p_to: today() })) ?? []) as any[];
      return { count: rows.length, top: rows.slice(0, MAX_ROWS).map((r) => ({ code: r.student_code, name: r.student_name, class: r.class_name, absent_days: r.absent_days })) };
    },
    text: (d) => d.note ?? `${d.count} students with 5+ absences in 30 days.\n` + d.top.map((r: any) => `• ${r.name} (${r.class}) — ${r.absent_days} days`).join('\n'),
  },
  {
    name: 'upcoming_exams', perm: ['exams.view'],
    description: 'Exams starting in the next 30 days.',
    input: {},
    run: async ({ sb, campus }) => {
      let q = sb.from('exams').select('name,exam_type,start_date,end_date,status').neq('status', 'draft').gte('end_date', today()).lte('start_date', daysAgo(-30)).order('start_date').limit(MAX_ROWS);
      if (campus) q = q.eq('campus_id', campus);
      return { exams: ok(await q) ?? [] };
    },
    text: (d) => d.exams.length ? d.exams.map((e: any) => `• ${e.name} — ${e.start_date} to ${e.end_date} (${e.status})`).join('\n') : 'No exams in the next 30 days.',
  },
  {
    name: 'campus_comparison', perm: ['reports.view'],
    description: 'Per-campus students, staff, collection, outstanding, attendance and expenses for the last 30 days. Only campuses the user may access.',
    input: {},
    run: async ({ sb }) => ({ campuses: ok(await sb.rpc('campus_comparison', { p_from: daysAgo(29), p_to: today() })) ?? [] }),
    text: (d) => d.campuses.map((c: any) => `• ${c.campus_name}: ${c.students} students, collected ${money(c.collected)}, outstanding ${money(c.outstanding)}, attendance ${c.attendance_pct ?? '—'}%`).join('\n'),
  },
];

export const toolsFor = (ctx: Ctx) => TOOLS.filter((t) => can(ctx, ...t.perm));
export const QUICK: { id: string; label: string; tool: string }[] = [
  { id: 'snapshot', label: 'Today at a glance', tool: 'school_snapshot' },
  { id: 'defaulters', label: 'Top fee defaulters', tool: 'fee_defaulters' },
  { id: 'collection', label: 'Fees collected (7 days)', tool: 'fee_collection' },
  { id: 'absent', label: 'Absent today', tool: 'absentees_today' },
  { id: 'chronic', label: 'Chronic absentees', tool: 'chronic_absentees' },
  { id: 'exams', label: 'Upcoming exams', tool: 'upcoming_exams' },
  { id: 'campus', label: 'Compare campuses', tool: 'campus_comparison' },
];
