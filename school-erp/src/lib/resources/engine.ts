import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ctx } from '@/lib/auth/session';
import * as v from '@/lib/validation/common';
import type { FieldDef, Option, ResourceDef } from './types';

/** Resolve "a.b.c" in nested row data. Arrays join with commas. */
export function getPath(row: any, path: string): unknown {
  const val = path.split('.').reduce((o, k) => (o == null ? o : o[k]), row);
  return Array.isArray(val) ? val.join(', ') : val;
}

function fieldSchema(f: FieldDef): z.ZodType {
  const req = !!f.required;
  switch (f.type) {
    case 'text': return req ? v.text(f.label, f.maxLength ?? 200) : v.optText(f.maxLength ?? 500);
    case 'textarea': return req ? v.text(f.label, f.maxLength ?? 2000) : v.optText(f.maxLength ?? 2000);
    case 'number': case 'money': return req ? v.num(f.label, f.min ?? 0, f.max ?? 1e9) : v.optNum(f.min ?? 0, f.max ?? 1e9);
    case 'date': return req ? v.date(f.label) : v.optDate();
    case 'time': return req ? v.time(f.label) : v.optTime();
    case 'checkbox': return v.bool();
    case 'email': return req ? v.text(f.label, 160).pipe(z.string().email('Enter a valid email address.')) : v.optEmail();
    case 'tel': return req ? v.phone(f.label) : v.optPhone();
    case 'color': return z.preprocess((x) => (x === '' ? undefined : x), z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour.').optional());
    case 'student': case 'staff': return v.text(f.label, 30);
    case 'select':
      if (f.relation) return req ? v.uuid(f.label) : v.optUuid();
      return req ? z.enum((f.options ?? []).map((o) => o.value) as [string, ...string[]], { error: `${f.label} is required.` })
        : z.preprocess((x) => (x === '' ? undefined : x), z.enum((f.options ?? []).map((o) => o.value) as [string, ...string[]]).optional());
  }
}

/** Zod schema for the editable fields of a resource. */
export function buildSchema(def: ResourceDef, mode: 'create' | 'update') {
  const shape: Record<string, z.ZodType> = {};
  for (const f of def.fields) {
    if (mode === 'update' && f.createOnly) continue;
    shape[f.name] = fieldSchema(f);
  }
  // routing keys travel with the form; they are checked again in the action
  shape.__resource = z.string();
  shape.__id = v.optUuid();
  shape.campus_id = v.optUuid();
  return z.object(shape);
}

/** Turns "STD-0001" / "EMP-0001" typed into a form into the row id (RLS decides what the user can find). */
export async function resolveCodes(sb: SupabaseClient, def: ResourceDef, data: Record<string, any>) {
  for (const f of def.fields) {
    if (!(f.name in data) || (f.type !== 'student' && f.type !== 'staff')) continue;
    const table = f.type === 'student' ? 'students' : 'staff';
    const codeCol = f.type === 'student' ? 'student_code' : 'employee_code';
    const { data: row } = await sb.from(table).select('id,campus_id').eq(codeCol, String(data[f.name]).trim().toUpperCase()).maybeSingle();
    if (!row) throw { code: 'X', message: f.type === 'student' ? 'student_not_found' : 'staff_not_found' };
    data[f.name] = row.id;
    if (def.campusScoped && !data.campus_id) data.campus_id = row.campus_id;   // the record belongs to the student's campus
  }
}

export async function fetchOptions(sb: SupabaseClient, f: FieldDef, campus: string | null): Promise<Option[]> {
  if (f.options) return f.options;
  const r = f.relation;
  if (!r) return [];
  let q = sb.from(r.table).select(r.select ?? 'id,name').limit(500);
  if (r.campusScoped && campus) q = q.eq('campus_id', campus);
  for (const [k, val] of Object.entries(r.eq ?? {})) q = q.eq(k, val as never);
  if (r.order) { const [c, dir] = r.order.split('.'); q = q.order(c!, { ascending: dir !== 'desc' }); }
  const { data } = await q;
  return (data ?? []).map((row: any) => ({ value: row.id as string, label: r.label(row) }));
}

export function viewPerm(def: ResourceDef) { return `${def.perm}.view`; }
export function needs(ctx: Ctx, def: ResourceDef, action: 'view' | 'create' | 'edit' | 'delete') {
  const ok = ctx.permissions.includes(`${def.perm}.${action}`);
  return ok && (!def.alsoNeeds || ctx.permissions.includes(def.alsoNeeds));
}
