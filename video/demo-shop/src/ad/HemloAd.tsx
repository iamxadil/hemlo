// Hemlo's ad: 45 seconds, vertical (1080×1920) for Reels, TikTok and Stories, in Arabic or English. A short film:
//   1 · the night (0–8 s): 11 PM, the shop is shut and the owner is still counting; the question that hurts
//   2 · the H (8–13 s): a breath, the founder's mark lands with the hit, light rays and a flare; "it counts for you"
//   3 · four trades (13–35 s): each in its own light; its real phone screen sharp in front of its real desk screen,
//       blurred behind; the line, a number that matters, and a moment from its day
//   4 · together (35–40 s): the four phones around the H; made in Iraq, for business in Iraq
//   5 · the call (40–45 s): try it free, hemlohq.com
// Dark and cinematic throughout: grain, a vignette, drifting lights, slow camera pushes. The score is a piano with
// strings (tools/make-ad-audio.mjs: 90 BPM, a bar is 160 frames) and every cut lands on a bar.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT, MARK_PATH, MARK_VIEWBOX, outExpo, ease } from '../theme';
import { ramp } from '../anim';

export type Lang = 'ar' | 'en';
const BAR = 160;
export const AD_DURATION = 17 * BAR; // 2720 frames, 45.3 s
const T = { night: 0, hit: 3 * BAR, trades: 5 * BAR, trade: 2 * BAR, together: 13 * BAR, call: 15 * BAR };
const INK = '#07090D', TEXT = '#F4F1EA', SOFT = '#A9B1BE';

