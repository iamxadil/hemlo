// Hemlo, the film: 60 seconds, 16:9, English, narrated. Apple- and Microsoft-style: a clean light canvas with soft
// washes of colour, big tight type, real Hemlo screens on a laptop and a phone, everything moving on springs.
// The picture follows the voice: public/ad2/schedule.json (written by tools/make-ad2-audio.mjs) says when each line is
// cut to, when its words begin and where its phrases fall, so every word lands with what it describes.
//   0  "Running a business means keeping track of everything."   the title
//   1  "Debts, in a notebook. Bookings, on WhatsApp. Memberships, from memory."   the mess, piece by piece
//   2  "There's a better way."                                   the mess swept away
//   3  "Meet Hemlo."                                             the mark, on the drop
//   4  "One system, for your whole business."                    the laptop and the phone
//   5–8 gyms · clinics · shops · real estate                      each on its own screens, with a moment from its day
//   9  "In Arabic. In dinars. Right on your phone."               an Arabic screen
//   10 "Hemlo. Everything, in one place."                         four phones around the mark
//   11 "Try it free for thirty days, at hemlohq.com."             the end card
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT, MARK_PATH, MARK_VIEWBOX, outExpo, ease } from '../theme';
import { ramp } from '../anim';
import schedule from '../../public/ad2/schedule.json';

export const FILM_FRAMES = schedule.frames;
const L = schedule.lines;
const INK = '#1D1D1F', GRAY = '#6E6E73', CANVAS = '#F5F5F7';
const F = FONT.en;
const cutOf = (i: number) => (i < L.length ? L[i].cut : FILM_FRAMES);

// ---------- motion ----------
/** Words rising into place one after another (Apple's headline reveal). */
const Words: React.FC<{ text: string; at: number; every?: number; style?: React.CSSProperties; color?: string }> = ({ text, at, every = 4, style, color }) => {
  const f = useCurrentFrame();
  return (
    <span style={style}>
      {text.split(' ').map((w, i) => {
        const t = ramp(f, at + i * every, at + i * every + 26, outExpo);
        return <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: t, color, transform: `translateY(${(1 - t) * 0.42}em)`, filter: `blur(${(1 - t) * 10}px)` }}>{w}{' '}</span>;
      })}
    </span>
  );
};
const fadeIn = (f: number, a: number, len = 18) => ramp(f, a, a + len, ease);
const fadeOut = (f: number, b: number, len = 16) => 1 - ramp(f, b - len, b, ease);
/** A scene's presence: in from its cut, out at the next one. */
const sceneOf = (f: number, i: number, inLen = 16, outLen = 16) => Math.min(fadeIn(f, cutOf(i) - inLen / 2, inLen), fadeOut(f, cutOf(i + 1) + outLen / 2, outLen));
const sp = (f: number, at: number, fps: number, cfg = { damping: 18, stiffness: 120, mass: 1 }) => spring({ frame: f - at, fps, config: cfg });

// ---------- the canvas: soft washes of colour that drift, Microsoft-style ----------
const WASH: Record<string, [string, string, string]> = {
  neutral: ['#DCE6F5', '#EDE3F3', '#F5E9DC'], warm: ['#FBE3C8', '#DFF0E3', '#FDF0B8'], white: ['#EEF1F6', '#F4EFF6', '#F6F1EA'],
  brand: ['#FFD9C4', '#D7EEDF', '#E9E1FA'], gym: ['#FFD8C7', '#FFE9DE', '#F4E6FF'], dental: ['#F6E7C4', '#FBF2DC', '#E3EEF9'],
  stores: ['#F7D9C9', '#FDEBDD', '#E2F0E8'], realestate: ['#CFEDE2', '#E3F4EC', '#E6ECFA'],
};
const Wash: React.FC<{ scheme: string; opacity: number }> = ({ scheme, opacity }) => {
  const f = useCurrentFrame();
  const [a, b, c] = WASH[scheme];
  const blob = (color: string, x: number, y: number, s: number, ph: number) => (
    <div style={{ position: 'absolute', left: x + Math.sin(f / 110 + ph) * 60, top: y + Math.cos(f / 130 + ph) * 40, width: s, height: s, borderRadius: '50%', background: color, filter: 'blur(120px)', opacity: 0.9 }} />
  );
  return <AbsoluteFill style={{ opacity }}>{blob(a, -200, -260, 1000, 0)}{blob(b, 1100, 380, 1050, 2)}{blob(c, 420, 640, 900, 4)}</AbsoluteFill>;
};

