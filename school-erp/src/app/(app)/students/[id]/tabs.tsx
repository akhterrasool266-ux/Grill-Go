import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, Stat, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { StudentDocUpload, DisciplineForm, PlacementForm } from '@/components/data/student-tab-forms';
import { fmtDate, fmtDateTime, fmtTime, pct, pkr, titleCase, todayISO } from '@/lib/format';
import type { Ctx } from '@/lib/auth/session';
import { can } from '@/lib/auth/session';

type S = any;
type P = { sb: SupabaseClient; s: S; ctx: Ctx };

export async function OverviewTab({ sb, s, ctx }: P) {
  const { data: links } = await sb.from('student_guardians').select('relation,is_primary,pays_fees,guardians(id,full_name,relation,phone,whatsapp,email,cnic,occupation)').eq('student_id', s.id);
  const { data: sibs } = s.family_id ? await sb.from('students').select('id,full_name,student_code,classes(name)').eq('family_id', s.family_id).neq('id', s.id) : { data: [] };
  const wa = (n?: string | null) => (n ? `https://wa.me/${n.replace(/^0/, '92').replace(/\D/g, '')}` : null);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader title="Personal details" /><CardBody>
        <DescriptionList items={[
          ['Gender', titleCase(s.gender)], ['Date of birth', fmtDate(s.dob)], ['B-Form / CNIC', s.b_form_no], ['Blood group', s.blood_group],
          ["Father's name", s.father_name], ["Mother's name", s.mother_name], ['Address', [s.address, s.city, s.province].filter(Boolean).join(', ')], ['Previous school', s.previous_school],
          ['Emergency contact', [s.emergency_contact_name, s.emergency_contact_phone].filter(Boolean).join(' · ')], ['Boarder', s.hostel_status ? 'Yes' : 'No'],
          ['Medical notes', s.medical_notes],
        ]} />
      </CardBody></Card>
      <div className="space-y-4">
        <Card><CardHeader title="Parents / guardians" /><ul className="divide-y divide-line">
          {(links ?? []).length === 0 && <li className="p-4 text-sm text-muted">No guardian linked.</li>}
          {(links ?? []).map((l: any) => (
            <li key={l.guardians.id} className="space-y-1 p-4 text-sm">
              <p className="font-medium">{l.guardians.full_name} <span className="font-normal text-muted">· {titleCase(l.relation ?? l.guardians.relation)}</span>{l.is_primary && <Badge tone="brand" className="ms-2">Primary</Badge>}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                {l.guardians.phone && <a className="text-brand hover:underline" href={`tel:${l.guardians.phone}`}>📞 {l.guardians.phone}</a>}
                {wa(l.guardians.whatsapp ?? l.guardians.phone) && <a className="text-brand hover:underline" href={wa(l.guardians.whatsapp ?? l.guardians.phone)!} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
              </p>
              {l.guardians.occupation && <p className="text-muted">{l.guardians.occupation}</p>}
            </li>
          ))}
        </ul></Card>
        {(sibs ?? []).length > 0 && (
          <Card><CardHeader title="Siblings" /><ul className="divide-y divide-line">
            {(sibs ?? []).map((x: any) => <li key={x.id}><Link href={`/students/${x.id}`} className="flex justify-between p-3.5 text-sm hover:bg-surface-2"><span className="font-medium">{x.full_name}</span><span className="text-muted">{x.classes?.name ?? ''}</span></Link></li>)}
          </ul></Card>
        )}
        {can(ctx, 'guardians.view') && s.family_id && <LinkButton variant="secondary" href={`/families/${s.family_id}`} className="w-full">Family account →</LinkButton>}
      </div>
    </div>
  );
}

