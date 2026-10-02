import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { fmtDateTime, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Audit log' };
const PAGE = 40;
const TABLES = ['fee_invoices', 'fee_invoice_items', 'payments', 'refunds', 'marks', 'students', 'student_attendance', 'role_permissions', 'user_roles', 'salary_structures', 'payroll', 'payroll_runs', 'expenses', 'exams', 'result_cards', 'settings', 'staff', 'admissions', 'documents'];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; action?: string; user?: string; from?: string; to?: string; page?: string }> }) {
  const ctx = await requirePerm('audit.view');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  let q = sb.from('audit_logs').select('id,created_at,user_id,action,table_name,record_id,old_data,new_data,ip', { count: 'exact' });
  if (sp.table) q = q.eq('table_name', sp.table);
  if (sp.action) q = q.eq('action', sp.action);
  if (sp.user) q = q.eq('user_id', sp.user);
  if (sp.from) q = q.gte('created_at', `${sp.from}T00:00:00+05:00`);
  if (sp.to) q = q.lte('created_at', `${sp.to}T23:59:59+05:00`);
  const { data, count } = await q.order('id', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const ids = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
  const { data: users } = ids.length ? await sb.from('profiles').select('id,full_name').in('id', ids) : { data: [] };
  const name = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.full_name]));
  const short = (o: unknown) => { if (!o) return ''; const s = JSON.stringify(o); return s.length > 140 ? s.slice(0, 140) + '…' : s; };
  const qs = (p: number) => `/audit?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][]), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Audit log" description="Who changed what, and when. Entries cannot be edited or deleted." actions={can(ctx, 'audit.export') ? <LinkButton variant="secondary" href={`/api/audit/export?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][])}`}>Export CSV</LinkButton> : undefined} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><select name="table" defaultValue={sp.table ?? ''} className="input sm:w-48"><option value="">Any record type</option>{TABLES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select><select name="action" defaultValue={sp.action ?? ''} className="input sm:w-40"><option value="">Any action</option>{['insert', 'update', 'delete', 'export', 'adjust_invoice', 'generate_invoices', 'exam_status', 'download_document'].map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}</select><input type="date" name="from" defaultValue={sp.from} className="input sm:w-40" aria-label="From" /><input type="date" name="to" defaultValue={sp.to} className="input sm:w-40" aria-label="To" /><button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Filter</button></form>
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No audit entries match" /> : (<><TableWrap><thead><tr><Th>When</Th><Th>User</Th><Th>Action</Th><Th>Record</Th><Th className="hidden lg:table-cell">Old → new</Th></tr></thead><tbody>
        {(data ?? []).map((r: any) => <tr key={r.id} className="align-top"><Td className="whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}{r.ip && <span className="block text-muted">{r.ip}</span>}</Td><Td>{name[r.user_id] ?? <span className="text-muted">system</span>}</Td><Td><Badge tone={r.action === 'delete' ? 'bad' : r.action === 'insert' ? 'ok' : 'info'}>{titleCase(r.action)}</Badge></Td><Td>{titleCase(r.table_name)}<span className="block max-w-[10rem] truncate text-xs text-muted">{r.record_id}</span></Td><Td className="hidden max-w-md text-xs text-muted lg:table-cell"><code className="break-all">{short(r.old_data)}</code>{r.old_data && r.new_data ? ' → ' : ''}<code className="break-all">{short(r.new_data)}</code></Td></tr>)}
      </tbody></TableWrap><Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={qs} /></>)}</Card>
    </>
  );
}
