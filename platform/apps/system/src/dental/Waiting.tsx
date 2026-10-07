// The waiting-room screen (#/waiting?k=…): a TV in the waiting room. It opens with a display-only link (no one is signed
// in on it), shows who is in each chair and who is next, calls each patient in with a
// full-screen card and a soft chime, and between calls shows a dental-care tip. Only "Ali H." ever reaches this page.
// Live: the clinic's hub (a Durable Object) tells the screen the moment the queue changes, and it fetches once. If the
// live line can't open (an old TV browser, a firewall), it checks every 12 seconds instead. Cheap to leave on all day.
import { useEffect, useRef, useState } from 'react';
import { API, api } from '../lib/api';
import { locale, readLang, rtl, type Lang } from '../lib/i18n';
import { DSTRINGS } from './i18n';
import { hhmm } from './data';
import './waiting.css';

type Item = { id: string; status: 'arrived' | 'seated'; chair: string | null; name: string; dentist: string | null; color: string | null; arrivedAt: string | null; seatedAt: string | null };
type Screen = { clinic: { name: string; logoUrl: string | null }; chairs: { id: string; name: string }[]; queue: Item[]; at: string };

const LANGS: Lang[] = ['ar', 'en', 'ckb'];
const params = () => new URLSearchParams(location.hash.split('?')[1] ?? '');
const pref = {
  get: (k: string, fallback: boolean) => { try { const v = localStorage.getItem(`hemlo.screen.${k}`); return v == null ? fallback : v === '1'; } catch { return fallback; } },
  set: (k: string, v: boolean) => { try { localStorage.setItem(`hemlo.screen.${k}`, v ? '1' : '0'); } catch {} },
};
const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

/** A soft two-note bell, made on the spot (no sound file to download). */
function chime(ctx: AudioContext) {
  const t = ctx.currentTime;
  for (const [f, at] of [[659.25, 0], [987.77, 0.2]] as const) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(0.2, t + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 1.8);
    o.connect(g).connect(ctx.destination); o.start(t + at); o.stop(t + at + 1.9);
  }
}