export async function AcademicTab({ sb, s, ctx, classOpts }: P & { classOpts: { classes: { value: string; label: string }[]; sections: { value: string; label: string; class_id: string }[] } }) {
  const [{ data: subjects }, { data: teachers }, { data: year }] = await Promise.all([
    s.class_id ? sb.from('class_subjects').select('subjects(name,code)').eq('class_id', s.class_id) : Promise.resolve({ data: [] }),
    s.section_id ? sb.from('teacher_assignments').select('is_class_teacher,subjects(name),staff(full_name)').eq('section_id', s.section_id) : Promise.resolve({ data: [] }),
    s.academic_year_id ? sb.from('academic_years').select('name').eq('id', s.academic_year_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="Placement" /><CardBody>
        <DescriptionList items={[['Class', s.classes?.name], ['Section', s.sections?.name], ['Roll number', s.roll_no], ['House', s.houses?.name], ['Admission no.', s.admission_no], ['Admitted', fmtDate(s.admission_date)], ['Admission year', (year as any)?.name]]} />
        {can(ctx, 'students.edit') && <div className="mt-5 border-t border-line pt-4"><PlacementForm studentId={s.id} classId={s.class_id} sectionId={s.section_id} rollNo={s.roll_no} classes={classOpts.classes} sections={classOpts.sections} /></div>}
      </CardBody></Card>
      <div className="space-y-4">
        <Card><CardHeader title="Subjects" /><CardBody>
          {(subjects ?? []).length === 0 ? <p className="text-sm text-muted">No subjects assigned to this class yet.</p> :
            <div className="flex flex-wrap gap-2">{(subjects ?? []).map((x: any) => <Badge key={x.subjects.code} tone="brand">{x.subjects.name}</Badge>)}</div>}
        </CardBody></Card>
        <Card><CardHeader title="Teachers" /><ul className="divide-y divide-line">
          {(teachers ?? []).length === 0 && <li className="p-4 text-sm text-muted">No teachers assigned to this section yet.</li>}
          {(teachers ?? []).map((t: any, i: number) => <li key={i} className="flex justify-between p-3.5 text-sm"><span className="font-medium">{t.staff?.full_name}</span><span className="text-muted">{t.is_class_teacher ? 'Class teacher' : t.subjects?.name}</span></li>)}
        </ul></Card>
      </div>
    </div>
  );
}

export async function AttendanceTab({ sb, s }: P) {
  const since = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
  const { data } = await sb.from('student_attendance').select('date,status,remarks,method').eq('student_id', s.id).gte('date', since).order('date', { ascending: false });
  const rows = (data ?? []) as any[];
  const c = (st: string) => rows.filter((r) => r.status === st).length;
  const counted = rows.filter((r) => r.status !== 'leave').length;
  const present = c('present') + c('late') + c('half_day') * 0.5;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Attendance (90 days)" value={counted ? pct((present / counted) * 100) : '—'} tone={counted && present / counted < 0.85 ? 'bad' : 'ok'} />
        <Stat label="Present" value={c('present')} /><Stat label="Absent" value={c('absent')} tone={c('absent') > 5 ? 'bad' : undefined} /><Stat label="Late" value={c('late')} /><Stat label="Leave" value={c('leave')} />
      </div>
      <Card>
        {rows.length === 0 ? <EmptyState title="No attendance recorded yet" /> : (
          <TableWrap><thead><tr><Th>Date</Th><Th>Status</Th><Th>Method</Th><Th>Remarks</Th></tr></thead><tbody>
            {rows.slice(0, 60).map((r) => <tr key={r.date}><Td>{fmtDate(r.date)}</Td><Td><Badge tone={statusTone(r.status)}>{titleCase(r.status)}</Badge></Td><Td className="text-muted">{titleCase(r.method)}</Td><Td className="text-muted">{r.remarks ?? ''}</Td></tr>)}
          </tbody></TableWrap>
        )}
      </Card>
    </div>
  );
}

export async function FeesTab({ sb, s, ctx }: P) {
  const [{ data: inv }, { data: pays }] = await Promise.all([
    sb.from('fee_invoices').select('id,invoice_no,period_label,due_date,net_amount,paid_amount,balance,status,previous_balance').eq('student_id', s.id).order('due_date', { ascending: false }).limit(36),
    sb.from('payments').select('id,receipt_no,amount,method,paid_at,refunded_amount').or(`student_id.eq.${s.id}${s.family_id ? `,family_id.eq.${s.family_id}` : ''}`).order('paid_at', { ascending: false }).limit(20),
  ]);
  const invoices = (inv ?? []) as any[];
  const today = todayISO();
  const outstanding = invoices.filter((i) => i.status !== 'cancelled').reduce((a, i) => a + Number(i.balance), 0);
  const overdue = invoices.filter((i) => ['unpaid', 'partial'].includes(i.status) && i.due_date < today);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={pkr(outstanding)} tone={outstanding > 0 ? 'warn' : 'ok'} />
        <Stat label="Overdue vouchers" value={overdue.length} tone={overdue.length ? 'bad' : undefined} />
        {process.env.JAZZCASH_MERCHANT_ID && outstanding > 0 && ctx.studentIds.includes(s.id) && <form method="post" action="/api/pay/jazzcash/start" className="col-span-2 flex items-center sm:col-span-1"><input type="hidden" name="student_id" value={s.id} /><button className="h-12 w-full rounded-[10px] bg-brand px-6 font-medium text-brand-fg">Pay online (JazzCash)</button></form>}
        {can(ctx, 'payments.create') && <div className="col-span-2 flex items-center sm:col-span-1"><LinkButton href={`/fees/collect?student=${s.student_code}`} size="lg" className="w-full">Collect fee</LinkButton></div>}
      </div>
      <Card><CardHeader title="Fee vouchers" />
        {invoices.length === 0 ? <EmptyState title="No vouchers yet" /> : (
          <TableWrap><thead><tr><Th>Voucher</Th><Th>Period</Th><Th>Due</Th><Th className="text-end">Amount</Th><Th className="text-end">Paid</Th><Th className="text-end">Balance</Th><Th>Status</Th></tr></thead><tbody>
            {invoices.map((i) => {
              const st = ['unpaid', 'partial'].includes(i.status) && i.due_date < today ? 'overdue' : i.status;
              return <tr key={i.id}><Td><Link className="text-brand hover:underline" href={`/fees/invoices/${i.id}`}>{i.invoice_no}</Link></Td><Td>{i.period_label}</Td><Td>{fmtDate(i.due_date)}</Td><Td className="tabular text-end">{pkr(i.net_amount)}</Td><Td className="tabular text-end">{pkr(i.paid_amount)}</Td><Td className="tabular text-end font-medium">{pkr(i.balance)}</Td><Td><Badge tone={statusTone(st)}>{titleCase(st)}</Badge></Td></tr>;
            })}
          </tbody></TableWrap>
        )}
      </Card>
      <Card><CardHeader title="Payments" />
        {(pays ?? []).length === 0 ? <EmptyState title="No payments yet" /> : (
          <TableWrap><thead><tr><Th>Receipt</Th><Th>Date</Th><Th>Method</Th><Th className="text-end">Amount</Th></tr></thead><tbody>
            {(pays ?? []).map((p: any) => <tr key={p.id}><Td><Link className="text-brand hover:underline" href={`/fees/receipts/${p.id}`}>{p.receipt_no}</Link></Td><Td>{fmtDateTime(p.paid_at)}</Td><Td>{titleCase(p.method)}</Td><Td className="tabular text-end">{pkr(p.amount)}{Number(p.refunded_amount) > 0 && <span className="ms-1 text-xs text-bad">(−{pkr(p.refunded_amount)} refunded)</span>}</Td></tr>)}
          </tbody></TableWrap>
        )}
      </Card>
    </div>
  );
}

