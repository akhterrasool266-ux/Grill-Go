'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import type { NavLinkGroup } from './nav-links';

/** Full menu sheet for phones. Opened by the "More" tab (a checkbox, so it works before hydration). */
export function MobileMenu({ groups, title, closeLabel }: { groups: NavLinkGroup[]; title: string; closeLabel: string }) {
  const box = useRef<HTMLInputElement>(null);
  const path = usePathname();
  useEffect(() => { if (box.current) box.current.checked = false; }, [path]);
  return (
    <div className="lg:hidden">
      <input ref={box} id="more-menu" type="checkbox" className="peer sr-only" />
      <label htmlFor="more-menu" className="no-print pointer-events-none fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity peer-checked:pointer-events-auto peer-checked:opacity-100" aria-hidden />
      <div className="no-print fixed inset-x-0 bottom-0 z-50 max-h-[82vh] translate-y-full overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform peer-checked:translate-y-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <label htmlFor="more-menu" className="cursor-pointer rounded-lg p-2 hover:bg-surface-2" aria-label={closeLabel}><Icon name="X" /></label>
        </div>
        {groups.map((g, gi) => (
          <div key={gi} className="mb-4">
            {g.label && <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label}</p>}
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((i) => (
                <Link key={i.href} href={i.href} className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-2 p-2 text-center text-xs font-medium">
                  <Icon name={i.icon} className="size-5 text-brand" /><span className="leading-tight">{i.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
