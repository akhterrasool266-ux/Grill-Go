-- Fee engine: generation, discounts, arrears, payments, refunds, closing, permissions.
\set ON_ERROR_STOP on
set client_min_messages = notice;
select test.reset();

-- sibling discount 10% on monthly fees, set by the school
update settings set value = jsonb_set(value, '{sibling_discount_percent}', '10')
  where school_id = test.w('schoolA') and key = 'fees';

-- a fixed scholarship for s3 and a >100% style cap check
insert into student_discounts (school_id, campus_id, student_id, kind, calc, value, reason)
  values (test.w('schoolA'), test.w('c1'), test.w('s3'), 'scholarship', 'percent', 50, 'merit');
insert into student_discounts (school_id, campus_id, student_id, kind, calc, value, reason)
  values (test.w('schoolA'), test.w('c1'), test.w('s3'), 'concession', 'fixed', 9000, 'oversized fixed discount');

-- ── generation ──
select test.as_user(test.w('accountant'));
do $$
declare r jsonb; i fee_invoices; n int;
begin
  r := public.generate_invoices(test.w('c1'), date '2026-09-15', date '2026-09-10');
  perform test.eq((r ->> 'created')::int, 3, 'three invoices created for campus 1');

  select * into i from fee_invoices where student_id = test.w('s1') and fee_month = date '2026-09-01';
  perform test.eq(i.subtotal, 5000.00, 'eldest sibling pays full tuition');
  perform test.eq(i.discount_total, 0.00, 'eldest sibling gets no discount');

  select * into i from fee_invoices where student_id = test.w('s2') and fee_month = date '2026-09-01';
  perform test.eq(i.discount_total, 500.00, 'younger sibling gets 10% sibling discount');
  perform test.eq(i.net_amount, 4500.00, 'net after sibling discount');

  select * into i from fee_invoices where student_id = test.w('s3') and fee_month = date '2026-09-01';
  perform test.eq(i.discount_total, 5000.00, 'stacked discounts are capped at the amount billed');
  perform test.eq(i.net_amount, 0.00, 'fully discounted invoice nets to zero');
  perform test.eq(i.status, 'paid', 'zero-balance invoice is paid');

  r := public.generate_invoices(test.w('c1'), date '2026-09-01', date '2026-09-10');
  perform test.eq((r ->> 'created')::int, 0, 'regenerating the same month creates nothing');
  perform test.eq((r ->> 'skipped_existing')::int, 3, 'existing invoices are skipped, not duplicated');

  select count(*) into n from fee_invoices where campus_id = test.w('c2');
  perform test.eq(n, 0, 'other campus untouched');
end $$;

-- ── payments: partial → full, receipts, allocation ──
do $$
declare r jsonb; i fee_invoices; p payments;
begin
  r := public.collect_payment(test.w('c1'), test.w('s1'), null, 2000, 'cash');
  select * into i from fee_invoices where student_id = test.w('s1') and fee_month = date '2026-09-01';
  perform test.eq(i.status, 'partial', 'partial payment marks invoice partial');
  perform test.eq(i.balance, 3000.00, 'balance after partial payment');
  perform test.ok((r ->> 'receipt_no') like 'RCT-%', 'receipt number generated');

  r := public.collect_payment(test.w('c1'), test.w('s1'), null, 3500, 'bank', 'TXN-998');
  select * into i from fee_invoices where student_id = test.w('s1') and fee_month = date '2026-09-01';
  perform test.eq(i.status, 'paid', 'second payment settles the invoice');
  perform test.eq((r ->> 'advance')::numeric, 500.00, 'overpayment is kept as advance credit');

  perform test.raises($q$select public.collect_payment(test.w('c1'), test.w('s1'), null, 100, 'bank')$q$,
    'reference_required', 'non-cash payment needs a reference');
  perform test.raises($q$select public.collect_payment(test.w('c1'), test.w('s1'), null, -5, 'cash')$q$,
    'invalid_amount', 'negative payment rejected');
  perform test.raises($q$select public.collect_payment(test.w('c2'), test.w('s4'), null, 100, 'cash')$q$,
    'permission_denied', 'cashier of campus 1 cannot take money for campus 2');
end $$;

