// The Hemlo ad's score: solo piano, strings and low hits, in a concert hall, synthesized from scratch (no samples, no
// licences). 90 BPM, so a beat is 40 frames and a bar 160 at 60 fps, the grid the picture cuts to.
//   bars 0–2   the night: A minor, a lonely piano line over a low drone, holding on E (the question)
//   bars 3–4   the H: a breath, then C major, a deep hit, the strings rise
//   bars 5–12  the four trades: flowing piano, two bars a chord, the strings beneath
//   bars 13–14 all together: the build
//   bars 15–16 the call: the last C major, and the hall rings out
// The piano is modal: each string's partials (slightly stretched, as real strings are), two strings a note gently
// out of tune with each other (the shimmer), a soft felt hammer, and dampers that close when the key is let go.
// Run: node tools/make-ad-audio.mjs  → public/ad/audio/ad.wav
import { mkdirSync } from 'node:fs';
import { SR, rnd, mtof, buf, add, onePoleLP, onePoleHP, noise, reverb, writeWav } from './synth.mjs';

const BEAT = 60 / 90, BAR = BEAT * 4, BARS = 17, TAIL = 5, LEN = BARS * BAR;
const OUT = new URL('../public/ad/audio/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const dry = buf(LEN + TAIL), hall = buf(LEN + TAIL);
const at = (bar, beat = 0) => bar * BAR + beat * BEAT;

// ---------- the piano ----------
const cache = new Map();
/** One piano note: `held` is how long the key stays down; velocity 0–1. */
function piano(midi, held, vel = 0.6) {
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
const pan = (midi) => Math.max(-0.6, Math.min(0.6, (midi - 62) / 40));
/** Play a note on the piano: dry for presence, and into the hall. */
const play = (midi, t, held, vel) => { const s = piano(midi, held, vel); add(dry, s, t, 0.85, pan(midi)); add(hall, s, t, 0.6, pan(midi)); };

// ---------- strings, a low drone, and hits ----------
/** An ensemble of strings: many slightly detuned voices with a slow vibrato, a slow swell and release. */
function strings(notes, dur, attack = 1.6, release = 2.2, gain = 1) {
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
function hit(gain = 1) {
  const n = Math.ceil(4 * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 34 + 70 * Math.exp(-t * 14); ph += 2 * Math.PI * f / SR; out[i] = gain * (Math.sin(ph) * Math.exp(-t * 1.1)); }
  const body = noise(1.6, 3.5, 60, 700); for (let i = 0; i < body.length; i++) out[i] += body[i] * 0.35 * gain;
  return out;
}
/** A soft low pulse under the trades: a heartbeat, felt more than heard. */
function pulse(gain = 0.5) {
  const n = Math.ceil(0.7 * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 48 + 30 * Math.exp(-t * 30); ph += 2 * Math.PI * f / SR; out[i] = gain * Math.sin(ph) * Math.exp(-t * 6); }
  return out;
}
/** Air rising into a moment. */
function swell(dur, gain = 0.35) {
  const n = Math.ceil(dur * SR), out = new Float32Array(n); let y = 0;
  for (let i = 0; i < n; i++) { const t = i / n, cut = 200 + 6000 * t * t * t, a = Math.exp(-2 * Math.PI * cut / SR); y = (1 - a) * rnd() + a * y; out[i] = y * gain * t * t; }
  return onePoleHP(out, 150);
}

// ---------- 1 · the night (bars 0–2): A minor, alone ----------
add(hall, strings([33, 40], 3 * BAR - 0.4, 3, 1.2, 0.55), 0, 1);           // a low drone, A and E
play(33, at(0), BAR * 2, 0.45); play(45, at(0), BAR * 2, 0.4);
[[76, 0], [72, 1], [71, 2], [69, 3]].forEach(([m, b]) => play(m, at(0, b), BEAT * 1.6, 0.42));
play(29, at(1), BAR, 0.45); play(41, at(1), BAR, 0.38);
[[69, 0], [72, 1], [77, 2], [76, 3]].forEach(([m, b]) => play(m, at(1, b), BEAT * 1.6, 0.44));
// the question: E, held, unresolved; then silence before the hit
play(28, at(2), BAR * 0.92, 0.5); play(40, at(2), BAR * 0.92, 0.42);
[[74, 0], [71, 1], [68, 2]].forEach(([m, b]) => play(m, at(2, b), b === 2 ? BEAT * 1.7 : BEAT * 1.4, 0.46));
add(dry, swell(1.6, 0.3), at(2, 2.2));

// ---------- 2 · the H (bars 3–4): C major, the hit, the strings ----------
add(dry, hit(0.42), at(3)); add(hall, hit(0.22), at(3));
[24, 36, 48, 52, 55, 60, 64, 67].forEach((m, k) => play(m, at(3) + k * 0.012, BAR * 1.6, 0.78));
add(hall, strings([48, 55, 60, 64, 67], BAR * 2 - 0.2, 0.9, 2, 1.4), at(3), 1);
[[79, 1], [84, 1.5], [88, 2.5]].forEach(([m, b]) => play(m, at(3, b), BEAT, 0.34));
play(31, at(4), BAR, 0.55); play(43, at(4), BAR, 0.45);
[[74, 0], [79, 1], [83, 2], [86, 3]].forEach(([m, b]) => play(m, at(4, b), BEAT * 1.2, 0.36));

// ---------- 3 · the trades (bars 5–12): flowing piano over strings, two bars a chord ----------
// C · G/B │ Am · F │ C · G │ F · G — a left hand rolling eighths, a right-hand melody that climbs as it goes
const PROG = [
  [{ bass: 36, ch: [48, 55, 60, 64] }, { bass: 35, ch: [47, 55, 59, 62] }],
  [{ bass: 33, ch: [45, 52, 57, 60] }, { bass: 29, ch: [41, 48, 53, 57] }],
  [{ bass: 36, ch: [48, 55, 60, 64] }, { bass: 31, ch: [43, 50, 55, 59] }],
  [{ bass: 29, ch: [41, 48, 53, 57] }, { bass: 31, ch: [43, 50, 55, 62] }],
];
const MELODY = [
  [[76, 0, 1.5], [74, 1.5, 0.5], [72, 2, 2], [74, 4, 1], [71, 5, 3]],
  [[72, 0, 1.5], [76, 1.5, 0.5], [79, 2, 2], [77, 4, 1.5], [76, 5.5, 0.5], [72, 6, 2]],
  [[79, 0, 1.5], [76, 1.5, 0.5], [84, 2, 2], [83, 4, 1], [79, 5, 3]],
  [[81, 0, 1.5], [79, 1.5, 0.5], [77, 2, 2], [79, 4, 1.5], [83, 5.5, 0.5], [86, 6, 2]],
];
PROG.forEach((pair, i) => {
  const bar0 = 5 + i * 2;
  pair.forEach((c, k) => {
    const b = bar0 + k;
    play(c.bass, at(b), BAR * 0.95, 0.5);
    const roll = [c.ch[0], c.ch[1], c.ch[2], c.ch[3], c.ch[2], c.ch[1], c.ch[2], c.ch[3]];
    roll.forEach((m, e) => play(m, at(b, e / 2), BEAT * 0.9, 0.26 + (e % 4 === 0 ? 0.06 : 0)));
    add(hall, strings(c.ch.map((m) => m + 12), BAR, 0.6, 0.9, 0.7 + i * 0.12), at(b), 1);
    add(dry, pulse(0.32 + i * 0.04), at(b)); add(dry, pulse(0.2), at(b, 2));
  });
  MELODY[i].forEach(([m, b, len]) => play(m, at(bar0, b), BEAT * len * 0.95, 0.5 + i * 0.04));
});

// ---------- 4 · all together (bars 13–14): Am · F, building ----------
[[33, [57, 60, 64, 69]], [29, [53, 57, 60, 65]]].forEach(([bass, ch], k) => {
  const b = 13 + k;
  play(bass, at(b), BAR, 0.6); play(bass + 12, at(b), BAR, 0.5);
  [0, 1, 2, 3].forEach((q) => ch.forEach((m) => play(m, at(b, q), BEAT * 0.8, 0.32 + q * 0.04)));
  add(hall, strings(ch, BAR, 0.4, 0.6, 1.3 + k * 0.4), at(b), 1);
  add(dry, pulse(0.45), at(b)); add(dry, pulse(0.3), at(b, 2));
});
[[81, 13, 0, 2], [84, 13, 2, 2], [88, 14, 0, 2], [86, 14, 2, 1.5]].forEach(([m, b, q, len]) => { play(m, at(b, q), BEAT * len, 0.58); play(m - 12, at(b, q), BEAT * len, 0.42); });
add(dry, swell(2.4, 0.4), at(14, 0.4));

// ---------- 5 · the call (bars 15–16): home ----------
add(dry, hit(0.4), at(15)); add(hall, hit(0.24), at(15));
[24, 36, 43, 48, 52, 55, 60, 64, 67, 72].forEach((m, k) => play(m, at(15) + k * 0.015, BAR * 2.2, 0.8));
add(hall, strings([48, 55, 60, 64, 67, 72], BAR * 1.6, 0.5, 3.5, 1.6), at(15), 1);
[[84, 15, 1], [88, 15, 1.5], [91, 15, 2.5], [96, 16, 0]].forEach(([m, b, q]) => play(m, at(b, q), BEAT * 2, 0.3));

// ---------- the hall, and the mix ----------
reverb(hall, 0.9, 0.93, 0.25);
const mixed = buf(LEN + TAIL);
for (let i = 0; i < mixed[0].length; i++) for (const ch of [0, 1]) mixed[ch][i] = dry[ch][i] * 0.9 + hall[ch][i] * 0.75;
// the level is set by the piano under the trades (not by the hits), and a soft limiter keeps the hits round
let sum = 0; const a0 = Math.round(at(5) * SR), a1 = Math.round(at(13) * SR);
for (let i = a0; i < a1; i++) sum += mixed[0][i] ** 2 + mixed[1][i] ** 2;
const g = 0.13 / Math.sqrt(sum / ((a1 - a0) * 2));
for (let i = 0; i < mixed[0].length; i++) {
  const t = i / SR, fade = t > LEN + TAIL - 2.5 ? Math.max(0, (LEN + TAIL - t) / 2.5) : 1;
  for (const ch of [0, 1]) mixed[ch][i] = Math.tanh(mixed[ch][i] * g) * 0.95 * fade;
}
console.log('length', (LEN + TAIL).toFixed(2) + 's', 'frames', Math.round(LEN * 60));
writeWav(new URL('ad.wav', OUT), mixed);
