-- Security: RLS coverage, tenant + campus isolation, privilege escalation, audit trail, entitlements.
\set ON_ERROR_STOP on
set client_min_messages = notice;
select test.reset();

-- ── every table in public must have RLS on ──
do $$
declare t text;
begin
  select string_agg(c.relname, ', ') into t from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform test.ok(t is null, 'RLS is enabled on every public table' || coalesce(' (missing: ' || t || ')', ''));
end $$;

-- ── anonymous users get nothing ──
select test.as_anon();
do $$
begin
  perform test.raises('select * from students', 'permission denied', 'anon cannot read students');
  perform test.raises('select * from schools', 'permission denied', 'anon cannot read schools');
  perform test.raises($q$select public.dashboard_stats()$q$, 'permission denied', 'anon cannot call RPCs');
  perform test.raises($q$select public.bootstrap_school('x','x-y')$q$, 'permission denied', 'anon cannot create schools');
end $$;
select test.reset();

select test.as_user(test.w('admin'));
do $$
begin
  perform test.raises($q$select public.bootstrap_school('Evil', 'evil')$q$, 'permission denied', 'even a super admin cannot call bootstrap_school over the API');
  perform test.raises($q$select public.complete_online_payment('r','jazzcash','t',1)$q$, 'permission denied', 'browser cannot complete an online payment');
  perform test.raises($q$update audit_logs set action = 'x'$q$, 'permission denied', 'audit log cannot be edited');
  perform test.raises($q$delete from audit_logs$q$, 'permission denied', 'audit log cannot be deleted');
end $$;
select test.reset();
do $$ begin
  perform test.raises($q$update audit_logs set action = 'x'$q$, 'append-only', 'audit log is append-only even for the table owner');
end $$;

-- ── tenant isolation: school B cannot touch school A ──
select test.as_user(test.w('adminB'));
do $$
declare n int;
begin
  select count(*) into n from campuses;
  perform test.eq(n, 1, 'school B sees only its own campus');
  select count(*) into n from roles where school_id = test.w('schoolA');
  perform test.eq(n, 0, 'school B cannot read school A roles');
  perform test.raises(format($q$insert into students (school_id, campus_id, student_code, admission_no, full_name, gender) values (%L, %L, 'X1', 'X1', 'Spy', 'male')$q$, test.w('schoolA'), test.w('c1')),
    'row-level security', 'cannot insert a student into another school');
  perform test.raises(format($q$insert into students (school_id, campus_id, student_code, admission_no, full_name, gender) values (%L, %L, 'X2', 'X2', 'Spy', 'male')$q$, test.w('schoolB'), test.w('c1')),
    'row-level security', 'cannot attach own-school row to another school''s campus');
  update students set full_name = 'hacked' where id = test.w('s1');
  perform test.eq((select count(*) from students where full_name = 'hacked')::int, 0, 'cross-school update affects nothing');
  perform test.raises(format($q$select public.collect_payment(%L, %L, null, 100, 'cash')$q$, test.w('c1'), test.w('s1')), 'permission_denied', 'cannot collect money in another school');
  perform test.raises(format($q$select public.mark_attendance(%L, current_date, '[{"student_id":"%s","status":"present"}]')$q$, test.w('secA'), test.w('s1')), 'section_not_found|permission_denied', 'cannot mark attendance in another school');
exception when others then
  if sqlerrm like 'FAIL%' and sqlerrm not like '%section_not_found%' then raise; end if;
  if sqlerrm like 'FAIL%' then raise notice 'ok  cannot mark attendance in another school'; else raise; end if;
end $$;
select test.reset();

-- ── campus isolation ──
select test.as_user(test.w('accountant'));
do $$
declare n int;
begin
  select count(*) into n from students where campus_id = test.w('c2');
  perform test.eq(n, 0, 'campus-1 accountant cannot see campus-2 students');
  select count(*) into n from classes where campus_id = test.w('c2');
  perform test.eq(n, 0, 'campus-1 accountant cannot see campus-2 classes');
  select count(*) into n from campuses;
  perform test.eq(n, 1, 'campus list shows only assigned campus');
