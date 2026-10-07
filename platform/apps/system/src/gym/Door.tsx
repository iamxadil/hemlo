// The door screen (#/door?k=…): a TV or a tablet at the entrance. It opens with a display-only link (no one is signed in
// on it). Each time the desk checks someone in, it greets them full screen ("Welcome, Ali H." · 12 days left), or asks
// them to see the desk. Between greetings: how many are training now, the hours (ladies' time), today's classes and
// their places. If the owner allows it, members scan their own card here (the camera, or a USB scanner).
// Live: the gym's hub (a Durable Object) tells the screen the moment someone comes in; otherwise it checks every 12 s.
import { useEffect, useRef, useState } from 'react';
import { API, api } from '../lib/api';
import { readLang, rtl, type Lang } from '../lib/i18n';
import { HMark } from '../dental/ui';
import { Icon } from '../components/ui';
import { GSTRINGS } from './i18n';
import { CameraScan, canScan, beep } from './ui';
import { fmt } from './data';
import './door.css';

type Event = { id: string; at: string; result: 'ok' | 'override' | 'denied'; reason: string | null; name: string; gender: string | null; membership: string | null; state: string | null; daysLeft: number | null; visitsLeft: number | null };
type Screen = { gym: { name: string; logoUrl: string | null; selfCheckin: boolean }; inNow: number; hours: { from: string; to: string; who: string }[];
  classes: { id: string; name: string; startsAt: string; minutes: number; capacity: number | null; gender: string; color: string | null; coach: string | null; booked: number }[]; recent: Event[]; today: string; at: string };

const LANGS: Lang[] = ['ar', 'en', 'ckb'];
const params = () => new URLSearchParams(location.hash.split('?')[1] ?? '');
const pref = { get: (k: string, d: boolean) => { try { const v = localStorage.getItem(`hemlo.door.${k}`); return v == null ? d : v === '1'; } catch { return d; } }, set: (k: string, v: boolean) => { try { localStorage.setItem(`hemlo.door.${k}`, v ? '1' : '0'); } catch {} } };
const isCode = (s: string) => /^(HEMLO-GYM:)?[2-9A-HJ-NP-Z]{10}$/i.test(s.trim());

