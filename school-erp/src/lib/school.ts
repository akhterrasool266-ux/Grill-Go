import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SchoolInfo { name: string; address: string | null; city: string | null; phone: string | null; email: string | null; website: string | null; logo_path: string | null }
export async function getSchoolInfo(sb: SupabaseClient, schoolId: string): Promise<SchoolInfo> {
  const { data } = await sb.from('schools').select('name,address,city,phone,email,website,logo_path').eq('id', schoolId).single();
  return (data ?? { name: 'School', address: null, city: null, phone: null, email: null, website: null, logo_path: null }) as SchoolInfo;
}
export function logoUrl(s: Pick<SchoolInfo, 'logo_path'>, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  return s.logo_path && supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/public-assets/${s.logo_path}` : null;
}
