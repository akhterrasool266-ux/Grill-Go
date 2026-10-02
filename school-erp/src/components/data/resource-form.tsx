'use client';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { LinkButton } from '@/components/ui/button';
import { saveResource } from '@/app/actions/resources';
import type { FieldType, Option } from '@/lib/resources/types';

export interface FormField {
  name: string; label: string; type: FieldType; required?: boolean; hint?: string; options?: Option[];
  min?: number; max?: number; step?: number; maxLength?: number; value?: string | number | boolean | null; disabled?: boolean;
}

export function ResourceForm({ resource, id, fields, campusOptions, backHref, submitLabel }: {
  resource: string; id?: string; fields: FormField[]; campusOptions?: Option[]; backHref: string; submitLabel?: string;
}) {
  return (
    <ActionForm action={saveResource} redirectTo={backHref} className="space-y-5">
      <input type="hidden" name="__resource" value={resource} />
      {id && <input type="hidden" name="__id" value={id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {campusOptions && campusOptions.length > 0 && (
          <Field label="Campus" name="campus_id" required className="sm:col-span-2">
            <Select name="campus_id" options={campusOptions} placeholder="Select campus…" />
          </Field>
        )}
        {fields.map((f) => <Control key={f.name} f={f} />)}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <SubmitButton>{submitLabel ?? 'Save'}</SubmitButton>
        <LinkButton href={backHref} variant="secondary">Cancel</LinkButton>
      </div>
    </ActionForm>
  );
}

function Control({ f }: { f: FormField }) {
  const wide = f.type === 'textarea';
  const dv = f.value ?? undefined;
  const common = { name: f.name, disabled: f.disabled };
  let control: React.ReactNode;
  switch (f.type) {
    case 'checkbox':
      return <div className="flex items-end pb-2 sm:col-span-1"><Checkbox name={f.name} label={f.label} defaultChecked={Boolean(dv)} /></div>;
    case 'textarea':
      control = <Textarea {...common} defaultValue={(dv as string) ?? ''} maxLength={f.maxLength} rows={3} />; break;
    case 'select':
      control = <Select {...common} defaultValue={(dv as string) ?? ''} options={f.options ?? []} placeholder={f.required ? 'Select…' : '—'} />; break;
    case 'number': case 'money':
      control = <Input {...common} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step ?? (f.type === 'money' ? 1 : 'any')} defaultValue={(dv as number | string) ?? ''} />; break;
    case 'date': control = <Input {...common} type="date" defaultValue={(dv as string) ?? ''} />; break;
    case 'time': control = <Input {...common} type="time" defaultValue={dv ? String(dv).slice(0, 5) : ''} />; break;
    case 'color': control = <Input {...common} type="color" className="h-10 w-20 p-1" defaultValue={(dv as string) ?? '#0b6b5f'} />; break;
    case 'email': control = <Input {...common} type="email" inputMode="email" autoComplete="off" defaultValue={(dv as string) ?? ''} />; break;
    case 'tel': control = <Input {...common} type="tel" inputMode="tel" defaultValue={(dv as string) ?? ''} />; break;
    case 'student': case 'staff':
      control = <Input {...common} className="uppercase" autoCapitalize="characters" autoComplete="off" placeholder={f.type === 'student' ? 'STD-0001' : 'EMP-0001'} defaultValue={(dv as string) ?? ''} />; break;
    default: control = <Input {...common} maxLength={f.maxLength} defaultValue={(dv as string) ?? ''} />;
  }
  return <Field label={f.label} name={f.name} required={f.required} hint={f.hint} className={wide ? 'sm:col-span-2' : undefined}>{control}</Field>;
}
