-- Suspension, usage metering, bulk messaging, auto numbers.
\set ON_ERROR_STOP on
set client_min_messages = notice;
select test.reset();

-- ── a suspended school fails closed ──
select test.as_user(test.w('admin'));
do $$ begin perform test.ok((select count(*) from students) > 0, 'before suspension the admin sees students'); end $$;
select test.reset();
update schools set status = 'suspended' where id = test.w('schoolA');
select test.as_user(test.w('admin'));
do $$ begin
  perform test.eq((select count(*) from students)::int, 0, 'suspended school: students are invisible');
  perform test.eq(private.current_school_id(), null::uuid, 'suspended school: no tenant context');
  perform test.eq(public.my_context() -> 'school', 'null'::jsonb, 'suspended school: my_context has no school');
end $$;
select test.reset();
update schools set status = 'active' where id = test.w('schoolA');
select test.as_user(test.w('admin'));
do $$ begin perform test.ok((select count(*) from students) > 0, 'reactivated school works again'); end $$;
select test.reset();

-- ── usage metering ──
do $$
declare p uuid; sb uuid := test.w('schoolB');
begin
  select plan_id into p from subscriptions where school_id = sb;
  update plans set limits = limits || '{"ai_requests":2}' where id = p;
  perform test.ok(public.within_limit(sb, 'ai_requests', 1), 'first AI request is within the limit');
  perform public.bump_usage(sb, 'ai_requests', 1);
  perform public.bump_usage(sb, 'ai_requests', 1);
  perform test.ok(not public.within_limit(sb, 'ai_requests', 1), 'third AI request is over the limit');
  perform test.ok(public.within_limit(test.w('schoolA'), 'ai_requests', 50), 'a school without a subscription is unmetered');
  perform test.eq((select value from usage_counters where school_id = sb and metric = 'ai_requests')::int, 2, 'usage counter increments atomically per month');
end $$;
select test.as_user(test.w('admin'));
do $$ begin
  perform test.raises($q$select public.bump_usage(gen_random_uuid(), 'sms', 1)$q$, 'permission denied', 'browser cannot bump usage counters');
  perform test.raises($q$select public.within_limit(gen_random_uuid(), 'sms', 1)$q$, 'permission denied', 'browser cannot probe other schools’ limits');
end $$;
select test.reset();

-- ── custom message to guardians ──
select test.as_user(test.w('parent1'));
do $$ begin perform test.raises(format($q$select public.queue_custom_message(%L, null, null, 'Hi', 'School closed')$q$, test.w('c1')), 'permission_denied', 'a parent cannot message other parents'); end $$;
select test.reset();
select test.as_user(test.w('admin'));
do $$
declare n int; before int;
begin
  perform test.raises(format($q$select public.queue_custom_message(%L, null, null, 'Hi', '')$q$, test.w('c1')), 'message_required', 'empty message is refused');
  perform test.raises(format($q$select public.queue_custom_message(%L, null, null, 'Hi', %L)$q$, test.w('c1'), repeat('x', 601)), 'message_too_long', 'over-long message is refused');
  perform test.raises(format($q$select public.queue_custom_message(%L, null, null, 'Hi', 'x')$q$, test.w('cB')), 'permission_denied', 'cannot message another school''s campus');
  select count(*) into before from notification_logs;
  n := public.queue_custom_message(test.w('c1'), null, null, 'Closed', 'School is closed tomorrow.');
  perform test.eq((select count(*) from notification_logs)::int - before, n, 'one outbox row is queued per guardian address');
  perform test.ok(n >= 0, 'queue_custom_message returns a count');
  perform test.ok(not exists (select 1 from notification_logs where status = 'sent' and template_key = 'announcement'), 'queuing never marks anything as sent');
end $$;
select test.reset();

-- ── auto numbers ──
do $$
declare a text; b text;
begin
  insert into enquiries (school_id, campus_id, child_name, guardian_name, phone) values (test.w('schoolA'), test.w('c1'), 'Kid One', 'Parent', '03001234567') returning enquiry_no into a;
  insert into enquiries (school_id, campus_id, child_name, guardian_name, phone) values (test.w('schoolA'), test.w('c1'), 'Kid Two', 'Parent', '03001234568') returning enquiry_no into b;
  perform test.ok(a is not null and b is not null and a <> b, 'enquiry numbers are generated and unique (' || a || ', ' || b || ')');
end $$;

-- ── CMS permission: only roles with cms.create can add website content ──
select test.as_user(test.w('teacher1'));
do $$ begin perform test.raises(format($q$insert into cms_notices (school_id, title) values (%L, 'x')$q$, test.w('schoolA')), 'row-level security', 'a teacher cannot publish website notices'); end $$;
select test.reset();
select test.as_user(test.w('admin'));
do $$ begin
  insert into cms_notices (school_id, title) values (test.w('schoolA'), 'Holiday');
  perform test.ok(true, 'an admin can publish a website notice');
end $$;
select test.reset();
do $$ begin raise notice 'ALL OPS TESTS PASSED'; end $$;
