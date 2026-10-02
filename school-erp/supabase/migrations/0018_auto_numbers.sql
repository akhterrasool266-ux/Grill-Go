-- 0018 · Auto-generated document numbers for rows created straight from the app.
set search_path = public, extensions;

create or replace function private.auto_number() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare v_col text := TG_ARGV[0]; v_key text := TG_ARGV[1];
begin
  if coalesce(to_jsonb(new) ->> v_col, '') = '' then
    new := jsonb_populate_record(new, jsonb_build_object(v_col, private.next_number(v_key, new.school_id)));
  end if;
  return new;
end $$;

alter table enquiries alter column enquiry_no drop not null;
alter table admissions alter column application_no drop not null;
create trigger enquiries_number before insert on enquiries for each row execute function private.auto_number('enquiry_no', 'enquiry');
create trigger admissions_number before insert on admissions for each row execute function private.auto_number('application_no', 'application');
-- (columns stay effectively NOT NULL: the trigger fills them before the row is stored)
alter table enquiries add constraint enquiries_no_present check (enquiry_no is not null) not valid;
alter table admissions add constraint admissions_no_present check (application_no is not null) not valid;

-- Queues an announcement as guardian messages (WhatsApp/SMS per school settings).
create or replace function public.queue_announcement(p_announcement uuid) returns int
language plpgsql security definer set search_path = public, private as $$
declare a announcements; s record; v_n int := 0;
begin
  select * into a from announcements where id = p_announcement;
  if not found then raise exception 'announcement_not_found'; end if;
  perform private.require_perm('communication.create');
  if a.school_id <> private.current_school_id() then raise exception 'permission_denied' using errcode = '42501'; end if;
  for s in select id, campus_id from students where school_id = a.school_id and status = 'active'
           and (a.campus_id is null or campus_id = a.campus_id) and (a.class_id is null or class_id = a.class_id) loop
    v_n := v_n + private.queue_guardian_notifications(s.id, 'announcement', jsonb_build_object('title', a.title, 'message', left(a.body, 300)), s.campus_id);
  end loop;
  return v_n;
end $$;
