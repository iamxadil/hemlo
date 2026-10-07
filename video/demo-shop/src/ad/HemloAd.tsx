// Hemlo's ad: 34 seconds, vertical (1080×1920) for Reels, TikTok and Stories, in Arabic or English.
//   1 · the problem (0–6 s): dark; how a business is run today, one line at a time, then the question that hurts
//   2 · the H (6–10 s): a breath, the founder's mark lands with the hit, and the promise; light opens from the mark
//   3 · four trades (10–26 s): each one's real phone screen, its line, and a moment from its day (a notification)
//   4 · all together (26–30 s): the four phones in a fan around the H, and what every Hemlo system shares
//   5 · the call (30–34 s): try it free, hemlohq.com
// The screens are real (the demo businesses, from the website's images); the music is synthesized on the same grid
// (tools/make-ad-audio.mjs: 120 BPM, a bar is 120 frames), so every cut lands on the beat.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT, MARK_PATH, MARK_VIEWBOX, outExpo, ease } from '../theme';
import { ramp } from '../anim';

export type Lang = 'ar' | 'en';
export const AD_DURATION = 2040;
const INK = '#0B0F16', PAPER = '#F4F1EA', TEXT = '#F2F1EC', FG = '#0E1420';
const T = { problem: 0, hit: 372, light: 540, trades: 600, trade: 240, together: 1560, call: 1800 };

const TRADES = [
  { id: 'gym', color: '#E4572E', icon: 'M2.5 7.5a5.5 5.5 0 1 1 2.4 4.5L2.5 13l.9-2.6a5.5 5.5 0 0 1-.9-2.9ZM6 7.5l1.5 1.5L10.5 6' },
  { id: 'dental', color: '#B38B3A', icon: 'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM8 5v3l2 1.5' },
  { id: 'stores', color: '#A8532E', icon: 'M4.5 12.5h7a3 3 0 0 0 .4-6 4 4 0 0 0-7.7-.9A3.5 3.5 0 0 0 4.5 12.5ZM6.5 9.5l1.2 1.2 2.3-2.4' },
  { id: 'realestate', color: '#1F6F5C', icon: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
] as const;

const COPY = {
  ar: {
    lines: [['الديون', 'بالدفتر.'], ['المواعيد', 'بالواتساب.'], ['الاشتراكات', 'بالذاكرة.']],
    question: ['شكد', 'ضايع عليك؟'], brand: 'هيملو', promise: ['عملك كله.', 'بمكان واحد.'],
    trades: [
      { kicker: 'للأندية الرياضية', head: ['المشترك', 'يجدّد وحده.'], toast: ['أُرسل تذكير التجديد', 'إلى 14 مشتركاً · واتساب'] },
      { kicker: 'لعيادات الأسنان', head: ['المريض يعرف السعر', 'قبل العلاج.'], toast: ['التالي: يوسف أحمد', '15:30 · بعد 13 دقيقة'] },
      { kicker: 'للمتاجر والماركتات', head: ['كل دينار', 'بمكانه.'], toast: ['حُفظ البيع بدون إنترنت', 'يتزامن حين يعود الاتصال'] },
      { kicker: 'لمكاتب العقارات', head: ['كل عقار', 'يلقى زبونه.'], toast: ['أحمد فتح صفحة الفيلا', '3 مرات · قبل دقيقة'] },
    ],
    together: ['نظام واحد.', 'لكل عملك.'], chips: ['بالعربي', 'بالدينار', 'يشتغل بلا إنترنت', 'من الموبايل'],
    cta: 'جرّبه مجاناً ٣٠ يوماً', url: 'hemlohq.com', fine: 'بلا بطاقة. بلا التزام.',
  },
  en: {
    lines: [['Debts', 'in a notebook.'], ['Bookings', 'on WhatsApp.'], ['Memberships', 'from memory.']],
    question: ['How much', 'are you losing?'], brand: 'Hemlo', promise: ['Your whole business.', 'One place.'],
    trades: [
      { kicker: 'For gyms', head: ['Members renew.', 'On their own.'], toast: ['Renewal reminders sent', '14 members · WhatsApp'] },
      { kicker: 'For dental clinics', head: ['Clear prices,', 'before treatment.'], toast: ['Next up: Yousif Ahmed', '15:30 · in 13 min'] },
      { kicker: 'For shops and markets', head: ['Every dinar,', 'accounted for.'], toast: ['Sale saved offline', 'Syncs when you’re back online'] },
      { kicker: 'For real estate offices', head: ['Every property', 'finds its buyer.'], toast: ['Ahmed opened the villa’s page', '3 times · a minute ago'] },
    ],
    together: ['One system.', 'Your whole business.'], chips: ['In Arabic', 'In dinars', 'Works offline', 'On your phone'],
    cta: 'Try it free for 30 days', url: 'hemlohq.com', fine: 'No card. No commitment.',
  },
};

const Mark: React.FC<{ size: number; color?: string; style?: React.CSSProperties; gradient?: [string, string] }> = ({ size, color = TEXT, style, gradient }) => {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg viewBox={MARK_VIEWBOX} style={{ height: size, width: 'auto', display: 'block', ...style }}>
      {gradient && <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={gradient[0]} /><stop offset="1" stopColor={gradient[1]} /></linearGradient></defs>}
      <path d={MARK_PATH} fill={gradient ? `url(#${id})` : color} />
    </svg>
  );
};

