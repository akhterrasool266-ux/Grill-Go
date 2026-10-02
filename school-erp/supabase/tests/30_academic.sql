-- Attendance, admissions, exams/results, promotion, timetable, library, rbac.
\set ON_ERROR_STOP on
set client_min_messages = notice;
select test.reset();

-- ═════ attendance ═════
select test.as_user(test.w('teacher1'));
do $$
declare r jsonb; n int;
begin
  r := public.mark_attendance(test.w('secA'), (now() at time zone 'Asia/Karachi')::date,
    jsonb_build_array(jsonb_build_object('student_id', test.w('s1'), 'status', 'present'),
                      jsonb_build_object('student_id', test.w('s2'), 'status', 'absent')));
  perform test.eq((r ->> 'saved')::int, 2, 'teacher marks own section attendance');
  perform test.eq((r ->> 'absence_alerts_queued')::int, 1, 'absence queues exactly one guardian alert');

  perform test.raises(format($q$select public.mark_attendance(%L, current_date, '[{"student_id":"%s","status":"present"}]')$q$, test.w('secB'), test.w('s3')),
    'permission_denied', 'teacher cannot mark a section they are not assigned to');
  perform test.raises(format($q$select public.mark_attendance(%L, current_date, '[{"student_id":"%s","status":"present"}]')$q$, test.w('secA'), test.w('s3')),
    'student_not_in_section', 'student must belong to the section');
  perform test.raises(format($q$select public.mark_attendance(%L, current_date + 3, '[{"student_id":"%s","status":"present"}]')$q$, test.w('secA'), test.w('s1')),
    'future_date', 'future attendance rejected');
  perform test.raises(format($q$select public.mark_attendance(%L, current_date, '[{"student_id":"%s","status":"present"}]', 'manual', 'oops')$q$, test.w('secA'), test.w('s2')),
    'correction_requires', 'teacher cannot correct an existing mark without edit permission');
  perform test.raises(format($q$update student_attendance set status = 'present' where student_id = %L$q$, test.w('s2')),
    'permission denied', 'attendance cannot be edited directly');

  select count(*) into n from students;
  perform test.eq(n, 2, 'teacher1 only sees students of the assigned section');
  select count(*) into n from student_attendance;
  perform test.eq(n, 2, 'teacher1 only sees attendance of the assigned section');
end $$;

select test.as_user(test.w('admin'));
do $$
declare r jsonb; n int;
begin
  r := public.mark_attendance(test.w('secA'), (now() at time zone 'Asia/Karachi')::date,
    jsonb_build_array(jsonb_build_object('student_id', test.w('s2'), 'status', 'present')), 'manual', 'Parent called, was at gate');
  perform test.eq((r ->> 'corrected')::int, 1, 'authorised user can correct with a reason');
  perform test.raises(format($q$select public.mark_attendance(%L, current_date, '[{"student_id":"%s","status":"late"}]')$q$, test.w('secA'), test.w('s2')),
    'correction_requires', 'correction without reason rejected even for admin');
end $$;
select test.reset();
do $$
declare n int;
begin
  select count(*) into n from audit_logs where table_name = 'student_attendance' and action = 'update';
  perform test.eq(n, 1, 'attendance correction is in the audit trail');
  select count(*) into n from audit_logs where table_name = 'student_attendance' and action = 'update' and old_data ->> 'status' = 'absent' and new_data ->> 'status' = 'present';
  perform test.eq(n, 1, 'audit entry holds old and new value');
  select count(*) into n from notification_logs where template_key = 'absence_alert' and status = 'queued';
  perform test.eq(n, 1, 'absence alert sits in the outbox (not marked sent)');
end $$;

-- QR attendance (gate staff scan a card; they cannot browse students)
do $$
declare r jsonb; code text;
begin
  select student_code into code from students where id = test.w('s3');
  perform test.as_user(test.w('gate'));
  r := public.mark_attendance_qr(code);
  perform test.ok((r ->> 'status') in ('present','late'), 'gate scan marks attendance');
  r := public.mark_attendance_qr(code);
  perform test.eq((r ->> 'already_marked')::boolean, true, 'second scan is idempotent');
  perform test.eq((select count(*) from students)::int, 0, 'gate staff cannot browse students');
  perform test.raises($q$select public.mark_attendance_qr('STD-9999')$q$, 'student_not_found', 'unknown card rejected');
  perform test.reset();
