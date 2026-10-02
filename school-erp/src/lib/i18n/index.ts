import 'server-only';
import { cookies } from 'next/headers';
import { en, type MessageKey } from './en';
import { ur } from './ur';
import { getIdentity } from '@/lib/auth/session';

export type Lang = 'en' | 'ur';
export const isRtl = (l: Lang) => l === 'ur';

/** cookie → profile preference → school default → English */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get('erp_lang')?.value;
  if (c === 'en' || c === 'ur') return c;
  const id = await getIdentity().catch(() => null);
  return id?.profile?.language ?? id?.school?.default_language ?? 'en';
}

export type T = (key: MessageKey | (string & {}), vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  const dict = lang === 'ur' ? ur : {};
  return (key, vars) => {
    let s = (dict as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key.split('.').pop()!.replace(/([A-Z])/g, ' $1');
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}
export async function getT(): Promise<{ t: T; lang: Lang; dir: 'ltr' | 'rtl' }> {
  const lang = await getLang();
  return { t: makeT(lang), lang, dir: isRtl(lang) ? 'rtl' : 'ltr' };
}
export type { MessageKey };
