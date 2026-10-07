// The film: a title, then one continuous take of the real demo shop (the website button, today's numbers, a sale by
// scanning, payment, the debt book, closing the drawer, the phone), then the call to action. ~62 s, cut to the music.
import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, BAR, ease, outExpo } from './theme';
import { COPY, type Lang } from './copy';
import { camAt, center, cursorAt, fit, ramp, union, window01, type Cam, type Pt, type Rect } from './anim';
import { Background, BrowserWindow, Caption, CHROME, Cursor, Highlight, Mark, Monitor, Phone, Ripple, ScanLine, ScreenStack, Spinner } from './parts';
import rectsAr from '../public/shots/ar/rects.json';
import rectsEn from '../public/shots/en/rects.json';

export const DURATION = 3720;
const BS = 0.82, CX = 960, CY = 532; // the window's base scale, and where the camera's focus lands on screen

// ---- the beats (frames at 60 fps; a bar is 144) ----
const T = {
  winIn: 250, clickWeb: 570, opening: 582, today: 5 * BAR, week: 7 * BAR, sell: 8 * BAR,
  taps: [8.5 * BAR, 9 * BAR, 9.5 * BAR], monitorIn: 10.5 * BAR, monitorOut: 1716,
  clickPay: 1746, pay0: 1752, type1: 1798, pay1: 1818, clickConfirm: 1866, done: 13 * BAR,
  debt: 14 * BAR, home: 16 * BAR, clickDrawer: 2352, drawer0: 2358, type2: 2398, drawer1: 2432, diff: 17 * BAR,
  phones: 18 * BAR, end: 20 * BAR - 14,
};

