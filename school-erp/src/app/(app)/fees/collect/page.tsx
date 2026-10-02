import type { Metadata } from 'next';
import Link from 'next/link';
import { CollectForm } from '@/components/data/fees-forms';
import { Avatar } from '@/components/ui/avatar';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, likePattern, pkr } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Collect fee' };

export default async function CollectPage({ searchParams }: { searchParams: Promise<{ student?: string; family?: string; q?: string; mode?: string }> }) {
  const ctx = await requirePerm('payments.create');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();

  // ── search results ──
  let matches: any[] = [];
  if (sp.q && !sp.student && !sp.family) {
    const p = likePattern(sp.q);
    let q = sb.from('students').select('id,student_code,full_name,father_name,family_id,classes(name),sections(name)').eq('status', 'active').or(`full_name.ilike.${p},student_code.ilike.${p},admission_no.ilike.${p},father_name.ilike.${p}`).limit(12);
    if (campus) q = q.eq('campus_id', campus);
    matches = (await q).data ?? [];
    if (matches.length === 0) {
      const { data: g } = await sb.from('guardians').select('family_id').ilike('phone', p).limit(1);
      if (g?.[0]?.family_id) matches = (await sb.from('students').select('id,student_code,full_name,father_name,family_id,classes(name),sections(name)').eq('family_id', g[0].family_id).eq('status', 'active')).data ?? [];
    }
  }

  // ── selected student / family ──
  let student: any = null, familyId: string | null = null, family: any = null;
  if (sp.student) {
    student = (await sb.from('students').select('id,student_code,full_name,father_name,family_id,photo_path,classes(name),sections(name),campuses(name)').eq('student_code', sp.student.toUpperCase()).maybeSingle()).data;
    familyId = student?.family_id ?? null;
  } else if (sp.family) {
    family = (await sb.from('families').select('id,family_code,family_name').eq('family_code', sp.family.toUpperCase()).maybeSingle()).data;
    familyId = family?.id ?? null;
  }
  if (familyId && !family) family = (await sb.from('families').select('id,family_code,family_name').eq('id', familyId).maybeSingle()).data;
  const familyMode = (!!family && !!sp.family) || (sp.mode === 'family' && !!familyId);
  let students: any[] = [];
  if (familyId) students = (await sb.from('students').select('id,full_name,student_code').eq('family_id', familyId).eq('status', 'active')).data ?? [];
  const ids = familyMode ? students.map((s) => s.id) : student ? [student.id] : [];
  const { data: inv } = ids.length ? await sb.from('fee_invoices').select('id,invoice_no,period_label,due_date,balance,student_id').in('student_id', ids).in('status', ['unpaid', 'partial']).gt('balance', 0).order('due_date') : { data: [] };
  const invoices = (inv ?? []).map((i: any) => ({ id: i.id, invoice_no: i.invoice_no, period_label: i.period_label, balance: Number(i.balance), due_date: fmtDate(i.due_date), student: familyMode ? students.find((s) => s.id === i.student_id)?.full_name : undefined }));
  const total = invoices.reduce((a: number, i: { balance: number }) => a + i.balance, 0);
  const { data: credits } = ids.length ? await sb.from('payments').select('amount,allocated_amount,refunded_amount').or(`student_id.in.(${ids.join(',')})${familyMode && familyId ? `,family_id.eq.${familyId}` : ''}`).eq('status', 'completed') : { data: [] };
  const advance = (credits ?? []).reduce((a: number, p: any) => a + Number(p.amount) - Number(p.allocated_amount) - Number(p.refunded_amount), 0);
  const selected = student || family;

  return (
    <>
      <PageHeader title="Collect fee" back={{ href: '/fees', label: 'Fees' }} />
      <form className="mb-5 flex gap-2" role="search" action="/fees/collect">
        <input name="q" defaultValue={sp.q} autoFocus={!selected} placeholder="Student ID, name, father or parent phone" className="input max-w-lg text-base" aria-label="Find student" />
        <button className="rounded-[10px] bg-brand px-5 text-sm font-medium text-brand-fg">Find</button>
      </form>

      {!selected && matches.length > 0 && (
        <Card><ul className="divide-y divide-line">{matches.map((m) => (
          <li key={m.id}><Link href={`/fees/collect?student=${m.student_code}`} className="flex items-center gap-3 p-3.5 hover:bg-surface-2"><Avatar name={m.full_name} /><span className="min-w-0 flex-1"><span className="block font-medium">{m.full_name}</span><span className="block text-xs text-muted">{m.student_code} · {m.classes?.name}{m.sections?.name ? ` – ${m.sections.name}` : ''} · {m.father_name}</span></span><span className="text-brand">Select →</span></Link></li>
        ))}</ul></Card>
      )}
      {!selected && sp.q && matches.length === 0 && <Card><EmptyState title="No student found" hint="Try the student ID (e.g. STD-0012), part of the name, or the parent's phone number." /></Card>}
      {sp.student && !student && <Alert tone="bad">No student with ID “{sp.student}” was found (or you do not have access to that campus).</Alert>}

      {selected && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2 self-start"><CardBody className="space-y-3">
            {student && !sp.family && <div className="flex items-center gap-3"><Avatar name={student.full_name} size={48} src={student.photo_path ? `/api/photo/${student.id}` : null} /><div><p className="font-semibold">{student.full_name}</p><p className="text-sm text-muted">{student.student_code} · {student.classes?.name}{student.sections?.name ? ` – ${student.sections.name}` : ''}</p><p className="text-xs text-muted">{student.father_name}</p></div></div>}
            {familyMode && family && <div><p className="font-semibold">{family.family_name}</p><p className="text-sm text-muted">{family.family_code} · {students.length} children</p></div>}
            {familyId && students.length > 1 && (
              <div className="flex gap-2 text-sm">
                <Link href={`/fees/collect?student=${student?.student_code ?? students[0]?.student_code}`} className={`rounded-full border px-3 py-1 ${!familyMode ? 'border-brand bg-brand-soft text-brand' : 'border-line'}`}>This child</Link>
                <Link href={`/fees/collect?family=${family?.family_code ?? ''}`} className={`rounded-full border px-3 py-1 ${familyMode ? 'border-brand bg-brand-soft text-brand' : 'border-line'}`}>Whole family ({students.length})</Link>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm"><div><dt className="text-xs uppercase text-muted">Outstanding</dt><dd className={`text-xl font-semibold tabular ${total > 0 ? 'text-warn' : 'text-ok'}`}>{pkr(total)}</dd></div><div><dt className="text-xs uppercase text-muted">Advance credit</dt><dd className="text-xl font-semibold tabular">{pkr(advance)}</dd></div></dl>
            {student && <Link href={`/students/${student.id}?tab=fees`} className="block text-sm text-brand hover:underline">Fee history →</Link>}
          </CardBody></Card>
          <Card className="lg:col-span-3"><CardHeader title={familyMode ? 'Receive family payment' : 'Receive payment'} action={total === 0 ? <Badge tone="ok">Nothing due</Badge> : undefined} /><CardBody>
            <CollectForm studentId={student?.id} familyId={familyId ?? undefined} familyMode={familyMode} payerDefault={student?.father_name ?? ''} total={total} invoices={invoices} />
          </CardBody></Card>
        </div>
      )}
    </>
  );
}