/** Film grain over the dark parts: a moving fine noise, very faint. */
const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%"><filter id={`g${f % 8}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 8} /></filter><rect width="100%" height="100%" filter={`url(#g${f % 8})`} /></svg>
    </AbsoluteFill>
  );
};

/** A line that rises into focus: from below, blurred, to sharp. */
const rise = (frame: number, at: number, dist = 46, len = 26) => {
  const t = ramp(frame, at, at + len, outExpo);
  return { opacity: t, transform: `translateY(${(1 - t) * dist}px)`, filter: `blur(${(1 - t) * 14}px)` };
};

export const HemloAd: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const c = COPY[lang], rtl = lang === 'ar', dir = rtl ? -1 : 1;
  const font = FONT[lang];
  return (
    <AbsoluteFill dir={rtl ? 'rtl' : 'ltr'} style={{ background: INK, fontFamily: font, color: TEXT }}>
      <Audio src={staticFile('ad/audio/ad.wav')} />
      {frame < T.light + 70 && <Problem frame={frame} c={c} lang={lang} />}
      {frame >= T.light && frame < T.call && <Trades frame={frame} c={c} lang={lang} dir={dir} />}
      {frame >= T.together - 30 && frame < T.call && <Together frame={frame} c={c} lang={lang} />}
      {frame >= T.call - 40 && <Call frame={frame} c={c} lang={lang} />}
    </AbsoluteFill>
  );
};

