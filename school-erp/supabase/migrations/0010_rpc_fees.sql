-- 0010 · Fee engine: invoice generation, payments, refunds, adjustments, fines, closing.
-- All money maths lives here, in one place, inside transactions.
set search_path = public, extensions;

create or replace function private.today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Karachi')::date $$;

-- ───────────── notification outbox helper ─────────────
create or replace function private.queue_guardian_notifications(
  p_student uuid, p_key text, p_meta jsonb, p_campus uuid default null) returns int
language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid; v_cfg jsonb; v_channel text; v_lang text; v_n int := 0; g record;
  v_meta jsonb; v_addr text;
begin
  select school_id into v_school from students where id = p_student;
  if v_school is null then return 0; end if;
  v_cfg := private.get_setting(v_school, 'notifications');
  if coalesce((v_cfg -> 'events' ->> p_key)::boolean, true) = false then return 0; end if;
  v_channel := coalesce(v_cfg ->> 'guardian_channel', 'whatsapp');
  v_lang := coalesce(v_cfg ->> 'language', 'en');
  v_meta := coalesce(p_meta, '{}'::jsonb) || (
    select jsonb_build_object('student_name', s.full_name, 'student_code', s.student_code,
                              'class_name', coalesce(c.name, ''), 'school_name', sc.name)
    from students s left join classes c on c.id = s.class_id join schools sc on sc.id = s.school_id
    where s.id = p_student);

  for g in
    select gu.id, gu.profile_id, gu.phone, gu.whatsapp, gu.email
    from student_guardians sg join guardians gu on gu.id = sg.guardian_id
    where sg.student_id = p_student and (sg.is_primary or sg.pays_fees)
    union
    select gu.id, gu.profile_id, gu.phone, gu.whatsapp, gu.email
    from student_guardians sg join guardians gu on gu.id = sg.guardian_id
    where sg.student_id = p_student
      and not exists (select 1 from student_guardians x where x.student_id = p_student and (x.is_primary or x.pays_fees))
  loop
    v_addr := case v_channel when 'whatsapp' then coalesce(g.whatsapp, g.phone)
                             when 'sms' then g.phone when 'email' then g.email end;
    if v_addr is not null and length(trim(v_addr)) > 0 then
      insert into notification_logs (school_id, campus_id, channel, to_address, template_key, language, meta, student_id, guardian_id)
      values (v_school, p_campus, v_channel, trim(v_addr), p_key, v_lang, v_meta, p_student, g.id);
      v_n := v_n + 1;
    end if;
    if g.profile_id is not null then
      insert into notifications (school_id, user_id, title, body, level, link)
      values (v_school, g.profile_id, initcap(replace(p_key, '_', ' ')),
              (select coalesce(t.body, '') from notification_templates t
                where t.school_id = v_school and t.key = p_key and t.channel = 'in_app' and t.language = v_lang),
              case when p_key = 'absence_alert' then 'warning' else 'info' end, '/portal/parent');
    end if;
  end loop;
  return v_n;
end $$;

-- ───────────── invoice maths ─────────────
create or replace function private.refresh_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare v_sub numeric; v_disc numeric; v_fine numeric; v_paid numeric; v_status text; v_cur text;
begin
  select status into v_cur from fee_invoices where id = p_invoice for update;
  if v_cur is null then return; end if;
  select coalesce(sum(amount) filter (where kind = 'charge'), 0),
         coalesce(sum(amount) filter (where kind = 'discount'), 0),
         coalesce(sum(amount) filter (where kind = 'fine'), 0)
    into v_sub, v_disc, v_fine from fee_invoice_items where invoice_id = p_invoice;
  select coalesce(sum(amount), 0) into v_paid from payment_allocations where invoice_id = p_invoice;
  v_status := case when v_cur = 'cancelled' then 'cancelled'
                   when v_paid >= v_sub - v_disc + v_fine then 'paid'
                   when v_paid > 0 then 'partial' else 'unpaid' end;
  update fee_invoices set subtotal = v_sub, discount_total = v_disc, fine_total = v_fine,
         paid_amount = v_paid, status = v_status where id = p_invoice;
