// Direct printing to thermal receipt printers (ESC/POS), no print dialog. The receipt is drawn as an image first,
// so Arabic prints perfectly on any printer, then sent as raster lines. Also: cutting paper and opening the cash drawer.
// Transports: Web Serial (printers that show up as a COM port) and WebUSB (USB printers, e.g. on Android). Chrome/Edge only.

export type Paper = 58 | 80;
export interface PrinterPrefs { mode: 'dialog' | 'direct'; paper: Paper; auto: boolean; drawer: boolean; transport?: 'serial' | 'usb' }
const KEY = 'hemlo.printer';
export const printerPrefs = {
  get(): PrinterPrefs { try { return { mode: 'dialog', paper: 80, auto: false, drawer: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { mode: 'dialog', paper: 80, auto: false, drawer: true }; } },
  set(p: Partial<PrinterPrefs>) { localStorage.setItem(KEY, JSON.stringify({ ...printerPrefs.get(), ...p })); },
};

const ESC = 0x1b, GS = 0x1d;
export const INIT = [ESC, 0x40];
export const FEED_CUT = [ESC, 0x64, 4, GS, 0x56, 0x42, 0x00];
export const KICK = [ESC, 0x70, 0x00, 0x19, 0xfa]; // pulse the drawer pin 2

/** 1-bit raster (GS v 0) from a canvas, in bands so small printer buffers cope. */
export function rasterBytes(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  const px = ctx.getImageData(0, 0, w, h).data;
  const bytesPerRow = Math.ceil(w / 8), out: number[] = [];
  for (let y0 = 0; y0 < h; y0 += 128) {
    const rows = Math.min(128, h - y0);
    out.push(GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8);
    for (let y = y0; y < y0 + rows; y++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x >= w) continue;
          const i = (y * w + x) * 4;
          const lum = px[i + 3] < 128 ? 255 : 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (lum < 160) byte |= 0x80 >> bit;
        }
        out.push(byte);
      }
    }
  }
  return new Uint8Array(out);
}

export interface ReceiptData {
  shop: string; logo?: string | null; city?: string | null; title: string; meta: string[]; lines: { name: string; detail: string; amount: string }[];
  totals: { label: string; value: string; strong?: boolean }[]; footer: string; rtl: boolean;
}

/** Draw a receipt at the printer's real resolution (203 dpi: 576 dots for 80 mm, 384 for 58 mm). */
export function drawReceipt(r: ReceiptData, paper: Paper, logo?: HTMLImageElement | null): HTMLCanvasElement {
  const W = paper === 80 ? 576 : 384, pad = 8, s = paper === 80 ? 1 : 0.75;
  const font = (px: number, bold = false) => `${bold ? 700 : 500} ${Math.round(px * s)}px ${r.rtl ? 'Vazirmatn' : 'Readex Pro'}, Tahoma, sans-serif`;
  const c = document.createElement('canvas'); c.width = W; c.height = 4000;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height); x.fillStyle = '#000'; x.textBaseline = 'top'; x.direction = r.rtl ? 'rtl' : 'ltr';
  const start = r.rtl ? W - pad : pad, end = r.rtl ? pad : W - pad;
  let y = 10;
  const text = (t: string, px: number, align: 'start' | 'end' | 'center', bold = false) => {
    x.font = font(px, bold); x.textAlign = align === 'center' ? 'center' : r.rtl ? (align === 'start' ? 'right' : 'left') : (align === 'start' ? 'left' : 'right');
    x.fillText(t, align === 'center' ? W / 2 : align === 'start' ? start : end, y);
  };
  const rule = () => { y += 8 * s; x.setLineDash([6, 5]); x.lineWidth = 2; x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke(); x.setLineDash([]); y += 12 * s; };
  if (logo?.naturalWidth) { // the shop's logo, centred, at most half the paper wide
    const k = Math.min((W * 0.5) / logo.naturalWidth, (130 * s) / logo.naturalHeight);
    const w = logo.naturalWidth * k, h = logo.naturalHeight * k;
    x.drawImage(logo, (W - w) / 2, y, w, h); y += h + 12 * s;
  }
  text(r.shop, 34, 'center', true); y += 44 * s;
  if (r.city) { text(r.city, 22, 'center'); y += 30 * s; }
  rule();
  text(r.title, 24, 'start', true); y += 32 * s;
  for (const m of r.meta) { text(m, 22, 'start'); y += 30 * s; }
  rule();
  for (const l of r.lines) { text(l.name, 24, 'start'); text(l.amount, 24, 'end', true); y += 32 * s; text(l.detail, 20, 'start'); y += 30 * s; }
  rule();
  for (const tt of r.totals) { text(tt.label, tt.strong ? 30 : 22, 'start', tt.strong); text(tt.value, tt.strong ? 30 : 22, 'end', tt.strong); y += (tt.strong ? 42 : 30) * s; }
  rule();
  text(r.footer, 22, 'center'); y += 30 * s;
  text('hemlohq.com', 16, 'center'); y += 30;
  const out = document.createElement('canvas'); out.width = W; out.height = Math.ceil(y);
  out.getContext('2d')!.drawImage(c, 0, 0);
  return out;
}

