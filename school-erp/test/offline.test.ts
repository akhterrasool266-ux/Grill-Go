import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetConnection, enqueue, getSnapshot, housekeeping, listOps, listSnapshots, putSnapshot, SNAPSHOT_TTL_MS, wipeAll } from '@/lib/offline/db';
import { checkPin, hasPin, setPin } from '@/lib/offline/pin';
import { flush, pendingCount } from '@/lib/offline/sync';

beforeEach(() => { (globalThis as any).indexedDB = new IDBFactory(); _resetConnection(); });
const op = (id: string, userId = 'u1', createdAt = Date.now()) => ({ id, kind: 'attendance' as const, userId, label: 'Class 1 A', payload: { section_id: 's', date: '2026-10-01', rows: [] }, createdAt });
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('outbox storage', () => {
  it('keeps operations per user, oldest first', async () => {
    await enqueue(op('b', 'u1', 2)); await enqueue(op('a', 'u1', 1)); await enqueue(op('c', 'u2', 0));
    expect((await listOps('u1')).map((o) => o.id)).toEqual(['a', 'b']);
    expect((await listOps('u2')).map((o) => o.id)).toEqual(['c']);
  });
  it('snapshots belong to one user and expire', async () => {
    await putSnapshot({ key: 'k1', kind: 'attendance', userId: 'u1', title: 'A', savedAt: Date.now(), data: {} });
    await putSnapshot({ key: 'k2', kind: 'attendance', userId: 'u1', title: 'Old', savedAt: Date.now() - SNAPSHOT_TTL_MS - 1000, data: {} });
    expect(await getSnapshot('u2', 'k1')).toBeNull();
    expect(await getSnapshot('u1', 'k2')).toBeNull();
    expect((await listSnapshots('u1')).map((s) => s.key)).toEqual(['k1']);
  });
  it('housekeeping drops other users’ snapshots but never unsent work', async () => {
    await putSnapshot({ key: 'x', kind: 'marks', userId: 'old', title: 'X', savedAt: Date.now(), data: {} });
    await enqueue(op('unsent', 'old'));
    await housekeeping('u1');
    expect(await listSnapshots('old')).toEqual([]);
    expect((await listOps('old')).map((o) => o.id)).toEqual(['unsent']);
  });
  it('wipeAll removes everything', async () => {
    await enqueue(op('a')); await putSnapshot({ key: 'k', kind: 'marks', userId: 'u1', title: 'T', savedAt: Date.now(), data: {} }); await setPin('1234');
    await wipeAll();
    expect(await listOps('u1')).toEqual([]); expect(await listSnapshots('u1')).toEqual([]); expect(await hasPin()).toBe(false);
  });
});

describe('flush', () => {
  it('sends queued work, removes it on success', async () => {
    await enqueue(op('a'));
    const r = await flush('u1', reply(200, { ok: true, result: { saved: 3, conflicts: [] } }));
    expect(r).toMatchObject({ sent: 1, saved: 3, conflicts: 0, stopped: null });
    expect(await listOps('u1')).toEqual([]);
  });
  it('sends the operation id so the server can de-duplicate', async () => {
    await enqueue(op('op-123')); let sent: any;
    await flush('u1', (async (_u: unknown, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ ok: true, result: { saved: 0 } })); }) as unknown as typeof fetch);
    expect(sent).toMatchObject({ id: 'op-123', kind: 'attendance' });
  });
  it('keeps work queued when the network is down, and stops', async () => {
    await enqueue(op('a', 'u1', 1)); await enqueue(op('b', 'u1', 2));
    const calls: string[] = [];
    const r = await flush('u1', (async () => { calls.push('x'); throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch);
    expect(r.stopped).toBe('offline'); expect(calls.length).toBe(1);
    const left = await listOps('u1'); expect(left.map((o) => o.status)).toEqual(['queued', 'queued']); expect(left[0]!.attempts).toBe(0);
  });
  it('keeps work and asks to sign in on 401', async () => {
    await enqueue(op('a'));
    expect((await flush('u1', reply(401, { ok: false }))).stopped).toBe('signin');
    expect((await listOps('u1'))[0]!.status).toBe('queued');
  });
  it('marks conflicts for the user to review instead of dropping them', async () => {
    await enqueue(op('a'));
    const r = await flush('u1', reply(200, { ok: true, result: { saved: 1, conflicts: [{ student_id: 's1' }] } }));
    expect(r.conflicts).toBe(1);
    expect((await listOps('u1'))[0]).toMatchObject({ status: 'conflict' });
  });
  it('a server refusal (e.g. exam locked) is kept as rejected with the reason', async () => {
    await enqueue(op('a'));
    await flush('u1', reply(422, { ok: false, error: 'Marks are locked.' }));
    expect((await listOps('u1'))[0]).toMatchObject({ status: 'rejected', error: 'Marks are locked.' });
  });
  it('a flaky server is retried a few times, then parked as rejected', async () => {
    await enqueue(op('a'));
    for (let i = 0; i < 5; i++) await flush('u1', reply(500, { ok: false }));
    expect((await listOps('u1'))[0]!.status).toBe('rejected');
  });
  it('never sends another user’s work', async () => {
    await enqueue(op('theirs', 'u2')); let called = 0;
    await flush('u1', (async () => { called++; return new Response('{}'); }) as unknown as typeof fetch);
    expect(called).toBe(0);
  });
  it('counts waiting vs needs-attention', async () => {
    await enqueue(op('a')); await flush('u1', reply(422, { ok: false, error: 'x' })); await enqueue(op('b'));
    expect(await pendingCount('u1')).toEqual({ waiting: 1, attention: 1 });
  });
});

