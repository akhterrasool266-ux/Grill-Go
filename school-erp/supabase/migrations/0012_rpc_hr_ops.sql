-- 0012 · Payroll, leave, library, expenses/journal, dashboard, search, outbox, provisioning.
set search_path = public, extensions;

-- ═════════════ payroll ═════════════
create or replace function private.working_days(p_campus uuid, p_month date) returns int
language sql stable security definer set search_path = public, private as $$
  select count(*)::int from generate_series(p_month, (p_month + interval '1 month - 1 day')::date, interval '1 day') d
  where extract(isodow from d) <> 7
    and not exists (select 1 from public.calendar_events e
                    where e.kind = 'holiday' and (e.campus_id is null or e.campus_id = p_campus)
                      and d::date between e.start_date and coalesce(e.end_date, e.start_date))
$$;

create or replace function public.generate_payroll(p_campus uuid, p_month date) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid; v_month date := date_trunc('month', p_month)::date; v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_run payroll_runs; v_cfg jsonb; v_wd int; sf record; ss salary_structures;
  v_present numeric; v_late int; v_absent numeric; v_leave numeric; v_ot int; v_unpaid numeric;
  v_basic numeric; v_allow numeric; v_conv numeric; v_fixed numeric; v_otamt numeric; v_bonus numeric; v_gross numeric;
  v_abs_ded numeric; v_loan numeric; v_tax numeric; v_other numeric; v_ded numeric; v_net numeric; v_rate numeric;
  v_pid uuid; v_n int := 0; v_hours numeric; v_skipped int := 0; v_absence_on boolean;
