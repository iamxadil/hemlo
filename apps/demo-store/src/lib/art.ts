// The demo's own product pictures, drawn as SVG: perfume bottles and care jars in soft studio light. No downloads, no
// borrowed photos, and they stay sharp at any size. A picture is named `art:<shape>:<liquid>:<cap>:<backdrop>`.

export type Shape = 'round' | 'tall' | 'square' | 'flacon' | 'jar' | 'tube';
const cache = new Map<string, string>();

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16), c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
};

/** Each shape: the glass outline, the liquid inside it, the neck/cap box, and where a label sits. */
const SHAPES: Record<Shape, { glass: string; liquid: string; cap: [number, number, number, number, number]; label?: [number, number, number, number] }> = {
  round: { glass: 'M300 250c88 0 150 62 150 150s-62 160-150 160-150-72-150-160 62-150 150-150z', liquid: 'M160 410c40-14 240-14 280 0-4 84-64 140-140 140s-136-56-140-140z', cap: [262, 150, 76, 96, 14], label: [240, 380, 120, 46] },
  tall: { glass: 'M232 230h136c14 0 24 10 24 24v300c0 14-10 24-24 24H232c-14 0-24-10-24-24V254c0-14 10-24 24-24z', liquid: 'M214 330h172v222c0 12-8 20-20 20H234c-12 0-20-8-20-20z', cap: [268, 110, 64, 118, 10], label: [246, 400, 108, 56] },
  square: { glass: 'M190 260h220c16 0 28 12 28 28v236c0 16-12 28-28 28H190c-16 0-28-12-28-28V288c0-16 12-28 28-28z', liquid: 'M168 360h264v162c0 14-10 24-24 24H192c-14 0-24-10-24-24z', cap: [250, 160, 100, 98, 18], label: [236, 410, 128, 52] },
  flacon: { glass: 'M300 236c70 0 128 40 128 120 0 110-56 200-128 200s-128-90-128-200c0-80 58-120 128-120z', liquid: 'M178 380c50-10 194-10 244 0-8 96-58 168-122 168s-114-72-122-168z', cap: [276, 120, 48, 116, 24], label: [252, 400, 96, 44] },
  jar: { glass: 'M170 330h260c14 0 24 10 24 24v170c0 22-18 40-40 40H186c-22 0-40-18-40-40V354c0-14 10-24 24-24z', liquid: 'M150 400h300v120c0 20-16 36-36 36H186c-20 0-36-16-36-36z', cap: [160, 268, 280, 66, 18], label: [230, 420, 140, 54] },
  tube: { glass: 'M236 170h128l20 340c1 18-12 32-30 32H246c-18 0-31-14-30-32z', liquid: 'M232 240h136l16 270c1 18-12 32-30 32H246c-18 0-31-14-30-32z', cap: [250, 540, 100, 54, 10], label: [252, 330, 96, 60] },
};

/** `frame`: the usual portrait, or a wide banner with the bottle toward the end (right in English, left in Arabic). */
export type Frame = 'tall' | 'wide-end' | 'wide-start';
const VIEW: Record<Frame, string> = { tall: '0 0 600 700', 'wide-end': '-720 0 1320 700', 'wide-start': '0 0 1320 700' };

export function artSvg(pic: string, frame: Frame = 'tall') {
  const key = pic + frame, hit = cache.get(key);
  if (hit) return hit;
  const [, shape = 'round', liquid = '#C9A06A', cap = '#2A211B', back = '#EFE7DC'] = pic.split(':');
  const s = SHAPES[shape as Shape] ?? SHAPES.round, [cx, cy, cw, ch, cr] = s.cap, id = pic.replace(/[^a-z0-9]/gi, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW[frame]}" preserveAspectRatio="xMidYMid slice">
<defs>
<radialGradient id="b${id}" gradientUnits="userSpaceOnUse" cx="300" cy="280" r="620"><stop offset="0" stop-color="${shade(back, 1.06)}"/><stop offset="1" stop-color="${shade(back, .9)}"/></radialGradient>
<linearGradient id="l${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(liquid, 1.18)}"/><stop offset=".55" stop-color="${liquid}"/><stop offset="1" stop-color="${shade(liquid, .62)}"/></linearGradient>
<linearGradient id="c${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(cap, .7)}"/><stop offset=".45" stop-color="${shade(cap, 1.35)}"/><stop offset="1" stop-color="${shade(cap, .8)}"/></linearGradient>
<linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".22" stop-color="#fff" stop-opacity=".08"/><stop offset=".8" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient>
<filter id="s${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
<rect x="-800" width="2200" height="700" fill="url(#b${id})"/>
<ellipse cx="300" cy="600" rx="190" ry="26" fill="#000" opacity=".16" filter="url(#s${id})"/>
<path d="${s.glass}" fill="${shade(liquid, 1.25)}" opacity=".35"/>
<path d="${s.liquid}" fill="url(#l${id})"/>
<path d="${s.glass}" fill="url(#g${id})" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="${cr}" fill="url(#c${id})"/>
${s.label ? `<rect x="${s.label[0]}" y="${s.label[1]}" width="${s.label[2]}" height="${s.label[3]}" rx="4" fill="#fff" opacity=".82"/><text x="${s.label[0] + s.label[2] / 2}" y="${s.label[1] + s.label[3] / 2 + 7}" text-anchor="middle" font-family="Georgia,serif" font-size="20" letter-spacing="5" fill="${shade(cap, 1)}">LAYAL</text>` : ''}
</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg.replace(/\n/g, ''))}`;
  cache.set(key, url);
  return url;
}
