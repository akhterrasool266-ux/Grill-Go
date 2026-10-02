import type { Metadata } from 'next';
import { NumberingForm } from '@/components/data/settings-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Document numbering' };
const DEFS: [string, string, string][] = [['invoice', 'Fee voucher / invoice no.', 'INV-'], ['receipt', 'Fee receipt no.', 'RCT-'], ['student_code', 'Student ID', 'STD-'], ['admission_no', 'Admission no.', 'ADM-'], ['employee', 'Employee ID', 'EMP-'], ['payslip', 'Payslip no.', 'PAY-']];

export default async function Numbering() {
  await requirePerm('settings.view');
  const sb = await createClient();
  const { data } = await sb.from('number_sequences').select('key,prefix,padding,last_value,reset_yearly');
  const rows = DEFS.map(([key, label, def]) => { const r = (data ?? []).find((x: any) => x.key === key) as any; const prefix = r?.prefix ?? def, padding = r?.padding ?? 4, yearly = r?.reset_yearly ?? false; return { key, label, prefix, padding, reset_yearly: yearly, sample: `${prefix}${yearly ? String(new Date().getFullYear()).slice(2) + '-' : ''}${String((r?.last_value ?? 0) + 1).padStart(padding, '0')}` }; });
  return (<><PageHeader title="Document numbering" description="Changing a format affects new documents only; existing numbers never change." back={{ href: '/settings', label: 'Settings' }} /><Card><CardBody><NumberingForm rows={rows} /></CardBody></Card></>);
}
