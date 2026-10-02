#!/usr/bin/env node
// Creates sign-in accounts for the DEMO school that supabase/seed.sql inserted.
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DEMO_PASSWORD='choose-a-long-one' node scripts/seed-demo-users.mjs
// The password is never stored in the repo: you choose it. Run it only against a demo/staging project —
// anyone who knows these emails and password can sign in. Safe to re-run (existing accounts are skipped).
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, password = process.env.DEMO_PASSWORD;
if (!url || !key || !password) { console.error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD.'); process.exit(1); }
if (password.length < 12) { console.error('DEMO_PASSWORD must be at least 12 characters.'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
const ok = (r, what) => { if (r.error) { console.error(`${what}: ${r.error.message}`); process.exit(1); } return r.data; };

const { data: school } = await db.from('schools').select('id').eq('slug', 'demo').maybeSingle();
if (!school) { console.error('No school with slug "demo". Run supabase/seed.sql first.'); process.exit(1); }
const campuses = ok(await db.from('campuses').select('id,is_main').eq('school_id', school.id), 'campuses');
const main = campuses.find((c) => c.is_main)?.id, all = campuses.map((c) => c.id);

const { data: tch } = await db.from('teacher_assignments').select('staff_id').eq('school_id', school.id).eq('is_class_teacher', true).limit(1);
const { data: gs } = await db.from('guardians').select('id,family_id').eq('school_id', school.id);
const { data: studs } = await db.from('students').select('family_id').eq('school_id', school.id);
const kids = new Map(); for (const s of studs ?? []) kids.set(s.family_id, (kids.get(s.family_id) ?? 0) + 1);
const parent = (gs ?? []).find((g) => kids.get(g.family_id) === 2) ?? (gs ?? [])[0];

const accounts = [
  ['admin@demo.test', 'Demo Administrator', ['super_admin'], all, {}],
  ['principal@demo.test', 'Demo Principal', ['principal'], all, {}],
  ['accountant@demo.test', 'Demo Accountant', ['accountant'], [main], {}],
  ['hr@demo.test', 'Demo HR', ['hr_manager'], [main], {}],
  ['gate@demo.test', 'Gate Staff', ['security_gate'], [main], {}],
  ['teacher@demo.test', 'Demo Teacher', ['class_teacher'], [main], tch?.[0] ? { staff_id: tch[0].staff_id } : {}],
  ['parent@demo.test', 'Demo Parent', ['parent'], [], parent ? { guardian_id: parent.id } : {}],
];
for (const [email, name, roles, camps, link] of accounts) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error?.status === 422) { console.log(`skip   ${email} (already exists)`); continue; }
  if (error) { console.error(`${email}: ${error.message}`); process.exit(1); }
  const p = await db.rpc('provision_user', { p_user: data.user.id, p_school: school.id, p_full_name: name, p_email: email, p_phone: null, p_roles: roles, p_campuses: camps, p_link: link });
  if (p.error) { await db.auth.admin.deleteUser(data.user.id); console.error(`${email}: ${p.error.message}`); process.exit(1); }
  console.log(`create ${email}  [${roles.join(',')}]`);
}
console.log('Done. Sign in with the password you chose.');
