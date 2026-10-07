// The building blocks: the stage, the browser window, screenshots that cross-fade, the cursor, highlights, captions,
// and the extra screens (the customer display and phones).
import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, MARK_PATH, MARK_VIEWBOX, outExpo } from './theme';
import { ramp, type Rect } from './anim';
import type { Lang } from './copy';

export const CHROME = 52; // browser top bar height (px, in window units)

/** The warm stage: canvas colour, two soft terracotta/sand glows drifting slowly, and a whisper of grain. */
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const a = f / 60;
  return (
    <AbsoluteFill style={{ background: C.canvas, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1500, height: 1500, borderRadius: '50%', left: -380 + Math.sin(a * 0.21) * 90, top: -700 + Math.cos(a * 0.17) * 60,
        background: 'radial-gradient(circle, rgba(168,83,46,0.16) 0%, rgba(168,83,46,0.05) 40%, rgba(168,83,46,0) 68%)' }} />
      <div style={{ position: 'absolute', width: 1700, height: 1700, borderRadius: '50%', right: -600 + Math.cos(a * 0.15) * 110, bottom: -1000 + Math.sin(a * 0.19) * 70,
        background: 'radial-gradient(circle, rgba(214,178,140,0.30) 0%, rgba(214,178,140,0.08) 42%, rgba(214,178,140,0) 70%)' }} />
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: 0.05, mixBlendMode: 'multiply' }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Mark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = C.accent, style }) => (
  <svg viewBox={MARK_VIEWBOX} height={size} style={{ display: 'block', ...style }}><path d={MARK_PATH} fill={color} /></svg>
);

/** A calm browser window: traffic lights, a URL pill, then the page. Children are drawn in page coordinates (1440×900). */
export const BrowserWindow: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => (
  <div style={{ width: 1440, height: 900 + CHROME, borderRadius: 18, overflow: 'hidden', background: C.surface,
    boxShadow: '0 60px 140px -30px rgba(60,30,10,0.35), 0 18px 40px -12px rgba(60,30,10,0.18), 0 0 0 1px rgba(20,14,8,0.07)' }}>
    <div style={{ height: CHROME, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', background: '#F7F5F0', borderBottom: '1px solid #E6E2DA', direction: 'ltr' }}>
      {['#E6645A', '#E8B14A', '#61C454'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c, opacity: 0.85 }} />)}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ minWidth: 420, height: 32, borderRadius: 10, background: '#ECE8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: FONT.en, fontSize: 15, color: C.fg2, letterSpacing: 0.1 }}>
          <svg width="12" height="14" viewBox="0 0 12 14"><rect x="1" y="6" width="10" height="7.5" rx="2" fill={C.muted} /><path d="M3.5 6V4.2a2.5 2.5 0 015 0V6" stroke={C.muted} strokeWidth="1.6" fill="none" /></svg>
          {url}
        </div>
      </div>
      <span style={{ width: 63 }} />
    </div>
    <div style={{ position: 'relative', width: 1440, height: 900, overflow: 'hidden' }}>{children}</div>
  </div>
);

/** Screenshots that change on cue with a short cross-fade (the last one stays). */
export const ScreenStack: React.FC<{ lang: Lang; cues: [number, string, number?][]; dir?: string; w?: number; h?: number }> = ({ lang, cues, dir = 'shots', w = 1440, h = 900 }) => {
  const f = useCurrentFrame();
  let i = 0; for (let k = 0; k < cues.length; k++) if (cues[k][0] <= f) i = k;
  const [at, name, fade = 12] = cues[i], prev = i > 0 ? cues[i - 1][1] : null;
  const o = ramp(f, at, at + fade);
  const img = (n: string, op: number) => <Img key={n} src={staticFile(`${dir}/${lang}/${n}.png`)} style={{ position: 'absolute', inset: 0, width: w, height: h, opacity: op }} />;
  return <>{prev && o < 1 && img(prev, 1)}{img(name, prev ? o : 1)}</>;
};