begin
  perform private.require_perm('payroll.create', p_campus);
  if not private.has_perm('financial.access') then raise exception 'permission_denied: financial.access' using errcode = '42501'; end if;
  select school_id into v_school from campuses where id = p_campus;
  v_cfg := private.get_setting(v_school, 'payroll');
  v_absence_on := coalesce((v_cfg ->> 'absence_deduction')::boolean, true);
  v_wd := private.working_days(p_campus, v_month);

  select * into v_run from payroll_runs where campus_id = p_campus and month = v_month for update;
  if found then
    if v_run.status <> 'draft' then raise exception 'payroll_already_approved'; end if;
    delete from payroll where run_id = v_run.id;
  else
    insert into payroll_runs (school_id, campus_id, month) values (v_school, p_campus, v_month) returning * into v_run;
  end if;

  for sf in select id, full_name from staff where campus_id = p_campus and status in ('active','on_leave')
            and joining_date <= v_end order by employee_code loop
    select * into ss from salary_structures where staff_id = sf.id and effective_from <= v_end order by effective_from desc limit 1;
    if not found then v_skipped := v_skipped + 1; continue; end if;

    select coalesce(sum(case status when 'present' then 1 when 'late' then 1 when 'half_day' then 0.5 else 0 end), 0),
           count(*) filter (where status = 'late'),
           coalesce(sum(case status when 'absent' then 1 when 'half_day' then 0.5 else 0 end), 0),
           coalesce(sum(overtime_minutes), 0)::int
      into v_present, v_late, v_absent, v_ot
      from staff_attendance where staff_id = sf.id and date between v_month and v_end;
    select coalesce(sum(count_days), 0) into v_leave from (
      select (select count(*) from generate_series(greatest(lr.from_date, v_month), least(lr.to_date, v_end), interval '1 day') d
              where extract(isodow from d) <> 7) as count_days
      from leave_requests lr where lr.staff_id = sf.id and lr.status = 'approved' and lr.from_date <= v_end and lr.to_date >= v_month) x;
    select coalesce(sum(count_days), 0) into v_unpaid from (
      select (select count(*) from generate_series(greatest(lr.from_date, v_month), least(lr.to_date, v_end), interval '1 day') d
              where extract(isodow from d) <> 7) as count_days
      from leave_requests lr join leave_types lt on lt.id = lr.leave_type_id
      where lr.staff_id = sf.id and lr.status = 'approved' and not lt.is_paid and lr.from_date <= v_end and lr.to_date >= v_month) x;

    v_basic := ss.basic_salary;
    v_allow := ss.house_allowance + ss.medical_allowance + ss.other_allowance;
    v_conv := ss.conveyance_allowance;
    v_fixed := v_basic + v_allow + v_conv;
    v_rate := coalesce(ss.overtime_rate_per_hour,
                       round(v_basic / greatest(v_wd, 1) / coalesce((v_cfg ->> 'hours_per_day')::numeric, 6)
                             * coalesce((v_cfg ->> 'overtime_multiplier')::numeric, 1.5), 2));
    v_hours := v_ot / 60.0;
    v_otamt := round(v_hours * v_rate, 2);
    select coalesce(sum(amount), 0) into v_bonus from payroll_adjustments where staff_id = sf.id and month = v_month and kind = 'bonus';
    v_gross := v_fixed + v_otamt + v_bonus;
    v_abs_ded := case when v_absence_on then round(v_fixed / greatest(v_wd, 1) * (v_absent + v_unpaid), 2) else 0 end;
    v_abs_ded := least(v_abs_ded, v_fixed);
    v_tax := round(v_gross * ss.tax_percent / 100, 2);
    select coalesce(sum(amount), 0) + ss.other_deduction into v_other from payroll_adjustments
      where staff_id = sf.id and month = v_month and kind = 'deduction';
    select coalesce(sum(least(monthly_installment, remaining)), 0) into v_loan from staff_loans where staff_id = sf.id and status = 'active';
    v_loan := least(v_loan, greatest(0, v_gross - v_abs_ded - v_tax - v_other));
    v_ded := v_abs_ded + v_loan + v_tax + v_other;
    v_net := v_gross - v_ded;

    insert into payroll (school_id, campus_id, run_id, staff_id, month, payslip_no, working_days, present_days, absent_days, leave_days,
                         late_count, overtime_minutes, basic, allowances_total, conveyance, overtime_amount, bonus, gross,
                         absence_deduction, loan_deduction, tax_deduction, other_deduction, total_deductions, net_salary)
    values (v_school, p_campus, v_run.id, sf.id, v_month, private.next_number('payslip', v_school), v_wd, v_present, v_absent + v_unpaid, v_leave,
            v_late, v_ot, v_basic, v_allow, v_conv, v_otamt, v_bonus, v_gross, v_abs_ded, v_loan, v_tax, v_other, v_ded, v_net)
    returning id into v_pid;

    insert into payroll_items (school_id, campus_id, payroll_id, kind, code, label, amount)
    select v_school, p_campus, v_pid, k, c, l, a from (values
      ('earning','BASIC','Basic salary', v_basic), ('earning','ALLOW','Allowances', v_allow),
      ('earning','CONV','Conveyance', v_conv), ('earning','OT','Overtime', v_otamt), ('earning','BONUS','Bonus', v_bonus),
      ('deduction','ABS','Absence deduction', v_abs_ded), ('deduction','LOAN','Loan instalment', v_loan),
      ('deduction','TAX','Tax', v_tax), ('deduction','OTHER','Other deductions', v_other)) t(k, c, l, a)
    where a > 0;
    v_n := v_n + 1;
  end loop;

  update payroll_runs set total_gross = coalesce((select sum(gross) from payroll where run_id = v_run.id), 0),
         total_deductions = coalesce((select sum(total_deductions) from payroll where run_id = v_run.id), 0),
         total_net = coalesce((select sum(net_salary) from payroll where run_id = v_run.id), 0)
   where id = v_run.id;
  return jsonb_build_object('run_id', v_run.id, 'payslips', v_n, 'skipped_no_salary_structure', v_skipped, 'working_days', v_wd);
end $$;

