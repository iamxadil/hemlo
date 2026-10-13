// Uploaded images (logos, product photos, invoice and receipt photos). The bytes live in Cloudflare R2; each image has a
// sys_file row. Images are shown through signed links, so an <img> tag can load them with no cookie or token, the browser
// can cache them, and showing one never touches the database.
import { hmac, safeEqual } from '@hemlo/core';

export interface StoredFile { body: ReadableStream | ArrayBuffer; contentType: string; size: number }
export interface FileStore {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(keys: string[]): Promise<void>;
}

/** Cloudflare R2 (the UPLOADS bucket binding). */
export function r2Store(bucket: any): FileStore {
  return {
    async put(key, body, contentType) { await bucket.put(key, body, { httpMetadata: { contentType } }); },
    async get(key) {
      const o = await bucket.get(key);
      return o ? { body: o.body, contentType: o.httpMetadata?.contentType ?? 'application/octet-stream', size: o.size } : null;
    },
    async delete(keys) { for (let i = 0; i < keys.length; i += 1000) if (keys.slice(i, i + 1000).length) await bucket.delete(keys.slice(i, i + 1000)); },
  };
}

/** In memory: tests and local development. */
export function memoryStore(): FileStore & { size(): number } {
  const m = new Map<string, { body: ArrayBuffer; contentType: string }>();
  return {
    async put(key, body, contentType) { m.set(key, { body: body.slice(0), contentType }); },
    async get(key) { const x = m.get(key); return x ? { body: x.body, contentType: x.contentType, size: x.body.byteLength } : null; },
    async delete(keys) { for (const k of keys) m.delete(k); },
    size: () => m.size,
  };
}

export const PURPOSES = ['logo', 'product', 'purchase', 'expense', 'clinical', 'consent', 'member', 'property', 'redoc', 'studio'] as const;
/** Medical pictures (X-rays, clinical photos, signed consents) get links that last about an hour, not a month. */
export const SHORT_LIVED: Purpose[] = ['clinical', 'consent', 'redoc']; // a real-estate document (deed, contract, ID): private
export type Purpose = (typeof PURPOSES)[number];
export const MAX_BYTES = 4 * 1024 * 1024;          // the app shrinks photos to ~150 KB first; this is only a ceiling
export const MAX_ATTACHMENTS = 10;                  // per purchase or expense
export const fileKey = (org: string, id: string) => `o/${org}/${id}`;

/** A PDF (real-estate documents: deeds, contracts): checked by its first bytes, like images. */
export const isPdf = (buf: ArrayBuffer) => { const b = new Uint8Array(buf.slice(0, 5)); return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d; };

/** What the bytes really are (never trust the declared type): JPEG, PNG or WebP only. */
export function sniffImage(buf: ArrayBuffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// A link stays the same for a whole 30-day window (so browsers cache it), and works until the end of the next one.
const WINDOW = 30 * 86400;
const sigOf = (secret: string, org: string, id: string, exp: number) => hmac(secret, `file:${org}/${id}:${exp}`);
export async function fileUrl(env: { API_URL: string; AUTH_SECRET: string }, org: string, id: string | null | undefined, ttlSeconds?: number) {
  if (!id) return null;
  const exp = ttlSeconds ? Math.ceil((Date.now() / 1000 + ttlSeconds) / 600) * 600 : (Math.floor(Date.now() / 1000 / WINDOW) + 2) * WINDOW;
  return `${env.API_URL}/v1/files/${org}/${id}?e=${exp}&s=${await sigOf(env.AUTH_SECRET, org, id, exp)}`;
}
export async function checkFileLink(secret: string, org: string, id: string, exp: string | undefined, sig: string | undefined) {
  const e = Number(exp);
  if (!Number.isInteger(e) || e * 1000 < Date.now() || !sig) return false;
  return safeEqual(sig, await sigOf(secret, org, id, e));
}
