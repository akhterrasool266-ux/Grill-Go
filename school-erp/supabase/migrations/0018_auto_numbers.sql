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
