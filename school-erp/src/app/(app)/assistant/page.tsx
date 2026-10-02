import type { Metadata } from 'next';
import { Assistant } from '@/components/data/assistant';
import { PageHeader } from '@/components/ui/primitives';
import { llmConfigured } from '@/lib/ai/assistant';
import { QUICK, toolsFor } from '@/lib/ai/tools';
import { requirePerm } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'AI assistant' };

export default async function AssistantPage() {
  const ctx = await requirePerm('ai.use');
  const ok = new Set(toolsFor(ctx).map((t) => t.name));
  return (
    <>
      <PageHeader title="AI assistant" description="Ask about today's numbers. It only reads data you are already allowed to see and never changes anything." />
      <Assistant quick={QUICK.filter((q) => ok.has(q.tool)).map(({ id, label }) => ({ id, label }))} freeText={llmConfigured()} />
    </>
  );
}