create or replace function public.approve_payroll(p_run uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare r payroll_runs;
begin
  select * into r from payroll_runs where id = p_run for update;
  if not found then raise exception 'run_not_found'; end if;
  perform private.require_perm('payroll.approve', r.campus_id);
  if not private.has_perm('financial.access') then raise exception 'permission_denied: financial.access' using errcode = '42501'; end if;
  if r.status <> 'draft' then raise exception 'payroll_not_draft'; end if;
  update payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_run;
  update payroll set status = 'approved' where run_id = p_run;
end $$;

create or replace function public.pay_payroll(p_run uuid, p_account uuid default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare r payroll_runs; l record; v_account uuid := p_account;
begin
  select * into r from payroll_runs where id = p_run for update;
  if not found then raise exception 'run_not_found'; end if;
  perform private.require_perm('payroll.approve', r.campus_id);
  if not private.has_perm('financial.access') then raise exception 'permission_denied: financial.access' using errcode = '42501'; end if;
  if r.status <> 'approved' then raise exception 'payroll_not_approved'; end if;
  if v_account is null then
    select id into v_account from accounts where school_id = r.school_id and is_active and (campus_id = r.campus_id or campus_id is null)
      order by (kind = 'bank') desc, created_at limit 1;
  end if;
  if not exists (select 1 from accounts where id = v_account and school_id = r.school_id and is_active) then raise exception 'account_not_found'; end if;

  for l in select staff_id, loan_deduction from payroll where run_id = p_run and loan_deduction > 0 loop
    update staff_loans set remaining = greatest(0, remaining - least(l.loan_deduction, remaining)) where id = (
      select id from staff_loans where staff_id = l.staff_id and status = 'active' order by issued_on limit 1);
  end loop;
  update staff_loans set status = 'cleared' where status = 'active' and remaining = 0 and school_id = r.school_id;
  update payroll set status = 'paid', paid_at = now() where run_id = p_run;
  update payroll_runs set status = 'paid', paid_at = now() where id = p_run;
  insert into transactions (school_id, campus_id, account_id, direction, amount, source_type, source_id, description, txn_date)
  values (r.school_id, r.campus_id, v_account, 'out', r.total_net, 'payroll', r.id,
          'Salaries ' || to_char(r.month, 'Mon YYYY'), private.today());
  return jsonb_build_object('paid', r.total_net);
end $$;

-- ═════════════ leave ═════════════
create or replace function private.leave_days() returns trigger
language plpgsql as $$
begin
  new.days := (select count(*) from generate_series(new.from_date, new.to_date, interval '1 day') d where extract(isodow from d) <> 7);
  if new.days = 0 then new.days := 1; end if;
  return new;
end $$;
create trigger leave_requests_days before insert on leave_requests for each row execute function private.leave_days();

create or replace function public.decide_leave(p_request uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare r leave_requests; lt leave_types; v_year int; b leave_balances; d date; v_stud students;
begin
  select * into r from leave_requests where id = p_request for update;
  if not found then raise exception 'leave_not_found'; end if;
  perform private.require_perm('leave.approve', r.campus_id);
  if r.status <> 'pending' then raise exception 'leave_not_pending'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  if p_decision = 'rejected' and coalesce(length(trim(p_note)), 0) < 3 then raise exception 'reason_required'; end if;
  if r.staff_id is not null and r.staff_id = private.my_staff_id() then raise exception 'cannot_approve_own_leave'; end if;

  if p_decision = 'approved' and r.requester_type = 'staff' then
    select * into lt from leave_types where id = r.leave_type_id;
    v_year := extract(year from r.from_date)::int;
    insert into leave_balances (school_id, staff_id, leave_type_id, year, allocated)
    values (r.school_id, r.staff_id, r.leave_type_id, v_year, lt.days_per_year)
    on conflict (staff_id, leave_type_id, year) do nothing;
    select * into b from leave_balances where staff_id = r.staff_id and leave_type_id = r.leave_type_id and year = v_year for update;
    if lt.days_per_year > 0 and b.used + r.days > b.allocated then
      raise exception 'insufficient_leave_balance: % days left', b.allocated - b.used;
    end if;
    update leave_balances set used = used + r.days where id = b.id;
    for d in select g::date from generate_series(r.from_date, r.to_date, interval '1 day') g where extract(isodow from g) <> 7 loop
      insert into staff_attendance (school_id, campus_id, staff_id, date, status, method)
      values (r.school_id, r.campus_id, r.staff_id, d, 'leave', 'manual')
      on conflict (staff_id, date) do update set status = 'leave';
    end loop;
  elsif p_decision = 'approved' and r.requester_type = 'student' then
    select * into v_stud from students where id = r.student_id;
    for d in select g::date from generate_series(r.from_date, least(r.to_date, private.today()), interval '1 day') g where extract(isodow from g) <> 7 loop
      insert into student_attendance (school_id, campus_id, student_id, section_id, academic_year_id, date, status, method)
      values (r.school_id, r.campus_id, r.student_id, v_stud.section_id, private.current_year(), d, 'leave', 'manual')
      on conflict (student_id, date) do nothing;
    end loop;
  end if;
  update leave_requests set status = p_decision, decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '') where id = p_request;
end $$;

-- ═════════════ library ═════════════
create or replace function public.issue_book(p_book uuid, p_student uuid default null, p_staff uuid default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare b library_books; v_cfg jsonb; v_days int; v_id uuid; v_btype text; v_campus uuid;
begin
  select * into b from library_books where id = p_book for update;
  if not found then raise exception 'book_not_found'; end if;
  perform private.require_perm('library.create', b.campus_id);
  if (p_student is null) = (p_staff is null) then raise exception 'one_borrower_required'; end if;
  if b.available <= 0 then raise exception 'no_copies_available'; end if;
  v_btype := case when p_student is not null then 'student' else 'staff' end;
  if exists (select 1 from library_transactions where status = 'issued' and due_on < private.today()
             and ((p_student is not null and student_id = p_student) or (p_staff is not null and staff_id = p_staff))) then
    raise exception 'borrower_has_overdue_books';
  end if;
  v_cfg := private.get_setting(b.school_id, 'library');
  v_days := coalesce((v_cfg ->> 'loan_days')::int, 14);
  insert into library_transactions (school_id, campus_id, book_id, borrower_type, student_id, staff_id, issued_on, due_on)
  values (b.school_id, b.campus_id, b.id, v_btype, p_student, p_staff, private.today(), private.today() + v_days)
  returning id into v_id;
  update library_books set available = available - 1 where id = b.id;
  return jsonb_build_object('transaction_id', v_id, 'due_on', private.today() + v_days);
end $$;

create or replace function public.return_book(p_tx uuid, p_lost boolean default false) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare t library_transactions; v_cfg jsonb; v_fine numeric := 0;
begin
  select * into t from library_transactions where id = p_tx for update;
  if not found then raise exception 'transaction_not_found'; end if;
  perform private.require_perm('library.edit', t.campus_id);
  if t.status <> 'issued' then raise exception 'already_returned'; end if;
  v_cfg := private.get_setting(t.school_id, 'library');
  if private.today() > t.due_on then
    v_fine := (private.today() - t.due_on) * coalesce((v_cfg ->> 'fine_per_day')::numeric, 5);
  end if;
  update library_transactions set status = case when p_lost then 'lost' else 'returned' end,
         returned_on = private.today(), fine_amount = v_fine where id = t.id;
  if not p_lost then update library_books set available = available + 1 where id = t.book_id; end if;
  if p_lost then update library_books set quantity = greatest(quantity - 1, 0) where id = t.book_id; end if;
  return jsonb_build_object('fine', v_fine);
end $$;

create or replace function public.renew_book(p_tx uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare t library_transactions; v_cfg jsonb; v_days int; v_max int;
begin
  select * into t from library_transactions where id = p_tx for update;
  if not found then raise exception 'transaction_not_found'; end if;
  perform private.require_perm('library.edit', t.campus_id);
  if t.status <> 'issued' then raise exception 'already_returned'; end if;
  v_cfg := private.get_setting(t.school_id, 'library');
  v_days := coalesce((v_cfg ->> 'loan_days')::int, 14);
  v_max := coalesce((v_cfg ->> 'max_renewals')::int, 2);
  if t.renewals >= v_max then raise exception 'renewal_limit_reached'; end if;
  if t.due_on < private.today() then raise exception 'overdue_cannot_renew'; end if;
  update library_transactions set due_on = due_on + v_days, renewals = renewals + 1 where id = t.id;
  return jsonb_build_object('due_on', t.due_on + v_days);
end $$;

-- ═════════════ expenses & journals ═════════════
create or replace function private.expense_guard() returns trigger
language plpgsql as $$
begin
  if current_setting('app.rpc', true) is distinct from '1' then
    if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by or new.paid_on is distinct from old.paid_on then
      raise exception 'permission_denied: expense status can only change through approval/payment';
    end if;
    if old.status in ('approved','paid') and (new.amount is distinct from old.amount or new.account_id is distinct from old.account_id) then
      raise exception 'expense_locked: approved expenses cannot be edited';
    end if;
  end if;
  return new;
end $$;
create trigger expense_guard before update on expenses for each row execute function private.expense_guard();

create or replace function private.expense_defaults() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.expense_no is null or new.expense_no = '' then new.expense_no := private.next_number('expense', new.school_id); end if;
  new.status := 'pending';
  return new;
end $$;
create trigger expense_defaults before insert on expenses for each row execute function private.expense_defaults();

create or replace function public.decide_expense(p_id uuid, p_decision text) returns void
language plpgsql security definer set search_path = public, private as $$
declare e expenses;
begin
  select * into e from expenses where id = p_id for update;
  if not found then raise exception 'expense_not_found'; end if;
  perform private.require_perm('finance.approve', e.campus_id);
  if not private.has_perm('financial.access') then raise exception 'permission_denied: financial.access' using errcode = '42501'; end if;
  if e.status <> 'pending' then raise exception 'expense_not_pending'; end if;
  if e.requested_by = auth.uid() and not private.has_role('super_admin') and not private.has_role('owner') then
    raise exception 'cannot_approve_own_expense';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  perform set_config('app.rpc', '1', true);
  update expenses set status = p_decision, approved_by = auth.uid(), approved_at = now() where id = p_id;
end $$;

create or replace function public.pay_expense(p_id uuid, p_account uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare e expenses; v_bal numeric;
begin
  select * into e from expenses where id = p_id for update;
  if not found then raise exception 'expense_not_found'; end if;
  perform private.require_perm('finance.edit', e.campus_id);
  if not private.has_perm('financial.access') then raise exception 'permission_denied: financial.access' using errcode = '42501'; end if;
  if e.status <> 'approved' then raise exception 'expense_not_approved'; end if;
  if not exists (select 1 from accounts where id = p_account and school_id = e.school_id and is_active) then raise exception 'account_not_found'; end if;
  perform set_config('app.rpc', '1', true);
  update expenses set status = 'paid', paid_on = private.today(), account_id = p_account where id = p_id;
  insert into transactions (school_id, campus_id, account_id, direction, amount, source_type, source_id, description, txn_date)
  values (e.school_id, e.campus_id, p_account, 'out', e.amount, 'expense', e.id, e.expense_no || ': ' || e.description, private.today());
end $$;

create or replace function public.post_journal(p_campus uuid, p_date date, p_memo text, p_lines jsonb) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare v_school uuid; v_id uuid; l jsonb; v_d numeric := 0; v_c numeric := 0;
begin
  perform private.require_perm('finance.create', p_campus);
  if not private.has_perm('financial.access') then raise exception 'permission_denied: financial.access' using errcode = '42501'; end if;
  select school_id into v_school from campuses where id = p_campus;
  if coalesce(trim(p_memo), '') = '' then raise exception 'memo_required'; end if;
  if jsonb_array_length(p_lines) < 2 then raise exception 'journal_needs_two_lines'; end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    v_d := v_d + coalesce((l ->> 'debit')::numeric, 0); v_c := v_c + coalesce((l ->> 'credit')::numeric, 0);
  end loop;
  if v_d <> v_c then raise exception 'journal_unbalanced: debits % ≠ credits %', v_d, v_c; end if;
  insert into journal_entries (school_id, campus_id, entry_no, entry_date, memo)
  values (v_school, p_campus, private.next_number('journal', v_school), coalesce(p_date, private.today()), trim(p_memo)) returning id into v_id;
  for l in select * from jsonb_array_elements(p_lines) loop
    if not exists (select 1 from gl_accounts where id = (l ->> 'gl_account_id')::uuid and school_id = v_school) then raise exception 'gl_account_not_found'; end if;
    insert into journal_lines (school_id, campus_id, entry_id, gl_account_id, debit, credit, narration)
    values (v_school, p_campus, v_id, (l ->> 'gl_account_id')::uuid, coalesce((l ->> 'debit')::numeric, 0), coalesce((l ->> 'credit')::numeric, 0), l ->> 'narration');
  end loop;
  return v_id;
end $$;

-- ═════════════ dashboard ═════════════
create or replace function public.dashboard_stats(p_campus uuid default null) returns jsonb
language plpgsql stable security invoker set search_path = public, private as $$
declare
  v_today date := private.today(); v_month date := date_trunc('month', private.today())::date; j jsonb := '{}';
  v_fin boolean := private.has_perm('fees.view') and private.has_perm('payments.view');
begin
  if private.has_perm('students.view') then
    j := j || jsonb_build_object(
      'total_students', (select count(*) from students where p_campus is null or campus_id = p_campus),
      'active_students', (select count(*) from students where status = 'active' and (p_campus is null or campus_id = p_campus)),
      'new_admissions', (select count(*) from students where admission_date >= v_month and (p_campus is null or campus_id = p_campus)));
  end if;
  if private.has_perm('staff.view') then
    j := j || jsonb_build_object('total_staff', (select count(*) from staff where status = 'active' and (p_campus is null or campus_id = p_campus)));
  end if;
  if private.has_perm('attendance.view') then
    j := j || jsonb_build_object(
      'present_today', (select count(*) from student_attendance where date = v_today and status in ('present','late','half_day') and (p_campus is null or campus_id = p_campus)),
      'absent_today', (select count(*) from student_attendance where date = v_today and status = 'absent' and (p_campus is null or campus_id = p_campus)),
      'late_today', (select count(*) from student_attendance where date = v_today and status = 'late' and (p_campus is null or campus_id = p_campus)));
  end if;
  if v_fin then
    j := j || jsonb_build_object(
      'fee_collected_today', (select coalesce(sum(amount - refunded_amount), 0) from payments where status = 'completed' and (paid_at at time zone 'Asia/Karachi')::date = v_today and (p_campus is null or campus_id = p_campus)),
      'fee_collected_month', (select coalesce(sum(amount - refunded_amount), 0) from payments where status = 'completed' and (paid_at at time zone 'Asia/Karachi')::date >= v_month and (p_campus is null or campus_id = p_campus)),
      'outstanding_fees', (select coalesce(sum(balance), 0) from fee_invoices where status in ('unpaid','partial') and (p_campus is null or campus_id = p_campus)),
      'defaulters', (select count(distinct student_id) from fee_invoices where status in ('unpaid','partial') and balance > 0 and due_date < v_today and (p_campus is null or campus_id = p_campus)));
  end if;
  if private.has_perm('exams.view') then
    j := j || jsonb_build_object('upcoming_exams', (select count(*) from exams where status <> 'draft' and start_date between v_today and v_today + 14 and (p_campus is null or campus_id = p_campus)));
  end if;
  j := j || jsonb_build_object('upcoming_events', (select count(*) from calendar_events where start_date between v_today and v_today + 14 and (p_campus is null or campus_id is null or campus_id = p_campus)));
  return j;
end $$;

create or replace function public.dashboard_series(p_campus uuid default null) returns jsonb
language plpgsql stable security invoker set search_path = public, private as $$
declare
  v_today date := private.today(); j jsonb := '{}';
  v_m0 date := (date_trunc('month', private.today()) - interval '5 months')::date;
begin
  if private.has_perm('fees.view') and private.has_perm('payments.view') then
    j := j || jsonb_build_object(
      'monthly_collection', (select coalesce(jsonb_agg(jsonb_build_object('label', to_char(m, 'Mon'), 'value', coalesce(v, 0)) order by m), '[]')
        from generate_series(v_m0, date_trunc('month', v_today), interval '1 month') m
        left join lateral (select sum(amount - refunded_amount) v from payments p where p.status = 'completed'
           and date_trunc('month', p.paid_at at time zone 'Asia/Karachi') = m and (p_campus is null or p.campus_id = p_campus)) q on true),
      'outstanding_by_class', (select coalesce(jsonb_agg(jsonb_build_object('label', name, 'value', v) order by lvl, name), '[]') from (
          select c.name, c.level lvl, sum(i.balance) v from fee_invoices i join students s on s.id = i.student_id join classes c on c.id = s.class_id
          where i.status in ('unpaid','partial') and (p_campus is null or i.campus_id = p_campus) group by c.name, c.level having sum(i.balance) > 0) x));
  end if;
  if private.has_perm('attendance.view') then
    j := j || jsonb_build_object('attendance_trend', (select coalesce(jsonb_agg(jsonb_build_object('label', to_char(d, 'DD Mon'), 'value', pct) order by d), '[]') from (
        select date d, round(100.0 * count(*) filter (where status in ('present','late','half_day')) / nullif(count(*) filter (where status <> 'leave'), 0), 1) pct
        from student_attendance where date >= v_today - 13 and (p_campus is null or campus_id = p_campus) group by date) x where pct is not null));
  end if;
  if private.has_perm('students.view') then
    j := j || jsonb_build_object(
      'admissions_trend', (select coalesce(jsonb_agg(jsonb_build_object('label', to_char(m, 'Mon'), 'value', coalesce(v, 0)) order by m), '[]')
        from generate_series(v_m0, date_trunc('month', v_today), interval '1 month') m
        left join lateral (select count(*) v from students s where date_trunc('month', s.admission_date) = m and (p_campus is null or s.campus_id = p_campus)) q on true),
      'class_distribution', (select coalesce(jsonb_agg(jsonb_build_object('label', name, 'value', v) order by lvl, name), '[]') from (
        select c.name, c.level lvl, count(*) v from students s join classes c on c.id = s.class_id
        where s.status = 'active' and (p_campus is null or s.campus_id = p_campus) group by c.name, c.level) x));
  end if;
  if private.has_perm('finance.view') and private.has_perm('financial.access') then
    j := j || jsonb_build_object('income_vs_expense', (select coalesce(jsonb_agg(jsonb_build_object('label', to_char(m, 'Mon'),
        'income', coalesce(i, 0), 'expense', coalesce(e, 0)) order by m), '[]')
      from generate_series(v_m0, date_trunc('month', v_today), interval '1 month') m
      left join lateral (select sum(amount) filter (where direction = 'in') i, sum(amount) filter (where direction = 'out' and source_type <> 'refund') e
         from transactions t where date_trunc('month', t.txn_date) = m and (p_campus is null or t.campus_id = p_campus)) q on true));
  end if;
  return j;
end $$;

-- ═════════════ context for the app shell ═════════════
create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'platform_admin', exists (select 1 from platform_admins where user_id = auth.uid()),
    'profile', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone, 'language', p.language,
                                           'theme', p.theme, 'avatar_path', p.avatar_path, 'preferences', p.preferences, 'school_id', p.school_id)
                from profiles p where p.id = auth.uid() and p.is_active),
    'school', (select jsonb_build_object('id', s.id, 'name', s.name, 'short_name', s.short_name, 'slug', s.slug, 'logo_path', s.logo_path,
                 'timezone', s.timezone, 'currency', s.currency, 'default_language', s.default_language, 'date_format', s.date_format)
               from schools s where s.id = private.current_school_id()),
    'roles', coalesce((select jsonb_agg(r.code order by r.code) from user_roles ur join roles r on r.id = ur.role_id
                       where ur.user_id = auth.uid() and r.school_id = private.current_school_id()), '[]'),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission_code) from user_roles ur
                             join roles r on r.id = ur.role_id and r.school_id = private.current_school_id()
                             join role_permissions rp on rp.role_id = r.id where ur.user_id = auth.uid()), '[]'),
    'campuses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'code', c.code) order by c.is_main desc, c.name)
                          from campuses c where c.school_id = private.current_school_id() and c.is_active and private.can_access_campus(c.id)), '[]'),
    'staff_id', private.my_staff_id(),
    'student_ids', coalesce((select jsonb_agg(x) from private.my_student_ids() x), '[]')
  )
