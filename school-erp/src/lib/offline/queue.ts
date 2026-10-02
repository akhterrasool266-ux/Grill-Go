import { enqueue, listOps, putOp, removeOp } from './db';

export interface AttPayload { section_id: string; date: string; rows: { student_id: string; status: string; remarks?: string }[] }
export interface MarkRowPayload { student_id: string; marks?: string | number; absent?: boolean; remarks?: string; base: { marks: number | null; absent: boolean } | null }
export interface MarksPayload { exam_subject_id: string; rows: MarkRowPayload[] }

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);
const merge = <T extends { student_id: string }>(oldRows: T[], newRows: T[]) => { const m = new Map(oldRows.map((r) => [r.student_id, r])); for (const r of newRows) m.set(r.student_id, r); return [...m.values()]; };

/** Saving the same class + day again before it was sent replaces the earlier waiting copy (merged per student) instead of piling up duplicates. */
export async function queueAttendance(userId: string, label: string, p: AttPayload) {
  const same = (await listOps(userId)).find((o) => o.kind === 'attendance' && o.status === 'queued' && (o.payload as AttPayload).section_id === p.section_id && (o.payload as AttPayload).date === p.date);
  if (same) { await removeOp(same.id); p = { ...p, rows: merge((same.payload as AttPayload).rows, p.rows) }; }
  const id = newId(); await enqueue({ id, kind: 'attendance', userId, label, payload: p }); return id;
}
/** Same for marks of one paper. `base` (what the phone saw when it downloaded the sheet) is kept from the first copy so conflict detection stays correct. */
export async function queueMarks(userId: string, label: string, p: MarksPayload) {
  const same = (await listOps(userId)).find((o) => o.kind === 'marks' && o.status === 'queued' && (o.payload as MarksPayload).exam_subject_id === p.exam_subject_id);
  if (same) {
    const oldRows = (same.payload as MarksPayload).rows; const baseOf = new Map(oldRows.map((r) => [r.student_id, r.base]));
    await removeOp(same.id);
    p = { ...p, rows: merge(oldRows, p.rows.map((r) => (baseOf.has(r.student_id) ? { ...r, base: baseOf.get(r.student_id)! } : r))) };
  }
  const id = newId(); await enqueue({ id, kind: 'marks', userId, label, payload: p }); return id;
}
export async function discard(id: string) { await removeOp(id); }
export async function retry(id: string, userId: string) {
  const o = (await listOps(userId)).find((x) => x.id === id);
  if (o) await putOp({ ...o, status: 'queued', attempts: 0, error: undefined });
}