// ---------- the hardware ----------
const Mark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = INK, style }) => (
  <svg viewBox={MARK_VIEWBOX} style={{ height: size, width: 'auto', display: 'block', ...style }}><path d={MARK_PATH} fill={color} /></svg>
);
/** A laptop: a thin black bezel, the screen, an aluminium base. `w` is the screen's outer width. */
const Laptop: React.FC<{ src: string; w: number; style?: React.CSSProperties }> = ({ src, w, style }) => {
  const h = w * 0.64, bez = w * 0.018;
  return (
    <div style={{ position: 'absolute', width: w, ...style }}>
      <div style={{ position: 'relative', width: w, height: h, borderRadius: `${w * 0.028}px ${w * 0.028}px ${w * 0.008}px ${w * 0.008}px`, background: '#0B0B0D', padding: bez, boxSizing: 'border-box',
        boxShadow: '0 0 0 1.5px #3A3B3F, 0 2px 0 1.5px #C9CBCF' }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', borderRadius: w * 0.006, display: 'block' }} />
        <span style={{ position: 'absolute', top: bez * 0.35, left: '50%', width: w * 0.006, height: w * 0.006, marginLeft: -w * 0.003, borderRadius: '50%', background: '#2A2B2F' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'linear-gradient(115deg, rgb(255 255 255 / .07) 0%, transparent 35%)', pointerEvents: 'none' }} />
      </div>
      <div style={{ position: 'relative', width: w * 1.16, marginLeft: -w * 0.08, height: w * 0.022, borderRadius: `0 0 ${w * 0.02}px ${w * 0.02}px`,
        background: 'linear-gradient(180deg, #E8E9EB 0%, #C6C8CC 55%, #9FA2A7 100%)', boxShadow: '0 1px 0 #FFFFFF inset' }}>
        <span style={{ position: 'absolute', left: '50%', top: 0, width: w * 0.16, height: w * 0.008, marginLeft: -w * 0.08, borderRadius: `0 0 ${w * 0.01}px ${w * 0.01}px`, background: '#B4B6BA' }} />
      </div>
    </div>
  );
};
/** A phone: a polished frame, a black bezel, the island, the screen. */
const Phone: React.FC<{ src: string; w: number; style?: React.CSSProperties }> = ({ src, w, style }) => (
  <div style={{ position: 'absolute', width: w, height: w * 2.164, borderRadius: w * 0.16, padding: w * 0.03, boxSizing: 'border-box',
    background: 'linear-gradient(145deg, #4A4B50, #1A1B1E 40%, #3A3B40)', boxShadow: '0 0 0 1px #8D9096 inset, 0 0 0 2px #2A2B2E', ...style }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: w * 0.135, overflow: 'hidden', background: '#000' }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
      <span style={{ position: 'absolute', top: w * 0.035, left: '50%', width: w * 0.3, height: w * 0.085, marginLeft: -w * 0.15, borderRadius: w * 0.05, background: '#000' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgb(255 255 255 / .08), transparent 30%)' }} />
    </div>
  </div>
);
/** Shadows that sit things on the canvas: soft, layered, and a contact shadow under devices. */
const lift = (k = 1) => `drop-shadow(0 ${30 * k}px ${50 * k}px rgb(20 24 40 / ${0.16 * k})) drop-shadow(0 ${8 * k}px ${14 * k}px rgb(20 24 40 / ${0.1 * k}))`;
const Floor: React.FC<{ x: number; y: number; w: number; o?: number }> = ({ x, y, w, o = 1 }) => (
  <div style={{ position: 'absolute', left: x - w / 2, top: y, width: w, height: w * 0.08, borderRadius: '50%', background: 'radial-gradient(closest-side, rgb(20 24 40 / .22), transparent)', filter: 'blur(14px)', opacity: o }} />
);
/** A notification lifted out of the screen. */
const Note: React.FC<{ color: string; title: string; sub: string; icon: string; style?: React.CSSProperties }> = ({ color, title, sub, icon, style }) => (
  <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: 22, padding: '22px 32px 22px 22px', borderRadius: 28, background: 'rgb(255 255 255 / .94)',
    backdropFilter: 'blur(20px)', boxShadow: '0 30px 60px -20px rgb(20 24 40 / .28), 0 6px 16px -6px rgb(20 24 40 / .14), 0 0 0 1px rgb(20 24 40 / .05)', whiteSpace: 'nowrap', ...style }}>
    <span style={{ display: 'grid', placeItems: 'center', width: 66, height: 66, borderRadius: 18, background: color }}>
      <svg viewBox="0 0 16 16" width="32" height="32" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
    </span>
    <span><div style={{ fontSize: 30, fontWeight: 600, color: INK, letterSpacing: '-0.01em' }}>{title}</div><div style={{ marginTop: 2, fontSize: 24, color: GRAY }}>{sub}</div></span>
  </div>
);