/** An image that a canvas may read (the logo link allows it). */
const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, fail) => {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => ok(img); img.onerror = fail; img.src = src;
  setTimeout(() => fail(new Error('timeout')), 4000);
});

// ---------------- the connection to the printer ----------------
const nav = navigator as any;
export const directSupported = () => !!(nav.serial || nav.usb);
let port: any = null, usb: { device: any; endpoint: number } | null = null;

async function openSerial(p: any) { if (!p.writable) await p.open({ baudRate: 9600 }); port = p; }
async function openUsb(device: any) {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const iface = device.configuration.interfaces.find((i: any) => i.alternates.some((a: any) => a.interfaceClass === 7)) ?? device.configuration.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);
  const ep = iface.alternates[0].endpoints.find((e: any) => e.direction === 'out');
  usb = { device, endpoint: ep.endpointNumber };
}

/** Ask the person to pick the printer (needs a click). */
export async function choosePrinter(kind: 'serial' | 'usb') {
  if (kind === 'serial') await openSerial(await nav.serial.requestPort());
  else await openUsb(await nav.usb.requestDevice({ filters: [{ classCode: 7 }] }).catch(() => nav.usb.requestDevice({ filters: [] })));
  printerPrefs.set({ transport: kind, mode: 'direct' });
}

/** Reopen the printer chosen before (no prompt). */
async function ensure() {
  const t = printerPrefs.get().transport;
  if (t === 'serial' && !port && nav.serial) { const [p] = await nav.serial.getPorts(); if (p) await openSerial(p); }
  if (t === 'usb' && !usb && nav.usb) { const [d] = await nav.usb.getDevices(); if (d) await openUsb(d); }
  if (!port && !usb) throw new Error('NO_PRINTER');
}

export async function send(bytes: Uint8Array) {
  await ensure();
  if (port) { const w = port.writable.getWriter(); try { await w.write(bytes); } finally { w.releaseLock(); } return; }
  for (let i = 0; i < bytes.length; i += 16384) await usb!.device.transferOut(usb!.endpoint, bytes.slice(i, i + 16384));
}

export const joinBytes = (...parts: (number[] | Uint8Array)[]) => { const all = parts.flatMap((p) => [...p]); return new Uint8Array(all); };

export async function printDirect(r: ReceiptData, opts: { kick: boolean }) {
  const prefs = printerPrefs.get();
  if (document.fonts?.ready) await document.fonts.ready;
  const logo = r.logo ? await loadImage(r.logo).catch(() => null) : null; // no logo is better than no receipt
  await send(joinBytes(INIT, rasterBytes(drawReceipt(r, prefs.paper, logo)), FEED_CUT, opts.kick ? KICK : []));
}
export const openDrawer = () => send(joinBytes(INIT, KICK));

// For checking what the printer will get (Settings test page, browser tests): the receipt image as a data URL, and its size in bytes.
(globalThis as any).hemloReceiptPreview = (r: ReceiptData, paper: Paper = 80) => { const c = drawReceipt(r, paper); return { png: c.toDataURL(), bytes: rasterBytes(c).length, height: c.height }; };
