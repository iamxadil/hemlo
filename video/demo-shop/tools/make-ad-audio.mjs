// The Hemlo ad's soundtrack, synthesized from scratch on the ad's grid (120 BPM: a beat is 30 frames, a bar 120, at
// 60 fps). Five parts, the same as the picture: the problem (a dark drone, a clock, a heartbeat), a held breath and the
// hit when the H appears, then a warm groove under the four trades and everything together, and a last hit for the
// call to action. Run: node tools/make-ad-audio.mjs  → public/ad/audio/ad.wav
import { mkdirSync } from 'node:fs';
import { SR, rnd, mtof, buf, add, onePoleLP, onePoleHP, pluck, pad, bass, kick, noise, clap, hat, reverb, writeWav } from './synth.mjs';

const BEAT = 0.5, BAR = 2, LEN = 34, TAIL = 3;
const OUT = new URL('../public/ad/audio/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const dry = buf(LEN + TAIL), wet = buf(LEN + TAIL);

// ---------- sounds of our own ----------
/** A clock's tick: a tiny bright click. */
const tick = (g = 1) => { const a = noise(0.03, 160, 3500, 12000); for (let i = 0; i < a.length; i++) a[i] *= g; return a; };
/** A low boom with a long body: the hit. */
function boom(gain = 1, f0 = 38) {
  const n = Math.ceil(2.6 * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = f0 + 90 * Math.exp(-t * 18); ph += 2 * Math.PI * f / SR; out[i] = gain * Math.sin(ph) * Math.exp(-t * 1.7); }
  return out;
}
/** Rising noise: the filter opens as it goes. */
function riser(dur, gain = 0.5) {
  const n = Math.ceil(dur * SR), out = new Float32Array(n); let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, cut = 300 + 9000 * t * t, a = Math.exp(-2 * Math.PI * cut / SR);
    y = (1 - a) * rnd() + a * y; out[i] = y * gain * t * t;
  }
  return onePoleHP(out, 200);
}
/** A soft whoosh past the ear. */
function whoosh(dur = 0.6, gain = 0.5) {
  const n = Math.ceil(dur * SR), out = new Float32Array(n); let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, env = Math.sin(Math.PI * t) ** 2, cut = 800 + 5000 * Math.sin(Math.PI * t), a = Math.exp(-2 * Math.PI * cut / SR);
    y = (1 - a) * rnd() + a * y; out[i] = y * env * gain;
  }
  return out;
}
/** A notification pop: two quick sine blips. */
function pop(gain = 0.35) {
  const n = Math.ceil(0.22 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, f = t < 0.06 ? 1320 : 1760; out[i] = gain * Math.sin(2 * Math.PI * f * t) * Math.exp(-((t < 0.06 ? t : t - 0.06)) * 38); }
  return out;
}

// ---------- 1 · the problem (0–6 s): a dark drone, the clock, a heartbeat; a tick as each line lands ----------
add(wet, onePoleLP(pad([mtof(33), mtof(40), mtof(45)], 6, 1.5, 0.4), 900), 0, 2.4);
for (let b = 0; b < 12; b++) add(dry, tick(b % 2 ? 0.18 : 0.26), b * BEAT, 1, b % 2 ? 0.3 : -0.3);
for (let bar = 0; bar < 3; bar++) { add(dry, kick(0.55), bar * BAR); add(dry, kick(0.32), bar * BAR + 0.28); }
for (const t of [0.4, 2.0, 3.6]) add(dry, pluck(mtof(57), 0.8, 0.2), t, 0.28);
add(dry, pluck(mtof(45), 1.4, 0.15), 4.6, 0.4);
add(dry, riser(1.3, 0.45), 4.75);

// ---------- 2 · the H (6.2 s): a breath of silence, then the hit and a warm chord ----------
const HIT = 6.2;
add(dry, boom(0.95), HIT); add(wet, noise(1.2, 3.2, 300, 6000), HIT, 0.35);
add(wet, pad([48, 55, 59, 64, 67].map(mtof), 3.6, 0.05, 1.4), HIT, 2.3);
for (const [k, m] of [76, 79, 83, 88].entries()) add(wet, pluck(mtof(m), 2, 0.6), HIT + 0.25 + k * 0.14, 0.22, (k - 1.5) * 0.4);