// ---------- the film ----------
export const HemloFilm: React.FC = () => {
  const f = useCurrentFrame();
  // the washes cross-fade at each cut, from the last scheme to this one
  const last = Math.max(0, ...L.map((l) => l.cut).filter((c) => c <= f));
  const cur = schemeAt(f), prev = last > 0 ? schemeAt(last - 1) : cur, t = last > 0 ? ramp(f, last, last + 24, ease) : 1;
  const show = (i: number, el: React.ReactNode) => (f >= cutOf(i) - 30 && f < cutOf(i + 1) + 30 ? el : null);
  return (
    <AbsoluteFill style={{ background: CANVAS, fontFamily: F, color: INK }}>
      <Audio src={staticFile('ad2/audio/film.wav')} />
      {prev !== cur && <Wash scheme={prev} opacity={1 - t} />}
      <Wash scheme={cur} opacity={prev !== cur ? t : 1} />
      {show(0, <Title />)}
      {show(1, <Mess />)}
      {show(2, <Better />)}
      {show(3, <Meet />)}
      {show(4, <OneSystem />)}
      {[0, 1, 2, 3].map((k) => <React.Fragment key={k}>{show(5 + k, <Trade k={k} />)}</React.Fragment>)}
      {show(9, <Arabic />)}
      {show(10, <Everything />)}
      {f >= cutOf(11) - 30 && <EndCard />}
    </AbsoluteFill>
  );
};
const schemeAt = (f: number) => f < cutOf(1) ? 'neutral' : f < cutOf(2) ? 'warm' : f < cutOf(3) ? 'white' : f < cutOf(5) ? 'brand' : f < cutOf(6) ? 'gym' : f < cutOf(7) ? 'dental' : f < cutOf(8) ? 'stores' : f < cutOf(9) ? 'realestate' : 'brand';

// 0 · the title
const Title: React.FC = () => {
  const f = useCurrentFrame();
  const l = L[0], o = sceneOf(f, 0), z = interpolate(f, [0, cutOf(1)], [1, 1.05]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: o, transform: `scale(${z}) translateY(${-ramp(f, cutOf(1) - 16, cutOf(1) + 8) * 40}px)` }}>
      <div style={{ fontSize: 104, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.08 }}>
        <div><Words text="Running a business" at={l.start - 4} color={GRAY} /></div>
        <div><Words text="means keeping track" at={l.start + 40} /></div>
        <div><Words text="of everything." at={l.start + 92} /></div>
      </div>
    </AbsoluteFill>
  );
};

