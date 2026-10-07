// Pictures: the store's photographs (data/photos.ts), photos the visitor uploads, or drawn art (art.ts). Uploads are shrunk in the browser (longest side 1400 px,
// WebP) before they're kept, so the demo stays fast even after someone adds twenty phone photos.
import { signal } from '@preact/signals';
import { PHOTOS, type Photo } from '../data/photos';
import { artSvg, type Frame } from './art';
import * as db from './db';
import { uid } from './id';
import type { Doc, Pic } from './types';

const urls = new Map<string, string>();
/** Bumps when an uploaded photo becomes ready, so pictures waiting on it draw again. */
export const mediaTick = signal(0);
const loading = new Set<string>();

/** The store photograph behind a `photo:<key>` picture, if it is one. */
export const photoOf = (pic: Pic | undefined): [string, Photo] | null => {
  if (!pic?.startsWith('photo:')) return null;
  const key = pic.slice(6), p = PHOTOS[key];
  return p ? [key, p] : null;
};
/** "/photos/noir-400.avif 400w, /photos/noir-640.avif 640w, …" */
export const srcsetOf = (key: string, p: Photo, fmt: 'avif' | 'webp') => p.widths.map((w) => `/photos/${key}-${w}.${fmt} ${w}w`).join(', ');
/** One fixed size of a photograph (the nearest made at or above `want`). */
export const photoAt = (key: string, p: Photo, want = 640, fmt: 'avif' | 'webp' = 'webp') => `/photos/${key}-${p.widths.find((w) => w >= want) ?? p.widths[p.widths.length - 1]}.${fmt}`;

/** A URL for a picture right now: drawn art at once; an uploaded photo once it has been read from the browser's database. */
export function picUrl(pic: Pic | undefined, frame?: Frame): string | null {
  if (!pic) return null;
  const ph = photoOf(pic);
  if (ph) return photoAt(ph[0], ph[1]);
  if (pic.startsWith('art:')) return artSvg(pic, frame);
  if (pic.startsWith('idb:')) {
    const id = pic.slice(4), hit = urls.get(id);
    if (hit) return hit;
    if (!loading.has(id)) {
      loading.add(id);
      db.get<Blob>('media', id).then((b) => { if (b) { urls.set(id, URL.createObjectURL(b)); mediaTick.value++; } loading.delete(id); });
    }
    return null;
  }
  return pic; // a plain URL
}

/** Shrinks a photo and keeps it; returns the picture name to store on a product or banner. */
export async function savePhoto(file: File, max = 1400): Promise<Pic> {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * r), h = Math.round(bmp.height * r);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h); bmp.close();
  const blob = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('image'))), 'image/webp', 0.84));
  const id = uid();
  await db.set('media', id, blob);
  urls.set(id, URL.createObjectURL(blob));
  return `idb:${id}`;
}

/** Forgets uploaded photos nothing points at any more (run after saving). */
export async function sweepMedia(doc: Doc) {
  const all = await db.keys('media'), used = new Set<string>();
  const add = (p: Pic) => p.startsWith('idb:') && used.add(p.slice(4));
  doc.products.forEach((p) => p.pics.forEach(add)); doc.banners.forEach((b) => add(b.pic)); doc.categories.forEach((c) => add(c.pic));
  doc.orders.forEach((o) => o.lines.forEach((l) => add(l.pic)));
  for (const id of all) if (!used.has(id)) { await db.del('media', id); const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); } }
}
