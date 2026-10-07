// Completes the Hemlo kit: Arabic/Kurdish/bilingual/stacked lockups (outlined), animated logo, monogram pattern,
// web icons, social banners, design tokens, print files (business card, letterhead), email signature, poster.
// Run: node source/complete.js        -> writes SVG/HTML/CSS/JSON + render-jobs.json
//      node source/complete.js ico    -> builds icons/favicon.ico from the rendered PNGs
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const W = (p, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true }); fs.writeFileSync(path.join(ROOT, p), s); };

if (process.argv[2] === 'ico') {
  const sizes = [16, 32, 48];
  const pngs = sizes.map(s => fs.readFileSync(path.join(ROOT, `icons/favicon-${s}.png`)));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = head.length;
  sizes.forEach((s, i) => {
    const o = 6 + i * 16;
    head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(pngs[i].length, o + 8); head.writeUInt32LE(off, o + 12);
    off += pngs[i].length;
  });
  fs.writeFileSync(path.join(ROOT, 'icons/favicon.ico'), Buffer.concat([head, ...pngs]));
  console.log('favicon.ico written');
  return;
}

const C = { ink: '#0E1420', ink700: '#2B3445', slate: '#5E6776', brass: '#B38B3A', brass300: '#D7B46A', brass700: '#8A6A22', stone: '#F7F7F4', paper: '#F4F3EF', white: '#FFFFFF', line: '#CFCDC4' };

// ---------- The logo: the founder's H mark + the name in Readex Pro (see mark.js) ----------
const f = n => +n.toFixed(4);
const MARK = require("./mark.js");
function pieces(w = 1.6) { return w > 2 ? MARK.SMALL : { A: MARK.A, B: MARK.B }; } // the H mark (piece B is empty)
const M = pieces(1.6), SM = pieces(2.2);
const seal = (x, y, d, a, b, cut = M, cls = ['', '']) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(d / 24)})"><path${cls[0]} d="${cut.A}" fill="${a}"/><path${cls[1]} d="${cut.B}" fill="${b}"/></g>`;
const WD = MARK.WORD;

