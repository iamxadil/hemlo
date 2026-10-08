// Hemlo, the film: about a minute, 16:9, narrated, in English or Arabic. Apple- and Microsoft-style: a light canvas with
// drifting washes of colour, big tight type, real Hemlo screens on a laptop and a phone, everything gliding.
// The picture follows the voice word by word: public/ad2/schedules.json (tools/make-ad2-audio.mjs) says when each line
// is cut to and when each of its words is said, and every word on screen appears as it is spoken. Arabic is the same
// film mirrored (right to left), with the Arabic screens of each system.
import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT, MARK_PATH, MARK_VIEWBOX } from '../theme';
import { ramp } from '../anim';
import schedules from '../../public/ad2/schedules.json';

export type Lang = 'en' | 'ar';
type Line = { cut: number; start: number; end: number; phrases: number[]; words: [string, number][] };
type Sched = { fps: number; beat: number; frames: number; lines: Line[] };
const SCH = schedules as unknown as Partial<Record<Lang, Sched>>;
export const filmFrames = (lang: Lang) => SCH[lang]?.frames ?? 60;
export const hasFilm = (lang: Lang) => !!SCH[lang];

const INK = '#1D1D1F', GRAY = '#6E6E73', CANVAS = '#F5F5F7';
const glide = Easing.bezier(0.25, 1, 0.5, 1);   // a long, soft settle
const inOut = Easing.bezier(0.45, 0, 0.2, 1);
const SOFT = { damping: 30, stiffness: 110, mass: 1 };   // over-damped: arrives without a bounce
const SLOW = { damping: 34, stiffness: 68, mass: 1.2 };

// ---------- the words, in both languages ----------
const COPY = {
  en: {
    title: ['Running a business', 'means keeping track', 'of everything.'],
    mess: { labels: ['Debts, in a notebook.', 'Bookings, on WhatsApp.', 'Memberships, from memory.'], debts: 'Debts', bookings: 'Bookings',
      ledger: [['Ahmed K.', '25,000', 0], ['Sara M.', '10,000', 1], ['Abu Ali', '40,000 ?', 0], ['Hussein', '7,500', 0], ['Noor', '12,000', 1]] as [string, string, number][],
      chat: [['Can I book Thursday at 5?', 0], ['Sure, see you then ✓', 1], ['Sorry, I meant Tuesday', 0], ['Tuesday at 5 is taken…', 1], ['What about Wednesday?', 0]] as [string, number][],
      notes: ['Zainab — renew??', 'Who paid this month?', 'Call Omar back'] },
    better: 'There’s a better way.', name: 'Hemlo', nameW: 700,
    one: ['One system.', 'For your whole business.'],
    trades: [
      { kicker: 'Gyms', head: ['Check in', 'with a scan.'], sub: 'And renew on their own.', note: ['Zainab Ali checked in', '78 days left · 3 months'] },
      { kicker: 'Clinics', head: ['Every appointment.', 'Every treatment plan.'], sub: 'In one place.', note: ['Next up: Yousif Ahmed', '15:30 · in 13 minutes'] },
      { kicker: 'Shops', head: ['Sell in', 'seconds.'], sub: 'Even when the internet drops.', note: ['Sale saved offline', 'Syncs when you’re back online'] },
      { kicker: 'Real estate', head: ['Every property', 'gets its own page.'], sub: 'And finds its buyer.', note: ['Ahmed opened the villa’s page', '3 times · a minute ago'] },
    ],
    arabic: ['In Arabic.', 'In dinars.', 'Right on your phone.'], everything: ['Everything,', 'in one place.'],
    cta: 'Try it free for 30 days.', trades4: 'Gyms · Clinics · Shops · Real estate',
  },
  ar: {
    title: ['إدارةُ عملٍ', 'تعني أن تتابعَ', 'كلَّ شيء.'],
    mess: { labels: ['الديونُ، في دفتر.', 'الحجوزاتُ، على الواتساب.', 'والاشتراكاتُ، في الذاكرة.'], debts: 'الديون', bookings: 'الحجوزات',
      ledger: [['أحمد ك.', '25,000', 0], ['سارة م.', '10,000', 1], ['أبو علي', '40,000 ؟', 0], ['حسين', '7,500', 0], ['نور', '12,000', 1]] as [string, string, number][],
      chat: [['ممكن أحجز الخميس الساعة ٥؟', 0], ['أكيد، ننتظرك ✓', 1], ['عفواً، قصدي الثلاثاء', 0], ['الثلاثاء ٥ محجوز…', 1], ['طيب الأربعاء؟', 0]] as [string, number][],
      notes: ['زينب — تجدّد؟؟', 'منو دفع هالشهر؟', 'اتصل بعمر'] },
    better: 'هناك طريقةٌ أفضل.', name: 'هيملو', nameW: 600,
    one: ['نظامٌ واحد،', 'لعملِك كلِّه.'],
    trades: [
      { kicker: 'الأندية الرياضية', head: ['يدخلُ المشتركُ', 'بمسحةِ بطاقة،'], sub: 'ويجدّدُ اشتراكَه وحدَه.', note: ['زينب علي دخلت', '٧٨ يوماً متبقياً · ٣ أشهر'] },
      { kicker: 'العيادات', head: ['كلُّ موعد،', 'وكلُّ خطةِ علاج،'], sub: 'في مكانٍ واحد.', note: ['التالي: يوسف أحمد', '15:30 · بعد 13 دقيقة'] },
      { kicker: 'المتاجر', head: ['بِعْ في', 'ثوانٍ.'], sub: 'حتى حين ينقطعُ الإنترنت.', note: ['حُفظ البيع بدون إنترنت', 'يتزامن حين يعود الاتصال'] },
      { kicker: 'مكاتب العقارات', head: ['لكلِّ عقارٍ', 'صفحتُه،'], sub: 'ويجدُ زبونَه.', note: ['أحمد فتح صفحة الفيلا', '3 مرات · قبل دقيقة'] },
    ],
    arabic: ['بالعربية.', 'بالدينار.', 'على هاتفِك.'], everything: ['كلُّ شيء،', 'في مكانٍ واحد.'],
    cta: 'جرّبْه مجاناً ٣٠ يوماً.', trades4: 'الأندية · العيادات · المتاجر · العقارات',
  },
};
type Copy = (typeof COPY)['en'];

