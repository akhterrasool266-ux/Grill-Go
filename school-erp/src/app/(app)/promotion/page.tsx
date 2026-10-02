import type { Metadata } from 'next';
import { PromotionTable, type PromoRow } from '@/components/data/exam-forms';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Promotion' };

export default async function PromotionPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const ctx = await requirePerm('promotion.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const opts = await classSectionOptions(sb, campus);
  const { data: years } = await sb.from('academic_years').select('id,name,start_date,is_current').order('start_date', { ascending: false });
  const cur = (years ?? []).find((y: any) => y.is_current);
  const future = (years ?? []).filter((y: any) => cur && y.start_date > cur.start_date);
  let rows: PromoRow[] = [];
  if (sp.section) {
    const { data: st } = await sb.from('students').select('id,full_name,student_code,classes(name,next:classes!classes_next_class_id_fkey(name)),sections(name)').eq('section_id', sp.section).eq('status', 'active').order('roll_no', { nullsFirst: false }).order('full_name');
    const ids = (st ?? []).map((s: any) => s.id);
    const { data: res } = ids.length ? await sb.from('result_cards').select('student_id,percentage,result_status,generated_at').in('student_id', ids).order('generated_at') : { data: [] };
    const last = Object.fromEntries(((res ?? []) as any[]).map((r) => [r.student_id, r]));
    const { data: done } = ids.length && cur ? await sb.from('promotions').select('student_id').eq('from_academic_year_id', cur.id).in('student_id', ids) : { data: [] };
    const doneSet = new Set((done ?? []).map((d: any) => d.student_id));
    rows = (st ?? []).filter((s: any) => !doneSet.has(s.id)).map((s: any) => ({ id: s.id, name: s.full_name, code: s.student_code, cls: s.classes?.name, section: s.sections?.name, nextClass: s.classes?.next?.name ?? null, pct: last[s.id] ? Number(last[s.id].percentage) : null, status: last[s.id]?.result_status ?? null }));
  }
  return (
    <>
      <PageHeader title="Promotion" description="Move a whole section to the next class at year end. Previous years' marks, attendance and fees are never overwritten." />
      {!cur && <Alert tone="warn">No current academic year is set.</Alert>}
      {cur && future.length === 0 && <div className="mb-4"><Alert tone="warn" title="Create next year first">Add the next academic year under Academics → Academic years (starting after {cur.name}) so students can be promoted into it. Then mark it current when the new session begins.</Alert></div>}
      <form className="mb-4 flex gap-2"><select name="section" defaultValue={sp.section ?? ''} className="input w-64" aria-label="Section"><option value="">Choose a section…</option>{opts.sectionsFull.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Open</button></form>
      {sp.section && rows.length === 0 ? <Card><EmptyState title="Nothing to promote here" hint="Everyone in this section has already been processed for this year." /></Card>
        : rows.length > 0 && can(ctx, 'promotion.create') && future.length > 0 ? <PromotionTable rows={rows} toYears={future.map((y: any) => ({ value: y.id, label: y.name }))} sectionsByNext={{}} /> : null}
    </>
  );
}