end $$;

-- ═════ timetable clashes ═════
select test.as_user(test.w('admin'));
do $$
declare p1 uuid; p2 uuid; n int;
begin
  insert into periods (campus_id, name, start_time, end_time, sort_order) values (test.w('c1'), 'P1', '08:00', '08:40', 1) returning id into p1;
  insert into periods (campus_id, name, start_time, end_time, sort_order, is_break) values (test.w('c1'), 'Break', '10:00', '10:20', 2, true) returning id into p2;
  insert into test.world values ('p1', p1), ('pBreak', p2);
  insert into timetable_entries (campus_id, academic_year_id, section_id, day_of_week, period_id, staff_id)
    values (test.w('c1'), test.w('year'), test.w('secA'), 1, p1, test.w('staff1'));
  perform test.raises(format($q$insert into timetable_entries (campus_id, academic_year_id, section_id, day_of_week, period_id, staff_id) values (%L,%L,%L,1,%L,%L)$q$,
    test.w('c1'), test.w('year'), test.w('secB'), p1, test.w('staff1')), 'duplicate key', 'teacher cannot be in two classes in one period');
  perform test.raises(format($q$insert into timetable_entries (campus_id, academic_year_id, section_id, day_of_week, period_id) values (%L,%L,%L,1,%L)$q$,
    test.w('c1'), test.w('year'), test.w('secA'), p1), 'duplicate key', 'a class cannot have two lessons in one period');
  perform test.raises(format($q$insert into timetable_entries (campus_id, academic_year_id, section_id, day_of_week, period_id) values (%L,%L,%L,2,%L)$q$,
    test.w('c1'), test.w('year'), test.w('secA'), p2), 'break_period', 'lessons cannot be put in a break');
  select count(*) into n from public.check_timetable_conflicts(test.w('year'), test.w('secB'), 1, p1, test.w('staff1'));
  perform test.eq(n, 1, 'conflict check reports the teacher clash before saving');
end $$;
select test.reset();

-- ═════ admissions ═════
select test.as_user(test.w('officer'));
do $$
declare a uuid; r jsonb; n int;
begin
  insert into admissions (campus_id, application_no, class_applied_id, full_name, gender, guardian_name, phone, father_name, academic_year_id)
    values (test.w('c1'), 'APP-T1', test.w('cl1'), 'Hamza Raza', 'male', 'Raza Ali', '0333-1112222', 'Raza Ali', test.w('year')) returning id into a;
  insert into test.world values ('app1', a);
  perform test.raises(format($q$select public.advance_admission(%L, 'test_interview')$q$, a), 'invalid_transition', 'cannot skip document verification');
  perform public.advance_admission(a, 'document_verification');
  perform test.raises(format($q$select public.advance_admission(%L, 'test_interview')$q$, a), 'documents_not_verified', 'documents must be verified first');
  update admissions set documents_verified = true, test_date = current_date, test_score = 40, test_max = 50 where id = a;
  perform public.advance_admission(a, 'test_interview');
  perform public.advance_admission(a, 'approval');
  perform test.raises(format($q$select public.admit_applicant(%L, %L)$q$, a, test.w('secA')), 'permission_denied', 'admission officer without approve right cannot admit');
end $$;
select test.as_user(test.w('admin'));
do $$
declare r jsonb; a2 uuid; fam1 uuid; fam2 uuid; sid uuid;
begin
  perform test.raises(format($q$select public.admit_applicant(%L, %L)$q$, test.w('app1'), test.w('secN')), 'section_does_not_match_class', 'section must belong to the applied class');
  r := public.admit_applicant(test.w('app1'), test.w('secB'));
  sid := (r ->> 'student_id')::uuid;
  perform test.ok((r ->> 'student_code') like 'STD-%', 'student id generated on admission');
  perform test.eq((select stage from admissions where id = test.w('app1')), 'admitted', 'admission marked admitted');
  perform test.eq((select count(*) from student_guardians where student_id = sid and is_primary)::int, 1, 'primary guardian linked');
  perform test.raises(format($q$select public.admit_applicant(%L, %L)$q$, test.w('app1'), test.w('secB')), 'not_ready', 'cannot admit twice');

  -- second child of the same guardian phone joins the same family
  insert into admissions (campus_id, application_no, class_applied_id, full_name, gender, guardian_name, phone, stage, documents_verified, academic_year_id)
    values (test.w('c1'), 'APP-T2', test.w('cl1'), 'Maryam Raza', 'female', 'Raza Ali', '03331112222', 'approval', true, test.w('year')) returning id into a2;
  r := public.admit_applicant(a2, test.w('secB'));
  select family_id into fam1 from students where id = sid;
  select family_id into fam2 from students where id = (r ->> 'student_id')::uuid;
  perform test.eq(fam2, fam1, 'sibling detected by guardian phone → same family');