// 1 · the mess: a notebook, a chat, sticky notes, each as it's named
const Mess: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = L[1], o = sceneOf(f, 1), out = ramp(f, cutOf(2) - 20, cutOf(2) + 10, ease);
  const at = [l.phrases[0], l.phrases[2], l.phrases[4]];
  const piece = (k: number, x: number, y: number, rot: number, el: React.ReactNode, label: string) => {
    const s = sp(f, at[k] - 4, fps, { damping: 15, stiffness: 110, mass: 1 });
    const drift = Math.sin((f + k * 40) / 50) * 6;
    // swept away to the centre at "There's a better way"
    const gx = (960 - x) * out, gy = (480 - y) * out;
    return (
      <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${-50 + 0}%, -50%) translate(${gx}px, ${(1 - s) * 260 + drift + gy}px) rotate(${rot * s + (1 - s) * rot * 3}deg) scale(${(0.86 + 0.14 * s) * (1 - out * 0.7)})`,
        opacity: Math.min(1, s * 1.5) * (1 - out), filter: `${lift(0.9)} blur(${out * 10}px)` }}>
        {el}
        <div style={{ marginTop: 34, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 34, fontWeight: 500, color: GRAY, transform: `rotate(${-rot}deg)`, opacity: ramp(f, at[k] + 8, at[k] + 24) }}>{label}</div>
      </div>
    );
  };
  const notebook = (
    <div style={{ width: 400, height: 470, borderRadius: 14, background: '#FFFDF6', position: 'relative', overflow: 'hidden',
      backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 47px, #DCE6F2 47px 49px)', backgroundPositionY: 70 }}>
      <div style={{ position: 'absolute', left: 64, top: 0, bottom: 0, width: 2, background: '#F1B8B0' }} />
      <div style={{ position: 'absolute', left: 84, top: 28, fontSize: 32, fontWeight: 600, fontStyle: 'italic', color: '#2B3550' }}>Debts</div>
      {[['Ahmed K.', '25,000'], ['Sara M.', '10,000', true], ['Abu Ali', '40,000 ?'], ['Hussein', '7,500'], ['Noor', '12,000', true]].map(([n, a, x], i) => (
        <div key={i} style={{ position: 'absolute', left: 84, right: 26, top: 96 + i * 49, display: 'flex', justifyContent: 'space-between', fontSize: 25, fontStyle: 'italic', color: '#33405E',
          textDecoration: x ? 'line-through' : 'none', textDecorationColor: '#C0392B', opacity: ramp(f, at[0] + 10 + i * 5, at[0] + 22 + i * 5) }}><span>{n}</span><span>{a}</span></div>
      ))}
    </div>
  );
  const chat = (
    <div style={{ width: 400, height: 470, borderRadius: 28, background: '#ECE8E1', overflow: 'hidden', position: 'relative' }}>
      <div style={{ height: 76, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', fontSize: 26, fontWeight: 600 }}>
        <span style={{ width: 42, height: 42, borderRadius: '50%', background: '#D5DCE6' }} />Bookings
      </div>
      {[['Can I book Thursday at 5?', 'in'], ['Sure, see you then ✓', 'out'], ['Sorry, I meant Tuesday', 'in'], ['Tuesday at 5 is taken…', 'out'], ['What about Wednesday?', 'in']].map(([t, d], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: d === 'in' ? 'flex-start' : 'flex-end', padding: '0 18px', marginTop: i ? 12 : 18,
          opacity: ramp(f, at[1] + 6 + i * 7, at[1] + 16 + i * 7), transform: `translateY(${(1 - ramp(f, at[1] + 6 + i * 7, at[1] + 18 + i * 7, outExpo)) * 14}px)` }}>
          <span style={{ maxWidth: 290, padding: '12px 18px', borderRadius: 20, fontSize: 23, lineHeight: 1.3, background: d === 'in' ? '#FFFFFF' : '#D9FDD3', color: '#1F2937' }}>{t}</span>
        </div>
      ))}
    </div>
  );
  const notes = (
    <div style={{ width: 400, height: 470, position: 'relative' }}>
      {[['Zainab — renew??', '#FFE76A', -4, 0, 0], ['Who paid this month?', '#FFD0E0', 5, 120, 150], ['Call Omar back', '#C9F2D6', -2, 30, 290]].map(([t, c, r, x, y], i) => (
        <div key={i} style={{ position: 'absolute', left: x as number, top: y as number, width: 270, height: 170, padding: 22, boxSizing: 'border-box', background: c as string, transform: `rotate(${r}deg)`,
          fontSize: 27, fontWeight: 500, fontStyle: 'italic', color: '#3A3320', boxShadow: '0 12px 24px -12px rgb(0 0 0 / .25)', opacity: ramp(f, at[2] + i * 8, at[2] + 10 + i * 8) }}>{t}</div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {piece(0, 470, 500, -6, notebook, 'Debts, in a notebook.')}
      {piece(1, 960, 470, 2, chat, 'Bookings, on WhatsApp.')}
      {piece(2, 1450, 500, 5, notes, 'Memberships, from memory.')}
    </AbsoluteFill>
  );
};

// 2 · there's a better way
const Better: React.FC = () => {
  const f = useCurrentFrame();
  const l = L[2], o = sceneOf(f, 2, 16, 10);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o }}>
      <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: '-0.04em', transform: `scale(${interpolate(f, [l.cut, cutOf(3)], [0.98, 1.03])})` }}>
        <Words text="There’s a better way." at={l.start - 2} every={5} />
      </div>
    </AbsoluteFill>
  );
};

// 3 · meet Hemlo: the mark lands on the drop, and the name slides out from behind it
const Meet: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = L[3], a = l.cut, o = sceneOf(f, 3, 6, 18);
  const s = sp(f, a, fps, { damping: 13, stiffness: 140, mass: 0.9 });
  const name = sp(f, l.start + 6, fps, { damping: 20, stiffness: 120, mass: 1 });
  const glow = ramp(f, a, a + 20) * (1 - 0.5 * ramp(f, a + 30, a + 120));
  const shine = interpolate(f, [a + 4, a + 50], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const z = interpolate(f, [a, cutOf(4)], [1, 1.04]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o, transform: `scale(${z})` }}>
      {/* a soft halo in the four trades' colours, turning */}
      <div style={{ position: 'absolute', width: 760, height: 760, borderRadius: '50%', opacity: 0.55 * glow, filter: 'blur(90px)',
        background: `conic-gradient(from ${f * 0.6}deg, #FF8A5B, #E2B85C, #4FC59B, #8FA8FF, #FF8A5B)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 46 * name }}>
        <div style={{ position: 'relative', transform: `scale(${0.55 + 0.45 * s})`, opacity: Math.min(1, s * 1.6), filter: lift(0.6) }}>
          <Mark size={250} />
          <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${MARK_VIEWBOX}'><path d='${MARK_PATH}'/></svg>`)}")`,
            WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', background: `linear-gradient(105deg, transparent ${shine - 14}%, rgb(255 255 255 / .55) ${shine}%, transparent ${shine + 14}%)` }} />
        </div>
        <div style={{ overflow: 'hidden', width: 700 * name, opacity: name }}>
          <div style={{ fontSize: 220, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1, transform: `translateX(${(1 - name) * -120}px)` }}>Hemlo</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 4 · one system, for your whole business: the laptop rises, the phone slides in front
const OneSystem: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = L[4], o = sceneOf(f, 4);
  const lap = sp(f, l.cut - 2, fps, { damping: 22, stiffness: 80, mass: 1.2 });
  const ph = sp(f, l.phrases[1] - 6, fps, { damping: 18, stiffness: 100, mass: 1 });
  const z = interpolate(f, [l.cut, cutOf(5)], [1, 1.06]);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: 'absolute', top: 92, width: '100%', textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.08 }}>
        <Words text="One system." at={l.start - 4} /> <Words text="For your whole business." at={l.phrases[1] - 2} color={GRAY} />
      </div>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: '50% 70%' }}>
        <Floor x={960} y={1010} w={1300} o={lap} />
        <div style={{ position: 'absolute', left: 960 - 520, top: 330, transform: `perspective(2600px) translateY(${(1 - lap) * 500}px) rotateX(${(1 - lap) * 32}deg)`, transformOrigin: '50% 100%', filter: lift(1) }}>
          <Laptop src="ad2/shots/hero-laptop.webp" w={1040} />
        </div>
        <div style={{ position: 'absolute', left: 1360, top: 470, transform: `translateX(${(1 - ph) * 500}px) rotate(${(1 - ph) * 8}deg)`, opacity: Math.min(1, ph * 1.5), filter: lift(1.1) }}>
          <Phone src="ad2/shots/gym-phone2.webp" w={250} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 5–8 · the trades
