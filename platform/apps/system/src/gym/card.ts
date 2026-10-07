// The member's card, drawn on a canvas so it looks the same everywhere it goes: a tall pass for WhatsApp or the gallery,
// and a real ID-card size (85.6 × 54 mm) for printing and cutting. Iron and ember, the gym's name and logo, the member's
// photo (or initials), their membership, and a big QR the desk and the door can read.

export type CardData = {
  gym: string; logo: string | null; name: string; no: string; code: string; photo: string | null;
  plan: string | null; detail: string | null; active: boolean; kicker: string; hint: string; rtl: boolean;
};

const EMBER = '#E4572E', INK = '#F4F3F0', MUTED = '#9AA0AA';
const FONT = '"Readex Pro", "Vazirmatn", system-ui, sans-serif';
const MONO = 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace';

const loadImg = (url: string | null) => new Promise<HTMLImageElement | null>((ok) => {
  if (!url) return ok(null);
  const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async';
  const t = setTimeout(() => ok(null), 5000);
  i.onload = () => { clearTimeout(t); ok(i); }; i.onerror = () => { clearTimeout(t); ok(null); };
  i.src = url;
});
const fonts = () => Promise.all([document.fonts?.load(`600 40px "Readex Pro"`), document.fonts?.load(`600 40px "Vazirmatn"`, 'ع')]).catch(() => null);
// Arabic and Kurdish initials get a thin space between them, so two letters never read as a word
const initials = (name: string) => { const l = name.trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] ?? ''); return l.join(/[؀-ۿ]/.test(name) ? ' ' : '').toUpperCase(); };

