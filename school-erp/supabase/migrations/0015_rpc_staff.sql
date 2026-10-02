-- 0015 · Staff creation (employee code generation, designation/department by name).
set search_path = public, extensions;

create or replace function public.create_staff(p_campus uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare v_school uuid; v_code text; v_id uuid; v_des uuid; v_dep uuid;
begin
  perform private.require_perm('staff.create', p_campus);
  select school_id into v_school from campuses where id = p_campus;
  if coalesce(trim(p ->> 'full_name'), '') = '' then raise exception 'full_name_required'; end if;
  if nullif(p ->> 'designation_id', '') is not null then v_des := (p ->> 'designation_id')::uuid;
  elsif nullif(p ->> 'designation', '') is not null then
    select id into v_des from designations where school_id = v_school and lower(name) = lower(trim(p ->> 'designation'));
    if v_des is null then insert into designations (school_id, name) values (v_school, trim(p ->> 'designation')) returning id into v_des; end if;
  end if;
  if nullif(p ->> 'department_id', '') is not null then v_dep := (p ->> 'department_id')::uuid;
  elsif nullif(p ->> 'department', '') is not null then
    select id into v_dep from departments where school_id = v_school and lower(name) = lower(trim(p ->> 'department'));
  end if;
  v_code := coalesce(nullif(upper(trim(p ->> 'employee_code')), ''), private.next_number('employee', v_school));
  insert into staff (school_id, campus_id, employee_code, full_name, gender, dob, cnic, phone, email, address, department_id, designation_id,
                     joining_date, employment_type, qualification, experience_years, bank_name, bank_account, shift_start, shift_end)
  values (v_school, p_campus, v_code, trim(p ->> 'full_name'), nullif(p ->> 'gender', ''), nullif(p ->> 'dob', '')::date, nullif(p ->> 'cnic', ''),
          nullif(p ->> 'phone', ''), nullif(p ->> 'email', ''), nullif(p ->> 'address', ''), v_dep, v_des,
          coalesce(nullif(p ->> 'joining_date', '')::date, private.today()), coalesce(nullif(p ->> 'employment_type', ''), 'permanent'),
          nullif(p ->> 'qualification', ''), nullif(p ->> 'experience_years', '')::numeric, nullif(p ->> 'bank_name', ''), nullif(p ->> 'bank_account', ''),
          coalesce(nullif(p ->> 'shift_start', '')::time, time '08:00'), coalesce(nullif(p ->> 'shift_end', '')::time, time '14:00'))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'employee_code', v_code);
end $$;
