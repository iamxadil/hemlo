// The Hemlo film's soundtrack: the voiceover placed on the beat, a modern piano score that drops in on "Meet Hemlo",
// and the music ducking under every spoken line. Also writes the schedule the picture follows (public/ad2/schedules.json,
// one entry a language): when each line is cut to, when each of its words is said, and the film's length.
//   intro   the problem: a soft piano ostinato, Bm · G · D · A
//   break   "There's a better way": the music thins to a held chord and a rising breath
//   drop    "Meet Hemlo": a soft hit and a bright D major; then a light groove (D · A · Bm · G) under the trades
//   lift    "In Arabic…": a melody on top
//   outro   the call: the groove eases, and the last D major rings out
// Run after tools/prep-vo.mjs: node tools/make-ad2-audio.mjs <en|ar>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { SR, mtof, buf, add, noise, clap, hat, reverb, writeWav, piano, strings, hit, swell } from './synth.mjs';
import { SCRIPT } from './film-script.mjs';

const BPM = 104, BEAT = 60 / BPM, BAR = BEAT * 4, FPS = 60;
const AUD = new URL('../public/ad2/', import.meta.url);
mkdirSync(new URL('audio/', AUD), { recursive: true });
const LANG = process.argv[2] ?? 'en';
const lines = JSON.parse(readFileSync(new URL(`vo/${LANG}/lines.json`, AUD), 'utf8'));

