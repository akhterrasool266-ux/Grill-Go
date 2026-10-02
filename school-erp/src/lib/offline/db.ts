/**
 * On-device outbox + offline snapshots (IndexedDB). Client-side only.
 *
 * This is NOT a database of record. The server stays the single source of truth:
 *   · a snapshot is a read-only copy of a class list / marks sheet the user chose to take offline;
 *   · an outbox operation is a queued write that is replayed to the server (idempotently) when online.
 * Everything is scoped to the signed-in user id, expires, and is wiped on sign-out.
 */
export type OpKind = 'attendance' | 'marks';
export type OpStatus = 'queued' | 'syncing' | 'conflict' | 'rejected';

export interface Op {
  id: string; kind: OpKind; userId: string; label: string; createdAt: number;
  status: OpStatus; attempts: number; error?: string; result?: unknown; payload: unknown;
}
export interface Snapshot { key: string; kind: OpKind; userId: string; title: string; savedAt: number; data: unknown }

export const SNAPSHOT_TTL_MS = 14 * 24 * 3600_000;
const DB_NAME = 'erp-offline', VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;
export function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('ops', { keyPath: 'id' });
      db.createObjectStore('snapshots', { keyPath: 'key' });
      db.createObjectStore('meta', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}
/** Test helper: forget the cached connection (fake-indexeddb is reset between tests). */
export function _resetConnection() { dbp = null; }

const tx = async <T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = run(t.objectStore(store));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

// ── outbox ──
export const enqueue = (op: Omit<Op, 'status' | 'attempts' | 'createdAt'> & { createdAt?: number }) =>
  tx('ops', 'readwrite', (s) => s.put({ status: 'queued', attempts: 0, createdAt: Date.now(), ...op } satisfies Op));
export const putOp = (op: Op) => tx('ops', 'readwrite', (s) => s.put(op));
export const removeOp = (id: string) => tx('ops', 'readwrite', (s) => s.delete(id));
export async function listOps(userId: string): Promise<Op[]> {
  const all = await tx<Op[]>('ops', 'readonly', (s) => s.getAll());
  return all.filter((o) => o.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
}

// ── snapshots ──
export const putSnapshot = (s: Snapshot) => tx('snapshots', 'readwrite', (st) => st.put(s));
export const removeSnapshot = (key: string) => tx('snapshots', 'readwrite', (s) => s.delete(key));
export async function getSnapshot(userId: string, key: string): Promise<Snapshot | null> {
  const s = await tx<Snapshot | undefined>('snapshots', 'readonly', (st) => st.get(key));
  return s && s.userId === userId && Date.now() - s.savedAt < SNAPSHOT_TTL_MS ? s : null;
}
export async function listSnapshots(userId: string): Promise<Snapshot[]> {
  const all = await tx<Snapshot[]>('snapshots', 'readonly', (s) => s.getAll());
  return all.filter((s) => s.userId === userId && Date.now() - s.savedAt < SNAPSHOT_TTL_MS).sort((a, b) => a.title.localeCompare(b.title));
}

// ── meta (last signed-in user, PIN hash, failed-PIN counter) ──
export const getMeta = async <T = unknown>(k: string): Promise<T | null> => ((await tx<{ k: string; v: T } | undefined>('meta', 'readonly', (s) => s.get(k)))?.v ?? null);
export const setMeta = (k: string, v: unknown) => tx('meta', 'readwrite', (s) => s.put({ k, v }));

/** Remove expired snapshots, and everything that belongs to a different user than `userId`. Never touches unsent operations of `userId`. */
export async function housekeeping(userId: string) {
  const [snaps, ops] = await Promise.all([tx<Snapshot[]>('snapshots', 'readonly', (s) => s.getAll()), tx<Op[]>('ops', 'readonly', (s) => s.getAll())]);
  for (const s of snaps) if (s.userId !== userId || Date.now() - s.savedAt >= SNAPSHOT_TTL_MS) await removeSnapshot(s.key);
  for (const o of ops) if (o.userId !== userId && o.status !== 'queued') await removeOp(o.id);
}

/** Sign-out: remove the on-device copy. Unsent operations are removed too — the UI warns before this happens. */
export async function wipeAll() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(['ops', 'snapshots', 'meta'], 'readwrite');
    for (const n of ['ops', 'snapshots', 'meta']) t.objectStore(n).clear();
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
  });
}
