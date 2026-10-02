-- 0007 · Staff HR extras, leave, payroll.
set search_path = public, extensions;

-- Salary data is split from `staff` so HR clerks can manage people without
-- seeing pay. Reading it needs payroll.view AND financial.access.
create table salary_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  staff_id uuid not null,
  effective_from date not null default current_date,
  basic_salary numeric(12,2) not null check (basic_salary >= 0),
  house_allowance numeric(12,2) not null default 0 check (house_allowance >= 0),
  medical_allowance numeric(12,2) not null default 0 check (medical_allowance >= 0),
  conveyance_allowance numeric(12,2) not null default 0 check (conveyance_allowance >= 0),
  other_allowance numeric(12,2) not null default 0 check (other_allowance >= 0),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  other_deduction numeric(12,2) not null default 0 check (other_deduction >= 0),
  overtime_rate_per_hour numeric(10,2),         -- null → derived from basic
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete cascade,
  unique (staff_id, effective_from)
);

create table staff_loans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  staff_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  monthly_installment numeric(12,2) not null check (monthly_installment > 0),
  remaining numeric(12,2) not null check (remaining >= 0),
  issued_on date not null default current_date,
  status text not null default 'active' check (status in ('active','cleared','cancelled')),
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete cascade,
  check (remaining <= amount)
);

create table payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  staff_id uuid not null,
  month date not null check (date_trunc('month', month) = month),
  kind text not null check (kind in ('bonus','deduction')),
  label text not null,
  amount numeric(12,2) not null check (amount > 0),
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete cascade
);
create index payroll_adjustments_month on payroll_adjustments(staff_id, month);

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  month date not null check (date_trunc('month', month) = month),
  status text not null default 'draft' check (status in ('draft','approved','paid')),
  total_gross numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  total_net numeric(14,2) not null default 0,
  created_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campus_id, month),
  unique (id, campus_id)
);

create table payroll (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  run_id uuid not null,
  staff_id uuid not null,
  month date not null,
  payslip_no text not null,
  working_days int not null,
  present_days numeric(5,1) not null default 0,
  absent_days numeric(5,1) not null default 0,
  leave_days numeric(5,1) not null default 0,
  late_count int not null default 0,
  overtime_minutes int not null default 0,
  basic numeric(12,2) not null default 0,
  allowances_total numeric(12,2) not null default 0,
  conveyance numeric(12,2) not null default 0,
  overtime_amount numeric(12,2) not null default 0,
  bonus numeric(12,2) not null default 0,
  gross numeric(12,2) not null default 0,
  absence_deduction numeric(12,2) not null default 0,
  loan_deduction numeric(12,2) not null default 0,
  tax_deduction numeric(12,2) not null default 0,
  other_deduction numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_salary numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','approved','paid')),
  paid_at timestamptz,
  foreign key (run_id, campus_id) references payroll_runs(id, campus_id) on delete cascade,
  foreign key (staff_id, campus_id) references staff(id, campus_id) on delete restrict,
  unique (run_id, staff_id),
  unique (school_id, payslip_no),
  check (net_salary = gross - total_deductions)
);
create index payroll_staff_month on payroll(staff_id, month);

create table payroll_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  payroll_id uuid not null references payroll(id) on delete cascade,
  kind text not null check (kind in ('earning','deduction')),
  code text not null,
  label text not null,
  amount numeric(12,2) not null check (amount >= 0)
);
create index payroll_items_payroll on payroll_items(payroll_id);

-- ───────────────────────── leave ─────────────────────────
create table leave_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  name_ur text,
  days_per_year numeric(5,1) not null default 0,
  is_paid boolean not null default true,
  unique (school_id, name)
);

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  year int not null,
  allocated numeric(5,1) not null default 0,
  used numeric(5,1) not null default 0 check (used >= 0),
  unique (staff_id, leave_type_id, year)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  requester_type text not null default 'staff' check (requester_type in ('staff','student')),
  staff_id uuid references staff(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  leave_type_id uuid references leave_types(id) on delete restrict,
  from_date date not null,
  to_date date not null,
  days numeric(5,1) not null check (days > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid default auth.uid(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (to_date >= from_date),
  check ((requester_type = 'staff' and staff_id is not null and leave_type_id is not null)
      or (requester_type = 'student' and student_id is not null))
);
create index leave_requests_status on leave_requests(campus_id, status);

create trigger audit_salary_structures after insert or update or delete on salary_structures for each row execute function private.audit_trigger();
create trigger audit_payroll_runs after insert or update or delete on payroll_runs for each row execute function private.audit_trigger();
create trigger audit_payroll after update or delete on payroll for each row execute function private.audit_trigger();
create trigger audit_staff_loans after insert or update or delete on staff_loans for each row execute function private.audit_trigger();
create trigger audit_leave_requests after update or delete on leave_requests for each row execute function private.audit_trigger();

call private.apply_rls('salary_structures', 'payroll', true, 'private.has_perm(''financial.access'')');
call private.apply_rls('staff_loans', 'payroll', true, 'private.has_perm(''financial.access'')');
call private.apply_rls('payroll_adjustments', 'payroll', true, 'private.has_perm(''financial.access'')');
call private.apply_rls('payroll_runs', 'payroll', true, 'private.has_perm(''financial.access'')', null, false);
call private.apply_rls('payroll', 'payroll', true, 'private.has_perm(''financial.access'')',
  'staff_id = private.my_staff_id() and status <> ''draft''', false);
call private.apply_rls('payroll_items', 'payroll', true, 'private.has_perm(''financial.access'')',
  'payroll_id in (select p.id from public.payroll p where p.staff_id = private.my_staff_id() and p.status <> ''draft'')', false);
call private.apply_rls('leave_types', 'leave', false, null, 'true');
call private.apply_rls('leave_balances', 'leave', false, null, 'staff_id = private.my_staff_id()');

-- Leave requests: staff file and read their own; approvers act through approve_leave().
call private.apply_rls('leave_requests', 'leave', true, null,
  'requested_by = auth.uid() or staff_id = private.my_staff_id() or student_id in (select private.my_student_ids())', false);
create policy leave_requests_own_insert on leave_requests for insert to authenticated
  with check (school_id = (select private.current_school_id()) and status = 'pending'
    and requested_by = auth.uid()
    and ((requester_type = 'staff' and staff_id = private.my_staff_id()
          and campus_id = (select st.campus_id from public.staff st where st.id = staff_id))
      or (requester_type = 'student' and student_id in (select private.my_student_ids())
          and campus_id = (select s.campus_id from public.students s where s.id = student_id))));
create policy leave_requests_hr_insert on leave_requests for insert to authenticated
  with check (school_id = (select private.current_school_id()) and private.can_access_campus(campus_id)
    and private.has_perm('leave.create') and status = 'pending');
create policy leave_requests_own_cancel on leave_requests for update to authenticated
  using (requested_by = auth.uid() and status = 'pending')
  with check (requested_by = auth.uid() and status in ('pending','cancelled'));
