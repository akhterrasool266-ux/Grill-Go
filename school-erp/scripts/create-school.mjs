#!/usr/bin/env node
// Creates a new school + first campus + default roles + the owner's login, from the command line.
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/create-school.mjs \
//     --name "Bright Future Academy" --slug bright-future --owner-name "Mr Owner" --owner-email owner@example.com [--campus "Main Campus"] [--code MAIN]
// Prints a one-time temporary password. (The /platform page does the same thing from the browser.)
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const name = arg('name'), slug = arg('slug'), ownerName = arg('owner-name'), ownerEmail = arg('owner-email');
const campus = arg('campus', 'Main Campus'), code = arg('code', 'MAIN').toUpperCase();
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
if (!name || !slug || !ownerName || !ownerEmail) { console.error('Required: --name --slug --owner-name --owner-email'); process.exit(1); }
if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) { console.error('--slug: lowercase letters, numbers and dashes.'); process.exit(1); }

const db = createClient(url, key, { auth: { persistSession: false } });
const s = await db.rpc('bootstrap_school', { p_name: name, p_slug: slug, p_short_name: null, p_campus_name: campus, p_campus_code: code });
if (s.error) { console.error('bootstrap_school:', s.error.message); process.exit(1); }
const temp = `${randomBytes(9).toString('base64url')}#${10 + Math.floor(Math.random() * 89)}`;
const u = await db.auth.admin.createUser({ email: ownerEmail, password: temp, email_confirm: true, user_metadata: { full_name: ownerName } });
const undo = async () => { await db.from('schools').delete().eq('id', s.data); };
if (u.error) { await undo(); console.error('createUser:', u.error.message); process.exit(1); }
const { data: camps } = await db.from('campuses').select('id').eq('school_id', s.data);
const p = await db.rpc('provision_user', { p_user: u.data.user.id, p_school: s.data, p_full_name: ownerName, p_email: ownerEmail, p_phone: null, p_roles: ['school_owner'], p_campuses: camps.map((c) => c.id) });
if (p.error) { await db.auth.admin.deleteUser(u.data.user.id); await undo(); console.error('provision_user:', p.error.message); process.exit(1); }
await db.from('profiles').update({ preferences: { must_change_password: true } }).eq('id', u.data.user.id);
console.log(`School created: ${name} (/site/${slug})\nOwner login:    ${ownerEmail}\nTemp password:  ${temp}\nShare the password privately; the owner must change it at first sign-in.`);