-- ── arrears + advance credit on next month ──
do $$
declare r jsonb; i fee_invoices; n numeric;
begin
  r := public.generate_invoices(test.w('c1'), date '2026-10-01', date '2026-10-10');
  select * into i from fee_invoices where student_id = test.w('s1') and fee_month = date '2026-10-01';
  perform test.eq(i.paid_amount, 500.00, 'advance credit is applied to the next invoice automatically');
  perform test.eq(i.balance, 4500.00, 'balance after credit');

  select * into i from fee_invoices where student_id = test.w('s2') and fee_month = date '2026-10-01';
  perform test.eq(i.previous_balance, 4500.00, 'unpaid previous month shows as previous balance on the voucher');
  perform test.eq(i.total_payable, 9000.00, 'total payable = previous balance + this month');

  -- outstanding is computed from invoices, never double counted
  select sum(balance) into n from fee_invoices where student_id = test.w('s2');
  perform test.eq(n, 9000.00, 'outstanding = sum of invoice balances (no double counting)');
end $$;

-- ── family payment spreads over siblings, oldest first ──
do $$
declare r jsonb; n numeric;
begin
  r := public.collect_payment(test.w('c1'), null, test.w('fam'), 10000, 'cash');
  select sum(balance) into n from fee_invoices where student_id in (test.w('s1'), test.w('s2'));
  perform test.eq(n, 3500.00, 'family payment of 10,000 against 13,500 outstanding leaves 3,500');
  perform test.eq((select status from fee_invoices where student_id = test.w('s2') and fee_month = date '2026-09-01'), 'paid',
    'oldest invoice is settled first');
end $$;

-- ── refunds ──
do $$
declare r jsonb; pid uuid; pay payments; i fee_invoices;
begin
  r := public.collect_payment(test.w('c1'), test.w('s2'), null, 1000, 'cash');
  pid := (r ->> 'payment_id')::uuid;
  select * into i from fee_invoices where student_id = test.w('s2') and fee_month = date '2026-10-01';
  perform test.eq(i.paid_amount, 1000.00 + (select coalesce(sum(a.amount),0) - 1000 from payment_allocations a where a.invoice_id = i.id), 'sanity: invoice has payments');

  r := public.refund_payment(pid, 400, 'Paid twice by mistake');
  select * into pay from payments where id = pid;
  perform test.eq(pay.refunded_amount, 400.00, 'refund recorded on the payment');
  perform test.eq(pay.allocated_amount, 600.00, 'refund reverses allocation on the invoice');
  perform test.raises(format($q$select public.refund_payment(%L, 700, 'too much')$q$, pid), 'refund_exceeds_payment', 'cannot refund more than was paid');
  perform test.raises(format($q$select public.refund_payment(%L, 10, '')$q$, pid), 'reason_required', 'refund needs a reason');
end $$;

-- ── adjustments & cancellation ──
do $$
declare inv uuid; i fee_invoices;
begin
  select id into inv from fee_invoices where student_id = test.w('s3') and fee_month = date '2026-10-01';
  perform test.raises(format($q$select public.adjust_invoice(%L, 'discount', 1, 'x', 'because')$q$, inv), 'discount_exceeds_charges', 'cannot discount a fully discounted invoice');
  select id into inv from fee_invoices where student_id = test.w('s2') and fee_month = date '2026-10-01';
  perform public.adjust_invoice(inv, 'discount', 500, 'Principal approval', 'Hardship');
  select * into i from fee_invoices where id = inv;
  perform test.eq(i.discount_total, 1000.00, 'manual discount stacks on the sibling discount');
  perform test.raises(format($q$select public.adjust_invoice(%L, 'discount', 4000, 'too big', 'because')$q$, inv), 'discount_exceeds', 'discount cannot push net below what was already paid');
  perform test.raises(format($q$select public.cancel_invoice(%L, 'oops')$q$, inv), 'invoice_has_payments', 'invoice with payments cannot be cancelled');
end $$;

