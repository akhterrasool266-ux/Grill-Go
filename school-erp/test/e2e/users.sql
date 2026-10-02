-- Logins for the LOCAL test stack (password = E2E_PASSWORD). Run after supabase/seed.sql.
do $$
declare s uuid := (select id from schools where slug = 'demo'); c1 uuid := (select id from campuses where school_id = s and is_main);
  c2 uuid := (select id from campuses where school_id = s and not is_main); u uuid; g record; st record; i int := 0;
begin
  if exists (select 1 from auth.users where email = 'admin@demo.test') then return; end if;
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'admin@demo.test');
  perform public.provision_user(u, s, 'Demo Administrator', 'admin@demo.test', null, array['super_admin'], array[c1, c2]);
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'principal@demo.test');
  perform public.provision_user(u, s, 'Demo Principal', 'principal@demo.test', null, array['principal'], array[c1, c2]);
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'accountant@demo.test');
  perform public.provision_user(u, s, 'Demo Accountant', 'accountant@demo.test', null, array['accountant'], array[c1]);
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'hr@demo.test');
  perform public.provision_user(u, s, 'Demo HR', 'hr@demo.test', null, array['hr_manager'], array[c1]);
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'gate@demo.test');
  perform public.provision_user(u, s, 'Gate Staff', 'gate@demo.test', null, array['security_gate'], array[c1]);
  -- a class teacher: first staff member that is class teacher of a section
  select st2.id into st from staff st2 join teacher_assignments ta on ta.staff_id = st2.id and ta.is_class_teacher order by st2.employee_code limit 1;
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'teacher@demo.test');
  perform public.provision_user(u, s, 'Demo Teacher', 'teacher@demo.test', null, array['class_teacher'], array[c1], jsonb_build_object('staff_id', st.id));
  -- a parent with two children (family with 2 students)
  select g2.id into g from guardians g2 join students s2 on s2.family_id = g2.family_id where g2.school_id = s group by g2.id having count(*) = 2 order by g2.id limit 1;
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'parent@demo.test');
  perform public.provision_user(u, s, 'Demo Parent', 'parent@demo.test', null, array['parent'], '{}', jsonb_build_object('guardian_id', g.id));
end $$;

-- A platform operator (no school profile)
do $$ declare u uuid; begin
  if exists (select 1 from auth.users where email = 'platform@demo.test') then return; end if;
  u := gen_random_uuid(); insert into auth.users(id,email) values (u,'platform@demo.test');
  insert into platform_admins(user_id) values (u);
end $$;