// ---------- 3 & 4 · the trades and all of them together (10–30 s): a warm groove ----------
// two bars a chord: Cmaj9 · Am9 · Fmaj9 · G6, then Cmaj9 · Gsus for everything together
const CH = [
  { root: 36, pad: [48, 52, 55, 59, 62], arp: [60, 64, 67, 71, 74, 71, 67, 64] },
  { root: 33, pad: [45, 48, 52, 55, 59], arp: [57, 60, 64, 67, 71, 67, 64, 60] },
  { root: 29, pad: [41, 45, 48, 52, 55], arp: [53, 57, 60, 64, 67, 64, 60, 57] },
  { root: 31, pad: [43, 47, 50, 52, 55], arp: [55, 59, 62, 64, 67, 64, 62, 59] },
  { root: 36, pad: [48, 52, 55, 59, 62], arp: [60, 64, 67, 71, 74, 71, 67, 64] },
  { root: 31, pad: [43, 48, 50, 55, 57], arp: [55, 60, 62, 67, 69, 67, 62, 60] },
];
const G0 = 10;
CH.forEach((c, i) => {
  const t0 = G0 + i * 2 * BAR;
  add(wet, pad(c.pad.map(mtof), 2 * BAR, 0.4, 1.2), t0, 1.6);
  for (let k = 0; k < 16; k++) {
    const note = c.arp[k % 8] + (k >= 12 ? 12 : 0), v = (k % 4 === 0 ? 0.24 : 0.15) * (0.9 + 0.2 * Math.abs(rnd()));
    const swing = k % 2 ? BEAT * 0.05 : 0, pl = pluck(mtof(note), 1.4, 0.4), pan = ((k % 5) / 4 - 0.5) * 0.7;
    add(dry, pl, t0 + k * BEAT / 2 + swing, v * 0.8, pan); add(wet, pl, t0 + k * BEAT / 2 + swing, v * 0.5, pan);
  }
  for (let b = 0; b < 2; b++) {
    const tb = t0 + b * BAR;
    add(dry, bass(mtof(c.root), 0.7), tb, 0.55); add(dry, bass(mtof(c.root), 0.3), tb + 0.75, 0.35); add(dry, bass(mtof(c.root + 7), 0.6), tb + BEAT * 2, 0.42);
    for (let q = 0; q < 4; q++) {
      add(dry, kick(q === 0 ? 0.62 : 0.48), tb + q * BEAT);
      add(dry, hat(), tb + q * BEAT + BEAT / 2, 0.16, 0.35);
      if (q % 2) add(wet, clap(), tb + q * BEAT, 0.16);
    }
  }
});
// a whoosh as each trade arrives, and the pop of its notification
for (let i = 0; i < 4; i++) { add(wet, whoosh(0.7, 0.42), G0 + i * 4 - 0.35); add(dry, pop(0.3), G0 + i * 4 + 1.55, 1, 0.25); }
add(wet, whoosh(0.9, 0.45), 26 - 0.45);
add(dry, riser(1.6, 0.5), 28.4);

// ---------- 5 · the call (30 s): the last hit and the home chord ----------
add(dry, boom(0.85, 41), 30); add(wet, noise(1.4, 2.8, 300, 7000), 30, 0.3);
add(wet, pad([48, 55, 59, 62, 64, 67].map(mtof), 3.6, 0.05, 2.5), 30, 2.4);
for (const [k, m] of [72, 76, 79, 83, 86].entries()) add(wet, pluck(mtof(m), 2.4, 0.55), 30.2 + k * 0.12, 0.2, (k - 2) * 0.35);

// ---------- mix ----------
reverb(wet, 0.55, 0.88, 0.3);
const mixed = buf(LEN + TAIL);
for (let i = 0; i < mixed[0].length; i++) {
  const t = i / SR, fade = t > LEN - 1.2 ? Math.max(0, (LEN + TAIL - t) / (TAIL + 1.2)) : 1;
  for (const ch of [0, 1]) { const v = (dry[ch][i] + wet[ch][i]) * 0.82 * fade; mixed[ch][i] = Math.tanh(v * 1.1) * 0.92; }
}
writeWav(new URL('ad.wav', OUT), mixed);
