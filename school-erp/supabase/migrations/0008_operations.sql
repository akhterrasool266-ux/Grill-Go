-- 0008 · Library, transport, hostel, homework, communication, calendar, CMS, SaaS.
set search_path = public, extensions;

-- ───────────────────────── library ─────────────────────────
create table library_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  isbn text,
  title text not null,
  author text,
  category text,
  publisher text,
  quantity int not null default 1 check (quantity >= 0),
  available int not null default 1 check (available >= 0),
  shelf text,
  created_at timestamptz not null default now(),
  check (available <= quantity),
  unique (id, campus_id)
);
create unique index library_books_isbn on library_books(campus_id, isbn) where isbn is not null;
create index library_books_title_trgm on library_books using gin (title gin_trgm_ops);

create table library_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  book_id uuid not null,
  borrower_type text not null check (borrower_type in ('student','staff')),
  student_id uuid,
  staff_id uuid,
  issued_on date not null default current_date,
  due_on date not null,
  returned_on date,
  renewals int not null default 0,
  fine_amount numeric(10,2) not null default 0,
  fine_paid boolean not null default false,
  status text not null default 'issued' check (status in ('issued','returned','lost')),
  issued_by uuid default auth.uid(),
  foreign key (book_id, campus_id) references library_books(id, campus_id) on delete restrict,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete restrict,
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete restrict,
  check ((borrower_type = 'student' and student_id is not null and staff_id is null)
      or (borrower_type = 'staff' and staff_id is not null and student_id is null)),
  check (due_on >= issued_on)
);
create index library_tx_open on library_transactions(campus_id, status, due_on);

-- ───────────────────────── transport ─────────────────────────
create table drivers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  profile_id uuid unique references profiles(id) on delete set null,
  full_name text not null,
  cnic text, phone text,
  license_no text, license_expiry date,
  is_active boolean not null default true,
  unique (id, campus_id)
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  reg_no text not null,
  make_model text,
  capacity int not null default 30 check (capacity > 0),
  fitness_expiry date, insurance_expiry date,
  gps_device_id text,                     -- integration point for live tracking
  is_active boolean not null default true,
  unique (campus_id, reg_no),
  unique (id, campus_id)
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  name text not null,
  vehicle_id uuid,
  driver_id uuid,
  monthly_fee numeric(10,2) not null default 0 check (monthly_fee >= 0),
  start_time time,
  is_active boolean not null default true,
  foreign key (vehicle_id, campus_id) references vehicles(id, campus_id) on delete set null (vehicle_id),
  foreign key (driver_id, campus_id) references drivers(id, campus_id) on delete set null (driver_id),
  unique (campus_id, name),
  unique (id, campus_id)
);

create table route_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  route_id uuid not null,
  name text not null,
  stop_order int not null default 1,
  pickup_time time, drop_time time,
  lat numeric(9,6), lng numeric(9,6),
  foreign key (route_id, campus_id) references routes(id, campus_id) on delete cascade,
  unique (route_id, stop_order),
  unique (id, campus_id)
);

create table student_transport (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  route_id uuid not null,
  pickup_stop_id uuid,
  drop_stop_id uuid,
  monthly_fee numeric(10,2) not null default 0 check (monthly_fee >= 0),
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  foreign key (route_id, campus_id) references routes(id, campus_id) on delete cascade,
  foreign key (pickup_stop_id, campus_id) references route_stops(id, campus_id) on delete set null (pickup_stop_id),
  foreign key (drop_stop_id, campus_id) references route_stops(id, campus_id) on delete set null (drop_stop_id)
);
create unique index student_transport_one_active on student_transport(student_id) where is_active;

create table route_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  route_id uuid not null,
  student_id uuid not null,
  date date not null default current_date,
  trip text not null check (trip in ('pickup','drop')),
  status text not null check (status in ('boarded','absent','dropped')),
  marked_by uuid default auth.uid(),
  marked_at timestamptz not null default now(),
  foreign key (route_id, campus_id) references routes(id, campus_id) on delete cascade,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  unique (student_id, date, trip)
);

create table vehicle_positions (        -- fed by a GPS provider; nothing writes here by default
  id bigint generated always as identity primary key,
  school_id uuid not null references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  lat numeric(9,6) not null, lng numeric(9,6) not null,
  speed_kmh numeric(5,1),
  recorded_at timestamptz not null
);
create index vehicle_positions_latest on vehicle_positions(vehicle_id, recorded_at desc);

-- A driver may see only their own route(s).
create or replace function private.is_my_route(p_route uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.routes r join public.drivers d on d.id = r.driver_id
                 where r.id = p_route and d.profile_id = auth.uid())
$$;

