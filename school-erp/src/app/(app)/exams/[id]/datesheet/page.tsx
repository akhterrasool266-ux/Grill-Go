import { notFound } from 'next/navigation';
import { Letterhead, Sheet } from '@/components/data/print-doc';
import { PrintButton } from '@/components/ui/print-button';
import { PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { fmtDate, fmtTime } from '@/lib/format';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';

export default async function Datesheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePerm('exams.view');
  const sb = await createClient();
  const { data: e } = await sb.from('exams').select('id,name').eq('id', id).maybeSingle();
  if (!e) notFound();
  const { data } = await sb.from('exam_subjects').select('exam_date,start_time,end_time,max_marks,subjects(name),classes(name,level)').eq('exam_id', id);
  const school = await getSchoolInfo(sb, ctx.school.id);
  const byClass = new Map<string, any[]>();
  for (const p of ((data ?? []) as any[]).sort((a, b) => String(a.exam_date).localeCompare(String(b.exam_date)))) { const k = `${String(p.classes?.level).padStart(3, '0')}|${p.classes?.name}`; byClass.set(k, [...(byClass.get(k) ?? []), p]); }
  return (<><PageHeader title="Datesheet" back={{ href: `/exams/${id}`, label: e.name }} actions={<PrintButton />} /><Sheet><Letterhead school={school} title={`Datesheet — ${e.name}`} />
    {[...byClass.entries()].sort().map(([k, rows]) => (<section key={k} className="break-inside-avoid"><h3 className="mb-1 mt-3 text-sm font-bold">{k.split('|')[1]}</h3><table className="w-full text-sm"><thead><tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500"><th className="py-1">Date</th><th>Subject</th><th>Time</th><th className="text-right">Marks</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-neutral-200"><td className="py-1">{fmtDate(r.exam_date)}</td><td>{r.subjects?.name}</td><td>{r.start_time ? `${fmtTime(r.start_time)} – ${fmtTime(r.end_time)}` : ''}</td><td className="text-right">{r.max_marks}</td></tr>)}</tbody></table></section>))}
  </Sheet></>);
}
