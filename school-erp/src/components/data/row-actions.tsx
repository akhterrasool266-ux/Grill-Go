'use client';
import { ActionButton, ConfirmAction } from '@/components/ui/confirm-form';
import { runRowRpc } from '@/app/actions/resources';

export function RowActions({ resource, id, rpcs }: { resource: string; id: string; rpcs: { index: number; label: string; tone: 'primary' | 'secondary' | 'danger'; confirm?: string }[] }) {
  return (
    <>
      {rpcs.map((r) => r.confirm
        ? <ConfirmAction key={r.index} action={runRowRpc} data={{ resource, id, index: r.index }} title={r.label} message={r.confirm} confirmLabel={r.label} variant={r.tone === 'danger' ? 'danger' : 'primary'}>{r.label}</ConfirmAction>
        : <ActionButton key={r.index} action={runRowRpc} data={{ resource, id, index: r.index }} variant={r.tone === 'primary' ? 'soft' : 'secondary'}>{r.label}</ActionButton>)}
    </>
  );
}
