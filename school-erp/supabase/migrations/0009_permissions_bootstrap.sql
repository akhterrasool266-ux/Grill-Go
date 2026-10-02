-- 0009 · Permission catalogue, default roles, school bootstrap.
-- The catalogue below is mirrored in src/lib/auth/catalogue.ts; a unit test
-- fails if the two ever drift apart.
set search_path = public, extensions;

insert into permissions (code, module, action, description)
select m.module || '.' || a, m.module, a, initcap(replace(m.module, '_', ' ')) || ' — ' || a
from (values
  ('students',        array['view','create','edit','delete','export','print']),
  ('guardians',       array['view','create','edit','delete']),
  ('admissions',      array['view','create','edit','delete','approve','export','print']),
  ('academics',       array['view','create','edit','delete','manage']),
  ('timetable',       array['view','create','edit','delete','export','print']),
  ('attendance',      array['view','create','edit','export','print','qr']),
  ('staff_attendance',array['view','create','edit','export']),
  ('fees',            array['view','create','edit','delete','export','print','approve']),
  ('payments',        array['view','create','edit','export','print','approve']),
  ('finance',         array['view','create','edit','delete','export','approve','manage']),
  ('exams',           array['view','create','edit','delete','publish','manage','print']),
  ('marks',           array['view','create','edit','approve','export']),
  ('results',         array['view','create','publish','print','export']),
  ('promotion',       array['view','create','approve']),
  ('homework',        array['view','create','edit','delete']),
  ('staff',           array['view','create','edit','delete','export','print']),
  ('payroll',         array['view','create','edit','approve','export','print']),
  ('leave',           array['view','create','edit','approve']),
  ('library',         array['view','create','edit','delete','export']),
  ('transport',       array['view','create','edit','delete','export']),
  ('hostel',          array['view','create','edit','delete','export']),
  ('documents',       array['view','create','delete','sensitive']),
  ('communication',   array['view','create','manage','export']),
  ('announcements',   array['view','create','edit','delete','publish']),
  ('calendar',        array['view','create','edit','delete']),
  ('reports',         array['view','export','print']),
  ('audit',           array['view','export']),
  ('settings',        array['view','edit','manage']),
  ('users',           array['view','create','edit','delete']),
  ('roles',           array['view','manage']),
  ('campuses',        array['view','create','edit','delete']),
  ('cms',             array['view','create','edit','delete','publish']),
  ('ai',              array['use']),
  ('billing',         array['view','manage']),
  ('financial',       array['access']),
  ('campus',          array['all']),
  ('classes',         array['all'])
) as m(module, actions), unnest(m.actions) as a
on conflict (code) do nothing;

