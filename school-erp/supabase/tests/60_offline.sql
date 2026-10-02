-- Offline sync: idempotency, no silent overwrite, bounded back-filling, locks.
\set ON_ERROR_STOP on
set client_min_messages = notice;
select test.reset();

-- fresh exam to work on (admin creates it; teacher1 owns section A)
select test.as_user(test.w('admin'));
do $$
declare ex uuid; es uuid; math uuid;
begin
  select id into math from subjects where school_id = test.w('schoolA') limit 1;
  if math is null then insert into subjects (school_id, name, code) values (test.w('schoolA'), 'Offline Math', 'OFFM') returning id into math; end if;
  insert into exams (campus_id, academic_year_id, name, kind, status, position_scope)
    values (test.w('c1'), test.w('year'), 'Offline Test', 'midterm', 'scheduled', 'none') returning id into ex;
  insert into exam_subjects (campus_id, exam_id, class_id, subject_id, max_marks, passing_marks) values (test.w('c1'), ex, test.w('cl1'), math, 100, 40) returning id into es;
  insert into test.world values ('exOff', ex), ('esOff', es);
  perform test.mk_student('o1', test.w('c1'), test.w('cl1'), test.w('secA'), 'Offline One');
  perform test.mk_student('o2', test.w('c1'), test.w('cl1'), test.w('secA'), 'Offline Two');
  insert into student_guardians (student_id, guardian_id, school_id, is_primary, pays_fees) select test.w('o2'), g.id, g.school_id, true, true from guardians g where g.school_id = test.w('schoolA') limit 1;
  perform test.mk_student('o3', test.w('c1'), test.w('cl1'), test.w('secB'), 'Offline Three');
end $$;
select test.reset();

-- ── attendance ──
select test.as_user(test.w('teacher1'));
do $$
declare op uuid := gen_random_uuid(); r jsonb; r2 jsonb; d date := private.today() - 1; rows jsonb;
begin
  rows := jsonb_build_array(jsonb_build_object('student_id', test.w('o1'), 'status', 'present'), jsonb_build_object('student_id', test.w('o2'), 'status', 'absent'));
  r := public.sync_attendance(op, test.w('secA'), d, rows);
  perform test.eq((r ->> 'saved')::int, 2, 'offline attendance for yesterday is saved');
  perform test.eq((r ->> 'absence_alerts_queued')::int, 1, 'absence alert is queued once');
  r2 := public.sync_attendance(op, test.w('secA'), d, rows);
  perform test.ok((r2 ->> 'replayed')::boolean and (r2 ->> 'saved')::int = 2, 'sending the same operation twice returns the first result');
  perform test.eq((select count(*) from student_attendance where date = d and section_id = test.w('secA'))::int, 2, 'replay created no duplicate rows');
  -- a different op for the same day, one status differs: stored value wins, reported as conflict
  r := public.sync_attendance(gen_random_uuid(), test.w('secA'), d, jsonb_build_array(jsonb_build_object('student_id', test.w('o1'), 'status', 'absent'), jsonb_build_object('student_id', test.w('o2'), 'status', 'absent')));
  perform test.eq((r ->> 'unchanged')::int, 1, 'identical row is left alone');
  perform test.eq(jsonb_array_length(r -> 'conflicts'), 1, 'differing row is reported as a conflict');
  perform test.eq((select status from student_attendance where student_id = test.w('o1') and date = d), 'present', 'conflict does not overwrite the stored value');
  perform test.raises(format($q$select public.sync_attendance(gen_random_uuid(), %L, %L, '[{"student_id":"%s","status":"present"}]')$q$, test.w('secA'), private.today() - 4, test.w('o1')), 'offline_window_exceeded', 'cannot back-fill more than 3 days');
  perform test.raises(format($q$select public.sync_attendance(gen_random_uuid(), %L, %L, '[{"student_id":"%s","status":"present"}]')$q$, test.w('secA'), private.today() + 1, test.w('o1')), 'future_date', 'cannot send future attendance');
  perform test.raises(format($q$select public.sync_attendance(gen_random_uuid(), %L, %L, '[{"student_id":"%s","status":"present"}]')$q$, test.w('secB'), private.today(), test.w('o3')), 'permission_denied', 'teacher cannot sync another teacher''s section');
  perform test.raises(format($q$select public.sync_attendance(gen_random_uuid(), %L, %L, '[{"student_id":"%s","status":"bogus"}]')$q$, test.w('secA'), private.today(), test.w('o1')), 'invalid_status', 'bad status is rejected');