end $$;
select test.reset();

-- ═════ exams, marks, results ═════
insert into subjects (school_id, code, name) values (test.w('schoolA'), 'MATH', 'Mathematics'), (test.w('schoolA'), 'ENG', 'English');
select test.as_user(test.w('exam'));
do $$
declare ex uuid; math uuid; eng uuid; es_m uuid; es_e uuid; r jsonb; rc result_cards;
begin
  select id into math from subjects where code = 'MATH';
  select id into eng from subjects where code = 'ENG';
  insert into exams (campus_id, academic_year_id, name, kind, status, position_scope)
    values (test.w('c1'), test.w('year'), 'Mid Term', 'midterm', 'scheduled', 'section') returning id into ex;
  insert into exam_subjects (campus_id, exam_id, class_id, subject_id, max_marks, passing_marks) values (test.w('c1'), ex, test.w('cl1'), math, 100, 40) returning id into es_m;
  insert into exam_subjects (campus_id, exam_id, class_id, subject_id, max_marks, passing_marks) values (test.w('c1'), ex, test.w('cl1'), eng, 50, 20) returning id into es_e;
  insert into test.world values ('exam1', ex), ('esM', es_m), ('esE', es_e);

  perform test.raises(format($q$select public.save_marks(%L, '[{"student_id":"%s","marks":101}]')$q$, es_m, test.w('s1')), 'marks_exceed_max', 'marks above maximum rejected');
  r := public.save_marks(es_m, jsonb_build_array(
    jsonb_build_object('student_id', test.w('s1'), 'marks', 95), jsonb_build_object('student_id', test.w('s2'), 'marks', 38)));
  r := public.save_marks(es_e, jsonb_build_array(
    jsonb_build_object('student_id', test.w('s1'), 'marks', 45), jsonb_build_object('student_id', test.w('s2'), 'marks', 30)));
  perform test.eq((select status from exams where id = ex), 'marks_entry', 'exam moves to marks entry');

  r := public.generate_results(ex);
  select * into rc from result_cards where exam_id = ex and student_id = test.w('s1');
  perform test.eq(rc.total_obtained, 140.00, 'total marks summed');
  perform test.eq(rc.total_max, 150.00, 'total maximum summed');
  perform test.eq(rc.percentage, 93.33, 'percentage computed');
  perform test.eq(rc.grade, 'A+', 'grade comes from the configured grade bands');
  perform test.eq(rc.result_status, 'pass', 'pass');
  perform test.eq(rc.position, 1, 'position 1 in section');
  select * into rc from result_cards where exam_id = ex and student_id = test.w('s2');
  perform test.eq(rc.result_status, 'fail', 'failing one subject fails the student even with decent total');
  perform test.ok(rc.position is null, 'failed students get no position');
  perform test.eq(jsonb_array_length(rc.subjects), 2, 'subject lines are snapshotted');
end $$;

-- incomplete results block publishing
do $$
begin
  perform test.raises(format($q$select public.publish_results(%L)$q$, test.w('exam1')), 'incomplete_results', 'results with missing marks cannot be published');
end $$;
select test.reset();
-- s3 is in 1B, s-bilal etc. were not given marks: results exist only for students in cl1 → includes admitted ones, so complete the marks first
do $$
declare s record;
begin
  perform test.as_user(test.w('exam'));
  for s in select id from students where class_id = test.w('cl1') and status = 'active' and id not in (test.w('s1'), test.w('s2')) loop
    perform public.save_marks(test.w('esM'), jsonb_build_array(jsonb_build_object('student_id', s.id, 'marks', 60)));
    perform public.save_marks(test.w('esE'), jsonb_build_array(jsonb_build_object('student_id', s.id, 'absent', true)));
  end loop;
  perform public.generate_results(test.w('exam1'));
  perform test.eq((select count(*) from result_cards where exam_id = test.w('exam1') and result_status = 'incomplete')::int, 0, 'no incomplete results after full entry');
  perform test.ok((select count(*) from result_cards where exam_id = test.w('exam1') and result_status = 'fail') >= 2, 'absent in a subject counts as fail');