-- ── late fines ──
do $$
declare r jsonb; i fee_invoices; inv uuid;
begin
  r := public.apply_late_fines(test.w('c1'), date '2026-10-20');
  perform test.ok((r ->> 'fined')::int >= 1, 'late fine applied to overdue invoices');
  select * into i from fee_invoices where student_id = test.w('s2') and fee_month = date '2026-10-01';
  perform test.eq(i.fine_total, 200.00, 'flat late fine of Rs 200');
  r := public.apply_late_fines(test.w('c1'), date '2026-10-21');
  select * into i from fee_invoices where student_id = test.w('s2') and fee_month = date '2026-10-01';
  perform test.eq(i.fine_total, 200.00, 'fine is applied once, not stacked');
  perform public.adjust_invoice(i.id, 'waive_fines', null, null, 'Waived by principal');
  r := public.apply_late_fines(test.w('c1'), date '2026-10-25');
  select * into i from fee_invoices where id = i.id;
  perform test.eq(i.fine_total, 0.00, 'waived fines are not re-applied');
end $$;

-- ── defaulters ──
do $$
declare n int;
begin
  select count(*) into n from public.fee_defaulters(test.w('c1'), p_as_of => date '2026-10-20');
  perform test.ok(n >= 1, 'defaulters list is produced');
  perform test.ok(not exists (select 1 from public.fee_defaulters(test.w('c1'), p_as_of => date '2026-10-20') where student_id = test.w('s3')),
    'fully discounted student is not a defaulter');
end $$;

-- ── daily closing ──
do $$
declare r jsonb;
begin
  r := public.close_day(test.w('c1'), (now() at time zone 'Asia/Karachi')::date, 3000);
  perform test.ok((r ->> 'closing_no') like 'CLS-%', 'day closed with a closing number');
  perform test.raises($q$select public.collect_payment(test.w('c1'), test.w('s1'), null, 100, 'cash')$q$, 'day_closed', 'no payments after the day is closed');
  perform test.raises($q$select public.close_day(test.w('c1'), (now() at time zone 'Asia/Karachi')::date, 1)$q$, 'already_closed', 'cannot close twice');
end $$;

-- ── ledger ──
select test.reset();
do $$
declare cash numeric;
begin
  select balance into cash from account_balances where school_id = test.w('schoolA') and name = 'Cash in Hand';
  perform test.ok(cash > 0, 'cash book reflects collected payments');
end $$;

-- ── permissions & isolation ──
select test.as_user(test.w('teacher1'));
do $$
declare n int;
begin
  select count(*) into n from fee_invoices;
  perform test.eq(n, 0, 'teacher sees no fee invoices (no fees.view)');
  select count(*) into n from payments;
  perform test.eq(n, 0, 'teacher sees no payments');
  perform test.raises($q$select public.generate_invoices(test.w('c1'), date '2026-11-01', date '2026-11-10')$q$, 'permission_denied', 'teacher cannot generate invoices');
  perform test.raises($q$insert into fee_invoices (campus_id, invoice_no, student_id, period_label, due_date) values (test.w('c1'), 'X', test.w('s1'), 'x', current_date)$q$,
    'permission denied', 'nobody can insert invoices directly');
end $$;

select test.as_user(test.w('accountant'));
do $$
declare n int;
begin
  select count(*) into n from fee_invoices where campus_id = test.w('c2');
  perform test.eq(n, 0, 'accountant of campus 1 cannot see campus 2 invoices');
  perform test.raises($q$update fee_invoices set discount_total = 100 where true$q$, 'permission denied', 'invoices cannot be edited directly');
  select count(*) into n from audit_logs;
  perform test.eq(n, 0, 'accountant cannot read audit logs');
end $$;

select test.as_user(test.w('adminB'));
do $$
declare n int;
begin
  select count(*) into n from fee_invoices;
  perform test.eq(n, 0, 'other school sees none of school A''s invoices');
  select count(*) into n from students;
  perform test.eq(n, 0, 'other school sees none of school A''s students');
end $$;

select test.as_user(test.w('parent1'));
do $$
declare n int;
begin
  select count(*) into n from fee_invoices;
  perform test.ok(n >= 2, 'parent sees their own children''s invoices');
  select count(*) into n from fee_invoices where student_id = test.w('s3');
  perform test.eq(n, 0, 'parent cannot see someone else''s child');
  select count(*) into n from students;
  perform test.eq(n, 2, 'parent sees exactly their two children');
end $$;
select test.reset();
