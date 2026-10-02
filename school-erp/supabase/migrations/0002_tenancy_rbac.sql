-- 0002 · Tenancy, users, roles, permissions, audit log, security helpers.
set search_path = public, extensions;

-- ───────────────────────── schools & campuses ─────────────────────────
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  logo_path text,
  favicon_path text,
  address text, city text, province text,
  phone text, email text, website text,
  timezone text not null default 'Asia/Karachi',
  currency text not null default 'PKR',
  date_format text not null default 'DD/MM/YYYY',
  default_language text not null default 'en' check (default_language in ('en','ur')),
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campuses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  code text not null,
  address text, city text, phone text, email text,
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code),
  unique (id, school_id)
);
create unique index campuses_one_main on campuses(school_id) where is_main;

-- ───────────────────────── users ─────────────────────────
-- One row per auth user that belongs to a school. Platform operators
-- (platform_admins) may have no profile at all.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  avatar_path text,
  language text not null default 'en' check (language in ('en','ur')),
  theme text not null default 'system' check (theme in ('light','dark','system')),
  preferences jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_school on profiles(school_id);

create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ───────────────────────── roles & permissions ─────────────────────────
create table roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null,
  name_ur text,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, code),
  unique (id, school_id)
);

-- Global catalogue. `code` = "<module>.<action>".
create table permissions (
  code text primary key,
  module text not null,
  action text not null,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_code text not null references permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  assigned_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role on user_roles(role_id);

-- Which campuses a user works at. Users holding `campus.all` see every campus.
create table user_campuses (
  user_id uuid not null references profiles(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  primary key (user_id, campus_id)
);

-- ───────────────────────── numbering ─────────────────────────
create table number_sequences (
  school_id uuid not null references schools(id) on delete cascade,
  key text not null,
  prefix text not null default '',
  padding int not null default 4 check (padding between 1 and 10),
  last_value bigint not null default 0,
  reset_yearly boolean not null default false,
  last_year int,
  primary key (school_id, key)
);

-- ───────────────────────── settings ─────────────────────────
-- Non-secret configuration only. Provider credentials live in environment
-- variables on the server, never here.
create table settings (
  school_id uuid not null references schools(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (school_id, key)
);

-- ───────────────────────── audit log ─────────────────────────
create table audit_logs (
  id bigint generated always as identity primary key,
  school_id uuid references schools(id) on delete cascade,
  campus_id uuid,
  user_id uuid,
  action text not null,              -- insert | update | delete | custom verb
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_school_time on audit_logs(school_id, created_at desc);
create index audit_table_record on audit_logs(table_name, record_id);
create index audit_user on audit_logs(user_id);

create or replace function private.block_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_immutable before update or delete on audit_logs
  for each row execute function private.block_audit_mutation();

-- ───────────────────────── security helpers ─────────────────────────
create or replace function private.current_school_id() returns uuid
language sql stable security definer set search_path = public, private as $$
  select school_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function private.has_perm(p_code text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id and r.school_id = p.school_id
    join public.role_permissions rp on rp.role_id = r.id
    where p.id = auth.uid() and p.is_active and rp.permission_code = p_code
  )
$$;

create or replace function private.has_role(p_code text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id and r.school_id = p.school_id
    where p.id = auth.uid() and p.is_active and r.code = p_code
  )
$$;

create or replace function private.can_access_campus(p_campus uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1
    from public.profiles p
    join public.campuses c on c.school_id = p.school_id
    where p.id = auth.uid() and p.is_active and c.id = p_campus
      and ( private.has_perm('campus.all')
            or exists (select 1 from public.user_campuses uc where uc.user_id = p.id and uc.campus_id = c.id) )
  )
$$;

-- Fails loudly instead of silently returning nothing; used by RPCs.
create or replace function private.require_perm(p_code text, p_campus uuid default null) returns void
language plpgsql stable security definer set search_path = public, private as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_perm(p_code) then
    raise exception 'permission_denied: %', p_code using errcode = '42501';
  end if;
  if p_campus is not null and not private.can_access_campus(p_campus) then
    raise exception 'permission_denied: campus' using errcode = '42501';
  end if;
end $$;

-- ───────────────────────── audit trigger ─────────────────────────
create or replace function private.audit_trigger() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  v_old jsonb; v_new jsonb; v_school uuid; v_campus uuid; v_ip inet; v_key text;
  v_o jsonb; v_n jsonb; k text; parts text[] := '{}';
begin
  if TG_OP in ('UPDATE','DELETE') then v_old := to_jsonb(OLD); end if;
  if TG_OP in ('INSERT','UPDATE') then v_new := to_jsonb(NEW); end if;

  if TG_OP = 'UPDATE' then
    select o, n into v_o, v_n from private.jsonb_diff(v_old, v_new);
    if v_n = '{}'::jsonb then return NEW; end if;     -- nothing but updated_at changed
    v_old := v_o; v_new := v_n;
  end if;

  v_school := nullif(coalesce(to_jsonb(coalesce(NEW, OLD)) ->> 'school_id', ''), '')::uuid;
  v_campus := nullif(coalesce(to_jsonb(coalesce(NEW, OLD)) ->> 'campus_id', ''), '')::uuid;
  if TG_NARGS = 0 then
    v_key := to_jsonb(coalesce(NEW, OLD)) ->> 'id';
  else
    foreach k in array TG_ARGV loop
      parts := parts || coalesce(to_jsonb(coalesce(NEW, OLD)) ->> k, '');
    end loop;
    v_key := array_to_string(parts, ':');
  end if;

  begin
    v_ip := nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '')::inet;
  exception when others then v_ip := null;
  end;

  insert into public.audit_logs(school_id, campus_id, user_id, action, table_name, record_id, old_data, new_data, ip)
  values (v_school, v_campus, auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_key, v_old, v_new, v_ip);
  return coalesce(NEW, OLD);
end $$;

-- Explicit audit entry for actions that are not plain row changes.
create or replace function public.log_audit(p_action text, p_table text, p_record text,
  p_old jsonb default null, p_new jsonb default null, p_campus uuid default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare v_ip inet;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  begin
    v_ip := nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '')::inet;
  exception when others then v_ip := null;
  end;
  insert into audit_logs(school_id, campus_id, user_id, action, table_name, record_id, old_data, new_data, ip)
  values (private.current_school_id(), p_campus, auth.uid(), left(p_action, 60), left(p_table, 60), p_record, p_old, p_new, v_ip);
end $$;

-- Same, for server code acting with the service role on behalf of a known user.
create or replace function public.log_audit_as(p_user uuid, p_school uuid, p_action text, p_table text,
  p_record text, p_old jsonb default null, p_new jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into audit_logs(school_id, user_id, action, table_name, record_id, old_data, new_data)
  values (p_school, p_user, left(p_action, 60), left(p_table, 60), p_record, p_old, p_new)
$$;

-- ───────────────────────── numbering helper ─────────────────────────
create or replace function private.next_number(p_key text, p_school uuid default null) returns text
language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid := coalesce(p_school, private.current_school_id());
  v_prefix text; v_pad int; v_val bigint; v_yearly boolean; v_last int;
  v_year int := extract(year from (now() at time zone 'Asia/Karachi'))::int;
  v_defaults jsonb := '{
    "student_code":"STD-","admission_no":"ADM-","invoice":"INV-","receipt":"RCT-",
    "employee":"EMP-","enquiry":"ENQ-","application":"APP-","payslip":"PAY-",
    "expense":"EXP-","journal":"JV-","family":"FAM-","closing":"CLS-"}';
begin
  if v_school is null then raise exception 'no_school'; end if;
  insert into number_sequences(school_id, key, prefix, padding, last_value)
  values (v_school, p_key, coalesce(v_defaults ->> p_key, upper(left(p_key, 3)) || '-'), 4, 0)
  on conflict (school_id, key) do nothing;

  select prefix, padding, reset_yearly, last_year into v_prefix, v_pad, v_yearly, v_last
    from number_sequences where school_id = v_school and key = p_key for update;

  if v_yearly and v_last is distinct from v_year then
    update number_sequences set last_value = 1, last_year = v_year
      where school_id = v_school and key = p_key returning last_value into v_val;
  else
    update number_sequences set last_value = last_value + 1, last_year = coalesce(last_year, v_year)
      where school_id = v_school and key = p_key returning last_value into v_val;
  end if;
  return v_prefix || case when v_yearly then right(v_year::text, 2) || '-' else '' end
         || lpad(v_val::text, v_pad, '0');
end $$;

-- ───────────────────────── RLS generator ─────────────────────────
-- One place defines what "a normal tenant table" policy looks like, so every
-- table gets the same school → campus → permission checks.
--   p_module  permission module ("students" → students.view/create/edit/delete)
--   p_campus  also require access to the row's campus_id
--   p_extra   extra SQL predicate ANDed onto staff access (e.g. section scoping)
--   p_portal  SQL predicate that grants read access to portal users
--             (parents, students, staff reading their own rows)
--   p_write   false → read-only for clients (writes only via RPC)
create or replace procedure private.apply_rls(p_table text, p_module text,
  p_campus boolean default true, p_extra text default null,
  p_portal text default null, p_write boolean default true)
language plpgsql as $$
declare
  v_school text := 'school_id = (select private.current_school_id())';
  v_camp text := case when p_campus then ' and private.can_access_campus(campus_id)' else '' end;
  v_ex text := case when p_extra is not null then ' and (' || p_extra || ')' else '' end;
  v_sel text;
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_select', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);

  v_sel := format('%s and (private.has_perm(%L)%s%s)', v_school, p_module || '.view', v_camp, v_ex);
  if p_portal is not null then
    v_sel := format('%s and ((private.has_perm(%L)%s%s) or (%s))', v_school, p_module || '.view', v_camp, v_ex, p_portal);
  end if;
  execute format('create policy %I on public.%I for select to authenticated using (%s)', p_table || '_select', p_table, v_sel);

  if p_write then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s and private.has_perm(%L)%s%s)',
      p_table || '_insert', p_table, v_school, p_module || '.create', v_camp, v_ex);
    execute format('create policy %I on public.%I for update to authenticated using (%s and private.has_perm(%L)%s%s) with check (%s and private.has_perm(%L)%s%s)',
      p_table || '_update', p_table, v_school, p_module || '.edit', v_camp, v_ex, v_school, p_module || '.edit', v_camp, v_ex);
    execute format('create policy %I on public.%I for delete to authenticated using (%s and private.has_perm(%L)%s%s)',
      p_table || '_delete', p_table, v_school, p_module || '.delete', v_camp, v_ex);
  end if;
end $$;

-- ───────────────────────── RLS for the tables above ─────────────────────────
alter table schools enable row level security;
create policy schools_select on schools for select to authenticated
  using (id = (select private.current_school_id()));
create policy schools_update on schools for update to authenticated
  using (id = (select private.current_school_id()) and private.has_perm('settings.edit'))
  with check (id = (select private.current_school_id()) and private.has_perm('settings.edit'));

alter table campuses enable row level security;
create policy campuses_select on campuses for select to authenticated
  using (school_id = (select private.current_school_id())
         and (private.can_access_campus(id) or private.has_perm('campuses.view')));
create policy campuses_insert on campuses for insert to authenticated
  with check (school_id = (select private.current_school_id()) and private.has_perm('campuses.create'));
create policy campuses_update on campuses for update to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('campuses.edit'))
  with check (school_id = (select private.current_school_id()) and private.has_perm('campuses.edit'));