export async function ExamsTab({ sb, s }: P) {
  const { data } = await sb.from('exam_subjects').select('exam_date,start_time,max_marks,subjects(name),exams(id,name,status,start_date)').eq('class_id', s.class_id ?? '00000000-0000-0000-0000-000000000000').order('exam_date', { ascending: true }).limit(80);
  const upcoming = ((data ?? []) as any[]).filter((r) => r.exam_date && r.exam_date >= todayISO());
  return (
    <Card><CardHeader title="Upcoming papers (datesheet)" />
      {upcoming.length === 0 ? <EmptyState title="No upcoming papers" hint="Papers appear here once an exam is scheduled for this class." /> : (
        <TableWrap><thead><tr><Th>Date</Th><Th>Exam</Th><Th>Subject</Th><Th>Time</Th><Th className="text-end">Max marks</Th></tr></thead><tbody>
          {upcoming.map((r, i) => <tr key={i}><Td>{fmtDate(r.exam_date)}</Td><Td>{r.exams?.name}</Td><Td>{r.subjects?.name}</Td><Td>{fmtTime(r.start_time)}</Td><Td className="tabular text-end">{r.max_marks}</Td></tr>)}
        </tbody></TableWrap>
      )}
    </Card>
  );
}

export async function ResultsTab({ sb, s }: P) {
  const { data } = await sb.from('result_cards').select('id,total_obtained,total_max,percentage,grade,position,result_status,is_published,exams(name,published_at)').eq('student_id', s.id).order('generated_at', { ascending: false });
  const rows = (data ?? []) as any[];
  return (
    <Card><CardHeader title="Result cards" />
      {rows.length === 0 ? <EmptyState title="No results yet" /> : (
        <TableWrap><thead><tr><Th>Exam</Th><Th className="text-end">Marks</Th><Th className="text-end">%</Th><Th>Grade</Th><Th>Position</Th><Th>Result</Th><Th><span className="sr-only">Open</span></Th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><Td className="font-medium">{r.exams?.name}{!r.is_published && <Badge tone="warn" className="ms-2">Unpublished</Badge>}</Td><Td className="tabular text-end">{r.total_obtained}/{r.total_max}</Td><Td className="tabular text-end">{pct(r.percentage)}</Td><Td>{r.grade ?? '—'}</Td><Td>{r.position ?? '—'}</Td><Td><Badge tone={statusTone(r.result_status)}>{titleCase(r.result_status)}</Badge></Td><Td><Link className="text-brand hover:underline" href={`/results/${r.id}`}>Open</Link></Td></tr>)}
        </tbody></TableWrap>
      )}
    </Card>
  );
}