create table role_templates (
  code text primary key,
  name text not null,
  name_ur text not null,
  grants text[] not null,
  denies text[] not null default '{}',
  sort_order int not null
);
alter table role_templates enable row level security;   -- no policy: server/definer functions only
insert into role_templates(code, name, name_ur, grants, denies, sort_order) values
 ('super_admin','Super Admin','سپر ایڈمن', array['%'], '{}', 1),
 ('owner','School Owner','اسکول مالک', array['%'], array['roles.manage'], 2),
 ('principal','Principal','پرنسپل',
   array['%.view','%.export','%.print','students.%','attendance.%','exams.%','marks.%','results.%','promotion.%','announcements.%','calendar.%','reports.%','timetable.%','academics.%','admissions.approve','leave.approve','payments.approve','financial.access','campus.all','classes.all','ai.use'],
   array['roles.view','billing.view','billing.manage','users.view','audit.view','audit.export'], 3),
 ('campus_admin','Campus Admin','کیمپس ایڈمن',
   array['students.%','guardians.%','admissions.%','academics.view','academics.create','academics.edit','timetable.%','attendance.%','staff_attendance.%','fees.view','fees.create','fees.print','fees.export','payments.view','payments.create','payments.print','staff.view','staff.create','staff.edit','leave.%','library.%','transport.%','hostel.%','documents.%','communication.%','announcements.%','calendar.%','reports.%','homework.view','exams.view','results.view','classes.all','users.view','ai.use'],
   array['attendance.qr'], 4),
 ('vice_principal','Vice Principal','وائس پرنسپل',
   array['academics.%','timetable.%','attendance.%','exams.%','marks.view','marks.edit','marks.export','results.view','results.print','results.export','students.view','students.edit','students.export','students.print','guardians.view','staff.view','staff_attendance.view','leave.view','leave.approve','homework.view','announcements.%','calendar.%','reports.%','classes.all','promotion.view','documents.view','communication.view','ai.use'],
   array['attendance.qr'], 5),
 ('accountant','Accountant','اکاؤنٹنٹ',
   array['fees.%','payments.%','finance.%','reports.%','students.view','students.export','guardians.view','communication.view','communication.create','financial.access','classes.all','documents.view','calendar.view','announcements.view','ai.use'],
   '{}', 6),
 ('admission_officer','Admission Officer','ایڈمیشن آفیسر',
   array['admissions.view','admissions.create','admissions.edit','admissions.print','admissions.export','students.view','students.create','students.print','guardians.%','documents.view','documents.create','fees.view','academics.view','communication.view','communication.create','calendar.view','classes.all'],
   '{}', 7),
 ('teacher','Teacher','ٹیچر',
   array['students.view','attendance.view','attendance.create','attendance.print','homework.%','marks.view','marks.create','marks.edit','exams.view','results.view','timetable.view','timetable.print','academics.view','leave.view','leave.create','announcements.view','calendar.view','library.view','documents.view','documents.create','ai.use'],
   '{}', 8),
 ('class_teacher','Class Teacher','کلاس ٹیچر',
   array['students.view','students.edit','guardians.view','attendance.view','attendance.create','attendance.edit','attendance.print','homework.%','marks.view','marks.create','marks.edit','exams.view','results.view','results.create','results.print','promotion.view','timetable.view','timetable.print','academics.view','leave.view','leave.create','announcements.view','calendar.view','library.view','documents.view','documents.create','communication.view','communication.create','ai.use'],
   '{}', 9),
 ('exam_controller','Exam Controller','ایگزام کنٹرولر',
   array['exams.%','marks.%','results.%','promotion.view','promotion.create','academics.view','timetable.view','students.view','reports.%','classes.all','announcements.view','calendar.%','communication.view','communication.create','ai.use'],
   '{}', 10),
 ('hr_manager','HR Manager','ایچ آر مینیجر',
   array['staff.%','staff_attendance.%','leave.%','payroll.%','documents.%','reports.%','financial.access','calendar.view','announcements.view','communication.view','communication.create','users.view','ai.use'],
   '{}', 11),
 ('librarian','Librarian','لائبریرین',
   array['library.%','students.view','classes.all','calendar.view','announcements.view'], '{}', 12),
 ('transport_manager','Transport Manager','ٹرانسپورٹ مینیجر',
   array['transport.%','students.view','guardians.view','classes.all','calendar.view','announcements.view','reports.view','reports.export'], '{}', 13),
 ('driver','Driver','ڈرائیور', array['transport.view','calendar.view','announcements.view'], '{}', 14),
 ('parent','Parent','والدین', '{}', '{}', 15),
 ('student','Student','طالب علم', '{}', '{}', 16),
 ('receptionist','Receptionist','ریسپشنسٹ',
   array['admissions.view','admissions.create','admissions.edit','students.view','guardians.view','classes.all','calendar.view','announcements.view','communication.view'], '{}', 17),
 ('security_gate','Security / Gate Staff','سیکیورٹی / گیٹ اسٹاف', array['attendance.qr','calendar.view'], '{}', 18);