end $$;

-- Uses unapplied payment credit (advance payments) against open invoices.
create or replace function private.apply_credits(p_student uuid) returns numeric
language plpgsql security definer set search_path = public, private as $$
declare p record; i record; v_credit numeric; v_take numeric; v_total numeric := 0; v_family uuid;
begin
  select family_id into v_family from students where id = p_student;
  for p in
    select id, amount - allocated_amount - refunded_amount as credit from payments
    where status = 'completed' and (student_id = p_student or (family_id is not null and family_id = v_family and student_id is null))
      and amount - allocated_amount - refunded_amount > 0
    order by paid_at for update
  loop
    v_credit := p.credit;
    for i in
      select id, campus_id, balance from fee_invoices
      where student_id = p_student and status in ('unpaid','partial') and balance > 0
      order by due_date, created_at for update
    loop
      exit when v_credit <= 0;
      v_take := least(v_credit, i.balance);
      insert into payment_allocations (school_id, campus_id, payment_id, invoice_id, amount)
      select school_id, i.campus_id, p.id, i.id, v_take from payments where id = p.id
      on conflict (payment_id, invoice_id) do update set amount = payment_allocations.amount + excluded.amount;
      update payments set allocated_amount = allocated_amount + v_take where id = p.id;
      perform private.refresh_invoice(i.id);
      v_credit := v_credit - v_take; v_total := v_total + v_take;
    end loop;
  end loop;
  return v_total;
end $$;

