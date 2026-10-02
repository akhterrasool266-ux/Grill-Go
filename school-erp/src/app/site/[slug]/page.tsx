import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSite, safeUrl } from '@/lib/site';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await getSite((await params).slug);
  return s ? { title: s.school.name, description: s.content.hero?.subtitle ?? undefined } : {};
}

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mx-auto max-w-5xl px-4 py-10"><h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>{children}</section>
);

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) notFound();
  const { school, content: c, notices, teachers, campuses } = site;
  const admOpen = c.admissions?.open !== false;
  const links = (['facebook', 'instagram', 'youtube'] as const).map((k) => [k, safeUrl(c.social?.[k])] as const).filter(([, u]) => u);
  return (
    <div className="min-h-screen bg-surface text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="font-semibold">{school.name}</span>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#about" className="hidden sm:inline hover:underline">About</a>
            <a href="#notices" className="hidden sm:inline hover:underline">Notices</a>
            <a href="#faculty" className="hidden sm:inline hover:underline">Faculty</a>
            <a href="#contact" className="hover:underline">Contact</a>
            {admOpen && <Link href={`/site/${school.slug}/apply`} className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white">Apply online</Link>}
          </nav>
        </div>
      </header>
      <div className="bg-brand-soft"><div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.hero?.title || school.name}</h1>
        {c.hero?.subtitle && <p className="mt-3 max-w-2xl text-lg text-muted">{c.hero.subtitle}</p>}
        {admOpen && <Link href={`/site/${school.slug}/apply`} className="mt-6 inline-block rounded-lg bg-brand px-5 py-3 font-medium text-white">Apply for admission</Link>}
      </div></div>
      {c.about?.text && <Section id="about" title="About us"><p className="max-w-3xl whitespace-pre-line leading-relaxed">{c.about.text}</p></Section>}
      {c.principal_message?.text && <Section id="principal" title="Principal's message"><blockquote className="max-w-3xl whitespace-pre-line border-s-4 border-brand ps-4 leading-relaxed">{c.principal_message.text}</blockquote>{c.principal_message.name && <p className="mt-2 text-sm text-muted">— {c.principal_message.name}</p>}</Section>}
      {admOpen && c.admissions?.note && <Section id="admissions" title="Admissions"><p className="max-w-3xl whitespace-pre-line">{c.admissions.note}</p></Section>}
      {notices.length > 0 && <Section id="notices" title="Notices"><ul className="divide-y divide-line rounded-xl border border-line">{notices.map((n) => <li key={n.id} className="p-4"><p className="font-medium">{n.title}</p><p className="text-xs text-muted">{fmtDate(n.published_at)}</p>{n.body && <p className="mt-1 whitespace-pre-line text-sm">{n.body}</p>}</li>)}</ul></Section>}
      {teachers.length > 0 && <Section id="faculty" title="Our faculty"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{teachers.map((t) => <div key={t.id} className="rounded-xl border border-line p-4"><p className="font-medium">{t.name}</p>{t.designation && <p className="text-sm text-muted">{t.designation}</p>}{t.bio && <p className="mt-2 text-sm">{t.bio}</p>}</div>)}</div></Section>}
      <Section id="contact" title="Contact">
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          {campuses.map((cp) => <div key={cp.id} className="rounded-xl border border-line p-4"><p className="font-medium">{cp.name}</p>{cp.address && <p>{cp.address}</p>}{cp.phone && <p><a className="text-brand hover:underline" href={`tel:${String(cp.phone).replace(/[^\d+]/g, '')}`}>{cp.phone}</a></p>}</div>)}
          {(c.contact?.phone || c.contact?.email || c.contact?.hours || c.contact?.address) && <div className="rounded-xl border border-line p-4">{c.contact?.address && <p>{c.contact.address}</p>}{c.contact?.phone && <p>{c.contact.phone}</p>}{c.contact?.email && <p>{c.contact.email}</p>}{c.contact?.hours && <p className="text-muted">{c.contact.hours}</p>}</div>}
        </div>
        {links.length > 0 && <p className="mt-4 flex gap-4 text-sm">{links.map(([k, u]) => <a key={k} href={u!} rel="noopener noreferrer nofollow" target="_blank" className="text-brand capitalize hover:underline">{k}</a>)}</p>}
      </Section>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">© {new Date().getFullYear()} {school.name}</footer>
    </div>
  );
}