-- Re-usable: (re)apply the template matrix to one school's system roles.
create or replace function private.apply_role_templates(p_school uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare t record; v_role uuid;
begin
  for t in select * from role_templates order by sort_order loop
    insert into roles (school_id, code, name, name_ur, is_system)
    values (p_school, t.code, t.name, t.name_ur, true)
    on conflict (school_id, code) do update set name = excluded.name, name_ur = excluded.name_ur
    returning id into v_role;

    delete from role_permissions where role_id = v_role;
    insert into role_permissions (role_id, permission_code)
    select v_role, p.code from permissions p
    where exists (select 1 from unnest(t.grants) g where p.code like g)
      and not exists (select 1 from unnest(t.denies) d where p.code like d);
  end loop;
end $$;

create or replace function private.get_setting(p_school uuid, p_key text) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select coalesce((select value from public.settings where school_id = p_school and key = p_key), '{}'::jsonb)
$$;

-- Creates a complete, usable school: campus, roles, grading, fee categories,
-- accounts, templates, settings. Service role only (platform onboarding).
create or replace function public.bootstrap_school(
  p_name text, p_slug text, p_short_name text default null,
  p_campus_name text default 'Main Campus', p_campus_code text default 'MAIN')
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_school uuid; v_campus uuid; v_gs uuid; v_year_start date; v_name text;
begin
  insert into schools (name, short_name, slug) values (p_name, coalesce(p_short_name, p_name), p_slug)
  returning id into v_school;
  insert into campuses (school_id, name, code, is_main) values (v_school, p_campus_name, p_campus_code, true)
  returning id into v_campus;

  perform private.apply_role_templates(v_school);

  v_year_start := make_date(extract(year from now())::int - case when extract(month from now()) < 4 then 1 else 0 end, 4, 1);
  v_name := extract(year from v_year_start)::int || '-' || right((extract(year from v_year_start)::int + 1)::text, 2);
  insert into academic_years (school_id, name, start_date, end_date, is_current)
  values (v_school, v_name, v_year_start, (v_year_start + interval '1 year - 1 day')::date, true);

  insert into grading_systems (school_id, name, kind, use_gpa, pass_percentage, is_default)
  values (v_school, 'Standard (A+ to F)', 'grade', true, 40, true) returning id into v_gs;
  insert into grade_bands (school_id, grading_system_id, grade, min_percent, max_percent, gpa_points, description, is_pass) values
    (v_school, v_gs, 'A+', 90, 100, 4.0, 'Outstanding', true),
    (v_school, v_gs, 'A', 80, 89.99, 3.7, 'Excellent', true),
    (v_school, v_gs, 'B', 70, 79.99, 3.0, 'Very Good', true),
    (v_school, v_gs, 'C', 60, 69.99, 2.0, 'Good', true),
    (v_school, v_gs, 'D', 50, 59.99, 1.5, 'Satisfactory', true),
    (v_school, v_gs, 'E', 40, 49.99, 1.0, 'Pass', true),
    (v_school, v_gs, 'F', 0, 39.99, 0.0, 'Fail', false);

  insert into fee_categories (school_id, code, name, name_ur, kind) values
    (v_school, 'TUITION', 'Tuition Fee', 'ٹیوشن فیس', 'monthly'),
    (v_school, 'ADMISSION', 'Admission Fee', 'داخلہ فیس', 'admission'),
    (v_school, 'ANNUAL', 'Annual Charges', 'سالانہ فیس', 'annual'),
    (v_school, 'EXAM', 'Exam Fee', 'امتحانی فیس', 'exam'),
    (v_school, 'TRANSPORT', 'Transport Fee', 'ٹرانسپورٹ فیس', 'transport'),
    (v_school, 'HOSTEL', 'Hostel Fee', 'ہاسٹل فیس', 'hostel'),
    (v_school, 'MISC', 'Miscellaneous', 'متفرق', 'misc');

  insert into expense_categories (school_id, name, name_ur) values
    (v_school, 'Utilities', 'یوٹیلیٹیز'), (v_school, 'Maintenance', 'مرمت'),
    (v_school, 'Stationery', 'اسٹیشنری'), (v_school, 'Salaries', 'تنخواہیں'),
    (v_school, 'Transport fuel', 'ایندھن'), (v_school, 'Events', 'تقریبات'), (v_school, 'Other', 'دیگر');

  insert into accounts (school_id, campus_id, name, kind, methods) values
    (v_school, null, 'Cash in Hand', 'cash', array['cash']),
    (v_school, null, 'Bank Account', 'bank', array['bank','online_transfer','card','jazzcash','easypaisa','other']);

  insert into leave_types (school_id, name, name_ur, days_per_year, is_paid) values
    (v_school, 'Casual Leave', 'اتفاقی رخصت', 10, true),
    (v_school, 'Sick Leave', 'بیماری کی رخصت', 10, true),
    (v_school, 'Annual Leave', 'سالانہ رخصت', 14, true),
    (v_school, 'Unpaid Leave', 'بلا تنخواہ رخصت', 0, false);

  insert into gl_accounts (school_id, code, name, type) values
    (v_school, '1000', 'Cash and Bank', 'asset'), (v_school, '1100', 'Fees Receivable', 'asset'),
    (v_school, '2000', 'Accounts Payable', 'liability'), (v_school, '2100', 'Advance Fees', 'liability'),
    (v_school, '3000', 'Owner Equity', 'equity'), (v_school, '4000', 'Fee Income', 'income'),
    (v_school, '5000', 'Operating Expenses', 'expense'), (v_school, '5100', 'Salaries', 'expense');

  insert into settings (school_id, key, value) values
    (v_school, 'attendance', '{"school_start":"08:00","late_after":"08:30","half_day_after":"11:00","staff_grace_minutes":10}'),
    (v_school, 'fees', '{"due_day":10,"late_fine":{"type":"flat","amount":200,"grace_days":0,"max":1000},"sibling_discount_percent":0,"voucher_note":"Fee must be paid by the due date to avoid a late fine."}'),
    (v_school, 'payroll', '{"overtime_multiplier":1.5,"hours_per_day":6,"absence_deduction":true}'),
    (v_school, 'library', '{"loan_days":14,"fine_per_day":5,"max_renewals":2}'),
    (v_school, 'exams', '{"default_position_scope":"section"}'),
    (v_school, 'notifications', '{"guardian_channel":"whatsapp","fallback_channel":"sms","language":"en","events":{"absence_alert":true,"fee_receipt":true,"fee_reminder":true,"result_published":true,"admission_confirmation":true,"homework":false,"announcement":true,"event_reminder":true}}'),
    (v_school, 'security', '{"session_timeout_minutes":480,"require_2fa_for_admins":false}');

  -- Message templates (English + Urdu), for WhatsApp / SMS / in-app.
  insert into notification_templates (school_id, key, channel, language, subject, body, provider_template)
  select v_school, t.key, c.channel, l.lang, t.subject,
         case l.lang when 'en' then t.en else t.ur end,
         case when c.channel = 'whatsapp' then t.key else null end
  from (values
    ('fee_reminder','Fee reminder',
      'Dear Parent, the fee voucher of {{student_name}} ({{class_name}}) for {{month}} is due on {{due_date}}. Outstanding: Rs {{amount}}. — {{school_name}}',
      'محترم والدین، {{student_name}} ({{class_name}}) کی {{month}} کی فیس واجب الادا ہے۔ آخری تاریخ {{due_date}}۔ بقایا: روپے {{amount}}۔ — {{school_name}}'),
    ('fee_receipt','Fee receipt',
      'Payment of Rs {{amount}} received for {{student_name}}. Receipt no. {{receipt_no}}. Thank you. — {{school_name}}',
      '{{student_name}} کی فیس روپے {{amount}} موصول ہوئی۔ رسید نمبر {{receipt_no}}۔ شکریہ۔ — {{school_name}}'),
    ('absence_alert','Absence alert',
      'Dear Parent, {{student_name}} ({{class_name}}) was marked absent on {{date}}. — {{school_name}}',
      'محترم والدین، {{student_name}} ({{class_name}}) {{date}} کو غیر حاضر تھا/تھی۔ — {{school_name}}'),
    ('result_published','Result published',
      'The {{exam_name}} result of {{student_name}} has been published. {{percentage}}% — Grade {{grade}}. — {{school_name}}',
      '{{student_name}} کا {{exam_name}} کا نتیجہ جاری ہو گیا ہے۔ {{percentage}}٪ — گریڈ {{grade}}۔ — {{school_name}}'),
    ('admission_confirmation','Admission confirmed',
      'Admission of {{student_name}} is confirmed. Student ID: {{student_code}}. Welcome to {{school_name}}.',
      '{{student_name}} کا داخلہ تصدیق شدہ ہے۔ اسٹوڈنٹ آئی ڈی: {{student_code}}۔ {{school_name}} میں خوش آمدید۔'),
    ('homework','New homework',
      'New homework for {{student_name}}: {{title}} (due {{due_date}}). — {{school_name}}',
      '{{student_name}} کے لیے نیا ہوم ورک: {{title}} (آخری تاریخ {{due_date}})۔ — {{school_name}}'),
    ('announcement','Announcement',
      '{{title}}: {{message}} — {{school_name}}',
      '{{title}}: {{message}} — {{school_name}}'),
    ('event_reminder','Event reminder',
      'Reminder: {{title}} on {{date}}. — {{school_name}}',
      'یاد دہانی: {{title}} بتاریخ {{date}}۔ — {{school_name}}')
  ) as t(key, subject, en, ur),
  (values ('whatsapp'),('sms'),('in_app')) as c(channel),
  (values ('en'),('ur')) as l(lang);

  return v_school;
end $$;
revoke all on function public.bootstrap_school(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_school(text, text, text, text, text) to service_role;
revoke all on function private.apply_role_templates(uuid) from public, anon, authenticated;
grant execute on function private.apply_role_templates(uuid) to service_role;