export function Door() {
  const [lang] = useState<Lang>(() => {
    const q = params().get('l') as Lang | null, l = q && LANGS.includes(q) ? q : readLang();
    document.documentElement.lang = l; document.documentElement.dir = rtl(l) ? 'rtl' : 'ltr';
    return l;
  });
  const t = GSTRINGS[lang].door, g = GSTRINGS[lang];
  const [key, setKey] = useState<string | null>(() => params().get('k'));
  const [data, setData] = useState<Screen | null>(null);
  const [state, setState] = useState<'ok' | 'offline' | 'reset' | 'nolink'>('ok');
  const [now, setNow] = useState(() => new Date());
  const [shows, setShows] = useState<Event[]>([]);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(() => pref.get('sound', true));
  const [camera, setCamera] = useState(() => pref.get('camera', false));
  const [motto, setMotto] = useState(0);
  const [ui, setUi] = useState(true);
  const seen = useRef<Set<string> | null>(null);
  const scanIn = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState('');

  // opened from the gym's app (signed in, no key yet): fetch the door link and switch to it
  useEffect(() => {
    if (key) return;
    api<{ key: string }>('/v1/gym/door-link')
      .then((x) => { history.replaceState(null, '', `#/door?k=${encodeURIComponent(x.key)}&l=${lang}`); setKey(x.key); })
      .catch(() => setState('nolink'));
  }, [key, lang]);

  // the screen's data: fetched when the hub says something changed, and on a timer as a safety net
  useEffect(() => {
    if (!key) return;
    let stop = false, timer = 0, fails = 0, live = false, inflight = false, again = false, ws: WebSocket | null = null, wsTimer = 0, retry = 0, beat = 0;
    // the next check: never pushed later by a dropped line (a reconnect loop must not starve the fallback)
    let dueAt = 0;
    const next = (after = false) => { if (stop) return; const ms = live ? 60_000 : Math.min(60_000, 12_000 * (1 + fails)); if (!after && timer && dueAt <= Date.now() + ms) return; clearTimeout(timer); dueAt = Date.now() + ms; timer = window.setTimeout(() => { timer = 0; load(); }, ms); };
    async function load() {
      if (inflight) { again = true; return; }
      inflight = true;
      try {
        const r = await fetch(`${API}/v1/gym/door?k=${encodeURIComponent(key!)}`, { credentials: 'omit', cache: 'no-store' });
        if (r.status === 404) { if (!stop) { setState('reset'); stop = true; ws?.close(); } return; }
        if (!r.ok) throw new Error(String(r.status));
        const x = (await r.json()) as Screen;
        if (stop) return;
        fails = 0;
        // someone who just came in (not seen on this screen yet, and recent): greet them
        if (seen.current) {
          const fresh = x.recent.filter((e) => !seen.current!.has(e.id) && Date.now() - +new Date(e.at) < 90_000).reverse();
          if (fresh.length) setShows((s) => [...s, ...fresh.filter((f) => !s.some((y) => y.id === f.id))]);
        }
        seen.current = new Set(x.recent.map((e) => e.id));
        setData(x); setState('ok');
      } catch { fails++; if (!stop) setState('offline'); }
      finally { inflight = false; if (again && !stop) { again = false; load(); } else next(true); }
    }
    const connect = () => {
      if (stop || !('WebSocket' in window)) return;
      ws = new WebSocket(`${API.replace(/^http/, 'ws')}/v1/gym/door/live?k=${encodeURIComponent(key!)}`);
      ws.onopen = () => { live = true; retry = 0; load(); clearInterval(beat); beat = window.setInterval(() => { try { ws?.send('ping'); } catch {} }, 25_000); };
      ws.onmessage = (e) => { if (e.data === 'changed') load(); };
      ws.onclose = () => { live = false; clearInterval(beat); next(); if (!stop) wsTimer = window.setTimeout(connect, Math.min(30_000, 1500 * 2 ** retry++)); };
    };
    const wake = () => { if (document.hidden || stop) return; load(); if (!live && ws?.readyState !== WebSocket.CONNECTING) { clearTimeout(wsTimer); connect(); } };
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
    load(); connect();
    return () => { stop = true; clearTimeout(timer); clearTimeout(wsTimer); clearInterval(beat); ws?.close(); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
  }, [key]);

  useEffect(() => { const a = setInterval(() => setNow(new Date()), 10_000), b = setInterval(() => setMotto((n) => n + 1), 12_000); return () => { clearInterval(a); clearInterval(b); }; }, []);

  // a greeting: a sound (if on), 5 s on screen
  const show = shows[0];
  useEffect(() => {
    if (!show) return;
    if (sound && started) beep(show.result === 'denied' ? 'bad' : 'ok');
    const x = setTimeout(() => setShows((s) => s.slice(1)), show.result === 'denied' ? 6000 : 4500);
    return () => clearTimeout(x);
  }, [show?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the screen awake once started
  useEffect(() => {
    if (!started || !('wakeLock' in navigator)) return;
    let lock: any = null;
    const take = () => { if (!document.hidden) (navigator as any).wakeLock.request('screen').then((l: any) => { lock = l; }).catch(() => {}); };
    take(); document.addEventListener('visibilitychange', take);
    return () => { document.removeEventListener('visibilitychange', take); lock?.release?.().catch(() => {}); };
  }, [started]);
  useEffect(() => {
    let x = window.setTimeout(() => setUi(false), 4000);
    const on = () => { setUi(true); clearTimeout(x); x = window.setTimeout(() => setUi(false), 3000); };
    window.addEventListener('pointermove', on);
    return () => { window.removeEventListener('pointermove', on); clearTimeout(x); };
  }, []);
  // a USB scanner types the card's code and Enter: keep a hidden field focused while self check-in is on
  const self = !!data?.gym.selfCheckin;
  useEffect(() => { if (!self || !started) return; const f = () => scanIn.current?.focus(); f(); const x = setInterval(f, 3000); return () => clearInterval(x); }, [self, started]);

  const selfCheckin = async (code: string) => {
    if (!key || !isCode(code)) return;
    try {
      const r = await fetch(`${API}/v1/gym/door/checkin?k=${encodeURIComponent(key)}`, { method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
      const j = await r.json();
      if (!r.ok) { setShows((s) => [...s, { id: `x${Date.now()}`, at: new Date().toISOString(), result: 'denied', reason: j.error === 'CARD_UNKNOWN' ? 'card' : 'error', name: '', gender: null, membership: null, state: null, daysLeft: null, visitsLeft: null }]); return; }
      if (j.id) seen.current?.add(j.id); // the live line will report it too: greet once
      const ev: Event = { id: j.id ?? `s${Date.now()}`, at: new Date().toISOString(), result: j.result === 'again' ? 'ok' : j.result, reason: j.reason, name: j.name, gender: null, membership: j.membership?.name ?? null,
        state: j.membership?.state ?? null, daysLeft: j.membership?.daysLeft ?? null, visitsLeft: j.membership?.visitsLeft ?? null };
      setShows((s) => [...s, ev]);
    } catch { /* offline: the desk can check them in */ }
  };

  const start = async () => {
    try { beep('ok'); } catch {}
    try { await document.documentElement.requestFullscreen?.(); } catch {}
    setStarted(true);
  };
  const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Baghdad' }).format(now);
  const hm = clock;
  const block = data?.hours.find((b) => b.from <= hm && hm < b.to);
  const hoursLine = !data ? '' : !block ? t.closedNow : block.who === 'f' ? fmt(t.ladiesUntil, { t: block.to }) : block.who === 'm' ? fmt(t.menUntil, { t: block.to }) : fmt(t.openUntil, { t: block.to });
  const upcoming = (data?.classes ?? []).filter((k) => { const [h, m] = k.startsAt.split(':').map(Number); return h * 60 + m + k.minutes > Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)); });

  if (state === 'nolink' || state === 'reset') return <main className="door door-msg"><HMark className="door-h" /><p>{state === 'reset' ? t.reset : t.nolink}</p></main>;
  return (
    <main className={`door${block?.who === 'f' ? ' ladies' : ''}${ui ? ' ui' : ''}`}>
      <header className="door-top">
        <div className="door-brand">{data?.gym.logoUrl ? <img src={data.gym.logoUrl} alt="" /> : <HMark className="door-h" />}<b>{data?.gym.name ?? ''}</b></div>
        <div className="door-clock" dir="ltr">{clock}</div>
      </header>

      <section className="door-main">
        <div className="door-now">
          <span className="door-pulse" aria-hidden="true" />
          <b>{data ? data.inNow : '—'}</b>
          <span>{t.inNow}</span>
          {hoursLine && <p className={`door-hours${block?.who === 'f' ? ' f' : block?.who === 'm' ? ' m' : ''}`}>{hoursLine}</p>}
        </div>
        <div className="door-mid">
          {self && started ? <>
            <p className="door-scan-t"><Icon n="scan" />{t.scanHere}</p>
            {camera && canScan() ? <CameraScan facing="user" className="door-cam" onCode={selfCheckin} /> : <div className="door-card-hint"><span className="door-card" /></div>}
            <input ref={scanIn} className="door-hidden" value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { selfCheckin(scan); setScan(''); } }} aria-label={t.scanHere} autoComplete="off" />
          </> : <p key={motto} className="door-motto">{t.mottos[motto % t.mottos.length]}</p>}
        </div>
        <aside className="door-classes">
          <p className="door-k">{t.classes}</p>
          {!upcoming.length ? <p className="door-none">{t.noClasses}</p> : upcoming.slice(0, 5).map((k) => {
            const left = k.capacity == null ? null : Math.max(0, k.capacity - k.booked);
            return (
              <div key={k.id} className="door-class" style={{ ['--k' as any]: k.color ?? '#E4572E' }}>
                <span dir="ltr">{k.startsAt}</span>
                <div className="min-w-0"><b>{k.name}</b><small>{[k.coach, k.gender !== 'all' ? g.classes.who[k.gender] : null].filter(Boolean).join(' · ')}</small></div>
                {left != null && <em className={left === 0 ? 'full' : ''}>{left === 0 ? t.full : fmt(t.spots, { n: left })}</em>}
              </div>
            );
          })}
        </aside>
      </section>

      {show && (
        <div key={show.id} className={`door-hi ${show.result === 'denied' ? 'no' : 'yes'}`} role="status">
          <div className="door-hi-card">
            <span className="door-hi-ic">{show.result === 'denied' ? <Icon n="alert" /> : <Icon n="check" />}</span>
            {show.result === 'denied' ? <>
              {show.name && <h2>{show.name}</h2>}
              <p className="door-hi-big">{t.see}</p>
              {show.reason && g.pass.reasons[show.reason] && <p className="door-hi-sub">{g.pass.reasons[show.reason]}</p>}
            </> : <>
              <h2>{fmt(t.welcome, { name: show.name })}</h2>
              {show.visitsLeft != null ? <p className="door-hi-big">{fmt(t.visits, { n: show.visitsLeft })}</p>
                : show.daysLeft != null ? <p className="door-hi-big">{show.daysLeft <= 1 ? t.last : fmt(t.days, { n: show.daysLeft })}</p> : null}
              {show.membership && <p className="door-hi-sub">{show.membership}</p>}
            </>}
          </div>
        </div>
      )}

      {!started && <button className="door-start" onClick={start}><Icon n="display" />{t.start}</button>}
      <div className="door-ctl">
        <button aria-pressed={sound} onClick={() => { setSound(!sound); pref.set('sound', !sound); }}><Icon n="bell" />{t.sound}</button>
        {self && canScan() && <button aria-pressed={camera} onClick={() => { setCamera(!camera); pref.set('camera', !camera); }}><Icon n="camera" />{t.camera}</button>}
        <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}><Icon n="display" />{t.fullscreen}</button>
      </div>
      {state === 'offline' && <p className="door-off">{t.offline}</p>}
    </main>
  );
}