/** The pointer: a clean arrow with a soft shadow, pressing on clicks, with a ripple. */
export const Cursor: React.FC<{ x: number; y: number; opacity: number; press: number; scale: number }> = ({ x, y, opacity, press, scale }) => (
  <div style={{ position: 'absolute', left: x, top: y, opacity, transform: `scale(${scale * (1 - press * 0.16)})`, transformOrigin: '0 0', zIndex: 50, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.28))' }}>
    <svg width="34" height="42" viewBox="0 0 34 42" style={{ display: 'block', marginLeft: -4, marginTop: -3 }}>
      <path d="M4 3 L4 33 L11.5 26 L16.5 38 L22 35.5 L17 24 L27.5 24 Z" fill="#111" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  </div>
);
export const Ripple: React.FC<{ x: number; y: number; t: number; scale: number }> = ({ x, y, t, scale }) => t <= 0 || t >= 1 ? null : (
  <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 49 }}>
    <div style={{ position: 'absolute', left: -60 * scale * outExpo(t), top: -60 * scale * outExpo(t), width: 120 * scale * outExpo(t), height: 120 * scale * outExpo(t),
      borderRadius: '50%', border: `${3 * scale}px solid ${C.accent}`, opacity: (1 - t) * 0.8, background: 'rgba(168,83,46,0.10)' }} />
  </div>
);

/** A ring that settles around something worth looking at. */
export const Highlight: React.FC<{ r: Rect; from: number; to: number; radius?: number }> = ({ r, from, to, radius = 16 }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  if (f < from || f > to) return null;
  const s = spring({ frame: f - from, fps, config: { damping: 16, stiffness: 140 } });
  const out = ramp(f, to - 12, to);
  const g = interpolate(s, [0, 1], [18, 7]);
  return <div style={{ position: 'absolute', left: r.x - g, top: r.y - g, width: r.w + 2 * g, height: r.h + 2 * g, borderRadius: radius + g, zIndex: 40,
    border: `3px solid ${C.accent}`, opacity: Math.min(1, s * 1.4) * (1 - out),
    boxShadow: '0 0 0 6px rgba(168,83,46,0.12), 0 12px 30px -8px rgba(168,83,46,0.35)' }} />;
};

/** A scanner's red line sweeping across a barcode button. */
export const ScanLine: React.FC<{ r: Rect; at: number }> = ({ r, at }) => {
  const f = useCurrentFrame(), t = (f - at) / 16;
  if (t < 0 || t > 1) return null;
  return <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, overflow: 'hidden', borderRadius: 12, zIndex: 41 }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: r.h * t - 2, height: 3, background: C.scan, boxShadow: `0 0 12px 3px ${C.scan}`, opacity: Math.sin(Math.PI * t) }} />
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(229,72,77,0.08)', opacity: Math.sin(Math.PI * t) }} />
  </div>;
};

/** A live spinner over the screenshot's frozen one. */
export const Spinner: React.FC<{ r: Rect }> = ({ r }) => {
  const f = useCurrentFrame(), s = Math.max(r.w, r.h) + 6;
  return <div style={{ position: 'absolute', left: r.x + r.w / 2 - s / 2, top: r.y + r.h / 2 - s / 2, width: s, height: s, borderRadius: '50%', background: '#FAFAF7', zIndex: 5 }}>
    <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', border: '2px solid #CFCDC4', borderTopColor: C.accent, transform: `rotate(${f * 9}deg)` }} />
  </div>;
};

