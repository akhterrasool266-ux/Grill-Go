import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { likePattern, titleCase } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Students' };
const PAGE = 25;

type Sp = { q?: string; class?: string; section?: string; status?: string; page?: string };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const ctx = await requirePerm('students.view');
  const { t } = await getT();
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? 'active';

  let q = sb.from('students')
    .select('id,student_code,admission_no,full_name,gender,status,photo_path,father_name,roll_no,classes(name),sections(name),student_guardians(is_primary,guardians(full_name,phone))', { count: 'exact' });
  if (campus) q = q.eq('campus_id', campus);
  if (status !== 'all') q = q.eq('status', status);
  if (sp.class) q = q.eq('class_id', sp.class);
  if (sp.section) q = q.eq('section_id', sp.section);
  if (sp.q) { const p = likePattern(sp.q); q = q.or(`full_name.ilike.${p},student_code.ilike.${p},admission_no.ilike.${p},father_name.ilike.${p}`); }
  const { data, count } = await q.order('full_name').range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []) as any[];
  const opts = await classSectionOptions(sb, campus);
  const params = (p: number) => `/students?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.class ? { class: sp.class } : {}), ...(sp.section ? { section: sp.section } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`;
  const exportQs = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.class ? { class: sp.class } : {}), ...(sp.section ? { section: sp.section } : {}), status });

  return (
    <>
      <PageHeader title={t('students.title')} description={`${count ?? 0} ${status === 'all' ? '' : status} students`}
        actions={<>
          {can(ctx, 'students.export') && <LinkButton variant="secondary" href={`/api/students/export?${exportQs}`}>{t('common.export')}</LinkButton>}
          {can(ctx, 'students.create') && <LinkButton variant="secondary" href="/students/import">{t('students.import')}</LinkButton>}
          {can(ctx, 'students.create') && <LinkButton href="/students/new">+ {t('students.add')}</LinkButton>}
        </>} />

      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Name, ID, father…" className="input col-span-2 sm:w-64" aria-label={t('common.search')} />
        <select name="class" defaultValue={sp.class ?? ''} className="input sm:w-40" aria-label={t('common.class')}><option value="">{t('common.class')}: {t('common.all')}</option>{opts.classes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <select name="section" defaultValue={sp.section ?? ''} className="input sm:w-44" aria-label={t('common.section')}><option value="">{t('common.section')}: {t('common.all')}</option>{opts.sectionsFull.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <select name="status" defaultValue={status} className="input sm:w-36" aria-label={t('common.status')}>{['active', 'all', 'left', 'suspended', 'transferred', 'graduated'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
        <button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">{t('common.filter')}</button>
        {(sp.q || sp.class || sp.section || sp.status) && <Link href="/students" className="self-center text-sm text-muted hover:text-ink">{t('common.reset')}</Link>}
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title={t('students.empty')} hint={can(ctx, 'students.create') ? 'Add your first student, or import a CSV.' : undefined}
            action={can(ctx, 'students.create') ? <LinkButton href="/students/new">+ {t('students.add')}</LinkButton> : undefined} />
        ) : (
          <>
            <TableWrap>
              <thead><tr><Th>{t('common.name')}</Th><Th>{t('students.code')}</Th><Th>{t('common.class')}</Th><Th className="hidden md:table-cell">{t('students.father')}</Th><Th className="hidden lg:table-cell">{t('common.phone')}</Th><Th>{t('common.status')}</Th></tr></thead>
              <tbody>
                {rows.map((s) => {
                  const g = (s.student_guardians ?? []).sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))[0]?.guardians;
                  return (
                    <tr key={s.id} className="hover:bg-surface-2/50">
                      <Td><Link href={`/students/${s.id}`} className="flex items-center gap-3 font-medium hover:text-brand"><Avatar name={s.full_name} size={34} src={s.photo_path ? `/api/photo/${s.id}` : null} />{s.full_name}</Link></Td>
                      <Td className="tabular text-muted">{s.student_code}</Td>
                      <Td>{s.classes?.name ?? '—'}{s.sections?.name ? ` – ${s.sections.name}` : ''}</Td>
                      <Td className="hidden md:table-cell">{s.father_name ?? g?.full_name ?? '—'}</Td>
                      <Td className="hidden lg:table-cell">{g?.phone ? <a className="text-brand hover:underline" href={`tel:${g.phone}`}>{g.phone}</a> : '—'}</Td>
                      <Td><Badge tone={statusTone(s.status)}>{titleCase(s.status)}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? rows.length} hrefFor={params} />
          </>
        )}
      </Card>
    </>
  );
}
