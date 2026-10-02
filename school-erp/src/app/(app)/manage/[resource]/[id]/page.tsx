import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ResourceForm, type FormField } from '@/components/data/resource-form';
import { ConfirmAction } from '@/components/ui/confirm-form';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requireUser } from '@/lib/auth/session';
import { fetchOptions, needs } from '@/lib/resources/engine';
import { getResource } from '@/lib/resources/registry';
import { createClient } from '@/lib/supabase/server';
import { deleteResource } from '@/app/actions/resources';

export const metadata: Metadata = { title: 'Edit' };

export default async function EditResourcePage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  const def = getResource(resource);
  if (!def || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireUser();
  if (!needs(ctx, def, 'edit') || def.canEdit === false) redirect('/forbidden');
  const sb = await createClient();
  const { data: row } = await sb.from(def.table).select('*').eq('id', id).maybeSingle();
  if (!row) notFound();
  const campus = def.campusScoped ? (row.campus_id as string) : await currentCampus(ctx);

  // student / staff pickers show the code of the linked record
  const codeFor: Record<string, string> = {};
  for (const f of def.fields) {
    if ((f.type === 'student' || f.type === 'staff') && row[f.name]) {
      const { data } = await sb.from(f.type === 'student' ? 'students' : 'staff').select(f.type === 'student' ? 'student_code' : 'employee_code').eq('id', row[f.name]).maybeSingle();
      codeFor[f.name] = String((data as any)?.student_code ?? (data as any)?.employee_code ?? '');
    }
  }
  const fields: FormField[] = await Promise.all(def.fields.map(async (f) => ({
    name: f.name, label: f.label, type: f.type, required: f.required, hint: f.hint, min: f.min, max: f.max, step: f.step, maxLength: f.maxLength,
    options: f.type === 'select' ? await fetchOptions(sb, f, campus) : undefined,
    value: f.type === 'student' || f.type === 'staff' ? codeFor[f.name] ?? '' : (row[f.name] as string | number | boolean | null),
    disabled: f.createOnly,
  })));
  const canDelete = def.canDelete !== false && needs(ctx, def, 'delete');
  return (
    <>
      <PageHeader title={`Edit ${def.singular.toLowerCase()}`} back={{ href: `/manage/${def.key}`, label: def.title }}
        actions={canDelete ? <ConfirmAction action={deleteResource} data={{ resource: def.key, id }} title={`Delete this ${def.singular.toLowerCase()}?`} message="This cannot be undone. Records that depend on it may stop you." confirmLabel="Delete">Delete</ConfirmAction> : undefined} />
      <Card><CardBody>
        <ResourceForm resource={def.key} id={id} fields={fields} backHref={`/manage/${def.key}`} />
      </CardBody></Card>
    </>
  );
}
