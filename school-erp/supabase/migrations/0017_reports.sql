-- 0017 · Report functions. All SECURITY INVOKER: row-level security decides what each user's report contains.
set search_path = public, extensions;

create or replace function public.attendance_summary(p_campus uuid, p_from date, p_to date, p_class uuid default null, p_section uuid default null)
returns table (student_id uuid, student_code text, student_name text, class_name text, section_name text,
               present int, absent int, late int, leave int, half_day int, marked_days int, percentage numeric)
language sql stable security invoker set search_path = public, private as $$
  select s.id, s.student_code, s.full_name, c.name, sec.name,
         count(*) filter (where a.status = 'present')::int, count(*) filter (where a.status = 'absent')::int,
         count(*) filter (where a.status = 'late')::int, count(*) filter (where a.status = 'leave')::int,
         count(*) filter (where a.status = 'half_day')::int, count(*)::int,
         round(100.0 * (count(*) filter (where a.status in ('present','late')) + 0.5 * count(*) filter (where a.status = 'half_day'))
               / nullif(count(*) filter (where a.status <> 'leave'), 0), 1)
  from student_attendance a
  join students s on s.id = a.student_id
  left join classes c on c.id = s.class_id
  left join sections sec on sec.id = s.section_id
  where a.date between p_from and p_to
    and (p_campus is null or a.campus_id = p_campus)
    and (p_class is null or s.class_id = p_class)
    and (p_section is null or s.section_id = p_section)
  group by s.id, c.name, c.level, sec.name
  order by c.level, sec.name, s.full_name
$$;

create or replace function public.collection_report(p_campus uuid, p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = public, private as $$
  with p as (
    select (paid_at at time zone 'Asia/Karachi')::date d, method, amount - refunded_amount net, campus_id
    from payments where status = 'completed' and (paid_at at time zone 'Asia/Karachi')::date between p_from and p_to and (p_campus is null or campus_id = p_campus))
  select jsonb_build_object(
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('label', to_char(d, 'DD Mon'), 'date', d, 'value', v) order by d) from (select d, sum(net) v from p group by d) x), '[]'),
    'by_method', coalesce((select jsonb_agg(jsonb_build_object('label', method, 'value', v) order by v desc) from (select method, sum(net) v from p group by method) x), '[]'),
    'total', coalesce((select sum(net) from p), 0), 'count', (select count(*) from p))
$$;

create or replace function public.admission_funnel(p_campus uuid, p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = public, private as $$
  select jsonb_build_object(
    'enquiries', (select count(*) from enquiries where created_at::date between p_from and p_to and (p_campus is null or campus_id = p_campus)),
    'converted_enquiries', (select count(*) from enquiries where status = 'converted' and created_at::date between p_from and p_to and (p_campus is null or campus_id = p_campus)),
    'applications', (select count(*) from admissions where created_at::date between p_from and p_to and (p_campus is null or campus_id = p_campus)),
    'by_stage', coalesce((select jsonb_agg(jsonb_build_object('label', stage, 'value', n)) from (select stage, count(*) n from admissions where created_at::date between p_from and p_to and (p_campus is null or campus_id = p_campus) group by stage) x), '[]'),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('label', source, 'value', n)) from (select source, count(*) n from enquiries where created_at::date between p_from and p_to and (p_campus is null or campus_id = p_campus) group by source) x), '[]'))
$$;

create or replace function public.campus_comparison(p_from date, p_to date)
returns table (campus_id uuid, campus_name text, students int, staff int, collected numeric, outstanding numeric, attendance_pct numeric, expenses numeric)
language sql stable security invoker set search_path = public, private as $$
  select c.id, c.name,
    (select count(*)::int from students s where s.campus_id = c.id and s.status = 'active'),
    (select count(*)::int from staff st where st.campus_id = c.id and st.status = 'active'),
    coalesce((select sum(p.amount - p.refunded_amount) from payments p where p.campus_id = c.id and p.status = 'completed' and (p.paid_at at time zone 'Asia/Karachi')::date between p_from and p_to), 0),
    coalesce((select sum(i.balance) from fee_invoices i where i.campus_id = c.id and i.status in ('unpaid','partial')), 0),
    (select round(100.0 * count(*) filter (where a.status in ('present','late','half_day')) / nullif(count(*) filter (where a.status <> 'leave'), 0), 1) from student_attendance a where a.campus_id = c.id and a.date between p_from and p_to),
    coalesce((select sum(e.amount) from expenses e where e.campus_id = c.id and e.status = 'paid' and e.paid_on between p_from and p_to), 0)
  from campuses c where c.is_active and private.can_access_campus(c.id) order by c.is_main desc, c.name
$$;

create or replace function public.daily_activity(p_campus uuid, p_date date) returns jsonb
language sql stable security invoker set search_path = public, private as $$
  select jsonb_build_object(
    'payments', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount - refunded_amount), 0)) from payments where status = 'completed' and (paid_at at time zone 'Asia/Karachi')::date = p_date and (p_campus is null or campus_id = p_campus)),
    'new_students', (select count(*) from students where admission_date = p_date and (p_campus is null or campus_id = p_campus)),
    'applications', (select count(*) from admissions where created_at::date = p_date and (p_campus is null or campus_id = p_campus)),
    'enquiries', (select count(*) from enquiries where created_at::date = p_date and (p_campus is null or campus_id = p_campus)),
    'attendance', (select jsonb_build_object('marked', count(*), 'absent', count(*) filter (where status = 'absent'), 'late', count(*) filter (where status = 'late')) from student_attendance where date = p_date and (p_campus is null or campus_id = p_campus)),
    'staff_absent', (select count(*) from staff_attendance where date = p_date and status = 'absent' and (p_campus is null or campus_id = p_campus)),
    'expenses', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount), 0)) from expenses where paid_on = p_date and (p_campus is null or campus_id = p_campus)),
    'messages', (select jsonb_build_object('queued', count(*) filter (where status = 'queued'), 'sent', count(*) filter (where status in ('sent','delivered','read')), 'failed', count(*) filter (where status = 'failed')) from notification_logs where created_at::date = p_date and (p_campus is null or campus_id = p_campus)))
$$;

create or replace function public.exam_summary(p_exam uuid)
returns table (class_name text, appeared int, passed int, failed int, incomplete int, avg_percentage numeric, highest numeric, lowest numeric)
language sql stable security invoker set search_path = public, private as $$
  select c.name, count(*)::int, count(*) filter (where r.result_status = 'pass')::int, count(*) filter (where r.result_status in ('fail','absent'))::int,
         count(*) filter (where r.result_status = 'incomplete')::int, round(avg(r.percentage), 1), max(r.percentage), min(r.percentage)
  from result_cards r join classes c on c.id = r.class_id where r.exam_id = p_exam group by c.name, c.level order by c.level
$$;

-- Students above an absence threshold in a period (used by the absentee report and the AI assistant).
create or replace function public.chronic_absentees(p_campus uuid, p_from date, p_to date, p_min int default 5)
returns table (student_id uuid, student_code text, student_name text, class_name text, section_name text, absent_days int)
language sql stable security invoker set search_path = public, private as $$
  select s.id, s.student_code, s.full_name, c.name, sec.name, count(*)::int
  from student_attendance a join students s on s.id = a.student_id left join classes c on c.id = s.class_id left join sections sec on sec.id = s.section_id
  where a.status = 'absent' and a.date between p_from and p_to and (p_campus is null or a.campus_id = p_campus)
  group by s.id, c.name, c.level, sec.name having count(*) >= p_min order by count(*) desc
$$;
