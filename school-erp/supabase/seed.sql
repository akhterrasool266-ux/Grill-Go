-- ═══════════════════════════════════════════════════════════════════════════
--  DEMO DATA — development / sales demos only. NEVER run against production.
--  Creates one clearly-labelled demo school ("Al-Noor Grammar School (DEMO)",
--  slug `demo`) with Pakistani names, two campuses, a year of structure and
--  recent attendance, fees, payments and one published exam.
--  Users are created separately by scripts/seed-demo-users.mjs (needs the
--  Supabase service role key; passwords come from your environment).
--  Safe to re-run: exits if the demo school already exists.
-- ═══════════════════════════════════════════════════════════════════════════
set search_path = public, extensions;

do $seed$
declare
  v_school uuid; v_c1 uuid; v_c2 uuid; v_year uuid; v_ystart date;
  v_tuition uuid; v_annual uuid; v_exam_fee uuid; v_admission uuid;
  v_subj uuid[] := '{}'; sj uuid; v_names text[] := array['English','Urdu','Mathematics','Science','Islamiat','Social Studies'];
  v_codes text[] := array['ENG','URD','MATH','SCI','ISL','SST'];
  v_class_names text[] := array['Prep','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8'];
  v_class uuid; v_classes uuid[]; v_sec uuid; v_secs uuid[]; v_prev uuid; v_campus uuid; i int; j int; k int; n int;
  v_boys text[] := array['Muhammad Ali','Ahmed','Hamza','Usman','Bilal','Hassan','Zain','Abdullah','Talha','Saad','Faisal','Daniyal','Ibrahim','Huzaifa','Shahzaib','Rayyan','Arham','Moiz'];
  v_girls text[] := array['Ayesha','Fatima','Maryam','Zainab','Hira','Sana','Amna','Laiba','Eman','Areeba','Noor ul Ain','Mahnoor','Rabia','Iqra','Hafsa','Minahil','Alishba','Dua'];
  v_fathers text[] := array['Muhammad Tariq','Abdul Rehman','Imran','Naveed','Khalid','Shahid','Aslam','Rashid','Javed','Nadeem','Irfan','Sajid','Waqas','Adnan','Kamran','Farooq','Akram','Mansoor','Zahid','Saleem','Yasir','Rizwan','Amjad','Haroon','Arif','Shafiq','Anwar','Fahad','Tahir','Jamil'];
  v_surn text[] := array['Khan','Raza','Malik','Butt','Sheikh','Qureshi','Chaudhry','Siddiqui','Ahmed','Hussain','Mirza','Baig','Awan','Gill','Rana'];
  v_staff_names text[] := array['Sidra Parveen','Muhammad Asif','Nazia Bibi','Tariq Mehmood','Rukhsana Kausar','Shahbaz Ahmed','Uzma Nasir','Imtiaz Hussain','Farah Deeba','Waseem Akhtar','Sobia Rashid','Naeem Abbas'];
  v_fam uuid; v_g uuid; v_stud uuid; v_gender text; v_fn text; v_class_idx int; v_sec_idx int; v_phone text; v_total int := 0;
  v_cl_ids uuid[]; v_cl_c2 uuid[]; v_sec_ids uuid[]; v_sec_c2 uuid[];
  r record; d date; v_h numeric; v_status text; v_exam uuid; es uuid; v_pay jsonb; v_prof numeric;
  v_staff uuid; v_stf_ids uuid[] := '{}'; v_p uuid; v_vehicle uuid; v_driver uuid; v_route uuid;
