-- 0003 · Academic structure, families, students, admissions, documents, promotion.
set search_path = public, extensions;

-- ───────────────────────── academic structure ─────────────────────────
create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date > start_date),
  unique (school_id, name),
  unique (id, school_id)
);
create unique index academic_years_one_current on academic_years(school_id) where is_current;

create table terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  sort_order int not null default 0,
  check (end_date >= start_date),
  unique (academic_year_id, name)
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  name_ur text,
  unique (school_id, name)
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  code text not null,
  name text not null,
  name_ur text,
  department_id uuid references departments(id) on delete set null,
  is_elective boolean not null default false,
  unique (school_id, code)
);

create table houses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  color text,
  unique (school_id, name)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  name text not null,
  level int not null default 0,                 -- ordering + promotion path
  next_class_id uuid references classes(id) on delete set null,
  is_active boolean not null default true,
  unique (campus_id, name),
  unique (id, campus_id)
);
create index classes_school on classes(school_id, campus_id);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  name text not null,
  kind text not null default 'classroom' check (kind in ('classroom','lab','library','hall','office','other')),
  capacity int,
  unique (campus_id, name),
  unique (id, campus_id)
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  class_id uuid not null,
  name text not null,
  capacity int,
  room_id uuid references rooms(id) on delete set null,
  foreign key (class_id, campus_id) references classes(id, campus_id) on delete cascade,
  unique (class_id, name),
  unique (id, campus_id)
);
create index sections_class on sections(class_id);

create table class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null references subjects(id) on delete cascade,
  periods_per_week int,
  foreign key (class_id, campus_id) references classes(id, campus_id) on delete cascade,
  unique (class_id, subject_id)
);

create table periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  sort_order int not null default 0,
  check (end_time > start_time),
  unique (campus_id, name),
  unique (id, campus_id)
);

-- ───────────────────────── staff (needed by assignments) ─────────────────────────
create table designations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  unique (school_id, name)
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete restrict,
  employee_code text not null,
  profile_id uuid unique references profiles(id) on delete set null,
  full_name text not null,
  photo_path text,
  gender text check (gender in ('male','female','other')),
  dob date,
  cnic text check (cnic is null or cnic ~ '^\d{5}-?\d{7}-?\d$'),
  phone text, email text, address text,
  department_id uuid references departments(id) on delete set null,
  designation_id uuid references designations(id) on delete set null,
  joining_date date not null default current_date,
  employment_type text not null default 'permanent' check (employment_type in ('permanent','contract','part_time','visiting')),
  qualification text,
  experience_years numeric(4,1),
  bank_name text, bank_account text,
  shift_start time not null default '08:00',
  shift_end time not null default '14:00',
  status text not null default 'active' check (status in ('active','on_leave','resigned','terminated')),
  left_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, employee_code),
  unique (id, campus_id)
);
create index staff_campus on staff(campus_id, status);
create index staff_name_trgm on staff using gin (full_name gin_trgm_ops);

create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  section_id uuid not null,
  subject_id uuid references subjects(id) on delete cascade,   -- null + is_class_teacher = form teacher
  staff_id uuid not null,
  is_class_teacher boolean not null default false,
  foreign key (section_id, campus_id) references sections(id, campus_id) on delete cascade,
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete cascade,
  check (subject_id is not null or is_class_teacher)
);
create unique index teacher_assignments_subject on teacher_assignments(academic_year_id, section_id, subject_id, staff_id) where subject_id is not null;
create unique index teacher_assignments_class_teacher on teacher_assignments(academic_year_id, section_id) where is_class_teacher;
create index teacher_assignments_staff on teacher_assignments(staff_id);

-- ───────────────────────── families, guardians, students ─────────────────────────
create table families (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  family_code text not null,
  family_name text not null,
  address text, city text, province text,
  primary_phone text,
  notes text,
  created_at timestamptz not null default now(),
  unique (school_id, family_code)
);
create index families_name_trgm on families using gin (family_name gin_trgm_ops);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  family_id uuid references families(id) on delete set null,
  profile_id uuid unique references profiles(id) on delete set null,
  full_name text not null,
  relation text not null default 'father' check (relation in ('father','mother','guardian','other')),
  cnic text check (cnic is null or cnic ~ '^\d{5}-?\d{7}-?\d$'),
  phone text,
  whatsapp text,
  email text,
  occupation text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guardians_family on guardians(family_id);
