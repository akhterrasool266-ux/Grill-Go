-- 0016 · Class/section names are reference data every staff member needs to read
-- (cashiers, librarians, gate staff …). Reading is allowed within a user's campuses;
-- writing still needs academics.* permissions.
set search_path = public, extensions;

create policy classes_read_campus on classes for select to authenticated
  using (school_id = (select private.current_school_id()) and private.can_access_campus(campus_id));
create policy sections_read_campus on sections for select to authenticated
  using (school_id = (select private.current_school_id()) and private.can_access_campus(campus_id));
create policy rooms_read_campus on rooms for select to authenticated
  using (school_id = (select private.current_school_id()) and private.can_access_campus(campus_id));
create policy periods_read_campus on periods for select to authenticated
  using (school_id = (select private.current_school_id()) and private.can_access_campus(campus_id));
