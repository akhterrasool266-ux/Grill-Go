-- 0004 · Attendance (students + staff) and timetable.
set search_path = public, extensions;

create table student_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  section_id uuid references sections(id) on delete set null,
  academic_year_id uuid references academic_years(id) on delete set null,
  date date not null,
  status text not null check (status in ('present','absent','late','leave','half_day')),
  method text not null default 'manual' check (method in ('manual','qr','biometric','api')),
  check_in_time time,
  remarks text,
  correction_reason text,
  marked_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  unique (student_id, date)
);
create index student_attendance_section_date on student_attendance(section_id, date);
create index student_attendance_campus_date on student_attendance(campus_id, date);

create table staff_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  staff_id uuid not null,
  date date not null,
  status text not null check (status in ('present','absent','late','leave','half_day','holiday')),
  check_in time,
  check_out time,
  overtime_minutes int not null default 0 check (overtime_minutes >= 0),
  method text not null default 'manual' check (method in ('manual','qr','biometric','api','self')),
  remarks text,
  marked_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete cascade,
  unique (staff_id, date)
);
create index staff_attendance_campus_date on staff_attendance(campus_id, date);

-- Device / API integration point (biometric terminals, turnstiles, …).
-- Raw punches are stored untouched and reconciled into attendance by a worker.
create table attendance_device_events (
  id bigint generated always as identity primary key,
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  device_id text not null,
  subject_type text not null check (subject_type in ('student','staff')),
  subject_code text not null,
  punched_at timestamptz not null,
  processed_at timestamptz,
  raw jsonb,
  unique (device_id, subject_code, punched_at)
);

create table timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  section_id uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),   -- 1 = Monday
  period_id uuid not null,
  subject_id uuid references subjects(id) on delete set null,
  staff_id uuid,
  room_id uuid,
  foreign key (section_id, campus_id) references sections(id, campus_id) on delete cascade,
  foreign key (period_id, campus_id) references periods(id, campus_id) on delete cascade,
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete set null (staff_id),
  foreign key (room_id, campus_id) references rooms(id, campus_id) on delete set null (room_id)
);
-- Clash detection is enforced by the database, not just the UI.
create unique index timetable_section_slot on timetable_entries(academic_year_id, section_id, day_of_week, period_id);
create unique index timetable_teacher_slot on timetable_entries(academic_year_id, staff_id, day_of_week, period_id) where staff_id is not null;
create unique index timetable_room_slot on timetable_entries(academic_year_id, room_id, day_of_week, period_id) where room_id is not null;

create or replace function private.timetable_no_break() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from periods p where p.id = new.period_id and p.is_break) then
    raise exception 'break_period: lessons cannot be scheduled in a break';
  end if;
  return new;
end $$;
create trigger timetable_no_break before insert or update on timetable_entries
  for each row execute function private.timetable_no_break();

create trigger student_attendance_updated before update on student_attendance for each row execute function private.set_updated_at();
create trigger staff_attendance_updated before update on staff_attendance for each row execute function private.set_updated_at();

-- Corrections are audited (old → new). Initial marks are not (volume).
create trigger audit_student_attendance after update or delete on student_attendance for each row execute function private.audit_trigger();
create trigger audit_staff_attendance after update or delete on staff_attendance for each row execute function private.audit_trigger();
create trigger audit_timetable after insert or update or delete on timetable_entries for each row execute function private.audit_trigger();

-- Student attendance is written through mark_attendance() so that corrections
-- always carry a reason and the right permission.
call private.apply_rls('student_attendance', 'attendance', true, 'private.can_access_section(section_id)',
  'student_id in (select private.my_student_ids())', false);
call private.apply_rls('staff_attendance', 'staff_attendance', true, null, 'staff_id = private.my_staff_id()');
call private.apply_rls('timetable_entries', 'timetable', true, null,
  'section_id in (select private.my_section_ids()) or staff_id = private.my_staff_id()');
call private.apply_rls('attendance_device_events', 'attendance', true, null, null, false);
