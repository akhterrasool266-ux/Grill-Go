'use client';
import { buttonClass, type ButtonStyle } from './button';

export function PrintButton({ children = 'Print / Save as PDF', ...style }: ButtonStyle & { children?: React.ReactNode }) {
  return <button type="button" onClick={() => window.print()} className={buttonClass(style)}>{children}</button>;
}
