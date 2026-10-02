import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Opt { value: string; label: string }

/** Classes, sections and houses for pickers; limited to the campus when one is selected. */
export async function classSectionOptions(sb: SupabaseClient, campus: string | null) {
  let cq = sb.from('classes').select('id,name,level,campus_id,campuses(name)').eq('is_active', true).order('level').order('name');
  let sq = sb.from('sections').select('id,name,class_id,campus_id,classes(name,level)').order('name');
  if (campus) { cq = cq.eq('campus_id', campus); sq = sq.eq('campus_id', campus); }
  const [{ data: classes }, { data: sections }, { data: houses }] = await Promise.all([cq, sq, sb.from('houses').select('id,name').order('name')]);
  const multi = new Set((classes ?? []).map((c: any) => c.campus_id)).size > 1;
  return {
    classes: (classes ?? []).map((c: any) => ({ value: c.id as string, label: multi ? `${c.name} · ${c.campuses?.name ?? ''}` : (c.name as string) })),
    sections: (sections ?? []).map((s: any) => ({ value: s.id as string, class_id: s.class_id as string, label: `${s.name}` })),
    sectionsFull: (sections ?? []).map((s: any) => ({ value: s.id as string, class_id: s.class_id as string, label: `${s.classes?.name ?? ''} – ${s.name}`, level: s.classes?.level as number })),
    houses: (houses ?? []).map((h: any) => ({ value: h.id as string, label: h.name as string })),
  };
}