(async () => {
  // ---------- Arabic / Kurdish wordmark (Vazirmatn 700, HarfBuzz-shaped, outlined) ----------
  const hb = await require('harfbuzzjs');
  const face = hb.createFace(hb.createBlob(fs.readFileSync(path.join(__dirname, 'Vazirmatn.ttf'))), 0);
  const hfont = hb.createFont(face); hfont.setVariations({ wght: 700 });   // Vazirmatn Bold, to sit with Readex Pro SemiBold
  const upem = face.upem;
  const hfontLight = hb.createFont(face); hfontLight.setVariations({ wght: 300 });   // for branch names under the name
  function arabic(text, size, x0, base, F = hfont) {
    const hfont = F;
    const buf = hb.createBuffer(); buf.addText(text); buf.guessSegmentProperties(); hb.shape(hfont, buf);
    const gl = buf.json(); buf.destroy();
    const s = size / upem; let x = 0, parts = [], minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    gl.forEach(g => {
      const d = hfont.glyphToPath(g.g);
      if (d) {
        const gx = x + g.dx, gy = g.dy;
        let k = 0;
        const td = d.replace(/-?\d+(\.\d+)?/g, m => { const v = +m; const out = (k % 2 === 0) ? x0 + (gx + v) * s : base - (gy + v) * s; if (k % 2 === 0) { minX = Math.min(minX, out); maxX = Math.max(maxX, out); } else { minY = Math.min(minY, out); maxY = Math.max(maxY, out); } k++; return f(out); });
        parts.push(td);
      }
      x += g.ax;
    });
    return { g: `<path d="${parts.join('')}"/>`, bb: { x1: minX, x2: maxX, y1: minY, y2: maxY } };
  }

  // ---------- Lockup builders (units: wordmark cap height CAP) ----------
  const CAP = 70.3, SW = CAP / 100, D = 1.55 * CAP, GAP = 0.24 * 100;
  const svg = (w, h, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}"${extra}>${body}</svg>`;
  const palettes = {
    '': { a: C.ink, b: C.brass, t: C.ink },
    '-on-dark': { a: C.white, b: C.brass300, t: C.white },
    '-ink': { a: C.ink, b: C.ink, t: C.ink },
    '-white': { a: C.white, b: C.white, t: C.white },
  };
  const AR = 'هيملو', CKB = 'هێملۆ';
  const arSize = 100; // alef ≈ 0.76 em ≈ 1.08 × the wordmark cap height
  const word = (p, x0, capTop, s = SW) => MARK.wordmarkG(s, x0, capTop, p.t, p.a, p.b);

  // Arabic horizontal lockup (RTL): the name, then the mark on the right
  function lockupRTL(text, p) {
    const probe = arabic(text, arSize, 0, 0);
    const alefH = 0.76 * arSize, base = D / 2 + alefH / 2;
    const w = arabic(text, arSize, -probe.bb.x1, base);
    const tw = probe.bb.x2 - probe.bb.x1;
    const top = Math.min(0, w.bb.y1), bottom = Math.max(D, w.bb.y2);
    const body = `<g fill="${p.t}">${w.g}</g>${seal(tw + GAP, 0, D, p.a, p.b)}`;
    return svg(tw + GAP + D, bottom - top, `<g transform="translate(0 ${f(-top)})">${body}</g>`);
  }
  // Bilingual horizontal: [H] Hemlo | هيملو, both centred on the cap height
  function lockupBilingual(p) {
    const ww = WD.w * SW, gap = 0.42 * CAP, rule = 0.05 * CAP;
    const a0 = arabic(AR, arSize * 0.92, 0, 0), ac = (a0.bb.y1 + a0.bb.y2) / 2;
    const ax = ww + gap * 2 + rule;
    const A = arabic(AR, arSize * 0.92, ax - a0.bb.x1, CAP / 2 - ac);
    const top = Math.min(WD.top * SW, A.bb.y1, -0.12 * CAP), bottom = Math.max(WD.bottom * SW, A.bb.y2, 1.12 * CAP);
    const body = `${word(p, 0, 0)}<rect x="${f(ww + gap)}" y="${f(-0.12 * CAP)}" width="${f(rule)}" height="${f(1.24 * CAP)}" fill="${p.b === p.a ? p.t : p.b}"/><g fill="${p.t}">${A.g}</g>`;
    return svg(A.bb.x2, bottom - top, `<g transform="translate(0 ${f(-top)})">${body}</g>`);
  }
  // Stacked: the mark centred above the wordmark (optionally with the Arabic name below)
  function lockupStacked(p, withArabic) {
    const TX = MARK.TEXT, lw = TX.w * SW, d = CAP * 2.3, gap = CAP * 0.45;
    const A0 = withArabic ? arabic(AR, arSize * 0.8, 0, 0) : null;
    const aw = A0 ? A0.bb.x2 - A0.bb.x1 : 0;
    const w = Math.max(lw, aw, d);
    const capTop = d + gap;
    let h = capTop + TX.bottom * SW, body = `${seal((w - d) / 2, 0, d, p.a, p.b)}<path d="${MARK.nameOnly(SW, (w - lw) / 2, capTop)}" fill="${p.t}"/>`;
    if (A0) {
      const arTop = capTop + CAP + CAP * 0.5;
      const A = arabic(AR, arSize * 0.8, (w - aw) / 2 - A0.bb.x1, arTop - A0.bb.y1);
      body += `<g fill="${p.t}">${A.g}</g>`; h = arTop + (A0.bb.y2 - A0.bb.y1);
    }
    return svg(w, h, body);
  }
  function wordmarkRTL(text, color) {
    const a0 = arabic(text, arSize, 0, 0);
    const a = arabic(text, arSize, -a0.bb.x1, -a0.bb.y1);
    return svg(a0.bb.x2 - a0.bb.x1, a0.bb.y2 - a0.bb.y1, `<g fill="${color}">${a.g}</g>`);
  }

  const logos = {};
  for (const [suf, p] of Object.entries(palettes)) {
    logos[`hemlo-lockup-ar${suf}.svg`] = lockupRTL(AR, p);
    logos[`hemlo-lockup-ckb${suf}.svg`] = lockupRTL(CKB, p);
    logos[`hemlo-lockup-bilingual${suf}.svg`] = lockupBilingual(p);
    logos[`hemlo-lockup-stacked${suf}.svg`] = lockupStacked(p, false);
    logos[`hemlo-lockup-stacked-bilingual${suf}.svg`] = lockupStacked(p, true);
  }
  // ---------- Branch lockups: the H in the branch colour, "Hemlo" (Poppins SemiBold), the branch name under it (Poppins Light) ----------
  const BRANCH = {
    Tools: { c: '#3B5BC4', dark: '#8EA6F0', ar: 'الأدوات' },
    Studio: { c: '#0F766E', dark: '#4FC1B3', ar: 'ستوديو' },
    Systems: { c: '#A8532E', dark: '#E0896A', ar: 'الأنظمة' },
    School: { c: '#6E4A86', dark: '#B08CC8', ar: 'المدارس' },
  };
  const BD = 0.58, BGAP = 30;                       // branch cap = 0.58 × name cap; 0.30 × cap between the lines
  function lockupBranch(name, mc, t, sub) {          // units: name cap = 100 (scaled by SW below)
    const blockH = 100 + BGAP + 100 * BD, MH = blockH * 1.06, MW = MH * MARK.GEO.aspect, gap = 50;
    const markTop = blockH / 2 - MH / 2;
    const nm = MARK.nameOnly(1, MW + gap, 0), br = MARK.branchText(name, BD, MW + gap, 100 + BGAP);
    const w = MW + gap + Math.max(MARK.TEXT.w, br.w), top = Math.min(markTop, MARK.TEXT.top), bottom = Math.max(markTop + MH, blockH + 2);
    const markD = MARK.A;   // 24-grid mark: the H spans 22 of 24 in height
    const k = MH / 22, mx = -((12 - MARK.GEO.w / 2) * k), my = markTop - 1 * k;
    const body = `<g transform="translate(${f(mx)} ${f(my)}) scale(${f(k)})"><path d="${markD}" fill="${mc}"/></g><path d="${nm}" fill="${t}"/><path d="${br.d}" fill="${sub}"/>`;
    return svg(w * SW, (bottom - top) * SW, `<g transform="scale(${SW}) translate(0 ${f(-top)})">${body}</g>`);
  }
  function lockupBranchAR(name, mc, t, sub) {        // RTL: the H on the right, هيملو over the branch name, right-aligned
    const a0 = arabic(AR, arSize, 0, 0), b0 = arabic(BRANCH[name].ar, arSize * 0.66, 0, 0, hfontLight);
    const aw = a0.bb.x2 - a0.bb.x1, bw = b0.bb.x2 - b0.bb.x1, tw = Math.max(aw, bw);
    const aTop = 0, aBase = -a0.bb.y1, bTop = (a0.bb.y2 - a0.bb.y1) + 0.18 * arSize, bBase = bTop - b0.bb.y1;
    const blockH = bTop + (b0.bb.y2 - b0.bb.y1), MH = blockH * 1.02, MW = MH * MARK.GEO.aspect, gap = GAP * 1.4;
    const A = arabic(AR, arSize, tw - aw - a0.bb.x1, aBase), B = arabic(BRANCH[name].ar, arSize * 0.66, tw - bw - b0.bb.x1, bBase, hfontLight);
    const k = MH / 22, mx = tw + gap - (12 - MARK.GEO.w / 2) * k, my = blockH / 2 - MH / 2 - 1 * k;
    const body = `<g fill="${t}">${A.g}</g><g fill="${sub}">${B.g}</g><g transform="translate(${f(mx)} ${f(my)}) scale(${f(k)})"><path d="${MARK.A}" fill="${mc}"/></g>`;
    return svg(tw + gap + MW, blockH, body);
  }
  for (const [name, b] of Object.entries(BRANCH)) {
    const slug = name.toLowerCase();
    logos[`branches/hemlo-${slug}.svg`] = lockupBranch(name, b.c, C.ink, C.ink);
    logos[`branches/hemlo-${slug}-on-dark.svg`] = lockupBranch(name, b.dark, C.white, C.white);
    logos[`branches/hemlo-${slug}-ink.svg`] = lockupBranch(name, C.ink, C.ink, C.ink);
    logos[`branches/hemlo-${slug}-ar.svg`] = lockupBranchAR(name, b.c, C.ink, C.ink);
    logos[`branches/hemlo-${slug}-ar-on-dark.svg`] = lockupBranchAR(name, b.dark, C.white, C.white);
  }

  logos['hemlo-wordmark-ar.svg'] = wordmarkRTL(AR, C.ink);
  logos['hemlo-wordmark-ar-white.svg'] = wordmarkRTL(AR, C.white);
  logos['hemlo-wordmark-ckb.svg'] = wordmarkRTL(CKB, C.ink);

  // Animated logo: the name settles in, then the H slides into place
  {
    const ww = WD.w * SW, y0 = -WD.top * SW, h = (WD.bottom - WD.top) * SW, wm = MARK.wordmark(SW, 0, y0);
    const sx = f(MARK.SEP.x * 7), sy = f(MARK.SEP.y * 7);
    logos['hemlo-logo-animated.svg'] = svg(ww, h, `<style>
.a,.b,.t{animation-duration:1.4s;animation-timing-function:cubic-bezier(.2,0,0,1);animation-fill-mode:both}
.t{animation-name:it;animation-delay:.1s}.a{animation-name:ia;animation-delay:.45s}.b{animation-name:ib;animation-delay:.45s}
@keyframes it{from{transform:translateY(6px);opacity:0}to{transform:none;opacity:1}}
@keyframes ia{from{transform:translate(${-sx}px,${-sy}px)}to{transform:none}}
@keyframes ib{from{transform:translate(${sx}px,${sy}px)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.a,.b,.t{animation:none}}
</style><path class="t" d="${wm.letters}" fill="${C.ink}"/><path class="a" d="${wm.oA}" fill="${C.ink}"/><path class="b" d="${wm.oB}" fill="${C.brass}"/>`);
  }
  Object.entries(logos).forEach(([n, s]) => W('logo/svg/' + n, s));

  // ---------- Monogram pattern (the H mark in offset rows) ----------
  // tile 24 × 12: one mark in the middle of the left half, one straddling the top/bottom edge on the right (brick offset)
  const PS = 0.3;   // mark height ≈ 6.6 of the 12-high tile
  const markAt = (x, y) => `<path d="${M.A}" transform="translate(${f(x - 12 * PS)} ${f(y - 12 * PS)}) scale(${PS})"/>`;
  const patG = (fill, op) => `<g fill="${fill}" opacity="${op}">${markAt(6, 6)}${markAt(18, 0)}${markAt(18, 12)}</g>`;
  const tile = (bg, fill, op) => `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48" viewBox="0 0 24 12">${bg ? `<rect width="24" height="12" fill="${bg}"/>` : ''}${patG(fill, op)}</svg>`;
  W('pattern/hemlo-pattern-tile.svg', tile('', C.ink, 1));
  const patternPage = (bg, fill, op, w, h, scale) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg}}</style></head><body>