const TRADES = [
  { id: 'gym', color: '#FF6A3D', icon: 'M2.5 7.5a5.5 5.5 0 1 1 2.4 4.5L2.5 13l.9-2.6a5.5 5.5 0 0 1-.9-2.9ZM6 7.5l1.5 1.5L10.5 6' },
  { id: 'dental', color: '#E2B85C', icon: 'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM8 5v3l2 1.5' },
  { id: 'stores', color: '#E07A4F', icon: 'M4.5 12.5h7a3 3 0 0 0 .4-6 4 4 0 0 0-7.7-.9A3.5 3.5 0 0 0 4.5 12.5ZM6.5 9.5l1.2 1.2 2.3-2.4' },
  { id: 'realestate', color: '#4FC59B', icon: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
] as const;

const COPY = {
  ar: {
    clock: '11:07', night: 'بالليل.', shut: 'المحل مسدود…', still: 'وإنت بعدك تحسب.',
    lists: ['دين بالدفتر.', 'موعد بالواتساب.', 'اشتراك بالذاكرة.'], question: ['شكد', 'ضايع عليك؟'],
    brand: 'هيملو', relief: ['يحسب عنك.', 'يذكّر عنك.', 'وإنت ترتاح.'],
    trades: [
      { kicker: 'للأندية الرياضية', head: ['المشترك', 'يجدّد وحده.'], stat: '14', statLabel: 'تذكير تجديد أُرسل اليوم', toast: ['أُرسل تذكير التجديد', 'إلى 14 مشتركاً · واتساب'] },
      { kicker: 'لعيادات الأسنان', head: ['السعر واضح', 'قبل العلاج.'], stat: '350,000', statLabel: 'د.ع · خطة العلاج على الواتساب', toast: ['التالي: يوسف أحمد', '15:30 · بعد 13 دقيقة'] },
      { kicker: 'للمتاجر والماركتات', head: ['كل دينار', 'بمكانه.'], stat: '116,750', statLabel: 'د.ع مبيعات اليوم', toast: ['حُفظ البيع بدون إنترنت', 'يتزامن حين يعود الاتصال'] },
      { kicker: 'لمكاتب العقارات', head: ['كل عقار', 'يلقى زبونه.'], stat: '100%', statLabel: 'تطابق مع طلب أحمد', toast: ['أحمد فتح صفحة الفيلا', '3 مرات · قبل دقيقة'] },
    ],
    together: ['نظام واحد.', 'لكل عملك.'], made: 'صُنع في العراق، لعملك في العراق.', chips: ['بالعربي', 'بالدينار', 'يشتغل بلا إنترنت', 'من الموبايل'],
    cta: 'جرّبه مجاناً ٣٠ يوماً', url: 'hemlohq.com', fine: 'بلا بطاقة. بلا التزام.',
  },
  en: {
    clock: '11:07', night: 'PM.', shut: 'The shop is closed…', still: 'and you’re still counting.',
    lists: ['Debts in a notebook.', 'Bookings on WhatsApp.', 'Memberships from memory.'], question: ['How much', 'are you losing?'],
    brand: 'Hemlo', relief: ['It counts for you.', 'It reminds for you.', 'You rest.'],
    trades: [
      { kicker: 'For gyms', head: ['Members renew.', 'On their own.'], stat: '14', statLabel: 'renewal reminders sent today', toast: ['Renewal reminders sent', '14 members · WhatsApp'] },
      { kicker: 'For dental clinics', head: ['Clear prices,', 'before treatment.'], stat: '350,000', statLabel: 'IQD · the plan, on WhatsApp', toast: ['Next up: Yousif Ahmed', '15:30 · in 13 min'] },
      { kicker: 'For shops and markets', head: ['Every dinar,', 'accounted for.'], stat: '116,750', statLabel: 'IQD sold today', toast: ['Sale saved offline', 'Syncs when you’re back online'] },
      { kicker: 'For real estate offices', head: ['Every property', 'finds its buyer.'], stat: '100%', statLabel: 'match with what Ahmed wants', toast: ['Ahmed opened the villa’s page', '3 times · a minute ago'] },
    ],
    together: ['One system.', 'Your whole business.'], made: 'Made in Iraq, for business in Iraq.', chips: ['In Arabic', 'In dinars', 'Works offline', 'On your phone'],
    cta: 'Try it free for 30 days', url: 'hemlohq.com', fine: 'No card. No commitment.',
  },
};
type Copy = (typeof COPY)['ar'];

// ---------- the look ----------
const Mark: React.FC<{ size: number; color?: string; style?: React.CSSProperties; gradient?: [string, string] }> = ({ size, color = TEXT, style, gradient }) => {
  const id = 'm' + React.useId().replace(/[^a-z0-9]/gi, '');
  return (
    <svg viewBox={MARK_VIEWBOX} style={{ height: size, width: 'auto', display: 'block', ...style }}>
      {gradient && <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={gradient[0]} /><stop offset="1" stopColor={gradient[1]} /></linearGradient></defs>}
      <path d={MARK_PATH} fill={gradient ? `url(#${id})` : color} />
    </svg>
  );
};
const MARK_MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${MARK_VIEWBOX}'><path d='${MARK_PATH}'/></svg>`)}")`;

/** Film: a fine moving grain and a soft vignette over everything. */
const Film: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      <AbsoluteFill style={{ opacity: 0.075, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <svg width="100%" height="100%"><filter id={`g${f % 6}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 6} /></filter><rect width="100%" height="100%" filter={`url(#g${f % 6})`} /></svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(120% 85% at 50% 45%, transparent 55%, rgb(0 0 0 / .72) 100%)' }} />
    </>
  );
};

/** City lights out of focus, drifting slowly: the night outside the shop. */
const Bokeh: React.FC<{ tint?: string; count?: number; opacity?: number }> = ({ tint, count = 14, opacity = 1 }) => {
  const f = useCurrentFrame();
  const dots = React.useMemo(() => Array.from({ length: count }, (_, i) => {
    const r = (k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    return { x: r(1) * 1080, y: r(2) * 1920, s: 60 + r(3) * 220, sp: 0.15 + r(4) * 0.35, warm: r(5) > 0.35, o: 0.08 + r(6) * 0.22, ph: r(7) * 6.28 };
  }), [count]);
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
      {dots.map((d, i) => (
        <div key={i} style={{ position: 'absolute', left: d.x + Math.sin(f / 90 + d.ph) * 30, top: (d.y - f * d.sp + 2200) % 2200 - 140, width: d.s, height: d.s, borderRadius: '50%',
          background: tint ?? (d.warm ? '#FFB066' : '#8FB4FF'), opacity: d.o * (0.75 + 0.25 * Math.sin(f / 40 + d.ph)), filter: `blur(${d.s / 5}px)` }} />
      ))}
    </AbsoluteFill>
  );
};

/** Light rays turning slowly behind a subject. */
const Rays: React.FC<{ color: string; opacity: number; y?: string }> = ({ color, opacity, y = '42%' }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen', pointerEvents: 'none', WebkitMaskImage: `radial-gradient(55% 40% at 50% ${y}, #000 10%, transparent 75%)` }}>
      <AbsoluteFill style={{ background: `repeating-conic-gradient(from ${f * 0.12}deg at 50% ${y}, ${color} 0deg 3deg, transparent 6deg 18deg)`, filter: 'blur(6px)' }} />
    </AbsoluteFill>
  );
};

/** An anamorphic flare: a thin horizontal streak of light with a hot centre. */
const Flare: React.FC<{ at: number; y: number; color?: string }> = ({ at, y, color = '#FFC9A8' }) => {
  const f = useCurrentFrame();
  const t = ramp(f, at, at + 10) * (1 - ramp(f, at + 14, at + 90, outExpo));
  if (t <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: t }}>
      <div style={{ position: 'absolute', top: y - 3, left: -200, right: -200, height: 6, background: `linear-gradient(90deg, transparent, ${color} 35%, #fff 50%, ${color} 65%, transparent)`, filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', top: y - 60, left: 540 - 60, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgb(255 255 255 / .9), transparent 70%)' }} />
    </AbsoluteFill>
  );
};

