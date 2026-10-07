// The one live document (types.ts) shared by the shop and the control panel. Every change goes through `change()`:
// it makes the new version, saves it to the browser a moment later (batched), and tells other open tabs, so an edit in
// the control panel shows up in a shop tab without a reload.
import { batch, computed, signal } from '@preact/signals';
import { SEED_VERSION } from '../data/version';
import type { Market } from '../data/seed';
import * as db from './db';
import type { Doc } from './types';

export const doc = signal<Doc>(null as unknown as Doc); // set by boot() before anything renders
export const saving = signal(false);

const KEY = 'doc';
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('hemlo-demo-store') : null;

/** Which market a link asks for: ?market=jo opens the Jordanian shop (JOD, Amman), ?market=iq the Iraqi one. */
const askedMarket = (): Market | null => {
  const m = new URLSearchParams(location.search).get('market');
  return m === 'jo' || m === 'iq' ? m : null;
};

export async function boot() {
  const asked = askedMarket();
  let d = await db.get<Doc>('kv', KEY);
  const market: Market = asked ?? (d?.settings.currency === 'JOD' ? 'jo' : 'iq');
  const wrongMarket = asked && d && (d.settings.currency === 'JOD') !== (asked === 'jo');
  if (!d || d.v !== SEED_VERSION || wrongMarket) {
    const { seed } = await import('../data/seed'); // only on a first visit or a new version: most visits never download it
    d = seed(market);
    await db.set('kv', KEY, d);
  }
  if (asked) { const u = new URL(location.href); u.searchParams.delete('market'); history.replaceState(history.state, '', u); }
  doc.value = d;
  channel?.addEventListener('message', async (e: MessageEvent<{ rev: number }>) => {
    if (e.data.rev <= doc.value.rev) return;
    const fresh = await db.get<Doc>('kv', KEY);
    if (fresh && fresh.rev > doc.value.rev) doc.value = fresh;
  });
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}

let timer = 0;
async function flush() {
  if (!timer) return;
  clearTimeout(timer); timer = 0;
  const d = doc.value;
  await db.set('kv', KEY, d);
  saving.value = false;
  channel?.postMessage({ rev: d.rev });
}

/**
 * Changes the document: `edit` gets a private copy to change in place; the copy becomes the new document. It's saved
 * a moment later (several quick edits become one save), or at once with { now: true }.
 * Returns whatever `edit` returns (a new id, an order number…).
 */
export function change<R>(edit: (d: Doc) => R, { now = false } = {}): R {
  const next = structuredClone(doc.value);
  const out = edit(next);
  next.rev = doc.value.rev + 1;
  batch(() => { doc.value = next; saving.value = true; });
  clearTimeout(timer);
  timer = window.setTimeout(flush, 250);
  if (now) void flush(); // an order can't wait: the customer may close the tab right after
  return out;
}

/** Starts the demo over: the shop as it first opened, for this market or another. */
export async function reset(market?: Market) {
  const m = market ?? (doc.value.settings.currency === 'JOD' ? 'jo' : 'iq');
  clearTimeout(timer); timer = 0;
  await db.clear('media');
  const { seed } = await import('../data/seed');
  const fresh = seed(m);
  fresh.rev = doc.value.rev + 1;
  await db.set('kv', KEY, fresh);
  doc.value = fresh;
  channel?.postMessage({ rev: fresh.rev });
}

// ---- things many screens read: worked out once per change, not per screen ----
export const settings = computed(() => doc.value.settings);
export const categories = computed(() => [...doc.value.categories].sort((a, b) => a.order - b.order));
export const products = computed(() => doc.value.products);
export const live = computed(() => doc.value.products.filter((p) => p.active));
export const productBySlug = computed(() => new Map(doc.value.products.map((p) => [p.slug, p])));
export const productById = computed(() => new Map(doc.value.products.map((p) => [p.id, p])));
export const categoryBySlug = computed(() => new Map(doc.value.categories.map((c) => [c.slug, c])));
export const newOrders = computed(() => doc.value.orders.filter((o) => o.status === 'new').length);
