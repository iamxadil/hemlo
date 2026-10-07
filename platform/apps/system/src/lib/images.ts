// Photos are made small on the device before they're sent: a 4 MB camera photo becomes ~150 KB, which uploads in a
// second on Iraqi mobile data and keeps storage tiny. The camera's rotation is applied, so nothing arrives sideways.
export type Prepared = { blob: Blob; width: number; height: number };

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, type, q));
const loadImg = (file: File) => new Promise<HTMLImageElement>((ok, fail) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); ok(img); };
  img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('NOT_AN_IMAGE')); };
  img.src = url;
});

/** Resize to fit `max` pixels, as WebP (JPEG where the browser can't make WebP; PNG for logos, to keep transparency). */
export async function prepareImage(file: File, { max = 1280, quality = 0.8, alpha = false } = {}): Promise<Prepared> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('NOT_AN_IMAGE');
  let src: ImageBitmap | HTMLImageElement;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); }
  catch { src = await loadImg(file); }
  const w0 = src.width, h0 = src.height;
  if (!w0 || !h0) throw new Error('NOT_AN_IMAGE');
  const scale = Math.min(1, max / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale)), height = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); } // photos: no transparent holes
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, width, height);
  if ('close' in src) src.close();
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = alpha ? await toBlob(canvas, 'image/png') : await toBlob(canvas, 'image/jpeg', quality);
  if (!blob) throw new Error('NOT_AN_IMAGE');
  return { blob, width, height };
}