describe('offline PIN', () => {
  it('accepts the right PIN and rejects a wrong one', async () => {
    await setPin('4821');
    expect((await checkPin('4821')).ok).toBe(true);
    expect(await checkPin('0000')).toMatchObject({ ok: false, reason: 'wrong', left: 9 });
  });
  it('does not store the PIN itself', async () => {
    await setPin('4821'); const db = await (await import('@/lib/offline/db')).getMeta<{ hash: string }>('pin');
    expect(JSON.stringify(db)).not.toContain('4821');
  });
  it('rejects silly PINs', async () => { await expect(setPin('12')).rejects.toThrow(); await expect(setPin('abcd')).rejects.toThrow(); });
  it('locks for a while after repeated failures and wipes the device copy after 10', async () => {
    await setPin('4821'); await enqueue(op('a'));
    for (let i = 0; i < 2; i++) await checkPin('0000');
    expect((await checkPin('0000')).ok).toBe(false);          // 3rd failure → lock starts
    expect(await checkPin('4821')).toMatchObject({ ok: false, reason: 'locked' });  // even the right PIN is refused while locked
    const { setMeta } = await import('@/lib/offline/db');
    await setMeta('pinFails', { n: 9, until: 0 });
    expect(await checkPin('0000')).toMatchObject({ ok: false, reason: 'wiped' });
    expect(await listOps('u1')).toEqual([]);
  });
  it('no PIN set → open', async () => expect((await checkPin('1')).ok).toBe(true));
});

import { queueAttendance, queueMarks } from '@/lib/offline/queue';
describe('queueing', () => {
  it('saving the same class and day twice keeps one waiting copy, merged per student', async () => {
    await queueAttendance('u1', 'C1', { section_id: 's', date: '2026-10-01', rows: [{ student_id: 'a', status: 'present' }, { student_id: 'b', status: 'present' }] });
    await queueAttendance('u1', 'C1', { section_id: 's', date: '2026-10-01', rows: [{ student_id: 'b', status: 'absent' }] });
    const ops = await listOps('u1'); expect(ops.length).toBe(1);
    expect((ops[0]!.payload as any).rows).toEqual([{ student_id: 'a', status: 'present' }, { student_id: 'b', status: 'absent' }]);
  });
  it('different days stay separate', async () => {
    await queueAttendance('u1', 'C1', { section_id: 's', date: '2026-10-01', rows: [] }); await queueAttendance('u1', 'C1', { section_id: 's', date: '2026-10-02', rows: [] });
    expect((await listOps('u1')).length).toBe(2);
  });
  it('marks keep the ORIGINAL base when edited again offline', async () => {
    await queueMarks('u1', 'M', { exam_subject_id: 'e', rows: [{ student_id: 'a', marks: '50', base: { marks: 40, absent: false } }] });
    await queueMarks('u1', 'M', { exam_subject_id: 'e', rows: [{ student_id: 'a', marks: '55', base: { marks: 50, absent: false } }, { student_id: 'b', marks: '10', base: null }] });
    const rows = ((await listOps('u1'))[0]!.payload as any).rows;
    expect(rows.find((r: any) => r.student_id === 'a')).toMatchObject({ marks: '55', base: { marks: 40, absent: false } });
    expect(rows.length).toBe(2);
  });
});
