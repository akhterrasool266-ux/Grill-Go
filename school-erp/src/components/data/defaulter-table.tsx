'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ReminderBar } from './fees-forms';
import { Badge, TableWrap, Td, Th } from '@/components/ui/primitives';
import { fmtDate, pkr } from '@/lib/format';

interface Row { id: string; code: string; name: string; cls: string; guardian: string | null; phone: string | null; whatsapp: string | null; family: string | null; amount: number; months: number; days: number; last: string | null }
const wa = (n: string | null, text: string) => n ? `https://wa.me/${n.replace(/\D/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(text)}` : null;

export function DefaulterTable({ rows, canRemind, school }: { rows: Row[]; canRemind: boolean; school: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const all = sel.length === rows.length;
  return (
    <div>
      {canRemind && sel.length > 0 && <div className="sticky top-14 z-10 flex items-center justify-between gap-3 border-b border-line bg-brand-soft px-4 py-2.5 text-sm"><span>{sel.length} selected</span><ReminderBar ids={sel} /></div>}
      <TableWrap><thead><tr>
        {canRemind && <Th className="w-8"><input type="checkbox" aria-label="Select all" checked={all} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} className="size-4 accent-[var(--brand)]" /></Th>}
        <Th>Student</Th><Th className="hidden md:table-cell">Parent</Th><Th className="text-end">Overdue</Th><Th className="hidden sm:table-cell">Vouchers</Th><Th className="hidden lg:table-cell">Last payment</Th><Th>Contact</Th>
      </tr></thead><tbody>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-surface-2/50">
            {canRemind && <Td><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.includes(r.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} className="size-4 accent-[var(--brand)]" /></Td>}
            <Td><Link href={`/fees/collect?student=${r.code}`} className="font-medium text-brand hover:underline">{r.name}</Link><span className="block text-xs text-muted">{r.code} · {r.cls}</span></Td>
            <Td className="hidden md:table-cell">{r.guardian ?? '—'}<span className="block text-xs text-muted">{r.family}</span></Td>
            <Td className="tabular text-end font-semibold text-bad">{pkr(r.amount)}<span className="block text-xs font-normal text-muted">{r.days} days</span></Td>
            <Td className="hidden sm:table-cell"><Badge tone="bad">{r.months} overdue</Badge></Td>
            <Td className="hidden lg:table-cell">{fmtDate(r.last)}</Td>
            <Td><div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {r.phone && <a className="text-brand hover:underline" href={`tel:${r.phone}`}>Call</a>}
              {wa(r.whatsapp ?? r.phone, `Dear Parent, the fee of ${r.name} (${r.cls}) is overdue: ${pkr(r.amount)}. Kindly pay at the earliest. — ${school}`) && <a className="text-brand hover:underline" target="_blank" rel="noopener noreferrer" href={wa(r.whatsapp ?? r.phone, `Dear Parent, the fee of ${r.name} (${r.cls}) is overdue: ${pkr(r.amount)}. Kindly pay at the earliest. — ${school}`)!}>WhatsApp</a>}
              <Link className="text-brand hover:underline" href={`/fees/defaulters/notice/${r.id}`}>Notice</Link>
            </div></Td>
          </tr>
        ))}
      </tbody></TableWrap>
    </div>
  );
}
