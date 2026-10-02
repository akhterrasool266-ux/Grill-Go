import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StudentDocUpload } from '@/components/data/student-tab-forms';
import { Avatar } from '@/components/ui/avatar';
import { LinkButton } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/confirm-form';
import { Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, PageHeader, Tabs, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDate, pkr, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { setStaffStatus } from '@/app/actions/hr';
import { uploadDocument } from '@/app/actions/documents';
import { ActionForm, Field, Input, Select, SubmitButton } from '@/components/ui/action-form';

export const metadata: Metadata = { title: 'Staff profile' };

export default async function StaffProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: s } = await sb.from('staff').select('*,designations(name),departments(name),campuses(name)').eq('id', id).maybeSingle();
  if (!s) notFound();
  const fin = can(ctx, 'payroll.view') && can(ctx, 'financial.access');
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'attendance', label: 'Attendance' }, { id: 'leave', label: 'Leave' }, { id: 'documents', label: 'Documents' }, ...(fin ? [{ id: 'salary', label: 'Salary & payslips' }] : [])];
  const tab = tabs.find((t) => t.id === sp.tab)?.id ?? 'overview';
  const since = new Date(Date.now() - 59 * 86400000).toISOString().slice(0, 10);
  const [att, leaves, bal, docs, sal, slips] = await Promise.all([
    tab === 'attendance' ? sb.from('staff_attendance').select('date,status,check_in,check_out,overtime_minutes').eq('staff_id', id).gte('date', since).order('date', { ascending: false }) : { data: [] },
    tab === 'leave' ? sb.from('leave_requests').select('id,from_date,to_date,days,status,reason,leave_types(name)').eq('staff_id', id).order('created_at', { ascending: false }).limit(20) : { data: [] },
    tab === 'leave' ? sb.from('leave_balances').select('allocated,used,year,leave_types(name)').eq('staff_id', id) : { data: [] },
    tab === 'documents' ? sb.from('documents').select('id,title,doc_type,created_at,size_bytes').eq('owner_type', 'staff').eq('owner_id', id).order('created_at', { ascending: false }) : { data: [] },
    tab === 'salary' && fin ? sb.from('salary_structures').select('*').eq('staff_id', id).order('effective_from', { ascending: false }) : { data: [] },
    tab === 'salary' && fin ? sb.from('payroll').select('id,month,net_salary,status,payslip_no').eq('staff_id', id).order('month', { ascending: false }).limit(12) : { data: [] },
  ]);
  return (
    <>
      <PageHeader back={{ href: '/staff', label: 'Staff' }} title={<span className="flex items-center gap-3"><Avatar name={s.full_name} size={48} src={s.photo_path ? `/api/staff-photo/${s.id}` : null} />{s.full_name}</span>}
        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="tabular">{s.employee_code}</span><span>{s.designations?.name ?? 'No designation'}</span><span>{s.campuses?.name}</span><Badge tone={statusTone(s.status)}>{titleCase(s.status)}</Badge></span>}
        actions={<>{can(ctx, 'staff.print') && <LinkButton variant="secondary" href={`/staff/${id}/id-card`}>ID card</LinkButton>}{can(ctx, 'staff.edit') && <LinkButton variant="secondary" href={`/staff/${id}/edit`}>Edit</LinkButton>}</>} />
      <Tabs active={tab} tabs={tabs.map((t) => ({ ...t, href: `/staff/${id}?tab=${t.id}` }))} />
      {tab === 'overview' && <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader title="Details" /><CardBody><DescriptionList items={[['Phone', s.phone], ['Email', s.email], ['CNIC', s.cnic], ['Gender', s.gender && titleCase(s.gender)], ['Date of birth', fmtDate(s.dob)], ['Joined', fmtDate(s.joining_date)], ['Employment', titleCase(s.employment_type)], ['Department', s.departments?.name], ['Qualification', s.qualification], ['Shift', `${s.shift_start?.slice(0, 5)} – ${s.shift_end?.slice(0, 5)}`], ['Bank', [s.bank_name, s.bank_account].filter(Boolean).join(' · ')], ['Address', s.address]]} /></CardBody></Card>
        {can(ctx, 'staff.edit') && <Card className="self-start"><CardHeader title="Status" /><CardBody className="flex flex-wrap gap-2">{['active', 'on_leave', 'resigned', 'terminated'].filter((x) => x !== s.status).map((x) => <ActionButton key={x} action={setStaffStatus} data={{ id, status: x }}>{`Mark ${titleCase(x)}`}</ActionButton>)}</CardBody></Card>}</div>}
      {tab === 'attendance' && <Card>{(att.data ?? []).length === 0 ? <EmptyState title="No attendance in the last 60 days" /> : <TableWrap><thead><tr><Th>Date</Th><Th>Status</Th><Th>In</Th><Th>Out</Th><Th className="text-end">Overtime</Th></tr></thead><tbody>{(att.data as any[]).map((a) => <tr key={a.date}><Td>{fmtDate(a.date)}</Td><Td><Badge tone={statusTone(a.status)}>{titleCase(a.status)}</Badge></Td><Td>{a.check_in?.slice(0, 5) ?? '—'}</Td><Td>{a.check_out?.slice(0, 5) ?? '—'}</Td><Td className="tabular text-end">{a.overtime_minutes ? `${a.overtime_minutes} min` : '—'}</Td></tr>)}</tbody></TableWrap>}</Card>}
      {tab === 'leave' && <div className="space-y-4"><Card><CardHeader title="Balances" /><CardBody>{(bal.data ?? []).length === 0 ? <p className="text-sm text-muted">Balances are created when the first leave is approved.</p> : <ul className="grid gap-2 sm:grid-cols-3">{(bal.data as any[]).map((b, i) => <li key={i} className="rounded-[10px] border border-line p-3 text-sm"><p className="font-medium">{b.leave_types?.name} <span className="text-muted">{b.year}</span></p><p className="tabular text-lg font-semibold">{Number(b.allocated) - Number(b.used)} <span className="text-sm font-normal text-muted">of {b.allocated} left</span></p></li>)}</ul>}</CardBody></Card>
        <Card><CardHeader title="Requests" />{(leaves.data ?? []).length === 0 ? <EmptyState title="No leave requests" /> : <TableWrap><thead><tr><Th>Type</Th><Th>Dates</Th><Th className="text-end">Days</Th><Th>Status</Th></tr></thead><tbody>{(leaves.data as any[]).map((l) => <tr key={l.id}><Td>{l.leave_types?.name}<span className="block text-xs text-muted">{l.reason}</span></Td><Td>{fmtDate(l.from_date)} – {fmtDate(l.to_date)}</Td><Td className="tabular text-end">{l.days}</Td><Td><Badge tone={statusTone(l.status)}>{titleCase(l.status)}</Badge></Td></tr>)}</tbody></TableWrap>}</Card></div>}
      {tab === 'documents' && <div className="space-y-4">{can(ctx, 'documents.create') && <Card><CardHeader title="Upload a document" /><CardBody><ActionForm action={uploadDocument} resetOnSuccess className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="owner_type" value="staff" /><input type="hidden" name="owner_id" value={id} /><Field label="Type" name="doc_type"><Select name="doc_type" defaultValue="cnic" options={[['cnic', 'CNIC'], ['contract', 'Contract'], ['qualification', 'Qualification'], ['certificate', 'Certificate'], ['photo', 'Photo'], ['other', 'Other']].map(([value, label]) => ({ value: value!, label: label! }))} /></Field><Field label="Title" name="title"><Input name="title" /></Field><Field label="File" name="file" className="sm:col-span-2"><Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" /></Field><div className="sm:col-span-2"><SubmitButton pendingText="Uploading…">Upload</SubmitButton></div></ActionForm></CardBody></Card>}
        <Card>{(docs.data ?? []).length === 0 ? <EmptyState title="No documents" /> : <ul className="divide-y divide-line">{(docs.data as any[]).map((d) => <li key={d.id} className="p-4 text-sm"><a className="font-medium text-brand hover:underline" href={`/api/files/${d.id}`}>{d.title}</a><p className="text-xs text-muted">{titleCase(d.doc_type)} · {fmtDate(d.created_at)}</p></li>)}</ul>}</Card></div>}
      {tab === 'salary' && <div className="space-y-4"><Card><CardHeader title="Salary structure" action={can(ctx, 'payroll.create', 'payroll.edit') ? <Link className="text-sm text-brand hover:underline" href="/manage/salary-structures/new">+ New revision</Link> : undefined} />{(sal.data ?? []).length === 0 ? <EmptyState title="No salary structure" hint="Staff without one are skipped when payroll is generated." /> : <TableWrap><thead><tr><Th>From</Th><Th className="text-end">Basic</Th><Th className="text-end">Allowances</Th><Th className="text-end">Tax %</Th></tr></thead><tbody>{(sal.data as any[]).map((r) => <tr key={r.id}><Td>{fmtDate(r.effective_from)}</Td><Td className="tabular text-end">{pkr(r.basic_salary)}</Td><Td className="tabular text-end">{pkr(Number(r.house_allowance) + Number(r.medical_allowance) + Number(r.conveyance_allowance) + Number(r.other_allowance))}</Td><Td className="tabular text-end">{r.tax_percent}</Td></tr>)}</tbody></TableWrap>}</Card>
        <Card><CardHeader title="Payslips" />{(slips.data ?? []).length === 0 ? <EmptyState title="No payslips yet" /> : <TableWrap><thead><tr><Th>Month</Th><Th>No.</Th><Th className="text-end">Net</Th><Th>Status</Th></tr></thead><tbody>{(slips.data as any[]).map((p) => <tr key={p.id}><Td><Link className="text-brand hover:underline" href={`/payroll/slip/${p.id}`}>{new Date(p.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Link></Td><Td className="text-muted">{p.payslip_no}</Td><Td className="tabular text-end">{pkr(p.net_salary)}</Td><Td><Badge tone={statusTone(p.status)}>{titleCase(p.status)}</Badge></Td></tr>)}</tbody></TableWrap>}</Card></div>}
    </>
  );
}
void StudentDocUpload;