<svg width="${w}" height="${h}"><defs><pattern id="p" width="${24 * scale}" height="${12 * scale}" patternUnits="userSpaceOnUse"><g transform="scale(${scale})">${patG(fill, op)}</g></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg></body></html>`;
  W('pattern/_pattern-ink.html', patternPage(C.ink, C.brass300, 0.22, 2400, 1600, 4));
  W('pattern/_pattern-stone.html', patternPage(C.stone, C.ink, 0.10, 2400, 1600, 4));
  W('pattern/_pattern-brass.html', patternPage(C.brass, C.ink, 0.16, 2400, 1600, 4));

  // ---------- Icons ----------
  const iconPage = (px, body) => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${px}px;height:${px}px;overflow:hidden;background:transparent}svg{display:block}</style></head><body>${body}</body></html>`;
  const favicon = s => iconPage(s, `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${seal(0, 0, 24, C.ink, C.brass, SM)}</svg>`);
  [16, 32, 48].forEach(s => W(`icons/_favicon-${s}.html`, favicon(s)));
  const appIcon = (s, frac) => iconPage(s, `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" fill="${C.ink}"/>${seal(s * (1 - frac) / 2, s * (1 - frac) / 2, s * frac, C.white, C.brass300)}</svg>`);
  W('icons/_apple-touch-icon.html', appIcon(180, 0.62));
  W('icons/_icon-192.html', appIcon(192, 0.62));
  W('icons/_icon-512.html', appIcon(512, 0.62));
  W('icons/_icon-maskable-512.html', appIcon(512, 0.5));
  W('icons/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.a{fill:${C.ink}}.b{fill:${C.brass}}@media (prefers-color-scheme:dark){.a{fill:#FFFFFF}.b{fill:${C.brass300}}}</style>${seal(0, 0, 24, '', '', SM, [' class="a"', ' class="b"'])}</svg>`.replace(/ fill=""/g, ''));
  W('icons/site.webmanifest', JSON.stringify({
    name: 'Hemlo', short_name: 'Hemlo', theme_color: C.ink, background_color: C.ink, display: 'standalone',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
  }, null, 2));
  W('icons/head-snippet.html', `<!-- Hemlo icons: copy the files from /icons to your site root -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${C.ink}">
`);

  // ---------- Shared page bits ----------
  const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Vazirmatn:wght@400;500;600;700;800&display=swap">';
  const inl = (s, style) => s.replace('<svg ', `<svg style="${style}" `);
  const LK = lockupFn => lockupFn; // readability
  const lockupH = (p) => svg(WD.w * SW, (WD.bottom - WD.top) * SW, word(p, 0, -WD.top * SW));   // the primary logo is the wordmark
  const LOCK = lockupH(palettes['']), LOCK_DARK = lockupH(palettes['-on-dark']);

  // ---------- Social banners ----------
  const banner = (w, h, safeLeft) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:${C.ink};position:relative;font-family:"IBM Plex Sans"}
