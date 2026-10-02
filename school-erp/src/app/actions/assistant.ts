'use server';
import { z } from 'zod';
import { callAction } from '@/lib/actions';
import { ask, llmConfigured, runTool } from '@/lib/ai/assistant';
import { QUICK } from '@/lib/ai/tools';
import { currentCampus } from '@/lib/auth/session';

type Reply = { text: string; mode: 'tools' | 'llm'; used: string[] };

/** Quick buttons: run one permission-checked tool, no LLM, no quota used. */
export const quickAsk = callAction({
  permission: 'ai.use', schema: z.object({ id: z.string().max(20) }), rateLimit: { key: 'ai-quick', limit: 30, windowMs: 60_000 },
}, async ({ ctx, sb, input }) => {
  const q = QUICK.find((x) => x.id === input.id);
  if (!q) throw { code: 'X', message: 'Unknown question.' };
  const campus = await currentCampus(ctx);
  const r = await runTool({ sb, ctx, campus }, q.tool);
  return { data: { text: r.text, mode: 'tools', used: [q.tool] } satisfies Reply };
});

/** Free text: needs ANTHROPIC_API_KEY, is rate-limited and counted against the plan's ai_requests limit. */
export const askAssistant = callAction({
  permission: 'ai.use', schema: z.object({ question: z.string().trim().min(2, 'Type a question.').max(1000) }), rateLimit: { key: 'ai-ask', limit: 10, windowMs: 60_000 },
}, async ({ ctx, sb, input }) => {
  if (!llmConfigured()) throw { code: 'X', message: 'Free-text questions are not enabled on this system (no AI key configured). Use the quick questions.' };
  const { data: within } = await sb.rpc('my_within_limit', { p_metric: 'ai_requests' });
  if (within === false) throw { code: 'X', message: 'plan_limit_reached: ai_requests' };
  const campus = await currentCampus(ctx);
  let r;
  try { r = await ask({ sb, ctx, campus }, input.question); }
  catch (e) { console.error('[assistant]', e instanceof Error ? e.message : e); throw { code: 'X', message: 'The assistant is unavailable right now. Please try the quick questions.' }; }
  await sb.rpc('my_bump_usage', { p_metric: 'ai_requests' });
  return { data: { text: r.text, mode: 'llm', used: r.used } satisfies Reply };
});
