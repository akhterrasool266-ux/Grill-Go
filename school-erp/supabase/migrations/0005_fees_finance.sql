-- 0005 · Fees, billing, payments, finance.
-- Money tables are read-only to clients: every write goes through a
-- SECURITY DEFINER function (0009) that recomputes amounts from the database.
set search_path = public, extensions;

-- ───────────────────────── fee set-up ─────────────────────────
create table fee_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  code text not null,
  name text not null,
  name_ur text,
  kind text not null default 'monthly' check (kind in ('monthly','admission','annual','exam','transport','hostel','misc')),
  is_active boolean not null default true,
  unique (school_id, code)
);

create table fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  class_id uuid,                               -- null = every class of the campus
  fee_category_id uuid not null references fee_categories(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly','once','annual','termly')),
  foreign key (class_id, campus_id) references classes(id, campus_id) on delete cascade
);
create unique index fee_structures_unique on fee_structures
  (campus_id, academic_year_id, fee_category_id, coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Per-student overrides: a different amount, a custom recurring charge, or an exemption.
create table student_fee_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  fee_category_id uuid not null references fee_categories(id) on delete cascade,
  amount_override numeric(12,2) check (amount_override is null or amount_override >= 0),
  is_exempt boolean not null default false,
  note text,
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  unique (student_id, academic_year_id, fee_category_id)
);

create table student_discounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  academic_year_id uuid references academic_years(id) on delete cascade,
  kind text not null check (kind in ('sibling','scholarship','concession','staff_child','other')),
  calc text not null check (calc in ('percent','fixed')),
  value numeric(12,2) not null check (value > 0),
  fee_category_id uuid references fee_categories(id) on delete cascade,   -- null = all categories
  reason text,
  valid_from date,
  valid_to date,
  is_active boolean not null default true,
  approved_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade,
  check (calc <> 'percent' or value <= 100),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index student_discounts_student on student_discounts(student_id) where is_active;

-- ───────────────────────── invoices ─────────────────────────
create table fee_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  invoice_no text not null,
  student_id uuid not null,
  family_id uuid references families(id) on delete set null,
  academic_year_id uuid references academic_years(id) on delete set null,
  invoice_type text not null default 'monthly' check (invoice_type in ('monthly','adhoc','admission')),
  fee_month date,                               -- first day of the billed month
  period_label text not null,
  issue_date date not null default current_date,
  due_date date not null,
  previous_balance numeric(12,2) not null default 0 check (previous_balance >= 0),   -- snapshot for the voucher only
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  fine_total numeric(12,2) not null default 0 check (fine_total >= 0),
  net_amount numeric(12,2) generated always as (subtotal - discount_total + fine_total) stored,
  total_payable numeric(12,2) generated always as (previous_balance + subtotal - discount_total + fine_total) stored,
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  balance numeric(12,2) generated always as (subtotal - discount_total + fine_total - paid_amount) stored,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid','cancelled')),
  voucher_ref text not null default replace(gen_random_uuid()::text, '-', ''),
  notes text,
  fine_waived boolean not null default false,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, campus_id) references students(id, campus_id) on delete restrict,
  unique (school_id, invoice_no),
  unique (id, campus_id),
  unique (voucher_ref),
  check (discount_total <= subtotal),
  check (paid_amount <= subtotal - discount_total + fine_total)
);
create unique index fee_invoices_monthly_once on fee_invoices(student_id, fee_month)
  where invoice_type = 'monthly' and status <> 'cancelled';
create unique index fee_invoices_adhoc_once on fee_invoices(student_id, period_label)
  where invoice_type <> 'monthly' and status <> 'cancelled';
create index fee_invoices_campus_status on fee_invoices(campus_id, status, due_date);
create index fee_invoices_student on fee_invoices(student_id);
create index fee_invoices_family on fee_invoices(family_id);

create table fee_invoice_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  invoice_id uuid not null,
  kind text not null check (kind in ('charge','discount','fine')),
  fee_category_id uuid references fee_categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, campus_id) references fee_invoices(id, campus_id) on delete cascade
);
create index fee_invoice_items_invoice on fee_invoice_items(invoice_id);