export const DemoShop: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const R = ((lang === 'ar' ? rectsAr : rectsEn) as any).rects as Record<string, Record<string, any>>;
  const copy = COPY[lang], cap = copy.captions, rtl = lang === 'ar', side = rtl ? -1 : 1;
  const r = (shot: string, key: string, i?: number): Rect => (i == null ? R[shot][key] : R[shot][key][i]);

  // ---- camera ----
  const cam: Cam[] = [
    { f: T.winIn, x: 720, y: 450, z: 1 }, { f: 410, x: 720, y: 450, z: 1.03 },
    { ...fit(520, r('web', 'demo'), 280, 1.5), y: r('web', 'demo').y - 150 }, { ...fit(574, r('web', 'demo'), 280, 1.5), y: r('web', 'demo').y - 150, z: 1.56 },
    { f: 650, x: 720, y: 450, z: 1 }, { f: 770, x: 720, y: 450, z: 1.03 },
    fit(870, union(...R.today.kpis), 50, 1.4), { ...fit(995, union(...R.today.kpis), 50, 1.4), z: 1.44 },
    fit(1075, R['today-week'].chart, 70, 1.45), { ...fit(1150, R['today-week'].chart, 70, 1.45), z: 1.49 },
    fit(1200, union(...R['sell-0'].codes, r('sell-0', 'cart')), 50, 1.35), fit(1380, union(...R['sell-0'].codes, r('sell-0', 'cart')), 50, 1.36),
    fit(1450, r('sell-3', 'cart'), 60, 1.55), fit(1500, r('sell-3', 'cart'), 60, 1.57),
    { f: 1570, x: 720 + 440 * side, y: 450, z: 0.86 }, { f: 1700, x: 720 + 440 * side, y: 450, z: 0.88 },
    fit(1742, r('sell-3', 'cart'), 60, 1.3), fit(1800, r('pay-0', 'sheet'), 40, 1.35), fit(1860, r('pay-0', 'sheet'), 40, 1.37),
    fit(1930, r('done', 'sheet'), 50, 1.35), fit(2005, r('done', 'sheet'), 50, 1.38),
    { f: 2040, x: 720, y: 450, z: 1 }, fit(2130, union(...R.customers.rows.slice(0, 4)), 90, 1.35), { ...fit(2295, union(...R.customers.rows.slice(0, 4)), 90, 1.35), z: 1.4 },
    { f: 2330, x: 720, y: 450, z: 1 }, { f: 2352, x: 720, y: 450, z: 1.01 },
    fit(2405, r('drawer-0', 'sheet'), 20, 1.2), fit(2475, union(r('drawer-1', 'diff'), r('drawer-0', 'input')), 90, 1.55), { ...fit(2575, union(r('drawer-1', 'diff'), r('drawer-0', 'input')), 90, 1.55), z: 1.6 },
    { f: 2640, x: 720, y: 450, z: 1 },
  ];
  const c = camAt(f, cam), S = BS * c.z;

  // ---- cursor ----
  const dm = center(r('web', 'demo')), codes = R['sell-0'].codes.map(center), cart = center(r('sell-3', 'cart'));
  const payBtn = center(r('sell-3', 'pay')), input = center(r('pay-1', 'input')), confirm = center(r('pay-1', 'payBtn'));
  const drawerBtn = center(r('home-after', 'button')), counted = center(r('drawer-0', 'input'));
  const pts: Pt[] = [
    { f: 330, x: 720, y: 880 }, { f: 505, x: dm.x + 6, y: dm.y + 4 }, { f: 570, x: dm.x + 6, y: dm.y + 4 }, { f: 660, x: dm.x + 40, y: dm.y + 160 },
    { f: 1160, x: 720, y: 780 }, { f: 1214, ...codes[0] }, { f: 1224, ...codes[0] }, { f: 1286, ...codes[1] }, { f: 1296, ...codes[1] },
    { f: 1358, ...codes[2] }, { f: 1368, ...codes[2] }, { f: 1450, x: cart.x, y: cart.y + 40 },
    { f: 1700, x: payBtn.x - 60 * side, y: payBtn.y - 120 }, { f: 1738, ...payBtn }, { f: 1746, ...payBtn }, { f: 1792, ...input },
    { f: 1850, ...confirm }, { f: 1866, ...confirm }, { f: 1930, x: confirm.x + 40, y: confirm.y + 80 },
    { f: 2305, x: 720, y: 520 }, { f: 2344, ...drawerBtn }, { f: 2352, ...drawerBtn }, { f: 2394, ...counted }, { f: 2470, x: counted.x + 50, y: counted.y + 60 },
  ];
  const cur = cursorAt(f, pts);
  const curOn = Math.max(window01(f, 330, 650, 16, 20), window01(f, 1162, 1498, 14, 20), window01(f, 1700, 1928, 14, 20), window01(f, 2308, 2492, 14, 20));
  const clicks = [T.clickWeb, ...T.taps, T.clickPay, T.clickConfirm, T.clickDrawer];
  const press = Math.max(0, ...clicks.map((k) => 1 - Math.abs(f - k) / 6));

  // ---- the window's own moves: rise in, step aside for the phones, fall away at the end ----
  const rise = spring({ frame: f - T.winIn, fps, config: { damping: 22, stiffness: 70, mass: 1.1 } });
  const toPhones = ramp(f, T.phones, T.phones + 60, ease), exit = ramp(f, T.end, T.end + 34, ease);
  const gs = (1 - 0.3 * toPhones) * (1 - 0.06 * exit), gx = -345 * side * toPhones, gy = (1 - rise) * 760;
  const winOpacity = Math.min(1, rise * 2) * (1 - exit);

  const url = f < T.opening ? `hemlohq.com${rtl ? '' : '/en'}/systems` : 'system.hemlohq.com';
  const screen: [number, string, number?][] = [
    [0, 'web'], [T.opening, 'opening', 12], [T.today, 'today', 10], [T.week, 'today-week', 10], [T.sell, 'sell-0', 10],
    [T.taps[0] + 4, 'sell-1', 8], [T.taps[1] + 4, 'sell-2', 8], [T.taps[2] + 4, 'sell-3', 8],
    [T.pay0, 'pay-0', 12], [T.pay1, 'pay-1', 10], [T.done, 'done', 10], [T.debt, 'customers', 10],
    [T.home, 'home-after', 10], [T.drawer0, 'drawer-0', 10], [T.drawer1, 'drawer-1', 8], [T.phones, 'today-week', 12],
  ];

  return (
    <AbsoluteFill style={{ fontFamily: rtl ? FONT.ar : FONT.en }}>
      <Background />
      <Intro lang={lang} />

      {/* the app, in one continuous take */}
      {f >= T.winIn - 2 && f < T.end + 40 && (
        <AbsoluteFill style={{ transform: `translate(${gx}px, ${gy}px) scale(${gs})`, transformOrigin: '960px 540px', opacity: winOpacity, filter: exit ? `blur(${exit * 12}px)` : undefined }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${CX - c.x * S}px, ${CY - (c.y + CHROME) * S}px) scale(${S})` }}>
            <BrowserWindow url={url}>
              <ScreenStack lang={lang} cues={screen} />
              {f >= T.opening && f < T.today + 16 && <Spinner r={r('opening', 'spinner')} />}
              {/* rings on what matters */}
              <Highlight r={R.today.kpis[0]} from={790} to={852} />
              <Highlight r={R.today.kpis[1]} from={852} to={914} />
              <Highlight r={R.today.kpis[3]} from={914} to={992} />
              <Highlight r={R['today-week'].chart} from={1062} to={1146} radius={10} />
              {T.taps.map((t, i) => <ScanLine key={i} r={R['sell-0'].codes[i]} at={t} />)}
              {T.taps.map((t, i) => <Highlight key={i} r={R[`sell-${i + 1}`].lines[i]} from={t + 8} to={t + 64} radius={6} />)}
              <Highlight r={r('sell-3', 'total')} from={1452} to={1510} radius={10} />
              <Highlight r={r('pay-1', 'change')} from={1832} to={1868} />
              <Highlight r={r('done', 'total')} from={1892} to={2006} />
              <Highlight r={R.customers.rows[0]} from={2140} to={2206} radius={14} />
              <Highlight r={R.customers.rows[1]} from={2206} to={2290} radius={14} />
              <Highlight r={r('drawer-1', 'diff')} from={T.diff} to={2580} />
              {/* the pointer, kept the same size on screen whatever the zoom */}
              <Ripple x={cur.x} y={cur.y} t={Math.max(...clicks.map((k) => (f >= k && f < k + 26 ? (f - k) / 26 : -1)))} scale={1 / c.z} />
              {curOn > 0 && <Cursor x={cur.x} y={cur.y} opacity={curOn} press={press} scale={1 / c.z} />}
            </BrowserWindow>
          </div>
        </AbsoluteFill>
      )}

      {/* the customer's screen slides onto the counter */}
      {f >= T.monitorIn - 2 && f < T.monitorOut + 30 && (() => {
        const sIn = spring({ frame: f - T.monitorIn, fps, config: { damping: 20, stiffness: 80 } }), sOut = ramp(f, T.monitorOut - 6, T.monitorOut + 26, ease);
        const x = rtl ? 70 : 1920 - 648 - 70, off = ((1 - sIn) + sOut) * 860 * side;
        return <div style={{ position: 'absolute', left: x + off, top: 230 }}><Monitor lang={lang} cues={[[0, 'display']]} width={620} /></div>;
      })()}

      {/* on a phone */}
      {f >= T.phones && f < T.end + 40 && [['phone-today', 0, -4, 1190, 150], ['phone-sell', 22, 4, 1490, 205]].map(([shot, delay, rot, x, y]) => {
        const s = spring({ frame: f - T.phones - 12 - (delay as number), fps, config: { damping: 18, stiffness: 70 } });
        const w = 300, outer = w * 1.08;
        const left = rtl ? 1920 - (x as number) - outer : (x as number);
        return <div key={shot as string} style={{ position: 'absolute', left, top: (y as number) + (1 - s) * 900 - exit * 40, transform: `rotate(${(rot as number) * side * s}deg) scale(${1 - 0.06 * exit})`, opacity: (1 - exit) * Math.min(1, s * 2), filter: exit ? `blur(${exit * 12}px)` : undefined }}>
          <Phone lang={lang} shot={shot as string} width={w} />
        </div>;
      })}

      <Caption lang={lang} from={340} to={566} label={cap.web[0]} text={cap.web[1]} />
      <Caption lang={lang} from={600} to={716} label={cap.opening[0]} text={cap.opening[1]} />
      <Caption lang={lang} from={776} to={996} label={cap.today[0]} text={cap.today[1]} />
      <Caption lang={lang} from={1024} to={1146} label={cap.week[0]} text={cap.week[1]} />
      <Caption lang={lang} from={1172} to={1500} label={cap.sell[0]} text={cap.sell[1]} />
      <Caption lang={lang} from={1532} to={1712} label={cap.display[0]} text={cap.display[1]} />
      <Caption lang={lang} from={1772} to={2006} label={cap.pay[0]} text={cap.pay[1]} />
      <Caption lang={lang} from={2044} to={2296} label={cap.debt[0]} text={cap.debt[1]} />
      <Caption lang={lang} from={2330} to={2580} label={cap.drawer[0]} text={cap.drawer[1]} />
      <Caption lang={lang} from={2630} to={T.end + 4} label={cap.phone[0]} text={cap.phone[1]} align="start" />

      <End lang={lang} />

      {/* sound */}
      <Audio src={staticFile('audio/music.wav')} volume={(fr) => 0.9 * (1 - ramp(fr, DURATION - 50, DURATION))} />
      {sfx('whoosh', T.winIn - 4, 0.45)}{sfx('whoosh', T.phones - 6, 0.35)}{sfx('whoosh', T.end - 6, 0.45)}
      {clicks.filter((k) => !T.taps.includes(k)).map((k) => sfx('click', k - 1, 0.8, `c${k}`))}
      {T.taps.map((k) => sfx('beep', k, 0.5, `b${k}`))}
      {[...Array(6)].map((_, i) => sfx('key', T.type1 + i * 5, 0.7, `k1${i}`))}
      {[...Array(6)].map((_, i) => sfx('key', T.type2 + i * 5, 0.7, `k2${i}`))}
      {sfx('ding', T.done, 0.55)}
      {sfx('pop', T.monitorIn + 4, 0.35)}{sfx('pop', T.phones + 14, 0.3)}{sfx('pop', T.phones + 36, 0.3, 'p2')}{sfx('pop', T.diff, 0.3, 'pd')}
      {sfx('pop', 2900 + 70, 0.35, 'pu')}
    </AbsoluteFill>
  );
};

const sfx = (name: string, at: number, volume: number, key?: string) => (
  <Sequence key={key ?? `${name}${at}`} from={Math.round(at)} durationInFrames={120} layout="none"><Audio src={staticFile(`audio/${name}.wav`)} volume={volume} /></Sequence>
);

// ---------------- title and call to action ----------------
const Words: React.FC<{ text: string; start: number; step?: number; style: React.CSSProperties; rtl: boolean }> = ({ text, start, step = 5, style, rtl }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 0.26em', ...style }}>
      {text.split(' ').map((w, i) => {
        const s = spring({ frame: f - start - i * step, fps, config: { damping: 18, stiffness: 90 } });
        return <span key={i} style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 36}px)`, opacity: Math.min(1, s * 1.5), filter: `blur(${(1 - Math.min(1, s)) * 8}px)` }}>{w}</span>;
      })}
    </div>
  );
};

