// The demo's sample register page: drawn here (so its dates are always around today), in Ruqaa, the hand most people in
// Iraq write in, on a ruled page photographed on a desk. Loaded only when someone taps "try a sample page".
export type PageRow = { name: string; phone: string; plan: string; from: string; owes: string; note: string };

let fonts: Promise<unknown> | null = null;
const loadFonts = () => (fonts ??= Promise.all([
  new FontFace('Hemlo Ruqaa', 'url(/fonts/aref-ruqaa-arabic.woff2)', { unicodeRange: 'U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFC' }).load(),
  new FontFace('Hemlo Ruqaa', 'url(/fonts/aref-ruqaa-latin.woff2)', { unicodeRange: 'U+0000-00FF' }).load(),
]).then((faces) => faces.forEach((f) => document.fonts.add(f))).catch(() => {}));

/** The page, as a JPEG data URL (about the size of a phone photo, shrunk). */
export async function drawSamplePage(rows: PageRow[], title: string, cols: string[]) {
  await loadFonts();
  const W = 1100, H = 1460, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // the desk under the page
  const desk = g.createLinearGradient(0, 0, W, H); desk.addColorStop(0, '#4A3A2E'); desk.addColorStop(1, '#2E241D');
  g.fillStyle = desk; g.fillRect(0, 0, W, H);
  // the page, a little crooked, with its shadow
  g.save(); g.translate(W / 2, H / 2); g.rotate(-0.025);
  const pw = 940, ph = 1300, x0 = -pw / 2, y0 = -ph / 2;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40; g.shadowOffsetY = 18;
  g.fillStyle = '#F7F2E4'; g.fillRect(x0, y0, pw, ph);
  g.shadowColor = 'transparent';
  // ruled lines and the red margin (on the right: an Arabic notebook)
  g.strokeStyle = 'rgba(70,110,170,.28)'; g.lineWidth = 2;
  const top = y0 + 210, step = 112;
  for (let y = top; y < y0 + ph - 40; y += step) { g.beginPath(); g.moveTo(x0 + 20, y); g.lineTo(x0 + pw - 20, y); g.stroke(); }
  g.strokeStyle = 'rgba(200,70,60,.45)'; g.beginPath(); g.moveTo(x0 + pw - 70, y0); g.lineTo(x0 + pw - 70, y0 + ph); g.stroke();
  // ink
  g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  const ink = (size: number, color = '#1B2A5C', bold = false) => { g.font = `${bold ? 700 : 400} ${size}px "Hemlo Ruqaa", serif`; g.fillStyle = color; };
  ink(64, '#14214D', true); g.fillText(title, x0 + pw - 100, y0 + 110);
  // the columns, right to left: name, phone, membership, from, still owed
  const X = [x0 + pw - 95, x0 + pw - 390, x0 + pw - 640, x0 + pw - 780, x0 + pw - 860];
  ink(30, '#7A5A3A'); cols.forEach((t, i) => g.fillText(t, X[i], top - 18));
  rows.forEach((r, i) => {
    const y = top + step * (i + 1) - 30 + (rnd() - 0.5) * 8;
    const hand = (text: string, x: number, size = 40) => { g.save(); g.translate(x, y + (rnd() - 0.5) * 6); g.rotate((rnd() - 0.5) * 0.035); ink(size, rnd() < 0.85 ? '#1B2A5C' : '#232323'); g.fillText(text, 0, 0); g.restore(); };
    hand(r.name, X[0], 44);
    hand(r.phone, X[1], 34);
    hand(r.plan, X[2], 38);
    hand(r.from, X[3], 36);
    if (r.owes) hand(r.owes, X[4], 34);
    if (r.note) { g.save(); ink(26, '#5A4A8A'); g.fillText(r.note, X[0], y + 40); g.restore(); }
  });
  g.restore();
  // the light of a phone photo: brighter in the middle, darker at the corners
  const light = g.createRadialGradient(W * 0.45, H * 0.4, 100, W / 2, H / 2, W * 0.95);
  light.addColorStop(0, 'rgba(255,248,230,.10)'); light.addColorStop(1, 'rgba(0,0,0,.38)');
  g.fillStyle = light; g.fillRect(0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.86);
}