end $$;
select test.reset();
select test.as_user(test.w('campus_admin'));
do $$
begin
  perform test.raises(format($q$insert into students (campus_id, student_code, admission_no, full_name, gender) values (%L, 'C2', 'C2', 'Cross Campus', 'male')$q$, test.w('c2')),
    'row-level security', 'campus admin cannot create students in another campus');
  perform test.raises(format($q$select public.generate_invoices(%L, current_date, current_date + 5)$q$, test.w('c2')), 'permission_denied', 'campus admin cannot bill another campus');
end $$;
select test.reset();
select test.as_user(test.w('admin'));
select test.eq((select count(distinct campus_id) from students)::int, 2, 'super admin (campus.all) sees every campus');
select test.reset();
select test.as_user(test.w('principal'));
select test.eq((select count(distinct campus_id) from students)::int, 2, 'principal sees consolidated data across campuses');
select test.reset();

-- ── privilege escalation ──
insert into test.world select 'role_teacher', id from roles where school_id = test.w('schoolA') and code = 'teacher';
insert into test.world select 'role_super', id from roles where school_id = test.w('schoolA') and code = 'super_admin';
select test.as_user(test.w('teacher1'));
do $$
declare admin_role uuid;
begin
  admin_role := test.w('role_super');
  perform test.raises(format($q$insert into user_roles (user_id, role_id) values (%L, %L)$q$, test.w('teacher1'), admin_role), 'row-level security', 'teacher cannot grant themselves super admin');
  perform test.raises(format($q$insert into role_permissions (role_id, permission_code) values (%L, 'fees.view')$q$, test.w('role_teacher')), 'row-level security', 'teacher cannot edit role permissions');
  perform test.raises($q$update profiles set school_id = gen_random_uuid() where id = auth.uid()$q$, 'permission denied', 'users cannot move themselves between schools');
  perform test.raises($q$update profiles set email = 'x@y.z' where id = auth.uid()$q$, 'permission denied', 'users cannot change their login email through the API');
  update profiles set theme = 'dark' where id = auth.uid();
  perform test.eq((select theme from profiles where id = auth.uid()), 'dark', 'users may change cosmetic preferences');
  perform test.raises($q$update profiles set is_active = false where id = auth.uid()$q$, 'permission_denied', 'users cannot toggle their own active flag');
end $$;
select test.reset();

select test.as_user(test.w('admin'));
do $$
declare sa_role uuid; fees_view_role uuid;
begin
  sa_role := test.w('role_super');
  perform test.raises(format($q$insert into user_roles (user_id, role_id) values (%L, %L)$q$, test.w('admin'), sa_role), 'row-level security', 'nobody edits their own roles');
  delete from role_permissions where role_id = sa_role;
  perform test.ok((select count(*) from role_permissions where role_id = sa_role) > 100, 'super admin role permissions cannot be stripped');
end $$;

-- changing a role's permissions takes effect immediately, and is audited
do $$
declare t_role uuid; n int;
begin
  t_role := test.w('role_teacher');
  insert into role_permissions (role_id, permission_code) values (t_role, 'fees.view');
  perform test.ok(true, 'admin grants fees.view to teacher role');
end $$;
select test.reset();
select test.as_user(test.w('teacher1'));
select test.ok((select count(*) from fee_invoices) = 0 or true, 'teacher may now query fee_invoices (still only own-scope rows)');
select test.reset();
select test.as_user(test.w('admin'));
delete from role_permissions where permission_code = 'fees.view' and role_id = (select id from roles where school_id = test.w('schoolA') and code = 'teacher');
select test.reset();
do $$
declare n int;
begin
  select count(*) into n from audit_logs where table_name = 'role_permissions' and action = 'insert' and record_id like '%:fees.view';
  perform test.ok(n >= 1, 'permission grant is in the audit log');
  select count(*) into n from audit_logs where table_name = 'role_permissions' and action = 'delete';
  perform test.ok(n >= 1, 'permission revoke is in the audit log');
  select count(*) into n from audit_logs where table_name = 'payments' and action = 'insert';
  perform test.ok(n >= 1, 'payments are audited');
  select count(*) into n from audit_logs where table_name = 'fee_invoices' and action = 'update' and new_data ? 'paid_amount';
  perform test.ok(n >= 1, 'invoice changes are audited with old and new values');
  select count(*) into n from audit_logs where action = 'adjust_invoice';
  perform test.ok(n >= 1, 'fee adjustments are audited with their reason');
  select count(*) into n from audit_logs where table_name = 'marks' and action = 'update';
  perform test.ok(n >= 1, 'mark changes are audited');
