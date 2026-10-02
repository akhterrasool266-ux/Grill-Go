import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, CardHeader, DescriptionList, PageHeader, Stat, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { pkr, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Family' };

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePerm('guardians.view');
  const sb = await createClient();
  const { data: f } = await sb.from('families').select('*').eq('id', id).maybeSingle();
  if (!f) notFound();
  const [{ data: kids }, { data: guards }] = await Promise.all([
    sb.from('students').select('id,full_name,student_code,status,classes(name),sections(name)').eq('family_id', id).order('dob'),
    sb.from('guardians').select('id,full_name,relation,phone,whatsapp,cnic,occupation,email').eq('family_id', id),
  ]);
  const ids = (kids ?? []).map((k: any) => k.id);
  const { data: inv } = ids.length && can(ctx, 'fees.view') ? await sb.from('fee_invoices').select('student_id,balance,status').in('student_id', ids).in('status', ['unpaid', 'partial']) : { data: [] };
  const owed = (sid: string) => (inv ?? []).filter((i: any) => i.student_id === sid).reduce((a: number, i: any) => a + Number(i.balance), 0);
  const total = (inv ?? []).reduce((a: number, i: any) => a + Number(i.balance), 0);
  return (
    <>
      <PageHeader back={{ href: '/families', label: 'Families' }} title={f.family_name} description={`${f.family_code} · ${f.primary_phone ?? ''}`}
        actions={can(ctx, 'payments.create') ? <LinkButton href={`/fees/collect?family=${f.family_code}`}>Collect family payment</LinkButton> : undefined} />
      {can(ctx, 'fees.view') && <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Combined outstanding" value={pkr(total)} tone={total ? 'warn' : 'ok'} /><Stat label="Children enrolled" value={(kids ?? []).filter((k: any) => k.status === 'active').length} /></section>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Children" />
          <TableWrap><thead><tr><Th>Student</Th><Th>Class</Th><Th>Status</Th>{can(ctx, 'fees.view') && <Th className="text-end">Owes</Th>}</tr></thead><tbody>
            {(kids ?? []).map((k: any) => <tr key={k.id}><Td><Link className="font-medium text-brand hover:underline" href={`/students/${k.id}`}>{k.full_name}</Link><span className="block text-xs text-muted">{k.student_code}</span></Td><Td>{k.classes?.name}{k.sections?.name ? ` – ${k.sections.name}` : ''}</Td><Td><Badge tone={statusTone(k.status)}>{titleCase(k.status)}</Badge></Td>{can(ctx, 'fees.view') && <Td className="tabular text-end">{pkr(owed(k.id))}</Td>}</tr>)}
          </tbody></TableWrap>
        </Card>
        <Card><CardHeader title="Guardians" /><ul className="divide-y divide-line">{(guards ?? []).map((g: any) => <li key={g.id} className="space-y-2 p-4"><DescriptionList items={[[titleCase(g.relation), g.full_name], ['Phone', g.phone], ['WhatsApp', g.whatsapp], ['CNIC', g.cnic], ['Occupation', g.occupation]]} /></li>)}</ul></Card>
      </div>
    </>
  );
}