create index guardians_name_trgm on guardians using gin (full_name gin_trgm_ops);
create index guardians_phone on guardians(phone);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete restrict,
  student_code text not null,
  admission_no text not null,
  roll_no text,
  full_name text not null,
  photo_path text,
  gender text not null check (gender in ('male','female','other')),
  dob date,
  b_form_no text check (b_form_no is null or b_form_no ~ '^\d{5}-?\d{7}-?\d$'),
  father_name text,
  mother_name text,
  family_id uuid references families(id) on delete set null,
  profile_id uuid unique references profiles(id) on delete set null,
  emergency_contact_name text,
  emergency_contact_phone text,
  address text, city text, province text,
  previous_school text,
  admission_date date not null default current_date,
  academic_year_id uuid references academic_years(id) on delete set null,
  class_id uuid,
  section_id uuid,
  house_id uuid references houses(id) on delete set null,
  blood_group text check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  medical_notes text,
  hostel_status boolean not null default false,
  status text not null default 'active' check (status in ('active','left','graduated','transferred','suspended')),
  left_date date,
  left_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_code),
  unique (school_id, admission_no),
  unique (id, campus_id),
  foreign key (class_id, campus_id) references classes(id, campus_id) on delete set null (class_id),
  foreign key (section_id, campus_id) references sections(id, campus_id) on delete set null (section_id)
);
create index students_campus_status on students(campus_id, status);
create index students_section on students(section_id) where status = 'active';
create index students_family on students(family_id);
create index students_name_trgm on students using gin (full_name gin_trgm_ops);
create index students_code_trgm on students using gin (student_code gin_trgm_ops);

-- Campus is part of identity (composite FKs hang off it); moving a child to
-- another campus is an inter-campus transfer, done by re-admission.
create or replace function private.students_immutable_campus() returns trigger
language plpgsql as $$
begin
  if new.campus_id is distinct from old.campus_id then
    raise exception 'campus_immutable: use a transfer admission to move a student to another campus';
  end if;
  return new;
end $$;
create trigger students_campus_lock before update on students
  for each row execute function private.students_immutable_campus();

create table student_guardians (
  student_id uuid not null references students(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  relation text,
  is_primary boolean not null default false,
  is_emergency boolean not null default false,
  pays_fees boolean not null default false,
  primary key (student_id, guardian_id)
);
create index student_guardians_guardian on student_guardians(guardian_id);
create unique index student_guardians_one_primary on student_guardians(student_id) where is_primary;

-- Portal identity helpers (security definer → bypass RLS, no recursion).
create or replace function private.my_student_ids() returns setof uuid
language sql stable security definer set search_path = public, private as $$
  select s.id from public.students s where s.profile_id = auth.uid()
  union
  select sg.student_id from public.student_guardians sg
    join public.guardians g on g.id = sg.guardian_id where g.profile_id = auth.uid()
$$;

create or replace function private.my_section_ids() returns setof uuid
language sql stable security definer set search_path = public, private as $$
  select s.section_id from public.students s where s.id in (select private.my_student_ids()) and s.section_id is not null
$$;

create or replace function private.my_class_ids() returns setof uuid
language sql stable security definer set search_path = public, private as $$
  select s.class_id from public.students s where s.id in (select private.my_student_ids()) and s.class_id is not null
$$;

create or replace function private.my_campus_ids() returns setof uuid
language sql stable security definer set search_path = public, private as $$
  select s.campus_id from public.students s where s.id in (select private.my_student_ids())
  union
  select uc.campus_id from public.user_campuses uc where uc.user_id = auth.uid()
$$;

create or replace function private.my_staff_id() returns uuid
language sql stable security definer set search_path = public, private as $$
  select id from public.staff where profile_id = auth.uid() limit 1
$$;

-- Teachers see only sections they teach (or are class teacher of), unless the
-- role carries classes.all.
create or replace function private.can_access_section(p_section uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select private.has_perm('classes.all')
      or (p_section is not null and exists (
            select 1 from public.teacher_assignments ta
            join public.staff st on st.id = ta.staff_id
            where ta.section_id = p_section and st.profile_id = auth.uid()))
$$;

create or replace function private.current_year(p_school uuid default null) returns uuid
language sql stable security definer set search_path = public, private as $$
  select id from public.academic_years where school_id = coalesce(p_school, private.current_school_id()) and is_current
$$;

-- ───────────────────────── enquiries & admissions ─────────────────────────
create table enquiries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  enquiry_no text not null,
  child_name text not null,
  gender text check (gender in ('male','female','other')),
  class_sought_id uuid references classes(id) on delete set null,
  guardian_name text not null,
  phone text not null,
  email text,
  source text not null default 'walk_in' check (source in ('walk_in','phone','website','whatsapp','referral','social','other')),
  status text not null default 'new' check (status in ('new','contacted','visited','converted','lost')),
  followup_date date,
  notes text,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, enquiry_no)
);
create index enquiries_campus_status on enquiries(campus_id, status);