-- ───────────────────────── hostel ─────────────────────────
create table hostel_buildings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  name text not null,
  gender text check (gender in ('male','female','mixed')),
  unique (campus_id, name),
  unique (id, campus_id)
);

create table hostel_rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  building_id uuid not null,
  room_no text not null,
  floor int not null default 0,
  capacity int not null default 4 check (capacity > 0),
  foreign key (building_id, campus_id) references hostel_buildings(id, campus_id) on delete cascade,
  unique (building_id, room_no),
  unique (id, campus_id)
);

create table hostel_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  room_id uuid not null,
  bed_no int not null check (bed_no > 0),
  from_date date not null default current_date,
  to_date date,
  monthly_fee numeric(10,2) not null default 0 check (monthly_fee >= 0),
  status text not null default 'active' check (status in ('active','vacated')),
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  foreign key (room_id, campus_id) references hostel_rooms(id, campus_id) on delete cascade
);
create unique index hostel_bed_active on hostel_allocations(room_id, bed_no) where status = 'active';
create unique index hostel_student_active on hostel_allocations(student_id) where status = 'active';

create table hostel_visitors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  visitor_name text not null,
  relation text, cnic text, purpose text,
  in_time timestamptz not null default now(),
  out_time timestamptz,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade
);

-- ───────────────────────── homework ─────────────────────────
create table homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  academic_year_id uuid references academic_years(id) on delete set null,
  section_id uuid not null,
  subject_id uuid references subjects(id) on delete set null,
  staff_id uuid,
  title text not null,
  description text,
  assigned_on date not null default current_date,
  due_date date not null,
  allow_submission boolean not null default false,
  is_published boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (section_id, campus_id) references sections(id, campus_id) on delete cascade,
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete set null (staff_id),
  check (due_date >= assigned_on)
);
create index homework_section_due on homework(section_id, due_date);

create table homework_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  homework_id uuid not null references homework(id) on delete cascade,
  student_id uuid not null,
  text_answer text,
  file_path text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted','late','graded')),
  marks numeric(6,2),
  feedback text,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  unique (homework_id, student_id)
);

-- ───────────────────────── communication ─────────────────────────
create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  key text not null,
  channel text not null check (channel in ('in_app','email','sms','whatsapp','push')),
  language text not null default 'en' check (language in ('en','ur')),
  subject text,
  body text not null,
  provider_template text,         -- WhatsApp Business requires pre-approved template names
  is_active boolean not null default true,
  unique (school_id, key, channel, language)
);

-- Outbox + delivery log in one table. Nothing is ever marked sent/delivered
-- unless a provider says so.
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid references campuses(id) on delete set null,
  channel text not null check (channel in ('in_app','email','sms','whatsapp','push')),
  provider text,
  to_address text not null,
  template_key text,
  language text not null default 'en' check (language in ('en','ur')),
  subject text,
  body text,                      -- null → rendered from template_key + meta at send time
  meta jsonb not null default '{}',
  student_id uuid references students(id) on delete set null,
  guardian_id uuid references guardians(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','read','failed')),
  provider_message_id text,
  error text,
  attempts int not null default 0,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (body is not null or template_key is not null)
);
create index notification_logs_queue on notification_logs(scheduled_for) where status = 'queued';
create index notification_logs_provider_msg on notification_logs(provider, provider_message_id);
create index notification_logs_student on notification_logs(student_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  level text not null default 'info' check (level in ('info','success','warning','urgent')),
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread on notifications(user_id, created_at desc) where read_at is null;

create table notification_preferences (
  user_id uuid not null references profiles(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','sms','whatsapp','push')),
  event_key text not null,
  enabled boolean not null default true,
  primary key (user_id, channel, event_key)
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid references campuses(id) on delete cascade,      -- null = whole school
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all','parents','students','teachers','staff')),
  class_id uuid references classes(id) on delete cascade,
  level text not null default 'info' check (level in ('info','success','warning','urgent')),
  is_pinned boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  notify boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid references campuses(id) on delete cascade,
  title text not null,
  kind text not null default 'event' check (kind in ('holiday','exam','event','meeting','ptm','admission')),
  start_date date not null,
  end_date date,
  start_time time, end_time time,
  description text,
  is_public boolean not null default false,       -- shown on the public website
  created_by uuid default auth.uid(),
  check (end_date is null or end_date >= start_date)
);
create index calendar_events_dates on calendar_events(school_id, start_date);

-- ───────────────────────── public website (CMS) ─────────────────────────
create table cms_content (
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  key text not null check (key in ('hero','about','principal_message','contact','admissions','social')),
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (school_id, key)
);
create table cms_gallery (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  title text,
  image_path text not null,
  sort_order int not null default 0,
  is_published boolean not null default true
);
create table cms_notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  title text not null,
  body text,
  file_path text,
  published_at timestamptz not null default now(),
  is_published boolean not null default true
);
create table cms_teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  designation text,
  bio text,
  photo_path text,
  sort_order int not null default 0,
  is_published boolean not null default true
);