end $$;
select test.reset();

-- parents see nothing until results are published
select test.as_user(test.w('parent1'));
select test.eq((select count(*) from result_cards)::int, 0, 'parent cannot see unpublished result cards');
select test.eq((select count(*) from marks)::int, 0, 'parent cannot see raw marks before publishing');
select test.reset();

select test.as_user(test.w('teacher1'));
do $$
begin
  perform test.raises(format($q$select public.publish_results(%L)$q$, test.w('exam1')), 'permission_denied', 'teacher cannot publish results');
end $$;
select test.reset();

select test.as_user(test.w('exam'));
do $$
declare r jsonb;
begin
  r := public.publish_results(test.w('exam1'));
  perform test.ok((r ->> 'published')::int >= 4, 'results published');
  perform test.raises(format($q$select public.save_marks(%L, '[{"student_id":"%s","marks":10}]')$q$, test.w('esM'), test.w('s1')), 'marks_locked', 'marks are locked after publishing');
end $$;
select test.reset();

select test.as_user(test.w('parent1'));
do $$
begin
  perform test.eq((select count(*) from result_cards)::int, 2, 'parent sees published result cards of their two children');
  perform test.eq((select count(*) from result_cards where student_id = test.w('s3'))::int, 0, 'but not other children');
end $$;
select test.reset();

-- reopening an exam needs a reason and the approve right; published flag is withdrawn
select test.as_user(test.w('admin'));
do $$
begin
  perform test.raises(format($q$select public.set_exam_status(%L, 'marks_entry')$q$, test.w('exam1')), 'reason_required', 'reopening needs a reason');
  perform public.set_exam_status(test.w('exam1'), 'marks_entry', 'Teacher found a marking error');
  perform test.eq((select count(*) from result_cards where exam_id = test.w('exam1') and is_published)::int, 0, 'reopening withdraws published results');
  perform public.save_marks(test.w('esM'), jsonb_build_array(jsonb_build_object('student_id', test.w('s2'), 'marks', 48)));
  perform public.generate_results(test.w('exam1'));
  perform test.eq((select result_status from result_cards where exam_id = test.w('exam1') and student_id = test.w('s2')), 'pass',
    'corrected marks re-grade the student');
end $$;
select test.reset();


-- ═════ promotion keeps history ═════
select test.as_user(test.w('admin'));
do $$
declare y2 uuid; before_marks int; before_inv int; r jsonb;
begin
  insert into academic_years (name, start_date, end_date) values ('Next Year', current_date + 200, current_date + 560) returning id into y2;
  insert into test.world values ('year2', y2);
  select count(*) into before_marks from marks where student_id = test.w('s1');
  select count(*) into before_inv from fee_invoices where student_id = test.w('s1');

  perform test.raises(format($q$select public.promote_students('[{"student_id":"%s","outcome":"promoted"}]', %L)$q$, test.w('s1'), test.w('year')),
    'target_year_must_be_later', 'cannot promote into the same/earlier year');
  perform test.raises(format($q$select public.promote_students('[{"student_id":"%s","outcome":"promoted_conditional"}]', %L)$q$, test.w('s1'), y2),
    'conditions_required', 'conditional promotion needs the conditions');

  r := public.promote_students(jsonb_build_array(
        jsonb_build_object('student_id', test.w('s1'), 'outcome', 'promoted'),
        jsonb_build_object('student_id', test.w('s2'), 'outcome', 'retained', 'remarks', 'Needs another year')), y2);
  perform test.eq((r ->> 'processed')::int, 2, 'two students processed');
  perform test.eq((select class_id from students where id = test.w('s1')), test.w('cl2'), 'promoted student moves to the next class');
  perform test.eq((select class_id from students where id = test.w('s2')), test.w('cl1'), 'retained student stays');
  perform test.eq((select count(*) from marks where student_id = test.w('s1'))::int, before_marks, 'previous-year marks are untouched');
  perform test.eq((select count(*) from fee_invoices where student_id = test.w('s1'))::int, before_inv, 'previous-year invoices are untouched');
  perform test.eq((select count(*) from promotions where student_id = test.w('s1'))::int, 1, 'promotion history recorded');
  perform test.raises(format($q$select public.promote_students('[{"student_id":"%s","outcome":"promoted"}]', %L)$q$, test.w('s1'), y2),
    'already_promoted', 'a student cannot be promoted twice for one year');

  r := public.promote_students(jsonb_build_array(jsonb_build_object('student_id', test.w('s3'), 'outcome', 'graduated')), y2);
  perform test.eq((select status from students where id = test.w('s3')), 'graduated', 'graduated students leave the active roll');
