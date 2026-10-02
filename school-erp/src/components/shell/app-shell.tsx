import Link from 'next/link';
import type { ReactNode } from 'react';
import { setLanguage } from '@/app/actions/shell';
import { Icon } from '@/components/ui/icon';
import { initials } from '@/lib/format';
import { bottomNav, navFor } from '@/lib/nav';
import { currentCampus, type Ctx } from '@/lib/auth/session';
import { getT } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { SideNav, BottomNav, type NavLinkGroup } from './nav-links';
import { MobileMenu } from './mobile-menu';
import { CampusSwitcher, ThemeToggle } from './topbar-controls';
import { OfflineProvider } from '@/components/offline/context';
import { OfflineStatus } from '@/components/offline/status';
import { SignOutForm } from '@/components/offline/signout';

export async function AppShell({ ctx, children }: { ctx: Ctx; children: ReactNode }) {
  const { t, lang } = await getT();
  const sb = await createClient();
  const [campus, unread] = await Promise.all([
    currentCampus(ctx),
    sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null).then((r) => r.count ?? 0),
  ]);
  const groups = navFor(ctx);
  const linkGroups: NavLinkGroup[] = groups.map((g) => ({ label: g.label ? t(g.label) : undefined, items: g.items.map((i) => ({ href: i.href, label: t(i.label), icon: i.icon })) }));
  const bottom = bottomNav(groups).map((i) => ({ href: i.href, label: t(i.label), icon: i.icon }));
  const canSearch = ctx.permissions.some((p) => /^(students|staff|fees|payments|admissions|exams|library|transport|guardians)\.view$/.test(p));

  return (
    <OfflineProvider userId={ctx.userId}>
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 py-4">
          <span className="grid size-9 place-items-center rounded-[10px] bg-brand text-sm font-bold text-brand-fg">{initials(ctx.school.short_name ?? ctx.school.name)}</span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{ctx.school.short_name ?? ctx.school.name}</span><span className="block text-xs text-muted">{t('app.name')}</span></span>
        </Link>
        <div className="flex-1 overflow-y-auto px-3 pb-6"><SideNav groups={linkGroups} /></div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-5">
          <Link href="/" className="me-1 flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-xs font-bold text-brand-fg">{initials(ctx.school.short_name ?? ctx.school.name)}</span>
          </Link>
          {canSearch ? (
            <form action="/search" className="relative hidden max-w-md flex-1 sm:block" role="search">
              <Icon name="Search" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input name="q" type="search" placeholder={t('top.search')} aria-label={t('common.search')} className="input h-9 min-h-0 ps-9 text-sm" />
            </form>
          ) : <div className="flex-1" />}
          <div className="ms-auto flex items-center gap-1">
            <OfflineStatus userId={ctx.userId} />
            {canSearch && <Link href="/search" aria-label={t('common.search')} className="rounded-lg p-2 text-muted hover:bg-surface-2 sm:hidden"><Icon name="Search" /></Link>}
            <CampusSwitcher campuses={ctx.campuses} current={campus} allLabel={t('common.allCampuses')} />
            <form action={setLanguage}>
              <input type="hidden" name="lang" value={lang === 'ur' ? 'en' : 'ur'} />
              <button className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink" aria-label={t('top.language')} title={t('top.language')}>{lang === 'ur' ? 'EN' : 'اردو'}</button>
            </form>
            <ThemeToggle labels={{ light: t('top.light'), dark: t('top.dark'), system: t('top.system'), theme: t('top.theme') }} />
            <Link href="/notifications" className="relative rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label={`${t('nav.notifications')}${unread ? ` (${unread})` : ''}`}>
              <Icon name="Bell" />
              {unread > 0 && <span className="absolute end-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <details className="relative">
              <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand [&::-webkit-details-marker]:hidden" aria-label="Account">{initials(ctx.profile.full_name)}</summary>
              <div className="absolute end-0 mt-2 w-60 rounded-xl border border-line bg-surface p-2 shadow-xl">
                <div className="px-3 py-2"><p className="truncate text-sm font-semibold">{ctx.profile.full_name}</p><p className="truncate text-xs text-muted">{ctx.profile.email}</p></div>
                <Link href="/settings/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-2">{t('common.edit')} profile</Link>
                <SignOutForm><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-bad hover:bg-bad-soft"><Icon name="LogOut" className="size-4" />{t('auth.signOut')}</button></SignOutForm>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      <BottomNav items={bottom} moreLabel={t('common.more')} />
      <MobileMenu groups={linkGroups} title={t('common.more')} closeLabel={t('common.close')} />
    </div>
    </OfflineProvider>
  );
}
