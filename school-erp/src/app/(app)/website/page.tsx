import type { Metadata } from 'next';
import Link from 'next/link';
import { CmsForm } from '@/components/data/website-forms';
import { LinkButton } from '@/components/ui/button';
import { Alert, Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CMS_KEYS } from '@/lib/site';

export const metadata: Metadata = { title: 'Website' };
const TITLES: Record<string, string> = { hero: 'Top banner', about: 'About us', principal_message: "Principal's message", contact: 'Contact details', admissions: 'Online admissions', social: 'Social links' };

export default async function WebsitePage() {
  const ctx = await requirePerm('cms.view');
  const sb = await createClient();
  const { data } = await sb.from('cms_content').select('key,value');
  const v = (k: string) => ((data ?? []).find((r: any) => r.key === k)?.value ?? {}) as Record<string, any>;
  const edit = can(ctx, 'cms.edit');
  const url = `/site/${ctx.school.slug}`;
  return (
    <>
      <PageHeader title="Public website" description="Your school's public page and online admission form." actions={<><LinkButton variant="secondary" href="/manage/cms-notices">Notices</LinkButton><LinkButton variant="secondary" href="/manage/cms-teachers">Faculty</LinkButton><LinkButton href={url}>View website</LinkButton></>} />
      <Alert tone="info">Your website address is <Link className="font-medium underline" href={url}>{url}</Link>. Add your own domain through your hosting provider (see README). Online applications arrive in Admissions.</Alert>
      {!edit && <div className="mt-4"><Alert tone="info">You can view but not edit the website content.</Alert></div>}
      <div className="mt-4 space-y-4">
        {CMS_KEYS.map((k) => <Card key={k}><CardHeader title={TITLES[k]!} /><CardBody>{edit ? <CmsForm k={k} v={v(k)} /> : <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(v(k), null, 1)}</pre>}</CardBody></Card>)}
      </div>
    </>
  );
}
