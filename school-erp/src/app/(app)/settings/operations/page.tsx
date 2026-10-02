import type { Metadata } from 'next';
import { AttendanceSettings, ExamSettings, FeesSettings, LibrarySettings, PayrollSettings } from '@/components/data/settings-forms';
import { Alert, Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Operational settings' };

export default async function OperationsSettings() {
  const ctx = await requirePerm('settings.view');
  const sb = await createClient();
  const { data } = await sb.from('settings').select('key,value');
  const v = (k: string) => ((data ?? []).find((r: any) => r.key === k)?.value ?? {}) as any;
  const edit = can(ctx, 'settings.edit');
  const sections: [string, string, React.ReactNode][] = [['Fees', 'Late fines, sibling discount, voucher note', <FeesSettings key="f" v={v('fees')} />], ['Attendance', 'Times used for late marking', <AttendanceSettings key="a" v={v('attendance')} />], ['Payroll', 'Overtime and absence rules', <PayrollSettings key="p" v={v('payroll')} />], ['Library', 'Loan period and fines', <LibrarySettings key="l" v={v('library')} />], ['Exams', 'Defaults', <ExamSettings key="e" v={v('exams')} />]];
  return (<><PageHeader title="Fees, attendance, payroll & library" back={{ href: '/settings', label: 'Settings' }} />{!edit && <div className="mb-4"><Alert tone="info">You can view these settings but not change them.</Alert></div>}<div className="space-y-4">{sections.map(([t, d, form]) => <Card key={t}><CardHeader title={t} description={d} /><CardBody><fieldset disabled={!edit}>{form}</fieldset></CardBody></Card>)}</div></>);
}
