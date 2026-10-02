import { initials } from '@/lib/format';
import { cn } from './cn';

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" width={size} height={size} style={style} className={cn('shrink-0 rounded-full object-cover', className)} />
    : <span style={style} aria-hidden className={cn('grid shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand', className)}>{initials(name)}</span>;
}