-- ───────────────────────── SaaS: plans, subscriptions, flags ─────────────────────────
create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_pkr_monthly numeric(12,2) not null default 0,
  -- {"students":500,"campuses":1,"staff":50,"storage_mb":2048,"whatsapp_messages":500,"sms":500,"ai_requests":200}; missing key = unlimited
  limits jsonb not null default '{}',
  features jsonb not null default '{}',      -- {"ai_assistant":true,"hostel":false,...}
  is_active boolean not null default true
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references schools(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','cancelled')),
  trial_ends_at timestamptz,
  current_period_start date,
  current_period_end date,
  limits_override jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table feature_flags (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,     -- null = global default
  key text not null,
  enabled boolean not null,
  unique nulls not distinct (school_id, key)
);

create table usage_counters (
  school_id uuid not null references schools(id) on delete cascade,
  metric text not null,
  period date not null,                                         -- first day of month
  value bigint not null default 0,
  primary key (school_id, metric, period)
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  subject text not null,
  body text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── entitlements (single enforcement point) ─────────────────────────
-- No subscription row = self-hosted / unmetered. Missing limit key = unlimited.
create or replace function private.plan_limit(p_school uuid, p_metric text) returns numeric
language sql stable security definer set search_path = public, private as $$
  select coalesce((s.limits_override ->> p_metric), (pl.limits ->> p_metric))::numeric
  from public.subscriptions s join public.plans pl on pl.id = s.plan_id
  where s.school_id = p_school and s.status in ('trialing','active')
$$;

create or replace function private.feature_enabled(p_school uuid, p_key text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select coalesce(
    (select enabled from public.feature_flags where school_id = p_school and key = p_key),
    (select (pl.features ->> p_key)::boolean from public.subscriptions s join public.plans pl on pl.id = s.plan_id
       where s.school_id = p_school and s.status in ('trialing','active')),
    (select enabled from public.feature_flags where school_id is null and key = p_key),
    true)
$$;

create or replace function private.enforce_limit() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare v_metric text := TG_ARGV[0]; v_limit numeric; v_count bigint;
begin
  v_limit := private.plan_limit(new.school_id, v_metric);
  if v_limit is null then return new; end if;
  execute case v_metric
    when 'students' then 'select count(*) from public.students where school_id = $1 and status = ''active'''
    when 'staff'    then 'select count(*) from public.staff where school_id = $1 and status = ''active'''
    when 'campuses' then 'select count(*) from public.campuses where school_id = $1 and is_active'
  end into v_count using new.school_id;
  if v_count >= v_limit then
    raise exception 'plan_limit_reached: % (limit %)', v_metric, v_limit using errcode = 'P0402';
  end if;
  return new;
end $$;
create trigger limit_students before insert on students for each row execute function private.enforce_limit('students');
create trigger limit_staff before insert on staff for each row execute function private.enforce_limit('staff');
create trigger limit_campuses before insert on campuses for each row execute function private.enforce_limit('campuses');

-- ───────────────────────── triggers ─────────────────────────
create trigger support_tickets_updated before update on support_tickets for each row execute function private.set_updated_at();
create trigger audit_library_transactions after update or delete on library_transactions for each row execute function private.audit_trigger();
create trigger audit_hostel_allocations after insert or update or delete on hostel_allocations for each row execute function private.audit_trigger();
create trigger audit_student_transport after insert or update or delete on student_transport for each row execute function private.audit_trigger();
create trigger audit_notification_templates after insert or update or delete on notification_templates for each row execute function private.audit_trigger();
create trigger audit_announcements after insert or update or delete on announcements for each row execute function private.audit_trigger();

-- ───────────────────────── RLS ─────────────────────────
call private.apply_rls('library_books', 'library');
call private.apply_rls('library_transactions', 'library', true, null,
  'student_id in (select private.my_student_ids()) or staff_id = private.my_staff_id()', false);

call private.apply_rls('drivers', 'transport', true, null, 'profile_id = auth.uid()');
call private.apply_rls('vehicles', 'transport');
call private.apply_rls('routes', 'transport', true, null,
  'private.is_my_route(id) or id in (select st.route_id from public.student_transport st where st.student_id in (select private.my_student_ids()))');
call private.apply_rls('route_stops', 'transport', true, null,
  'private.is_my_route(route_id) or route_id in (select st.route_id from public.student_transport st where st.student_id in (select private.my_student_ids()))');
call private.apply_rls('student_transport', 'transport', true, null, 'student_id in (select private.my_student_ids())');
call private.apply_rls('route_attendance', 'transport', true, null,
  'student_id in (select private.my_student_ids()) or private.is_my_route(route_id)');
create policy route_attendance_driver_insert on route_attendance for insert to authenticated
  with check (school_id = (select private.current_school_id()) and private.is_my_route(route_id));
create policy route_attendance_driver_update on route_attendance for update to authenticated
  using (private.is_my_route(route_id) and date = current_date) with check (private.is_my_route(route_id));
call private.apply_rls('vehicle_positions', 'transport', true, null, null, false);

call private.apply_rls('hostel_buildings', 'hostel');
call private.apply_rls('hostel_rooms', 'hostel');
call private.apply_rls('hostel_allocations', 'hostel', true, null, 'student_id in (select private.my_student_ids())');
call private.apply_rls('hostel_visitors', 'hostel');

call private.apply_rls('homework', 'homework', true, 'private.can_access_section(section_id)',
  'is_published and section_id in (select private.my_section_ids())');
call private.apply_rls('homework_submissions', 'homework', true, null, 'student_id in (select private.my_student_ids())');
create policy homework_submissions_own_insert on homework_submissions for insert to authenticated
  with check (school_id = (select private.current_school_id())
    and student_id in (select private.my_student_ids())
    and exists (select 1 from public.homework h where h.id = homework_id and h.allow_submission and h.is_published));
create policy homework_submissions_own_update on homework_submissions for update to authenticated
  using (student_id in (select private.my_student_ids()) and status <> 'graded')
  with check (student_id in (select private.my_student_ids()) and status <> 'graded');

-- Re-issue documents policy now that homework exists: guardians/students also see homework attachments.
call private.apply_rls('documents', 'documents', true,
  $$doc_type <> 'medical' or private.has_perm('documents.sensitive')$$,
  $$(visible_to_guardian and owner_type = 'student' and owner_id in (select private.my_student_ids()))
    or (owner_type = 'homework' and owner_id in (select h.id from public.homework h))$$);

call private.apply_rls('notification_templates', 'communication', false, null, null);
call private.apply_rls('notification_logs', 'communication', true, null, null, false);
create policy notification_logs_campusless on notification_logs for select to authenticated
  using (campus_id is null and school_id = (select private.current_school_id()) and private.has_perm('communication.view'));

alter table notifications enable row level security;
create policy notifications_own_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on notifications for delete to authenticated using (user_id = auth.uid());

alter table notification_preferences enable row level security;
create policy notification_preferences_own on notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table push_subscriptions enable row level security;
create policy push_subscriptions_own on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

call private.apply_rls('announcements', 'announcements', false,
  '(campus_id is null or private.can_access_campus(campus_id))',
  $$publish_at <= now() and (expires_at is null or expires_at > now())
    and (campus_id is null or campus_id in (select private.my_campus_ids()))
    and (class_id is null or class_id in (select private.my_class_ids()) or private.my_staff_id() is not null)
    and (audience = 'all'
         or (audience = 'parents' and private.has_role('parent'))
         or (audience = 'students' and private.has_role('student'))
         or (audience in ('teachers','staff') and private.my_staff_id() is not null))$$);
call private.apply_rls('calendar_events', 'calendar', false,
  '(campus_id is null or private.can_access_campus(campus_id))',
  'campus_id is null or campus_id in (select private.my_campus_ids())');

call private.apply_rls('cms_content', 'cms', false);
call private.apply_rls('cms_gallery', 'cms', false);
call private.apply_rls('cms_notices', 'cms', false);
call private.apply_rls('cms_teachers', 'cms', false);
-- cms_content has a composite key → the generic policy covers it; gallery etc. are read publicly via the server.

alter table plans enable row level security;
create policy plans_read on plans for select to authenticated using (is_active);
alter table subscriptions enable row level security;
create policy subscriptions_read on subscriptions for select to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('billing.view'));
alter table feature_flags enable row level security;
create policy feature_flags_read on feature_flags for select to authenticated
  using (school_id is null or school_id = (select private.current_school_id()));
alter table usage_counters enable row level security;
create policy usage_counters_read on usage_counters for select to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('billing.view'));
alter table support_tickets enable row level security;
create policy support_tickets_select on support_tickets for select to authenticated
  using (school_id = (select private.current_school_id()) and (created_by = auth.uid() or private.has_perm('billing.manage')));
create policy support_tickets_insert on support_tickets for insert to authenticated
  with check (school_id = (select private.current_school_id()) and created_by = auth.uid());