export async function HomeworkTab({ sb, s }: P) {
  const { data } = s.section_id ? await sb.from('homework').select('id,title,due_date,description,subjects(name)').eq('section_id', s.section_id).order('due_date', { ascending: false }).limit(20) : { data: [] };
  const rows = (data ?? []) as any[];
  return (
    <Card><CardHeader title="Homework" />
      {rows.length === 0 ? <EmptyState title="No homework set" /> : (
        <ul className="divide-y divide-line">{rows.map((h) => (
          <li key={h.id} className="p-4 text-sm"><div className="flex justify-between gap-3"><p className="font-medium">{h.title}</p><Badge tone={h.due_date < todayISO() ? 'neutral' : 'warn'}>Due {fmtDate(h.due_date)}</Badge></div><p className="text-muted">{h.subjects?.name}</p>{h.description && <p className="mt-1">{h.description}</p>}</li>
        ))}</ul>
      )}
    </Card>
  );
}

export async function DocumentsTab({ sb, s, ctx }: P) {
  const { data } = await sb.from('documents').select('id,title,doc_type,size_bytes,created_at,visible_to_guardian').eq('owner_type', 'student').eq('owner_id', s.id).order('created_at', { ascending: false });
  return (
    <div className="space-y-4">
      {can(ctx, 'documents.create') && <Card><CardHeader title="Upload a document" /><CardBody><StudentDocUpload studentId={s.id} /></CardBody></Card>}
      <Card><CardHeader title="Documents" />
        {(data ?? []).length === 0 ? <EmptyState title="No documents uploaded" hint="B-Form, birth certificate, transfer certificate, previous results, medical records…" /> : (
          <ul className="divide-y divide-line">{(data ?? []).map((d: any) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0"><a className="font-medium text-brand hover:underline" href={`/api/files/${d.id}`}>{d.title}</a><p className="text-xs text-muted">{titleCase(d.doc_type)} · {d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB · ` : ''}{fmtDate(d.created_at)}</p></div>
              {d.visible_to_guardian && <Badge tone="info">Shared with parents</Badge>}
            </li>
          ))}</ul>
        )}
      </Card>
    </div>
  );
}

export async function CommunicationTab({ sb, s }: P) {
  const { data } = await sb.from('notification_logs').select('id,channel,template_key,status,to_address,created_at,error').eq('student_id', s.id).order('created_at', { ascending: false }).limit(40);
  return (
    <Card><CardHeader title="Messages sent about this student" description="Status is what the provider reported — nothing is shown as delivered unless it was." />
      {(data ?? []).length === 0 ? <EmptyState title="No messages yet" /> : (
        <TableWrap><thead><tr><Th>When</Th><Th>Message</Th><Th>Channel</Th><Th>To</Th><Th>Status</Th></tr></thead><tbody>
          {(data ?? []).map((m: any) => <tr key={m.id}><Td>{fmtDateTime(m.created_at)}</Td><Td>{titleCase(m.template_key ?? 'custom')}</Td><Td>{titleCase(m.channel)}</Td><Td className="text-muted">{m.to_address}</Td><Td><Badge tone={statusTone(m.status)}>{titleCase(m.status)}</Badge>{m.error && <span className="ms-2 text-xs text-muted" title={m.error}>ⓘ</span>}</Td></tr>)}
        </tbody></TableWrap>
      )}
    </Card>
  );
}

