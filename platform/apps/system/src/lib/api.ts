// Talking to api.hemlohq.com (the same Hemlo ID session cookie as every Hemlo site), plus the offline sale queue.
export const API = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:8787';
export const ACCOUNT = (import.meta.env.VITE_ACCOUNT_URL as string) ?? 'http://localhost:4321';

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

/** On a shared shop device every request speaks as the device (the unlocked person), never as a leftover session. */
let counterMode = false;
export const setCounterMode = (on: boolean) => { counterMode = on; };
export const isCounterMode = () => counterMode;

/** The demo shop: a visitor's private copy of a ready-made market. Its session is a bearer token kept on this device
 *  (never a cookie), so a real Hemlo sign-in on the same browser is left alone. */
const DEMO_KEY = 'hemlo.demo';
export const demo = {
  get(): { token: string; expiresAt: string; kind?: string } | null {
    try {
      const d = JSON.parse(localStorage.getItem(DEMO_KEY) ?? 'null');
      if (d?.token && new Date(d.expiresAt).getTime() > Date.now()) return d;
      if (d) demo.clear();
    } catch {}
    return null;
  },
  set(d: { token: string; expiresAt: string; kind?: string }) { demo.forget(); localStorage.setItem(DEMO_KEY, JSON.stringify(d)); },
  clear() { try { localStorage.removeItem(DEMO_KEY); } catch {} demo.forget(); },
  /** leave the demo: the server deletes it at once (keepalive: the request outlives the page it was sent from) */
  end() {
    const d = demo.get();
    if (d) fetch(API + '/v1/demo/end', { method: 'POST', headers: { authorization: 'Bearer ' + d.token, 'content-type': 'application/json' }, body: '{}', credentials: 'omit', keepalive: true }).catch(() => {});
    demo.clear();
  },
  /** what the device remembered belongs to one session: drop it when switching into or out of the demo */
  forget() { try { for (const k of Object.keys(localStorage)) if (k.startsWith('hemlo.cache.') || k === 'hemlo.outbox') localStorage.removeItem(k); } catch {} },
};

