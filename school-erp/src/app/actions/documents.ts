'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { check, formAction, callAction } from '@/lib/actions';
import { IMAGE_MIMES, MAX_UPLOAD, safeFileName, sniffMime } from '@/lib/files';
import * as v from '@/lib/validation/common';

const DOC_TYPES = ['photo', 'b_form', 'cnic', 'birth_certificate', 'transfer_certificate', 'previous_result', 'medical', 'certificate', 'contract', 'qualification', 'attachment', 'other'] as const;

/** Upload a file for a student or staff member into the private bucket and register it in `documents`. */
export const uploadDocument = formAction({
  permission: 'documents.create',
  schema: z.object({
    owner_type: v.oneOf(['student', 'staff'] as const), owner_id: v.uuid('Owner'), doc_type: v.oneOf(DOC_TYPES, 'Document type'),
    title: v.optText(120), visible_to_guardian: v.bool(), file: z.instanceof(File, { error: 'Choose a file to upload.' }),
  }),
}, async ({ ctx, sb, input }) => {
  const f = input.file;
  if (f.size === 0) throw { code: 'X', message: 'That file is empty.' };
  if (f.size > MAX_UPLOAD) throw { code: 'X', message: 'That file is larger than 10 MB.' };
  const buf = new Uint8Array(await f.arrayBuffer());
  const kind = sniffMime(buf);
  if (!kind) throw { code: 'X', message: 'Only PDF, JPG, PNG, WEBP or Word files can be uploaded.' };
  if (input.doc_type === 'photo' && !IMAGE_MIMES.has(kind.mime)) throw { code: 'X', message: 'A photo must be a JPG, PNG or WEBP image.' };
  if (input.doc_type === 'medical' && !ctx.permissions.includes('documents.sensitive')) throw { code: '42501', message: 'permission_denied' };

  const table = input.owner_type === 'student' ? 'students' : 'staff';
  const { data: owner } = await sb.from(table).select('id,campus_id').eq('id', input.owner_id).maybeSingle();
  if (!owner) throw { code: 'X', message: 'Record not found.' };

  const path = `${ctx.school.id}/${input.owner_type}/${input.owner_id}/${crypto.randomUUID()}-${safeFileName(f.name)}`;
  const up = await sb.storage.from('documents').upload(path, buf, { contentType: kind.mime, upsert: false });
  if (up.error) throw up.error;
  const ins = await sb.from('documents').insert({
    campus_id: owner.campus_id, owner_type: input.owner_type, owner_id: input.owner_id, doc_type: input.doc_type,
    title: input.title ?? f.name.slice(0, 120), storage_path: path, mime_type: kind.mime, size_bytes: f.size,
    visible_to_guardian: input.owner_type === 'student' && input.visible_to_guardian,
  }).select('id').single();
  if (ins.error) { await sb.storage.from('documents').remove([path]); throw ins.error; }
  if (input.doc_type === 'photo') check(await sb.from(table).update({ photo_path: path }).eq('id', input.owner_id).select('id').single());
  revalidatePath(`/${input.owner_type === 'student' ? 'students' : 'staff'}/${input.owner_id}`);
  return { message: 'Uploaded.' };
});

export const deleteDocument = callAction({ permission: 'documents.delete', schema: z.object({ id: v.uuid() }) }, async ({ sb, input }) => {
  const { data: d } = await sb.from('documents').select('storage_path,owner_type,owner_id').eq('id', input.id).single();
  if (!d) throw { code: 'X', message: 'Document not found.' };
  check(await sb.from('documents').delete().eq('id', input.id).select('id').single());
  await sb.storage.from('documents').remove([d.storage_path]);
  revalidatePath(`/${d.owner_type === 'student' ? 'students' : 'staff'}/${d.owner_id}`);
  return { message: 'Deleted.' };
});