const TRADES = [
  { id: 'gym', color: '#E4572E', kicker: 'Gyms', head: ['Check in', 'with a scan.'], sub: 'Members renew on their own.', note: ['Zainab Ali checked in', '78 days left · 3 months'],
    icon: 'M3 8.5 6.2 11.5 13 4.5', heads: [1, 2] },
  { id: 'dental', color: '#B38B3A', kicker: 'Clinics', head: ['Every appointment.', 'Every treatment plan.'], sub: 'In one place.', note: ['Next up: Yousif Ahmed', '15:30 · in 13 minutes'],
    icon: 'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM8 5v3l2 1.5', heads: [1, 2, 3] },
  { id: 'stores', color: '#A8532E', kicker: 'Shops', head: ['Sell in', 'seconds.'], sub: 'Even when the internet drops.', note: ['Sale saved offline', 'Syncs when you’re back online'],
    icon: 'M4.5 12.5h7a3 3 0 0 0 .4-6 4 4 0 0 0-7.7-.9A3.5 3.5 0 0 0 4.5 12.5ZM6.5 9.5l1.2 1.2 2.3-2.4', heads: [0, 1] },
  { id: 'realestate', color: '#1F6F5C', kicker: 'Real estate', head: ['Every property,', 'its own page.'], sub: 'And it finds its buyer.', note: ['Ahmed opened the villa’s page', '3 times · a minute ago'],
    icon: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', heads: [1, 2] },
];
const Trade: React.FC<{ k: number }> = ({ k }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = TRADES[k], i = 5 + k, l = L[i];
  const o = sceneOf(f, i, 14, 14);
  // the camera pans: devices come in from the right, leave to the left
  const inn = sp(f, l.cut - 10, fps, { damping: 24, stiffness: 90, mass: 1.1 });
  const leave = ramp(f, cutOf(i + 1) - 14, cutOf(i + 1) + 14, ease);
  const dx = (1 - inn) * 700 - leave * 600;
  const p = l.phrases;
  const headAt = p[Math.min(t.heads[0], p.length - 1)] ?? l.start + 20;
  const subAt = p[p.length - 1] ?? l.start + 120;
  const head2At = t.heads.length > 2 ? p[Math.min(t.heads[1], p.length - 1)] : headAt + 16;
  const note = sp(f, subAt - 4, fps, { damping: 14, stiffness: 150, mass: 0.9 });
  const ph = sp(f, l.cut + 8, fps, { damping: 18, stiffness: 100, mass: 1 });
  const z = interpolate(f, [l.cut, cutOf(i + 1)], [1, 1.045]);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {/* the words, on the left */}
      <div style={{ position: 'absolute', left: 130, top: 300, width: 760, opacity: 1 - leave, transform: `translateX(${-leave * 60}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontSize: 34, fontWeight: 600, color: t.color, opacity: fadeIn(f, (p[0] ?? l.start) - 4, 14) }}>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: t.color }} />{t.kicker}
        </div>
        <div style={{ marginTop: 22, fontSize: k === 1 ? 70 : 96, fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1.04 }}>
          <div><Words text={t.head[0]} at={headAt - 2} /></div>
          <div><Words text={t.head[1]} at={head2At - 2} /></div>
        </div>
        <div style={{ marginTop: 26, fontSize: 40, fontWeight: 500, color: GRAY, letterSpacing: '-0.02em' }}><Words text={t.sub} at={subAt - 2} every={3} /></div>
      </div>
      {/* the screens, on the right */}
      <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${z})`, transformOrigin: '75% 60%' }}>
        <Floor x={1440} y={930} w={980} />
        <div style={{ position: 'absolute', left: 1000, top: 300, filter: lift(1) }}><Laptop src={`ad2/shots/${t.id}-laptop.webp`} w={880} /></div>
        <div style={{ position: 'absolute', left: 900, top: 420, transform: `translateY(${(1 - ph) * 260}px)`, opacity: Math.min(1, ph * 1.4), filter: lift(1.15) }}><Phone src={`ad2/shots/${t.id}-phone.webp`} w={230} /></div>
        {f >= subAt - 6 && <Note color={t.color} title={t.note[0]} sub={t.note[1]} icon={t.icon}
          style={{ left: 1020, top: 830, opacity: Math.min(1, note * 1.4), transform: `translateY(${(1 - note) * 50}px) scale(${0.9 + 0.1 * note})`, transformOrigin: 'left center' }} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 9 · in Arabic, in dinars, right on your phone
const Arabic: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = L[9], o = sceneOf(f, 9), p = l.phrases;
  const ph = sp(f, l.cut - 4, fps, { damping: 20, stiffness: 90, mass: 1.1 });
  const lines = ['In Arabic.', 'In dinars.', 'Right on your phone.'];
  const now = p.filter((x) => x <= f + 2).length - 1;
  const turn = interpolate(f, [l.cut, cutOf(10)], [-10, 6]);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: 'absolute', left: 150, top: 330, fontSize: 104, fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1.12 }}>
        {lines.map((t, k) => (
          <div key={t} style={{ color: k === now ? INK : '#C7C7CC', transition: 'none' }}><Words text={t} at={(p[k] ?? l.start + k * 60) - 2} /></div>
        ))}
      </div>
      <Floor x={1400} y={1000} w={520} o={ph} />
      <div style={{ position: 'absolute', left: 1240, top: 120, transform: `perspective(2000px) translateY(${(1 - ph) * 500}px) rotateY(${turn}deg)`, filter: lift(1.1) }}>
        <Phone src="ad2/shots/arabic-phone.webp" w={380} />
      </div>
    </AbsoluteFill>
  );
};