export function Waiting() {
  const [lang] = useState<Lang>(() => {
    const q = params().get('l') as Lang | null, l = q && LANGS.includes(q) ? q : readLang();
    document.documentElement.lang = l; document.documentElement.dir = rtl(l) ? 'rtl' : 'ltr';
    return l;
  });
  const w = DSTRINGS[lang].waiting;
  const [key, setKey] = useState<string | null>(() => params().get('k'));
  const [data, setData] = useState<Screen | null>(null);
  const [state, setState] = useState<'ok' | 'offline' | 'reset' | 'nolink'>('ok');
  const [now, setNow] = useState(() => new Date());
  const [calls, setCalls] = useState<Item[]>([]);
  const [tip, setTip] = useState(0);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(() => pref.get('sound', true));
  const [ui, setUi] = useState(true); // the controls show while the mouse moves
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);

  // opened from the clinic (signed in, no key yet): fetch the clinic's screen link and switch to it
  useEffect(() => {
    if (key) return;
    api<{ key: string }>('/v1/dent/screen-link')
      .then((x) => { history.replaceState(null, '', `#/waiting?k=${encodeURIComponent(x.key)}&l=${lang}`); setKey(x.key); })
      .catch(() => setState('nolink'));
  }, [key, lang]);

  // the queue: fetched the moment the clinic's hub says it changed (the live line), and on a timer as a safety net:
  // every 60 s while the line is open, every 12 s when it isn't. No cookies: the key is the only right.
  useEffect(() => {
    if (!key) return;
    let stop = false, timer = 0, fails = 0, live = false, inflight = false, again = false, ws: WebSocket | null = null, wsTimer = 0, retry = 0, beat = 0;
    // the next check: never pushed later by a dropped line (a reconnect loop must not starve the fallback)
    let dueAt = 0;
    const next = (after = false) => { if (stop) return; const ms = live ? 60_000 : Math.min(60_000, 12_000 * (1 + fails)); if (!after && timer && dueAt <= Date.now() + ms) return; clearTimeout(timer); dueAt = Date.now() + ms; timer = window.setTimeout(() => { timer = 0; load(); }, ms); };
    async function load() {
      if (inflight) { again = true; return; } // a change arrived mid-fetch: fetch once more right after
      inflight = true;
      try {
        const r = await fetch(`${API}/v1/dent/screen?k=${encodeURIComponent(key!)}`, { credentials: 'omit', cache: 'no-store' });
        if (r.status === 404) { if (!stop) { setState('reset'); stop = true; ws?.close(); } return; }
        if (!r.ok) throw new Error(String(r.status));
        const x = (await r.json()) as Screen;
        if (stop) return;
        fails = 0;
        // someone newly in a chair: call them in
        const inChair = new Set(x.queue.filter((q) => q.status === 'seated').map((q) => q.id));
        if (seen.current) { const fresh = x.queue.filter((q) => q.status === 'seated' && !seen.current!.has(q.id)); if (fresh.length) setCalls((c) => [...c, ...fresh]); }
        seen.current = inChair;
        setData(x); setState('ok');
      } catch { fails++; if (!stop) setState('offline'); }
      finally { inflight = false; if (again && !stop) { again = false; load(); } else next(true); }
    }
    const connect = () => {
      if (stop || !('WebSocket' in window)) return;
      ws = new WebSocket(`${API.replace(/^http/, 'ws')}/v1/dent/screen/live?k=${encodeURIComponent(key!)}`);
      ws.onopen = () => { live = true; retry = 0; load(); clearInterval(beat); beat = window.setInterval(() => { try { ws?.send('ping'); } catch {} }, 25_000); };
      ws.onmessage = (e) => { if (e.data === 'changed') load(); };
      ws.onclose = () => { live = false; clearInterval(beat); next(); if (!stop) wsTimer = window.setTimeout(connect, Math.min(30_000, 1500 * 2 ** retry++)); };
    };
    // back from the background or back online: catch up at once, and reopen the line if it dropped
    const wake = () => { if (document.hidden || stop) return; load(); if (!live && ws?.readyState !== WebSocket.CONNECTING) { clearTimeout(wsTimer); connect(); } };
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
    load(); connect();
    return () => { stop = true; clearTimeout(timer); clearTimeout(wsTimer); clearInterval(beat); ws?.close(); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
  }, [key]);

  // the clock, and a new tip every 14 s
  useEffect(() => {
    const a = setInterval(() => setNow(new Date()), 10_000), b = setInterval(() => setTip((n) => n + 1), 14_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  // calling a patient in: a soft chime (if on), 9 s on screen
  const call = calls[0];
  const chairName = (id: string | null) => (id ? data?.chairs.find((c) => c.id === id)?.name ?? '' : '');
  useEffect(() => {
    if (!call) return;
    const ctx = audio.current;
    if (sound && ctx) (ctx.state === 'running' ? Promise.resolve() : ctx.resume()).then(() => { if (ctx.state === 'running') chime(ctx); }).catch(() => {});
    const t = setTimeout(() => setCalls((c) => c.slice(1)), 9000);
    return () => clearTimeout(t);
  }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the TV awake once started
  useEffect(() => {
    if (!started || !('wakeLock' in navigator)) return;
    let lock: any = null;
    const take = () => { if (!document.hidden) (navigator as any).wakeLock.request('screen').then((l: any) => { lock = l; }).catch(() => {}); };
    take(); document.addEventListener('visibilitychange', take);
    return () => { document.removeEventListener('visibilitychange', take); lock?.release?.().catch(() => {}); };
  }, [started]);

  // controls fade away 3 s after the mouse stops
  useEffect(() => {
    let t = window.setTimeout(() => setUi(false), 4000);
    const on = () => { setUi(true); clearTimeout(t); t = window.setTimeout(() => setUi(false), 3000); };
    window.addEventListener('pointermove', on);
    return () => { window.removeEventListener('pointermove', on); clearTimeout(t); };
  }, []);

  const start = async () => {
    try { audio.current ??= new AudioContext(); await audio.current.resume(); } catch {}
    try { await document.documentElement.requestFullscreen?.(); } catch {}
    setStarted(true);
  };
  const toggleSound = () => {
    const v = !sound; setSound(v); pref.set('sound', v);
    if (v) { try { audio.current ??= new AudioContext(); audio.current.resume().then(() => audio.current && chime(audio.current)); } catch {} } // a chime now, so it's heard working
  };

  const date = new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Baghdad' }).format(now);
  const [hh, mm] = hhmm(now).split(':');
  const seated = data?.queue.filter((q) => q.status === 'seated') ?? [];
  const waiting = data?.queue.filter((q) => q.status === 'arrived') ?? [];
  const chairs = data ? [...data.chairs.map((c) => ({ id: c.id, name: c.name, who: seated.find((s) => s.chair === c.id) ?? null })),
    ...seated.filter((s) => !s.chair || !data.chairs.some((c) => c.id === s.chair)).map((s) => ({ id: s.id, name: '', who: s }))] : [];
  const quiet = !!data && !data.queue.length;
  const clinic = data?.clinic;

  if (state === 'reset' || state === 'nolink') return (
    <main className="wr wr-note"><div className="wr-glow" aria-hidden="true" /><p>{state === 'reset' ? w.reset : w.signIn}</p></main>
  );

  return (
    <main className={`wr${ui ? ' wr-ui' : ''}${quiet ? ' is-quiet' : ''}`}>
      <div className="wr-glow" aria-hidden="true" />

      <header className="wr-top">
        <div className="wr-clinic">
          {clinic?.logoUrl ? <img src={clinic.logoUrl} alt="" className="wr-logo" /> : clinic && <span className="wr-mono" aria-hidden="true">{[...clinic.name][0]}</span>}
          <b>{clinic?.name ?? ''}</b>
        </div>
        <div className="wr-time">
          <b dir="ltr">{hh}<span className="wr-colon">:</span>{mm}</b>
          <span>{date}</span>
        </div>
      </header>

      {quiet ? (
        <section className="wr-welcome">
          {clinic?.logoUrl && <img src={clinic.logoUrl} alt="" className="wr-logo-lg" />}
          <h1>{w.welcome}</h1>
          <p>{clinic?.name}</p>
        </section>
      ) : (
        <div className="wr-body">
          <section className="wr-chairs" aria-label={w.chairs}>
            <h2>{w.chairs}</h2>
            <div className="wr-chair-grid" data-n={Math.min(chairs.length, 6)}>
              {chairs.map((c, i) => (
                <article key={c.id} className={`wr-chair${c.who ? ' busy' : ''}`} style={c.who?.color ? { ['--dc' as any]: c.who.color } : undefined}>
                  <span className="wr-chair-num" aria-hidden="true">{i + 1}</span>
                  <span className="wr-chair-name">{c.name || '—'}</span>
                  {c.who ? <>
                    <b className="wr-chair-who">{c.who.name}</b>
                    {c.who.dentist && <span className="wr-chair-dr"><i />{c.who.dentist}</span>}
                  </> : <b className="wr-chair-free">{w.free}</b>}
                </article>
              ))}
            </div>
          </section>

          <section className="wr-next" aria-label={w.next}>
            <h2>{w.nextUp}<span>{waiting.length ? fmt(w.waitingN, { n: waiting.length }) : ''}</span></h2>
            {waiting.length ? (
              <ol>
                {waiting.slice(0, 7).map((x, i) => (
                  <li key={x.id} className={i === 0 ? 'first' : ''} style={x.color ? { ['--dc' as any]: x.color } : undefined}>
                    <span className="wr-n">{i + 1}</span>
                    <span className="wr-who"><b>{x.name}</b>{i === 0 && <em>{w.youAreNext}</em>}</span>
                    {x.dentist && <span className="wr-dr"><i />{x.dentist}</span>}
                  </li>
                ))}
              </ol>
            ) : <p className="wr-none">{w.empty}</p>}
          </section>
        </div>
      )}

      <footer className="wr-foot">
        <div className="wr-tip" key={tip % w.tips.length}>
          <span className="wr-tip-icon" aria-hidden="true"><Tooth /></span>
          <span className="wr-tip-text"><small>{w.tip}</small>{w.tips[tip % w.tips.length]}</span>
          <span className="wr-tip-bar" aria-hidden="true" />
        </div>
        <span className="wr-by">
          {state === 'offline' && <span className="wr-off">{w.reconnecting}</span>}
          {started ? <img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} alt="Hemlo Systems" /> : (
            <span className="wr-start"><small>{w.startHint}</small><button onClick={start}>{w.start}</button></span>
          )}
        </span>
      </footer>

      {/* once started, the controls show only while the mouse moves */}
      {started && (
        <div className="wr-ctrl">
          <button aria-pressed={sound} onClick={toggleSound}>{w.sound}</button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>{w.fullscreen}</button>
        </div>
      )}

      {call && (
        <div className="wr-call" key={call.id} role="alert" style={call.color ? { ['--dc' as any]: call.color } : undefined}>
          <div className="wr-rings" aria-hidden="true"><i /><i /><i /></div>
          <div className="wr-call-card">
            <b className="wr-call-name">{call.name}</b>
            <span className="wr-call-go">{w.calling}</span>
            <span className="wr-call-chair">{chairName(call.chair)}</span>
            {call.dentist && <span className="wr-call-dr"><i />{fmt(w.with, { name: call.dentist })}</span>}
          </div>
          <span className="wr-call-bar" aria-hidden="true" />
        </div>
      )}
    </main>
  );
}

/** A tooth, drawn in one line (the tips' mark). */
const Tooth = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 7.2c-2.3-1.9-6.2-2.6-8.4-.4-2.1 2.1-1.6 5.6-.6 8.4.8 2.2 1 4.4 1.3 6.7.3 2.4.9 4.9 2.6 4.9 1.9 0 1.8-3.4 2.4-5.6.4-1.5 1.3-2.4 2.7-2.4s2.3.9 2.7 2.4c.6 2.2.5 5.6 2.4 5.6 1.7 0 2.3-2.5 2.6-4.9.3-2.3.5-4.5 1.3-6.7 1-2.8 1.5-6.3-.6-8.4-2.2-2.2-6.1-1.5-8.4.4Z" />
    <path d="M12.2 9.6c1.3-.2 2.7.2 3.8 1" opacity=".55" />
  </svg>
);
