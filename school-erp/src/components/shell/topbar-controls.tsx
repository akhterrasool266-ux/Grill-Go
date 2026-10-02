'use client';
import { useEffect, useState } from 'react';
import { setCampus, setTheme } from '@/app/actions/shell';
import { Icon } from '@/components/ui/icon';

export function CampusSwitcher({ campuses, current, allLabel }: { campuses: { id: string; name: string }[]; current: string | null; allLabel: string }) {
  if (campuses.length <= 1) return campuses[0] ? <span className="hidden max-w-[10rem] truncate text-sm text-muted md:inline">{campuses[0].name}</span> : null;
  return (
    <form action={setCampus}>
      <label className="sr-only" htmlFor="campus-switch">Campus</label>
      <select id="campus-switch" name="campus" defaultValue={current ?? ''} onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input h-9 max-w-[7.5rem] min-h-0 ps-2 pe-1 py-0 text-sm sm:max-w-[14rem] sm:ps-3">
        <option value="">{allLabel}</option>
        {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </form>
  );
}

type Pref = 'light' | 'dark' | 'system';
export function ThemeToggle({ labels }: { labels: { light: string; dark: string; system: string; theme: string } }) {
  const [pref, setPref] = useState<Pref>('system');
  useEffect(() => { setPref((document.documentElement.dataset.pref as Pref) || 'system'); }, []);
  function apply(p: Pref) {
    setPref(p);
    const dark = p === 'dark' || (p === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.pref = p;
    document.cookie = `erp_theme=${p}; path=/; max-age=31536000; samesite=lax`;
    void setTheme(p);
  }
  const next: Pref = pref === 'light' ? 'dark' : pref === 'dark' ? 'system' : 'light';
  const icon = pref === 'light' ? 'Sun' : pref === 'dark' ? 'Moon' : 'Monitor';
  return (
    <button type="button" onClick={() => apply(next)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
      aria-label={`${labels.theme}: ${labels[pref]}`} title={`${labels.theme}: ${labels[pref]}`}>
      <Icon name={icon} />
    </button>
  );
}