// ---------- 1 · the problem, and 2 · the H ----------
const Problem: React.FC<{ frame: number; c: (typeof COPY)['ar']; lang: Lang }> = ({ frame, c, lang }) => {
  const big = lang === 'ar' ? 112 : 104;
  const qAt = 276, lines = [24, 120, 216];
  const gone = ramp(frame, qAt - 14, qAt + 6);              // the three lines step back for the question
  const out = ramp(frame, 352, 362);                        // everything goes dark before the hit
  const clock = ramp(frame, 0, 360);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(90% 60% at 50% 40%, #151B26, ${INK} 70%)` }}>
      <Grain />
      {/* a quiet clock filling as the seconds go */}
      <AbsoluteFill style={{ opacity: (1 - out) * 0.8, alignItems: 'center', paddingTop: 210 }}>
        <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth="3" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${176 * clock} 176`} transform="rotate(-90 32 32)" /></svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 90px', gap: 34, opacity: (1 - gone) * (1 - out) }}>
        {c.lines.map(([a, b], i) => {
          const dim = i < 2 ? ramp(frame, lines[i + 1], lines[i + 1] + 20) : 0;
          return (
            <div key={i} style={{ ...rise(frame, lines[i]), fontSize: big, fontWeight: 700, lineHeight: 1.15, letterSpacing: lang === 'en' ? '-0.03em' : 0, opacity: rise(frame, lines[i]).opacity * (1 - dim * 0.7) }}>
              <span>{a} </span><span style={{ color: '#7D8696', fontWeight: lang === 'ar' ? 400 : 300 }}>{b}</span>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', opacity: 1 - out }}>
        <div style={{ ...rise(frame, qAt, 60, 30), fontSize: lang === 'ar' ? 150 : 128, fontWeight: 700, lineHeight: 1.08, letterSpacing: lang === 'en' ? '-0.04em' : 0 }}>
          <div>{c.question[0]}</div>
          <div style={{ color: '#FF6B5B' }}>{c.question[1]}</div>
          <div style={{ height: 8, margin: '26px auto 0', width: 300 * ramp(frame, qAt + 20, qAt + 60, ease), background: '#FF6B5B', borderRadius: 8 }} />
        </div>
      </AbsoluteFill>
      <Reveal frame={frame} c={c} lang={lang} />
    </AbsoluteFill>
  );
};

const Reveal: React.FC<{ frame: number; c: (typeof COPY)['ar']; lang: Lang }> = ({ frame, c, lang }) => {
  const { fps } = useVideoConfig();
  if (frame < T.hit) return null;
  const s = spring({ frame: frame - T.hit, fps, config: { damping: 14, mass: 0.9, stiffness: 110 } });
  const sweep = interpolate(frame, [T.hit + 8, T.hit + 60], [-40, 140], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow = ramp(frame, T.hit, T.hit + 30) * (1 - 0.4 * ramp(frame, T.hit + 40, T.hit + 120));
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: INK }}>
      <AbsoluteFill style={{ background: `radial-gradient(40% 26% at 50% 42%, rgb(255 140 90 / ${0.32 * glow}), transparent 70%)` }} />
      <Grain opacity={0.05} />
      <div style={{ position: 'relative', transform: `translateY(-120px) scale(${0.55 + 0.45 * s})`, filter: `drop-shadow(0 0 ${40 * glow}px rgb(255 150 100 / ${0.55 * glow}))` }}>
        <Mark size={300} gradient={['#FFFFFF', '#E9E2D6']} />
        {/* a light sweeping across the mark */}
        <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${MARK_VIEWBOX}'><path d='${MARK_PATH}'/></svg>`)}")`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
          background: `linear-gradient(105deg, transparent ${sweep - 18}%, rgb(255 255 255 / .95) ${sweep}%, transparent ${sweep + 18}%)` }} />
      </div>
      <div style={{ position: 'absolute', top: 1140, width: '100%', textAlign: 'center' }}>
        <div style={{ ...rise(frame, T.hit + 34, 30), fontSize: lang === 'ar' ? 104 : 110, fontWeight: lang === 'ar' ? 700 : 600, letterSpacing: lang === 'en' ? '-0.03em' : 0 }}>{c.brand}</div>
        <div style={{ ...rise(frame, T.hit + 80, 30), marginTop: 26, fontSize: lang === 'ar' ? 64 : 58, fontWeight: lang === 'ar' ? 500 : 400, color: '#B9C0CC', lineHeight: 1.3 }}>
          <div>{c.promise[0]}</div><div style={{ color: TEXT }}>{c.promise[1]}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3 · four trades ----------
const PW = 540, PH = Math.round(PW * 1818 / 840);
const Phone: React.FC<{ src: string; width?: number; style?: React.CSSProperties }> = ({ src, width = PW, style }) => (
  <div style={{ position: 'absolute', width, height: Math.round(width * 1818 / 840), borderRadius: width * 0.13, border: `${Math.round(width * 0.028)}px solid #070A10`, background: '#070A10', overflow: 'hidden',
    boxShadow: '0 60px 120px -40px rgb(11 15 22 / .55), 0 0 0 1px rgb(255 255 255 / .06)', ...style }}>
    <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: width * 0.105 }} />
  </div>
);