create policy campuses_delete on campuses for delete to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('campuses.delete'));

alter table profiles enable row level security;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid()
         or (school_id = (select private.current_school_id()) and private.has_perm('users.view')));
-- Users may edit their own cosmetic fields; admins edit others. Column grants
-- (below) stop anyone changing school_id/id/email through the API.
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()
         or (school_id = (select private.current_school_id()) and private.has_perm('users.edit')))
  with check (school_id = (select private.current_school_id()));

create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.is_active is distinct from old.is_active then
    if not private.has_perm('users.edit') or old.id = auth.uid() then
      raise exception 'permission_denied: users.edit' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function private.profiles_guard();

alter table platform_admins enable row level security;
create policy platform_admins_self on platform_admins for select to authenticated using (user_id = auth.uid());

alter table roles enable row level security;
create policy roles_select on roles for select to authenticated
  using (school_id = (select private.current_school_id())
         and (private.has_perm('roles.view') or private.has_perm('users.view')));
create policy roles_insert on roles for insert to authenticated
  with check (school_id = (select private.current_school_id()) and private.has_perm('roles.manage') and not is_system);
create policy roles_update on roles for update to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('roles.manage') and not is_system)
  with check (school_id = (select private.current_school_id()) and not is_system);
create policy roles_delete on roles for delete to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('roles.manage') and not is_system);