const Ctx = createContext<{ lang: Lang; L: Line[]; c: Copy; rtl: boolean; dir: number; frames: number }>(null as never);
const useFilm = () => useContext(Ctx);

// ---------- word sync ----------
const norm = (w: string) => w.toLowerCase().replace(/[ً-ْٰ]/g, '').replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
const ALIAS: Record<string, string> = { '30': 'thirty', '٣٠': 'ثلاثين' };
/** When each on-screen word is said: the texts are matched in order against the line's spoken words. */
function syncWords(line: Line, texts: string[]): number[][] {
  let cursor = 0, last = line.start;
  return texts.map((text) => text.split(/\s+/).filter(Boolean).map((w) => {
    const key = ALIAS[norm(w)] ?? norm(w);
    const at = line.words.findIndex(([s], i) => i >= cursor && norm(s) === key);
    if (at >= 0) { cursor = at + 1; last = line.words[at][1]; return last; }
    return (last += 5);
  }));
}
/** A text whose words rise into place as they are spoken. */
const Words: React.FC<{ text: string; at: number[]; color?: string; style?: React.CSSProperties }> = ({ text, at, color, style }) => {
  const f = useCurrentFrame();
  return (
    <span style={style}>
      {text.split(/\s+/).filter(Boolean).map((w, i) => {
        const t = ramp(f, at[i] - 4, at[i] + 20, glide);
        return <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: t, color, transform: `translateY(${(1 - t) * 0.32}em)`, filter: `blur(${(1 - t) * 8}px)` }}>{w}{' '}</span>;
      })}
    </span>
  );
};

// ---------- scenes come and go softly: a dissolve with a breath of scale and focus ----------
function useScene(i: number) {
  const f = useCurrentFrame();
  const { L, frames } = useFilm();
  const cut = L[i].cut, next = i + 1 < L.length ? L[i + 1].cut : frames + 999;
  const a = ramp(f, cut - 12, cut + 16, inOut), b = ramp(f, next - 14, next + 10, inOut);
  return {
    f, line: L[i], cut, next, out: b,
    style: { opacity: Math.min(a, 1 - b), transform: `scale(${1 + 0.018 * (1 - a) - 0.014 * b})`, filter: `blur(${(1 - a) * 8 + b * 6}px)` } as React.CSSProperties,
    push: (to = 1.04) => interpolate(f, [cut, next], [1, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin) }),
  };
}
const sp = (f: number, at: number, fps: number, cfg = SOFT) => spring({ frame: f - at, fps, config: cfg });

