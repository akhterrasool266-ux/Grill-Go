'use client';
import { useRef, useState, useTransition } from 'react';
import { askAssistant, quickAsk } from '@/app/actions/assistant';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/primitives';

type Msg = { role: 'user' | 'bot'; text: string; note?: string };

export function Assistant({ quick, freeText }: { quick: { id: string; label: string }[]; freeText: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const push = (m: Msg) => setMsgs((x) => [...x, m]);

  const run = (label: string, call: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) => {
    setError(null); push({ role: 'user', text: label });
    start(async () => {
      const r = await call();
      if (!r.ok) { setError(r.error ?? 'Failed.'); return; }
      const d = r.data as { text: string; mode: string; used: string[] };
      push({ role: 'bot', text: d.text, note: d.mode === 'llm' ? 'AI-written from live data' : 'Live data, no AI' });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {quick.map((q) => <Button key={q.id} variant="secondary" disabled={pending} onClick={() => run(q.label, () => quickAsk({ id: q.id }))}>{q.label}</Button>)}
      </div>
      <Card className="min-h-48 space-y-3 p-4" aria-live="polite">
        {msgs.length === 0 && <p className="text-sm text-muted">Choose a quick question{freeText ? ' or type your own below' : ''}.</p>}
        {msgs.map((m, i) => m.role === 'user'
          ? <p key={i} className="ms-auto w-fit max-w-[85%] rounded-2xl bg-brand px-3 py-2 text-sm text-white">{m.text}</p>
          : <div key={i} className="max-w-[95%] space-y-1"><p className="whitespace-pre-wrap rounded-2xl bg-surface-2 px-3 py-2 text-sm">{m.text}</p>{m.note && <p className="px-1 text-xs text-muted">{m.note}</p>}</div>)}
        {pending && <p className="text-sm text-muted">Looking it up…</p>}
      </Card>
      {error && <Alert tone="bad">{error}</Alert>}
      {freeText
        ? <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const q = input.current?.value.trim(); if (!q) return; input.current!.value = ''; run(q, () => askAssistant({ question: q })); }}>
            <input ref={input} maxLength={1000} className="h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" placeholder="e.g. Which class has the most unpaid fees?" aria-label="Your question" />
            <Button type="submit" disabled={pending}>Ask</Button>
          </form>
        : <p className="text-xs text-muted">Typing your own questions is off because no AI key is configured on this system. The quick questions above work without one.</p>}
      <p className="text-xs text-muted">When free-text is on, the figures needed to answer are sent to the AI provider. Do not enable it if your school's policy forbids that.</p>
    </div>
  );
}
