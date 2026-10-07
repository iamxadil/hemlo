// The Hemlo logo.
// - The mark: the founder's single-letter H (hemlo-logo-master.svg), used exactly as drawn.
// - The name: "Hemlo" in Poppins SemiBold, outlined by wordmark.js into wordmark.json (branch names in Poppins Light).
// - The lockup: the mark to the left of the name, the mark 1.4 × the cap height, centred on the caps.
// Scripts use piece A = the mark (piece B is empty; kept so older call sites still work).
const fs = require('fs');
const path = require('path');
const f = n => +n.toFixed(3);

// ---------- tiny SVG path parser (M L H V C S Z, absolute and relative) -> absolute M/L/C/Z ----------
function parse(d) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g);
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = null, lcy = null; const out = [];
  const num = () => +toks[i++];
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === 'Z') { out.push(['Z']); x = sx; y = sy; lcx = null; continue; }
    if (C === 'M') { x = sx = num() + (rel ? x : 0); y = sy = num() + (rel ? y : 0); out.push(['M', x, y]); cmd = rel ? 'l' : 'L'; lcx = null; continue; }
    if (C === 'L') { x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); out.push(['L', x, y]); lcx = null; continue; }
    if (C === 'H') { x = num() + (rel ? x : 0); out.push(['L', x, y]); lcx = null; continue; }
    if (C === 'V') { y = num() + (rel ? y : 0); out.push(['L', x, y]); lcx = null; continue; }
    if (C === 'C' || C === 'S') {
      let x1, y1;
      if (C === 'C') { x1 = num() + (rel ? x : 0); y1 = num() + (rel ? y : 0); }
      else { x1 = lcx === null ? x : 2 * x - lcx; y1 = lcy === null ? y : 2 * y - lcy; }
      const x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0), ex = num() + (rel ? x : 0), ey = num() + (rel ? y : 0);
      out.push(['C', x1, y1, x2, y2, ex, ey]); lcx = x2; lcy = y2; x = ex; y = ey; continue;
    }
    if (C === 'Q') {   // quadratic -> cubic (font outlines from harfbuzz use Q)
      const qx = num() + (rel ? x : 0), qy = num() + (rel ? y : 0), ex = num() + (rel ? x : 0), ey = num() + (rel ? y : 0);
      out.push(['C', x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey), ex, ey]); lcx = null; x = ex; y = ey; continue;
    }
    throw new Error('Unsupported path command ' + cmd);
  }
  return out;
}
const map = (segs, fn) => segs.map(s => s[0] === 'Z' ? s : [s[0], ...s.slice(1).reduce((a, v, k) => (k % 2 ? a : a.concat(fn(v, s[k + 2]))), [])]);
const str = segs => segs.map(s => s[0] + (s.length > 1 ? s.slice(1).map(f).join(' ') : '')).join('');
function bbox(segs) {
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9, px = 0, py = 0;
  const add = (x, y) => { x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y); };
  for (const s of segs) {
    if (s[0] === 'M' || s[0] === 'L') { add(s[1], s[2]); px = s[1]; py = s[2]; }
    else if (s[0] === 'C') { for (let t = 0; t <= 1.0001; t += 0.05) { const u = 1 - t; add(u*u*u*px + 3*u*u*t*s[1] + 3*u*t*t*s[3] + t*t*t*s[5], u*u*u*py + 3*u*u*t*s[2] + 3*u*t*t*s[4] + t*t*t*s[6]); } px = s[5]; py = s[6]; }
  }
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

// ---------- the mark, from the master (the first <path>; the white background <rect> is ignored) ----------
const src = fs.readFileSync(path.join(__dirname, 'hemlo-logo-master.svg'), 'utf8');
const H = parse(src.match(/<path[^>]*\sd="([^"]+)"/)[1]);
const hb = bbox(H);
// fitted to a 24-unit grid: height 22, centred
const k = 22 / Math.max(hb.w, hb.h), cx = (hb.x1 + hb.x2) / 2, cy = (hb.y1 + hb.y2) / 2;
const toGrid = (x, y) => [12 + (x - cx) * k, 12 + (y - cy) * k];
const MASTER = { A: str(map(H, toGrid)), B: '' };
const GEO = { k, w: hb.w * k, h: hb.h * k, aspect: hb.w / hb.h };
// the crossbar runs down to the right at the angle drawn in the master (l-49.21-19.06 / l17.19 6.66)
const slope = 19.06 / 49.21;
const cross = toGrid(752, 745);         // the middle of the crossbar in the master
const GUIDES = `M0 0V24M24 0V24M0 0H24M0 24H24M12 0V24M0 12H24M${f(12 - GEO.w / 2)} 0V24M${f(12 + GEO.w / 2)} 0V24M0 1H24M0 23H24`;
const FOLD = `M${f(cross[0] - 9)} ${f(cross[1] - 9 * slope)}L${f(cross[0] + 9)} ${f(cross[1] + 9 * slope)}`;   // the crossbar angle, extended
const SEP = { x: 1, y: 0 };

// ---------- the name and the lockup (cap units: cap height 100, cap top at y 0) ----------
const WJ = JSON.parse(fs.readFileSync(path.join(__dirname, 'wordmark.json'), 'utf8'));
const NAME = parse(WJ.d);
const MH = 140, MW = MH * GEO.aspect, GAP = 44;             // mark height 1.4 × cap, gap 0.44 × cap
const markY = 50 - MH / 2;                                   // centred on the caps
const markInCap = map(H, (x, y) => [(x - hb.x1) / hb.h * MH, markY + (y - hb.y1) / hb.h * MH]);
const nameInCap = map(NAME, (x, y) => [MW + GAP + x, y]);
const WORD = { w: MW + GAP + WJ.w, top: Math.min(markY, WJ.top), bottom: Math.max(markY + MH, WJ.bottom), cap: 100 };
const TEXT = { w: WJ.w, top: WJ.top, bottom: WJ.bottom };

// place the lockup: scale s (cap height = 100*s), cap top at (x0, y0)
function wordmark(s = 1, x0 = 0, y0 = 0) {
  const t = segs => str(map(segs, (x, y) => [x0 + x * s, y0 + y * s]));
  return { letters: t(nameInCap), oA: t(markInCap), oB: '', w: WORD.w * s, top: y0 + WORD.top * s, bottom: y0 + WORD.bottom * s };
}
// full-colour lockup group: name in t, mark in a (b unused)
const wordmarkG = (s, x0, y0, t, a, b, attrs = '') => { const w = wordmark(s, x0, y0); return `<path d="${w.letters}" fill="${t}"${attrs}/><path d="${w.oA}" fill="${a}"${attrs}/>`; };
// the name on its own
function nameOnly(s = 1, x0 = 0, y0 = 0) { return str(map(NAME, (x, y) => [x0 + x * s, y0 + y * s])); }

// a branch name (Poppins Light) with ITS cap height = 100*s, cap top at (x0, y0)
const BR = WJ.branches || {};
function branchText(name, s = 1, x0 = 0, y0 = 0) { const b = BR[name]; return { d: str(map(parse(b.d), (x, y) => [x0 + x * s, y0 + y * s])), w: b.w * s }; }

module.exports = { BR, branchText, A: MASTER.A, B: MASTER.B, SMALL: MASTER, GEO, GUIDES, FOLD, WORD, TEXT, wordmark, wordmarkG, nameOnly, SEP, MASTER_D: str(H) };
if (require.main === module) console.log(JSON.stringify({ hb, GEO, WORD, TEXT }, null, 1));
