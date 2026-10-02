import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const sb = await createClient();
  const { data: s } = await sb.from('staff').select('photo_path').eq('id', id).maybeSingle();
  if (!s?.photo_path) return new NextResponse(null, { status: 404 });
  const { data } = await sb.storage.from('documents').createSignedUrl(s.photo_path, 120);
  return data?.signedUrl ? NextResponse.redirect(data.signedUrl, 302) : new NextResponse(null, { status: 404 });
}
