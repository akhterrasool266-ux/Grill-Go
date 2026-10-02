'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/components/ui/cn';

export interface NavLinkItem { href: string; label: string; icon: IconName }
export interface NavLinkGroup { label?: string; items: NavLinkItem[] }

function isActive(path: string, href: string, all: string[]) {
  if (path === href) return true;
  if (!path.startsWith(href + '/')) return false;
  // don't highlight /fees when a more specific sibling (/fees/collect) matches
  return !all.some((h) => h !== href && h.length > href.length && (path === h || path.startsWith(h + '/')));
}

export function SideNav({ groups }: { groups: NavLinkGroup[] }) {
  const path = usePathname();
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  return (
    <nav aria-label="Main" className="space-y-5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = isActive(path, i.href, all);
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
                    <Icon name={i.icon} />{i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function BottomNav({ items, moreLabel }: { items: NavLinkItem[]; moreLabel: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((i) => {
          const active = path === i.href || path.startsWith(i.href + '/');
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? 'page' : undefined}
                className={cn('flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-brand' : 'text-muted')}>
                <Icon name={i.icon} className="size-5" /><span className="max-w-full truncate px-1">{i.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <label htmlFor="more-menu" className="flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted">
            <Icon name="Menu" className="size-5" /><span>{moreLabel}</span>
          </label>
        </li>
      </ul>
    </nav>
  );
}