// 10 · Hemlo, everything in one place: four phones around the mark
const Everything: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = L[10], o = sceneOf(f, 10), p = l.phrases;
  const phones = ['gym-phone2', 'dental-phone2', 'stores-phone', 'realestate-phone2'];
  const z = interpolate(f, [l.cut, cutOf(11)], [1, 1.05]);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center', fontSize: 84, fontWeight: 600, letterSpacing: '-0.04em' }}>
        <Words text="Everything," at={(p[1] ?? l.start + 60) - 2} /> <Words text="in one place." at={(p[2] ?? l.start + 110) - 2} color={GRAY} />
      </div>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: '50% 60%' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 230, display: 'flex', justifyContent: 'center', opacity: 0.08 * fadeIn(f, l.cut, 30) }}><Mark size={820} /></div>
        <Floor x={960} y={1000} w={1200} />
        {phones.map((src, k) => {
          const s = sp(f, l.cut + k * 5, fps, { damping: 17, stiffness: 95, mass: 1 });
          const slot = k - 1.5;
          return (
            <div key={src} style={{ position: 'absolute', left: 960 - 125, top: 300, zIndex: k === 1 || k === 2 ? 2 : 1, filter: lift(1),
              transform: `translate(${slot * 270 * s}px, ${Math.abs(slot) * 40 * s + (1 - s) * 500}px) rotate(${slot * 7 * s}deg)`, opacity: Math.min(1, s * 1.5) }}>
              <Phone src={`ad2/shots/${src}.webp`} w={250} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 11 · the end card
const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = L[11], p = l.phrases, a = l.cut;
  const o = fadeIn(f, a - 14, 20);
  const m = sp(f, a, fps, { damping: 16, stiffness: 120, mass: 1 });
  const shine = interpolate(f, [(p[1] ?? a + 120) + 10, (p[1] ?? a + 120) + 60], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o, background: CANVAS }}>
      <Wash scheme="white" opacity={1} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: `translateY(-110px) scale(${0.85 + 0.15 * m})`, opacity: m }}>
        <Mark size={150} />
        <span style={{ fontSize: 150, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1 }}>Hemlo</span>
      </div>
      <div style={{ position: 'absolute', top: 600, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 58, fontWeight: 500, letterSpacing: '-0.025em' }}><Words text="Try it free for 30 days." at={(p[0] ?? a + 20) - 2} every={3} /></div>
        <div style={{ marginTop: 40, display: 'inline-block', position: 'relative', overflow: 'hidden', padding: '20px 48px', borderRadius: 999, background: INK, color: '#FFFFFF', fontSize: 46, fontWeight: 500,
          opacity: fadeIn(f, (p[1] ?? a + 120) - 4, 16), transform: `translateY(${(1 - fadeIn(f, (p[1] ?? a + 120) - 4, 22)) * 20}px)` }}>
          hemlohq.com
          <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${shine - 15}%, rgb(255 255 255 / .3) ${shine}%, transparent ${shine + 15}%)` }} />
        </div>
        <div style={{ marginTop: 36, fontSize: 30, color: GRAY, opacity: fadeIn(f, (p[2] ?? a + 220) + 10, 24) }}>Gyms · Clinics · Shops · Real estate</div>
      </div>
    </AbsoluteFill>
  );
};
