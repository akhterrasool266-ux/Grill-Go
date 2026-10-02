import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsHub() {
  const ctx = await requireUser();
  const items: [string, string, string, boolean][] = [
    ['My profile', '/settings/profile', 'Name, language, theme and notification choices', true],
    ['School profile', '/settings/general', 'Name, address, logo, language and date format', can(ctx, 'settings.view')],
    ['Campuses', '/manage/campuses', 'Add and edit campuses / branches', can(ctx, 'campuses.view')],
    ['Academic years & terms', '/manage/academic-years', 'Sessions, terms and which year is current', can(ctx, 'academics.view')],
    ['Fees, attendance, payroll, library', '/settings/operations', 'Late fines, sibling discount, attendance times, overtime…', can(ctx, 'settings.view')],
    ['Document numbering', '/settings/numbering', 'Voucher, receipt, student ID and employee ID formats', can(ctx, 'settings.view')],
    ['Notifications & integrations', '/settings/notifications', 'WhatsApp, SMS, email, payment gateways and AI — status and message rules', can(ctx, 'settings.view')],
    ['Users', '/settings/users', 'Logins, roles, campuses, deactivate, reset password', can(ctx, 'users.view')],
    ['Roles & permissions', '/settings/roles', 'Choose exactly what each role can see and do', can(ctx, 'roles.view')],
    ['Security', '/settings/security', 'Session policy, 2-step verification, audit', can(ctx, 'settings.view')],
    ['Message templates', '/manage/notification-templates', 'English and Urdu wording for WhatsApp / SMS', can(ctx, 'communication.view')],
    ['Grading systems', '/manage/grading-systems', 'Grades, GPA and pass marks', can(ctx, 'exams.view')],
    ['Backup & export', '/settings/backup', 'Export your data; backup guidance', can(ctx, 'settings.manage')],
    ['Subscription & usage', '/settings/billing', 'Plan, limits and usage', can(ctx, 'billing.view')],
    ['Audit log', '/audit', 'Who changed what', can(ctx, 'audit.view')],
  ];
  const list = items.filter((i) => i[3]);
  if (list.length === 0) redirect('/forbidden');
  return (<><PageHeader title="Settings" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map(([t, h, d]) => <Link key={h} href={h} className="rounded-[14px] border border-line bg-surface p-4 hover:border-brand/50 hover:bg-brand-soft/30"><p className="font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></Link>)}</div></>);
}
