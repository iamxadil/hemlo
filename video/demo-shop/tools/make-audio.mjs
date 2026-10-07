// The soundtrack and sound effects for the demo-shop video, synthesized from scratch (no samples, no licences).
// Music: 100 BPM, D major, 24 bars on the same grid the video cuts to (1 bar = 2.4 s = 144 frames at 60 fps).
// Run: node tools/make-audio.mjs  → public/audio/*.wav
import { writeFileSync, mkdirSync } from 'node:fs';

const SR = 48000, BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
const OUT = new URL('../public/audio/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------- helpers ----------
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const buf = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
function writeWav(name, [L, R]) {
  const n = L.length, data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(new URL(name, OUT), data); console.log('wrote', name, (n / SR).toFixed(2) + 's');
}
const add = (dst, src, at, gain = 1, pan = 0) => { // equal-power pan
  const o = Math.round(at * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < src.length && o + i < dst[0].length; i++) { if (o + i < 0) continue; dst[0][o + i] += src[i] * gl; dst[1][o + i] += src[i] * gr; }
};
function onePoleLP(x, cutoff) { const a = Math.exp(-2 * Math.PI * cutoff / SR); let y = 0; for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; x[i] = y; } return x; }
function onePoleHP(x, cutoff) { const a = Math.exp(-2 * Math.PI * cutoff / SR); let y = 0, px = 0; for (let i = 0; i < x.length; i++) { y = a * (y + x[i] - px); px = x[i]; x[i] = y; } return x; }

// ---------- instruments ----------
/** Karplus-Strong pluck: a soft, woody, organic note. */
function pluck(freq, dur, bright = 0.5) {
  const n = Math.ceil(dur * SR), out = new Float32Array(n), N = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(N); let p = 0;
  for (let i = 0; i < N; i++) line[i] = rnd();
  for (let k = 0; k < 2 + Math.round((1 - bright) * 4); k++) for (let i = 1; i < N; i++) line[i] = 0.5 * (line[i] + line[i - 1]); // mellow the attack
  const decay = 0.996;
  for (let i = 0; i < n; i++) {
    const a = line[p], b = line[(p + 1) % N];
    out[i] = a; line[p] = decay * 0.5 * (a + b); p = (p + 1) % N;
  }
  for (let i = 0; i < n; i++) out[i] *= Math.min(1, (n - i) / (0.05 * SR)); // no click at the end
  return out;
}
/** Warm pad: additive, gently detuned voices, slow swell. */
function pad(freqs, dur, attack = 1.2, release = 1.6) {
  const n = Math.ceil((dur + release) * SR), out = new Float32Array(n);
  for (const f0 of freqs) for (const det of [-0.006, 0, 0.0055]) {
    const f = f0 * (1 + det), ph = Math.random() * 6.28;
    for (let h = 1; h <= 7; h++) {
      if (f * h > 4200) break;
      const amp = (1 / h) * Math.exp(-h * 0.45), w = 2 * Math.PI * f * h / SR;
      for (let i = 0; i < n; i++) out[i] += amp * Math.sin(w * i + ph * h);
    }
  }
  const norm = 0.11 / Math.sqrt(freqs.length * 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.min(1, t / attack) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
    out[i] *= norm * env * env * (3 - 2 * env) / (env || 1) * env; // smoothstep swell
  }
  return out;
}
function bass(freq, dur) {
  const n = Math.ceil((dur + 0.15) * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.min(1, t / 0.012) * Math.exp(-t * 1.6) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.15) : 1);
    out[i] = env * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t) + 0.08 * Math.sin(6 * Math.PI * freq * t));
  }
  return out;
}
function kick(gain = 1) {
  const n = Math.ceil(0.45 * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 44 + 80 * Math.exp(-t * 32);
    ph += 2 * Math.PI * f / SR;
    out[i] = gain * Math.sin(ph) * Math.exp(-t * 7.5) + (i < 90 ? rnd() * 0.05 * (1 - i / 90) : 0);
  }
  return out;
}
function noise(dur, decay, hp, lp) {
  const n = Math.ceil(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rnd() * Math.exp(-(i / SR) * decay);
  if (hp) onePoleHP(out, hp); if (lp) onePoleLP(out, lp);
  return out;
}
const clap = () => { const a = noise(0.25, 22, 900, 5200); for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] *= (t < 0.012 ? 1 - ((t * 1000) % 4) / 5 : 1); } return a; };
const hat = (open = false) => noise(open ? 0.22 : 0.06, open ? 14 : 70, 7000, 14000);