alter table permissions enable row level security;
create policy permissions_read on permissions for select to authenticated using (true);

alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select to authenticated
  using (exists (select 1 from roles r where r.id = role_id and r.school_id = (select private.current_school_id()))
         and (private.has_perm('roles.view') or private.has_perm('roles.manage')));
create policy role_permissions_insert on role_permissions for insert to authenticated
  with check (private.has_perm('roles.manage')
              and exists (select 1 from roles r where r.id = role_id and r.school_id = (select private.current_school_id()) and r.code <> 'super_admin'));
create policy role_permissions_delete on role_permissions for delete to authenticated
  using (private.has_perm('roles.manage')
         and exists (select 1 from roles r where r.id = role_id and r.school_id = (select private.current_school_id()) and r.code <> 'super_admin'));

alter table user_roles enable row level security;
create policy user_roles_select on user_roles for select to authenticated
  using (user_id = auth.uid()
         or (exists (select 1 from roles r where r.id = role_id and r.school_id = (select private.current_school_id()))
             and private.has_perm('users.view')));
-- Nobody can change their own roles (blocks self-escalation).
create policy user_roles_insert on user_roles for insert to authenticated
  with check (user_id <> auth.uid() and private.has_perm('roles.manage')
              and exists (select 1 from roles r where r.id = role_id and r.school_id = (select private.current_school_id()))
              and exists (select 1 from profiles p where p.id = user_id and p.school_id = (select private.current_school_id())));