end $$;
select test.reset();
do $$ begin perform test.eq((select count(*) from notification_logs where student_id = test.w('o2') and template_key = 'absence_alert')::int, 1, 'replay queued no second absence alert'); end $$;
-- another user cannot replay (or read) someone else's operation id
do $$ declare o uuid; begin select op_id into o from sync_receipts where kind = 'attendance' limit 1; insert into test.world values ('opAtt', o); end $$;
select test.as_user(test.w('teacher2'));
do $$ begin perform test.raises(format($q$select public.sync_attendance(%L, %L, %L, '[{"student_id":"%s","status":"present"}]')$q$, test.w('opAtt'), test.w('secA'), private.today() - 1, test.w('o1')), 'permission_denied', 'an operation id cannot be replayed by another user'); end $$;
select test.reset();
select test.as_user(test.w('parent1'));
do $$ begin perform test.raises('select * from sync_receipts', 'permission denied', 'receipts are not readable by clients'); end $$;
select test.reset();

-- ── marks (compare-and-set) ──
select test.as_user(test.w('teacher1'));
do $$
declare op uuid := gen_random_uuid(); r jsonb; es uuid := test.w('esOff');
begin
  r := public.sync_marks(op, es, jsonb_build_array(jsonb_build_object('student_id', test.w('o1'), 'marks', 55, 'base', null), jsonb_build_object('student_id', test.w('o2'), 'absent', true, 'base', null)));
  perform test.eq((r ->> 'saved')::int, 2, 'offline marks are saved');
  perform test.ok((public.sync_marks(op, es, '[{"student_id":"x"}]') ->> 'replayed')::boolean, 'marks replay is idempotent (even with a different body)');
  -- phone saw 55, teacher edits to 60 offline → applies
  r := public.sync_marks(gen_random_uuid(), es, jsonb_build_array(jsonb_build_object('student_id', test.w('o1'), 'marks', 60, 'base', jsonb_build_object('marks', 55, 'absent', false))));
  perform test.eq((r ->> 'saved')::int, 1, 'edit based on the current value applies');
  perform test.eq((select marks_obtained from marks where exam_subject_id = es and student_id = test.w('o1')), 60::numeric, 'new value stored');
  -- stale phone: it still thinks 55, but the server now has 60 → conflict, server value kept
  r := public.sync_marks(gen_random_uuid(), es, jsonb_build_array(jsonb_build_object('student_id', test.w('o1'), 'marks', 70, 'base', jsonb_build_object('marks', 55, 'absent', false))));
  perform test.eq(jsonb_array_length(r -> 'conflicts'), 1, 'stale edit is reported as a conflict');
  perform test.eq((select marks_obtained from marks where exam_subject_id = es and student_id = test.w('o1')), 60::numeric, 'stale edit did not overwrite');
  -- a new entry for a student someone else already entered meanwhile (base null, server has value) → conflict
  r := public.sync_marks(gen_random_uuid(), es, jsonb_build_array(jsonb_build_object('student_id', test.w('o1'), 'marks', 10, 'base', null)));
  perform test.eq(jsonb_array_length(r -> 'conflicts'), 1, 'blind entry over existing marks is a conflict');
  -- same value already stored → harmless
  r := public.sync_marks(gen_random_uuid(), es, jsonb_build_array(jsonb_build_object('student_id', test.w('o1'), 'marks', 60, 'base', null)));
  perform test.eq((r ->> 'unchanged')::int, 1, 'identical value is unchanged, not a conflict');
  perform test.raises(format($q$select public.sync_marks(gen_random_uuid(), %L, '[{"student_id":"%s","marks":101,"base":{"marks":60,"absent":false}}]')$q$, es, test.w('o1')), 'marks_exceed_max', 'marks above maximum rejected on sync');
  perform test.raises(format($q$select public.sync_marks(gen_random_uuid(), %L, '[{"student_id":"%s","marks":5}]')$q$, es, test.w('o3')), 'permission_denied', 'teacher cannot sync marks of a section they do not teach');
end $$;
select test.reset();
-- exam locked while offline → rejected with a clear reason, nothing written
update exams set status = 'locked' where id = test.w('exOff');
select test.as_user(test.w('teacher1'));
do $$ begin
  perform test.raises(format($q$select public.sync_marks(gen_random_uuid(), %L, '[{"student_id":"%s","marks":5,"base":null}]')$q$, test.w('esOff'), test.w('o2')), 'marks_locked', 'marks cannot be synced into a locked exam');
end $$;
select test.reset();
do $$ begin raise notice 'ALL OFFLINE SYNC TESTS PASSED'; end $$;