// ---------- reverb (Freeverb-style, stereo) ----------
function reverb([L, R], wet = 0.3, room = 0.86, damp = 0.35) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => Math.round(d * SR / 44100));
  const aps = [556, 441, 341, 225].map((d) => Math.round(d * SR / 44100));
  const run = (x, spread) => {
    const y = new Float32Array(x.length);
    for (const d0 of combs) {
      const d = d0 + spread, line = new Float32Array(d); let p = 0, lp = 0;
      for (let i = 0; i < x.length; i++) { const o = line[p]; lp = o * (1 - damp) + lp * damp; line[p] = x[i] * 0.015 + lp * room; p = (p + 1) % d; y[i] += o; }
    }
    for (const d0 of aps) {
      const d = d0 + spread, line = new Float32Array(d); let p = 0;
      for (let i = 0; i < y.length; i++) { const b = line[p], v = y[i]; line[p] = v + b * 0.5; y[i] = b - v; p = (p + 1) % d; }
    }
    return y;
  };
  const wl = run(L, 0), wr = run(R, 23);
  for (let i = 0; i < L.length; i++) { L[i] += wl[i] * wet; R[i] += wr[i] * wet; }
}

// ---------- the music ----------
const BARS = 24, TAIL = 4.5;
const music = buf(BARS * BAR + TAIL), wetBus = buf(BARS * BAR + TAIL), drums = buf(BARS * BAR + TAIL);
// D major: Dmaj9 · Bm11 · Gmaj9 · A6sus4, two bars each; the last four bars resolve home
const CHORDS = [
  { root: 38, pad: [50, 54, 57, 61, 64], arp: [62, 66, 69, 73, 76, 73, 69, 66] },
  { root: 35, pad: [47, 50, 54, 57, 64], arp: [59, 62, 66, 69, 71, 69, 66, 62] },
  { root: 43, pad: [55, 59, 62, 66, 69], arp: [67, 71, 74, 78, 79, 78, 74, 71] },
  { root: 45, pad: [52, 57, 59, 62, 66], arp: [64, 69, 71, 74, 76, 74, 71, 69] },
];
for (let slot = 0; slot < BARS / 2; slot++) {
  const last = slot >= 10, c = last ? CHORDS[0] : CHORDS[slot % 4], t0 = slot * 2 * BAR;
  const intro = slot < 2, full = slot >= 2 && slot < 10;
  // pad
  add(wetBus, pad(c.pad.map(mtof), last && slot === 11 ? 2 * BAR + TAIL - 1.6 : 2 * BAR, intro && slot === 0 ? 2.4 : 0.9), t0, intro ? 2.0 : 1.7, 0);
  // arpeggio: quarters in the intro, eighths when the groove is in, slowing at the end
  const step = full ? BEAT / 2 : BEAT, count = Math.round(2 * BAR / step);
  for (let k = 0; k < count; k++) {
    if (slot === 11 && k > 3) break;
    const note = c.arp[k % c.arp.length] + (full && k % 16 >= 12 ? 12 : 0);
    const vel = (k % 4 === 0 ? 0.26 : 0.17) * (0.9 + 0.2 * Math.abs(rnd())) * (intro ? 1.8 : 1.5);
    const swing = full && k % 2 ? BEAT * 0.06 : 0;
    const pl = pluck(mtof(note), 1.8, 0.35);
    add(music, pl, t0 + k * step + swing, vel * 0.55, ((k % 5) / 4 - 0.5) * 0.7);
    add(wetBus, pl, t0 + k * step + swing, vel * 0.5, ((k % 5) / 4 - 0.5) * 0.7);
  }
  // bass: root on 1, a push on the "and" of 2, the fifth on 3
  if (!intro) for (let b = 0; b < 2; b++) {
    const tb = t0 + b * BAR, f = mtof(c.root), f5 = mtof(c.root + 7);
    if (slot === 11 && b === 1) { add(music, bass(f, 3.6), tb, 0.28); continue; }
    add(music, bass(f, BEAT * 1.4), tb, 0.3); add(music, bass(f, BEAT * 0.4), tb + BEAT * 1.5, 0.2);
    add(music, bass(f5, BEAT * 0.9), tb + BEAT * 2, 0.24); add(music, bass(f, BEAT * 0.8), tb + BEAT * 3, 0.2);
  }
  // drums: in from bar 4 to bar 20, lighter in bars 20–21, gone for the last chord
  const drumsOn = slot >= 2 && slot <= 10;
  if (drumsOn) for (let b = 0; b < 2; b++) {
    const tb = t0 + b * BAR, soft = slot === 10 ? 0.6 : 1;
    add(drums, kick(0.95 * soft), tb); add(drums, kick(0.75 * soft), tb + BEAT * 2);
    if ((slot + b) % 2) add(drums, kick(0.4 * soft), tb + BEAT * 3.5);
    add(drums, clap(), tb + BEAT, 0.16 * soft, 0.05); add(drums, clap(), tb + BEAT * 3, 0.16 * soft, 0.05);
    for (let e = 0; e < 8; e++) add(drums, hat(e === 7 && b === 1), tb + e * BEAT / 2 + (e % 2 ? BEAT * 0.06 : 0), (e % 2 ? 0.05 : 0.08) * soft, 0.3);
  }
}
// a soft riser into the groove (bar 4, 9.6 s), and a swell into the end card (bar 20, 48 s)
const riser = (dur) => { const r = noise(dur, 0, 0, 0); for (let i = 0; i < r.length; i++) { const t = i / r.length; r[i] *= t * t * 0.5; } onePoleHP(r, 1500); return onePoleLP(r, 6000); };
add(wetBus, riser(2.4), 4 * BAR - 2.4, 0.5); add(wetBus, riser(2.4), 20 * BAR - 2.4, 0.35);
// a low "boom" on the drop
add(drums, kick(0.9), 4 * BAR);

