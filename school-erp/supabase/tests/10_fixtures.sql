-- Test fixtures + tiny assertion kit. Runs as the DB superuser (bypasses RLS).
create schema if not exists test;

create or replace function test.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end $$;
create or replace function test.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;
create or replace function test.reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function test.eq(p_actual anyelement, p_expected anyelement, p_msg text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL: % — expected %, got %', p_msg, p_expected, p_actual;
  end if;
  raise notice 'ok  %', p_msg;
end $$;
create or replace function test.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAIL: %', p_msg; end if;
  raise notice 'ok  %', p_msg;
end $$;
-- Runs SQL as the current role and demands it fails with a message containing p_expect.
create or replace function test.raises(p_sql text, p_expect text, p_msg text) returns void language plpgsql as $$
declare v_err text;
begin
  begin
    execute p_sql;
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then raise exception 'FAIL: % — expected an error containing "%", but it succeeded', p_msg, p_expect; end if;
  if position(lower(p_expect) in lower(v_err)) = 0 then
    raise exception 'FAIL: % — expected error containing "%", got "%"', p_msg, p_expect, v_err;
  end if;
  raise notice 'ok  % (%)', p_msg, left(v_err, 60);
end $$;
grant usage on schema test to anon, authenticated;
grant execute on all functions in schema test to anon, authenticated;

-- ───────── world ─────────
create table test.world (k text primary key, v uuid);
create or replace function test.w(p_key text) returns uuid language sql stable as $$ select v from test.world where k = p_key $$;
grant select, insert on test.world to anon, authenticated;


create or replace function test.mk_user(p_name text, p_role text, p_school uuid, p_campuses uuid[] default '{}') returns uuid
language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (u, p_name || '@test.local');
  insert into profiles (id, school_id, full_name, email) values (u, p_school, initcap(p_name), p_name || '@test.local');
  insert into user_roles (user_id, role_id) select u, id from roles where school_id = p_school and code = p_role;
  insert into user_campuses (user_id, campus_id) select u, unnest(p_campuses);
  insert into test.world values (p_name, u);
  return u;
end $$;

create or replace function test.mk_student(p_key text, p_campus uuid, p_class uuid, p_section uuid, p_name text,
  p_family uuid default null, p_dob date default null) returns uuid language plpgsql as $$
declare s uuid; sch uuid;
begin
  select school_id into sch from campuses where id = p_campus;
  insert into students (school_id, campus_id, student_code, admission_no, full_name, gender, class_id, section_id, family_id, dob, academic_year_id)
  values (sch, p_campus, private.next_number('student_code', sch), private.next_number('admission_no', sch), p_name, 'male',
          p_class, p_section, p_family, p_dob, test.w('year'))
  returning id into s;
  insert into test.world values (p_key, s);
  return s;
end $$;

do $$
declare
  sa uuid; sb uuid; c1 uuid; c2 uuid; cb uuid; y uuid; fam uuid; g uuid;
  cl1 uuid; cl2 uuid; cl_n uuid; secA uuid; secB uuid; secN uuid; stf uuid; stf2 uuid; tuition uuid; transport uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; u uuid;
begin
  sa := public.bootstrap_school('Greenfield Grammar School', 'greenfield', 'Greenfield');
  sb := public.bootstrap_school('Other School', 'other', 'Other');
  select id into c1 from campuses where school_id = sa and is_main;
  insert into campuses (school_id, name, code) values (sa, 'North Campus', 'NORTH') returning id into c2;
  select id into cb from campuses where school_id = sb;
  select id into y from academic_years where school_id = sa and is_current;
  insert into test.world values ('schoolA', sa), ('schoolB', sb), ('c1', c1), ('c2', c2), ('cB', cb), ('year', y);

  perform test.mk_user('admin', 'super_admin', sa, array[c1, c2]);
  perform test.mk_user('accountant', 'accountant', sa, array[c1]);
  perform test.mk_user('teacher1', 'teacher', sa, array[c1]);
  perform test.mk_user('teacher2', 'teacher', sa, array[c1]);
  perform test.mk_user('parent1', 'parent', sa);
  perform test.mk_user('principal', 'principal', sa, array[c1, c2]);
  perform test.mk_user('hr', 'hr_manager', sa, array[c1]);
  perform test.mk_user('exam', 'exam_controller', sa, array[c1]);
  perform test.mk_user('gate', 'security_gate', sa, array[c1]);
  perform test.mk_user('campus_admin', 'campus_admin', sa, array[c1]);
  perform test.mk_user('officer', 'admission_officer', sa, array[c1]);
  perform test.mk_user('adminB', 'super_admin', sb, array[cb]);

  insert into classes (school_id, campus_id, name, level) values (sa, c1, 'Class 1', 1) returning id into cl1;
  insert into classes (school_id, campus_id, name, level) values (sa, c1, 'Class 2', 2) returning id into cl2;
  insert into classes (school_id, campus_id, name, level) values (sa, c2, 'Class 1', 1) returning id into cl_n;
  update classes set next_class_id = cl2 where id = cl1;
  insert into sections (school_id, campus_id, class_id, name) values (sa, c1, cl1, 'A') returning id into secA;
  insert into sections (school_id, campus_id, class_id, name) values (sa, c1, cl1, 'B') returning id into secB;
  insert into sections (school_id, campus_id, class_id, name) values (sa, c2, cl_n, 'A') returning id into secN;
  insert into test.world values ('cl1', cl1), ('cl2', cl2), ('clN', cl_n), ('secA', secA), ('secB', secB), ('secN', secN);

  insert into staff (school_id, campus_id, employee_code, full_name, profile_id, cnic, joining_date)
    values (sa, c1, 'EMP-0001', 'Teacher One', test.w('teacher1'), '35202-1234567-1', date '2025-01-01') returning id into stf;
  insert into staff (school_id, campus_id, employee_code, full_name, profile_id, joining_date)
    values (sa, c1, 'EMP-0002', 'Teacher Two', test.w('teacher2'), date '2025-01-01') returning id into stf2;
  insert into test.world values ('staff1', stf), ('staff2', stf2);
  insert into teacher_assignments (school_id, campus_id, academic_year_id, section_id, staff_id, is_class_teacher)
    values (sa, c1, y, secA, stf, true), (sa, c1, y, secB, stf2, true);

  insert into families (school_id, family_code, family_name) values (sa, private.next_number('family', sa), 'Khan Family') returning id into fam;
  insert into test.world values ('fam', fam);
  insert into guardians (school_id, family_id, profile_id, full_name, relation, phone, whatsapp)
    values (sa, fam, test.w('parent1'), 'Imran Khan', 'father', '03001234567', '03001234567') returning id into g;

  s1 := test.mk_student('s1', c1, cl1, secA, 'Ali Khan', fam, date '2016-03-01');   -- eldest
  s2 := test.mk_student('s2', c1, cl1, secA, 'Sara Khan', fam, date '2018-05-01');  -- sibling
  s3 := test.mk_student('s3', c1, cl1, secB, 'Bilal Ahmed');
  s4 := test.mk_student('s4', c2, cl_n, secN, 'Zain Malik');
  insert into student_guardians (student_id, guardian_id, school_id, is_primary, pays_fees)
    values (s1, g, sa, true, true), (s2, g, sa, true, true);

  select id into tuition from fee_categories where school_id = sa and code = 'TUITION';
  select id into transport from fee_categories where school_id = sa and code = 'TRANSPORT';
  insert into test.world values ('tuition', tuition), ('transport', transport);
  insert into fee_structures (school_id, campus_id, academic_year_id, class_id, fee_category_id, amount, frequency)
    values (sa, c1, y, cl1, tuition, 5000, 'monthly'), (sa, c1, y, cl2, tuition, 6000, 'monthly'),
           (sa, c2, y, cl_n, tuition, 4500, 'monthly');
end $$;
