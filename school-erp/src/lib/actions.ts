import 'server-only';
import type { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCtx, can, type Ctx } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, newRef } from '@/lib/errors';
import { fieldErrorsOf, formToObject, type FieldErrors } from '@/lib/validation/common';
import { rateLimit } from '@/lib/rate-limit';

export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export interface ActionOptions<I> {
  /** User needs ANY of these permissions (may depend on the raw input). Omit for "any signed-in school user". */
  permission?: string | string[] | ((raw: any) => string | string[]);
  schema?: z.ZodType<I, unknown> | ((raw: any) => z.ZodType<I, unknown>);
  rateLimit?: { key: string; limit: number; windowMs: number };
}
type HandlerResult<O> = void | { message?: string; data?: O };
export type Handler<I, O> = (a: { ctx: Ctx; sb: SupabaseClient; input: I }) => Promise<HandlerResult<O>>;

const isControlFlow = (e: unknown) =>
  typeof e === 'object' && e !== null && 'digest' in e && typeof (e as { digest: unknown }).digest === 'string' &&
  /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test((e as { digest: string }).digest);

async function execute<I, O>(opts: ActionOptions<I>, raw: unknown, handler: Handler<I, O>): Promise<ActionResult<O>> {
  try {
    const ctx = await getCtx();
    if (!ctx) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const permOpt = typeof opts.permission === 'function' ? opts.permission(raw) : opts.permission;
    const perms = permOpt ? ([] as string[]).concat(permOpt) : [];
    if (perms.length && !can(ctx, ...perms)) return { ok: false, error: "You don't have permission to do that." };
    if (opts.rateLimit) {
      const r = rateLimit(`${opts.rateLimit.key}:${ctx.userId}`, opts.rateLimit.limit, opts.rateLimit.windowMs);
      if (!r.ok) return { ok: false, error: `Too many attempts. Please wait ${r.retryAfter} seconds.` };
    }
    let input = raw as I;
    if (opts.schema) {
      const schema = typeof opts.schema === 'function' ? opts.schema(raw) : opts.schema;
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fe = fieldErrorsOf(parsed.error);
        const first = Object.values(fe)[0] ?? 'Please check the form.';
        return { ok: false, error: first, fieldErrors: fe };
      }
      input = parsed.data;
    }
    const sb = await createClient();
    const out = await handler({ ctx, sb, input });
    return { ok: true, ...(out ?? {}) };
  } catch (e) {
    if (isControlFlow(e)) throw e;
    return { ok: false, error: friendlyError(e, newRef()) };
  }
}

/** For `<form action={…}>` with useActionState: (prevState, FormData) => result. */
export function formAction<I, O = unknown>(opts: ActionOptions<I>, handler: Handler<I, O>) {
  return async (_prev: ActionResult<O> | null, fd: FormData): Promise<ActionResult<O>> =>
    execute(opts, formToObject(fd), handler);
}

/** For direct calls from client components: (input) => result. */
export function callAction<I, O = unknown>(opts: ActionOptions<I>, handler: Handler<I, O>) {
  return async (input: unknown): Promise<ActionResult<O>> => execute(opts, input, handler);
}

/** Throws a Supabase error so `execute` can translate it. */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
