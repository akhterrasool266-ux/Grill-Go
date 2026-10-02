'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import { getResource } from '@/lib/resources/registry';
import { buildSchema, resolveCodes, needs } from '@/lib/resources/engine';

const keyOf = (raw: any) => String(raw?.__resource ?? '');
const defOf = (raw: any) => {
  const d = getResource(keyOf(raw));
  if (!d) throw { code: 'X', message: 'not_found' };
  return d;
};

/** Create or update a row of any registered resource. Permission, validation and the campus are all decided here, server-side. */
export const saveResource = formAction<any>({
  permission: (raw) => { const d = getResource(keyOf(raw)); return d ? [`${d.perm}.${raw.__id ? 'edit' : 'create'}`] : ['__none__']; },
  schema: (raw) => buildSchema(defOf(raw), raw.__id ? 'update' : 'create') as never,
}, async ({ ctx, sb, input }) => {
  const def = defOf({ __resource: input.__resource });
  const id: string | undefined = input.__id;
  if (!needs(ctx, def, id ? 'edit' : 'create')) throw { code: '42501', message: 'permission_denied' };
  const data: Record<string, any> = {};
  for (const f of def.fields) if (f.name in input && !(id && f.createOnly)) data[f.name] = input[f.name];

  if (def.campusScoped && !id) {
    const campus = (await currentCampus(ctx)) ?? input.campus_id;
    if (campus && ctx.campuses.some((c) => c.id === campus)) data.campus_id = campus;
  }
  await resolveCodes(sb, def, data);
  if (def.campusScoped && !id && !data.campus_id) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };

  if (id) {
    // optional fields that were cleared become NULL
    for (const f of def.fields) if (!f.createOnly && data[f.name] === undefined && f.type !== 'checkbox') data[f.name] = null;
    check(await sb.from(def.table).update(data).eq('id', id).select('id').single());
  } else {
    const row = { ...(def.insertDefaults ?? {}), ...Object.fromEntries(Object.entries(data).filter(([, x]) => x !== undefined)) };
    check(await sb.from(def.table).insert(row).select('id').single());
  }
  revalidatePath(`/manage/${def.key}`);
  return { message: id ? 'Changes saved.' : `${def.singular} added.` };
});

export const deleteResource = callAction<{ resource: string; id: string }>({
  permission: (raw) => { const d = getResource(keyOf({ __resource: raw?.resource })); return d ? [`${d.perm}.delete`] : ['__none__']; },
  schema: z.object({ resource: z.string(), id: z.string().uuid() }),
}, async ({ ctx, sb, input }) => {
  const def = getResource(input.resource);
  if (!def || def.canDelete === false || !needs(ctx, def, 'delete')) throw { code: '42501', message: 'permission_denied' };
  check(await sb.from(def.table).delete().eq('id', input.id).select('id').single());
  revalidatePath(`/manage/${def.key}`);
  return { message: 'Deleted.' };
});

export const runRowRpc = callAction<{ resource: string; index: number; id: string }>({
  schema: z.object({ resource: z.string(), index: z.number().int().min(0), id: z.string().uuid() }),
}, async ({ ctx, sb, input }) => {
  const def = getResource(input.resource);
  const rpc = def?.rowRpcs?.[input.index];
  if (!def || !rpc) throw { code: 'X', message: 'not_found' };
  if (rpc.perm && !ctx.permissions.includes(rpc.perm)) throw { code: '42501', message: 'permission_denied' };
  if (!needs(ctx, def, 'view')) throw { code: '42501', message: 'permission_denied' };
  const row = check(await sb.from(def.table).select(def.select ?? '*').eq('id', input.id).single());
  if (rpc.when && !rpc.when(row)) throw { code: 'X', message: 'This action is no longer available for this record.' };
  check(await sb.rpc(rpc.fn, rpc.args(row)));
  revalidatePath(`/manage/${def.key}`);
  return { message: `${rpc.label}: done.` };
});