// ---------- the canvas ----------
const WASH: Record<string, [string, string, string]> = {
  neutral: ['#DCE6F5', '#EDE3F3', '#F5E9DC'], warm: ['#FBE3C8', '#DFF0E3', '#FDF0B8'], white: ['#EEF1F6', '#F4EFF6', '#F6F1EA'],
  brand: ['#FFD9C4', '#D7EEDF', '#E9E1FA'], gym: ['#FFD8C7', '#FFE9DE', '#F4E6FF'], dental: ['#F6E7C4', '#FBF2DC', '#E3EEF9'],
  stores: ['#F7D9C9', '#FDEBDD', '#E2F0E8'], realestate: ['#CFEDE2', '#E3F4EC', '#E6ECFA'],
};
const SCHEME = ['neutral', 'warm', 'white', 'brand', 'brand', 'gym', 'dental', 'stores', 'realestate', 'brand', 'brand', 'white'];
const Wash: React.FC<{ scheme: string; opacity: number }> = ({ scheme, opacity }) => {
  const f = useCurrentFrame();
  const [a, b, c] = WASH[scheme];
  const blob = (color: string, x: number, y: number, s: number, ph: number) => (
    <div style={{ position: 'absolute', left: x + Math.sin(f / 140 + ph) * 70, top: y + Math.cos(f / 170 + ph) * 46, width: s, height: s, borderRadius: '50%', background: color, filter: 'blur(120px)', opacity: 0.9 }} />
  );
  return <AbsoluteFill style={{ opacity }}>{blob(a, -200, -260, 1000, 0)}{blob(b, 1100, 380, 1050, 2)}{blob(c, 420, 640, 900, 4)}</AbsoluteFill>;
};

// ---------- the hardware ----------
const Mark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = INK, style }) => (
  <svg viewBox={MARK_VIEWBOX} style={{ height: size, width: 'auto', display: 'block', ...style }}><path d={MARK_PATH} fill={color} /></svg>
);
const MARK_MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${MARK_VIEWBOX}'><path d='${MARK_PATH}'/></svg>`)}")`;
const Laptop: React.FC<{ src: string; w: number }> = ({ src, w }) => {
  const h = w * 0.64, bez = w * 0.018;
  return (
    <div style={{ width: w, direction: 'ltr' }}>
      <div style={{ position: 'relative', width: w, height: h, borderRadius: `${w * 0.028}px ${w * 0.028}px ${w * 0.008}px ${w * 0.008}px`, background: '#0B0B0D', padding: bez, boxSizing: 'border-box',
        boxShadow: '0 0 0 1.5px #3A3B3F, 0 2px 0 1.5px #C9CBCF' }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', borderRadius: w * 0.006, display: 'block' }} />
        <span style={{ position: 'absolute', top: bez * 0.35, left: '50%', width: w * 0.006, height: w * 0.006, marginLeft: -w * 0.003, borderRadius: '50%', background: '#2A2B2F' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'linear-gradient(115deg, rgb(255 255 255 / .07) 0%, transparent 35%)' }} />
      </div>
      <div style={{ position: 'relative', width: w * 1.16, marginLeft: -w * 0.08, height: w * 0.022, borderRadius: `0 0 ${w * 0.02}px ${w * 0.02}px`,
        background: 'linear-gradient(180deg, #E8E9EB 0%, #C6C8CC 55%, #9FA2A7 100%)', boxShadow: '0 1px 0 #FFFFFF inset' }}>
        <span style={{ position: 'absolute', left: '50%', top: 0, width: w * 0.16, height: w * 0.008, marginLeft: -w * 0.08, borderRadius: `0 0 ${w * 0.01}px ${w * 0.01}px`, background: '#B4B6BA' }} />
      </div>
    </div>
  );
};
const Phone: React.FC<{ src: string; w: number }> = ({ src, w }) => (
  <div style={{ width: w, height: w * 2.164, borderRadius: w * 0.16, padding: w * 0.03, boxSizing: 'border-box',
    background: 'linear-gradient(145deg, #4A4B50, #1A1B1E 40%, #3A3B40)', boxShadow: '0 0 0 1px #8D9096 inset, 0 0 0 2px #2A2B2E' }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: w * 0.135, overflow: 'hidden', background: '#000' }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
      <span style={{ position: 'absolute', top: w * 0.035, left: '50%', width: w * 0.3, height: w * 0.085, marginLeft: -w * 0.15, borderRadius: w * 0.05, background: '#000' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgb(255 255 255 / .08), transparent 30%)' }} />
    </div>
  </div>
);
const lift = (k = 1) => `drop-shadow(0 ${30 * k}px ${50 * k}px rgb(20 24 40 / ${0.16 * k})) drop-shadow(0 ${8 * k}px ${14 * k}px rgb(20 24 40 / ${0.1 * k}))`;
/** Placed by its start edge (left in English, right in Arabic), so the whole film mirrors on its own. */
const At: React.FC<{ x: number; y: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x, y, style, children }) => (
  <div style={{ position: 'absolute', insetInlineStart: x, top: y, ...style }}>{children}</div>
);
const Floor: React.FC<{ x: number; y: number; w: number; o?: number }> = ({ x, y, w, o = 1 }) => (
  <At x={x - w / 2} y={y} style={{ width: w, height: w * 0.08, borderRadius: '50%', background: 'radial-gradient(closest-side, rgb(20 24 40 / .22), transparent)', filter: 'blur(14px)', opacity: o }} />
);
const Note: React.FC<{ color: string; title: string; sub: string; icon: string }> = ({ color, title, sub, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 22, paddingBlock: 22, paddingInlineStart: 22, paddingInlineEnd: 34, borderRadius: 28, background: 'rgb(255 255 255 / .94)',
    boxShadow: '0 30px 60px -20px rgb(20 24 40 / .28), 0 6px 16px -6px rgb(20 24 40 / .14), 0 0 0 1px rgb(20 24 40 / .05)', whiteSpace: 'nowrap' }}>
    <span style={{ display: 'grid', placeItems: 'center', width: 66, height: 66, borderRadius: 18, background: color, flex: 'none' }}>
      <svg viewBox="0 0 16 16" width="32" height="32" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
    </span>
    <span><div style={{ fontSize: 30, fontWeight: 600, color: INK }}>{title}</div><div style={{ marginTop: 2, fontSize: 24, color: GRAY }}>{sub}</div></span>
  </div>
);