create table admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  application_no text not null,
  enquiry_id uuid references enquiries(id) on delete set null,
  type text not null default 'new' check (type in ('new','transfer','readmission')),
  stage text not null default 'application' check (stage in
    ('application','document_verification','test_interview','approval','admitted','rejected','waitlisted','withdrawn')),
  academic_year_id uuid references academic_years(id) on delete set null,
  class_applied_id uuid references classes(id) on delete set null,
  full_name text not null,
  gender text not null check (gender in ('male','female','other')),
  dob date,
  b_form_no text,
  father_name text,
  mother_name text,
  guardian_name text not null,
  guardian_relation text not null default 'father',
  guardian_cnic text,
  phone text not null,
  whatsapp text,
  email text,
  address text, city text, province text,
  previous_school text, previous_class text, transfer_certificate_no text,
  documents_verified boolean not null default false,
  test_date date, test_score numeric(6,2), test_max numeric(6,2),
  interview_date timestamptz, interview_notes text,
  decision_by uuid references profiles(id) on delete set null,
  decision_at timestamptz,
  decision_notes text,
  student_id uuid references students(id) on delete set null,
  source text not null default 'staff' check (source in ('staff','online')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, application_no),
  check (test_score is null or test_max is null or test_score <= test_max)
);
create index admissions_campus_stage on admissions(campus_id, stage);

alter table enquiries add column converted_admission_id uuid references admissions(id) on delete set null;

-- ───────────────────────── documents ─────────────────────────
create table documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  owner_type text not null check (owner_type in ('student','staff','admission','school','homework','announcement')),
  owner_id uuid,
  doc_type text not null default 'other' check (doc_type in
    ('photo','b_form','cnic','birth_certificate','transfer_certificate','previous_result','medical','certificate','contract','qualification','attachment','prospectus','other')),
  title text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes <= 10485760),
  visible_to_guardian boolean not null default false,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index documents_owner on documents(owner_type, owner_id);

-- ───────────────────────── promotion history ─────────────────────────
create table promotions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  from_academic_year_id uuid not null references academic_years(id),
  to_academic_year_id uuid references academic_years(id),
  from_class_id uuid references classes(id) on delete set null,
  from_section_id uuid references sections(id) on delete set null,
  to_class_id uuid references classes(id) on delete set null,
  to_section_id uuid references sections(id) on delete set null,
  outcome text not null check (outcome in ('promoted','promoted_conditional','retained','transferred','graduated','left')),
  conditions text,
  remarks text,
  decided_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  unique (student_id, from_academic_year_id)
);
create index promotions_student on promotions(student_id);

-- ───────────────────────── triggers ─────────────────────────
create trigger staff_updated before update on staff for each row execute function private.set_updated_at();
create trigger guardians_updated before update on guardians for each row execute function private.set_updated_at();
create trigger students_updated before update on students for each row execute function private.set_updated_at();
create trigger enquiries_updated before update on enquiries for each row execute function private.set_updated_at();
create trigger admissions_updated before update on admissions for each row execute function private.set_updated_at();

create trigger audit_students after insert or update or delete on students for each row execute function private.audit_trigger();
create trigger audit_staff after insert or update or delete on staff for each row execute function private.audit_trigger();
create trigger audit_admissions after update or delete on admissions for each row execute function private.audit_trigger();
create trigger audit_promotions after insert or delete on promotions for each row execute function private.audit_trigger();
create trigger audit_documents after insert or delete on documents for each row execute function private.audit_trigger();
create trigger audit_teacher_assignments after insert or update or delete on teacher_assignments for each row execute function private.audit_trigger();

-- ───────────────────────── RLS ─────────────────────────
call private.apply_rls('academic_years', 'academics', false, null, 'true');
call private.apply_rls('terms', 'academics', false, null, 'true');
call private.apply_rls('departments', 'academics', false, null, 'true');
call private.apply_rls('subjects', 'academics', false, null, 'true');
call private.apply_rls('houses', 'academics', false, null, 'true');
call private.apply_rls('classes', 'academics', true, null, 'id in (select private.my_class_ids())');
call private.apply_rls('sections', 'academics', true, null, 'id in (select private.my_section_ids())');
call private.apply_rls('class_subjects', 'academics', true, null, 'class_id in (select private.my_class_ids())');
call private.apply_rls('rooms', 'academics', true);
call private.apply_rls('periods', 'academics', true, null, 'campus_id in (select private.my_campus_ids())');
call private.apply_rls('designations', 'staff', false);
call private.apply_rls('staff', 'staff', true, null, 'profile_id = auth.uid()');
call private.apply_rls('teacher_assignments', 'academics', true, null, 'staff_id = private.my_staff_id()');
call private.apply_rls('families', 'guardians', false, null,
  'id in (select s.family_id from public.students s where s.id in (select private.my_student_ids()))');
call private.apply_rls('guardians', 'guardians', false, null, 'profile_id = auth.uid()');
call private.apply_rls('student_guardians', 'guardians', false, null, 'student_id in (select private.my_student_ids())');
call private.apply_rls('students', 'students', true, 'private.can_access_section(section_id)', 'id in (select private.my_student_ids())');
call private.apply_rls('enquiries', 'admissions');
call private.apply_rls('admissions', 'admissions');
call private.apply_rls('promotions', 'promotion', true, null, 'student_id in (select private.my_student_ids())', false);

-- Documents: medical records need a stronger permission; guardians only see what is shared.
call private.apply_rls('documents', 'documents', true,
  $$doc_type <> 'medical' or private.has_perm('documents.sensitive')$$,
  $$visible_to_guardian and owner_type = 'student' and owner_id in (select private.my_student_ids())$$);