/** Draws `text` at `size`, shrinking it until it fits `max` px wide. */
function fit(x: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number, family = FONT) {
  let s = size;
  do { x.font = `${weight} ${s}px ${family}`; } while (x.measureText(text).width > max && (s -= 2) > 12);
  return s;
}
function cover(x: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, w: number, h: number) {
  const r = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * r, ih = img.naturalHeight * r;
  x.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
}
async function qrModules(text: string) {
  const { default: qrcode } = await import('qrcode-generator');
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return { n: q.getModuleCount(), dark: (r: number, c: number) => q.isDark(r, c) };
}
/** A white tile with the QR inside: solid square modules (scanners read them best), the three corners as rounded eyes. */
function qrTile(x: CanvasRenderingContext2D, q: Awaited<ReturnType<typeof qrModules>>, left: number, top: number, size: number, pad: number, radius: number, shadow: number) {
  x.save();
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = shadow; x.shadowOffsetY = shadow / 3;
  x.fillStyle = '#fff'; x.beginPath(); x.roundRect(left, top, size, size, radius); x.fill();
  x.restore();
  const m = (size - pad * 2) / q.n, ox = left + pad, oy = top + pad;
  const eye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= q.n - 7) || (r >= q.n - 7 && c < 7);
  x.fillStyle = '#0E0F12';
  for (let r = 0; r < q.n; r++) for (let c = 0; c < q.n; c++) {
    if (!q.dark(r, c) || eye(r, c)) continue;
    x.fillRect(ox + c * m - .25, oy + r * m - .25, m + .5, m + .5);
  }
  for (const [r, c] of [[0, 0], [0, q.n - 7], [q.n - 7, 0]]) {
    const ex = ox + c * m, ey = oy + r * m;
    x.fillStyle = '#0E0F12'; x.beginPath(); x.roundRect(ex, ey, m * 7, m * 7, m * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.roundRect(ex + m, ey + m, m * 5, m * 5, m * 1.4); x.fill();
    x.fillStyle = '#0E0F12'; x.beginPath(); x.roundRect(ex + m * 2, ey + m * 2, m * 3, m * 3, m); x.fill();
  }
}
function backdrop(x: CanvasRenderingContext2D, W: number, H: number, radius: number) {
  x.save();
  x.beginPath(); x.roundRect(0, 0, W, H, radius); x.clip();
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1A1D24'); g.addColorStop(1, '#0B0C0F');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * .92, -H * .05, 0, W * .92, -H * .05, Math.max(W, H) * .75);
  glow.addColorStop(0, 'rgba(228,87,46,.42)'); glow.addColorStop(1, 'rgba(228,87,46,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  const low = x.createRadialGradient(0, H, 0, 0, H, Math.max(W, H) * .6);
  low.addColorStop(0, 'rgba(228,87,46,.12)'); low.addColorStop(1, 'rgba(228,87,46,0)');
  x.fillStyle = low; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.028)'; x.lineWidth = 1;
  for (let i = -H; i < W; i += Math.round(W / 40)) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H, 0); x.stroke(); }
  x.fillStyle = EMBER; x.fillRect(0, H - Math.round(H / 110), W, Math.round(H / 110));
  x.restore();
}
/** The gym's logo in a rounded tile, or its first letter on ember. */
function logoTile(x: CanvasRenderingContext2D, logo: HTMLImageElement | null, gym: string, left: number, top: number, s: number) {
  x.save(); x.beginPath(); x.roundRect(left, top, s, s, s * .26); x.clip();
  if (logo) { x.fillStyle = '#fff'; x.fillRect(left, top, s, s); cover(x, logo, left + s / 2, top + s / 2, s, s); }
  else {
    const g = x.createLinearGradient(left, top, left + s, top + s); g.addColorStop(0, '#F08A5D'); g.addColorStop(1, EMBER);
    x.fillStyle = g; x.fillRect(left, top, s, s);
    x.fillStyle = '#fff'; x.font = `600 ${s * .5}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText([...gym.trim()][0] ?? 'G', left + s / 2, top + s / 2 + s * .03);
  }
  x.restore();
}
/** The member's photo in a circle with an ember ring, or their initials. */
function face(x: CanvasRenderingContext2D, photo: HTMLImageElement | null, name: string, cx: number, cy: number, r: number) {
  x.save();
  x.strokeStyle = 'rgba(228,87,46,.9)'; x.lineWidth = r * .05; x.beginPath(); x.arc(cx, cy, r * 1.1, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  if (photo) cover(x, photo, cx, cy, r * 2, r * 2);
  else {
    const g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, '#2C3038'); g.addColorStop(1, '#17191E');
    x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.fillStyle = INK; x.font = `600 ${r * .78}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(initials(name), cx, cy + r * .04);
  }
  x.restore();
}
/** The membership as a pill: a dot (green when it's running) and "3 months · until 12 Jan". */
function pill(x: CanvasRenderingContext2D, d: CardData, cx: number, cy: number, size: number, max: number, align: 'center' | 'start') {
  const text = [d.plan, d.detail].filter(Boolean).join('  ·  ');
  if (!text) return;
  const s = fit(x, text, 500, size, max - size * 2.6);
  const tw = x.measureText(text).width, h = s * 2, w = tw + s * 2.8, dot = s * .32;
  const left = align === 'center' ? cx - w / 2 : d.rtl ? cx - w : cx;
  x.fillStyle = 'rgba(255,255,255,.07)'; x.strokeStyle = 'rgba(255,255,255,.13)'; x.lineWidth = Math.max(1, s / 16);
  x.beginPath(); x.roundRect(left, cy - h / 2, w, h, h / 2); x.fill(); x.stroke();
  const dx = d.rtl ? left + w - s * 1.05 : left + s * 1.05;
  x.fillStyle = d.active ? '#3DBE7B' : EMBER; x.beginPath(); x.arc(dx, cy, dot, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#E3E5E9'; x.textBaseline = 'middle'; x.textAlign = d.rtl ? 'right' : 'left';
  x.fillText(text, d.rtl ? left + w - s * 1.75 : left + s * 1.75, cy + s * .04);
}

async function prepare(d: CardData, withPhoto: boolean) {
  const [, logo, photo, q] = await Promise.all([fonts(), loadImg(d.logo), withPhoto ? loadImg(d.photo) : null, qrModules(`HEMLO-GYM:${d.code}`)]);
  return { logo, photo, q };
}

/** The tall pass: for WhatsApp and the phone's gallery. */
async function drawPass(d: CardData, withPhoto: boolean) {
  const W = 1080, H = 1680, P = 88, { logo, photo, q } = await prepare(d, withPhoto);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!; x.direction = d.rtl ? 'rtl' : 'ltr';
  backdrop(x, W, H, 0);
  // the gym
  const L = 104, lx = d.rtl ? W - P - L : P;
  logoTile(x, logo, d.gym, lx, P, L);
  const tx = d.rtl ? lx - 32 : lx + L + 32, tmax = W - P * 2 - L - 32;
  x.textAlign = d.rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic';
  x.fillStyle = INK; fit(x, d.gym, 600, 48, tmax); x.fillText(d.gym, tx, P + 50);
  x.fillStyle = EMBER; x.font = `600 26px ${FONT}`; if ('letterSpacing' in x) (x as any).letterSpacing = d.rtl ? '0px' : '5px';
  x.fillText(d.rtl ? d.kicker : d.kicker.toUpperCase(), tx, P + 92);
  if ('letterSpacing' in x) (x as any).letterSpacing = '0px';
  // the member
  face(x, photo, d.name, W / 2, 440, 132);
  x.textAlign = 'center'; x.fillStyle = '#fff'; fit(x, d.name, 600, 82, W - P * 2); x.fillText(d.name, W / 2, 680);
  x.fillStyle = MUTED; x.font = `400 36px ${FONT}`; x.fillText(d.no, W / 2, 740);
  pill(x, d, W / 2, 822, 32, W - P * 2, 'center');
  // the QR
  qrTile(x, q, (W - 600) / 2, 910, 600, 48, 52, 70);
  x.textAlign = 'center'; x.fillStyle = '#C9CED6'; x.font = `500 30px ${MONO}`; if ('letterSpacing' in x) (x as any).letterSpacing = '6px';
  x.direction = 'ltr'; x.fillText(d.code, W / 2 + 3, 1572);
  if ('letterSpacing' in x) (x as any).letterSpacing = '0px';
  x.direction = d.rtl ? 'rtl' : 'ltr'; x.textAlign = 'center'; x.fillStyle = MUTED; fit(x, d.hint, 400, 30, W - P * 2); x.fillText(d.hint, W / 2, 1622);
  return c;
}

/** The ID-card size (85.6 × 54 mm at 600 dpi): QR on one side, the gym and the member on the other. */
async function drawPrint(d: CardData, withPhoto: boolean) {
  const S = 2, W = 1012, H = 638, P = 56, { logo, photo, q } = await prepare(d, withPhoto);
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const x = c.getContext('2d')!; x.scale(S, S); x.direction = d.rtl ? 'rtl' : 'ltr';
  backdrop(x, W, H, 38);
  const T = 392, qx = d.rtl ? P : W - P - T;
  qrTile(x, q, qx, 84, T, 30, 30, 30);
  x.textAlign = 'center'; x.fillStyle = '#C9CED6'; x.font = `500 20px ${MONO}`; x.direction = 'ltr';
  if ('letterSpacing' in x) (x as any).letterSpacing = '4px';
  x.fillText(d.code, qx + T / 2 + 2, 84 + T + 44);
  if ('letterSpacing' in x) (x as any).letterSpacing = '0px';
  x.direction = d.rtl ? 'rtl' : 'ltr';
  const sx = d.rtl ? W - P : P, max = W - P * 2 - T - 48, L = 66;
  logoTile(x, logo, d.gym, d.rtl ? sx - L : sx, P, L);
  const tx = d.rtl ? sx - L - 20 : sx + L + 20;
  x.textAlign = d.rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic';
  x.fillStyle = INK; fit(x, d.gym, 600, 30, max - L - 20); x.fillText(d.gym, tx, P + 30);
  x.fillStyle = EMBER; x.font = `600 17px ${FONT}`; x.fillText(d.rtl ? d.kicker : d.kicker.toUpperCase(), tx, P + 58);
  face(x, photo, d.name, d.rtl ? sx - 62 : sx + 62, 268, 62);
  x.textAlign = d.rtl ? 'right' : 'left'; x.fillStyle = '#fff'; fit(x, d.name, 600, 46, max); x.fillText(d.name, sx, 408);
  x.fillStyle = MUTED; x.font = `400 24px ${FONT}`; x.fillText(d.no, sx, 448);
  pill(x, d, sx, 512, 21, max, 'start');
  return c;
}

/** Draws with the photo; if the photo can't be used on a canvas (another site that doesn't allow it), draws without it. */
async function render(draw: typeof drawPass, d: CardData) {
  const c = await draw(d, true);
  try { c.getContext('2d')!.getImageData(0, 0, 1, 1); return c; } catch { return draw(d, false); }
}
const blobOf = (c: HTMLCanvasElement) => new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));

export async function passImage(d: CardData) { const c = await render(drawPass, d); return { url: c.toDataURL('image/png'), blob: await blobOf(c) }; }

/** Prints the card at its real size on an A4 page, with a fine dashed line to cut along. */
export async function printCard(d: CardData) {
  const c = await render(drawPrint, d), src = c.toDataURL('image/png');
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;';
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${d.name.replace(/</g, '')}</title><style>@page{size:A4;margin:14mm}html,body{margin:0}body{display:grid;justify-items:center;padding-top:6mm}div{padding:1.6mm;border:.25mm dashed #9aa0aa;border-radius:4.6mm}img{display:block;width:85.6mm;height:54mm;border-radius:3.2mm}</style></head><body><div><img src="${src}"></div></body></html>`;
  document.body.appendChild(f);
  f.onload = () => {
    const w = f.contentWindow!; const img = w.document.querySelector('img')!;
    const go = () => { w.focus(); w.print(); setTimeout(() => f.remove(), 60_000); };
    img.complete ? go() : (img.onload = go);
  };
}