export async function TransportTab({ sb, s }: P) {
  const { data: t } = await sb.from('student_transport').select('monthly_fee,is_active,start_date,routes(name,start_time),route_stops!student_transport_pickup_stop_id_campus_id_fkey(name,pickup_time)').eq('student_id', s.id).eq('is_active', true).maybeSingle();
  const { data: ra } = await sb.from('route_attendance').select('date,trip,status').eq('student_id', s.id).order('date', { ascending: false }).limit(10);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="Route" /><CardBody>
        {!t ? <p className="text-sm text-muted">This student does not use school transport.</p> : <DescriptionList items={[['Route', (t as any).routes?.name], ['Departs', fmtTime((t as any).routes?.start_time)], ['Pickup stop', (t as any).route_stops?.name], ['Pickup time', fmtTime((t as any).route_stops?.pickup_time)], ['Monthly fee', pkr((t as any).monthly_fee)]]} />}
      </CardBody></Card>
      <Card><CardHeader title="Recent trips" />
        {(ra ?? []).length === 0 ? <EmptyState title="No trips recorded" /> : <ul className="divide-y divide-line">{(ra ?? []).map((r: any, i: number) => <li key={i} className="flex justify-between p-3.5 text-sm"><span>{fmtDate(r.date)} · {titleCase(r.trip)}</span><Badge tone={statusTone(r.status === 'absent' ? 'absent' : 'present')}>{titleCase(r.status)}</Badge></li>)}</ul>}
      </Card>
    </div>
  );
}

export async function DisciplineTab({ sb, s, ctx }: P) {
  const { data } = await sb.from('student_discipline').select('id,incident_date,kind,description,action_taken').eq('student_id', s.id).order('incident_date', { ascending: false });
  return (
    <div className="space-y-4">
      {can(ctx, 'students.edit') && <Card><CardHeader title="Add a record" /><CardBody><DisciplineForm studentId={s.id} today={todayISO()} /></CardBody></Card>}
      <Card><CardHeader title="Discipline & commendations" description="Visible to staff only." />
        {(data ?? []).length === 0 ? <EmptyState title="Nothing recorded" /> : (
          <ul className="divide-y divide-line">{(data ?? []).map((d: any) => (
            <li key={d.id} className="p-4 text-sm"><div className="flex items-center justify-between gap-3"><Badge tone={d.kind === 'commendation' ? 'ok' : d.kind === 'suspension' ? 'bad' : 'warn'}>{titleCase(d.kind)}</Badge><span className="text-muted">{fmtDate(d.incident_date)}</span></div><p className="mt-1.5">{d.description}</p>{d.action_taken && <p className="mt-1 text-muted">Action: {d.action_taken}</p>}</li>
          ))}</ul>
        )}
      </Card>
    </div>
  );
}

export async function PromotionTab({ sb, s }: P) {
  const { data } = await sb.from('promotions').select('id,outcome,conditions,remarks,created_at,from_class:classes!promotions_from_class_id_fkey(name),to_class:classes!promotions_to_class_id_fkey(name),from_year:academic_years!promotions_from_academic_year_id_fkey(name),to_year:academic_years!promotions_to_academic_year_id_fkey(name)').eq('student_id', s.id).order('created_at', { ascending: false });
  return (
    <Card><CardHeader title="Promotion history" description="Previous years are never overwritten." />
      {(data ?? []).length === 0 ? <EmptyState title="No promotions yet" hint={`Currently in ${s.classes?.name ?? '—'}. Admitted ${fmtDate(s.admission_date)}.`} /> : (
        <TableWrap><thead><tr><Th>Year</Th><Th>From</Th><Th>To</Th><Th>Outcome</Th><Th>Notes</Th></tr></thead><tbody>
          {(data ?? []).map((p: any) => <tr key={p.id}><Td>{p.from_year?.name} → {p.to_year?.name ?? '—'}</Td><Td>{p.from_class?.name ?? '—'}</Td><Td>{p.to_class?.name ?? '—'}</Td><Td><Badge tone={statusTone(p.outcome === 'retained' ? 'warn' : 'ok')}>{titleCase(p.outcome)}</Badge></Td><Td className="text-muted">{p.conditions ?? p.remarks ?? ''}</Td></tr>)}
        </tbody></TableWrap>
      )}
    </Card>
  );
}