/** Who is asking: a shop device, the demo visitor, or (by cookie) the signed-in person. */
function whoHeaders(): { headers: Record<string, string>; credentials: RequestCredentials } {
  const headers: Record<string, string> = {};
  if (counterMode) headers['x-hemlo-as'] = 'counter';
  const d = demo.get();
  if (d) headers.authorization = `Bearer ${d.token}`;
  return { headers, credentials: d ? 'omit' : 'include' };
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  // reading is safe to repeat: if the server stumbles (a cold start, a busy moment), try again quietly before giving up
  const reading = (init.method ?? (init.body !== undefined ? 'POST' : 'GET')) === 'GET';
  for (let attempt = 0; ; attempt++) {
    try { return await once<T>(path, init); }
    catch (e) { if (!reading || attempt >= 2 || !(e instanceof ApiError) || !(e.status === 0 || e.status >= 500)) throw e; await new Promise((r) => setTimeout(r, 350 * (attempt + 1))); }
  }
}
async function once<T>(path: string, init: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  const { headers, credentials } = whoHeaders();
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  try {
    res = await fetch(API + path, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'), credentials, headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch { throw new ApiError(0, 'NETWORK'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // the device locked itself (10 idle minutes): the app shows the PIN screen
    if (res.status === 423 && json.error === 'COUNTER_LOCKED') window.dispatchEvent(new Event('hemlo-locked'));
    throw new ApiError(res.status, json.error ?? 'ERROR');
  }
  return json as T;
}

export interface UploadedFile { id: string; url: string | null; width: number | null; height: number | null }
/** Send one prepared image (see lib/images). purpose: logo | product | purchase | expense; ref attaches it to a saved record. */
export async function upload(purpose: string, img: { blob: Blob; width: number; height: number }, ref?: string): Promise<UploadedFile> {
  const { headers, credentials } = whoHeaders();
  headers['content-type'] = img.blob.type;
  const q = new URLSearchParams({ purpose, w: String(img.width), h: String(img.height), ...(ref ? { ref } : {}) });
  let res: Response;
  try { res = await fetch(`${API}/v1/sys/files?${q}`, { method: 'POST', body: img.blob, headers, credentials }); }
  catch { throw new ApiError(0, 'NETWORK'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'ERROR');
  return json.file;
}

/** Send a file's bytes to any route (listing photos, documents), as whoever is signed in here (session, device or demo). */
export async function postBlob<T = any>(path: string, blob: Blob): Promise<T> {
  const { headers, credentials } = whoHeaders();
  headers['content-type'] = blob.type || 'application/octet-stream';
  let res: Response;
  try { res = await fetch(API + path, { method: 'POST', body: blob, headers, credentials }); }
  catch { throw new ApiError(0, 'NETWORK'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'ERROR');
  return json as T;
}

/** Remember the last good answer, and fall back to it when there's no internet (so the app still opens offline). */
export async function remembered<T>(key: string, fn: () => Promise<T>): Promise<T> {
  try { const v = await fn(); try { localStorage.setItem(`hemlo.cache.${key}`, JSON.stringify(v)); } catch {} return v; }
  catch (e) {
    if (e instanceof ApiError && e.status === 0) { const c = localStorage.getItem(`hemlo.cache.${key}`); if (c) return JSON.parse(c) as T; }
    throw e;
  }
}

// ---- types (what the API returns) ----
export interface Product { id: string; name: string; barcode: string | null; category: string | null; unit: string; price: number; cost: number | null; stock: number; lowStock: number | null; trackStock: boolean; packSize: number | null; packBarcode: string | null; packPrice: number | null; scaleCode?: string | null; imageId?: string | null; imageUrl?: string | null }
export interface Customer { id: string; name: string; phone: string | null; note: string | null; balance: number }
export interface Sale { returned?: number; id: string; number: number; createdAt: string; customerId: string | null; customerName?: string | null; subtotal: number; discount: number; total: number; paid: number; due: number; method: string; cost: number | null; note: string | null; voidedAt: string | null; userId: string | null }
export interface SaleLine { id: string; productId: string | null; name: string; qty: number; price: number; total: number; packSize?: number | null; baseQty?: number | null; returnedQty?: number }
export interface Subscription { edition: string; status: 'free' | 'trial' | 'active' | 'grace' | 'ended'; seats: number; planId?: string | null; plan?: { id: string; code: string; name: { ar: string; en: string; ckb?: string } } | null; billing?: string; price?: number | null; limits?: Record<string, number>; trialEndsAt: string | null; paidUntil: string | null; daysLeft: number | null }
export interface SysMe { business: { id: string; name: string; slug: string; kind: string | null; city: string | null; currency: 'IQD'; demo?: boolean; logoUrl?: string | null }; role: string | null; counter: boolean; memberId?: string | null; can: Record<string, boolean>; subscription?: Subscription }

// ---- offline: sales wait on the device until the API can take them ----
export interface PendingSale { clientId: string; body: Record<string, unknown>; at: number }
const KEY = 'hemlo.outbox';
export const outbox = {
  all(): PendingSale[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } },
  add(p: PendingSale) { const list = outbox.all(); list.push(p); localStorage.setItem(KEY, JSON.stringify(list)); window.dispatchEvent(new Event('hemlo-outbox')); },
  remove(clientId: string) { localStorage.setItem(KEY, JSON.stringify(outbox.all().filter((x) => x.clientId !== clientId))); window.dispatchEvent(new Event('hemlo-outbox')); },
  /** Sends what it can. The clientId makes a resend safe: the server returns the first sale instead of making a second. */
  async flush() {
    for (const p of outbox.all()) {
      try { await api('/v1/sys/sales', { body: p.body }); outbox.remove(p.clientId); }
      catch (e) { if (e instanceof ApiError && e.status === 0) return; outbox.remove(p.clientId); } // a real refusal won't fix itself: drop it
    }
  },
};
export const newClientId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** A page of HTML from the API (the website preview), signed in the same way as every other call. */
export async function apiHtml(path: string, signal?: AbortSignal): Promise<string> {
  const { headers, credentials } = whoHeaders();
  const res = await fetch(API + path, { credentials, headers, signal });
  if (!res.ok) throw new ApiError(res.status, 'PREVIEW');
  return res.text();
}
