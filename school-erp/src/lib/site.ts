import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const CMS_KEYS = ['hero', 'about', 'principal_message', 'contact', 'admissions', 'social'] as const;
export type CmsKey = (typeof CMS_KEYS)[number];
export type Content = Partial<Record<CmsKey, Record<string, any>>>;

/**
 * Public website data. Public pages have no signed-in user, so this uses the service-role client —
 * which bypasses RLS — and is therefore limited to: one active school (by slug), published rows only,
 * and an explicit column list. Nothing else (students, fees, staff records) is reachable from here.
 */
export async function getSite(slug: string) {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const db = createAdminClient();
  const { data: school } = await db.from('schools').select('id,name,short_name,slug,logo_path').eq('slug', slug).eq('status', 'active').maybeSingle();
  if (!school) return null;
  const [content, notices, teachers, campuses] = await Promise.all([
    db.from('cms_content').select('key,value').eq('school_id', school.id),
    db.from('cms_notices').select('id,title,body,published_at').eq('school_id', school.id).eq('is_published', true).order('published_at', { ascending: false }).limit(10),
    db.from('cms_teachers').select('id,name,designation,bio').eq('school_id', school.id).eq('is_published', true).order('sort_order').limit(40),
    db.from('campuses').select('id,name,address,phone').eq('school_id', school.id).eq('is_active', true).order('is_main', { ascending: false }),
  ]);
  const c: Content = {};
  for (const r of content.data ?? []) c[r.key as CmsKey] = r.value as Record<string, any>;
  return { school, content: c, notices: notices.data ?? [], teachers: teachers.data ?? [], campuses: campuses.data ?? [] };
}

export async function getApplyOptions(schoolId: string) {
  const db = createAdminClient();
  const { data } = await db.from('classes').select('id,name,campus_id,level').eq('school_id', schoolId).order('level');
  return data ?? [];
}

/** Only plain http(s) links are ever rendered as links (blocks javascript: URLs typed into the CMS). */
export const safeUrl = (u: unknown) => { try { const x = new URL(String(u)); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null; } catch { return null; } };