-- ───────────────────────── payments ─────────────────────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete restrict,   -- where the money was received
  receipt_no text not null,
  student_id uuid references students(id) on delete restrict,
  family_id uuid references families(id) on delete restrict,
  payer_name text,
  amount numeric(12,2) not null check (amount > 0),
  allocated_amount numeric(12,2) not null default 0 check (allocated_amount >= 0),
  refunded_amount numeric(12,2) not null default 0 check (refunded_amount >= 0),
  method text not null check (method in ('cash','bank','jazzcash','easypaisa','card','online_transfer','other')),
  reference_no text,
  bank_name text,
  account_id uuid,
  paid_at timestamptz not null default now(),
  status text not null default 'completed' check (status in ('completed','pending','failed')),
  gateway text,
  gateway_txn_id text,
  notes text,
  closing_id uuid,
  received_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (school_id, receipt_no),
  check (student_id is not null or family_id is not null),
  check (refunded_amount <= amount),
  check (allocated_amount + refunded_amount <= amount)
);
create index payments_campus_paid on payments(campus_id, paid_at);
create index payments_student on payments(student_id);
create index payments_family on payments(family_id);
create unique index payments_gateway_txn on payments(gateway, gateway_txn_id) where gateway_txn_id is not null;

create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  payment_id uuid not null references payments(id) on delete restrict,
  invoice_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, campus_id) references fee_invoices(id, campus_id) on delete restrict,
  unique (payment_id, invoice_id)
);
create index payment_allocations_invoice on payment_allocations(invoice_id);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete restrict,
  payment_id uuid not null references payments(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (length(trim(reason)) >= 3),
  method text,
  refunded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table cash_closings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  closing_date date not null,
  closing_no text not null,
  expected_cash numeric(12,2) not null,
  counted_cash numeric(12,2) not null,
  difference numeric(12,2) generated always as (counted_cash - expected_cash) stored,
  totals_by_method jsonb not null default '{}',
  notes text,
  closed_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (campus_id, closing_date),
  unique (school_id, closing_no)
);
alter table payments add constraint payments_closing_fk foreign key (closing_id) references cash_closings(id) on delete set null;

-- Online payments: an intent is created by the server, completed only by a
-- verified gateway callback (never by the browser).
create table payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  family_id uuid references families(id) on delete cascade,
  gateway text not null,
  amount numeric(12,2) not null check (amount > 0),
  reference text not null unique,
  status text not null default 'created' check (status in ('created','pending','paid','failed','expired')),
  payment_id uuid references payments(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);

create table payment_gateway_events (
  id bigint generated always as identity primary key,
  school_id uuid references schools(id) on delete cascade,
  gateway text not null,
  intent_id uuid references payment_intents(id),
  signature_valid boolean not null,
  payload jsonb not null,
  outcome text,
  received_at timestamptz not null default now()
);

-- ───────────────────────── finance ─────────────────────────
create table accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid references campuses(id) on delete cascade,     -- null = shared across campuses
  name text not null,
  code text,
  kind text not null default 'cash' check (kind in ('cash','bank','petty_cash','wallet')),
  methods text[] not null default '{}',           -- payment methods credited to this account
  bank_name text, account_no text,
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
alter table payments add constraint payments_account_fk foreign key (account_id) references accounts(id) on delete set null;

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  name_ur text,
  is_active boolean not null default true,
  unique (school_id, name)
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  name text not null,
  phone text, email text, address text, ntn text,
  unique (school_id, name)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  expense_no text not null,
  category_id uuid references expense_categories(id) on delete set null,
  vendor_id uuid references vendors(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  description text not null,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  receipt_path text,
  requested_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, expense_no)
);
create index expenses_campus_date on expenses(campus_id, expense_date);

-- The cash/bank book. Append-only; written only by payment/expense/payroll RPCs.
create table transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  txn_date date not null default current_date,
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null check (amount > 0),
  source_type text not null check (source_type in ('payment','refund','expense','payroll','manual','transfer')),
  source_id uuid,
  description text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index transactions_account_date on transactions(account_id, txn_date);
create index transactions_campus_date on transactions(campus_id, txn_date);

create or replace view account_balances with (security_invoker = true) as
select a.id as account_id, a.school_id, a.campus_id, a.name, a.kind,
       a.opening_balance + coalesce(sum(case when t.direction = 'in' then t.amount else -t.amount end), 0) as balance
from accounts a left join transactions t on t.account_id = a.id
group by a.id;

-- Double-entry groundwork: chart of accounts + balanced journals.
create table gl_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','income','expense')),
  parent_id uuid references gl_accounts(id) on delete set null,
  is_active boolean not null default true,
  unique (school_id, code)
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  entry_no text not null,
  entry_date date not null default current_date,
  memo text not null,
  source_type text,
  source_id uuid,
  posted_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (school_id, entry_no)
);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  entry_id uuid not null references journal_entries(id) on delete cascade,
  gl_account_id uuid not null references gl_accounts(id) on delete restrict,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  narration text,
  check ((debit = 0) <> (credit = 0))
);
create index journal_lines_entry on journal_lines(entry_id);

