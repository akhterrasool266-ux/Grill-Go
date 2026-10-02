-- 0020 · Usage metering + centralised entitlement check (used by the message dispatcher and AI assistant).
set search_path = public, extensions;

create or replace function public.bump_usage(p_school uuid, p_metric text, p_n int default 1) returns void
language sql security definer set search_path = public as $$
  insert into usage_counters (school_id, metric, period, value)
  values (p_school, p_metric, date_trunc('month', now() at time zone 'Asia/Karachi')::date, p_n)
  on conflict (school_id, metric, period) do update set value = usage_counters.value + excluded.value
$$;

-- true = allowed. Unmetered (no subscription / no limit for the metric) is always allowed.
create or replace function public.within_limit(p_school uuid, p_metric text, p_needed int default 1) returns boolean
language sql stable security definer set search_path = public, private as $$
  select coalesce(private.plan_limit(p_school, p_metric) is null
     or coalesce((select value from usage_counters where school_id = p_school and metric = p_metric
                  and period = date_trunc('month', now() at time zone 'Asia/Karachi')::date), 0) + p_needed <= private.plan_limit(p_school, p_metric), true)
$$;

-- For the signed-in user's own school (the AI assistant calls this before spending tokens).
create or replace function public.my_within_limit(p_metric text) returns boolean
language sql stable security definer set search_path = public, private as $$ select public.within_limit(private.current_school_id(), p_metric, 1) $$;
create or replace function public.my_bump_usage(p_metric text) returns void
language sql security definer set search_path = public, private as $$ select public.bump_usage(private.current_school_id(), p_metric, 1) $$;

revoke execute on function public.bump_usage(uuid, text, int), public.within_limit(uuid, text, int) from public, anon, authenticated;
grant execute on function public.bump_usage(uuid, text, int), public.within_limit(uuid, text, int) to service_role;

-- Free-text message to the guardians of a class / section / campus (staff-composed, e.g. "school closed tomorrow").
create or replace function public.queue_custom_message(p_campus uuid, p_class uuid, p_section uuid, p_title text, p_body text) returns int
language plpgsql security definer set search_path = public, private as $$
declare s record; g record; v_cfg jsonb; v_channel text; v_lang text; v_addr text; v_n int := 0; v_school uuid;
begin
  perform private.require_perm('communication.create', p_campus);
  if coalesce(trim(p_body), '') = '' then raise exception 'message_required'; end if;
  if length(p_body) > 600 then raise exception 'message_too_long'; end if;
  select school_id into v_school from campuses where id = p_campus;
  v_cfg := private.get_setting(v_school, 'notifications');
  v_channel := coalesce(v_cfg ->> 'guardian_channel', 'whatsapp'); v_lang := coalesce(v_cfg ->> 'language', 'en');
  for s in select id from students where campus_id = p_campus and status = 'active' and (p_class is null or class_id = p_class) and (p_section is null or section_id = p_section) loop
    for g in select gu.id, gu.phone, gu.whatsapp, gu.email from student_guardians sg join guardians gu on gu.id = sg.guardian_id where sg.student_id = s.id and (sg.is_primary or sg.pays_fees) loop
      v_addr := case v_channel when 'whatsapp' then coalesce(g.whatsapp, g.phone) when 'sms' then g.phone else g.email end;
      if v_addr is not null and trim(v_addr) <> '' then
        insert into notification_logs (school_id, campus_id, channel, to_address, template_key, language, subject, body, meta, student_id, guardian_id)
        values (v_school, p_campus, v_channel, trim(v_addr), 'announcement', v_lang, nullif(trim(p_title), ''), trim(p_body), jsonb_build_object('title', coalesce(p_title, ''), 'message', p_body), s.id, g.id);
        v_n := v_n + 1;
      end if;
    end loop;
  end loop;
  return v_n;
end $$;