create policy user_roles_delete on user_roles for delete to authenticated
  using (user_id <> auth.uid() and private.has_perm('roles.manage')
         and exists (select 1 from roles r where r.id = role_id and r.school_id = (select private.current_school_id())));

alter table user_campuses enable row level security;
create policy user_campuses_select on user_campuses for select to authenticated
  using (user_id = auth.uid() or (private.has_perm('users.view')
         and exists (select 1 from profiles p where p.id = user_id and p.school_id = (select private.current_school_id()))));
create policy user_campuses_insert on user_campuses for insert to authenticated
  with check (user_id <> auth.uid() and private.has_perm('users.edit')
              and exists (select 1 from profiles p where p.id = user_id and p.school_id = (select private.current_school_id()))
              and exists (select 1 from campuses c where c.id = campus_id and c.school_id = (select private.current_school_id())));
create policy user_campuses_delete on user_campuses for delete to authenticated
  using (user_id <> auth.uid() and private.has_perm('users.edit')
         and exists (select 1 from profiles p where p.id = user_id and p.school_id = (select private.current_school_id())));

alter table number_sequences enable row level security;
create policy number_sequences_select on number_sequences for select to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('settings.view'));
create policy number_sequences_update on number_sequences for update to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('settings.edit'))
  with check (school_id = (select private.current_school_id()) and private.has_perm('settings.edit'));

alter table settings enable row level security;
create policy settings_select on settings for select to authenticated
  using (school_id = (select private.current_school_id()));
create policy settings_insert on settings for insert to authenticated
  with check (school_id = (select private.current_school_id()) and private.has_perm('settings.edit'));
create policy settings_update on settings for update to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('settings.edit'))
  with check (school_id = (select private.current_school_id()) and private.has_perm('settings.edit'));

alter table audit_logs enable row level security;
create policy audit_select on audit_logs for select to authenticated
  using (school_id = (select private.current_school_id()) and private.has_perm('audit.view')
         and (campus_id is null or private.can_access_campus(campus_id)));

-- Audit the security-critical tables defined so far.
create trigger audit_role_permissions after insert or delete on role_permissions
  for each row execute function private.audit_trigger('role_id', 'permission_code');
create trigger audit_user_roles after insert or delete on user_roles
  for each row execute function private.audit_trigger('user_id', 'role_id');
create trigger audit_user_campuses after insert or delete on user_campuses
  for each row execute function private.audit_trigger('user_id', 'campus_id');
create trigger audit_profiles after update on profiles
  for each row execute function private.audit_trigger();
create trigger audit_settings after insert or update on settings
  for each row execute function private.audit_trigger('school_id', 'key');
create trigger audit_campuses after insert or update or delete on campuses
  for each row execute function private.audit_trigger();

-- updated_at
create trigger schools_updated before update on schools for each row execute function private.set_updated_at();
create trigger campuses_updated before update on campuses for each row execute function private.set_updated_at();
create trigger profiles_updated before update on profiles for each row execute function private.set_updated_at();