begin
  if exists (select 1 from schools where slug = 'demo') then
    raise notice 'Demo school already exists — skipping seed.'; return;
  end if;
  perform setseed(0.42);

  v_school := public.bootstrap_school('Al-Noor Grammar School (DEMO)', 'demo', 'Al-Noor', 'Main Campus — Johar Town', 'MAIN');
  update schools set address = '12-B, Johar Town', city = 'Lahore', province = 'Punjab', phone = '042-35123456', email = 'info@demo.example', website = 'https://demo.example' where id = v_school;
  select id into v_c1 from campuses where school_id = v_school and is_main;
  insert into campuses (school_id, name, code, city) values (v_school, 'Gulberg Campus', 'GULB', 'Lahore') returning id into v_c2;
  select id, start_date into v_year, v_ystart from academic_years where school_id = v_school and is_current;

  insert into terms (school_id, academic_year_id, name, start_date, end_date, sort_order) values
    (v_school, v_year, 'Term 1', v_ystart, (v_ystart + interval '5 months')::date, 1),
    (v_school, v_year, 'Term 2', (v_ystart + interval '5 months' + interval '1 day')::date, (v_ystart + interval '1 year - 1 day')::date, 2);

  insert into houses (school_id, name, color) values (v_school, 'Iqbal House', '#16a34a'), (v_school, 'Jinnah House', '#2563eb'), (v_school, 'Liaquat House', '#dc2626');
  insert into departments (school_id, name, name_ur) values (v_school, 'Languages', 'زبانیں'), (v_school, 'Sciences', 'سائنس'), (v_school, 'Humanities', 'علوم');
  insert into designations (school_id, name) values (v_school, 'Principal'), (v_school, 'Senior Teacher'), (v_school, 'Teacher'), (v_school, 'Accountant'), (v_school, 'Clerk');

  for i in 1..6 loop
    insert into subjects (school_id, code, name) values (v_school, v_codes[i], v_names[i]) returning id into sj;
    v_subj := v_subj || sj;
  end loop;

  select id into v_tuition from fee_categories where school_id = v_school and code = 'TUITION';
  select id into v_annual from fee_categories where school_id = v_school and code = 'ANNUAL';
  select id into v_admission from fee_categories where school_id = v_school and code = 'ADMISSION';
  select id into v_exam_fee from fee_categories where school_id = v_school and code = 'EXAM';

  -- classes, sections, periods, rooms for both campuses
  foreach v_campus in array array[v_c1, v_c2] loop
    v_prev := null; v_classes := '{}'; v_secs := '{}';
    for i in 1..9 loop
      insert into classes (school_id, campus_id, name, level) values (v_school, v_campus, v_class_names[i], i) returning id into v_class;
      if v_prev is not null then update classes set next_class_id = v_class where id = v_prev; end if;
      v_prev := v_class; v_classes := v_classes || v_class;
      for j in 1..2 loop
        insert into sections (school_id, campus_id, class_id, name, capacity) values (v_school, v_campus, v_class, case j when 1 then 'A' else 'B' end, 35) returning id into v_sec;
        v_secs := v_secs || v_sec;
        insert into rooms (school_id, campus_id, name, capacity) values (v_school, v_campus, v_class_names[i] || ' ' || case j when 1 then 'A' else 'B' end, 35);
      end loop;
      insert into fee_structures (school_id, campus_id, academic_year_id, class_id, fee_category_id, amount, frequency) values
        (v_school, v_campus, v_year, v_class, v_tuition, (2500 + i * 400) * case when v_campus = v_c2 then 1.2 else 1 end, 'monthly'),
        (v_school, v_campus, v_year, v_class, v_annual, 5000, 'once'),
        (v_school, v_campus, v_year, v_class, v_admission, 10000, 'once'),
        (v_school, v_campus, v_year, v_class, v_exam_fee, 1500, 'termly');
      for j in 1..6 loop insert into class_subjects (school_id, campus_id, class_id, subject_id) values (v_school, v_campus, v_class, v_subj[j]); end loop;
    end loop;
    if v_campus = v_c1 then v_cl_ids := v_classes; v_sec_ids := v_secs; else v_cl_c2 := v_classes; v_sec_c2 := v_secs; end if;
    insert into periods (school_id, campus_id, name, start_time, end_time, sort_order, is_break) values
      (v_school, v_campus, 'Period 1', '08:00', '08:40', 1, false), (v_school, v_campus, 'Period 2', '08:40', '09:20', 2, false),
      (v_school, v_campus, 'Period 3', '09:20', '10:00', 3, false), (v_school, v_campus, 'Break', '10:00', '10:30', 4, true),
      (v_school, v_campus, 'Period 4', '10:30', '11:10', 5, false), (v_school, v_campus, 'Period 5', '11:10', '11:50', 6, false),
      (v_school, v_campus, 'Period 6', '11:50', '12:30', 7, false);
    insert into accounts (school_id, campus_id, name, kind, methods) select v_school, v_campus, 'Counter Cash — ' || c.code, 'cash', array['cash'] from campuses c where c.id = v_campus;
  end loop;
  -- campus-specific cash counters win over the shared cash account
  update accounts set methods = '{}' where school_id = v_school and name = 'Cash in Hand';

  -- staff
  for i in 1..12 loop
    insert into staff (school_id, campus_id, employee_code, full_name, gender, cnic, phone, joining_date, qualification, designation_id, department_id, shift_start, shift_end)
    values (v_school, case when i <= 8 then v_c1 else v_c2 end, private.next_number('employee', v_school), v_staff_names[i],
            case when i in (1,3,5,7,9,11) then 'female' else 'male' end,
            '35202-' || lpad((4000000 + i * 7919)::text, 7, '0') || '-' || (i % 9 + 1), '03' || (array['00','01','12','21'])[1 + i % 4] || lpad((2000000 + i * 4231)::text, 7, '0'),
            (v_ystart - (i * 90) * interval '1 day')::date, case when i % 3 = 0 then 'M.Phil' when i % 2 = 0 then 'M.A., B.Ed' else 'B.Sc., B.Ed' end,
            (select id from designations where school_id = v_school and name = 'Teacher'), (select id from departments where school_id = v_school order by name limit 1 offset i % 3),
            '07:45', '14:00')
    returning id into v_staff;
    v_stf_ids := v_stf_ids || v_staff;
    insert into salary_structures (school_id, campus_id, staff_id, effective_from, basic_salary, house_allowance, medical_allowance, conveyance_allowance, tax_percent)
    select v_school, campus_id, v_staff, v_ystart, 35000 + i * 2500, 8000, 3000, 3000, case when i > 8 then 2.5 else 0 end from staff where id = v_staff;
  end loop;

  -- families + students (≈30 families, every third has two children)
  for i in 1..30 loop
    v_campus := case when i % 5 = 0 then v_c2 else v_c1 end;
    v_phone := '03' || (array['00','01','12','21','33','45'])[1 + i % 6] || lpad((1000000 + i * 7919)::text, 7, '0');
    insert into families (school_id, family_code, family_name, address, city, province, primary_phone)
    values (v_school, private.next_number('family', v_school), v_fathers[i] || ' ' || v_surn[1 + i % 15], (10 + i) || '-A, Block ' || chr(64 + 1 + i % 8) || ', Lahore', 'Lahore', 'Punjab', v_phone)
    returning id into v_fam;
    insert into guardians (school_id, family_id, full_name, relation, cnic, phone, whatsapp, occupation)
    values (v_school, v_fam, v_fathers[i] || ' ' || v_surn[1 + i % 15], 'father', '35202-' || lpad((7000000 + i * 3571)::text, 7, '0') || '-1', v_phone, v_phone,
            (array['Shopkeeper','Engineer','Government employee','Businessman','Doctor','Teacher'])[1 + i % 6])
    returning id into v_g;
    for k in 1..(case when i % 3 = 0 then 2 else 1 end) loop
      v_gender := case when (i + k) % 2 = 0 then 'female' else 'male' end;
      v_fn := case v_gender when 'male' then v_boys[1 + (i * 3 + k) % 18] else v_girls[1 + (i * 5 + k) % 18] end;
      v_class_idx := 1 + (i * 2 + k * 3) % 9; v_sec_idx := 1 + (i + k) % 2;
      insert into students (school_id, campus_id, student_code, admission_no, full_name, gender, dob, b_form_no, father_name, family_id,
                            emergency_contact_name, emergency_contact_phone, address, city, province, admission_date, academic_year_id, class_id, section_id, house_id, blood_group, previous_school)
      values (v_school, v_campus, private.next_number('student_code', v_school), private.next_number('admission_no', v_school),
              v_fn || ' ' || v_surn[1 + i % 15], v_gender, (current_date - ((4 + v_class_idx) * 365 + i * 11 + k * 37) * interval '1 day')::date,
              '35202-' || lpad((5000000 + i * 1237 + k)::text, 7, '0') || '-' || (i % 9 + 1), v_fathers[i], v_fam,
              v_fathers[i], v_phone, (10 + i) || '-A, Block ' || chr(64 + 1 + i % 8) || ', Lahore', 'Lahore', 'Punjab',
              (v_ystart + (i % 20) * interval '1 day')::date, v_year,
              (case when v_campus = v_c1 then v_cl_ids else v_cl_c2 end)[v_class_idx],
              (case when v_campus = v_c1 then v_sec_ids else v_sec_c2 end)[(v_class_idx - 1) * 2 + v_sec_idx],
              (select id from houses where school_id = v_school order by name limit 1 offset (i + k) % 3),
              (array['A+','B+','O+','AB+','A-','O-'])[1 + (i + k) % 6], case when i % 4 = 0 then 'City Public School' end)
      returning id into v_stud;
      insert into student_guardians (student_id, guardian_id, school_id, relation, is_primary, is_emergency, pays_fees) values (v_stud, v_g, v_school, 'father', true, true, true);
      v_total := v_total + 1;
    end loop;
  end loop;

  -- class teachers + a few subject assignments
  i := 0;
  for r in select s.id from sections s where s.campus_id = v_c1 order by s.class_id, s.name limit 8 loop
    i := i + 1;
    insert into teacher_assignments (school_id, campus_id, academic_year_id, section_id, staff_id, is_class_teacher) values (v_school, v_c1, v_year, r.id, v_stf_ids[i], true);
  end loop;

  -- timetable for the first section of the main campus (fully clash-free by construction)
  select id into v_sec from sections where campus_id = v_c1 order by class_id, name limit 1;
  i := 0;
  for r in select p.id from periods p where p.campus_id = v_c1 and not p.is_break order by p.sort_order loop
    i := i + 1;
    for j in 1..6 loop
      insert into timetable_entries (school_id, campus_id, academic_year_id, section_id, day_of_week, period_id, subject_id, staff_id)
      values (v_school, v_c1, v_year, v_sec, j, r.id, v_subj[1 + (i + j) % 6], v_stf_ids[1 + (i + j) % 8]);
    end loop;
  end loop;

  -- attendance: last 25 school days (Mon–Sat), deterministic pseudo-random
  for d in select g::date from generate_series(current_date - 35, current_date, interval '1 day') g where extract(isodow from g) <> 7 loop
    insert into student_attendance (school_id, campus_id, student_id, section_id, academic_year_id, date, status, method, check_in_time)
    select v_school, s.campus_id, s.id, s.section_id, v_year, d,
           case when h < 0.05 then 'absent' when h < 0.08 then 'late' else 'present' end, 'manual',
           case when h >= 0.05 and h < 0.08 then time '08:45' when h >= 0.08 then time '07:55' end
    from (select st.*, ((abs(hashtext(st.id::text || d::text)) % 1000) / 1000.0) h from students st where st.status = 'active') s
    where d >= s.admission_date;
    insert into staff_attendance (school_id, campus_id, staff_id, date, status, check_in, check_out, method)
    select v_school, s.campus_id, s.id, d, case when h < 0.04 then 'absent' when h < 0.09 then 'late' else 'present' end,
           case when h >= 0.04 then case when h < 0.09 then time '08:25' else time '07:40' end end,
           case when h >= 0.04 then time '14:05' end, 'manual'
    from (select st.*, ((abs(hashtext(st.id::text || d::text || 's')) % 1000) / 1000.0) h from staff st) s;
  end loop;

  -- fees: bill the last three months, then collect with a realistic spread
  update settings set value = jsonb_set(value, '{sibling_discount_percent}', '10') where school_id = v_school and key = 'fees';
  insert into student_discounts (school_id, campus_id, student_id, academic_year_id, kind, calc, value, reason)
    select v_school, s.campus_id, s.id, v_year, 'scholarship', 'percent', 25, 'Merit scholarship (demo)' from students s where s.school_id = v_school order by s.student_code limit 3;
  for k in reverse 3..1 loop
    d := (date_trunc('month', current_date) - (k - 1) * interval '1 month')::date;
    perform private.generate_invoices_core(v_c1, d, d + 9, null, null, 'monthly', null, null);
    perform private.generate_invoices_core(v_c2, d, d + 9, null, null, 'monthly', null, null);
  end loop;
  for r in select i2.id, i2.student_id, i2.campus_id, i2.fee_month, i2.balance, ((abs(hashtext(i2.id::text)) % 1000) / 1000.0) h
           from fee_invoices i2 where i2.school_id = v_school and i2.invoice_type = 'monthly' order by i2.fee_month, i2.invoice_no loop
    if r.fee_month < date_trunc('month', current_date) or r.h < 0.55 then
      if r.h < 0.80 then
        v_pay := private.record_payment(r.campus_id, r.student_id, null, case when r.h < 0.70 then r.balance else round(r.balance / 2, 0) end,
                   (array['cash','cash','jazzcash','bank','easypaisa'])[1 + (abs(hashtext(r.id::text)) % 5)],
                   'DEMO-' || substr(r.id::text, 1, 8), null, array[r.id], 'Demo payment', null, null, null, null, false);
        update payments set paid_at = (r.fee_month + ((abs(hashtext(r.id::text)) % 20)) * interval '1 day' + interval '9 hours')
          where id = (v_pay ->> 'payment_id')::uuid and r.fee_month + 20 <= current_date;
        update transactions set txn_date = (select (p.paid_at at time zone 'Asia/Karachi')::date from payments p where p.id = (v_pay ->> 'payment_id')::uuid)
          where source_id = (v_pay ->> 'payment_id')::uuid;
      end if;
    end if;
  end loop;
  update notification_logs set status = 'failed', error = 'demo seed: not sent' where school_id = v_school and status = 'queued';

  -- one published exam
  insert into exams (school_id, campus_id, academic_year_id, term_id, name, kind, status, position_scope, start_date, end_date)
  values (v_school, v_c1, v_year, (select id from terms where academic_year_id = v_year and name = 'Term 1'), 'Mid Term Examination', 'midterm', 'marks_entry', 'section',
          current_date - 40, current_date - 30) returning id into v_exam;
  for r in select c.id from classes c where c.campus_id = v_c1 loop
    for j in 1..6 loop
      insert into exam_subjects (school_id, campus_id, exam_id, class_id, subject_id, exam_date, max_marks, passing_marks)
      values (v_school, v_c1, v_exam, r.id, v_subj[j], current_date - 40 + j, 100, 40) returning id into es;
      insert into marks (school_id, campus_id, exam_subject_id, student_id, section_id, marks_obtained)
      select v_school, v_c1, es, s.id, s.section_id, 30 + (abs(hashtext(s.id::text || es::text)) % 700) / 10.0
      from students s where s.class_id = r.id and s.status = 'active' and s.campus_id = v_c1;
    end loop;
  end loop;
  perform private.generate_results_core(v_exam, null, false);
  update result_cards set is_published = true, teacher_remarks = 'Keep up the good work.' where exam_id = v_exam and result_status <> 'incomplete';
  update exams set status = 'published', published_at = now() - interval '25 days' where id = v_exam;

  -- calendar, announcements, transport, library, expenses
  insert into calendar_events (school_id, campus_id, title, kind, start_date, end_date, is_public) values
    (v_school, null, 'Pakistan Day', 'holiday', make_date(extract(year from current_date)::int, 3, 23), null, true),
    (v_school, null, 'Independence Day', 'holiday', make_date(extract(year from current_date)::int, 8, 14), null, true),
    (v_school, null, 'Iqbal Day', 'holiday', make_date(extract(year from current_date)::int, 11, 9), null, true),
    (v_school, null, 'Quaid-e-Azam Day', 'holiday', make_date(extract(year from current_date)::int, 12, 25), null, true),
    (v_school, null, 'Parent–Teacher Meeting', 'ptm', current_date + 9, null, true),
    (v_school, null, 'Annual Sports Day', 'event', current_date + 21, null, true),
    (v_school, v_c1, 'Science Exhibition', 'event', current_date + 12, null, false);
  insert into announcements (school_id, title, body, audience, level, is_pinned) values
    (v_school, 'Welcome back', 'Classes resume at 8:00 am. Please ensure uniforms are complete.', 'all', 'info', true),
    (v_school, 'Fee vouchers issued', 'This month''s fee vouchers are available in the parent portal. Last date: 10th.', 'parents', 'warning', false);

  insert into drivers (school_id, campus_id, full_name, cnic, phone, license_no, license_expiry) values
    (v_school, v_c1, 'Muhammad Shafi', '35202-9988776-1', '03001112233', 'LHR-48211', current_date + 400),
    (v_school, v_c1, 'Abdul Ghaffar', '35202-1122334-5', '03214455667', 'LHR-51877', current_date + 150);
  insert into vehicles (school_id, campus_id, reg_no, make_model, capacity, fitness_expiry, insurance_expiry) values
    (v_school, v_c1, 'LEA-1234', 'Toyota Hiace', 18, current_date + 200, current_date + 120),
    (v_school, v_c1, 'LEB-5678', 'Toyota Coaster', 28, current_date + 90, current_date + 300);
  insert into routes (school_id, campus_id, name, vehicle_id, driver_id, monthly_fee, start_time)
    select v_school, v_c1, 'Route 1 — Johar Town ↔ Model Town', (select id from vehicles where reg_no = 'LEA-1234'), (select id from drivers where full_name = 'Muhammad Shafi' and school_id = v_school), 3500, '07:00' returning id into v_route;
  insert into route_stops (school_id, campus_id, route_id, name, stop_order, pickup_time, drop_time) values
    (v_school, v_c1, v_route, 'Johar Town Chowk', 1, '07:10', '13:40'), (v_school, v_c1, v_route, 'Wapda Town Gate', 2, '07:25', '13:25'), (v_school, v_c1, v_route, 'Model Town Park', 3, '07:40', '13:10');
  insert into student_transport (school_id, campus_id, student_id, route_id, pickup_stop_id, monthly_fee)
    select v_school, v_c1, s.id, v_route, (select id from route_stops where route_id = v_route and stop_order = 1 + abs(hashtext(s.id::text)) % 3), 3500
    from (select id from students where school_id = v_school and campus_id = v_c1 order by student_code limit 6) s;

  insert into library_books (school_id, campus_id, isbn, title, author, category, quantity, available, shelf)
  select v_school, v_c1, '978-969-' || lpad((abs(hashtext(t.title)) % 100000)::text, 5, '0'), t.title, t.author, t.cat, 3, 3, 'S' || (1 + abs(hashtext(t.title)) % 6)
  from (values ('Bang-e-Dra', 'Allama Iqbal', 'Poetry'), ('Umro Ayyar', 'Traditional', 'Stories'), ('Oxford Primary Mathematics 5', 'Oxford', 'Textbook'),
               ('Pakistan Studies Class 8', 'PCTB', 'Textbook'), ('Science Explorer', 'Pearson', 'Textbook'), ('Tales of Prophets', 'Maulana Hifzur Rahman', 'Islamic'),
               ('Charlotte''s Web', 'E. B. White', 'Fiction'), ('Urdu Qaida', 'PCTB', 'Textbook')) as t(title, author, cat);

  insert into expenses (school_id, campus_id, category_id, amount, expense_date, description, status, approved_at, paid_on, account_id)
  select v_school, v_c1, (select id from expense_categories where school_id = v_school and name = e.cat), e.amt, current_date - e.ago, e.descr, 'paid', now(), current_date - e.ago,
         (select id from accounts where school_id = v_school and name = 'Counter Cash — MAIN')
  from (values ('Utilities', 68500, 12, 'Electricity bill (WAPDA)'), ('Utilities', 9200, 11, 'Sui gas bill'), ('Stationery', 15750, 6, 'Chalk, markers and registers'), ('Maintenance', 24000, 3, 'Water cooler repair')) as e(cat, amt, ago, descr);

  raise notice 'Demo school created: % students, slug "demo". Now run scripts/seed-demo-users.mjs to create logins.', v_total;
end $seed$;
