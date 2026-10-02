'use client';
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/lib/actions';
import { Alert } from './primitives';
import { buttonClass, type ButtonStyle } from './button';
import { cn } from './cn';

type Ctx = { errors: Record<string, string>; pending: boolean };
const FormCtx = createContext<Ctx>({ errors: {}, pending: false });
export const useFormCtx = () => useContext(FormCtx);

type ServerAction = (prev: ActionResult<any> | null, fd: FormData) => Promise<ActionResult<any>>;

/**
 * <form> wired to a server action. Keeps what the user typed when validation fails
 * (we submit via onSubmit rather than `action=` so React doesn't auto-reset the fields),
 * shows field-level and form-level errors, and refreshes server data on success.
 */
export function ActionForm({ action, children, className, resetOnSuccess, redirectTo, onDone, id }: {
  action: ServerAction; children: ReactNode; className?: string; resetOnSuccess?: boolean; redirectTo?: string; onDone?: (r: ActionResult<any>) => void; id?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onDone?.(state);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    }
  }, [state, resetOnSuccess, redirectTo, router, onDone]);

  return (
    <form
      ref={ref} id={id} className={cn('space-y-4', className)} noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => run(fd));
      }}
    >
      <FormCtx.Provider value={{ errors: state && !state.ok ? (state.fieldErrors ?? {}) : {}, pending }}>
        <div aria-live="polite" className="space-y-2 empty:hidden">
          {state && !state.ok && <Alert tone="bad">{state.error}</Alert>}
          {state?.ok && state.message && <Alert tone="ok">{state.message}</Alert>}
        </div>
        {children}
      </FormCtx.Provider>
    </form>
  );
}

export function SubmitButton({ children, variant, size, className, name, value, pendingText }: ButtonStyle & { children: ReactNode; name?: string; value?: string; pendingText?: string }) {
  const { pending } = useFormCtx();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={buttonClass({ variant, size, className })}>
      {pending ? (pendingText ?? '…') : children}
    </button>
  );
}

export function Field({ label, name, hint, required, children, className }: { label: string; name: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  const { errors } = useFormCtx();
  const err = errors[name];
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={`f-${name}`} className="block text-sm font-medium">
        {label}{required && <span className="text-bad" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !err && <p className="text-xs text-muted">{hint}</p>}
      {err && <p id={`e-${name}`} className="text-xs text-bad" role="alert">{err}</p>}
    </div>
  );
}

type Opt = { value: string; label: string };
const aria = (err?: string, name?: string) => (err ? { 'aria-invalid': true as const, 'aria-describedby': `e-${name}` } : {});

export function Input({ name, className, ...p }: React.ComponentProps<'input'> & { name: string }) {
  const { errors } = useFormCtx();
  return <input id={`f-${name}`} name={name} className={cn('input', className)} {...aria(errors[name], name)} {...p} />;
}
export function Textarea({ name, className, ...p }: React.ComponentProps<'textarea'> & { name: string }) {
  const { errors } = useFormCtx();
  return <textarea id={`f-${name}`} name={name} className={cn('input', className)} {...aria(errors[name], name)} {...p} />;
}
export function Select({ name, options, placeholder, className, ...p }: React.ComponentProps<'select'> & { name: string; options: Opt[]; placeholder?: string }) {
  const { errors } = useFormCtx();
  return (
    <select id={`f-${name}`} name={name} className={cn('input appearance-none bg-no-repeat pe-8', className)} {...aria(errors[name], name)} {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Checkbox({ name, label, defaultChecked, value = 'true', className }: { name: string; label: string; defaultChecked?: boolean; value?: string; className?: string }) {
  return (
    <label className={cn('flex items-center gap-2.5 text-sm', className)}>
      <input type="hidden" name={name} value="false" />
      <input id={`f-${name}`} type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-4 accent-[var(--brand)]" />
      {label}
    </label>
  );
}

export const TextField = ({ label, hint, required, className, ...p }: React.ComponentProps<'input'> & { name: string; label: string; hint?: string }) =>
  <Field label={label} name={p.name} hint={hint} required={required} className={className}><Input required={false} {...p} /></Field>;
export const SelectField = ({ label, hint, required, className, ...p }: React.ComponentProps<'select'> & { name: string; label: string; options: Opt[]; placeholder?: string; hint?: string }) =>
  <Field label={label} name={p.name} hint={hint} required={required} className={className}><Select {...p} /></Field>;
export const TextAreaField = ({ label, hint, required, className, ...p }: React.ComponentProps<'textarea'> & { name: string; label: string; hint?: string }) =>
  <Field label={label} name={p.name} hint={hint} required={required} className={className}><Textarea {...p} /></Field>;
