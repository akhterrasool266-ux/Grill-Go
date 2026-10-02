import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from './cn';

const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none';
const variants = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-hover',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-bad text-white hover:opacity-90',
  soft: 'bg-brand-soft text-brand hover:opacity-90',
} as const;
const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-[15px]', lg: 'h-12 px-6 text-base' } as const;

export type ButtonStyle = { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string };
export const buttonClass = ({ variant = 'primary', size = 'md', className }: ButtonStyle = {}) => cn(base, variants[variant], sizes[size], className);

export function Button({ variant, size, className, ...p }: ComponentProps<'button'> & ButtonStyle) {
  return <button type="button" className={buttonClass({ variant, size, className })} {...p} />;
}
export function LinkButton({ variant, size, className, ...p }: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size, className })} {...p} />;
}