const Intro: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  if (f > 320) return null;
  const rtl = lang === 'ar', copy = COPY[lang];
  const m = spring({ frame: f - 8, fps, config: { damping: 14, stiffness: 80 } });
  const out = ramp(f, 236, 300, ease);
  const font = rtl ? FONT.ar : FONT.en;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translateY(${-out * 120}px) scale(${1 - out * 0.04})`, opacity: 1 - out, filter: `blur(${out * 10}px)` }}>
      <div style={{ transform: `scale(${0.6 + 0.4 * m}) rotate(${(1 - m) * -8}deg)`, opacity: Math.min(1, m * 1.4), marginBottom: 40, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -70, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,83,46,0.22), rgba(168,83,46,0) 65%)', opacity: m }} />
        <Mark size={124} />
      </div>
      <div dir={rtl ? 'rtl' : 'ltr'} style={{ fontFamily: font, fontSize: 28, fontWeight: 500, color: C.accent, letterSpacing: rtl ? 0 : 0.3, opacity: ramp(f, 34, 56), transform: `translateY(${(1 - ramp(f, 34, 70, outExpo)) * 16}px)`, marginBottom: 26 }}>{copy.eyebrow}</div>
      <Words rtl={rtl} text={copy.title[0]} start={52} style={{ fontFamily: font, fontSize: rtl ? 118 : 116, fontWeight: rtl ? 700 : 600, color: C.fg, letterSpacing: rtl ? 0 : '-0.04em', lineHeight: 1.12 }} />
      <Words rtl={rtl} text={copy.title[1]} start={84} style={{ fontFamily: font, fontSize: rtl ? 118 : 116, fontWeight: rtl ? 700 : 600, color: C.accent, letterSpacing: rtl ? 0 : '-0.04em', lineHeight: 1.12 }} />
    </AbsoluteFill>
  );
};

const End: React.FC<{ lang: Lang }> = ({ lang }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const at = 2890;
  if (f < at) return null;
  const rtl = lang === 'ar', e = COPY[lang].end, font = rtl ? FONT.ar : FONT.en;
  const m = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 80 } });
  const pill = spring({ frame: f - at - 70, fps, config: { damping: 16, stiffness: 110 } });
  const pulse = f >= 22 * BAR ? 1 + 0.035 * Math.sin(Math.min(1, (f - 22 * BAR) / 30) * Math.PI) : 1; // on the final chord
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${0.7 + 0.3 * m})`, opacity: Math.min(1, m * 1.4), marginBottom: 44, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -60, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,83,46,0.2), rgba(168,83,46,0) 65%)' }} />
        <Mark size={100} />
      </div>
      <Words rtl={rtl} text={e.title} start={at + 22} style={{ fontFamily: font, fontSize: rtl ? 104 : 104, fontWeight: rtl ? 700 : 600, color: C.fg, letterSpacing: rtl ? 0 : '-0.04em', lineHeight: 1.15 }} />
      <div style={{ marginTop: 48, transform: `translateY(${(1 - pill) * 30}px) scale(${(0.9 + 0.1 * pill) * pulse})`, opacity: Math.min(1, pill * 1.5) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '22px 40px', borderRadius: 999, background: C.accent, color: '#fff', fontFamily: FONT.en, fontSize: 40, fontWeight: 500, direction: 'ltr', flexDirection: rtl ? 'row-reverse' : 'row',
          boxShadow: '0 30px 60px -18px rgba(168,83,46,0.55)' }}>
          {e.url}
          <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: rtl ? 'scaleX(-1)' : undefined }}><path d="M5 12h13M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
      <div dir={rtl ? 'rtl' : 'ltr'} style={{ marginTop: 34, fontFamily: font, fontSize: 36, fontWeight: 400, color: C.fg2, opacity: ramp(f, at + 110, at + 140), transform: `translateY(${(1 - ramp(f, at + 110, at + 150, outExpo)) * 14}px)` }}>{e.sub}</div>
      <Img src={staticFile(`brand/hemlo-systems${rtl ? '-ar' : ''}.svg`)} style={{ position: 'absolute', bottom: 70, height: 50, opacity: ramp(f, at + 150, at + 190) * 0.9 }} />
    </AbsoluteFill>
  );
};
