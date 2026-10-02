-- 0006 · Examinations, grading, marks, result cards.
set search_path = public, extensions;

create table grading_systems (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  kind text not null default 'grade' check (kind in ('percentage','grade','gpa')),
  use_gpa boolean not null default false,
  pass_percentage numeric(5,2) not null default 40 check (pass_percentage between 0 and 100),
  is_default boolean not null default false,
  unique (school_id, name),
  unique (id, school_id)
);
create unique index grading_systems_one_default on grading_systems(school_id) where is_default;

create table grade_bands (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  grading_system_id uuid not null references grading_systems(id) on delete cascade,
  grade text not null,
  min_percent numeric(5,2) not null check (min_percent >= 0),
  max_percent numeric(5,2) not null check (max_percent <= 100),
  gpa_points numeric(3,2),
  description text,
  is_pass boolean not null default true,
  check (max_percent >= min_percent),
  unique (grading_system_id, grade),
  -- bands of one system may not overlap
  exclude using gist (grading_system_id with =, numrange(min_percent, max_percent, '[]') with &&)
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  name text not null,
  kind text not null default 'term' check (kind in ('monthly','test','midterm','term','final')),
  grading_system_id uuid references grading_systems(id) on delete restrict,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft','scheduled','marks_entry','locked','published')),
  position_scope text not null default 'section' check (position_scope in ('none','section','class')),
  published_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  unique (id, campus_id),
  unique (campus_id, academic_year_id, name)
);

-- Doubles as the datesheet: one row per (exam, class, subject).
create table exam_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  exam_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null references subjects(id) on delete cascade,
  exam_date date,
  start_time time,
  end_time time,
  room_id uuid references rooms(id) on delete set null,
  max_marks numeric(6,2) not null default 100 check (max_marks > 0),
  passing_marks numeric(6,2) not null default 40 check (passing_marks >= 0),
  foreign key (exam_id, campus_id) references exams(id, campus_id) on delete cascade,
  foreign key (class_id, campus_id) references classes(id, campus_id) on delete cascade,
  unique (exam_id, class_id, subject_id),
  unique (id, campus_id),
  check (passing_marks <= max_marks),
  check (end_time is null or start_time is null or end_time > start_time)
);

create table marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  exam_subject_id uuid not null,
  student_id uuid not null,
  section_id uuid references sections(id) on delete set null,
  marks_obtained numeric(6,2) check (marks_obtained is null or marks_obtained >= 0),
  is_absent boolean not null default false,
  remarks text,
  entered_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (exam_subject_id, campus_id) references exam_subjects(id, campus_id) on delete cascade,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  unique (exam_subject_id, student_id),
  check (not is_absent or marks_obtained is null)
);
create index marks_student on marks(student_id);

create or replace function private.marks_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare v_max numeric; v_status text;
begin
  select es.max_marks, e.status into v_max, v_status
    from exam_subjects es join exams e on e.id = es.exam_id where es.id = new.exam_subject_id;
  if new.marks_obtained is not null and new.marks_obtained > v_max then
    raise exception 'marks_exceed_max: % > %', new.marks_obtained, v_max;
  end if;
  if v_status in ('locked','published') and not private.has_perm('marks.approve') then
    raise exception 'marks_locked: exam is %', v_status using errcode = '42501';
  end if;
  return new;
end $$;
create trigger marks_guard before insert or update on marks for each row execute function private.marks_guard();

create table result_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  exam_id uuid not null,
  student_id uuid not null,
  class_id uuid,
  section_id uuid,
  total_max numeric(8,2) not null default 0,
  total_obtained numeric(8,2) not null default 0,
  percentage numeric(5,2) not null default 0,
  grade text,
  gpa numeric(3,2),
  position int,
  result_status text not null default 'pass' check (result_status in ('pass','fail','absent','incomplete')),
  attendance_percent numeric(5,2),
  teacher_remarks text,
  principal_remarks text,
  subjects jsonb not null default '[]',        -- snapshot of subject lines at generation time
  is_published boolean not null default false,
  generated_at timestamptz not null default now(),
  foreign key (exam_id, campus_id) references exams(id, campus_id) on delete cascade,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  unique (exam_id, student_id)
);
create index result_cards_student on result_cards(student_id);

create trigger exams_updated before update on exams for each row execute function private.set_updated_at();
create trigger marks_updated before update on marks for each row execute function private.set_updated_at();

create trigger audit_exams after insert or update or delete on exams for each row execute function private.audit_trigger();
create trigger audit_marks after update or delete on marks for each row execute function private.audit_trigger();
create trigger audit_grading_systems after insert or update or delete on grading_systems for each row execute function private.audit_trigger();
create trigger audit_grade_bands after insert or update or delete on grade_bands for each row execute function private.audit_trigger();
create trigger audit_result_cards after update or delete on result_cards for each row execute function private.audit_trigger();

call private.apply_rls('grading_systems', 'exams', false, null, 'true');
call private.apply_rls('grade_bands', 'exams', false, null, 'true');
call private.apply_rls('exams', 'exams', true, null, 'campus_id in (select private.my_campus_ids()) and status in (''scheduled'',''marks_entry'',''locked'',''published'')');
call private.apply_rls('exam_subjects', 'exams', true, null,
  'class_id in (select private.my_class_ids()) and exam_id in (select e.id from public.exams e where e.status <> ''draft'')');

-- Marks: teachers write only for sections they are assigned to.
call private.apply_rls('marks', 'marks', true, 'private.can_access_section(section_id)',
  'student_id in (select private.my_student_ids()) and exam_subject_id in (select es.id from public.exam_subjects es join public.exams e on e.id = es.exam_id where e.status = ''published'')');
-- Result cards are produced by generate_results(); clients only read, and
-- portals only see published ones.
call private.apply_rls('result_cards', 'results', true, null,
  'is_published and student_id in (select private.my_student_ids())', false);
create policy result_cards_remarks on result_cards for update to authenticated
  using (school_id = (select private.current_school_id()) and private.can_access_campus(campus_id)
         and private.has_perm('results.create') and not is_published and private.can_access_section(section_id))
  with check (school_id = (select private.current_school_id()) and private.can_access_campus(campus_id)
         and private.has_perm('results.create') and not is_published);
