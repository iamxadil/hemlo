// The ad's voiceover, line by line: trims each recorded line to its speech (with a few milliseconds of air either
// side and soft edges), evens out the loudness between lines, and writes public/ad2/vo/NN.wav plus lines.json (each
// line's length in seconds and where its phrases start), which the timeline reads to place the picture on the words.
// Run: node tools/prep-vo.mjs <folder with line00.wav … line11.wav (mono, 16-bit, 48 kHz)>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.argv[2], SR = 48000;
const OUT = new URL('../public/ad2/vo/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const read = (p) => { const b = readFileSync(p), di = b.indexOf('data') + 8, n = Math.floor((b.length - di) / 2), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = b.readInt16LE(di + i * 2) / 32768; return x; };
const write = (url, x) => {
  const d = Buffer.alloc(44 + x.length * 2);
  d.write('RIFF', 0); d.writeUInt32LE(36 + x.length * 2, 4); d.write('WAVE', 8); d.write('fmt ', 12); d.writeUInt32LE(16, 16); d.writeUInt16LE(1, 20); d.writeUInt16LE(1, 22);
  d.writeUInt32LE(SR, 24); d.writeUInt32LE(SR * 2, 28); d.writeUInt16LE(2, 32); d.writeUInt16LE(16, 34); d.write('data', 36); d.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  writeFileSync(url, d);
};
const lines = [];
const rmsOf = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const raw = Array.from({ length: 12 }, (_, i) => read(join(SRC, `line${String(i).padStart(2, '0')}.wav`)));
// loudness: speech RMS (frames above the floor), matched across lines
const speechRms = raw.map((x) => { const HOP = 480, f = []; for (let i = 0; i + HOP <= x.length; i += HOP) f.push(rmsOf(x.subarray(i, i + HOP))); const s = [...f].sort((a, b) => a - b), top = s[Math.floor(s.length * 0.9)]; const sp = f.filter((v) => v > top * 0.25); return Math.sqrt(sp.reduce((a, v) => a + v * v, 0) / sp.length); });
const target = speechRms.reduce((a, v) => a + v, 0) / speechRms.length;
raw.forEach((x, i) => {
  const HOP = 240, thr = speechRms[i] * 0.06;
  let a = 0, z = x.length;
  for (let k = 0; k + HOP <= x.length; k += HOP) if (rmsOf(x.subarray(k, k + HOP)) > thr) { a = k; break; }
  for (let k = x.length - HOP; k >= 0; k -= HOP) if (rmsOf(x.subarray(k, k + HOP)) > thr) { z = k + HOP; break; }
  a = Math.max(0, a - Math.round(0.04 * SR)); z = Math.min(x.length, z + Math.round(0.12 * SR));
  const y = x.slice(a, z), g = target / speechRms[i], fade = Math.round(0.012 * SR);
  for (let k = 0; k < y.length; k++) y[k] *= g * Math.min(1, k / fade, (y.length - k) / fade);
  write(new URL(`${String(i).padStart(2, '0')}.wav`, OUT), y);
  // the phrases inside the line: speech after a pause of 120 ms or more ("Debts, in a notebook. | Bookings, …")
  const H2 = 480, p = []; let quiet = 99, q2 = speechRms[i] * g * 0.08;
  for (let k = 0; k + H2 <= y.length; k += H2) {
    const loud = rmsOf(y.subarray(k, k + H2)) > q2;
    if (loud && quiet >= 12) p.push(+(k / SR).toFixed(3));
    quiet = loud ? 0 : quiet + 1;
  }
  lines.push({ d: +(y.length / SR).toFixed(3), p });
  console.log(i, (y.length / SR).toFixed(2) + 's', 'gain', g.toFixed(2), 'phrases at', lines[i].p.join(' '));
});
writeFileSync(new URL('lines.json', OUT), JSON.stringify(lines));