const Trades: React.FC<{ frame: number; c: (typeof COPY)['ar']; lang: Lang; dir: number }> = ({ frame, c, lang, dir }) => {
  const { fps } = useVideoConfig();
  const open = ramp(frame, T.light, T.light + 58, ease);       // light opens from the mark
  const i = Math.max(0, Math.min(3, Math.floor((frame - T.trades) / T.trade)));
  const at = T.trades + i * T.trade;
  const tr = TRADES[i], copy = c.trades[i];
  const big = lang === 'ar' ? 92 : 88;
  const toFan = ramp(frame, T.together - 30, T.together + 10, ease);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${open * 140}% at 50% 40%)`, background: PAPER, color: FG, opacity: 1 - toFan }}>
      {/* the trade's colour, washing in and out between trades */}
      {TRADES.map((x, k) => {
        const a = T.trades + k * T.trade, o = Math.min(ramp(frame, a - 20, a + 20), 1 - ramp(frame, a + T.trade - 20, a + T.trade + 20));
        return <AbsoluteFill key={x.id} style={{ opacity: k === 0 && frame < T.trades ? 1 : o, background: `radial-gradient(70% 45% at 50% 78%, ${x.color}38, transparent 70%), radial-gradient(60% 30% at 50% 0%, ${x.color}1F, transparent 70%)` }} />;
      })}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 0.06 }}><Mark size={1500} color={tr.color} /></AbsoluteFill>
      {/* the words */}
      {TRADES.map((x, k) => {
        const a = T.trades + k * T.trade;
        if (frame < a - 20 || frame > a + T.trade + 10) return null;
        const leave = ramp(frame, a + T.trade - 22, a + T.trade - 4);
        const r1 = rise(frame, a + 6, 40), r2 = rise(frame, a + 16, 40);
        return (
          <div key={x.id} style={{ position: 'absolute', top: 170, insetInline: 80, opacity: 1 - leave, transform: `translateY(${-leave * 30}px)` }}>
            <div style={{ ...r1, display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 26px', borderRadius: 999, background: `${x.color}1C`, color: x.color, fontSize: 38, fontWeight: 600 }}>
              <span style={{ width: 14, height: 14, borderRadius: 999, background: x.color }} />{c.trades[k].kicker}
            </div>
            <div style={{ ...r2, marginTop: 30, fontSize: big, fontWeight: 700, lineHeight: 1.12, letterSpacing: lang === 'en' ? '-0.035em' : 0 }}>
              <div>{c.trades[k].head[0]}</div><div style={{ color: x.color }}>{c.trades[k].head[1]}</div>
            </div>
          </div>
        );
      })}
      {/* the phone: in from the side with a turn, out the other way */}
      {TRADES.map((x, k) => {
        const a = T.trades + k * T.trade;
        if (frame < a - 26 || frame > a + T.trade + 4) return null;
        const s = spring({ frame: frame - (a - 22), fps, config: { damping: 18, stiffness: 120, mass: 0.9 } });
        const out = k < 3 ? ramp(frame, a + T.trade - 20, a + T.trade + 4, ease) : 0;
        const x0 = (1 - s) * 900 * dir - out * 1000 * dir;
        const rot = (1 - s) * -24 * dir + out * 18 * dir;
        const float = Math.sin((frame - a) / 38) * 8;
        return (
          <Phone key={x.id} src={`ad/shots/${x.id}-${lang}.webp`} style={{ left: (1080 - PW) / 2, top: 690, transform: `perspective(2200px) translateX(${x0}px) translateY(${float}px) rotateY(${rot}deg)`, filter: `blur(${Math.abs(out) * 6}px)` }} />
        );
      })}
      {/* a moment from its day */}
      {(() => {
        const showAt = at + 90, t = spring({ frame: frame - showAt, fps, config: { damping: 15, stiffness: 160 } });
        const hide = ramp(frame, at + T.trade - 26, at + T.trade - 10);
        if (frame < showAt) return null;
        return (
          <div style={{ position: 'absolute', top: 1470, insetInlineStart: 70, display: 'flex', alignItems: 'center', gap: 22, padding: '24px 34px 24px 24px', borderRadius: 34, background: 'rgb(255 255 255 / .92)',
            boxShadow: '0 30px 60px -24px rgb(14 20 32 / .45), 0 0 0 1px rgb(14 20 32 / .06)', opacity: t * (1 - hide), transform: `translateY(${(1 - t) * 40}px) scale(${0.9 + 0.1 * t})`, transformOrigin: 'left center' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: 24, background: tr.color }}>
              <svg viewBox="0 0 16 16" width="38" height="38" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={tr.icon} /></svg>
            </span>
            <span><div style={{ fontSize: 36, fontWeight: 700, color: FG }}>{copy.toast[0]}</div><div style={{ marginTop: 4, fontSize: 28, color: '#5B6472' }}>{copy.toast[1]}</div></span>
          </div>
        );
      })()}
      {/* where we are: four dots */}
      <div style={{ position: 'absolute', bottom: 70, width: '100%', display: 'flex', justifyContent: 'center', gap: 14, opacity: ramp(frame, T.trades, T.trades + 20) }}>
        {TRADES.map((x, k) => <span key={x.id} style={{ width: k === i ? 54 : 14, height: 14, borderRadius: 999, background: k === i ? tr.color : 'rgb(14 20 32 / .16)' }} />)}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 4 · all together ----------
const Together: React.FC<{ frame: number; c: (typeof COPY)['ar']; lang: Lang }> = ({ frame, c, lang }) => {
  const { fps } = useVideoConfig();
  const a = T.together;
  const fade = ramp(frame, a - 30, a);
  const leave = ramp(frame, T.call - 34, T.call - 6, ease);
  const W = 300;
  return (
    <AbsoluteFill style={{ background: PAPER, color: FG, opacity: fade }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 40% at 50% 62%, rgb(168 83 46 / .16), transparent 70%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 300 }}>
        <div style={{ opacity: 0.09 * ramp(frame, a, a + 30), transform: `scale(${0.9 + 0.1 * ramp(frame, a, a + 90, outExpo)})` }}><Mark size={1100} color="#A8532E" /></div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 190, width: '100%', textAlign: 'center', fontSize: lang === 'ar' ? 104 : 96, fontWeight: 700, lineHeight: 1.1, letterSpacing: lang === 'en' ? '-0.035em' : 0, opacity: 1 - leave }}>
        <div style={rise(frame, a + 4, 40)}>{c.together[0]}</div>
        <div style={{ ...rise(frame, a + 16, 40), color: '#A8532E' }}>{c.together[1]}</div>
      </div>
      {TRADES.map((x, k) => {
        const s = spring({ frame: frame - (a + k * 6), fps, config: { damping: 16, stiffness: 110 } });
        const slot = k - 1.5, rot = slot * 9, tx = slot * 215, ty = Math.abs(slot) * 46;
        const from = [[-700, 400], [-300, 900], [300, 900], [700, 400]][k];
        return (
          <Phone key={x.id} src={`ad/shots/${x.id}-${lang}.webp`} width={W} style={{ left: (1080 - W) / 2, top: 720, zIndex: k === 1 || k === 2 ? 2 : 1, opacity: 1 - leave,
            transform: `translate(${tx * s + from[0] * (1 - s)}px, ${ty * s + from[1] * (1 - s) + leave * 120}px) rotate(${rot * s}deg) scale(${1 - leave * 0.1})` }} />
        );
      })}
      <div style={{ position: 'absolute', bottom: 150, insetInline: 60, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, opacity: 1 - leave }}>
        {c.chips.map((t, k) => (
          <span key={t} style={{ ...rise(frame, a + 50 + k * 8, 24, 20), padding: '16px 30px', borderRadius: 999, background: '#FFFFFF', boxShadow: '0 10px 30px -18px rgb(14 20 32 / .5), 0 0 0 1px rgb(14 20 32 / .06)', fontSize: 36, fontWeight: 600 }}>{t}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 5 · the call ----------
const Call: React.FC<{ frame: number; c: (typeof COPY)['ar']; lang: Lang }> = ({ frame, c, lang }) => {
  const { fps } = useVideoConfig();
  const a = T.call;
  const wipe = ramp(frame, a - 40, a + 4, ease);
  const m = spring({ frame: frame - a, fps, config: { damping: 14, stiffness: 120 } });
  const shine = interpolate(frame, [a + 70, a + 130], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ clipPath: `circle(${wipe * 120}% at 50% 50%)`, background: `radial-gradient(70% 45% at 50% 40%, #1C2433, ${INK} 75%)` }}>
      <AbsoluteFill style={{ background: 'radial-gradient(36% 22% at 50% 34%, rgb(255 130 80 / .22), transparent 70%)' }} />
      <Grain opacity={0.05} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, transform: `scale(${0.7 + 0.3 * m})`, opacity: m }}>
          <Mark size={150} gradient={['#FFFFFF', '#E9E2D6']} />
          <span style={{ fontSize: lang === 'ar' ? 120 : 128, fontWeight: lang === 'ar' ? 700 : 600, letterSpacing: lang === 'en' ? '-0.03em' : 0 }}>{c.brand}</span>
        </div>
        <div style={{ ...rise(frame, a + 26, 40), marginTop: 120, fontSize: lang === 'ar' ? 92 : 84, fontWeight: 700, textAlign: 'center', lineHeight: 1.15, padding: '0 70px', letterSpacing: lang === 'en' ? '-0.03em' : 0 }}>{c.cta}</div>
        <div style={{ ...rise(frame, a + 46, 30), marginTop: 70, position: 'relative', overflow: 'hidden', padding: '30px 64px', borderRadius: 999, background: '#FFFFFF', color: FG, fontSize: 64, fontWeight: 600, direction: 'ltr', letterSpacing: '-0.01em' }}>
          {c.url}
          <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${shine - 15}%, rgb(255 180 140 / .55) ${shine}%, transparent ${shine + 15}%)` }} />
        </div>
        <div style={{ ...rise(frame, a + 64, 24), marginTop: 46, fontSize: 40, color: '#9AA3B2' }}>{c.fine}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
