-- 0014 · Student creation (family + guardian + codes in one transaction), discipline log.
set search_path = public, extensions;

create table student_discipline (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null default private.current_school_id() references schools(id) on delete cascade,
  campus_id uuid not null,
  student_id uuid not null,
  incident_date date not null default current_date,
  kind text not null default 'incident' check (kind in ('incident','warning','suspension','commendation')),
  description text not null,
  action_taken text,
  reported_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (student_id, campus_id) references students(id, campus_id) on delete cascade
);
create index student_discipline_student on student_discipline(student_id);
create trigger audit_student_discipline after insert or update or delete on student_discipline for each row execute function private.audit_trigger();
-- Discipline notes are staff-only (never shown to parents or students).
call private.apply_rls('student_discipline', 'students', true, 'private.can_access_section((select s.section_id from public.students s where s.id = student_id))');

create or replace function public.create_student(p_campus uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid; v_family uuid; v_guardian uuid; v_student uuid; v_code text; v_adm text; v_phone text;
  v_linked boolean := false; v_class uuid; v_section uuid; v_fam_code text;
begin
  perform private.require_perm('students.create', p_campus);
  select school_id into v_school from campuses where id = p_campus;
  if coalesce(trim(p ->> 'full_name'), '') = '' then raise exception 'full_name_required'; end if;
  if (p ->> 'gender') not in ('male','female','other') then raise exception 'invalid_gender'; end if;
  v_class := nullif(p ->> 'class_id', '')::uuid;
  v_section := nullif(p ->> 'section_id', '')::uuid;
  if v_section is not null and not exists (select 1 from sections where id = v_section and campus_id = p_campus and (v_class is null or class_id = v_class)) then
    raise exception 'section_does_not_match_class';
  end if;
  if v_class is not null and not exists (select 1 from classes where id = v_class and campus_id = p_campus) then
    raise exception 'class_not_in_campus';
  end if;
  if nullif(p ->> 'admission_no', '') is not null and exists (select 1 from students where school_id = v_school and admission_no = trim(p ->> 'admission_no')) then
    raise exception 'duplicate_key: students_school_id_admission_no_key' using errcode = '23505';
  end if;

  v_phone := regexp_replace(coalesce(p ->> 'g_phone', ''), '\D', '', 'g');
  v_fam_code := nullif(trim(coalesce(p ->> 'family_code', '')), '');
  if v_fam_code is not null then
    select id into v_family from families where school_id = v_school and family_code = upper(v_fam_code);
    if v_family is null then raise exception 'family_not_found'; end if;
    select id into v_guardian from guardians where family_id = v_family order by (relation = 'father') desc, created_at limit 1;
    v_linked := true;
  elsif v_phone <> '' then
    select g.family_id, g.id into v_family, v_guardian from guardians g
      where g.school_id = v_school and g.family_id is not null and regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') = v_phone
      order by g.created_at limit 1;
    v_linked := v_family is not null;
  end if;

  if v_family is null then
    if coalesce(trim(p ->> 'g_name'), '') = '' then raise exception 'guardian_name_required'; end if;
    insert into families (school_id, family_code, family_name, address, city, province, primary_phone)
    values (v_school, private.next_number('family', v_school), trim(p ->> 'g_name') || ' Family',
            nullif(p ->> 'address', ''), nullif(p ->> 'city', ''), nullif(p ->> 'province', ''), nullif(p ->> 'g_phone', ''))
    returning id into v_family;
    insert into guardians (school_id, family_id, full_name, relation, cnic, phone, whatsapp, email, occupation, address)
    values (v_school, v_family, trim(p ->> 'g_name'), coalesce(nullif(p ->> 'g_relation', ''), 'father'), nullif(p ->> 'g_cnic', ''),
            nullif(p ->> 'g_phone', ''), coalesce(nullif(p ->> 'g_whatsapp', ''), nullif(p ->> 'g_phone', '')), nullif(p ->> 'g_email', ''),
            nullif(p ->> 'g_occupation', ''), nullif(p ->> 'address', ''))
    returning id into v_guardian;
  end if;

  v_code := private.next_number('student_code', v_school);
  v_adm := coalesce(nullif(trim(p ->> 'admission_no'), ''), private.next_number('admission_no', v_school));
  insert into students (school_id, campus_id, student_code, admission_no, roll_no, full_name, gender, dob, b_form_no, father_name, mother_name,
                        family_id, emergency_contact_name, emergency_contact_phone, address, city, province, previous_school, admission_date,
                        academic_year_id, class_id, section_id, house_id, blood_group, medical_notes, hostel_status)
  values (v_school, p_campus, v_code, v_adm, nullif(p ->> 'roll_no', ''), trim(p ->> 'full_name'), p ->> 'gender', nullif(p ->> 'dob', '')::date,
          nullif(p ->> 'b_form_no', ''), nullif(p ->> 'father_name', ''), nullif(p ->> 'mother_name', ''), v_family,
          nullif(p ->> 'emergency_contact_name', ''), nullif(p ->> 'emergency_contact_phone', ''),
          nullif(p ->> 'address', ''), nullif(p ->> 'city', ''), nullif(p ->> 'province', ''), nullif(p ->> 'previous_school', ''),
          coalesce(nullif(p ->> 'admission_date', '')::date, private.today()), private.current_year(v_school), v_class, v_section,
          nullif(p ->> 'house_id', '')::uuid, nullif(p ->> 'blood_group', ''), nullif(p ->> 'medical_notes', ''), coalesce((p ->> 'hostel_status')::boolean, false))
  returning id into v_student;

  insert into student_guardians (student_id, guardian_id, school_id, relation, is_primary, is_emergency, pays_fees)
  values (v_student, v_guardian, v_school, (select relation from guardians where id = v_guardian), true, true, true);
  return jsonb_build_object('id', v_student, 'student_code', v_code, 'admission_no', v_adm, 'family_id', v_family, 'linked_existing_family', v_linked);
end $$;

-- Records a payment-free change of placement within the campus (class / section / roll no).
create or replace function public.update_student_placement(p_student uuid, p_class uuid, p_section uuid, p_roll text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare s students;
begin
  select * into s from students where id = p_student for update;
  if not found then raise exception 'student_not_found'; end if;
  perform private.require_perm('students.edit', s.campus_id);
  if p_section is not null and not exists (select 1 from sections where id = p_section and campus_id = s.campus_id and class_id = coalesce(p_class, s.class_id)) then
    raise exception 'section_does_not_match_class';
  end if;
  update students set class_id = coalesce(p_class, class_id), section_id = p_section, roll_no = nullif(trim(coalesce(p_roll, '')), '') where id = p_student;
end $$;
