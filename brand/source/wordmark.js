// Outlines the logo type and saves it to wordmark.json, in "cap units" (cap height of the NAME = 100,
// cap top at y 0, first letter's left edge at x 0):
//   - the name "Hemlo" in Poppins SemiBold (600), −1% tracking (top-level d / w / top / bottom)
//   - the branch names in Poppins Light (300), +1% tracking, drawn at the same unit scale (branches.*)
// Run this before build.js / complete.js / realistic.js (harfbuzz is async; the other scripts read the JSON).
const fs = require('fs');
const path = require('path');

const BRANCHES = ['Tools', 'Studio', 'Systems', 'School'];

(async () => {
  const hb = await require('harfbuzzjs');
  const load = file => { const face = hb.createFace(hb.createBlob(fs.readFileSync(path.join(__dirname, file))), 0); return { face, font: hb.createFont(face), upem: face.upem }; };
  const semi = load('Poppins-SemiBold.ttf'), light = load('Poppins-Light.ttf');

  const nums = d => (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  // cap height of a font, measured on its H
  function capOf(F) {
    const b = hb.createBuffer(); b.addText('H'); b.guessSegmentProperties(); hb.shape(F.font, b);
    const g = b.json()[0]; b.destroy(); const ys = nums(F.font.glyphToPath(g.g)).filter((_, k) => k % 2 === 1);
    return { cap: Math.max(...ys) - Math.min(...ys), base: Math.min(...ys) };
  }
  const semiCap = capOf(semi), lightCap = capOf(light);

  // outline `text` in font F; `unit` = font units per cap unit; returns path in cap units with its own cap top at 0
  function outline(F, text, trackEm, unit, capInfo) {
    const b = hb.createBuffer(); b.addText(text); b.guessSegmentProperties(); hb.shape(F.font, b);
    const glyphs = b.json(); b.destroy();
    let x = 0; const parts = [];
    glyphs.forEach((g, i) => { parts.push({ d: F.font.glyphToPath(g.g), dx: x + g.dx, dy: g.dy }); x += g.ax + (i < glyphs.length - 1 ? trackEm * F.upem : 0); });
    const first = nums(parts[0].d).filter((_, k) => k % 2 === 0), left = Math.min(...first) + parts[0].dx;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const capTop = capInfo.base + capInfo.cap;
    const d = parts.map(p => { let k = 0; return p.d.replace(/-?\d+(\.\d+)?/g, m => {
      const v = +m, out = k % 2 === 0 ? (p.dx + v - left) / unit : (capTop - (p.dy + v)) / unit;
      if (k % 2 === 0) { minX = Math.min(minX, out); maxX = Math.max(maxX, out); } else { minY = Math.min(minY, out); maxY = Math.max(maxY, out); }
      k++; return +out.toFixed(3); }); }).join('');
    return { d, w: maxX, top: minY, bottom: maxY, cap: capInfo.cap / unit };
  }

  const unit = semiCap.cap / 100;                          // name cap = 100
  const name = outline(semi, 'Hemlo', -0.01, unit, semiCap);
  const branches = {};
  for (const b of BRANCHES) branches[b] = outline(light, b, 0.01, lightCap.cap / 100, lightCap);   // each branch name: its own cap = 100 (scaled by the lockup)
  fs.writeFileSync(path.join(__dirname, 'wordmark.json'), JSON.stringify({ text: 'Hemlo', font: 'Poppins SemiBold 600, -1%', branchFont: 'Poppins Light 300, +1%', ...name, branches }, null, 1));
  console.log('wordmark.json: name w', name.w.toFixed(1), 'top', name.top.toFixed(1), 'bottom', name.bottom.toFixed(1), '| branches', BRANCHES.map(b => b + ' ' + branches[b].w.toFixed(0)).join(', '));
})();