/** The caption card: a small terracotta label and one plain sentence, on frosted glass. */
export const Caption: React.FC<{ lang: Lang; from: number; to: number; label: string; text: string; align?: 'center' | 'start' | 'end' }> = ({ lang, from, to, label, text, align = 'center' }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  if (f < from || f > to) return null;
  const s = spring({ frame: f - from, fps, config: { damping: 20, stiffness: 110 } });
  const out = ramp(f, to - 14, to);
  const rtl = lang === 'ar';
  const justify = align === 'center' ? 'center' : (align === 'start') !== rtl ? 'flex-start' : 'flex-end';
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: justify, padding: align === 'center' ? '0 0 58px' : '0 130px 58px', pointerEvents: 'none', zIndex: 100 }}>
      <div dir={rtl ? 'rtl' : 'ltr'} style={{ transform: `translateY(${(1 - s) * 40 + out * -8}px)`, opacity: Math.min(1, s * 1.3) * (1 - out),
        background: 'rgba(255,255,255,0.84)', backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
        borderRadius: 30, padding: '22px 38px 24px', boxShadow: '0 30px 70px -20px rgba(60,30,10,0.30), 0 0 0 1px rgba(20,14,8,0.06)', maxWidth: 1240 }}>
        <div style={{ fontFamily: rtl ? FONT.ar : FONT.en, fontSize: 21, fontWeight: 600, color: C.accent, letterSpacing: rtl ? 0 : 0.4, marginBottom: 6,
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.accent, display: 'inline-block' }} />{label}
        </div>
        <div style={{ fontFamily: rtl ? FONT.ar : FONT.en, fontSize: rtl ? 44 : 42, fontWeight: rtl ? 700 : 600, color: C.fg, letterSpacing: rtl ? 0 : '-0.02em', lineHeight: 1.25 }}>{text}</div>
      </div>
    </AbsoluteFill>
  );
};

/** A second screen on the counter, facing the customer. */
export const Monitor: React.FC<{ lang: Lang; cues: [number, string, number?][]; width: number }> = ({ lang, cues, width }) => {
  const h = width * 900 / 1440;
  return (
    <div style={{ width: width + 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: width + 28, height: h + 28, borderRadius: 22, background: '#16181D', padding: 14, boxShadow: '0 50px 100px -30px rgba(40,20,10,0.45), inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'relative', width, height: h, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ width: 1440, height: 900, transform: `scale(${width / 1440})`, transformOrigin: '0 0', position: 'relative' }}><ScreenStack lang={lang} cues={cues} /></div>
        </div>
      </div>
      <div style={{ width: 70, height: 60, background: 'linear-gradient(#2A2D34, #1B1D22)' }} />
      <div style={{ width: 240, height: 12, borderRadius: 8, background: '#23262C', boxShadow: '0 20px 30px -10px rgba(0,0,0,0.3)' }} />
    </div>
  );
};

/** A modern phone, screen showing a 390×844 capture. */
export const Phone: React.FC<{ lang: Lang; shot: string; width: number }> = ({ lang, shot, width }) => {
  const img = width * 844 / 390, sb = width * 50 / 390, h = img + sb, bez = width * 0.04, u = width / 390;
  return (
    <div style={{ width: width + bez * 2, height: h + bez * 2, borderRadius: width * 0.16, background: '#101216', padding: bez,
      boxShadow: '0 60px 110px -30px rgba(40,20,10,0.5), inset 0 0 0 2px rgba(255,255,255,0.08)' }}>
      <div style={{ position: 'relative', width, height: h, borderRadius: width * 0.13, overflow: 'hidden', background: '#fff' }}>
        <div style={{ height: sb, background: '#F6EDE9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${4 * u}px ${30 * u}px 0`, direction: 'ltr',
          fontFamily: FONT.en, fontWeight: 600, fontSize: 15 * u, color: C.fg }}>
          <span>4:40</span>
          <span style={{ display: 'flex', gap: 5 * u, alignItems: 'center' }}>
            <svg width={17 * u} height={11 * u} viewBox="0 0 17 11">{[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4.5} y={8 - i * 2.6} width="3" height={3 + i * 2.6} rx="1" fill={C.fg} />)}</svg>
            <svg width={25 * u} height={12 * u} viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={C.fg} fill="none" opacity="0.5" /><rect x="2" y="2" width="15" height="8" rx="1.6" fill={C.fg} /><rect x="23" y="4" width="1.6" height="4" rx="0.8" fill={C.fg} opacity="0.5" /></svg>
          </span>
        </div>
        <Img src={staticFile(`shots/${lang}/${shot}.png`)} style={{ width, height: img, display: 'block' }} />
        <div style={{ position: 'absolute', top: width * 0.03, left: '50%', width: width * 0.3, height: width * 0.085, marginLeft: -width * 0.15, borderRadius: 99, background: '#0B0C0F' }} />
      </div>
    </div>
  );
};