$$;

-- ═════════════ global search (RLS decides what each user can find) ═════════════
create or replace function public.global_search(p_q text, p_limit int default 6)
returns table (kind text, id uuid, title text, subtitle text, href text)
language plpgsql stable security invoker set search_path = public, private as $$
declare v text := '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if length(trim(coalesce(p_q, ''))) < 2 then return; end if;
  return query
    (select 'student', s.id, s.full_name, s.student_code || coalesce(' · ' || c.name, ''), '/students/' || s.id
       from students s left join classes c on c.id = s.class_id
       where s.full_name ilike v or s.student_code ilike v or s.admission_no ilike v or s.father_name ilike v order by s.full_name limit p_limit)
    union all (select 'guardian', g.id, g.full_name, coalesce(g.phone, ''), '/families/' || g.family_id
       from guardians g where g.family_id is not null and (g.full_name ilike v or g.phone ilike v or g.cnic ilike v) order by g.full_name limit p_limit)
    union all (select 'staff', s.id, s.full_name, s.employee_code, '/staff/' || s.id
       from staff s where s.full_name ilike v or s.employee_code ilike v order by s.full_name limit p_limit)
    union all (select 'invoice', i.id, i.invoice_no, i.period_label || ' · Rs ' || i.net_amount, '/fees/invoices/' || i.id
       from fee_invoices i where i.invoice_no ilike v order by i.created_at desc limit p_limit)
    union all (select 'receipt', p.id, p.receipt_no, 'Rs ' || p.amount, '/fees/receipts/' || p.id
       from payments p where p.receipt_no ilike v or p.reference_no ilike v order by p.created_at desc limit p_limit)
    union all (select 'admission', a.id, a.full_name, a.application_no || ' · ' || a.stage, '/admissions/' || a.id
       from admissions a where a.full_name ilike v or a.application_no ilike v or a.phone ilike v order by a.created_at desc limit p_limit)
    union all (select 'exam', e.id, e.name, e.status, '/exams/' || e.id
       from exams e where e.name ilike v order by e.created_at desc limit p_limit)
    union all (select 'book', b.id, b.title, coalesce(b.author, '') || ' · ' || b.available || ' available', '/library'
       from library_books b where b.title ilike v or b.isbn ilike v or b.author ilike v order by b.title limit p_limit)
    union all (select 'vehicle', ve.id, ve.reg_no, coalesce(ve.make_model, ''), '/transport'
       from vehicles ve where ve.reg_no ilike v order by ve.reg_no limit p_limit);
