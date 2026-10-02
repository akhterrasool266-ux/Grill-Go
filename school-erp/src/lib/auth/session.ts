import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { PermissionCode } from './catalogue';

export interface Campus { id: string; name: string; code: string }
export interface Ctx {
  userId: string;
  platformAdmin: boolean;
  profile: { id: string; full_name: string; email: string | null; phone: string | null; language: 'en' | 'ur'; theme: string; avatar_path: string | null; preferences: Record<string, unknown>; school_id: string };
  school: { id: string; name: string; short_name: string | null; slug: string; logo_path: string | null; timezone: string; currency: string; default_language: 'en' | 'ur'; date_format: string };
  roles: string[];
  permissions: string[];
  campuses: Campus[];
  staffId: string | null;
  studentIds: string[];
}

export const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Raw identity: null if not logged in. Cached per request. */
export const getIdentity = cache(async () => {
  if (!configured()) return null;
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: raw } = await sb.rpc('my_context');
  return raw as null | {
    user_id: string; platform_admin: boolean; profile: Ctx['profile'] | null; school: Ctx['school'] | null;
    roles: string[]; permissions: string[]; campuses: Campus[]; staff_id: string | null; student_ids: string[];
  };
});

/** School context, or null when logged out / no school profile (never redirects — use in server actions). */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const id = await getIdentity();
  if (!id || !id.profile || !id.school) return null;
  return {
    userId: id.user_id, platformAdmin: id.platform_admin, profile: id.profile, school: id.school,
    roles: id.roles, permissions: id.permissions, campuses: id.campuses, staffId: id.staff_id, studentIds: id.student_ids,
  };
});

/** Full school context for the logged-in user. Redirects to /login if absent. */
export const requireUser = cache(async (): Promise<Ctx> => {
  const id = await getIdentity();
  if (!id) redirect('/login');
  if (!id.profile || !id.school) {
    if (id.platform_admin) redirect('/platform');
    redirect('/login?error=no_profile');
  }
  return {
    userId: id.user_id, platformAdmin: id.platform_admin, profile: id.profile, school: id.school,
    roles: id.roles, permissions: id.permissions, campuses: id.campuses, staffId: id.staff_id, studentIds: id.student_ids,
  };
});

export function can(ctx: Pick<Ctx, 'permissions'>, ...codes: (PermissionCode | string)[]): boolean {
  return codes.some((c) => ctx.permissions.includes(c));
}
export function canAll(ctx: Pick<Ctx, 'permissions'>, ...codes: (PermissionCode | string)[]): boolean {
  return codes.every((c) => ctx.permissions.includes(c));
}
export const hasRole = (ctx: Pick<Ctx, 'roles'>, ...r: string[]) => r.some((x) => ctx.roles.includes(x));

/** Page-level guard. Authorisation is ALSO enforced by RLS — this is for UX and defence in depth. */
export async function requirePerm(...codes: (PermissionCode | string)[]): Promise<Ctx> {
  const ctx = await requireUser();
  if (!can(ctx, ...codes)) redirect('/forbidden');
  return ctx;
}

export async function requirePlatformAdmin() {
  const id = await getIdentity();
  if (!id) redirect('/login');
  if (!id.platform_admin) redirect('/forbidden');
  return id;
}

/** Campus chosen in the top bar. null = every campus the user may access. */
export async function currentCampus(ctx: Ctx): Promise<string | null> {
  const store = await cookies();
  const v = store.get('erp_campus')?.value;
  if (v && ctx.campuses.some((c) => c.id === v)) return v;
  return ctx.campuses.length === 1 ? ctx.campuses[0]!.id : null;
}

/** Campus a NEW record should be created in: selected campus, or the only one available. */
export async function writeCampus(ctx: Ctx): Promise<string | null> {
  return currentCampus(ctx);
}

/** Where each kind of user lands after login. */
export function homeFor(ctx: Pick<Ctx, 'roles' | 'permissions'>): string {
  if (hasRole(ctx, 'parent')) return '/portal/parent';
  if (hasRole(ctx, 'student')) return '/portal/student';
  if (hasRole(ctx, 'driver')) return '/transport/my-route';
  if (hasRole(ctx, 'security_gate')) return '/attendance/scan';
  const dashboardish = can(ctx, 'students.view') && can(ctx, 'classes.all');
  if (!dashboardish && hasRole(ctx, 'teacher', 'class_teacher')) return '/portal/teacher';
  return '/dashboard';
}