// ---------- the film ----------
export const HemloFilm: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame();
  const sched = SCH[lang]!;
  const L = sched.lines, rtl = lang === 'ar';
  const value = { lang, L, c: COPY[lang] as Copy, rtl, dir: rtl ? -1 : 1, frames: sched.frames };
  // the washes cross-fade at each cut
  let idx = 0;
  L.forEach((l: Line, i: number) => { if (l.cut <= f) idx = i; });
  const cur = SCHEME[idx], prev = SCHEME[Math.max(0, idx - 1)], t = idx > 0 ? ramp(f, L[idx].cut - 6, L[idx].cut + 30, inOut) : 1;
  const show = (i: number) => f >= L[i].cut - 30 && f < (i + 1 < L.length ? L[i + 1].cut + 30 : Infinity);
  return (
    <Ctx.Provider value={value}>
      <AbsoluteFill dir={rtl ? 'rtl' : 'ltr'} lang={lang} style={{ background: CANVAS, fontFamily: FONT[lang], color: INK }}>
        <Audio src={staticFile(`ad2/audio/film-${lang}.wav`)} />
        {prev !== cur && <Wash scheme={prev} opacity={1 - t} />}
        <Wash scheme={cur} opacity={prev !== cur ? t : 1} />
        {show(0) && <Title />}
        {show(1) && <Mess />}
        {show(2) && <Better />}
        {show(3) && <Meet />}
        {show(4) && <OneSystem />}
        {[0, 1, 2, 3].map((k) => show(5 + k) && <Trade key={k} k={k} />)}
        {show(9) && <Arabic />}
        {show(10) && <Everything />}
        {f >= L[11].cut - 30 && <EndCard />}
      </AbsoluteFill>
    </Ctx.Provider>
  );
};

const headline = (lang: Lang, size: number): React.CSSProperties =>
  lang === 'ar' ? { fontSize: size * 0.92, fontWeight: 700, lineHeight: 1.32, letterSpacing: 0 } : { fontSize: size, fontWeight: 600, lineHeight: 1.06, letterSpacing: '-0.042em' };