end $$;

-- ═════════════ outbox (service role only) ═════════════
create or replace function public.claim_notifications(p_limit int default 20) returns setof notification_logs
language plpgsql security definer set search_path = public, private as $$
begin
  return query
  update notification_logs n set status = 'sending', attempts = attempts + 1
  where n.id in (select id from notification_logs where status = 'queued' and scheduled_for <= now() and attempts < 3
                 order by scheduled_for for update skip locked limit p_limit)
  returning n.*;
end $$;

create or replace function public.finish_notification(p_id uuid, p_status text, p_provider text,
  p_message_id text default null, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update notification_logs set status = case when p_status = 'failed' and attempts < 3 and p_error not like 'provider_not_configured%' then 'queued' else p_status end,
         provider = p_provider, provider_message_id = p_message_id, error = left(p_error, 500),
         sent_at = case when p_status = 'sent' then now() else sent_at end,
         scheduled_for = case when p_status = 'failed' then now() + interval '10 minutes' else scheduled_for end
  where id = p_id
$$;

create or replace function public.update_delivery_status(p_provider text, p_message_id text, p_status text, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update notification_logs set status = p_status,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end, error = coalesce(left(p_error, 500), error)
  where provider = p_provider and provider_message_id = p_message_id
    and status <> 'read' and (status <> 'delivered' or p_status = 'read')
$$;

-- ═════════════ provisioning & public intake (service role only) ═════════════
create or replace function public.provision_user(p_user uuid, p_school uuid, p_full_name text, p_email text, p_phone text,
  p_roles text[], p_campuses uuid[], p_link jsonb default '{}') returns void
language plpgsql security definer set search_path = public, private as $$
begin
  insert into profiles (id, school_id, full_name, email, phone) values (p_user, p_school, p_full_name, p_email, p_phone);
  insert into user_roles (user_id, role_id) select p_user, r.id from roles r where r.school_id = p_school and r.code = any (p_roles);
  insert into user_campuses (user_id, campus_id) select p_user, c.id from campuses c where c.school_id = p_school and c.id = any (coalesce(p_campuses, '{}'));
  if p_link ->> 'staff_id' is not null then update staff set profile_id = p_user where id = (p_link ->> 'staff_id')::uuid and school_id = p_school; end if;
  if p_link ->> 'guardian_id' is not null then update guardians set profile_id = p_user where id = (p_link ->> 'guardian_id')::uuid and school_id = p_school; end if;
  if p_link ->> 'student_id' is not null then update students set profile_id = p_user where id = (p_link ->> 'student_id')::uuid and school_id = p_school; end if;
  if p_link ->> 'driver_id' is not null then update drivers set profile_id = p_user where id = (p_link ->> 'driver_id')::uuid and school_id = p_school; end if;
end $$;

create or replace function public.submit_online_admission(p_slug text, p_data jsonb) returns text
language plpgsql security definer set search_path = public, private as $$
declare v_school uuid; v_campus uuid; v_no text; v_class uuid;
begin
  select id into v_school from schools where slug = p_slug and status = 'active';
  if v_school is null then raise exception 'school_not_found'; end if;
  select id into v_campus from campuses where school_id = v_school and id = coalesce(nullif(p_data ->> 'campus_id', '')::uuid, id) and is_active order by is_main desc limit 1;
  select id into v_class from classes where id = nullif(p_data ->> 'class_id', '')::uuid and campus_id = v_campus;
  if coalesce(trim(p_data ->> 'full_name'), '') = '' or coalesce(trim(p_data ->> 'guardian_name'), '') = '' or coalesce(trim(p_data ->> 'phone'), '') = '' then
    raise exception 'missing_required_fields';
  end if;
  if (p_data ->> 'gender') not in ('male','female','other') then raise exception 'invalid_gender'; end if;
  v_no := private.next_number('application', v_school);
  insert into admissions (school_id, campus_id, application_no, type, stage, academic_year_id, class_applied_id, full_name, gender, dob,
                          b_form_no, father_name, mother_name, guardian_name, guardian_relation, guardian_cnic, phone, whatsapp, email,
                          address, city, previous_school, previous_class, source, created_by)
  values (v_school, v_campus, v_no, 'new', 'application', (select id from academic_years where school_id = v_school and is_current), v_class,
          left(trim(p_data ->> 'full_name'), 120), p_data ->> 'gender', nullif(p_data ->> 'dob', '')::date, left(p_data ->> 'b_form_no', 20),
          left(p_data ->> 'father_name', 120), left(p_data ->> 'mother_name', 120), left(trim(p_data ->> 'guardian_name'), 120),
          coalesce(nullif(p_data ->> 'guardian_relation', ''), 'father'), left(p_data ->> 'guardian_cnic', 20), left(trim(p_data ->> 'phone'), 20),
          left(p_data ->> 'whatsapp', 20), left(p_data ->> 'email', 120), left(p_data ->> 'address', 300), left(p_data ->> 'city', 80),
          left(p_data ->> 'previous_school', 160), left(p_data ->> 'previous_class', 60), 'online', null);
  return v_no;
end $$;

revoke execute on function public.claim_notifications(int), public.finish_notification(uuid, text, text, text, text),
  public.update_delivery_status(text, text, text, text), public.provision_user(uuid, uuid, text, text, text, text[], uuid[], jsonb),
  public.submit_online_admission(text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_notifications(int), public.finish_notification(uuid, text, text, text, text),
  public.update_delivery_status(text, text, text, text), public.provision_user(uuid, uuid, text, text, text, text[], uuid[], jsonb),
  public.submit_online_admission(text, jsonb) to service_role;