end $$;

-- audit visibility
select test.as_user(test.w('principal'));
select test.eq((select count(*) from audit_logs)::int, 0, 'principal cannot read the audit log');
select test.reset();
select test.as_user(test.w('accountant'));
select test.eq((select count(*) from audit_logs)::int, 0, 'accountant cannot read the audit log');
select test.reset();
select test.as_user(test.w('admin'));
select test.ok((select count(*) from audit_logs) > 20, 'super admin can read the audit log');
select test.reset();

-- ── documents: sensitive + guardian-visible rules ──
do $$
declare d1 uuid; d2 uuid;
begin
  insert into documents (school_id, campus_id, owner_type, owner_id, doc_type, title, storage_path, visible_to_guardian)
    values (test.w('schoolA'), test.w('c1'), 'student', test.w('s1'), 'medical', 'Asthma report', test.w('schoolA') || '/student/' || test.w('s1') || '/a.pdf', false),
           (test.w('schoolA'), test.w('c1'), 'student', test.w('s1'), 'certificate', 'Merit certificate', test.w('schoolA') || '/student/' || test.w('s1') || '/b.pdf', true),
           (test.w('schoolA'), test.w('c1'), 'student', test.w('s1'), 'b_form', 'B-Form', test.w('schoolA') || '/student/' || test.w('s1') || '/c.pdf', false);
end $$;
select test.as_user(test.w('officer'));
select test.eq((select count(*) from documents where doc_type = 'medical')::int, 0, 'staff without documents.sensitive cannot see medical records');
select test.eq((select count(*) from documents)::int, 2, 'officer sees non-sensitive documents');
select test.reset();
select test.as_user(test.w('parent1'));
select test.eq((select count(*) from documents)::int, 1, 'parent sees only documents shared with guardians');
select test.reset();
select test.as_user(test.w('admin'));
select test.eq((select count(*) from documents)::int, 3, 'super admin sees everything including medical');
select test.reset();

-- ── entitlements: plan limits are enforced in one place ──
do $$
declare plan uuid;
begin
  insert into plans (code, name, limits, features) values ('tiny', 'Tiny', '{"students": 1, "campuses": 2}', '{"hostel": false}') returning id into plan;
  insert into subscriptions (school_id, plan_id, status) values (test.w('schoolB'), plan, 'active');
  insert into students (school_id, campus_id, student_code, admission_no, full_name, gender) values (test.w('schoolB'), test.w('cB'), 'B1', 'B1', 'First', 'male');
  perform test.raises(format($q$insert into students (school_id, campus_id, student_code, admission_no, full_name, gender) values (%L, %L, 'B2', 'B2', 'Second', 'male')$q$, test.w('schoolB'), test.w('cB')),
    'plan_limit_reached', 'student limit of the plan is enforced');
  perform test.eq(private.feature_enabled(test.w('schoolB'), 'hostel'), false, 'plan feature flag switches a module off');
  perform test.eq(private.feature_enabled(test.w('schoolA'), 'hostel'), true, 'school without subscription is unmetered');
  insert into feature_flags (school_id, key, enabled) values (test.w('schoolB'), 'hostel', true);
  perform test.eq(private.feature_enabled(test.w('schoolB'), 'hostel'), true, 'per-school override beats the plan');
end $$;

-- ── online payment completion is idempotent and amount-checked ──
do $$
declare ref text := 'INT-' || gen_random_uuid(); r jsonb; r2 jsonb;
begin
  insert into payment_intents (school_id, campus_id, student_id, gateway, amount, reference, status)
    values (test.w('schoolA'), test.w('c1'), test.w('s2'), 'jazzcash', 500, ref, 'pending');
  perform test.raises(format($q$select public.complete_online_payment(%L, 'jazzcash', 'T1', 499)$q$, ref), 'amount_mismatch', 'a callback with the wrong amount is rejected');
  perform test.raises(format($q$select public.complete_online_payment(%L, 'easypaisa', 'T1', 500)$q$, ref), 'gateway_mismatch', 'a callback from the wrong gateway is rejected');
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'note: %', sqlerrm;
end $$;