// ---------- when each word is said ----------
// Every word gets a share of its line by its length (syllables in English, letters in Arabic), with room for the
// pauses its punctuation asks for; then the clause starts are pinned to the pauses actually heard in the recording.
const ARABIC = /[؀-ۿ]/;
const bare = (w) => w.replace(/[ً-ْٰ]/g, '').replace(/[^\p{L}\p{N}']/gu, '');
const weight = (w) => { const b = bare(w); if (!b) return 0.5; if (ARABIC.test(b)) return Math.max(1, b.length / 2.2); return Math.max(1, (b.toLowerCase().match(/[aeiouy]+/g) ?? []).length - (/[^aeiou]e$/i.test(b) ? 1 : 0)); };
function wordTimes(text, dur, phrases) {
  const words = text.split(/\s+/).filter(Boolean);
  const raw = []; let t = 0;
  words.forEach((w) => { raw.push(t); t += weight(w); if (/[,،:;]$/.test(w)) t += 1.4; else if (/[.!?…]$/.test(w)) t += 2.4; });
  const speak = dur - 0.14, k = speak / t;
  let times = raw.map((x) => x * k);
  // the clause starts (after punctuation) we can pin to a heard pause
  const starts = [0, ...words.map((w, i) => (/[,،:;.!?…]$/.test(w) && i + 1 < words.length ? i + 1 : -1)).filter((i) => i > 0)];
  const pins = new Map([[0, phrases[0] ?? 0]]);
  const rest = starts.slice(1), heard = phrases.slice(1);
  if (rest.length === heard.length && rest.every((i, k) => Math.abs(times[i] - heard[k]) < 1)) rest.forEach((i, k) => pins.set(i, heard[k])); // one pause per clause
  else {
    let after = 0; // otherwise, in order: each pause to the nearest clause start after the last one pinned
    for (const p of heard) {
      let best = -1, err = 0.7;
      for (const i of rest) if (i > after && Math.abs(times[i] - p) < err) { best = i; err = Math.abs(times[i] - p); }
      if (best > 0) { pins.set(best, p); after = best; }
    }
  }
  const keys = [...pins.keys()].sort((a, b) => a - b);
  times = times.map((x, i) => {
    let a = keys[0]; for (const kk of keys) if (kk <= i) a = kk;
    const nb = keys.find((kk) => kk > i);
    const ta = pins.get(a), xa = times[a];
    if (nb === undefined) return ta + (x - xa);
    const tb = pins.get(nb), xb = times[nb];
    return ta + (x - xa) * ((tb - ta) / Math.max(1e-6, xb - xa));
  });
  return words.map((w, i) => ({ w, t: Math.max(0, times[i]) }));
}

// ---------- the schedule: each line is cut to on a beat, and its words begin a moment after ----------
const GAP = [0, 0.55, 0.95, 1.15, 0.75, 0.8, 0.6, 0.6, 0.6, 0.8, 0.7, 0.85]; // the pause before each line (seconds)
const LEAD = 0.32;                                                           // from the cut to the first word
const sched = [];
lines.forEach((l, i) => {
  const cut = i === 0 ? 0 : BEAT * Math.ceil((sched[i - 1].end + GAP[i] - LEAD) / BEAT);
  const start = i === 0 ? BEAT : cut + LEAD;
  sched.push({ cut, start, end: start + l.d, phrases: l.p.map((p) => +(start + p).toFixed(3)), words: wordTimes(SCRIPT[LANG][i], l.d, l.p).map((x) => ({ w: x.w, t: start + x.t })) });
});
const LEN = BEAT * Math.ceil((sched[11].end + 2.8) / BEAT), TAIL = 2.5;
const C = sched.map((s) => s.cut);
const SCHED = new URL('schedules.json', AUD);
const all = existsSync(SCHED) ? JSON.parse(readFileSync(SCHED, 'utf8')) : {};
all[LANG] = { fps: FPS, beat: BEAT, frames: Math.round(LEN * FPS),
  lines: sched.map((s) => ({ cut: Math.round(s.cut * FPS), start: Math.round(s.start * FPS), end: Math.round(s.end * FPS), phrases: s.phrases.map((p) => Math.round(p * FPS)),
    words: s.words.map((x) => [x.w, Math.round(x.t * FPS)]) })) };
writeFileSync(SCHED, JSON.stringify(all));
sched.forEach((s, i) => console.log(i, `cut ${s.cut.toFixed(2)}`, `words ${s.start.toFixed(2)}–${s.end.toFixed(2)}`));
console.log('length', LEN.toFixed(2) + 's');

// ---------- the music ----------
const music = buf(LEN + TAIL), hall = buf(LEN + TAIL);
const play = (m, t, held, vel, pan = 0) => { const s = piano(m, held, vel); add(music, s, t, 0.8, pan); add(hall, s, t, 0.45, pan); };
const chordsAt = (t0, t1, prog, fn) => { for (let t = t0, k = 0; t < t1 - 0.01; t += BAR, k++) fn(prog[k % prog.length], t, Math.min(BAR, t1 - t), k); };

// intro: Bm · G · D · A, an eighth-note ostinato, soft
const INTRO = [{ r: 35, c: [59, 62, 66, 71] }, { r: 31, c: [59, 62, 67, 71] }, { r: 38, c: [57, 62, 66, 69] }, { r: 33, c: [57, 61, 64, 69] }];
chordsAt(0, C[2], INTRO, (ch, t, len, k) => {
  const fade = 1.3 * Math.min(1, (k + 2) / 3);
  play(ch.r, t, len * 0.95, 0.42 * fade, -0.3); play(ch.r + 12, t, len * 0.95, 0.3 * fade, -0.2);
  const pat = [0, 2, 1, 3, 2, 1, 3, 2];
  for (let e = 0; e < 8 && e * BEAT / 2 < len; e++) play(ch.c[pat[e]], t + e * BEAT / 2, BEAT * 0.55, (0.2 + (e % 4 === 0 ? 0.06 : 0)) * fade, 0.25);
  add(hall, strings(ch.c.map((m) => m - 12), len, 0.8, 0.8, 0.45 * fade), t, 1);
});
// break: a held A chord, a high ping, and a breath rising into the drop
play(45, C[2], C[3] - C[2] - 0.05, 0.35); [57, 61, 64].forEach((m) => play(m, C[2], C[3] - C[2] - 0.05, 0.28));
play(88, C[2] + BEAT, BEAT * 2, 0.22, 0.3);
add(music, swell(C[3] - C[2], 0.32), C[2]);

// drop: a soft hit and a bright D major
add(music, hit(0.3), C[3]); add(hall, hit(0.12), C[3]);
[26, 38, 50, 57, 62, 66, 69, 74].forEach((m, k) => play(m, C[3] + k * 0.01, BAR * 1.6, 0.66, (k - 4) * 0.08));
[86, 90, 93].forEach((m, k) => play(m, C[3] + BEAT * (1 + k * 0.5), BEAT * 1.5, 0.22, 0.3));

// groove: D · A · Bm · G, from a bar after the drop to the call
const GROOVE = [{ r: 38, c: [62, 66, 69, 74] }, { r: 33, c: [61, 64, 69, 73] }, { r: 35, c: [62, 66, 71, 74] }, { r: 31, c: [62, 67, 71, 74] }];
const G0 = C[3] + BAR, G1 = C[11] + BAR * 2;
chordsAt(G0, G1, GROOVE, (ch, t, len, k) => {
  const lift = t >= C[9] - 0.01, easing = t >= C[11] - 0.01;
  play(ch.r, t, len * 0.9, 0.5, -0.25); play(ch.r + 12, t + BEAT * 2, BEAT * 1.8, 0.36, -0.2);
  // piano: off-beat chord stabs, a lift in the second half of each bar
  for (let e = 0; e < 8; e++) {
    if (e * BEAT / 2 >= len) break;
    const v = (e % 2 ? 0.27 : 0.19) * (easing ? 0.75 : 1);
    ch.c.slice(e % 2 ? 0 : 1).forEach((m) => play(m, t + e * BEAT / 2, BEAT * 0.4, v / 1.6, 0.2));
  }
  if (lift) [ch.c[3] + 12, ch.c[2] + 12, ch.c[3] + 12, ch.c[1] + 12].forEach((m, q) => play(m, t + q * BEAT, BEAT * 0.9, 0.3, 0.35));
  add(hall, strings(ch.c.map((m) => m - 12), len, 0.5, 0.6, lift ? 0.8 : 0.55), t, 1);
  // drums: a round kick, a soft clap, a shaker
  const drums = !easing || k % 4 === 0;
  for (let q = 0; q < 4; q++) {
    const tq = t + q * BEAT;
    if (tq >= t + len) break;
    if (drums && (q === 0 || q === 2)) add(music, kickSoft(q === 0 ? 0.55 : 0.42), tq);
    if (drums && (q === 1 || q === 3)) add(hall, clap(), tq, 0.11);
    for (let s = 0; s < 4; s++) add(music, hat(), tq + s * BEAT / 4, (s % 2 ? 0.05 : 0.08) * (easing ? 0.5 : 1), 0.4);
    if (lift && q === 3) add(music, hat(true), tq + BEAT / 2, 0.06, -0.3);
  }
  // bass: the root, pushed on the and of 2
  bassNote(ch.r + 12, t, BEAT * 1.4, 0.32); bassNote(ch.r + 12, t + BEAT * 1.5, BEAT * 0.4, 0.2); bassNote(ch.r + 12, t + BEAT * 2, BEAT * 1.6, 0.28);
});
// outro: the last D major, ringing out under the logo
const END = G1;
[26, 38, 50, 57, 62, 66, 69, 74, 78].forEach((m, k) => play(m, END + k * 0.012, LEN + TAIL - END - 0.3, 0.6, (k - 4) * 0.08));
add(hall, strings([50, 57, 62, 66, 69], LEN - END, 0.4, 2.2, 0.8), END, 1);
[86, 90, 93, 98].forEach((m, k) => play(m, END + BEAT * (1 + k * 0.5), BEAT * 2, 0.2, 0.3));

function kickSoft(g) {
  const n = Math.ceil(0.5 * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 50 + 65 * Math.exp(-t * 28); ph += 2 * Math.PI * f / SR; out[i] = g * Math.sin(ph) * Math.exp(-t * 8); }
  return out;
}
function bassNote(m, t, dur, g) {
  const f = mtof(m), n = Math.ceil((dur + 0.08) * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const s = i / SR, env = Math.min(1, s / 0.01) * Math.exp(-s * 1.4) * (s > dur ? Math.max(0, 1 - (s - dur) / 0.08) : 1); out[i] = g * env * (Math.sin(2 * Math.PI * f * s) + 0.2 * Math.sin(4 * Math.PI * f * s)); }
  add(music, out, t, 1, -0.1);
}

reverb(hall, 0.85, 0.9, 0.3);
// ---------- the voice, and the music bowing under it ----------
const voice = buf(LEN + TAIL);
sched.forEach((s, i) => {
  const b = readFileSync(new URL(`vo/${LANG}/${String(i).padStart(2, '0')}.wav`, AUD)), di = b.indexOf('data') + 8, n = Math.floor((b.length - di) / 2), x = new Float32Array(n);
  for (let k = 0; k < n; k++) x[k] = b.readInt16LE(di + k * 2) / 32768;
  add(voice, x, s.start, 1.0, 0);
});
const duck = new Float32Array(voice[0].length);
{ // 1 while words are spoken (with a short lead and a slower release), smoothed
  const on = new Uint8Array(duck.length);
  sched.forEach((s) => { for (let i = Math.max(0, Math.round((s.start - 0.08) * SR)); i < Math.min(on.length, Math.round((s.end + 0.15) * SR)); i++) on[i] = 1; });
  let y = 0; const up = Math.exp(-1 / (0.06 * SR)), down = Math.exp(-1 / (0.4 * SR));
  for (let i = 0; i < duck.length; i++) { const k = on[i] > y ? up : down; y = on[i] + (y - on[i]) * k; duck[i] = y; }
}
const mix = buf(LEN + TAIL);
let mPeak = 0, vPeak = 0;
for (let i = 0; i < mix[0].length; i++) for (const c of [0, 1]) { mPeak = Math.max(mPeak, Math.abs(music[c][i] + hall[c][i])); vPeak = Math.max(vPeak, Math.abs(voice[c][i])); }
const mg = 0.56 / mPeak, vg = 0.93 / vPeak;
for (let i = 0; i < mix[0].length; i++) {
  const t = i / SR, fade = t > LEN + TAIL - 2 ? Math.max(0, (LEN + TAIL - t) / 2) : 1, d = 1 - 0.55 * duck[i];
  for (const c of [0, 1]) mix[c][i] = Math.tanh(((music[c][i] + hall[c][i]) * mg * d * fade + voice[c][i] * vg) * 1.05) * 0.96;
}
writeWav(new URL(`audio/film-${LANG}.wav`, AUD), mix);