reverb(wetBus, 0.55);
const M = BARS * BAR + TAIL, total = Math.ceil(M * SR);
for (let i = 0; i < total; i++) {
  const t = i / SR, fade = t > M - 2.5 ? Math.max(0, (M - t) / 2.5) : 1, fadeIn = Math.min(1, t / 0.6);
  for (const ch of [0, 1]) {
    const v = (music[ch][i] + wetBus[ch][i] * 0.9 + drums[ch][i] * 0.55) * 0.9;
    music[ch][i] = Math.tanh(v * 1.1) * 0.82 * fade * fadeIn;
  }
}
let peak = 0; for (const ch of music) for (const v of ch) peak = Math.max(peak, Math.abs(v));
for (const ch of music) for (let i = 0; i < ch.length; i++) ch[i] *= 0.89 / peak;
writeWav('music.wav', music);

// ---------- sound effects ----------
const mono = (x, g = 1) => { const b = [new Float32Array(x.length), new Float32Array(x.length)]; add(b, x, 0, g); return b; };
{ // scanner beep: a clean square-ish tone, like a real till scanner
  const n = Math.ceil(0.14 * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(1, t / 0.003) * (t > 0.1 ? Math.max(0, 1 - (t - 0.1) / 0.04) : 1); x[i] = env * (Math.sin(2 * Math.PI * 2730 * t) + 0.2 * Math.sin(2 * Math.PI * 8190 * t)) * 0.35; }
  writeWav('beep.wav', mono(x));
}
{ // click: a short, soft tick
  const x = noise(0.03, 260, 1800, 9000); const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * 0.9 + Math.sin(2 * Math.PI * 1900 * i / SR) * Math.exp(-i / SR * 400) * 0.35;
  writeWav('click.wav', mono(y, 0.9));
}
{ // key tap (typing)
  const x = noise(0.025, 300, 2500, 7000); writeWav('key.wav', mono(x, 0.5));
}
{ // cash "ding": a small bell (inharmonic partials)
  const n = Math.ceil(1.6 * SR), x = new Float32Array(n);
  const parts = [[1, 1, 3.2], [2.76, 0.45, 5], [5.4, 0.25, 8], [8.93, 0.12, 12]];
  for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; for (const [m, a, d] of parts) v += a * Math.sin(2 * Math.PI * 1318.5 * m * t) * Math.exp(-t * d); x[i] = v * Math.min(1, t / 0.002) * 0.3; }
  const b = mono(x); reverb(b, 0.25); writeWav('ding.wav', b);
}
{ // whoosh: filtered noise swelling past
  const dur = 0.7, n = Math.ceil(dur * SR), L = new Float32Array(n), R = new Float32Array(n);
  let lpL = 0, lpR = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, env = Math.sin(Math.PI * t) ** 2, cut = 400 + 5000 * Math.sin(Math.PI * t), a = Math.exp(-2 * Math.PI * cut / SR);
    lpL = (1 - a) * rnd() + a * lpL; lpR = (1 - a) * rnd() + a * lpR;
    L[i] = lpL * env * (1 - t * 0.6) * 0.9; R[i] = lpR * env * (0.4 + t * 0.6) * 0.9;
  }
  writeWav('whoosh.wav', [L, R]);
}
{ // pop: a soft UI appear
  const n = Math.ceil(0.12 * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, f = 520 + 900 * Math.exp(-t * 60); x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 38) * 0.35; }
  writeWav('pop.wav', mono(x));
}
