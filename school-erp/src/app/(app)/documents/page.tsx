import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfirmAction } from '@/components/ui/confirm-form';
import { Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { deleteDocument } from '@/app/actions/documents';

export const metadata: Metadata = { title: 'Documents' };
const PAGE = 30;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string; owner?: string; page?: string }> }) {
  const ctx = await requirePerm('documents.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  let q = sb.from('documents').select('id,title,doc_type,owner_type,owner_id,size_bytes,created_at,visible_to_guardian', { count: 'exact' });
  if (campus) q = q.eq('campus_id', campus);
  if (sp.type) q = q.eq('doc_type', sp.type);
  if (sp.owner) q = q.eq('owner_type', sp.owner);
  const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const href = (o: any) => (o.owner_type === 'student' ? `/students/${o.owner_id}?tab=documents` : o.owner_type === 'staff' ? `/staff/${o.owner_id}?tab=documents` : '#');
  return (
    <>
      <PageHeader title="Documents" description="Student and staff files live in a private store. Upload them from the student or staff profile; every download is logged." />
      <form className="mb-4 flex flex-wrap gap-2"><select name="owner" defaultValue={sp.owner ?? ''} className="input w-40"><option value="">All records</option><option value="student">Students</option><option value="staff">Staff</option></select><select name="type" defaultValue={sp.type ?? ''} className="input w-48"><option value="">Any type</option>{['photo', 'b_form', 'cnic', 'birth_certificate', 'transfer_certificate', 'previous_result', 'medical', 'certificate', 'contract', 'qualification', 'other'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select><button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Filter</button></form>
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No documents" /> : (<><TableWrap><thead><tr><Th>File</Th><Th>Type</Th><Th className="hidden sm:table-cell">Uploaded</Th><Th>Owner</Th><Th><span className="sr-only">Actions</span></Th></tr></thead><tbody>
        {(data ?? []).map((d: any) => <tr key={d.id}><Td><a className="font-medium text-brand hover:underline" href={`/api/files/${d.id}`}>{d.title}</a>{d.visible_to_guardian && <Badge tone="info" className="ms-2">Shared</Badge>}</Td><Td>{titleCase(d.doc_type)}</Td><Td className="hidden sm:table-cell">{fmtDate(d.created_at)}</Td><Td><Link className="text-sm text-brand hover:underline" href={href(d)}>{titleCase(d.owner_type)} →</Link></Td><Td className="text-end">{can(ctx, 'documents.delete') && <ConfirmAction action={deleteDocument} data={{ id: d.id }} title="Delete this document?" message="The file is removed from storage." confirmLabel="Delete" variant="ghost">Delete</ConfirmAction>}</Td></tr>)}
      </tbody></TableWrap><Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/documents?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), ...(sp.owner ? { owner: sp.owner } : {}), page: String(p) })}`} /></>)}</Card>
    </>
  );
}
