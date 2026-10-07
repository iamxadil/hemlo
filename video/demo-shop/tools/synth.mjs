// Hemlo's synth kit, shared by the videos' soundtracks: a seeded noise source, a stereo mixer, filters, a few
// instruments (pluck, pad, bass, kick, noise, clap, hat) and a stereo reverb. No samples, no licences.
import { writeFileSync } from 'node:fs';

const SR = 48000;

// ---------- helpers ----------
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const buf = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
export function writeWav(file, [L, R]) {
  const n = L.length, data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(file, data); console.log('wrote', String(file).split('/').pop(), (n / SR).toFixed(2) + 's');
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


export { SR, rnd, mtof, buf, add, onePoleLP, onePoleHP, pluck, pad, bass, kick, noise, clap, hat, reverb };