.pat{position:absolute;inset:0}
.c{position:absolute;right:${Math.round(w * 0.06)}px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:${Math.round(h * 0.06)}px;padding-left:${safeLeft}px}
.t{font-family:"Readex Pro";font-weight:600;font-size:${Math.round(h * 0.13)}px;letter-spacing:-0.02em;color:#F4F3EF}
.ar{font-family:"Vazirmatn";font-weight:600;font-size:${Math.round(h * 0.075)}px;color:${C.brass300};direction:rtl}
</style></head><body>
<svg class="pat" width="${w}" height="${h}"><defs><pattern id="p" width="72" height="36" patternUnits="userSpaceOnUse"><g transform="scale(3)">${patG(C.brass300, 0.10)}</g></pattern><linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="${C.ink}" stop-opacity="0"/><stop offset=".55" stop-color="${C.ink}" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#p)"/><rect width="100%" height="100%" fill="url(#fade)"/></svg>
<div class="c">${inl(LOCK_DARK, `height:${Math.round(h * 0.16)}px;width:auto`)}<div class="t">Elegantly solved.</div><div class="ar">حلولٌ بإتقان.</div></div>
</body></html>`;
  W('social/_linkedin-banner.html', banner(1584, 396, 420));
  W('social/_x-header.html', banner(1500, 500, 380));

  // ---------- Design tokens ----------
  const tokens = {
    color: {
      ink: { 950: '#0E1420', 700: '#2B3445' }, slate: { 500: '#5E6776', 400: '#8A919C' },
      stone: { 50: '#F7F7F4', 100: '#EFEFEA', 200: '#E2E2DB', 300: '#CBCBC2' },
      night: { 900: '#0C111A', 800: '#131A26', 700: '#1A2230', 600: '#283243' },
      brass: { 300: '#D7B46A', 500: '#B38B3A', 700: '#8A6A22' },
      status: { success: '#1F7A4D', warning: '#B8520A', danger: '#B42331', info: '#2F5DA8' },
      product: { shipments: '#3B5BC4', service: '#0F766E', systems: '#A8532E', school: '#6E4A86', retail: '#5F7A2E' },
    },
    font: { display: 'Readex Pro', sans: 'IBM Plex Sans', mono: 'IBM Plex Mono', arDisplay: 'Vazirmatn', ar: 'Vazirmatn' },
    radius: { sm: 6, md: 10, lg: 14, xl: 20, full: 999 },
    space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
    motion: { micro: '120ms', standard: '180ms', enter: '240ms', exit: '160ms', easeStandard: 'cubic-bezier(.2,0,0,1)', easeExit: 'cubic-bezier(.4,0,1,1)' },
  };
  W('tokens/tokens.json', JSON.stringify(tokens, null, 2));
  W('tokens/tokens.css', `/* Hemlo design tokens · v3 */
:root{
  --ink-950:#0E1420;--ink-700:#2B3445;--slate-500:#5E6776;--slate-400:#8A919C;
  --stone-50:#F7F7F4;--stone-100:#EFEFEA;--stone-200:#E2E2DB;--stone-300:#CBCBC2;
  --night-900:#0C111A;--night-800:#131A26;--night-700:#1A2230;--night-600:#283243;
  --brass-300:#D7B46A;--brass-500:#B38B3A;--brass-700:#8A6A22;
  --success:#1F7A4D;--warning:#B8520A;--danger:#B42331;--info:#2F5DA8;

  --color-bg:var(--stone-50);--color-surface:#FFFFFF;--color-surface-muted:var(--stone-100);
  --color-border:var(--stone-200);--color-border-strong:var(--stone-300);
  --color-text:var(--ink-950);--color-text-muted:var(--slate-500);
  --color-primary:var(--ink-950);--color-primary-fg:#FFFFFF;
  --color-accent:var(--brass-500);--color-accent-text:var(--brass-700);--color-focus:var(--brass-500);
  --color-product:#3B5BC4;

  --font-display:"Readex Pro",system-ui,sans-serif;--font-sans:"IBM Plex Sans",system-ui,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,monospace;--font-ar-display:"Vazirmatn",Tahoma,sans-serif;--font-ar:"Vazirmatn",Tahoma,sans-serif;
  --radius-sm:6px;--radius-md:10px;--radius-lg:14px;--radius-xl:20px;--radius-full:999px;
  --shadow-sm:0 1px 2px rgb(14 20 32 / .06);--shadow-md:0 2px 4px rgb(14 20 32 / .06),0 8px 24px rgb(14 20 32 / .08);
  --duration-micro:120ms;--duration-standard:180ms;--duration-enter:240ms;--duration-exit:160ms;
  --ease-standard:cubic-bezier(.2,0,0,1);--ease-exit:cubic-bezier(.4,0,1,1);
}
[data-theme="dark"]{
  --color-bg:var(--night-900);--color-surface:var(--night-700);--color-surface-muted:var(--night-800);
  --color-border:var(--night-600);--color-text:#E9EAE6;--color-text-muted:#A3ABB8;
  --color-primary:#E9EAE6;--color-primary-fg:var(--ink-950);--color-accent:var(--brass-300);--color-accent-text:var(--brass-300);
}
:lang(ar),:lang(ckb){font-family:var(--font-ar);line-height:1.8;letter-spacing:0}
`);
  W('tokens/tailwind.preset.js', `// Hemlo Tailwind preset (v3 config). Tailwind v4: map the CSS variables in tokens.css with @theme instead.
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0E1420', 700: '#2B3445' }, slate: { 400: '#8A919C', 500: '#5E6776' },
        stone: { 50: '#F7F7F4', 100: '#EFEFEA', 200: '#E2E2DB', 300: '#CBCBC2' },
        night: { 600: '#283243', 700: '#1A2230', 800: '#131A26', 900: '#0C111A' },
        brass: { 300: '#D7B46A', 500: '#B38B3A', 700: '#8A6A22' },
        success: '#1F7A4D', warning: '#B8520A', danger: '#B42331', info: '#2F5DA8',
        bg: 'var(--color-bg)', surface: 'var(--color-surface)', border: 'var(--color-border)',
        text: 'var(--color-text)', muted: 'var(--color-text-muted)', primary: 'var(--color-primary)', accent: 'var(--color-accent)',
      },
      fontFamily: {
        display: ['Readex Pro', 'system-ui', 'sans-serif'], sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'], 'ar-display': ['Vazirmatn', 'Tahoma', 'sans-serif'], ar: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
      transitionTimingFunction: { standard: 'cubic-bezier(.2,0,0,1)', exit: 'cubic-bezier(.4,0,1,1)' },
      transitionDuration: { micro: '120ms', standard: '180ms', enter: '240ms', exit: '160ms' },
    },
  },
};
`);

  // ---------- Print: business card (91 × 61 mm incl. 3 mm bleed), letterhead A4 ----------
  const printBase = `*{margin:0;padding:0;box-sizing:border-box}html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:"IBM Plex Sans"}`;
  W('print/_business-card.html', `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${printBase}
