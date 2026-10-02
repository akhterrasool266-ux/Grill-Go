import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart, GroupedBars, HBars, LineChart } from '@/components/data/charts';
import { DashboardCustomize } from '@/components/data/dashboard-customize';
import { Icon, type IconName } from '@/components/ui/icon';
import { Card, CardBody, CardHeader, PageHeader, Stat, Badge } from '@/components/ui/primitives';
import { can, currentCampus, homeFor, requireUser } from '@/lib/auth/session';
import { fmtDate, pkr, todayISO } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dashboard' };

type Stats = Partial<Record<'total_students' | 'active_students' | 'new_admissions' | 'total_staff' | 'present_today' | 'absent_today' | 'late_today' | 'fee_collected_today' | 'fee_collected_month' | 'outstanding_fees' | 'defaulters' | 'upcoming_exams' | 'upcoming_events', number>>;
type Series = Partial<Record<'monthly_collection' | 'outstanding_by_class' | 'attendance_trend' | 'admissions_trend' | 'class_distribution', { label: string; value: number }[]>> & { income_vs_expense?: { label: string; income: number; expense: number }[] };

export default async function DashboardPage() {
  const ctx = await requireUser();
  if (homeFor(ctx) !== '/dashboard') redirect(homeFor(ctx));
  const { t } = await getT();
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const today = todayISO();
  const [{ data: stats }, { data: series }, events, exams] = await Promise.all([
    sb.rpc('dashboard_stats', { p_campus: campus }),
    sb.rpc('dashboard_series', { p_campus: campus }),
    sb.from('calendar_events').select('id,title,kind,start_date').gte('start_date', today).order('start_date').limit(5),
    can(ctx, 'exams.view') ? sb.from('exams').select('id,name,start_date,status').neq('status', 'draft').gte('start_date', today).order('start_date').limit(4) : Promise.resolve({ data: [] as { id: string; name: string; start_date: string; status: string }[] }),
  ]);
  const s = (stats ?? {}) as Stats;
  const c = (series ?? {}) as Series;
  const hidden = (ctx.profile.preferences.dashboard_hidden as string[] | undefined) ?? [];
  const show = (id: string) => !hidden.includes(id);

  const cards: { id: string; label: string; value: string; href?: string; tone?: 'bad' | 'ok' | 'warn' }[] = [];
  const num = (k: keyof Stats) => (s[k] ?? undefined);
  const add = (id: keyof Stats, label: string, fmt: (n: number) => string, href?: string, tone?: 'bad' | 'ok' | 'warn') => { const v = num(id); if (v !== undefined) cards.push({ id, label, value: fmt(v), href, tone }); };
  const n = (v: number) => v.toLocaleString('en-PK');
  add('total_students', t('dash.totalStudents'), n, '/students');
  add('active_students', t('dash.activeStudents'), n, '/students?status=active');
  add('new_admissions', t('dash.newAdmissions'), n, '/admissions');
  add('total_staff', t('dash.totalStaff'), n, '/staff');
  add('present_today', t('dash.presentToday'), n, '/attendance/report', 'ok');
  add('absent_today', t('dash.absentToday'), n, '/attendance/report', 'bad');
  add('late_today', t('dash.lateToday'), n, '/attendance/report', 'warn');
  add('fee_collected_today', t('dash.collectedToday'), (v) => pkr(v), '/fees/receipts');
  add('fee_collected_month', t('dash.collectedMonth'), (v) => pkr(v), '/fees/receipts');
  add('outstanding_fees', t('dash.outstanding'), (v) => pkr(v), '/fees/invoices?status=unpaid', 'warn');
  add('defaulters', t('dash.defaulters'), n, '/fees/defaulters', 'bad');
  add('upcoming_exams', t('dash.upcomingExams'), n, '/exams');
  add('upcoming_events', t('dash.upcomingEvents'), n, '/calendar');

  const quickAll: { href: string; label: string; icon: IconName; perm: string }[] = [
    { href: '/students/new', label: t('qa.addStudent'), icon: 'UserPlus', perm: 'students.create' },
    { href: '/admissions/new', label: t('qa.newAdmission'), icon: 'Inbox', perm: 'admissions.create' },
    { href: '/fees/collect', label: t('qa.collectFee'), icon: 'Banknote', perm: 'payments.create' },
    { href: '/attendance', label: t('qa.markAttendance'), icon: 'ClipboardCheck', perm: 'attendance.create' },
    { href: '/exams/new', label: t('qa.createExam'), icon: 'GraduationCap', perm: 'exams.create' },
    { href: '/exams', label: t('qa.enterMarks'), icon: 'Pencil', perm: 'marks.create' },
    { href: '/announcements/new', label: t('qa.sendAnnouncement'), icon: 'Megaphone', perm: 'announcements.create' },
    { href: '/staff/new', label: t('qa.addStaff'), icon: 'BriefcaseBusiness', perm: 'staff.create' },
  ];
  const quick = quickAll.filter((q) => can(ctx, q.perm));

  const widgetList = [
    ...cards.map((x) => ({ id: x.id, label: x.label })),
    ...(c.monthly_collection ? [{ id: 'chart_collection', label: t('dash.monthlyCollection') }] : []),
    ...(c.attendance_trend ? [{ id: 'chart_attendance', label: t('dash.attendanceTrend') }] : []),
    ...(c.admissions_trend ? [{ id: 'chart_admissions', label: t('dash.admissionsTrend') }] : []),
    ...(c.class_distribution ? [{ id: 'chart_classes', label: t('dash.classDistribution') }] : []),
    ...(c.outstanding_by_class ? [{ id: 'chart_outstanding', label: t('dash.outstandingByClass') }] : []),
    ...(c.income_vs_expense ? [{ id: 'chart_income', label: t('dash.incomeExpense') }] : []),
  ];

  return (
    <>
      <PageHeader title={t('dash.title')} description={`${ctx.school.name}${campus ? ' · ' + (ctx.campuses.find((x) => x.id === campus)?.name ?? '') : ''}`}
        actions={<DashboardCustomize widgets={widgetList} hidden={hidden} label={t('dash.customize')} />} />

      {quick.length > 0 && (
        <section aria-label={t('dash.quick')} className="mb-5">
          <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0"><div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
            {quick.map((q) => (
              <Link key={q.href + q.label} href={q.href} className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-sm font-medium hover:border-brand/50 hover:bg-brand-soft">
                <Icon name={q.icon} className="size-4 text-brand" />{q.label}
              </Link>
            ))}
          </div></div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {cards.filter((x) => show(x.id)).map((x) => <Stat key={x.id} label={x.label} value={x.value} href={x.href} tone={x.tone} />)}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {c.monthly_collection && show('chart_collection') && (
          <Card><CardHeader title={t('dash.monthlyCollection')} /><CardBody><BarChart title={t('dash.monthlyCollection')} data={c.monthly_collection} format={(v) => pkr(v, { symbol: false }).replace(/(\d)(?=(\d{3})+$)/g, '$1')} /></CardBody></Card>
        )}
        {c.attendance_trend && show('chart_attendance') && (
          <Card><CardHeader title={t('dash.attendanceTrend')} /><CardBody><LineChart title={t('dash.attendanceTrend')} data={c.attendance_trend} suffix="%" min={50} max={100} /></CardBody></Card>
        )}
        {c.admissions_trend && show('chart_admissions') && (
          <Card><CardHeader title={t('dash.admissionsTrend')} /><CardBody><BarChart title={t('dash.admissionsTrend')} data={c.admissions_trend} tone="info" format={(v) => String(v)} /></CardBody></Card>
        )}
        {c.class_distribution && show('chart_classes') && (
          <Card><CardHeader title={t('dash.classDistribution')} /><CardBody><HBars data={c.class_distribution} format={(v) => String(v)} /></CardBody></Card>
        )}
        {c.outstanding_by_class && show('chart_outstanding') && (
          <Card><CardHeader title={t('dash.outstandingByClass')} /><CardBody><HBars data={c.outstanding_by_class} tone="warn" format={(v) => pkr(v)} /></CardBody></Card>
        )}
        {c.income_vs_expense && show('chart_income') && (
          <Card><CardHeader title={t('dash.incomeExpense')} /><CardBody><GroupedBars title={t('dash.incomeExpense')} series={['Income', 'Expense']} data={c.income_vs_expense.map((r) => ({ label: r.label, a: r.income, b: r.expense }))} /></CardBody></Card>
        )}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('dash.upcomingEvents')} action={<Link href="/calendar" className="text-sm text-brand hover:underline">{t('common.view')}</Link>} />
          <ul className="divide-y divide-line">
            {(events.data ?? []).length === 0 && <li className="px-5 py-6 text-sm text-muted">{t('dash.noData')}</li>}
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span className="min-w-0 truncate font-medium">{e.title}</span><span className="flex shrink-0 items-center gap-2 text-muted"><Badge tone={e.kind === 'holiday' ? 'warn' : 'brand'}>{e.kind}</Badge>{fmtDate(e.start_date)}</span></li>
            ))}
          </ul>
        </Card>
        {can(ctx, 'exams.view') && (
          <Card>
            <CardHeader title={t('dash.upcomingExams')} action={<Link href="/exams" className="text-sm text-brand hover:underline">{t('common.view')}</Link>} />
            <ul className="divide-y divide-line">
              {(exams.data ?? []).length === 0 && <li className="px-5 py-6 text-sm text-muted">{t('dash.noData')}</li>}
              {(exams.data ?? []).map((e) => (
                <li key={e.id}><Link href={`/exams/${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface-2"><span className="truncate font-medium">{e.name}</span><span className="text-muted">{fmtDate(e.start_date)}</span></Link></li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
