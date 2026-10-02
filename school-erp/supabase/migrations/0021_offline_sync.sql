-- 0021 · Offline sync for attendance and marks.
-- A phone that was offline queues work and replays it later. The server must therefore be
--   · idempotent  (the same queued operation sent twice changes nothing the second time),
--   · non-destructive (it never silently overwrites something someone else entered meanwhile),
--   · bounded (attendance can only be back-filled a few days; locked/published marks stay locked).
set search_path = public, extensions;

create table sync_receipts (
  op_id uuid primary key,
  user_id uuid not null default auth.uid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  kind text not null check (kind in ('attendance','marks')),
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index sync_receipts_created on sync_receipts(created_at);
alter table sync_receipts enable row level security;   -- no policies: only the functions below touch it

-- ───────── attendance ─────────
-- Only fills in what is missing. If a different status is already stored (someone marked it online meanwhile),
-- the stored value wins and the row is reported back as a conflict for the teacher to review.
create or replace function public.sync_attendance(p_op uuid, p_section uuid, p_date date, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_campus uuid; v_school uuid; v_year uuid; r jsonb; v_sid uuid; v_status text; ex student_attendance;
  v_today date := private.today(); v_saved int := 0; v_same int := 0; v_alerts int := 0;
  v_conf jsonb := '[]'; v_old sync_receipts; v_res jsonb;
begin
  select * into v_old from sync_receipts where op_id = p_op;
  if found then
    if v_old.user_id <> auth.uid() then raise exception 'permission_denied: operation belongs to another user' using errcode = '42501'; end if;
    return v_old.result || jsonb_build_object('replayed', true);
  end if;

  select campus_id, school_id into v_campus, v_school from sections where id = p_section;
  if v_campus is null then raise exception 'section_not_found'; end if;
  perform private.require_perm('attendance.create', v_campus);
  if not private.can_access_section(p_section) then raise exception 'permission_denied: section' using errcode = '42501'; end if;
  if p_date > v_today then raise exception 'future_date: attendance cannot be marked for a future date'; end if;
  if p_date < v_today - 3 then raise exception 'offline_window_exceeded: offline attendance can be sent up to 3 days late'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'no_rows'; end if;
  v_year := private.current_year();

  for r in select * from jsonb_array_elements(p_rows) loop
    v_sid := (r ->> 'student_id')::uuid; v_status := r ->> 'status';
    if v_status not in ('present','absent','late','leave','half_day') then raise exception 'invalid_status: %', v_status; end if;
    if not exists (select 1 from students where id = v_sid and section_id = p_section and status = 'active') then
      raise exception 'student_not_in_section: %', v_sid;
    end if;
    select * into ex from student_attendance where student_id = v_sid and date = p_date;
    if not found then
      insert into student_attendance (school_id, campus_id, student_id, section_id, academic_year_id, date, status, method, remarks)
      values (v_school, v_campus, v_sid, p_section, v_year, p_date, v_status, 'manual', nullif(r ->> 'remarks', ''));
      v_saved := v_saved + 1;
      if v_status = 'absent' and p_date >= v_today - 1 then
        perform private.queue_guardian_notifications(v_sid, 'absence_alert', jsonb_build_object('date', to_char(p_date, 'DD Mon YYYY')), v_campus);
        v_alerts := v_alerts + 1;
      end if;
    elsif ex.status = v_status then v_same := v_same + 1;
    else v_conf := v_conf || jsonb_build_object('student_id', v_sid, 'yours', v_status, 'server', ex.status);
    end if;
  end loop;

  v_res := jsonb_build_object('saved', v_saved, 'unchanged', v_same, 'conflicts', v_conf, 'absence_alerts_queued', v_alerts);
  insert into sync_receipts (op_id, school_id, kind, result) values (p_op, v_school, 'attendance', v_res);
  perform public.log_audit('offline_sync', 'student_attendance', p_op::text, null, jsonb_build_object('section', p_section, 'date', p_date) || v_res, v_campus);
  return v_res;
end $$;

-- ───────── marks ─────────
-- Compare-and-set: each row carries `base`, the value the phone saw when it downloaded the sheet.
-- The server only overwrites if the stored value is still that base. Otherwise it keeps the stored value and reports a conflict.
create or replace function public.sync_marks(p_op uuid, p_exam_subject uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  es record; r jsonb; st record; ex marks; v_sid uuid; v_marks numeric; v_abs boolean; v_has_base boolean; v_bm numeric; v_ba boolean;
  v_saved int := 0; v_same int := 0; v_conf jsonb := '[]'; v_old sync_receipts; v_res jsonb;
begin
  select * into v_old from sync_receipts where op_id = p_op;
  if found then
    if v_old.user_id <> auth.uid() then raise exception 'permission_denied: operation belongs to another user' using errcode = '42501'; end if;
    return v_old.result || jsonb_build_object('replayed', true);
  end if;

  select es0.id, es0.campus_id, es0.class_id, es0.school_id, es0.exam_id, e.status as exam_status into es
    from exam_subjects es0 join exams e on e.id = es0.exam_id where es0.id = p_exam_subject;
  if not found then raise exception 'exam_subject_not_found'; end if;
  perform private.require_perm('marks.create', es.campus_id);
  if es.exam_status = 'draft' then raise exception 'exam_not_scheduled'; end if;
  if es.exam_status = 'published' or (es.exam_status = 'locked' and not private.has_perm('marks.approve')) then
    raise exception 'marks_locked: the exam was locked or published while you were offline';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'no_rows'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_sid := (r ->> 'student_id')::uuid;
    select id, section_id into st from students where id = v_sid and class_id = es.class_id and status = 'active' and campus_id = es.campus_id;
    if not found then raise exception 'student_not_in_class: %', v_sid; end if;
    if not private.can_access_section(st.section_id) then raise exception 'permission_denied: section' using errcode = '42501'; end if;
    v_abs := coalesce((r ->> 'absent')::boolean, false);
    v_marks := case when v_abs or coalesce(r ->> 'marks', '') = '' then null else (r ->> 'marks')::numeric end;
    v_has_base := jsonb_typeof(r -> 'base') = 'object';
    v_bm := case when v_has_base then nullif(r -> 'base' ->> 'marks', '')::numeric end;
    v_ba := case when v_has_base then coalesce((r -> 'base' ->> 'absent')::boolean, false) end;

    select * into ex from marks where exam_subject_id = p_exam_subject and student_id = v_sid;
    if not found then
      if v_has_base and (v_bm is not null or v_ba) then   -- the row existed when downloaded, now it is gone
        v_conf := v_conf || jsonb_build_object('student_id', v_sid, 'yours', v_marks, 'yours_absent', v_abs, 'server', null);
      else
        insert into marks (school_id, campus_id, exam_subject_id, student_id, section_id, marks_obtained, is_absent, remarks)
        values (es.school_id, es.campus_id, p_exam_subject, v_sid, st.section_id, v_marks, v_abs, nullif(r ->> 'remarks', ''));
        v_saved := v_saved + 1;
      end if;
    elsif ex.marks_obtained is not distinct from v_marks and ex.is_absent = v_abs then
      v_same := v_same + 1;
    elsif v_has_base and ex.marks_obtained is not distinct from v_bm and ex.is_absent = v_ba then
      update marks set marks_obtained = v_marks, is_absent = v_abs, remarks = nullif(r ->> 'remarks', ''), entered_by = auth.uid(), section_id = st.section_id where id = ex.id;
      v_saved := v_saved + 1;
    else
      v_conf := v_conf || jsonb_build_object('student_id', v_sid, 'yours', v_marks, 'yours_absent', v_abs, 'server', ex.marks_obtained, 'server_absent', ex.is_absent);
    end if;
  end loop;
  if es.exam_status = 'scheduled' then update exams set status = 'marks_entry' where id = es.exam_id; end if;

  v_res := jsonb_build_object('saved', v_saved, 'unchanged', v_same, 'conflicts', v_conf);
  insert into sync_receipts (op_id, school_id, kind, result) values (p_op, es.school_id, 'marks', v_res);
  perform public.log_audit('offline_sync', 'marks', p_op::text, null, jsonb_build_object('exam_subject', p_exam_subject) || v_res, es.campus_id);
  return v_res;
end $$;