/** Text rising into focus. */
const rise = (frame: number, at: number, dist = 40, len = 30) => {
  const t = ramp(frame, at, at + len, outExpo);
  return { opacity: t, transform: `translateY(${(1 - t) * dist}px)`, filter: `blur(${(1 - t) * 16}px)` } as React.CSSProperties;
};
/** Text leaving softly. */
const fadeOut = (frame: number, a: number, b: number) => 1 - ramp(frame, a, b);
/** A slow camera push over a shot. */
const push = (frame: number, a: number, b: number, from = 1, to = 1.07) => interpolate(frame, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const HemloAd: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const c = COPY[lang], rtl = lang === 'ar';
  return (
    <AbsoluteFill dir={rtl ? 'rtl' : 'ltr'} style={{ background: INK, fontFamily: FONT[lang], color: TEXT }}>
      <Audio src={staticFile('ad/audio/ad.wav')} />
      {frame < T.hit + 4 && <Night frame={frame} c={c} lang={lang} />}
      {frame >= T.hit && frame < T.trades + 30 && <Reveal frame={frame} c={c} lang={lang} />}
      {frame >= T.trades - 20 && frame < T.together + 30 && <Trades frame={frame} c={c} lang={lang} />}
      {frame >= T.together - 20 && frame < T.call + 30 && <Together frame={frame} c={c} lang={lang} />}
      {frame >= T.call - 20 && <Call frame={frame} c={c} lang={lang} />}
      <Film />
    </AbsoluteFill>
  );
};

