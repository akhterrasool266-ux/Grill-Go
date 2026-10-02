import { listOps, putOp, removeOp, type Op } from './db';

export interface FlushReport { sent: number; saved: number; conflicts: number; rejected: number; stopped: 'offline' | 'signin' | null }
const MAX_ATTEMPTS = 5;

/** Replays queued operations (oldest first) to the server. Stops at the first sign of "no network" or "not signed in" and keeps the rest queued. */
export async function flush(userId: string, fetcher: typeof fetch = fetch): Promise<FlushReport> {
  const rep: FlushReport = { sent: 0, saved: 0, conflicts: 0, rejected: 0, stopped: null };
  const ops = (await listOps(userId)).filter((o) => o.status === 'queued' || o.status === 'syncing');
  for (const op of ops) {
    await putOp({ ...op, status: 'syncing', attempts: op.attempts + 1 });
    let res: Response;
    try {
      res = await fetcher('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id: op.id, kind: op.kind, payload: op.payload }) });
    } catch {
      await putOp({ ...op, status: 'queued', attempts: op.attempts });   // network down: not the operation's fault
      rep.stopped = 'offline'; break;
    }
    if (res.status === 401) { await putOp({ ...op, status: 'queued', attempts: op.attempts }); rep.stopped = 'signin'; break; }
    let body: { ok?: boolean; error?: string; result?: { saved?: number; conflicts?: unknown[] } } = {};
    try { body = await res.json(); } catch { /* proxy error page etc. */ }
    if (res.ok && body.ok) {
      rep.sent++; rep.saved += body.result?.saved ?? 0;
      if (body.result?.conflicts?.length) { rep.conflicts++; await putOp({ ...op, status: 'conflict', attempts: op.attempts + 1, result: body.result, error: undefined }); }
      else await removeOp(op.id);
    } else if (res.status >= 500 || res.status === 429) {
      const attempts = op.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) { rep.rejected++; await putOp({ ...op, status: 'rejected', attempts, error: body.error ?? 'The server could not process this after several tries.' }); }
      else { await putOp({ ...op, status: 'queued', attempts }); rep.stopped = 'offline'; break; }
    } else { rep.rejected++; await putOp({ ...op, status: 'rejected', attempts: op.attempts + 1, error: body.error ?? 'Rejected by the server.' }); }
  }
  return rep;
}

export async function pendingCount(userId: string) {
  const ops = await listOps(userId);
  return { waiting: ops.filter((o) => o.status === 'queued' || o.status === 'syncing').length, attention: ops.filter((o) => o.status === 'conflict' || o.status === 'rejected').length };
}
export type { Op };
