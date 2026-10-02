import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApplyForm } from '@/components/data/apply-form';
import { getApplyOptions, getSite } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Apply online' };

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) notFound();
  const open = site.content.admissions?.open !== false;
  const classes = await getApplyOptions(site.school.id);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/site/${slug}`} className="text-sm text-muted hover:underline">← {site.school.name}</Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Apply for admission</h1>
      {open
        ? <><p className="mb-6 text-sm text-muted">Fill in this form and the school office will contact you. Submitting it does not guarantee a seat.</p>
            <ApplyForm slug={slug} campuses={site.campuses.map((c) => ({ value: c.id, label: c.name }))} classes={classes.map((c) => ({ value: c.id, label: c.name, campus: c.campus_id }))} /></>
        : <p className="rounded-xl border border-line p-4 text-sm">Online applications are closed right now. Please contact the school office.</p>}
    </div>
  );
}