@page{size:91mm 61mm;margin:0}
.pg{width:91mm;height:61mm;position:relative;overflow:hidden;page-break-after:always}
.front{background:#FFFFFF;color:${C.ink}}
.front .in{position:absolute;left:9mm;top:9mm;right:9mm;bottom:9mm;display:flex;flex-direction:column;justify-content:space-between}
.back{background:${C.ink};display:flex;align-items:center;justify-content:center}
.plate{background:#FFFFFF;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3mm}
</style></head><body>
<div class="pg front"><div class="in">${inl(LOCK, 'height:6.6mm;width:auto;align-self:flex-start')}
<div><div style="font-family:'Readex Pro';font-weight:600;font-size:9.5pt">Your Name</div><div style="font-size:7pt;color:${C.slate};margin-top:.6mm">Founder</div>
<div style="font-family:'IBM Plex Mono';font-size:6.4pt;color:${C.slate};margin-top:2.6mm;line-height:1.55">+964 7XX XXX XXXX<br>hello@hemlohq.com · hemlohq.com</div></div></div></div>
<div class="pg back"><svg width="22mm" height="22mm" viewBox="0 0 24 24">${seal(0, 0, 24, C.brass300, C.brass300)}</svg></div>
<div class="pg plate"><svg width="22mm" height="22mm" viewBox="0 0 24 24">${seal(0, 0, 24, '#000', '#000')}</svg></div>
</body></html>`);
  W('print/_letterhead.html', `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${printBase}
@page{size:A4;margin:0}
.pg{width:210mm;height:297mm;position:relative;background:#FFFFFF;color:${C.ink}}
.hd{position:absolute;left:20mm;right:20mm;top:18mm;display:flex;justify-content:space-between;align-items:flex-start}
.ft{position:absolute;left:20mm;right:20mm;bottom:14mm;border-top:.3mm solid ${C.brass300};padding-top:3mm;display:flex;justify-content:space-between;font-size:7.5pt;color:${C.slate}}
</style></head><body><div class="pg">
<div class="hd">${inl(LOCK, 'height:9mm;width:auto')}<div style="font-family:'IBM Plex Mono';font-size:7.5pt;color:${C.slate};text-align:right;line-height:1.6">hemlohq.com<br>hello@hemlohq.com</div></div>
<div class="ft"><span style="font-family:'IBM Plex Mono'">Elegantly solved.</span><span style="font-family:'Vazirmatn';direction:rtl">حلولٌ بإتقان · هيملو</span></div>
</div></body></html>`);

  // ---------- Email signature ----------
  W('email/signature.html', `<!-- Hemlo email signature. Host email/hemlo-lockup-email.png on your site and update the src. -->
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;color:#0E1420;font-size:13px;line-height:1.5">
  <tr><td style="padding:0 0 10px 0"><strong style="font-size:14px">Your Name</strong><br><span style="color:#5E6776">Founder, Hemlo</span></td></tr>
  <tr><td style="padding:0 0 10px 0;color:#5E6776;font-size:12px">+964 7XX XXX XXXX · <a href="https://hemlohq.com" style="color:#8A6A22;text-decoration:none">hemlohq.com</a></td></tr>
  <tr><td style="border-top:1px solid #D7B46A;padding:10px 0 0 0"><img src="https://hemlohq.com/brand/hemlo-lockup-email.png" width="138" height="33" alt="Hemlo" style="display:block;border:0"></td></tr>
  <tr><td style="padding:6px 0 0 0;color:#5E6776;font-size:11px">Elegantly solved. · حلولٌ بإتقان</td></tr>
</table>
`);
  W('email/_lockup-email.html', `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:264px;height:66px;overflow:hidden;background:transparent}</style></head><body>${inl(LOCK, 'height:66px;width:auto;display:block')}</body></html>`);

  // ---------- The poster ----------
  const poster = (H) => {
    const d = 980, cx = 640, cy = H - 250;
    return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:${H}px;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:1080px ${H}px;margin:0}
body{background:${C.paper};color:${C.ink};position:relative;font-family:"IBM Plex Sans"}
.top{position:absolute;left:72px;right:72px;top:62px;display:flex;justify-content:space-between;align-items:center}
.lbl{font-family:"IBM Plex Mono";font-size:14px;letter-spacing:.24em;color:${C.brass700}}
.rule{position:absolute;left:72px;right:72px;top:126px;height:1px;background:${C.line}}
h1{position:absolute;left:64px;top:168px;font-family:"Readex Pro";font-weight:600;font-size:172px;line-height:.92;letter-spacing:-0.045em}
.ar{position:absolute;left:72px;top:512px;font-family:"Vazirmatn";font-weight:700;font-size:48px;direction:rtl;color:${C.ink}}
.seal{position:absolute;left:${cx - d / 2}px;top:${cy - d / 2}px;width:${d}px;height:${d}px}
.foot{position:absolute;left:72px;bottom:58px;font-family:"IBM Plex Mono";font-size:13px;letter-spacing:.2em;color:${C.slate}}
</style></head><body>
<div class="top">${inl(LOCK, 'height:36px;width:auto')}<span class="lbl">COMING SOON</span></div>
<div class="rule"></div>
<h1>Elegantly<br>solved.</h1>
<div class="ar">حلولٌ بإتقان.</div>
<svg class="seal" viewBox="0 0 24 24">${seal(0, 0, 24, C.ink, C.brass)}</svg>
<div class="foot">IRAQ · 2026</div>
</body></html>`;
  };
  W('poster/_poster-4x5.html', poster(1350));
  W('poster/_poster-a3.html', poster(1527));

  // ---------- Render jobs (consumed by PowerShell + Edge) ----------
  const J = [];
  const png = (html, out, w, h, dsf = 1, t = false) => J.push({ kind: 'png', html, out, w, h, dsf, t });
  const pdf = (html, out) => J.push({ kind: 'pdf', html, out });
  // Icons are rasterised in-page on a canvas at exact size (tiny headless windows hang), then dumped as data URLs.
  const favSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${seal(0, 0, 24, C.ink, C.brass, SM)}</svg>`;
  const appSvg = (frac) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${C.ink}"/>${seal(50 - frac * 50, 50 - frac * 50, frac * 100, C.white, C.brass300)}</svg>`;
  const items = [
    ['favicon-16.png', 16, favSvg], ['favicon-32.png', 32, favSvg], ['favicon-48.png', 48, favSvg],
    ['apple-touch-icon.png', 180, appSvg(0.62)], ['icon-192.png', 192, appSvg(0.62)], ['icon-512.png', 512, appSvg(0.62)], ['icon-maskable-512.png', 512, appSvg(0.5)],
  ];
  W('icons/_convert.html', `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
var items=${JSON.stringify(items)};
Promise.all(items.map(function(it){return new Promise(function(res){var img=new Image();img.onload=function(){var c=document.createElement('canvas');c.width=c.height=it[1];c.getContext('2d').drawImage(img,0,0,it[1],it[1]);res([it[0],c.toDataURL('image/png')])};img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(it[2])))})})).then(function(r){document.body.innerHTML='<pre id="out">'+JSON.stringify(r)+'</pre>'});
</script></body></html>`);
  png('pattern/_pattern-ink.html', 'pattern/hemlo-pattern-ink.png', 2400, 1600);
  png('pattern/_pattern-stone.html', 'pattern/hemlo-pattern-stone.png', 2400, 1600);
  png('pattern/_pattern-brass.html', 'pattern/hemlo-pattern-brass.png', 2400, 1600);
  png('social/_linkedin-banner.html', 'social/linkedin-banner-1584x396.png', 1584, 396, 2);
  png('social/_x-header.html', 'social/x-header-1500x500.png', 1500, 500, 2);
  png('email/_lockup-email.html', 'email/hemlo-lockup-email.png', 264, 66, 1, true);
  png('poster/_poster-4x5.html', 'poster/hemlo-poster-4x5.png', 1080, 1350, 2);
  png('poster/_poster-a3.html', 'poster/hemlo-poster-a3-preview.png', 1080, 1527, 1);
  pdf('poster/_poster-a3.html', 'poster/hemlo-poster-a3.pdf');
  pdf('print/_business-card.html', 'print/hemlo-business-card.pdf');
  pdf('print/_letterhead.html', 'print/hemlo-letterhead-a4.pdf');
  // bilingual/arabic/stacked lockups as PNG previews
  const lockPng = (name, w, h) => { W(`logo/png/_${name}.html`, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${logos[name + '.svg']}</body></html>`); png(`logo/png/_${name}.html`, `logo/png/${name}.png`, w, h, 1, true); };
  const vb = n => logos[n + '.svg'].match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  for (const n of [...['tools', 'studio', 'systems', 'school'].flatMap(b => [`branches/hemlo-${b}`, `branches/hemlo-${b}-ar`]), 'hemlo-lockup-ar', 'hemlo-lockup-ar-on-dark', 'hemlo-lockup-bilingual', 'hemlo-lockup-bilingual-on-dark', 'hemlo-lockup-stacked', 'hemlo-lockup-stacked-bilingual', 'hemlo-lockup-stacked-bilingual-on-dark']) {
    const [vw, vh] = vb(n), w = 1600, h = Math.round(w * vh / vw); lockPng(n, w, h);
  }
  fs.writeFileSync(path.join(__dirname, 'render-jobs.json'), JSON.stringify(J, null, 1));
  console.log(Object.keys(logos).length + ' logo files, ' + J.length + ' render jobs');
})();
