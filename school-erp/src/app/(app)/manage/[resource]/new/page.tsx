import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ResourceForm, type FormField } from '@/components/data/resource-form';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requireUser } from '@/lib/auth/session';
import { fetchOptions, needs } from '@/lib/resources/engine';
import { getResource } from '@/lib/resources/registry';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ resource: string }> }): Promise<Metadata> {
  const d = getResource((await params).resource);
  return { title: d ? `New ${d.singular.toLowerCase()}` : 'New' };
}

export default async function NewResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const def = getResource(resource);
  if (!def) notFound();
  const ctx = await requireUser();
  if (!needs(ctx, def, 'create') || def.canCreate === false) redirect('/forbidden');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const fields: FormField[] = await Promise.all(def.fields.map(async (f) => ({
    name: f.name, label: f.label, type: f.type, required: f.required, hint: f.hint, min: f.min, max: f.max, step: f.step, maxLength: f.maxLength,
    options: f.type === 'select' ? await fetchOptions(sb, f, campus) : undefined, value: f.default ?? null,
  })));
  const needCampus = def.campusScoped && !campus && ctx.campuses.length > 1;
  return (
    <>
      <PageHeader title={`New ${def.singular.toLowerCase()}`} back={{ href: `/manage/${def.key}`, label: def.title }} />
      <Card><CardBody>
        <ResourceForm resource={def.key} fields={fields} backHref={`/manage/${def.key}`} submitLabel={`Add ${def.singular.toLowerCase()}`}
          campusOptions={needCampus ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} />
      </CardBody></Card>
    </>
  );
}
