import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Cell } from '@/components/data/cells';
import { RowActions } from '@/components/data/row-actions';
import { LinkButton } from '@/components/ui/button';
import { Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th } from '@/components/ui/primitives';
import { currentCampus, requireUser } from '@/lib/auth/session';
import { likePattern } from '@/lib/format';
import { getPath, needs } from '@/lib/resources/engine';
import { getResource } from '@/lib/resources/registry';
import { createClient } from '@/lib/supabase/server';

const PAGE = 25;

export async function generateMetadata({ params }: { params: Promise<{ resource: string }> }): Promise<Metadata> {
  const d = getResource((await params).resource);
  return { title: d?.title ?? 'Manage' };
}

export default async function ResourceListPage({ params, searchParams }: { params: Promise<{ resource: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const { resource } = await params;
  const sp = await searchParams;
  const def = getResource(resource);
  if (!def) notFound();
  const ctx = await requireUser();
  if (!needs(ctx, def, 'view')) redirect('/forbidden');

  const campus = def.campusScoped ? await currentCampus(ctx) : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  let q = sb.from(def.table).select(def.select ?? '*', { count: 'exact' });
  if (campus) q = q.eq('campus_id', campus);
  if (sp.q && def.searchCols?.length) q = q.or(def.searchCols.map((c) => `${c}.ilike.${likePattern(sp.q!)}`).join(','));
  const [oc, asc] = def.order ?? ['id', true];
  q = q.order(oc, { ascending: asc }).range((page - 1) * PAGE, page * PAGE - 1);
  const { data, count, error } = await q;
  const rows = (data ?? []) as any[];
  const canEdit = needs(ctx, def, 'edit') && def.canEdit !== false;
  const canCreate = needs(ctx, def, 'create') && def.canCreate !== false;
  const canExport = ctx.permissions.includes(def.exportPerm ?? `${def.perm}.export`) || ctx.permissions.includes('reports.export');
  const rpcs = (def.rowRpcs ?? []).map((r, i) => ({ r, i })).filter(({ r }) => !r.perm || ctx.permissions.includes(r.perm));
  const hrefFor = (p: number) => `/manage/${def.key}?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title={def.title} description={def.description} back={def.hub}
        actions={<>
          {canExport && <LinkButton variant="secondary" href={`/api/export/${def.key}${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ''}`}>Export CSV</LinkButton>}
          {canCreate && <LinkButton href={`/manage/${def.key}/new`}>+ New {def.singular.toLowerCase()}</LinkButton>}
        </>} />
      {def.searchCols?.length ? (
        <form className="mb-4 flex gap-2" role="search"><input name="q" defaultValue={sp.q} placeholder={`Search ${def.title.toLowerCase()}…`} className="input max-w-sm" aria-label="Search" /><button className="rounded-[10px] border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">Search</button>{sp.q && <Link href={`/manage/${def.key}`} className="self-center text-sm text-muted hover:text-ink">Clear</Link>}</form>
      ) : null}
      {error && <p role="alert" className="mb-3 text-sm text-bad">Could not load this list. Please try again.</p>}
      <Card>
        {rows.length === 0 ? (
          <EmptyState title={sp.q ? 'No matches' : `No ${def.title.toLowerCase()} yet`} hint={sp.q ? 'Try a different search.' : canCreate ? `Add your first ${def.singular.toLowerCase()} to get started.` : undefined}
            action={canCreate && !sp.q ? <LinkButton href={`/manage/${def.key}/new`}>+ New {def.singular.toLowerCase()}</LinkButton> : undefined} />
        ) : (
          <>
            <TableWrap>
              <thead><tr>{def.columns.map((c) => <Th key={c.key} className={c.hideOnMobile ? 'hidden md:table-cell' : ''}>{c.label}</Th>)}{(canEdit || rpcs.length > 0) && <Th className="w-px text-end"><span className="sr-only">Actions</span></Th>}</tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-2/50">
                    {def.columns.map((c, i) => (
                      <Td key={c.key} className={c.hideOnMobile ? 'hidden md:table-cell' : ''}>
                        {i === 0 && canEdit ? <Link href={`/manage/${def.key}/${row.id}`} className="font-medium text-brand hover:underline"><Cell type={c.type} value={getPath(row, c.key)} /></Link> : <Cell type={c.type} value={getPath(row, c.key)} />}
                      </Td>
                    ))}
                    {(canEdit || rpcs.length > 0) && (
                      <Td className="text-end"><div className="flex justify-end gap-1.5">
                        <RowActions resource={def.key} id={row.id} rpcs={rpcs.filter(({ r }) => !r.when || r.when(row)).map(({ r, i }) => ({ index: i, label: r.label, tone: r.tone ?? 'secondary', confirm: r.confirm }))} />
                        {canEdit && <LinkButton href={`/manage/${def.key}/${row.id}`} variant="ghost" size="sm">Edit</LinkButton>}
                      </div></Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? rows.length} hrefFor={hrefFor} />
          </>
        )}
      </Card>
    </>
  );
}
