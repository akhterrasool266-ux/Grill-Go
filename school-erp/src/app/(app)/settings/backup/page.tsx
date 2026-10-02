import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { Alert, Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Backup & export' };
const EXPORTS: [string, string][] = [['students', 'Students'], ['guardians', 'Parents / guardians'], ['staff', 'Staff'], ['fee_invoices', 'Fee vouchers'], ['payments', 'Payments / receipts'], ['student_attendance', 'Student attendance'], ['marks', 'Marks'], ['result_cards', 'Result cards'], ['expenses', 'Expenses'], ['admissions', 'Admissions']];

export default async function BackupPage() {
  await requirePerm('settings.manage');
  return (<><PageHeader title="Backup & export" back={{ href: '/settings', label: 'Settings' }} />
    <Alert tone="warn" title="Read this: backups are NOT automatic from this app">This application does not run backups itself. Your data lives in your Supabase project, so safety depends on how that project is configured. Set one of the options below up on purpose — and test a restore.</Alert>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="Recommended backup strategy" /><CardBody><ol className="list-decimal space-y-2 ps-5 text-sm"><li><b>Supabase Pro plan</b> includes daily database backups (7-day retention). The Free plan has <b>no</b> managed backups.</li><li>Add <b>Point-in-Time Recovery</b> (paid add-on) if you cannot afford to lose a day of fee collection.</li><li>Also keep your own copy: a weekly <code>pg_dump</code> to a drive the school controls (command in the README).</li><li>The <b>documents</b> storage bucket is <b>not</b> part of database backups — copy it separately.</li><li>Do a test restore into a spare project once a term. A backup you have never restored is a hope, not a backup.</li></ol></CardBody></Card>
      <Card><CardHeader title="Download your data (CSV)" description="Opens in Excel. Each download is written to the audit log." /><CardBody><div className="grid gap-2 sm:grid-cols-2">{EXPORTS.map(([t, l]) => <LinkButton key={t} variant="secondary" href={`/api/backup/export?table=${t}`}>{l}</LinkButton>)}</div></CardBody></Card>
    </div></>);
}
