-- 0013 · Storage buckets and policies.
--   documents      PRIVATE. Student/staff/admission documents, photos, homework files.
--                  Path:  <school_id>/<owner_type>/<owner_id>/<uuid>-<filename>
--                  Files are only readable if a row in `documents` exists for the path AND
--                  the reader may see that row (so permissions + campus + guardian rules apply).
--   public-assets  PUBLIC read. School logo, favicon, website gallery.
--                  Path:  <school_id>/...   Writable by users with settings.edit / cms.edit.
set search_path = public, extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 10485760,
   array['image/jpeg','image/png','image/webp','application/pdf','application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv']),
  ('public-assets', 'public-assets', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = (select private.current_school_id())::text
         and exists (select 1 from public.documents d where d.storage_path = objects.name));

drop policy if exists documents_upload on storage.objects;
create policy documents_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
         and (storage.foldername(name))[1] = (select private.current_school_id())::text
         and (private.has_perm('documents.create') or private.has_perm('homework.create')
              or private.has_perm('students.edit') or private.has_perm('staff.edit') or private.has_perm('admissions.create')));

drop policy if exists documents_remove on storage.objects;
create policy documents_remove on storage.objects for delete to authenticated
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = (select private.current_school_id())::text
         and private.has_perm('documents.delete'));

drop policy if exists assets_write on storage.objects;
create policy assets_write on storage.objects for all to authenticated
  using (bucket_id = 'public-assets' and (storage.foldername(name))[1] = (select private.current_school_id())::text
         and (private.has_perm('settings.edit') or private.has_perm('cms.edit')))
  with check (bucket_id = 'public-assets' and (storage.foldername(name))[1] = (select private.current_school_id())::text
         and (private.has_perm('settings.edit') or private.has_perm('cms.edit')));