end $$;
select test.reset();

-- ═════ library ═════
select test.as_user(test.w('admin'));
do $$
declare b uuid; r jsonb; tx uuid;
begin
  insert into library_books (campus_id, title, author, quantity, available) values (test.w('c1'), 'Urdu Qaida', 'Anon', 1, 1) returning id into b;
  r := public.issue_book(b, test.w('s1'));
  tx := (r ->> 'transaction_id')::uuid;
  perform test.eq((select available from library_books where id = b), 0, 'issuing reduces available copies');
  perform test.raises(format($q$select public.issue_book(%L, %L)$q$, b, test.w('s2')), 'no_copies_available', 'cannot issue a book with no copies left');
  r := public.renew_book(tx);
  perform test.ok(r ? 'due_on', 'renewal extends the due date');
  perform test.reset();
  update library_transactions set issued_on = current_date - 20, due_on = current_date - 3 where id = tx;
  perform test.as_user(test.w('admin'));
  r := public.return_book(tx);
  perform test.eq((r ->> 'fine')::numeric, 15.00, 'overdue fine = days × fine per day');
  perform test.eq((select available from library_books where id = b), 1, 'returning restores the copy');
end $$;
select test.reset();

-- ═════ payroll ═════
select test.as_user(test.w('hr'));
do $$
declare r jsonb; pay payroll; run uuid; v_m date := date '2026-08-01'; d date;
begin
  insert into salary_structures (campus_id, staff_id, effective_from, basic_salary, house_allowance, conveyance_allowance, tax_percent, other_deduction)
    values (test.w('c1'), test.w('staff1'), date '2026-01-01', 30000, 6000, 2000, 5, 500);
  insert into staff_loans (campus_id, staff_id, amount, monthly_installment, remaining) values (test.w('c1'), test.w('staff1'), 12000, 3000, 12000);
  insert into payroll_adjustments (campus_id, staff_id, month, kind, label, amount) values (test.w('c1'), test.w('staff1'), v_m, 'bonus', 'Eid bonus', 2000);
  -- 2 absences, 1 late, 2 hours overtime
  insert into staff_attendance (campus_id, staff_id, date, status, overtime_minutes) values
    (test.w('c1'), test.w('staff1'), date '2026-08-03', 'absent', 0), (test.w('c1'), test.w('staff1'), date '2026-08-04', 'absent', 0),
    (test.w('c1'), test.w('staff1'), date '2026-08-05', 'late', 120), (test.w('c1'), test.w('staff1'), date '2026-08-06', 'present', 0);

  r := public.generate_payroll(test.w('c1'), v_m);
  run := (r ->> 'run_id')::uuid;
  perform test.eq((r ->> 'payslips')::int, 1, 'payslip generated for the staff member with a salary structure');
  perform test.eq((r ->> 'skipped_no_salary_structure')::int, 1, 'staff without salary structure are reported, not silently paid');
  select * into pay from payroll where run_id = run and staff_id = test.w('staff1');
  perform test.eq(pay.working_days, 26, 'working days = days in month minus Sundays (Aug 2026: 5 Sundays)');
  perform test.eq(pay.absent_days, 2.0, 'absent days counted');
  perform test.eq(pay.late_count, 1, 'late count');
  -- fixed = 30000+6000+2000 = 38000 ; per day = 38000/26 ; 2 days
  perform test.eq(pay.absence_deduction, round(38000.0 / 26 * 2, 2), 'absence deduction = daily rate × absent days');
  perform test.eq(pay.bonus, 2000.00, 'bonus included');
  perform test.eq(pay.loan_deduction, 3000.00, 'loan instalment deducted');
  perform test.eq(pay.net_salary, pay.gross - pay.total_deductions, 'net = gross − deductions');
  perform test.ok(pay.overtime_amount > 0, 'overtime paid');

  insert into test.world values ('run1', run);
end $$;
select test.reset();