// ---------- 1 · the night ----------
const Night: React.FC<{ frame: number; c: Copy; lang: Lang }> = ({ frame, c, lang }) => {
  const ar = lang === 'ar';
  const z = push(frame, 0, T.hit, 1, 1.12);
  const end = ramp(frame, T.hit - 18, T.hit - 2);                 // to black, a breath before the hit
  const part1 = fadeOut(frame, 300, 330), part2 = fadeOut(frame, 380, 400);
  const colon = Math.floor(frame / 30) % 2 ? 0.25 : 1;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(90% 60% at 50% 38%, #111826, #07090D 70%)', opacity: 1 - end }}>
      <Bokeh opacity={0.9} />
      <AbsoluteFill style={{ transform: `scale(${z})`, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {/* 11:07 at night */}
        <div style={{ position: 'absolute', top: 520, width: '100%', opacity: part1 }}>
          <div style={{ ...rise(frame, 18, 30, 50), fontSize: 250, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1, direction: 'ltr', fontFamily: FONT.en, textShadow: '0 0 60px rgb(255 176 102 / .35)' }}>
            {c.clock.slice(0, 2)}<span style={{ opacity: colon }}>:</span>{c.clock.slice(3)}
          </div>
          <div style={{ ...rise(frame, 46, 20), fontSize: 64, color: SOFT, marginTop: 16, fontWeight: ar ? 500 : 400 }}>{c.night}</div>
          <div style={{ ...rise(frame, 130, 30), fontSize: ar ? 84 : 76, fontWeight: 600, marginTop: 120, lineHeight: 1.2 }}>{c.shut}</div>
          <div style={{ ...rise(frame, 210, 30), fontSize: ar ? 84 : 76, fontWeight: 600, lineHeight: 1.2, color: '#FFB066' }}>{c.still}</div>
        </div>
        {/* the three ways it's done today, quickly */}
        <div style={{ position: 'absolute', top: 700, width: '100%', opacity: part2 * ramp(frame, 318, 330) }}>
          {c.lists.map((t, i) => <div key={t} style={{ ...rise(frame, 322 + i * 16, 26, 22), fontSize: ar ? 74 : 66, fontWeight: 500, color: i === 2 ? TEXT : SOFT, lineHeight: 1.45 }}>{t}</div>)}
        </div>
        {/* the question */}
        <div style={{ position: 'absolute', top: 740, width: '100%', ...rise(frame, 396, 50, 34) }}>
          <div style={{ fontSize: ar ? 150 : 132, fontWeight: 700, lineHeight: 1.05, letterSpacing: ar ? 0 : '-0.045em' }}>{c.question[0]}</div>
          <div style={{ fontSize: ar ? 150 : 132, fontWeight: 700, lineHeight: 1.15, letterSpacing: ar ? 0 : '-0.045em', color: '#FF7A66', textShadow: '0 0 50px rgb(255 90 70 / .35)' }}>{c.question[1]}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 2 · the H ----------
const Reveal: React.FC<{ frame: number; c: Copy; lang: Lang }> = ({ frame, c, lang }) => {
  const { fps } = useVideoConfig();
  const a = T.hit, ar = lang === 'ar';
  const s = spring({ frame: frame - a, fps, config: { damping: 16, mass: 1, stiffness: 90 } });
  const sweep = interpolate(frame, [a + 6, a + 70], [-40, 140], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glow = ramp(frame, a, a + 24) * (1 - 0.35 * ramp(frame, a + 40, a + 160));
  const out = ramp(frame, T.trades - 26, T.trades + 6, ease);
  const z = push(frame, a, T.trades, 1, 1.06);
  return (
    <AbsoluteFill style={{ background: INK, opacity: 1 - out }}>
      <AbsoluteFill style={{ background: `radial-gradient(45% 28% at 50% 38%, rgb(255 140 90 / ${0.36 * glow}), transparent 70%)` }} />
      <Rays color="rgb(255 190 150 / .5)" opacity={0.55 * glow} y="38%" />
      <Bokeh tint="#FFB98A" count={8} opacity={0.5 * ramp(frame, a + 20, a + 90)} />
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', justifyContent: 'center', transform: `scale(${0.6 + 0.4 * s})`, opacity: Math.min(1, s * 1.4),
          filter: `drop-shadow(0 0 ${46 * glow}px rgb(255 160 110 / ${0.6 * glow}))` }}>
          <div style={{ position: 'relative' }}>
            <Mark size={330} gradient={['#FFFFFF', '#E7DFD2']} />
            <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: MARK_MASK, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
              background: `linear-gradient(105deg, transparent ${sweep - 16}%, rgb(255 255 255 / .95) ${sweep}%, transparent ${sweep + 16}%)` }} />
          </div>
        </div>
        <Flare at={a + 2} y={635} />
        <div style={{ position: 'absolute', top: 900, width: '100%', textAlign: 'center' }}>
          <div style={{ ...rise(frame, a + 40, 30), fontSize: ar ? 120 : 124, fontWeight: ar ? 700 : 600, letterSpacing: ar ? 0 : '-0.035em' }}>{c.brand}</div>
          <div style={{ marginTop: 70 }}>
            {c.relief.map((t, i) => <div key={t} style={{ ...rise(frame, a + 110 + i * 40, 26), fontSize: ar ? 76 : 68, fontWeight: i === 2 ? 700 : 500, color: i === 2 ? '#FFC9A8' : SOFT, lineHeight: 1.4 }}>{t}</div>)}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- 3 · the trades ----------
const PW = 520;
const Phone: React.FC<{ src: string; width?: number; style?: React.CSSProperties; glow?: string }> = ({ src, width = PW, style, glow }) => (
  <div style={{ position: 'absolute', width, height: Math.round(width * 1818 / 840), borderRadius: width * 0.13, border: `${Math.round(width * 0.026)}px solid #05070A`, background: '#05070A', overflow: 'hidden',
    boxShadow: `0 80px 140px -50px rgb(0 0 0 / .9), 0 0 0 1.5px rgb(255 255 255 / .1)${glow ? `, 0 0 120px -20px ${glow}` : ''}`, ...style }}>
    <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: width * 0.105 }} />
  </div>
);

const Trades: React.FC<{ frame: number; c: Copy; lang: Lang }> = ({ frame, c, lang }) => {
  const { fps } = useVideoConfig();
  const ar = lang === 'ar', dir = ar ? -1 : 1;
  const enter = ramp(frame, T.trades - 20, T.trades + 14), leave = ramp(frame, T.together - 22, T.together + 10);
  return (
    <AbsoluteFill style={{ background: INK, opacity: enter * (1 - leave) }}>
      {TRADES.map((x, k) => {
        const a = T.trades + k * T.trade, b = a + T.trade;
        if (frame < a - 24 || frame > b + 24) return null;
        const o = Math.min(ramp(frame, a - 24, a + 8), 1 - ramp(frame, b - 8, b + 24));
        const local = frame - a, copy = c.trades[k];
        const z = push(frame, a - 24, b + 24, 1.0, 1.08);
        const ps = spring({ frame: frame - (a - 10), fps, config: { damping: 20, stiffness: 90, mass: 1 } });
        const turn = Math.sin(local / 70) * 3;
        const count = ramp(frame, a + 120, a + 175, outExpo);
        const statNum = Number(copy.stat.replace(/[^\d]/g, ''));
        const statText = copy.stat.includes('%') ? `${Math.round(statNum * count)}%` : new Intl.NumberFormat('en-US').format(Math.round(statNum * count));
        const toast = spring({ frame: frame - (a + 200), fps, config: { damping: 15, stiffness: 150 } });
        return (
          <AbsoluteFill key={x.id} style={{ opacity: o }}>
            {/* its light */}
            <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 50% 70%, ${x.color}40, transparent 70%), radial-gradient(80% 40% at 50% 0%, ${x.color}22, transparent 70%)` }} />
            <Rays color={`${x.color}55`} opacity={0.35} y="68%" />
            <AbsoluteFill style={{ transform: `scale(${z})` }}>
              {/* its desk screen, far behind, out of focus */}
              <Img src={staticFile(`ad/shots/${x.id}-desk-${lang}.webp`)} style={{ position: 'absolute', width: 1700, left: (1080 - 1700) / 2 + dir * 120, top: 760, borderRadius: 30,
                transform: `perspective(2400px) rotateY(${-22 * dir}deg) rotateX(10deg)`, filter: 'blur(7px) brightness(.55) saturate(1.1)', opacity: 0.8 }} />
              <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK} 18%, transparent 46%, transparent 80%, ${INK} 100%)` }} />
              {/* the phone, sharp, in front */}
              <Phone src={`ad/shots/${x.id}-${lang}.webp`} glow={`${x.color}66`} style={{ left: (1080 - PW) / 2, top: 760,
                transform: `perspective(2000px) translateY(${(1 - ps) * 700}px) rotateY(${(1 - ps) * 30 * dir + turn}deg) rotateX(${(1 - ps) * 14}deg)` }} />
            </AbsoluteFill>
            {/* the words */}
            <div style={{ position: 'absolute', top: 150, insetInline: 84, opacity: fadeOut(frame, b - 20, b - 2) }}>
              <div style={{ ...rise(frame, a + 4, 26), display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 26px', borderRadius: 999, background: `${x.color}24`, color: x.color, fontSize: 36, fontWeight: 600, border: `1px solid ${x.color}55` }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: x.color, boxShadow: `0 0 14px ${x.color}` }} />{copy.kicker}
              </div>
              <div style={{ marginTop: 28, fontSize: ar ? 96 : 90, fontWeight: 700, lineHeight: 1.1, letterSpacing: ar ? 0 : '-0.04em' }}>
                <div style={rise(frame, a + 14, 40)}>{copy.head[0]}</div>
                <div style={{ ...rise(frame, a + 26, 40), color: x.color, textShadow: `0 0 40px ${x.color}55` }}>{copy.head[1]}</div>
              </div>
              {/* the number that matters */}
              <div style={{ ...rise(frame, a + 112, 24), marginTop: 34, display: 'flex', alignItems: 'baseline', gap: 18 }}>
                <span style={{ fontSize: 76, fontWeight: 700, direction: 'ltr', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{statText}</span>
                <span style={{ fontSize: 32, color: SOFT }}>{copy.statLabel}</span>
              </div>
            </div>
            {/* a moment from its day */}
            {frame >= a + 200 && (
              <div style={{ position: 'absolute', top: 1560, insetInlineStart: 64, display: 'flex', alignItems: 'center', gap: 22, padding: '22px 34px 22px 22px', borderRadius: 34,
                background: 'rgb(22 26 34 / .82)', backdropFilter: 'blur(18px)', border: '1px solid rgb(255 255 255 / .12)', boxShadow: '0 30px 70px -20px rgb(0 0 0 / .8)',
                opacity: toast * fadeOut(frame, b - 18, b - 4), transform: `translateY(${(1 - toast) * 40}px) scale(${0.92 + 0.08 * toast})` }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 74, height: 74, borderRadius: 22, background: x.color, boxShadow: `0 0 30px ${x.color}88` }}>
                  <svg viewBox="0 0 16 16" width="36" height="36" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={x.icon} /></svg>
                </span>
                <span><div style={{ fontSize: 34, fontWeight: 700 }}>{copy.toast[0]}</div><div style={{ marginTop: 4, fontSize: 27, color: SOFT }}>{copy.toast[1]}</div></span>
              </div>
            )}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- 4 · together ----------
const Together: React.FC<{ frame: number; c: Copy; lang: Lang }> = ({ frame, c, lang }) => {
  const { fps } = useVideoConfig();
  const a = T.together, ar = lang === 'ar';
  const enter = ramp(frame, a - 20, a + 10), leave = ramp(frame, T.call - 26, T.call + 4, ease);
  const z = push(frame, a, T.call, 1, 1.06);
  const W = 300;
  return (
    <AbsoluteFill style={{ background: INK, opacity: enter * (1 - leave) }}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 40% at 50% 62%, rgb(255 140 90 / .2), transparent 70%)' }} />
      <Rays color="rgb(255 190 150 / .45)" opacity={0.4} y="60%" />
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', justifyContent: 'center', opacity: 0.13 * ramp(frame, a, a + 40) }}><Mark size={1050} gradient={['#FFC9A8', '#7A3E22']} /></div>
        {TRADES.map((x, k) => {
          const s = spring({ frame: frame - (a + k * 7), fps, config: { damping: 18, stiffness: 95 } });
          const slot = k - 1.5, from = [[-800, 300], [-300, 1000], [300, 1000], [800, 300]][k];
          return <Phone key={x.id} src={`ad/shots/${x.id}-${lang}.webp`} width={W} glow={`${x.color}44`} style={{ left: (1080 - W) / 2, top: 760, zIndex: k === 1 || k === 2 ? 2 : 1,
            transform: `translate(${slot * 215 * s + from[0] * (1 - s)}px, ${Math.abs(slot) * 50 * s + from[1] * (1 - s)}px) rotate(${slot * 9 * s}deg)` }} />;
        })}
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 170, width: '100%', textAlign: 'center', fontSize: ar ? 110 : 100, fontWeight: 700, lineHeight: 1.1, letterSpacing: ar ? 0 : '-0.04em' }}>
        <div style={rise(frame, a + 6, 40)}>{c.together[0]}</div>
        <div style={{ ...rise(frame, a + 20, 40), color: '#FFC9A8', textShadow: '0 0 50px rgb(255 160 110 / .35)' }}>{c.together[1]}</div>
        <div style={{ ...rise(frame, a + 60, 20), marginTop: 30, fontSize: ar ? 44 : 40, fontWeight: 500, color: SOFT, letterSpacing: 0 }}>{c.made}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 130, insetInline: 60, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
        {c.chips.map((t, k) => (
          <span key={t} style={{ ...rise(frame, a + 80 + k * 8, 20, 20), padding: '16px 30px', borderRadius: 999, background: 'rgb(255 255 255 / .08)', border: '1px solid rgb(255 255 255 / .16)', fontSize: 36, fontWeight: 600 }}>{t}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- 5 · the call ----------
const Call: React.FC<{ frame: number; c: Copy; lang: Lang }> = ({ frame, c, lang }) => {
  const { fps } = useVideoConfig();
  const a = T.call, ar = lang === 'ar';
  const enter = ramp(frame, a - 20, a + 6);
  const m = spring({ frame: frame - a, fps, config: { damping: 15, stiffness: 100 } });
  const shine = interpolate(frame, [a + 90, a + 160], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const z = push(frame, a, AD_DURATION, 1, 1.05);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 45% at 50% 40%, #171E2B, ${INK} 75%)`, opacity: enter }}>
      <Rays color="rgb(255 190 150 / .5)" opacity={0.5 * m} y="36%" />
      <AbsoluteFill style={{ background: 'radial-gradient(36% 22% at 50% 36%, rgb(255 130 80 / .24), transparent 70%)' }} />
      <Bokeh tint="#FFB98A" count={9} opacity={0.45} />
      <Flare at={a + 2} y={700} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 40, transform: `scale(${z})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30, transform: `scale(${0.7 + 0.3 * m})`, opacity: m, filter: 'drop-shadow(0 0 40px rgb(255 160 110 / .4))' }}>
          <Mark size={160} gradient={['#FFFFFF', '#E7DFD2']} />
          <span style={{ fontSize: ar ? 128 : 132, fontWeight: ar ? 700 : 600, letterSpacing: ar ? 0 : '-0.035em' }}>{c.brand}</span>
        </div>
        <div style={{ ...rise(frame, a + 30, 40), marginTop: 130, fontSize: ar ? 92 : 84, fontWeight: 700, textAlign: 'center', lineHeight: 1.15, padding: '0 70px', letterSpacing: ar ? 0 : '-0.035em' }}>{c.cta}</div>
        <div style={{ ...rise(frame, a + 54, 30), marginTop: 70, position: 'relative', overflow: 'hidden', padding: '30px 66px', borderRadius: 999, background: '#FFFFFF', color: '#0E1420', fontSize: 64, fontWeight: 600, direction: 'ltr', letterSpacing: '-0.01em', boxShadow: '0 0 80px -10px rgb(255 170 120 / .45)' }}>
          {c.url}
          <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${shine - 15}%, rgb(255 190 150 / .6) ${shine}%, transparent ${shine + 15}%)` }} />
        </div>
        <div style={{ ...rise(frame, a + 74, 24), marginTop: 46, fontSize: 40, color: SOFT }}>{c.fine}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
