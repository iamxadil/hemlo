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



// ---------- the piano ----------
const cache = new Map();
/** One piano note: `held` is how long the key stays down; velocity 0–1. */
export function piano(midi, held, vel = 0.6) {
  const key = `${midi}|${held.toFixed(3)}|${vel.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);
  const f0 = mtof(midi), Bc = 0.00012 * Math.pow(2, (midi - 60) / 24); // inharmonicity grows up the keyboard
  const ring = Math.min(held + 1.2, 9), n = Math.ceil(ring * SR), out = new Float32Array(n);
  const maxP = Math.max(3, Math.min(28, Math.floor(7500 / f0)));
  const bright = 0.35 + 0.65 * vel;
  for (let p = 1; p <= maxP; p++) {
    const fp = p * f0 * Math.sqrt(1 + Bc * p * p);
    if (fp > 16000) break;
    // felt hammer: a soft fall-off of the upper partials, brighter when struck harder; a hollow at the strike point
    let amp = Math.pow(p, -1.05) * Math.exp(-(p - 1) * (0.42 - 0.3 * bright)) * (0.55 + 0.45 * Math.abs(Math.sin(Math.PI * p / 7.5)));
    if (amp < 1e-4) continue;
    const fast = 1.1 + p * 0.55 + f0 / 520, slow = 0.22 + p * 0.07 + f0 / 1900; // two-stage decay, like a real string
    for (const det of [-0.0009, 0.0009]) {
      const w = 2 * Math.PI * fp * (1 + det) / SR;
      let c = Math.cos(w), s = Math.sin(w), x = 1, y = 0; // a rotating phasor instead of Math.sin per sample
      const ph = rnd() * Math.PI; x = Math.cos(ph); y = Math.sin(ph);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        let env = 0.62 * Math.exp(-t * fast) + 0.38 * Math.exp(-t * slow);
        if (t > held) env *= Math.exp(-(t - held) * (7 + p * 0.6)); // the damper
        if (env < 2e-5) break;
        out[i] += amp * env * y;
        const nx = x * c - y * s; y = x * s + y * c; x = nx;
      }
    }
  }
  // the attack: a 3 ms rise, and the felt's soft thump
  const thump = noise(0.05, 70, 40, 900 + 2500 * vel);
  for (let i = 0; i < n; i++) out[i] *= Math.min(1, i / (0.003 * SR));
  for (let i = 0; i < thump.length; i++) out[i] += thump[i] * 0.05 * vel;
  const g = 0.16 * vel * (midi < 48 ? 1.25 : 1);
  for (let i = 0; i < n; i++) out[i] *= g;
  cache.set(key, out);
  return out;
}
// ---------- strings, a low drone, and hits ----------
/** An ensemble of strings: many slightly detuned voices with a slow vibrato, a slow swell and release. */
export function strings(notes, dur, attack = 1.6, release = 2.2, gain = 1) {
  const n = Math.ceil((dur + release) * SR), out = new Float32Array(n);
  for (const m of notes) for (const det of [-0.004, -0.0015, 0.0015, 0.004]) {
    const f = mtof(m) * (1 + det), vib = 4.6 + rnd() * 0.8, vph = rnd() * 6;
    for (let h = 1; h <= 9; h++) {
      if (f * h > 5000) break;
      const amp = Math.pow(h, -1.25) * Math.exp(-h * 0.18), ph0 = rnd() * 6.28;
      let ph = ph0;
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        ph += 2 * Math.PI * f * h * (1 + 0.0025 * Math.sin(2 * Math.PI * vib * t + vph)) / SR;
        out[i] += amp * Math.sin(ph);
      }
    }
  }
  const norm = 0.05 * gain / Math.sqrt(notes.length * 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR, a = Math.min(1, t / attack), r = t > dur ? Math.max(0, 1 - (t - dur) / release) : 1;
    out[i] *= norm * (a * a * (3 - 2 * a)) * r;
  }
  return onePoleLP(out, 3800);
}
/** A deep cinematic hit: a falling sub, a drum's body, and air. */
export function hit(gain = 1) {
  const n = Math.ceil(4 * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 34 + 70 * Math.exp(-t * 14); ph += 2 * Math.PI * f / SR; out[i] = gain * (Math.sin(ph) * Math.exp(-t * 1.1)); }
  const body = noise(1.6, 3.5, 60, 700); for (let i = 0; i < body.length; i++) out[i] += body[i] * 0.35 * gain;
  return out;
}
/** A soft low pulse under the trades: a heartbeat, felt more than heard. */
export function pulse(gain = 0.5) {
  const n = Math.ceil(0.7 * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 48 + 30 * Math.exp(-t * 30); ph += 2 * Math.PI * f / SR; out[i] = gain * Math.sin(ph) * Math.exp(-t * 6); }
  return out;
}
/** Air rising into a moment. */
export function swell(dur, gain = 0.35) {
  const n = Math.ceil(dur * SR), out = new Float32Array(n); let y = 0;
  for (let i = 0; i < n; i++) { const t = i / n, cut = 200 + 6000 * t * t * t, a = Math.exp(-2 * Math.PI * cut / SR); y = (1 - a) * rnd() + a * y; out[i] = y * gain * t * t; }
  return onePoleHP(out, 150);
}


export { SR, rnd, mtof, buf, add, onePoleLP, onePoleHP, pluck, pad, bass, kick, noise, clap, hat, reverb };