// 0 · the title
const Title: React.FC = () => {
  const { c, lang } = useFilm();
  const s = useScene(0);
  const at = syncWords(s.line, c.title);
  return (
    <AbsoluteFill style={{ ...s.style, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ ...headline(lang, 104), transform: `scale(${s.push(1.05)})` }}>
        <div><Words text={c.title[0]} at={at[0]} color={GRAY} /></div>
        <div><Words text={c.title[1]} at={at[1]} /></div>
        <div><Words text={c.title[2]} at={at[2]} /></div>
      </div>
    </AbsoluteFill>
  );
};

// 1 · the mess: a notebook, a chat, sticky notes, each as it is named
const Mess: React.FC = () => {
  const { c, lang, dir } = useFilm();
  const { fps } = useVideoConfig();
  const s = useScene(1), f = s.f, m = c.mess;
  const at = syncWords(s.line, m.labels);
  const show = at.map((w) => w[0]);
  const sweep = ramp(f, s.next - 26, s.next + 6, inOut);       // swept together at "There's a better way"
  const piece = (k: number, x: number, rot: number, el: React.ReactNode) => {
    const p = sp(f, show[k] - 8, fps, SOFT);
    const drift = Math.sin((f + k * 40) / 60) * 5;
    return (
      <At x={x - 200} y={250} style={{ width: 400, opacity: Math.min(1, p * 1.4) * (1 - sweep),
        transform: `translate(${(960 - x) * sweep * dir}px, ${(1 - p) * 180 + drift}px) rotate(${rot * dir}deg) scale(${(0.92 + 0.08 * p) * (1 - 0.6 * sweep)})`, filter: `${lift(0.9)} blur(${sweep * 10}px)` }}>
        {el}
        <div style={{ marginTop: 34, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 34, fontWeight: 500, color: GRAY, transform: `rotate(${-rot * dir}deg)` }}><Words text={m.labels[k]} at={at[k]} /></div>
      </At>
    );
  };
  const reveal = (a: number, i: number, step: number) => ramp(f, a + 8 + i * step, a + 20 + i * step, glide);
  const italic = lang === 'en' ? 'italic' : 'normal';
  const notebook = (
    <div style={{ width: 400, height: 470, borderRadius: 14, background: '#FFFDF6', position: 'relative', overflow: 'hidden', backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 47px, #DCE6F2 47px 49px)', backgroundPositionY: 70 }}>
      <div style={{ position: 'absolute', insetInlineStart: 64, top: 0, bottom: 0, width: 2, background: '#F1B8B0' }} />
      <div style={{ position: 'absolute', insetInlineStart: 84, top: 26, fontSize: 32, fontWeight: 600, fontStyle: italic, color: '#2B3550' }}>{m.debts}</div>
      {m.ledger.map(([n, a, x], i) => (
        <div key={i} style={{ position: 'absolute', insetInlineStart: 84, insetInlineEnd: 26, top: 96 + i * 49, display: 'flex', justifyContent: 'space-between', fontSize: 25, fontStyle: italic,
          color: '#33405E', textDecoration: x ? 'line-through' : 'none', textDecorationColor: '#C0392B', opacity: reveal(show[0], i, 5) }}><span>{n}</span><span dir="ltr">{a}</span></div>
      ))}
    </div>
  );
  const chat = (
    <div style={{ width: 400, height: 470, borderRadius: 28, background: '#ECE8E1', overflow: 'hidden' }}>
      <div style={{ height: 76, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', fontSize: 26, fontWeight: 600 }}>
        <span style={{ width: 42, height: 42, borderRadius: '50%', background: '#D5DCE6' }} />{m.bookings}
      </div>
      {m.chat.map(([t, out], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', padding: '0 18px', marginTop: i ? 12 : 18, opacity: reveal(show[1], i, 7),
          transform: `translateY(${(1 - reveal(show[1], i, 7)) * 12}px)` }}>
          <span style={{ maxWidth: 290, padding: '12px 18px', borderRadius: 20, fontSize: 23, lineHeight: 1.35, background: out ? '#D9FDD3' : '#FFFFFF', color: '#1F2937' }}>{t}</span>
        </div>
      ))}
    </div>
  );
  const notes = (
    <div style={{ width: 400, height: 470, position: 'relative' }}>
      {m.notes.map((t, i) => (
        <div key={i} style={{ position: 'absolute', insetInlineStart: [0, 120, 30][i], top: [0, 150, 290][i], width: 270, height: 170, padding: 22, boxSizing: 'border-box',
          background: ['#FFE76A', '#FFD0E0', '#C9F2D6'][i], transform: `rotate(${[-4, 5, -2][i] * dir}deg)`, fontSize: 27, fontWeight: 500, fontStyle: italic, color: '#3A3320',
          boxShadow: '0 12px 24px -12px rgb(0 0 0 / .25)', opacity: reveal(show[2], i, 8) }}>{t}</div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={s.style}>
      <AbsoluteFill style={{ transform: `scale(${s.push(1.03)})` }}>
        {piece(0, 470, -6, notebook)}
        {piece(1, 960, 2, chat)}
        {piece(2, 1450, 5, notes)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 2 · there's a better way
const Better: React.FC = () => {
  const { c, lang } = useFilm();
  const s = useScene(2);
  const at = syncWords(s.line, [c.better]);
  return (
    <AbsoluteFill style={{ ...s.style, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...headline(lang, 96), transform: `scale(${s.push(1.04)})` }}><Words text={c.better} at={at[0]} /></div>
    </AbsoluteFill>
  );
};

// 3 · meet Hemlo: the mark lands on the drop; the name opens out beside it as it is said
const Meet: React.FC = () => {
  const { c, lang, rtl } = useFilm();
  const { fps } = useVideoConfig();
  const s = useScene(3), f = s.f, a = s.cut;
  const nameAt = syncWords(s.line, [c.name])[0][0];
  const mk = sp(f, a, fps, { damping: 22, stiffness: 120, mass: 1 });
  const name = sp(f, nameAt - 6, fps, SLOW);
  const glow = ramp(f, a, a + 24, glide) * (1 - 0.45 * ramp(f, a + 40, a + 150));
  const shine = interpolate(f, [a + 6, a + 60], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut });
  return (
    <AbsoluteFill style={{ ...s.style, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: 760, height: 760, borderRadius: '50%', opacity: 0.55 * glow, filter: 'blur(90px)', background: `conic-gradient(from ${f * 0.5}deg, #FF8A5B, #E2B85C, #4FC59B, #8FA8FF, #FF8A5B)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 46 * name, transform: `scale(${s.push(1.04)})` }}>
        <div style={{ position: 'relative', transform: `scale(${0.72 + 0.28 * mk})`, opacity: Math.min(1, mk * 1.5), filter: lift(0.6) }}>
          <Mark size={250} />
          <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: MARK_MASK, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', background: `linear-gradient(105deg, transparent ${shine - 14}%, rgb(255 255 255 / .55) ${shine}%, transparent ${shine + 14}%)` }} />
        </div>
        <div style={{ overflow: 'hidden', width: c.nameW * name, opacity: name }}>
          <div style={{ ...(lang === 'ar' ? { fontSize: 210, fontWeight: 700 } : { fontSize: 220, fontWeight: 600, letterSpacing: '-0.05em' }), lineHeight: 1.1, whiteSpace: 'nowrap', transform: `translateX(${(1 - name) * -100 * (rtl ? -1 : 1)}px)` }}>{c.name}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 4 · one system, for your whole business
const OneSystem: React.FC = () => {
  const { c, lang, dir } = useFilm();
  const { fps } = useVideoConfig();
  const s = useScene(4), f = s.f;
  const at = syncWords(s.line, c.one);
  const lap = sp(f, s.cut - 4, fps, SLOW);
  const ph = sp(f, at[1][0] - 10, fps, SLOW);
  return (
    <AbsoluteFill style={s.style}>
      <div style={{ position: 'absolute', top: 92, width: '100%', textAlign: 'center', ...headline(lang, 84) }}>
        <Words text={c.one[0]} at={at[0]} /> <Words text={c.one[1]} at={at[1]} color={GRAY} />
      </div>
      <AbsoluteFill style={{ transform: `scale(${s.push(1.05)})`, transformOrigin: '50% 70%' }}>
        <Floor x={960} y={1010} w={1300} o={lap} />
        <At x={440} y={330} style={{ transform: `perspective(2600px) translateY(${(1 - lap) * 420}px) rotateX(${(1 - lap) * 26}deg)`, transformOrigin: '50% 100%', filter: lift(1) }}>
          <Laptop src={`ad2/shots/hero-laptop-${lang}.webp`} w={1040} />
        </At>
        <At x={1360} y={470} style={{ transform: `translateX(${(1 - ph) * 420 * dir}px) rotate(${(1 - ph) * 6 * dir}deg)`, opacity: Math.min(1, ph * 1.6), filter: lift(1.1) }}>
          <Phone src={`ad2/shots/gym-phone2-${lang}.webp`} w={250} />
        </At>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 5–8 · the trades
const TRADE = [
  { id: 'gym', color: '#E4572E', icon: 'M3 8.5 6.2 11.5 13 4.5' },
  { id: 'dental', color: '#B38B3A', icon: 'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM8 5v3l2 1.5' },
  { id: 'stores', color: '#A8532E', icon: 'M4.5 12.5h7a3 3 0 0 0 .4-6 4 4 0 0 0-7.7-.9A3.5 3.5 0 0 0 4.5 12.5ZM6.5 9.5l1.2 1.2 2.3-2.4' },
  { id: 'realestate', color: '#1F6F5C', icon: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
];
const Trade: React.FC<{ k: number }> = ({ k }) => {
  const { c, lang, dir } = useFilm();
  const { fps } = useVideoConfig();
  const s = useScene(5 + k), f = s.f, t = TRADE[k], copy = c.trades[k];
  const at = syncWords(s.line, [copy.head[0], copy.head[1], copy.sub]);
  // the screens glide in from the far side and out to the near side, like a camera passing along a table
  const inn = sp(f, s.cut - 14, fps, SLOW);
  const pass = ramp(f, s.next - 18, s.next + 12, inOut);
  const dx = ((1 - inn) * 640 - pass * 520) * dir;
  const phone = sp(f, s.cut - 4, fps, SLOW);
  const note = sp(f, at[2][0] - 6, fps, SOFT);
  return (
    <AbsoluteFill style={s.style}>
      <At x={130} y={300} style={{ width: 780, transform: `translateX(${-pass * 50 * dir}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontSize: 34, fontWeight: 600, color: t.color, opacity: ramp(f, s.line.start - 8, s.line.start + 12, glide) }}>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: t.color }} />{copy.kicker}
        </div>
        <div style={{ marginTop: 22, ...headline(lang, k === 1 ? 72 : 96) }}>
          <div><Words text={copy.head[0]} at={at[0]} /></div>
          <div><Words text={copy.head[1]} at={at[1]} /></div>
        </div>
        <div style={{ marginTop: 26, fontSize: 40, fontWeight: 500, color: GRAY, letterSpacing: lang === 'ar' ? 0 : '-0.02em' }}><Words text={copy.sub} at={at[2]} /></div>
      </At>
      <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${s.push(1.04)})`, transformOrigin: lang === 'ar' ? '25% 60%' : '75% 60%' }}>
        <Floor x={1440} y={930} w={980} />
        <At x={1000} y={300} style={{ filter: lift(1) }}><Laptop src={`ad2/shots/${t.id}-laptop-${lang}.webp`} w={880} /></At>
        <At x={900} y={420} style={{ transform: `translateY(${(1 - phone) * 200}px)`, opacity: Math.min(1, phone * 1.5), filter: lift(1.15) }}><Phone src={`ad2/shots/${t.id}-phone-${lang}.webp`} w={230} /></At>
        {f >= at[2][0] - 12 && (
          <At x={1020} y={830} style={{ opacity: Math.min(1, note * 1.4), transform: `translateY(${(1 - note) * 40}px) scale(${0.94 + 0.06 * note})`, transformOrigin: lang === 'ar' ? 'right center' : 'left center' }}>
            <Note color={t.color} title={copy.note[0]} sub={copy.note[1]} icon={t.icon} />
          </At>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 9 · in Arabic, in dinars, right on your phone
const Arabic: React.FC = () => {
  const { c, lang, dir } = useFilm();
  const { fps } = useVideoConfig();
  const s = useScene(9), f = s.f;
  const at = syncWords(s.line, c.arabic);
  const ph = sp(f, s.cut - 8, fps, SLOW);
  const turn = interpolate(f, [s.cut, s.next], [-8, 6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin) }) * dir;
  return (
    <AbsoluteFill style={s.style}>
      <At x={150} y={lang === 'ar' ? 300 : 330} style={{ ...headline(lang, 104) }}>
        {c.arabic.map((t, k) => {
          // each line lights up as it is said, and steps back when the next one comes
          const lit = ramp(f, at[k][0] - 6, at[k][0] + 10, glide), dim = k + 1 < at.length ? ramp(f, at[k + 1][0] - 6, at[k + 1][0] + 12, glide) : 0;
          return <div key={t} style={{ color: shade(lit * (1 - dim)) }}><Words text={t} at={at[k]} /></div>;
        })}
      </At>
      <Floor x={1430} y={1000} w={520} o={ph} />
      <At x={1240} y={120} style={{ transform: `perspective(2000px) translateY(${(1 - ph) * 420}px) rotateY(${turn}deg)`, filter: lift(1.1) }}>
        <Phone src={`ad2/shots/arabic-phone-${lang}.webp`} w={380} />
      </At>
    </AbsoluteFill>
  );
};
/** From the faint grey of a line already said, to ink. */
const shade = (t: number) => {
  const a = [0xc7, 0xc7, 0xcc], b = [0x1d, 0x1d, 0x1f];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(' ')})`;
};

// 10 · everything, in one place: four phones around the mark
const Everything: React.FC = () => {
  const { c, lang, dir } = useFilm();
  const { fps } = useVideoConfig();
  const s = useScene(10), f = s.f;
  const at = syncWords(s.line, c.everything);
  const phones = ['gym-phone2', 'dental-phone2', 'stores-phone', 'realestate-phone2'];
  return (
    <AbsoluteFill style={s.style}>
      <div style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center', ...headline(lang, 84) }}>
        <Words text={c.everything[0]} at={at[0]} /> <Words text={c.everything[1]} at={at[1]} color={GRAY} />
      </div>
      <AbsoluteFill style={{ transform: `scale(${s.push(1.05)})`, transformOrigin: '50% 60%' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 230, display: 'flex', justifyContent: 'center', opacity: 0.07 * ramp(f, s.cut, s.cut + 40, glide) }}><Mark size={820} /></div>
        <Floor x={960} y={1000} w={1200} />
        {phones.map((src, k) => {
          const p = sp(f, s.cut - 6 + k * 5, fps, SLOW);
          const slot = (k - 1.5) * dir;
          return (
            <div key={src} style={{ position: 'absolute', left: 960 - 125, top: 300, zIndex: k === 1 || k === 2 ? 2 : 1, filter: lift(1), opacity: Math.min(1, p * 1.6),
              transform: `translate(${slot * 270 * p}px, ${Math.abs(slot) * 40 * p + (1 - p) * 420}px) rotate(${slot * 7 * p}deg)` }}>
              <Phone src={`ad2/shots/${src}-${lang}.webp`} w={250} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 11 · the end card
const EndCard: React.FC = () => {
  const { c, lang, L } = useFilm();
  const { fps } = useVideoConfig();
  const f = useCurrentFrame(), line = L[11], a = line.cut;
  const at = syncWords(line, [c.cta]);
  const urlWord = line.words.find(([w]) => /hemlo|هيملو/i.test(w));
  const urlAt = urlWord ? urlWord[1] : a + 120;
  const o = ramp(f, a - 14, a + 16, inOut);
  const m = sp(f, a, fps, SOFT);
  const u = ramp(f, urlAt - 8, urlAt + 18, glide);
  const shine = interpolate(f, [urlAt + 10, urlAt + 70], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o, background: CANVAS }}>
      <Wash scheme="white" opacity={1} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: `translateY(-110px) scale(${0.9 + 0.1 * m})`, opacity: m }}>
        <Mark size={150} />
        <span style={lang === 'ar' ? { fontSize: 140, fontWeight: 700, lineHeight: 1.1 } : { fontSize: 150, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1 }}>{c.name}</span>
      </div>
      <div style={{ position: 'absolute', top: 600, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 58, fontWeight: lang === 'ar' ? 700 : 500, letterSpacing: lang === 'ar' ? 0 : '-0.025em' }}><Words text={c.cta} at={at[0]} /></div>
        <div style={{ marginTop: 40, display: 'inline-block', position: 'relative', overflow: 'hidden', padding: '20px 48px', borderRadius: 999, background: INK, color: '#FFFFFF', fontSize: 46, fontWeight: 500,
          fontFamily: FONT.en, direction: 'ltr', opacity: u, transform: `translateY(${(1 - u) * 18}px)` }}>
          hemlohq.com
          <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${shine - 15}%, rgb(255 255 255 / .3) ${shine}%, transparent ${shine + 15}%)` }} />
        </div>
        <div style={{ marginTop: 36, fontSize: 30, color: GRAY, opacity: ramp(f, line.end - 20, line.end + 20, glide) }}>{c.trades4}</div>
      </div>
    </AbsoluteFill>
  );
};
