import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Download a stored document: the `documents` row must be visible to the caller (RLS), then a 60-second signed URL is issued. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const sb = await createClient();
  const { data: d } = await sb.from('documents').select('storage_path,title').eq('id', id).maybeSingle();
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data } = await sb.storage.from('documents').createSignedUrl(d.storage_path, 60, { download: d.title });
  if (!data?.signedUrl) return NextResponse.json({ error: 'File unavailable' }, { status: 404 });
  await sb.rpc('log_audit', { p_action: 'download_document', p_table: 'documents', p_record: id });
  return NextResponse.redirect(data.signedUrl, 302);
}
