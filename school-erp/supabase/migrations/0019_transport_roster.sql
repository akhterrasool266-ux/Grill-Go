-- 0019 · Drivers see only the children on their own route(s), nothing else about students.
set search_path = public, extensions;

create or replace function public.my_route_roster()
returns table (route_id uuid, route_name text, campus_id uuid, student_id uuid, student_name text, student_code text, class_name text, stop_name text, stop_order int, pickup_time time,
               pickup_status text, drop_status text)
language sql stable security definer set search_path = public, private as $$
  select r.id, r.name, r.campus_id, s.id, s.full_name, s.student_code, c.name, rs.name, rs.stop_order, rs.pickup_time,
         (select ra.status from route_attendance ra where ra.student_id = s.id and ra.date = private.today() and ra.trip = 'pickup'),
         (select ra.status from route_attendance ra where ra.student_id = s.id and ra.date = private.today() and ra.trip = 'drop')
  from routes r
  join drivers d on d.id = r.driver_id and d.profile_id = auth.uid()
  join student_transport st on st.route_id = r.id and st.is_active
  join students s on s.id = st.student_id and s.status = 'active'
  left join classes c on c.id = s.class_id
  left join route_stops rs on rs.id = st.pickup_stop_id
  where r.is_active
  order by r.name, rs.stop_order nulls last, s.full_name
$$;

create or replace function public.mark_route_attendance(p_route uuid, p_student uuid, p_trip text, p_status text) returns void
language plpgsql security definer set search_path = public, private as $$
declare r routes;
begin
  select * into r from routes where id = p_route;
  if not found then raise exception 'route_not_found'; end if;
  if not (private.is_my_route(p_route) or (private.has_perm('transport.edit') and private.can_access_campus(r.campus_id))) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_trip not in ('pickup','drop') or p_status not in ('boarded','absent','dropped') then raise exception 'invalid_status'; end if;
  if not exists (select 1 from student_transport where route_id = p_route and student_id = p_student and is_active) then raise exception 'student_not_on_route'; end if;
  insert into route_attendance (school_id, campus_id, route_id, student_id, date, trip, status)
  values (r.school_id, r.campus_id, p_route, p_student, private.today(), p_trip, p_status)
  on conflict (student_id, date, trip) do update set status = excluded.status, marked_by = auth.uid(), marked_at = now();
end $$;