select test.as_user(test.w('campus_admin'));
select test.eq((select count(*) from payroll)::int, 0, 'campus admin cannot see payslips');
select test.eq((select count(*) from salary_structures)::int, 0, 'campus admin cannot see salaries');
do $$ begin
  perform test.raises($q$select public.generate_payroll(test.w('c1'), date '2026-08-01')$q$, 'permission_denied', 'campus admin cannot run payroll');
end $$;
select test.reset();

select test.as_user(test.w('accountant'));
select test.eq((select count(*) from payroll)::int, 0, 'accountant (no payroll rights) cannot see payslips');
select test.reset();

select test.as_user(test.w('hr'));
do $$
declare acct uuid; r jsonb; bal numeric;
begin
  perform public.approve_payroll(test.w('run1'));
  perform test.raises($q$select public.generate_payroll(test.w('c1'), date '2026-08-01')$q$, 'payroll_already_approved', 'approved payroll cannot be regenerated');
  perform test.reset();
  select id into acct from accounts where school_id = test.w('schoolA') and name = 'Bank Account';
  select balance into bal from account_balances where account_id = acct;
  perform test.as_user(test.w('hr'));
  r := public.pay_payroll(test.w('run1'));
  perform test.eq((select status from payroll_runs where id = test.w('run1')), 'paid', 'run marked paid');
  perform test.eq((select remaining from staff_loans where staff_id = test.w('staff1')), 9000.00, 'loan balance reduced by the instalment');
  perform test.reset();
  perform test.ok((select balance from account_balances where account_id = acct) < bal, 'salary payout recorded in the cash book');
end $$;
select test.reset();

-- staff see their own payslip only, and only once approved
select test.as_user(test.w('teacher1'));
select test.eq((select count(*) from payroll)::int, 1, 'staff member sees their own (approved) payslip');
select test.eq((select count(*) from salary_structures)::int, 0, 'but not the salary structure table');
select test.reset();
select test.as_user(test.w('teacher2'));
select test.eq((select count(*) from payroll)::int, 0, 'another teacher sees no payslips');
select test.reset();

-- ═════ create_student ═════
select test.as_user(test.w('campus_admin'));
do $$
declare r jsonb; r2 jsonb; r3 jsonb;
begin
  r := public.create_student(test.w('c1'), jsonb_build_object('full_name', 'Omar Siddiqui', 'gender', 'male', 'class_id', test.w('cl1'), 'section_id', test.w('secA'),
        'g_name', 'Siddiq Ahmad', 'g_phone', '0345-9876543', 'dob', '2017-02-01'));
  perform test.ok((r ->> 'student_code') like 'STD-%', 'student code generated');
  perform test.eq((r ->> 'linked_existing_family')::boolean, false, 'new family created for a new phone number');
  r2 := public.create_student(test.w('c1'), jsonb_build_object('full_name', 'Hira Siddiqui', 'gender', 'female', 'class_id', test.w('cl1'), 'section_id', test.w('secB'),
        'g_name', 'Siddiq Ahmad', 'g_phone', '03459876543'));
  perform test.eq((r2 ->> 'linked_existing_family')::boolean, true, 'same phone number links the sibling to the same family');
  perform test.eq(r2 ->> 'family_id', r ->> 'family_id', 'siblings share one family');
  perform test.eq((select count(*) from guardians where family_id = (r ->> 'family_id')::uuid)::int, 1, 'guardian is not duplicated');
  perform test.raises(format($q$select public.create_student(%L, '{"full_name":"X","gender":"male","g_name":"Y","section_id":"%s","class_id":"%s"}')$q$, test.w('c1'), test.w('secN'), test.w('cl1')),
    'section_does_not_match_class', 'section must belong to the class and campus');
  perform test.raises(format($q$select public.create_student(%L, '{"full_name":"X","gender":"male","g_name":"Y"}')$q$, test.w('c2')), 'permission_denied', 'cannot create students in another campus');
  perform test.raises(format($q$select public.create_student(%L, '{"full_name":"X","gender":"male"}')$q$, test.w('c1')), 'guardian_name_required', 'a new family needs a guardian');
  perform test.raises(format($q$select public.create_student(%L, '{"full_name":"Dup","gender":"male","g_name":"G","admission_no":"%s"}')$q$, test.w('c1'),
    (select admission_no from students where id = test.w('s1'))), 'duplicate', 'duplicate admission number rejected');
end $$;
select test.reset();
