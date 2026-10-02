import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ctx } from '@/lib/auth/session';
import { can } from '@/lib/auth/session';
import { fmtDate, pct, pkr, titleCase, todayISO } from '@/lib/format';

export type Cell = string | number | null;
export interface ReportResult { columns: string[]; rows: Cell[][]; summary?: [string, string][]; numericFrom?: number }
export interface ReportParams { campus: string | null; from: string; to: string; month: string; exam?: string; date: string }
export interface ReportDef {
  slug: string; title: string; description: string; group: 'People' | 'Academics' | 'Money' | 'Operations';
  perms: string[]; financial?: boolean; params: ('range' | 'month' | 'exam' | 'date')[];
  run: (sb: SupabaseClient, p: ReportParams, ctx: Ctx) => Promise<ReportResult>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eqCampus = (q: any, p: ReportParams) => (p.campus ? q.eq('campus_id', p.campus) : q);

export const REPORTS: ReportDef[] = [
  { slug: 'students', title: 'Student strength', description: 'Active students per class and section, by gender.', group: 'People', perms: ['students.view'], params: [],
    async run(sb, p) {
      const { data } = await eqCampus(sb.from('students').select('gender,classes(name,level),sections(name)').eq('status', 'active').limit(20000), p);
      const m = new Map<string, { lvl: number; cls: string; sec: string; m: number; f: number; o: number }>();
      for (const s of (data ?? []) as any[]) { const k = `${s.classes?.name}|${s.sections?.name}`; const e = m.get(k) ?? { lvl: s.classes?.level ?? 0, cls: s.classes?.name ?? '—', sec: s.sections?.name ?? '—', m: 0, f: 0, o: 0 }; if (s.gender === 'male') e.m++; else if (s.gender === 'female') e.f++; else e.o++; m.set(k, e); }
      const rows = [...m.values()].sort((a, b) => a.lvl - b.lvl || a.sec.localeCompare(b.sec));
      return { columns: ['Class', 'Section', 'Boys', 'Girls', 'Other', 'Total'], rows: rows.map((r) => [r.cls, r.sec, r.m, r.f, r.o, r.m + r.f + r.o]), numericFrom: 2, summary: [['Total students', String(rows.reduce((a, r) => a + r.m + r.f + r.o, 0))]] };
    } },
  { slug: 'admissions', title: 'Admissions & conversion', description: 'Enquiries, applications, stages and conversion rate.', group: 'People', perms: ['admissions.view'], params: ['range'],
    async run(sb, p) {
      const { data } = await sb.rpc('admission_funnel', { p_campus: p.campus, p_from: p.from, p_to: p.to });
      const d = data as { enquiries: number; converted_enquiries: number; applications: number; by_stage: { label: string; value: number }[]; by_source: { label: string; value: number }[] };
      const adm = d.by_stage.find((x) => x.label === 'admitted')?.value ?? 0;
      return { columns: ['Group', 'Item', 'Count'], numericFrom: 2, rows: [...d.by_stage.map((x) => ['Application stage', titleCase(x.label), x.value] as Cell[]), ...d.by_source.map((x) => ['Enquiry source', titleCase(x.label), x.value] as Cell[])],
        summary: [['Enquiries', String(d.enquiries)], ['Applications', String(d.applications)], ['Admitted', String(adm)], ['Enquiry → admission', d.enquiries ? pct((100 * d.converted_enquiries) / d.enquiries) : '—']] };
    } },
  { slug: 'attendance', title: 'Attendance summary', description: 'Class-wise attendance percentage for a period.', group: 'Academics', perms: ['attendance.view'], params: ['range'],
    async run(sb, p) {
      const { data } = await sb.rpc('attendance_summary', { p_campus: p.campus, p_from: p.from, p_to: p.to, p_class: null, p_section: null });
      const m = new Map<string, { pres: number; abs: number; late: number; n: number; stud: number }>();
      for (const r of (data ?? []) as any[]) { const k = `${r.class_name} ${r.section_name}`; const e = m.get(k) ?? { pres: 0, abs: 0, late: 0, n: 0, stud: 0 }; e.pres += r.present + r.late + r.half_day * 0.5; e.abs += r.absent; e.late += r.late; e.n += r.marked_days - r.leave; e.stud++; m.set(k, e); }
      return { columns: ['Section', 'Students', 'Absences', 'Late', 'Attendance %'], numericFrom: 1, rows: [...m.entries()].map(([k, e]) => [k, e.stud, e.abs, e.late, e.n ? Number(((100 * e.pres) / e.n).toFixed(1)) : null]) };
    } },
  { slug: 'absentees', title: 'Chronic absentees', description: 'Students absent on 5 or more days in the period.', group: 'Academics', perms: ['attendance.view'], params: ['range'],
    async run(sb, p) { const { data } = await sb.rpc('chronic_absentees', { p_campus: p.campus, p_from: p.from, p_to: p.to, p_min: 5 }); return { columns: ['Student ID', 'Student', 'Class', 'Section', 'Days absent'], numericFrom: 4, rows: ((data ?? []) as any[]).map((r) => [r.student_code, r.student_name, r.class_name, r.section_name, r.absent_days]) }; } },
  { slug: 'exam-results', title: 'Exam result summary', description: 'Pass percentage and averages per class for an exam.', group: 'Academics', perms: ['results.view'], params: ['exam'],
    async run(sb, p) { if (!p.exam) return { columns: ['Choose an exam'], rows: [] }; const { data } = await sb.rpc('exam_summary', { p_exam: p.exam }); return { columns: ['Class', 'Appeared', 'Passed', 'Failed', 'Incomplete', 'Average %', 'Highest %', 'Lowest %'], numericFrom: 1, rows: ((data ?? []) as any[]).map((r) => [r.class_name, r.appeared, r.passed, r.failed, r.incomplete, r.avg_percentage, r.highest, r.lowest]) }; } },
  { slug: 'teachers', title: 'Teacher report', description: 'Teachers with their classes, subjects and weekly periods.', group: 'Academics', perms: ['staff.view'], params: [],
    async run(sb, p) {
      const [{ data: st }, { data: ta }, { data: tt }] = await Promise.all([eqCampus(sb.from('staff').select('id,full_name,employee_code,designations(name)').eq('status', 'active'), p), sb.from('teacher_assignments').select('staff_id,is_class_teacher,sections(name,classes(name)),subjects(name)'), sb.from('timetable_entries').select('staff_id')]);
      return { columns: ['ID', 'Name', 'Designation', 'Class teacher of', 'Subjects', 'Periods / week'], rows: ((st ?? []) as any[]).map((s) => { const mine = ((ta ?? []) as any[]).filter((a) => a.staff_id === s.id); return [s.employee_code, s.full_name, s.designations?.name ?? '', mine.filter((a) => a.is_class_teacher).map((a) => `${a.sections?.classes?.name} ${a.sections?.name}`).join(', '), [...new Set(mine.map((a) => a.subjects?.name).filter(Boolean))].join(', '), ((tt ?? []) as any[]).filter((t) => t.staff_id === s.id).length]; }) };
    } },
  { slug: 'fee-collection', title: 'Fee collection', description: 'Daily and method-wise collection for a period.', group: 'Money', perms: ['payments.view'], params: ['range'],
    async run(sb, p) {
      const { data } = await sb.rpc('collection_report', { p_campus: p.campus, p_from: p.from, p_to: p.to });
      const d = data as { by_day: { date: string; value: number }[]; by_method: { label: string; value: number }[]; total: number; count: number };
      return { columns: ['Group', 'Item', 'Amount (PKR)'], numericFrom: 2, rows: [...d.by_method.map((x) => ['Method', titleCase(x.label), x.value] as Cell[]), ...d.by_day.map((x) => ['Day', fmtDate(x.date), x.value] as Cell[])], summary: [['Total collected', pkr(d.total)], ['Receipts', String(d.count)]] };
    } },
  { slug: 'outstanding', title: 'Outstanding fees', description: 'Unpaid balance by class.', group: 'Money', perms: ['fees.view'], params: [],
    async run(sb, p) {
      const { data } = await eqCampus(sb.from('fee_invoices').select('balance,due_date,students(classes(name,level))').in('status', ['unpaid', 'partial']).gt('balance', 0).limit(20000), p);
      const m = new Map<string, { lvl: number; total: number; overdue: number; n: number }>(); const today = todayISO();
      for (const i of (data ?? []) as any[]) { const k = i.students?.classes?.name ?? '—'; const e = m.get(k) ?? { lvl: i.students?.classes?.level ?? 0, total: 0, overdue: 0, n: 0 }; e.total += Number(i.balance); if (i.due_date < today) e.overdue += Number(i.balance); e.n++; m.set(k, e); }
      const rows = [...m.entries()].sort((a, b) => a[1].lvl - b[1].lvl);
      return { columns: ['Class', 'Vouchers', 'Outstanding (PKR)', 'Of which overdue (PKR)'], numericFrom: 1, rows: rows.map(([k, e]) => [k, e.n, e.total, e.overdue]), summary: [['Total outstanding', pkr(rows.reduce((a, [, e]) => a + e.total, 0))]] };
    } },
  { slug: 'defaulters', title: 'Defaulters', description: 'Students with overdue vouchers.', group: 'Money', perms: ['fees.view'], params: [],
    async run(sb, p) { const { data } = await sb.rpc('fee_defaulters', { p_campus: p.campus }); return { columns: ['Student ID', 'Student', 'Class', 'Parent', 'Phone', 'Overdue (PKR)', 'Vouchers', 'Last payment'], numericFrom: 5, rows: ((data ?? []) as any[]).map((r) => [r.student_code, r.student_name, `${r.class_name ?? ''} ${r.section_name ?? ''}`, r.guardian_name, r.guardian_phone, r.outstanding, r.overdue_invoices, r.last_payment_date]) }; } },
  { slug: 'expenses', title: 'Expense report', description: 'Paid expenses by category.', group: 'Money', perms: ['finance.view'], financial: true, params: ['range'],
    async run(sb, p) {
      const { data } = await eqCampus(sb.from('expenses').select('amount,expense_date,expense_categories(name)').eq('status', 'paid').gte('paid_on', p.from).lte('paid_on', p.to).limit(20000), p);
      const m = new Map<string, { t: number; n: number }>(); for (const e of (data ?? []) as any[]) { const k = e.expense_categories?.name ?? 'Uncategorised'; const x = m.get(k) ?? { t: 0, n: 0 }; x.t += Number(e.amount); x.n++; m.set(k, x); }
      const rows = [...m.entries()].sort((a, b) => b[1].t - a[1].t);
      return { columns: ['Category', 'Entries', 'Amount (PKR)'], numericFrom: 1, rows: rows.map(([k, x]) => [k, x.n, x.t]), summary: [['Total expenses', pkr(rows.reduce((a, [, x]) => a + x.t, 0))]] };
    } },
  { slug: 'income-statement', title: 'Income statement', description: 'Fee income less expenses and salaries for a period (cash basis).', group: 'Money', perms: ['finance.view'], financial: true, params: ['range'],
    async run(sb, p) {
      const { data } = await eqCampus(sb.from('transactions').select('direction,amount,source_type').gte('txn_date', p.from).lte('txn_date', p.to).limit(50000), p);
      const sum = (f: (t: any) => boolean) => ((data ?? []) as any[]).filter(f).reduce((a, t) => a + Number(t.amount), 0);
      const fees = sum((t) => t.source_type === 'payment'), refunds = sum((t) => t.source_type === 'refund'), exp = sum((t) => t.source_type === 'expense'), pay = sum((t) => t.source_type === 'payroll'), other = sum((t) => t.direction === 'in' && t.source_type !== 'payment');
      const net = fees + other - refunds - exp - pay;
      return { columns: ['Line', 'Amount (PKR)'], numericFrom: 1, rows: [['Fee income', fees], ['Other income', other], ['Less: refunds', -refunds], ['Less: operating expenses', -exp], ['Less: salaries', -pay], ['Net surplus / (deficit)', net]], summary: [['Net', pkr(net)]] };
    } },
  { slug: 'payroll', title: 'Salary & payroll report', description: 'Net salaries paid per month.', group: 'Money', perms: ['payroll.view'], financial: true, params: ['range'],
    async run(sb, p) { const { data } = await eqCampus(sb.from('payroll_runs').select('month,status,total_gross,total_deductions,total_net').gte('month', p.from.slice(0, 7) + '-01').lte('month', p.to).order('month'), p); return { columns: ['Month', 'Status', 'Gross', 'Deductions', 'Net'], numericFrom: 2, rows: ((data ?? []) as any[]).map((r) => [new Date(r.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), titleCase(r.status), r.total_gross, r.total_deductions, r.total_net]) }; } },
  { slug: 'transport', title: 'Transport report', description: 'Routes, vehicles and riders.', group: 'Operations', perms: ['transport.view'], params: [],
    async run(sb, p) {
      const [{ data: r }, { data: a }] = await Promise.all([eqCampus(sb.from('routes').select('id,name,monthly_fee,vehicles(reg_no,capacity),drivers(full_name)'), p), eqCampus(sb.from('student_transport').select('route_id').eq('is_active', true), p)]);
      return { columns: ['Route', 'Vehicle', 'Driver', 'Riders', 'Seats', 'Monthly fee'], numericFrom: 3, rows: ((r ?? []) as any[]).map((x) => [x.name, x.vehicles?.reg_no ?? '', x.drivers?.full_name ?? '', ((a ?? []) as any[]).filter((y) => y.route_id === x.id).length, x.vehicles?.capacity ?? null, x.monthly_fee]) };
    } },
  { slug: 'library', title: 'Library report', description: 'Books currently out, overdue first.', group: 'Operations', perms: ['library.view'], params: [],
    async run(sb, p) { const { data } = await eqCampus(sb.from('library_transactions').select('due_on,library_books(title),students(full_name),staff(full_name)').eq('status', 'issued').order('due_on'), p); const t = todayISO(); return { columns: ['Book', 'Borrower', 'Due', 'Days overdue'], numericFrom: 3, rows: ((data ?? []) as any[]).map((x) => [x.library_books?.title, x.students?.full_name ?? x.staff?.full_name, fmtDate(x.due_on), x.due_on < t ? Math.round((Date.parse(t) - Date.parse(x.due_on)) / 86400000) : 0]) }; } },
  { slug: 'campus-comparison', title: 'Campus comparison', description: 'Students, staff, collection, outstanding and attendance by campus.', group: 'Operations', perms: ['reports.view'], params: ['range'],
    async run(sb, p) { const { data } = await sb.rpc('campus_comparison', { p_from: p.from, p_to: p.to }); return { columns: ['Campus', 'Students', 'Staff', 'Collected (PKR)', 'Outstanding (PKR)', 'Attendance %', 'Expenses (PKR)'], numericFrom: 1, rows: ((data ?? []) as any[]).map((r) => [r.campus_name, r.students, r.staff, r.collected, r.outstanding, r.attendance_pct, r.expenses]) }; } },
  { slug: 'daily-activity', title: 'Daily activity', description: 'Everything that happened at school on a given day.', group: 'Operations', perms: ['reports.view'], params: ['date'],
    async run(sb, p) {
      const { data } = await sb.rpc('daily_activity', { p_campus: p.campus, p_date: p.date });
      const d = data as any;
      return { columns: ['Item', 'Value'], rows: [['Fee receipts', d.payments.count], ['Fee collected (PKR)', d.payments.amount], ['New students', d.new_students], ['Admission applications', d.applications], ['Enquiries', d.enquiries], ['Attendance marked', d.attendance.marked], ['Students absent', d.attendance.absent], ['Students late', d.attendance.late], ['Staff absent', d.staff_absent], ['Expenses paid (PKR)', d.expenses.amount], ['Messages queued', d.messages.queued], ['Messages sent', d.messages.sent], ['Messages failed', d.messages.failed]] };
    } },
];

export const reportsFor = (ctx: Ctx) => REPORTS.filter((r) => can(ctx, ...r.perms) && (!r.financial || can(ctx, 'financial.access')));
export const findReport = (slug: string) => REPORTS.find((r) => r.slug === slug);