create or replace function private.journal_balanced() returns trigger
language plpgsql as $$
declare v_entry uuid := coalesce(new.entry_id, old.entry_id); v_d numeric; v_c numeric;
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_d, v_c from journal_lines where entry_id = v_entry;
  if exists (select 1 from journal_entries where id = v_entry) and v_d <> v_c then
    raise exception 'journal_unbalanced: debits % ≠ credits %', v_d, v_c;
  end if;
  return null;
end $$;
create constraint trigger journal_balanced after insert or update or delete on journal_lines
  deferrable initially deferred for each row execute function private.journal_balanced();

-- ───────────────────────── triggers ─────────────────────────
create trigger fee_invoices_updated before update on fee_invoices for each row execute function private.set_updated_at();
create trigger expenses_updated before update on expenses for each row execute function private.set_updated_at();

create trigger audit_fee_structures after insert or update or delete on fee_structures for each row execute function private.audit_trigger();
create trigger audit_student_fee_assignments after insert or update or delete on student_fee_assignments for each row execute function private.audit_trigger();
create trigger audit_student_discounts after insert or update or delete on student_discounts for each row execute function private.audit_trigger();
create trigger audit_fee_invoices after update or delete on fee_invoices for each row execute function private.audit_trigger();
create trigger audit_fee_invoice_items after update or delete on fee_invoice_items for each row execute function private.audit_trigger();
create trigger audit_payments after insert or update or delete on payments for each row execute function private.audit_trigger();
create trigger audit_refunds after insert on refunds for each row execute function private.audit_trigger();
create trigger audit_cash_closings after insert on cash_closings for each row execute function private.audit_trigger();
create trigger audit_expenses after insert or update or delete on expenses for each row execute function private.audit_trigger();
create trigger audit_accounts after insert or update or delete on accounts for each row execute function private.audit_trigger();

-- ───────────────────────── RLS ─────────────────────────
call private.apply_rls('fee_categories', 'fees', false, null, 'true');
call private.apply_rls('fee_structures', 'fees', true, null, 'campus_id in (select private.my_campus_ids())');
call private.apply_rls('student_fee_assignments', 'fees', true, 'private.has_perm(''fees.approve'')');
call private.apply_rls('student_discounts', 'fees', true, 'private.has_perm(''fees.approve'')');

call private.apply_rls('fee_invoices', 'fees', true, null, 'student_id in (select private.my_student_ids())', false);
call private.apply_rls('fee_invoice_items', 'fees', true, null,
  'invoice_id in (select i.id from public.fee_invoices i where i.student_id in (select private.my_student_ids()))', false);
call private.apply_rls('payments', 'payments', true, null,
  'student_id in (select private.my_student_ids()) or family_id in (select s.family_id from public.students s where s.id in (select private.my_student_ids()))', false);
call private.apply_rls('payment_allocations', 'payments', true, null,
  'invoice_id in (select i.id from public.fee_invoices i where i.student_id in (select private.my_student_ids()))', false);
call private.apply_rls('refunds', 'payments', true, 'private.has_perm(''payments.approve'')', null, false);
call private.apply_rls('cash_closings', 'payments', true, null, null, false);

call private.apply_rls('payment_intents', 'payments', true, null, 'student_id in (select private.my_student_ids())', false);
alter table payment_gateway_events enable row level security;     -- service role only

call private.apply_rls('accounts', 'finance', true, 'private.has_perm(''financial.access'')');
call private.apply_rls('expense_categories', 'finance', false, 'private.has_perm(''financial.access'')');
call private.apply_rls('vendors', 'finance', false, 'private.has_perm(''financial.access'')');
call private.apply_rls('expenses', 'finance', true, 'private.has_perm(''financial.access'')');
call private.apply_rls('transactions', 'finance', true, 'private.has_perm(''financial.access'')', null, false);
call private.apply_rls('gl_accounts', 'finance', false, 'private.has_perm(''financial.access'')');
call private.apply_rls('journal_entries', 'finance', true, 'private.has_perm(''financial.access'')', null, false);
call private.apply_rls('journal_lines', 'finance', true, 'private.has_perm(''financial.access'')', null, false);
