// A tiny key-value layer over IndexedDB: the store document and uploaded photos live here, in the visitor's browser.
// If IndexedDB isn't available (some private windows), everything falls back to memory: the demo still works, it just
// forgets on reload.

const NAME = 'hemlo-demo-store', VERSION = 1;
export type Bucket = 'kv' | 'media';

let opening: Promise<IDBDatabase | null> | null = null;
let handle: IDBDatabase | null = null; // kept once open, so writes can start in the same tick (page closing)
const open = () => (opening ??= new Promise((ok) => {
  try {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = () => { for (const b of ['kv', 'media']) if (!r.result.objectStoreNames.contains(b)) r.result.createObjectStore(b); };
    r.onsuccess = () => { handle = r.result; ok(r.result); };
    r.onerror = r.onblocked = () => ok(null);
  } catch { ok(null); }
}));

const memory: Record<Bucket, Map<string, unknown>> = { kv: new Map(), media: new Map() };

function run<R>(bucket: Bucket, mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest<R> | void): Promise<R | undefined> {
  const go = (db: IDBDatabase | null) => new Promise<R | undefined>((ok) => {
    if (!db) return ok(undefined);
    const tx = db.transaction(bucket, mode), req = act(tx.objectStore(bucket));
    tx.oncomplete = () => ok(req ? req.result : undefined);
    tx.onerror = tx.onabort = () => ok(undefined);
  });
  return handle ? go(handle) : open().then(go);
}

export async function get<V>(bucket: Bucket, key: string): Promise<V | undefined> {
  if (memory[bucket].has(key)) return memory[bucket].get(key) as V;
  return (await run<V>(bucket, 'readonly', (s) => s.get(key))) as V | undefined;
}
export async function set(bucket: Bucket, key: string, value: unknown) {
  memory[bucket].set(key, value);
  const saved = run(bucket, 'readwrite', (s) => { s.put(value, key); }); // started now, even if the page is closing
  await saved;
  // saved for real: drop the memory copy, unless a newer value arrived while this one was being written
  if (handle && memory[bucket].get(key) === value) memory[bucket].delete(key);
}
export async function del(bucket: Bucket, key: string) {
  memory[bucket].delete(key);
  await run(bucket, 'readwrite', (s) => { s.delete(key); });
}
export async function keys(bucket: Bucket): Promise<string[]> {
  const kept = ((await run<IDBValidKey[]>(bucket, 'readonly', (s) => s.getAllKeys())) ?? []).map(String);
  return [...new Set([...kept, ...memory[bucket].keys()])];
}
export async function clear(bucket: Bucket) {
  memory[bucket].clear();
  await run(bucket, 'readwrite', (s) => { s.clear(); });
}
