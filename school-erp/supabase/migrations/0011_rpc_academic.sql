-- 0011 · Attendance, timetable, admissions, exams/results, promotion.
set search_path = public, extensions;

-- ═════════════ attendance ═════════════
create or replace function public.mark_attendance(
  p_section uuid, p_date date, p_rows jsonb, p_method text default 'manual', p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_campus uuid; v_school uuid; v_year uuid; r jsonb; v_sid uuid; v_status text; ex student_attendance;
  v_saved int := 0; v_corrected int := 0; v_absent int := 0; v_today date := private.today();
  v_can_edit boolean; v_reason text := nullif(trim(coalesce(p_reason, '')), ''); v_new boolean;
begin
  select campus_id, school_id into v_campus, v_school from sections where id = p_section;
  if v_campus is null then raise exception 'section_not_found'; end if;
  perform private.require_perm('attendance.create', v_campus);
  if not private.can_access_section(p_section) then raise exception 'permission_denied: section' using errcode = '42501'; end if;
  if p_date > v_today then raise exception 'future_date: attendance cannot be marked for a future date'; end if;
  if p_method not in ('manual','qr','biometric','api') then raise exception 'invalid_method'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'no_rows'; end if;
  v_can_edit := private.has_perm('attendance.edit');
  v_year := private.current_year();

  for r in select * from jsonb_array_elements(p_rows) loop
    v_sid := (r ->> 'student_id')::uuid;
    v_status := r ->> 'status';
    if v_status not in ('present','absent','late','leave','half_day') then raise exception 'invalid_status: %', v_status; end if;
    if not exists (select 1 from students where id = v_sid and section_id = p_section and status = 'active') then
      raise exception 'student_not_in_section: %', v_sid;
    end if;

    select * into ex from student_attendance where student_id = v_sid and date = p_date;
    v_new := not found;
    if v_new then
      if p_date < v_today and not (v_can_edit and v_reason is not null) then
        raise exception 'backdated_requires_edit_permission_and_reason';
      end if;
      insert into student_attendance (school_id, campus_id, student_id, section_id, academic_year_id, date, status, method,
                                      check_in_time, remarks, correction_reason)
      values (v_school, v_campus, v_sid, p_section, v_year, p_date, v_status, p_method,
              nullif(r ->> 'check_in_time', '')::time, nullif(r ->> 'remarks', ''), case when p_date < v_today then v_reason end);
      v_saved := v_saved + 1;
    elsif ex.status is distinct from v_status then
      if not (v_can_edit and v_reason is not null) then
        raise exception 'correction_requires_edit_permission_and_reason';
      end if;
      update student_attendance set status = v_status, method = p_method, remarks = nullif(r ->> 'remarks', ''),
             correction_reason = v_reason, marked_by = auth.uid(), section_id = p_section where id = ex.id;
      v_corrected := v_corrected + 1;
    end if;

    if v_status = 'absent' and (v_new or ex.status is distinct from 'absent') and p_date >= v_today - 1 then
      perform private.queue_guardian_notifications(v_sid, 'absence_alert',
        jsonb_build_object('date', to_char(p_date, 'DD Mon YYYY')), v_campus);
      v_absent := v_absent + 1;
    end if;
  end loop;
  return jsonb_build_object('saved', v_saved, 'corrected', v_corrected, 'absence_alerts_queued', v_absent);
end $$;

create or replace function public.mark_attendance_qr(p_code text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  s record; v_cfg jsonb; v_late time; v_status text; v_now timestamp := now() at time zone 'Asia/Karachi';
  v_ex student_attendance;
begin
  perform private.require_perm('attendance.qr');
  select st.id, st.full_name, st.campus_id, st.school_id, st.section_id, c.name as class_name into s
    from students st left join classes c on c.id = st.class_id
    where st.school_id = private.current_school_id() and st.student_code = upper(trim(p_code)) and st.status = 'active';
  if not found then raise exception 'student_not_found'; end if;
  if not private.can_access_campus(s.campus_id) then raise exception 'permission_denied: campus' using errcode = '42501'; end if;

  select * into v_ex from student_attendance where student_id = s.id and date = v_now::date;
  if found then
    return jsonb_build_object('student', s.full_name, 'class', s.class_name, 'status', v_ex.status, 'already_marked', true);
  end if;
  v_cfg := private.get_setting(s.school_id, 'attendance');
  v_late := coalesce((v_cfg ->> 'late_after')::time, time '08:30');
  v_status := case when v_now::time > v_late then 'late' else 'present' end;
  insert into student_attendance (school_id, campus_id, student_id, section_id, academic_year_id, date, status, method, check_in_time)
  values (s.school_id, s.campus_id, s.id, s.section_id, private.current_year(), v_now::date, v_status, 'qr', v_now::time);
  return jsonb_build_object('student', s.full_name, 'class', s.class_name, 'status', v_status, 'already_marked', false);
end $$;

create or replace function public.staff_check_in(p_staff_code text default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  v_staff staff; v_now timestamp := now() at time zone 'Asia/Karachi'; v_grace int; v_status text; ex staff_attendance;
begin
  if p_staff_code is null then
    select * into v_staff from staff where id = private.my_staff_id();
  else
    select * into v_staff from staff where school_id = private.current_school_id() and employee_code = upper(trim(p_staff_code));
    if found then perform private.require_perm('staff_attendance.create', v_staff.campus_id); end if;
  end if;
  if v_staff.id is null then raise exception 'staff_not_found'; end if;
  select * into ex from staff_attendance where staff_id = v_staff.id and date = v_now::date;
  if found and ex.check_in is not null then
    return jsonb_build_object('staff', v_staff.full_name, 'status', ex.status, 'already_checked_in', true);
  end if;
  v_grace := coalesce((private.get_setting(v_staff.school_id, 'attendance') ->> 'staff_grace_minutes')::int, 10);
  v_status := case when v_now::time > v_staff.shift_start + make_interval(mins => v_grace) then 'late' else 'present' end;
  insert into staff_attendance (school_id, campus_id, staff_id, date, status, check_in, method)
  values (v_staff.school_id, v_staff.campus_id, v_staff.id, v_now::date, v_status, v_now::time,
          case when p_staff_code is null then 'self' else 'manual' end)
  on conflict (staff_id, date) do update set check_in = excluded.check_in, status = excluded.status;
  return jsonb_build_object('staff', v_staff.full_name, 'status', v_status, 'already_checked_in', false);
end $$;

create or replace function public.staff_check_out(p_staff_code text default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare v_staff staff; v_now timestamp := now() at time zone 'Asia/Karachi'; ex staff_attendance; v_ot int;
begin
  if p_staff_code is null then
    select * into v_staff from staff where id = private.my_staff_id();
  else
    select * into v_staff from staff where school_id = private.current_school_id() and employee_code = upper(trim(p_staff_code));
    if found then perform private.require_perm('staff_attendance.create', v_staff.campus_id); end if;
  end if;
  if v_staff.id is null then raise exception 'staff_not_found'; end if;
  select * into ex from staff_attendance where staff_id = v_staff.id and date = v_now::date;
  if not found or ex.check_in is null then raise exception 'not_checked_in'; end if;
  v_ot := greatest(0, (extract(epoch from (v_now::time - v_staff.shift_end)) / 60)::int);
  update staff_attendance set check_out = v_now::time, overtime_minutes = case when v_ot >= 30 then v_ot else 0 end where id = ex.id;
  return jsonb_build_object('staff', v_staff.full_name, 'overtime_minutes', case when v_ot >= 30 then v_ot else 0 end);
end $$;

-- ═════════════ timetable ═════════════
create or replace function public.check_timetable_conflicts(
  p_year uuid, p_section uuid, p_day int, p_period uuid, p_staff uuid default null,
  p_room uuid default null, p_exclude uuid default null)
returns table (kind text, message text)
language sql stable security invoker set search_path = public, private as $$
  select 'section', 'This class already has a lesson in this period.'
    from timetable_entries t where t.academic_year_id = p_year and t.section_id = p_section and t.day_of_week = p_day
      and t.period_id = p_period and (p_exclude is null or t.id <> p_exclude)
  union all
  select 'teacher', format('%s already teaches %s %s in this period.', st.full_name, cl.name, sec.name)
    from timetable_entries t join staff st on st.id = t.staff_id join sections sec on sec.id = t.section_id join classes cl on cl.id = sec.class_id
    where p_staff is not null and t.academic_year_id = p_year and t.staff_id = p_staff and t.day_of_week = p_day
      and t.period_id = p_period and (p_exclude is null or t.id <> p_exclude)
  union all
  select 'room', format('Room %s is already used by %s %s in this period.', r.name, cl.name, sec.name)
    from timetable_entries t join rooms r on r.id = t.room_id join sections sec on sec.id = t.section_id join classes cl on cl.id = sec.class_id
    where p_room is not null and t.academic_year_id = p_year and t.room_id = p_room and t.day_of_week = p_day
      and t.period_id = p_period and (p_exclude is null or t.id <> p_exclude)
$$;

-- ═════════════ admissions ═════════════
create or replace function public.advance_admission(p_id uuid, p_stage text, p_notes text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare a admissions; v_ok boolean;
begin
  select * into a from admissions where id = p_id for update;
  if not found then raise exception 'admission_not_found'; end if;
  perform private.require_perm('admissions.edit', a.campus_id);
  if p_stage = 'admitted' then raise exception 'use_admit_applicant'; end if;
  v_ok := case a.stage
    when 'application'           then p_stage in ('document_verification','rejected','withdrawn')
    when 'document_verification' then p_stage in ('application','test_interview','approval','rejected','withdrawn')
    when 'test_interview'        then p_stage in ('document_verification','approval','waitlisted','rejected','withdrawn')
    when 'approval'              then p_stage in ('test_interview','waitlisted','rejected','withdrawn')
    when 'waitlisted'            then p_stage in ('approval','rejected','withdrawn')
    else false end;
  if not v_ok then raise exception 'invalid_transition: % → %', a.stage, p_stage; end if;
  if p_stage in ('test_interview','approval') and not a.documents_verified then
    raise exception 'documents_not_verified';
  end if;
  if p_stage = 'approval' and a.type = 'new' and a.test_date is null and a.interview_date is null and a.stage <> 'waitlisted' then
    raise exception 'test_or_interview_required';
  end if;
  if p_stage in ('rejected','waitlisted') then
    perform private.require_perm('admissions.approve', a.campus_id);
  end if;
  update admissions set stage = p_stage,
    decision_by = case when p_stage in ('rejected','waitlisted') then auth.uid() else decision_by end,
    decision_at = case when p_stage in ('rejected','waitlisted') then now() else decision_at end,
    decision_notes = coalesce(nullif(trim(p_notes), ''), decision_notes)
  where id = p_id;
end $$;

create or replace function public.admit_applicant(p_admission uuid, p_section uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  a admissions; sec record; v_family uuid; v_guardian uuid; v_student uuid; v_code text; v_adm text;
  v_phone text; v_cat uuid[]; v_inv jsonb; v_existing students;
begin
  select * into a from admissions where id = p_admission for update;
  if not found then raise exception 'admission_not_found'; end if;
  perform private.require_perm('admissions.approve', a.campus_id);
  if a.stage <> 'approval' then raise exception 'not_ready: application must be in the approval stage'; end if;
  if a.class_applied_id is null then raise exception 'class_required'; end if;
  select s.id, s.class_id, s.campus_id into sec from sections s where s.id = p_section;
  if not found or sec.class_id <> a.class_applied_id or sec.campus_id <> a.campus_id then
    raise exception 'section_does_not_match_class';
  end if;

  v_phone := regexp_replace(a.phone, '\D', '', 'g');
  -- sibling detection: same guardian phone already in this school → join that family
  select g.family_id, g.id into v_family, v_guardian from guardians g
    where g.school_id = a.school_id and regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') = v_phone and g.family_id is not null
    order by g.created_at limit 1;
  if v_family is null then
    insert into families (school_id, family_code, family_name, address, city, province, primary_phone)
    values (a.school_id, private.next_number('family', a.school_id), coalesce(a.father_name, a.guardian_name) || ' Family',
            a.address, a.city, a.province, a.phone)
    returning id into v_family;
    insert into guardians (school_id, family_id, full_name, relation, cnic, phone, whatsapp, email, address)
    values (a.school_id, v_family, a.guardian_name, case when a.guardian_relation in ('father','mother','guardian','other') then a.guardian_relation else 'guardian' end,
            nullif(a.guardian_cnic, ''), a.phone, coalesce(a.whatsapp, a.phone), a.email, a.address)
    returning id into v_guardian;
  end if;

  -- re-admission of a former student re-activates the existing record (history is kept)
  if a.type = 'readmission' and a.b_form_no is not null then
    select * into v_existing from students where school_id = a.school_id and campus_id = a.campus_id
      and b_form_no = a.b_form_no and status in ('left','transferred') limit 1;
  end if;
  if v_existing.id is not null then
    update students set status = 'active', left_date = null, left_reason = null, class_id = a.class_applied_id,
           section_id = p_section, admission_date = current_date where id = v_existing.id
    returning id, student_code into v_student, v_code;
  else
    v_code := private.next_number('student_code', a.school_id);
    v_adm := private.next_number('admission_no', a.school_id);
    insert into students (school_id, campus_id, student_code, admission_no, full_name, gender, dob, b_form_no, father_name, mother_name,
                          family_id, address, city, province, previous_school, admission_date, academic_year_id, class_id, section_id)
    values (a.school_id, a.campus_id, v_code, v_adm, a.full_name, a.gender, a.dob, nullif(a.b_form_no, ''), a.father_name, a.mother_name,
            v_family, a.address, a.city, a.province, a.previous_school, current_date,
            coalesce(a.academic_year_id, private.current_year()), a.class_applied_id, p_section)
    returning id into v_student;
  end if;
  insert into student_guardians (student_id, guardian_id, school_id, relation, is_primary, pays_fees)
  values (v_student, v_guardian, a.school_id, a.guardian_relation, not exists (select 1 from student_guardians where student_id = v_student and is_primary), true)
  on conflict do nothing;

  update admissions set stage = 'admitted', student_id = v_student, decision_by = auth.uid(), decision_at = now() where id = a.id;
  update enquiries set status = 'converted', converted_admission_id = a.id where id = a.enquiry_id;

  select coalesce(array_agg(id), '{}') into v_cat from fee_categories where school_id = a.school_id and kind = 'admission' and is_active;
  if cardinality(v_cat) > 0 then
    v_inv := private.generate_invoices_core(a.campus_id, current_date, current_date + 7, null, v_student, 'adhoc', v_cat, 'Admission Fee');
  end if;
  perform private.queue_guardian_notifications(v_student, 'admission_confirmation', '{}', a.campus_id);
  return jsonb_build_object('student_id', v_student, 'student_code', v_code, 'admission_invoice', coalesce(v_inv, '{}'::jsonb));
end $$;

-- ═════════════ exams ═════════════
create or replace function public.save_marks(p_exam_subject uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare es record; r jsonb; v_sid uuid; v_marks numeric; v_abs boolean; st record; v_n int := 0;
begin
  select es0.id, es0.campus_id, es0.class_id, es0.school_id, es0.exam_id, e.status as exam_status into es
    from exam_subjects es0 join exams e on e.id = es0.exam_id where es0.id = p_exam_subject;
  if not found then raise exception 'exam_subject_not_found'; end if;
  perform private.require_perm('marks.create', es.campus_id);
  if es.exam_status = 'draft' then raise exception 'exam_not_scheduled'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'no_rows'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_sid := (r ->> 'student_id')::uuid;
    select id, section_id into st from students where id = v_sid and class_id = es.class_id and status = 'active' and campus_id = es.campus_id;
    if not found then raise exception 'student_not_in_class: %', v_sid; end if;
    if not private.can_access_section(st.section_id) then raise exception 'permission_denied: section' using errcode = '42501'; end if;
    v_abs := coalesce((r ->> 'absent')::boolean, false);
    v_marks := case when v_abs or coalesce(r ->> 'marks', '') = '' then null else (r ->> 'marks')::numeric end;
    insert into marks (school_id, campus_id, exam_subject_id, student_id, section_id, marks_obtained, is_absent, remarks)
    values (es.school_id, es.campus_id, p_exam_subject, v_sid, st.section_id, v_marks, v_abs, nullif(r ->> 'remarks', ''))
    on conflict (exam_subject_id, student_id) do update
      set marks_obtained = excluded.marks_obtained, is_absent = excluded.is_absent, remarks = excluded.remarks,
          entered_by = auth.uid(), section_id = excluded.section_id;
    v_n := v_n + 1;
  end loop;
  if es.exam_status = 'scheduled' then update exams set status = 'marks_entry' where id = es.exam_id; end if;
  return jsonb_build_object('saved', v_n);
end $$;

create or replace function public.set_exam_status(p_exam uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare e exams;
begin
  select * into e from exams where id = p_exam for update;
  if not found then raise exception 'exam_not_found'; end if;
  if p_status = 'locked' then perform private.require_perm('marks.approve', e.campus_id);
  elsif p_status in ('draft','scheduled','marks_entry') then
    perform private.require_perm(case when e.status in ('locked','published') then 'marks.approve' else 'exams.edit' end, e.campus_id);
    if e.status in ('locked','published') and coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'reason_required'; end if;
  else raise exception 'use_publish_results'; end if;
  if e.status = 'published' then
    update result_cards set is_published = false where exam_id = e.id;
  end if;
  update exams set status = p_status, published_at = case when p_status <> 'published' then null else published_at end where id = e.id;
  perform public.log_audit('exam_status', 'exams', e.id::text, jsonb_build_object('status', e.status),
    jsonb_build_object('status', p_status, 'reason', p_reason), e.campus_id);
end $$;

create or replace function private.generate_results_core(p_exam uuid, p_class uuid, p_check_section boolean) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  e exams; v_gs uuid; v_pass numeric; v_use_gpa boolean; st record; v_n int := 0;
  v_lines jsonb; v_max numeric; v_obt numeric; v_pct numeric; v_grade text; v_gpa numeric; v_status text;
  v_missing int; v_failed int; v_absent int; v_total_sub int; v_att numeric; v_from date; v_to date;
begin
  select * into e from exams where id = p_exam for update;
  if not found then raise exception 'exam_not_found'; end if;
  if e.status = 'published' then raise exception 'already_published: reopen the exam first'; end if;
  if e.status = 'draft' then raise exception 'exam_not_scheduled'; end if;

  v_gs := coalesce(e.grading_system_id, (select id from grading_systems where school_id = e.school_id and is_default));
  if v_gs is null then raise exception 'no_grading_system'; end if;
  select pass_percentage, use_gpa into v_pass, v_use_gpa from grading_systems where id = v_gs;
  select ay.start_date into v_from from academic_years ay where ay.id = e.academic_year_id;
  v_to := coalesce(e.end_date, private.today());

  for st in
    select s.id, s.class_id, s.section_id from students s
    where s.campus_id = e.campus_id and s.status = 'active' and s.class_id is not null
      and (p_class is null or s.class_id = p_class)
      and exists (select 1 from exam_subjects x where x.exam_id = e.id and x.class_id = s.class_id)
      and (not p_check_section or private.can_access_section(s.section_id))
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'subject', sj.name, 'code', sj.code, 'max', x.max_marks, 'passing', x.passing_marks,
             'obtained', m.marks_obtained, 'absent', coalesce(m.is_absent, false), 'entered', m.id is not null,
             'grade', (select gb.grade from grade_bands gb where gb.grading_system_id = v_gs
                        and case when m.marks_obtained is null then false else round(m.marks_obtained / x.max_marks * 100, 2) between gb.min_percent and gb.max_percent end),
             'gpa', (select gb.gpa_points from grade_bands gb where gb.grading_system_id = v_gs
                        and case when m.marks_obtained is null then false else round(m.marks_obtained / x.max_marks * 100, 2) between gb.min_percent and gb.max_percent end)
           ) order by sj.name), '[]'),
           coalesce(sum(x.max_marks), 0), coalesce(sum(m.marks_obtained), 0),
           count(*) filter (where m.id is null or (m.marks_obtained is null and not m.is_absent)),
           count(*) filter (where coalesce(m.is_absent, false) or (m.marks_obtained is not null and m.marks_obtained < x.passing_marks)),
           count(*) filter (where coalesce(m.is_absent, false)),
           count(*)
      into v_lines, v_max, v_obt, v_missing, v_failed, v_absent, v_total_sub
    from exam_subjects x join subjects sj on sj.id = x.subject_id
    left join marks m on m.exam_subject_id = x.id and m.student_id = st.id
    where x.exam_id = e.id and x.class_id = st.class_id;

    v_pct := case when v_max > 0 then round(v_obt / v_max * 100, 2) else 0 end;
    select gb.grade into v_grade from grade_bands gb where gb.grading_system_id = v_gs and v_pct between gb.min_percent and gb.max_percent limit 1;
    v_gpa := case when v_use_gpa then
        (select round(avg((l ->> 'gpa')::numeric), 2) from jsonb_array_elements(v_lines) l where l ->> 'gpa' is not null) end;
    v_status := case when v_missing > 0 then 'incomplete'
                     when v_absent = v_total_sub then 'absent'
                     when v_failed > 0 or v_pct < v_pass then 'fail' else 'pass' end;

    select round(100.0 * sum(case status when 'present' then 1 when 'late' then 1 when 'half_day' then 0.5 else 0 end)
                 / nullif(count(*) filter (where status <> 'leave'), 0), 2)
      into v_att from student_attendance where student_id = st.id and date between v_from and v_to;

    insert into result_cards (school_id, campus_id, exam_id, student_id, class_id, section_id, total_max, total_obtained,
                              percentage, grade, gpa, result_status, attendance_percent, subjects, generated_at)
    values (e.school_id, e.campus_id, e.id, st.id, st.class_id, st.section_id, v_max, v_obt, v_pct, v_grade, v_gpa,
            v_status, v_att, v_lines, now())
    on conflict (exam_id, student_id) do update set
      class_id = excluded.class_id, section_id = excluded.section_id, total_max = excluded.total_max,
      total_obtained = excluded.total_obtained, percentage = excluded.percentage, grade = excluded.grade, gpa = excluded.gpa,
      result_status = excluded.result_status, attendance_percent = excluded.attendance_percent,
      subjects = excluded.subjects, generated_at = now();
    v_n := v_n + 1;
  end loop;

  -- positions among passing students, within the configured scope
  update result_cards rc set position = null where rc.exam_id = e.id and (p_class is null or rc.class_id = p_class);
  if e.position_scope <> 'none' then
    update result_cards rc set position = r.pos
    from (select id, rank() over (partition by case e.position_scope when 'section' then section_id else class_id end
                                  order by percentage desc) as pos
          from result_cards where exam_id = e.id and result_status = 'pass') r
    where rc.id = r.id;
  end if;
  return jsonb_build_object('generated', v_n);
end $$;

create or replace function public.generate_results(p_exam uuid, p_class uuid default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare v_campus uuid;
begin
  select campus_id into v_campus from exams where id = p_exam;
  if v_campus is null then raise exception 'exam_not_found'; end if;
  perform private.require_perm('results.create', v_campus);
  return private.generate_results_core(p_exam, p_class, true);
end $$;

create or replace function public.publish_results(p_exam uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare e exams; v_inc int; v_n int; c record;
begin
  select * into e from exams where id = p_exam for update;
  if not found then raise exception 'exam_not_found'; end if;
  perform private.require_perm('exams.publish', e.campus_id);
  perform private.require_perm('results.publish', e.campus_id);
  if e.status = 'published' then raise exception 'already_published'; end if;
  select count(*) filter (where result_status = 'incomplete'), count(*) into v_inc, v_n from result_cards where exam_id = e.id;
  if v_n = 0 then raise exception 'no_results: generate results first'; end if;
  if v_inc > 0 then raise exception 'incomplete_results: % students still have missing marks', v_inc; end if;
  update result_cards set is_published = true where exam_id = e.id;
  update exams set status = 'published', published_at = now() where id = e.id;
  for c in select student_id, percentage, grade from result_cards where exam_id = e.id loop
    perform private.queue_guardian_notifications(c.student_id, 'result_published',
      jsonb_build_object('exam_name', e.name, 'percentage', c.percentage, 'grade', coalesce(c.grade, '-')), e.campus_id);
  end loop;
  return jsonb_build_object('published', v_n);
end $$;

-- ═════════════ promotion ═════════════
create or replace function public.set_current_year(p_year uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.require_perm('academics.manage');
  if not exists (select 1 from academic_years where id = p_year and school_id = private.current_school_id()) then
    raise exception 'year_not_found';
  end if;
  update academic_years set is_current = false where school_id = private.current_school_id() and is_current and id <> p_year;
  update academic_years set is_current = true where id = p_year;
end $$;

create or replace function public.promote_students(p_rows jsonb, p_to_year uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  r jsonb; v_from uuid := private.current_year(); v_sid uuid; s students; v_outcome text; v_to_class uuid; v_to_sec uuid;
  v_n int := 0; v_start_from date; v_start_to date;
begin
  if v_from is null then raise exception 'no_current_academic_year'; end if;
  select start_date into v_start_from from academic_years where id = v_from;
  select start_date into v_start_to from academic_years where id = p_to_year and school_id = private.current_school_id();
  if v_start_to is null then raise exception 'target_year_not_found'; end if;
  if v_start_to <= v_start_from then raise exception 'target_year_must_be_later'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_sid := (r ->> 'student_id')::uuid;
    select * into s from students where id = v_sid and school_id = private.current_school_id() for update;
    if not found then raise exception 'student_not_found: %', v_sid; end if;
    perform private.require_perm('promotion.create', s.campus_id);
    if s.status <> 'active' then raise exception 'student_not_active: %', s.full_name; end if;
    if exists (select 1 from promotions where student_id = s.id and from_academic_year_id = v_from) then
      raise exception 'already_promoted: %', s.full_name;
    end if;
    v_outcome := r ->> 'outcome';
    if v_outcome not in ('promoted','promoted_conditional','retained','transferred','graduated','left') then
      raise exception 'invalid_outcome: %', v_outcome;
    end if;

    v_to_class := case v_outcome
      when 'promoted' then coalesce(nullif(r ->> 'to_class_id', '')::uuid, (select next_class_id from classes where id = s.class_id))
      when 'promoted_conditional' then coalesce(nullif(r ->> 'to_class_id', '')::uuid, (select next_class_id from classes where id = s.class_id))
      when 'retained' then s.class_id else null end;
    v_to_sec := nullif(r ->> 'to_section_id', '')::uuid;
    if v_outcome in ('promoted','promoted_conditional') and v_to_class is null then
      raise exception 'no_next_class: % has no next class configured', s.full_name;
    end if;
    if v_to_sec is not null and not exists (select 1 from sections where id = v_to_sec and class_id = v_to_class and campus_id = s.campus_id) then
      raise exception 'section_does_not_match_class';
    end if;
    if v_outcome = 'promoted_conditional' and coalesce(trim(r ->> 'conditions'), '') = '' then
      raise exception 'conditions_required';
    end if;

    insert into promotions (school_id, campus_id, student_id, from_academic_year_id, to_academic_year_id,
                            from_class_id, from_section_id, to_class_id, to_section_id, outcome, conditions, remarks)
    values (s.school_id, s.campus_id, s.id, v_from, p_to_year, s.class_id, s.section_id, v_to_class, v_to_sec,
            v_outcome, nullif(r ->> 'conditions', ''), nullif(r ->> 'remarks', ''));

    if v_outcome in ('promoted','promoted_conditional','retained') then
      update students set class_id = v_to_class, section_id = v_to_sec, roll_no = null where id = s.id;
    else
      update students set status = case v_outcome when 'graduated' then 'graduated' when 'transferred' then 'transferred' else 'left' end,
             left_date = current_date, left_reason = nullif(r ->> 'remarks', ''), section_id = null where id = s.id;
    end if;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('processed', v_n);
end $$;
