import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Student photo: row-level security decides who may see it; the file itself stays in the private bucket. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const sb = await createClient();
  const { data: s } = await sb.from('students').select('photo_path').eq('id', id).maybeSingle();
  if (!s?.photo_path) return new NextResponse(null, { status: 404 });
  const { data } = await sb.storage.from('documents').createSignedUrl(s.photo_path, 120);
  if (!data?.signedUrl) return new NextResponse(null, { status: 404 });
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set('Cache-Control', 'private, max-age=60');
  return res;
}