-- ───────────── generate_invoices ─────────────
create or replace function private.generate_invoices_core(
  p_campus uuid, p_month date, p_due date,
  p_class uuid default null, p_student uuid default null,
  p_type text default 'monthly', p_category_ids uuid[] default null, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid; v_year uuid; v_month date; v_label text; v_cfg jsonb; v_sib numeric;
  s record; c record; d record; v_inv uuid; v_sub numeric; v_disc numeric; v_prev numeric; v_amt numeric;
  v_created int := 0; v_skipped int := 0; v_nocharge int := 0; v_tr uuid; v_ho uuid;
  v_month_end date; v_elig numeric; v_rank int;
begin
  if p_type not in ('monthly','adhoc') then raise exception 'invalid_invoice_type'; end if;
  if p_due is null then raise exception 'due_date_required'; end if;
  select school_id into v_school from campuses where id = p_campus;
  v_year := private.current_year(v_school);
  if v_year is null then raise exception 'no_current_academic_year'; end if;

  if p_type = 'monthly' then
    v_month := date_trunc('month', p_month)::date;
    v_label := to_char(v_month, 'FMMon YYYY');
  else
    if coalesce(trim(p_label), '') = '' then raise exception 'label_required'; end if;
    if p_category_ids is null or cardinality(p_category_ids) = 0 then raise exception 'categories_required'; end if;
    v_month := null; v_label := trim(p_label);
  end if;
  v_month_end := (coalesce(v_month, private.today()) + interval '1 month - 1 day')::date;

  v_cfg := private.get_setting(v_school, 'fees');
  v_sib := coalesce((v_cfg ->> 'sibling_discount_percent')::numeric, 0);
  select id into v_tr from fee_categories where school_id = v_school and kind = 'transport' and is_active order by code limit 1;
  select id into v_ho from fee_categories where school_id = v_school and kind = 'hostel' and is_active order by code limit 1;

  create temp table if not exists _charges (fee_category_id uuid, description text, amount numeric, kind text) on commit drop;

  for s in
    select st.id, st.family_id, st.class_id, st.full_name
    from students st
    where st.campus_id = p_campus and st.status = 'active'
      and (p_class is null or st.class_id = p_class)
      and (p_student is null or st.id = p_student)
    order by st.student_code
  loop
    if exists (select 1 from fee_invoices i where i.student_id = s.id and i.status <> 'cancelled'
               and ((p_type = 'monthly' and i.invoice_type = 'monthly' and i.fee_month = v_month)
                 or (p_type = 'adhoc' and i.invoice_type <> 'monthly' and i.period_label = v_label))) then
      v_skipped := v_skipped + 1; continue;
    end if;

    truncate _charges;

    -- structure amounts (class-specific beats campus-wide), then per-student overrides / exemptions
    insert into _charges
    select distinct on (fs.fee_category_id) fs.fee_category_id, fc.name, fs.amount, fc.kind
    from fee_structures fs join fee_categories fc on fc.id = fs.fee_category_id and fc.is_active
    where fs.campus_id = p_campus and fs.academic_year_id = v_year
      and (fs.class_id = s.class_id or fs.class_id is null)
      and ((p_type = 'monthly' and fs.frequency = 'monthly')
        or (p_type = 'adhoc' and fs.fee_category_id = any (p_category_ids)))
    order by fs.fee_category_id, (fs.class_id is not null) desc;

    for c in select * from student_fee_assignments a
             where a.student_id = s.id and a.academic_year_id = v_year loop
      if c.is_exempt then
        delete from _charges where fee_category_id = c.fee_category_id;
      elsif c.amount_override is not null then
        if exists (select 1 from _charges where fee_category_id = c.fee_category_id) then
          update _charges set amount = c.amount_override where fee_category_id = c.fee_category_id;
        elsif p_type = 'monthly' or c.fee_category_id = any (coalesce(p_category_ids, '{}')) then
          insert into _charges select c.fee_category_id, fc.name, c.amount_override, fc.kind
            from fee_categories fc where fc.id = c.fee_category_id;
        end if;
      end if;
    end loop;

    if p_type = 'monthly' then
      if v_tr is not null then
        insert into _charges select v_tr, 'Transport Fee', st.monthly_fee, 'transport' from student_transport st
          where st.student_id = s.id and st.is_active and st.monthly_fee > 0
            and not exists (select 1 from _charges where fee_category_id = v_tr);
      end if;
      if v_ho is not null then
        insert into _charges select v_ho, 'Hostel Fee', h.monthly_fee, 'hostel' from hostel_allocations h
          where h.student_id = s.id and h.status = 'active' and h.monthly_fee > 0
            and not exists (select 1 from _charges where fee_category_id = v_ho);
      end if;
    end if;

    delete from _charges where amount <= 0;
    select coalesce(sum(amount), 0) into v_sub from _charges;
    if v_sub <= 0 then v_nocharge := v_nocharge + 1; continue; end if;

    select coalesce(sum(i.balance), 0) into v_prev from fee_invoices i
      where i.student_id = s.id and i.status in ('unpaid','partial');

    insert into fee_invoices (school_id, campus_id, invoice_no, student_id, family_id, academic_year_id, invoice_type,
                              fee_month, period_label, due_date, previous_balance)
    values (v_school, p_campus, private.next_number('invoice', v_school), s.id, s.family_id, v_year, p_type,
            v_month, v_label, p_due, v_prev)
    returning id into v_inv;

    insert into fee_invoice_items (school_id, campus_id, invoice_id, kind, fee_category_id, description, amount)
    select v_school, p_campus, v_inv, 'charge', fee_category_id, description, amount from _charges;

    -- discounts, capped so they never exceed what is being billed
    v_disc := 0;
    for d in select * from student_discounts x
             where x.student_id = s.id and x.is_active
               and (x.academic_year_id is null or x.academic_year_id = v_year)
               and (x.valid_from is null or x.valid_from <= v_month_end)
               and (x.valid_to is null or x.valid_to >= coalesce(v_month, private.today()))
             order by x.created_at loop
      select coalesce(sum(amount), 0) into v_elig from _charges
        where d.fee_category_id is null or fee_category_id = d.fee_category_id;
      v_amt := case d.calc when 'percent' then round(v_elig * d.value / 100, 2) else least(d.value, v_elig) end;
      v_amt := least(v_amt, v_sub - v_disc);
      if v_amt > 0 then
        insert into fee_invoice_items (school_id, campus_id, invoice_id, kind, fee_category_id, description, amount)
        values (v_school, p_campus, v_inv, 'discount', d.fee_category_id,
                initcap(replace(d.kind, '_', ' ')) || ' discount' || case d.calc when 'percent' then ' (' || d.value::numeric(5,1) || '%)' else '' end,
                v_amt);
        v_disc := v_disc + v_amt;
      end if;
    end loop;

    -- automatic sibling discount: every enrolled child except the eldest
    if v_sib > 0 and s.family_id is not null and p_type = 'monthly' then
      select count(*) into v_rank from students o
        where o.family_id = s.family_id and o.status = 'active' and o.id <> s.id
          and (coalesce(o.dob, date '9999-12-31'), o.admission_date, o.student_code)
              < (select coalesce(x.dob, date '9999-12-31'), x.admission_date, x.student_code from students x where x.id = s.id);
      if v_rank > 0 then
        select coalesce(sum(amount), 0) into v_elig from _charges where kind = 'monthly';
        v_amt := least(round(v_elig * v_sib / 100, 2), v_sub - v_disc);
        if v_amt > 0 then
          insert into fee_invoice_items (school_id, campus_id, invoice_id, kind, description, amount)
          values (v_school, p_campus, v_inv, 'discount', 'Sibling discount (' || v_sib::numeric(5,1) || '%)', v_amt);
        end if;
      end if;
    end if;

    perform private.refresh_invoice(v_inv);
    perform private.apply_credits(s.id);
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped_existing', v_skipped, 'no_charges', v_nocharge);
end $$;

create or replace function public.generate_invoices(
  p_campus uuid, p_month date, p_due date,
  p_class uuid default null, p_student uuid default null,
  p_type text default 'monthly', p_category_ids uuid[] default null, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  perform private.require_perm('fees.create', p_campus);
  r := private.generate_invoices_core(p_campus, p_month, p_due, p_class, p_student, p_type, p_category_ids, p_label);
  perform public.log_audit('generate_invoices', 'fee_invoices', null, null,
    r || jsonb_build_object('month', p_month, 'label', p_label, 'class', p_class, 'type', p_type), p_campus);
  return r;
end $$;

-- ───────────── payments ─────────────
create or replace function private.record_payment(
  p_campus uuid, p_student uuid, p_family uuid, p_amount numeric, p_method text,
  p_reference text, p_bank text, p_invoice_ids uuid[], p_notes text, p_account uuid,
  p_gateway text default null, p_gateway_txn text default null, p_payer text default null,
  p_check_access boolean default true)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid; v_pay uuid; v_receipt text; v_acct uuid; v_remaining numeric; v_take numeric;
  i record; v_alloc numeric := 0; v_students uuid[]; v_n int := 0;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if p_amount > 100000000 then raise exception 'amount_too_large'; end if;
  if p_student is null and p_family is null then raise exception 'student_or_family_required'; end if;
  select school_id into v_school from campuses where id = p_campus;

  if exists (select 1 from cash_closings where campus_id = p_campus and closing_date = private.today()) then
    raise exception 'day_closed: the cash register for today is already closed';
  end if;

  if p_student is not null then
    if not exists (select 1 from students where id = p_student and school_id = v_school) then raise exception 'student_not_found'; end if;
    v_students := array[p_student];
  else
    select array_agg(id) into v_students from students where family_id = p_family and school_id = v_school;
    if v_students is null then raise exception 'family_not_found'; end if;
  end if;

  v_acct := p_account;
  if v_acct is null then
    select id into v_acct from accounts
      where school_id = v_school and is_active and p_method = any (methods) and (campus_id = p_campus or campus_id is null)
      order by campus_id nulls last, created_at limit 1;
  end if;
  if v_acct is null then raise exception 'no_account_for_method: %', p_method; end if;

  v_receipt := private.next_number('receipt', v_school);
  insert into payments (school_id, campus_id, receipt_no, student_id, family_id, payer_name, amount, method,
                        reference_no, bank_name, account_id, notes, gateway, gateway_txn_id, received_by)
  values (v_school, p_campus, v_receipt, p_student, case when p_student is null then p_family end, p_payer, p_amount,
          p_method, p_reference, p_bank, v_acct, p_notes, p_gateway, p_gateway_txn, auth.uid())
  returning id into v_pay;

  v_remaining := p_amount;
  for i in
    select fi.id, fi.campus_id, fi.balance, fi.student_id from fee_invoices fi
    where fi.student_id = any (v_students) and fi.status in ('unpaid','partial') and fi.balance > 0
      and (p_invoice_ids is null or fi.id = any (p_invoice_ids))
      and (not p_check_access or private.can_access_campus(fi.campus_id))
    order by fi.due_date, fi.fee_month nulls last, fi.created_at
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, i.balance);
    insert into payment_allocations (school_id, campus_id, payment_id, invoice_id, amount)
    values (v_school, i.campus_id, v_pay, i.id, v_take);
    perform private.refresh_invoice(i.id);
    v_remaining := v_remaining - v_take; v_alloc := v_alloc + v_take; v_n := v_n + 1;
  end loop;

  update payments set allocated_amount = v_alloc where id = v_pay;
  insert into transactions (school_id, campus_id, account_id, direction, amount, source_type, source_id, description, txn_date)
  values (v_school, p_campus, v_acct, 'in', p_amount, 'payment', v_pay, 'Fee receipt ' || v_receipt, private.today());

  if p_student is not null then
    perform private.queue_guardian_notifications(p_student, 'fee_receipt',
      jsonb_build_object('amount', to_char(p_amount, 'FM999,999,990'), 'receipt_no', v_receipt), p_campus);
  end if;
  return jsonb_build_object('payment_id', v_pay, 'receipt_no', v_receipt, 'allocated', v_alloc,
                            'advance', p_amount - v_alloc, 'invoices_paid_against', v_n);
end $$;

create or replace function public.collect_payment(
  p_campus uuid, p_student uuid, p_family uuid, p_amount numeric, p_method text,
  p_reference text default null, p_bank text default null, p_invoice_ids uuid[] default null,
  p_notes text default null, p_account uuid default null, p_payer text default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  perform private.require_perm('payments.create', p_campus);
  if p_method not in ('cash','bank','jazzcash','easypaisa','card','online_transfer','other') then
    raise exception 'invalid_method';
  end if;
  if p_method <> 'cash' and coalesce(trim(p_reference), '') = '' then
    raise exception 'reference_required: non-cash payments need a reference number';
  end if;
  return private.record_payment(p_campus, p_student, p_family, p_amount, p_method, p_reference, p_bank,
                                p_invoice_ids, p_notes, p_account, null, null, p_payer, true);
end $$;

-- Called only by the server after a gateway callback has been signature-verified
-- and the amount compared against our own intent. Idempotent.
create or replace function public.complete_online_payment(
  p_reference text, p_gateway text, p_gateway_txn text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_int payment_intents; v_res jsonb;
begin
  select * into v_int from payment_intents where reference = p_reference for update;
  if not found then raise exception 'intent_not_found'; end if;
  if v_int.status = 'paid' then
    return jsonb_build_object('already_paid', true, 'payment_id', v_int.payment_id);
  end if;
  if v_int.gateway <> p_gateway then raise exception 'gateway_mismatch'; end if;
  if v_int.amount <> p_amount then raise exception 'amount_mismatch: expected %, got %', v_int.amount, p_amount; end if;
  if v_int.expires_at < now() and v_int.status = 'created' then
    update payment_intents set status = 'expired' where id = v_int.id; raise exception 'intent_expired';
  end if;
  v_res := private.record_payment(v_int.campus_id, v_int.student_id, v_int.family_id, v_int.amount,
             case p_gateway when 'jazzcash' then 'jazzcash' when 'easypaisa' then 'easypaisa' else 'card' end,
             p_gateway_txn, null, null, 'Online payment', null, p_gateway, p_gateway_txn, null, false);
  update payment_intents set status = 'paid', payment_id = (v_res ->> 'payment_id')::uuid where id = v_int.id;
  return v_res;
end $$;

create or replace function public.refund_payment(p_payment uuid, p_amount numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  p payments; v_credit numeric; v_from_credit numeric; v_rest numeric; a record; v_cut numeric; v_acct uuid;
begin
  select * into p from payments where id = p_payment for update;
  if not found then raise exception 'payment_not_found'; end if;
  perform private.require_perm('payments.approve', p.campus_id);
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  if p_amount > p.amount - p.refunded_amount then raise exception 'refund_exceeds_payment'; end if;

  v_credit := p.amount - p.allocated_amount - p.refunded_amount;
  v_from_credit := least(v_credit, p_amount);
  v_rest := p_amount - v_from_credit;

  for a in select pa.id, pa.invoice_id, pa.amount from payment_allocations pa
           where pa.payment_id = p.id order by pa.created_at desc, pa.id for update loop
    exit when v_rest <= 0;
    v_cut := least(a.amount, v_rest);
    if v_cut = a.amount then delete from payment_allocations where id = a.id;
    else update payment_allocations set amount = amount - v_cut where id = a.id; end if;
    perform private.refresh_invoice(a.invoice_id);
    v_rest := v_rest - v_cut;
    update payments set allocated_amount = allocated_amount - v_cut where id = p.id;
  end loop;

  update payments set refunded_amount = refunded_amount + p_amount where id = p.id;
  insert into refunds (school_id, campus_id, payment_id, amount, reason, method)
  values (p.school_id, p.campus_id, p.id, p_amount, trim(p_reason), p.method);
  v_acct := p.account_id;
  if v_acct is not null then
    insert into transactions (school_id, campus_id, account_id, direction, amount, source_type, source_id, description, txn_date)
    values (p.school_id, p.campus_id, v_acct, 'out', p_amount, 'refund', p.id, 'Refund of ' || p.receipt_no || ': ' || trim(p_reason), private.today());
  end if;
  return jsonb_build_object('refunded', p_amount, 'from_advance', v_from_credit, 'reversed_allocations', p_amount - v_from_credit);
end $$;

-- ───────────── invoice adjustments ─────────────
create or replace function public.adjust_invoice(p_invoice uuid, p_kind text, p_amount numeric, p_description text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare i fee_invoices;
begin
  select * into i from fee_invoices where id = p_invoice for update;
  if not found then raise exception 'invoice_not_found'; end if;
  perform private.require_perm('fees.approve', i.campus_id);
  if i.status = 'cancelled' then raise exception 'invoice_cancelled'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  if p_kind not in ('discount','fine','charge','waive_fines') then raise exception 'invalid_kind'; end if;

  if p_kind = 'waive_fines' then
    delete from fee_invoice_items where invoice_id = i.id and kind = 'fine';
    update fee_invoices set fine_waived = true where id = i.id;
  else
    if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
    if p_kind = 'discount' and p_amount > i.subtotal - i.discount_total then raise exception 'discount_exceeds_charges'; end if;
    if p_kind = 'discount' and i.subtotal - i.discount_total - p_amount + i.fine_total < i.paid_amount then
      raise exception 'discount_exceeds_unpaid_balance: refund the excess payment first';
    end if;
    insert into fee_invoice_items (school_id, campus_id, invoice_id, kind, description, amount)
    values (i.school_id, i.campus_id, i.id, p_kind, coalesce(nullif(trim(p_description), ''), initcap(p_kind)), p_amount);
  end if;
  perform private.refresh_invoice(i.id);
  perform public.log_audit('adjust_invoice', 'fee_invoices', i.id::text, null,
    jsonb_build_object('kind', p_kind, 'amount', p_amount, 'reason', trim(p_reason)), i.campus_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cancel_invoice(p_invoice uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, private as $$
declare i fee_invoices;
begin
  select * into i from fee_invoices where id = p_invoice for update;
  if not found then raise exception 'invoice_not_found'; end if;
  perform private.require_perm('fees.approve', i.campus_id);
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  if i.paid_amount > 0 then raise exception 'invoice_has_payments: refund the payment first'; end if;
  update fee_invoices set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
  where id = i.id;
end $$;

-- ───────────── late fines ─────────────
create or replace function public.apply_late_fines(p_campus uuid, p_as_of date default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid; v_cfg jsonb; v_type text; v_amt numeric; v_grace int; v_max numeric;
  v_today date := coalesce(p_as_of, private.today()); i record; v_fine numeric; v_cur numeric; v_n int := 0;
begin
  perform private.require_perm('fees.create', p_campus);
  select school_id into v_school from campuses where id = p_campus;
  v_cfg := private.get_setting(v_school, 'fees') -> 'late_fine';
  v_type := coalesce(v_cfg ->> 'type', 'none');
  v_amt := coalesce((v_cfg ->> 'amount')::numeric, 0);
  v_grace := coalesce((v_cfg ->> 'grace_days')::int, 0);
  v_max := (v_cfg ->> 'max')::numeric;
  if v_type = 'none' or v_amt <= 0 then return jsonb_build_object('fined', 0); end if;

  for i in select id, due_date, fine_total from fee_invoices
           where campus_id = p_campus and status in ('unpaid','partial') and not fine_waived
             and due_date + v_grace < v_today for update loop
    v_fine := case v_type when 'flat' then v_amt else v_amt * (v_today - i.due_date - v_grace) end;
    if v_max is not null then v_fine := least(v_fine, v_max); end if;
    select coalesce(sum(amount), 0) into v_cur from fee_invoice_items
      where invoice_id = i.id and kind = 'fine' and description = 'Late payment fine';
    if v_fine > v_cur then
      delete from fee_invoice_items where invoice_id = i.id and kind = 'fine' and description = 'Late payment fine';
      insert into fee_invoice_items (school_id, campus_id, invoice_id, kind, description, amount)
      values (v_school, p_campus, i.id, 'fine', 'Late payment fine', v_fine);
      perform private.refresh_invoice(i.id);
      v_n := v_n + 1;
    end if;
  end loop;
  perform public.log_audit('apply_late_fines', 'fee_invoices', null, null, jsonb_build_object('fined', v_n, 'as_of', v_today), p_campus);
  return jsonb_build_object('fined', v_n);
end $$;

-- ───────────── daily cash closing ─────────────
create or replace function public.close_day(p_campus uuid, p_date date, p_counted numeric, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare v_school uuid; v_exp numeric; v_by jsonb; v_id uuid; v_no text;
begin
  perform private.require_perm('payments.approve', p_campus);
  if p_date > private.today() then raise exception 'cannot_close_future_date'; end if;
  if p_counted is null or p_counted < 0 then raise exception 'invalid_amount'; end if;
  if exists (select 1 from cash_closings where campus_id = p_campus and closing_date = p_date) then
    raise exception 'already_closed';
  end if;
  select school_id into v_school from campuses where id = p_campus;

  select coalesce(jsonb_object_agg(method, total), '{}') into v_by from (
    select method, sum(amount - refunded_amount) total from payments
    where campus_id = p_campus and status = 'completed' and (paid_at at time zone 'Asia/Karachi')::date = p_date
    group by method) x;
  v_exp := coalesce((v_by ->> 'cash')::numeric, 0);
  v_no := private.next_number('closing', v_school);
  insert into cash_closings (school_id, campus_id, closing_date, closing_no, expected_cash, counted_cash, totals_by_method, notes)
  values (v_school, p_campus, p_date, v_no, v_exp, p_counted, v_by, nullif(trim(p_notes), ''))
  returning id into v_id;
  update payments set closing_id = v_id
   where campus_id = p_campus and status = 'completed' and (paid_at at time zone 'Asia/Karachi')::date = p_date;
  return jsonb_build_object('closing_id', v_id, 'closing_no', v_no, 'expected_cash', v_exp, 'difference', p_counted - v_exp);
end $$;

-- ───────────── defaulters (security invoker: RLS decides what is visible) ─────────────
create or replace function public.fee_defaulters(
  p_campus uuid default null, p_class uuid default null, p_section uuid default null,
  p_from date default null, p_to date default null, p_invoice_type text default null, p_family uuid default null,
  p_as_of date default null)
returns table (student_id uuid, student_code text, student_name text, class_name text, section_name text,
               family_id uuid, family_name text, guardian_name text, guardian_phone text, guardian_whatsapp text,
               outstanding numeric, overdue_invoices int, max_days_overdue int, last_payment_date date)
language sql stable security invoker set search_path = public, private as $$
  select s.id, s.student_code, s.full_name, c.name, sec.name, s.family_id, f.family_name,
         g.full_name, g.phone, g.whatsapp,
         sum(i.balance), count(*)::int, max(coalesce(p_as_of, private.today()) - i.due_date)::int,
         (select max((p.paid_at at time zone 'Asia/Karachi')::date) from payments p
           where p.student_id = s.id or (p.family_id is not null and p.family_id = s.family_id))
  from fee_invoices i
  join students s on s.id = i.student_id
  left join classes c on c.id = s.class_id
  left join sections sec on sec.id = s.section_id
  left join families f on f.id = s.family_id
  left join lateral (
    select gg.full_name, gg.phone, gg.whatsapp from student_guardians sg join guardians gg on gg.id = sg.guardian_id
    where sg.student_id = s.id order by sg.is_primary desc, sg.pays_fees desc limit 1) g on true
  where i.status in ('unpaid','partial') and i.balance > 0 and i.due_date < coalesce(p_as_of, private.today())
    and (p_campus is null or i.campus_id = p_campus)
    and (p_class is null or s.class_id = p_class)
    and (p_section is null or s.section_id = p_section)
    and (p_from is null or i.fee_month >= p_from)
    and (p_to is null or i.fee_month <= p_to)
    and (p_invoice_type is null or i.invoice_type = p_invoice_type)
    and (p_family is null or s.family_id = p_family)
  group by s.id, c.name, sec.name, f.family_name, g.full_name, g.phone, g.whatsapp
  order by sum(i.balance) desc
$$;

-- Fee reminders go through the outbox like every other message.
create or replace function public.queue_fee_reminders(p_student_ids uuid[]) returns int
language plpgsql security definer set search_path = public, private as $$
declare s record; v_total int := 0; v_out numeric; v_due date; v_label text; v_campus uuid;
begin
  for s in select id, campus_id from students where id = any (p_student_ids) loop
    perform private.require_perm('communication.create', s.campus_id);
    select coalesce(sum(balance), 0), min(due_date), string_agg(period_label, ', ' order by due_date)
      into v_out, v_due, v_label from fee_invoices
      where student_id = s.id and status in ('unpaid','partial') and balance > 0;
    if v_out > 0 then
      v_total := v_total + private.queue_guardian_notifications(s.id, 'fee_reminder',
        jsonb_build_object('amount', to_char(v_out, 'FM999,999,990'), 'due_date', to_char(v_due, 'DD Mon YYYY'), 'month', v_label), s.campus_id);
    end if;
  end loop;
  return v_total;
end $$;
