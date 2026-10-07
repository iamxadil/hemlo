// The front desk: one field does everything. A USB scanner (or the camera) reads a card and the member is in, with a
// big green "welcome" and what's left; or turned back in red with the reason and a way to fix it (renew, let in once).
// Typing a name or phone finds people as you type. Around it: who is training now, today against last week, renewals
// due, the money today, and the day's shape hour by hour. Works the same with a mouse, a scanner or a thumb.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go } from '../lib/app';
import { Empty, Icon, toLatin } from '../components/ui';
import { useG } from './i18n';
import { Face, LeftArc, StatePill, CameraScan, canScan, beep, useCountUp } from './ui';
import { SellSheet } from './Sell';
import { hhmm, leftOf, fmt, type CheckinResult, type MemberRow } from './data';

const isCode = (s: string) => /^(HEMLO-GYM:)?[2-9A-HJ-NP-Z]{10}$/i.test(s.trim());
const pref = { get: (k: string) => { try { return localStorage.getItem(`hemlo.gym.${k}`) === '1'; } catch { return false; } }, set: (k: string, v: boolean) => { try { localStorage.setItem(`hemlo.gym.${k}`, v ? '1' : '0'); } catch {} } };

export function Desk() {
  const { g, can, num, money, toast, err } = useG();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [d, setD] = useState('');
  const [sel, setSel] = useState(0);
  const [pass, setPass] = useState<CheckinResult | null>(null);
  const [camera, setCamera] = useState(false);
  const [sound, setSound] = useState(() => pref.get('sound'));
  const [selling, setSelling] = useState<{ id: string; name: string } | null>(null);

  const today = useQuery({ queryKey: ['gym-today'], queryFn: () => api('/v1/gym/today'), refetchInterval: 30_000 });
  const feed = useQuery({ queryKey: ['gym-checkins', 'today'], queryFn: async () => (await api('/v1/gym/checkins')).checkins as any[], refetchInterval: 20_000 });
  useEffect(() => { const t = setTimeout(() => setD(toLatin(q.trim())), 120); return () => clearTimeout(t); }, [q]);
  const typing = d.length >= 1 && !isCode(d);
  const found = useQuery({ queryKey: ['gym-members', 'desk', d], queryFn: async () => (await api(`/v1/gym/members?q=${encodeURIComponent(d)}`)).members as MemberRow[], enabled: typing, placeholderData: (x) => x });
  const hits = typing ? (found.data ?? []).slice(0, 6) : [];
  useEffect(() => setSel(0), [d]);

  // a scanner types fast and ends with Enter: wherever the focus is on this page, letters go to the field
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/^(input|textarea|select)$/i.test(el?.tagName ?? '') || el?.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && !document.querySelector('.sheet, .gy-panel')) input.current?.focus();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const refresh = () => { for (const k of ['gym-today', 'gym-checkins', 'gym-members', 'gym-member']) qc.invalidateQueries({ queryKey: [k] }); };
  const checkin = useMutation({
    mutationFn: (b: { memberId?: string; code?: string; override?: boolean }) => api<CheckinResult>('/v1/gym/checkin', { body: b }),
    onSuccess: (r) => {
      setPass(r); setQ(''); setD('');
      if (sound) beep(r.result === 'denied' ? 'bad' : 'ok');
      refresh();
      input.current?.focus();
    },
    onError: (e) => { if (sound) beep('bad'); toast(err(e), 'bad'); setQ(''); input.current?.focus(); },
  });
  const undo = useMutation({
    mutationFn: (id: string) => api(`/v1/gym/checkins/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setPass(null); toast(g.desk.undone); refresh(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const submit = () => {
    const v = toLatin(q.trim());
    if (!v || checkin.isPending) return;
    if (isCode(v)) return checkin.mutate({ code: v });
    const m = hits[sel] ?? (found.data?.length === 1 ? found.data[0] : null);
    if (m) checkin.mutate({ memberId: m.id });
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Escape') { setQ(''); }
  };
  const t = today.data;
  const canCheck = can('checkin.create');

  return (
    <div className="gy-desk">
      <div className="gy-desk-main">
        {canCheck && (
          <div className={`gy-scan${typing && hits.length ? ' open' : ''}`}>
            <div className="gy-scan-bar">
              <Icon n="scan" className="gy-scan-ic" />
              <input ref={input} className="gy-scan-in" autoFocus={matchMedia('(pointer: fine)').matches} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key}
                placeholder={g.desk.scan} aria-label={g.desk.scan} autoComplete="off" spellCheck={false} />
              {checkin.isPending ? <span className="spinner" /> : null}
              {canScan() && <button className={`gy-scan-btn${camera ? ' on' : ''}`} onClick={() => setCamera((x) => !x)} aria-pressed={camera} title={g.desk.camera}><Icon n="camera" /></button>}
              <button className={`gy-scan-btn${sound ? ' on' : ''}`} onClick={() => { setSound(!sound); pref.set('sound', !sound); if (!sound) beep('ok'); }} aria-pressed={sound} title={g.desk.sound}><Icon n="bell" /></button>
            </div>
            {typing && hits.length > 0 && (
              <div className="gy-scan-list" role="listbox">
                {hits.map((m, i) => (
                  <button key={m.id} className="gy-scan-hit" data-on={i === sel} onMouseMove={() => setSel(i)} onClick={() => checkin.mutate({ memberId: m.id })} role="option" aria-selected={i === sel}>
                    <Face name={m.name} url={m.photoUrl} state={m.state} size="sm" />
                    <span className="min-w-0 flex-1 text-start"><b className="block truncate">{m.name}</b><span className="sub" dir="auto">{fmt(g.members.no, { n: num(m.memberNo) })}{m.membership ? ` · ${m.membership.name}` : ''}</span></span>
                    <StatePill state={m.state} />
                    <kbd className="gy-enter">↵</kbd>
                  </button>
                ))}
              </div>
            )}
            {camera && <CameraScan className="gy-desk-cam" onCode={(code) => checkin.mutate({ code })} />}
          </div>
        )}

        {pass ? <Pass key={pass.checkin.id + pass.result} r={pass} busy={checkin.isPending}
          onOverride={() => checkin.mutate({ memberId: pass.member.id, override: true })}
          onRenew={() => setSelling({ id: pass.member.id, name: pass.member.name })}
          onUndo={pass.result !== 'again' ? () => undo.mutate(pass.checkin.id) : undefined}
          onClose={() => setPass(null)} />
          : canCheck && <p className="gy-ready"><span className="gy-ready-dot" />{g.desk.ready}</p>}

        <section className="gy-card gy-feed">
          <header className="gy-card-h"><h2>{g.desk.feed}</h2>{t && <span className="sub">{fmt(g.desk.turnedBack, { n: num(t.turnedBack) })}</span>}</header>
          {!feed.data ? <div className="skeleton m-4 h-40" /> : !feed.data.length ? <Empty icon="door" text={g.desk.empty} /> : (
            <ol className="gy-feed-list">
              {feed.data.slice(0, 60).map((c) => (
                <li key={c.id}>
                  <button className="gy-feed-row" onClick={() => go(`#/member?id=${c.memberId}`)}>
                    <time dir="ltr">{hhmm(c.at)}</time>
                    <Face name={c.name} url={c.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1 text-start"><b className="block truncate">{c.name}</b><span className="sub block truncate">{c.result === 'denied' ? g.pass.reasons[c.reason] ?? c.reason : c.via === 'pt' ? g.file.via.pt : c.membership ?? ''}</span></span>
                    <span className={`gy-res res-${c.result}`} title={c.result}>{c.result === 'denied' ? <Icon n="close" /> : <Icon n="check" />}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="gy-desk-side">
        <InNow n={t?.inNow} />
        <div className="gy-tiles">
          <Tile label={g.desk.visits} value={t?.visits} sub={t ? fmt(g.desk.lastWeek, { n: num(t.visitsLastWeek) }) : ''} trend={t ? t.visits - t.visitsLastWeek : 0} />
          <Tile label={g.desk.active} value={t?.active} />
          <Tile label={g.desk.due} value={t ? t.ending + t.lapsed : undefined} sub={t ? fmt(g.desk.dueSub, { n: num(t.ending), m: num(t.lapsed) }) : ''} href="#/renewals" tone={t && t.ending + t.lapsed > 0 ? 'warn' : undefined} />
          {can('reports.read') && <Tile label={g.desk.sold} money value={t ? t.membershipsToday + t.shopToday : undefined} sub={t ? `${fmt(g.desk.memberships, { v: money(t.membershipsToday) })} · ${fmt(g.desk.shop, { v: money(t.shopToday) })}` : ''} />}
          {can('reports.read') && <Tile label={g.desk.owed} money value={t?.owed} href="#/members?status=owing" />}
        </div>
        {t && <DayShape hours={t.hours} />}
      </aside>

      {selling && <SellSheet memberId={selling.id} name={selling.name} onClose={() => setSelling(null)} onSold={() => setPass(null)} />}
    </div>
  );
}

/** The result of a check-in: who, in or out (and why), what's left, what to do about it. */
function Pass({ r, busy, onOverride, onRenew, onUndo, onClose }: { r: CheckinResult; busy: boolean; onOverride(): void; onRenew(): void; onUndo?: () => void; onClose(): void }) {
  const { g, num, money, date, can } = useG();
  const m = r.membership, out = r.result === 'denied';
  const state = out ? 'expired' : r.warn.includes('ending') || r.warn.includes('grace') ? 'ending' : 'active';
  const head = r.result === 'ok' ? g.pass.ok : r.result === 'again' ? g.pass.again : r.result === 'override' ? g.pass.overridden : g.pass.denied;
  const big = m ? (m.visits != null ? m.visitsLeft ?? 0 : m.daysLeft) : 0;
  return (
    <article className={`gy-pass pass-${r.result}`} aria-live="polite">
      <span className="gy-pass-edge" aria-hidden="true" />
      <button className="icon-btn gy-pass-x" onClick={onClose} aria-label={g.common.close}><Icon n="close" /></button>
      <div className="gy-pass-who">
        <Face name={r.member.name} url={r.member.photoUrl} state={state} size="xl" />
        <div className="min-w-0">
          <p className="gy-pass-head">{out ? <Icon n="alert" /> : <Icon n="check" />}{head}</p>
          <h2 className="gy-pass-name">{r.member.name}</h2>
          <p className="sub">{fmt(g.members.no, { n: num(r.member.memberNo) })}{m ? ` · ${m.name}` : ''}</p>
          {out && r.reason && <p className="gy-pass-why">{g.pass.reasons[r.reason] ?? r.reason}{m && r.reason === 'expired' ? ` · ${fmt(g.pass.ended, { date: date(m.endsOn) })}` : ''}</p>}
        </div>
        {m && !out && (
          <LeftArc value={leftOf(m)} state={state} size={112}>
            <b>{num(big)}</b>
            <small>{m.visits != null ? (big === 1 ? g.pass.lastVisit : g.pass.visitsLeft) : big === 1 ? g.pass.lastDay : g.pass.daysLeft}</small>
          </LeftArc>
        )}
      </div>
      {(r.warn.length > 0 || r.member.alerts.length > 0) && (
        <div className="gy-pass-warn">
          {r.warn.map((w) => <span key={w} className={`gy-chip ${w === 'birthday' ? 'gold' : w === 'no_photo' ? '' : 'warn'}`}>{fmt(g.pass.warn[w] ?? w, { v: money(r.member.balance) })}</span>)}
          {r.member.alerts.map((a) => <span key={a} className="gy-chip bad">! {g.form.conditions[a] ?? a}</span>)}
        </div>
      )}
      <div className="gy-pass-acts">
        {out && can('checkin.create') && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={onOverride}>{g.pass.override}</button>}
        {(out || r.warn.includes('ending') || r.warn.includes('grace')) && can('memberships.sell') && <button className="btn btn-accent btn-sm" onClick={onRenew}><Icon n="plus" className="h-4 w-4" />{g.pass.renew}</button>}
        <a className="btn btn-ghost btn-sm" href={`#/member?id=${r.member.id}`}>{g.desk.open}</a>
        {onUndo && <button className="btn btn-ghost btn-sm gy-undo" onClick={onUndo}><Icon n="undo" className="h-4 w-4" />{g.desk.undo}</button>}
      </div>
    </article>
  );
}

function InNow({ n }: { n?: number }) {
  const { g } = useG();
  const v = useCountUp(n ?? 0);
  return (
    <div className="gy-innow">
      <span className="gy-pulse" aria-hidden="true" />
      <b>{n == null ? '—' : v}</b>
      <span>{g.desk.inNow}</span>
    </div>
  );
}

function Tile({ label, value, sub, href, tone, money: isMoney, trend }: { label: string; value?: number; sub?: string; href?: string; tone?: string; money?: boolean; trend?: number }) {
  const { num, money } = useG();
  const v = useCountUp(value ?? 0);
  const body = <>
    <span className="gy-tile-l">{label}</span>
    <b className="gy-tile-v">{value == null ? '—' : isMoney ? money(v) : num(v)}{trend ? <i className={trend > 0 ? 'up' : 'down'}>{trend > 0 ? '↑' : '↓'}</i> : null}</b>
    {sub && <span className="gy-tile-s">{sub}</span>}
  </>;
  const cls = `gy-tile${tone ? ` tn-${tone}` : ''}${isMoney ? ' is-money' : ''}`;
  return href ? <a href={href} className={cls}>{body}</a> : <div className={cls}>{body}</div>;
}

/** Visits per hour today, with last week's same day as a shadow behind. */
function DayShape({ hours }: { hours: { h: number; today: number; lastWeek: number }[] }) {
  const { g } = useG();
  const shown = hours.filter((x) => x.h >= 6);
  const max = Math.max(1, ...shown.map((x) => Math.max(x.today, x.lastWeek)));
  const nowH = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date()));
  const bars = useMemo(() => shown, [hours]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="gy-card gy-shape">
      <header className="gy-card-h"><h2>{g.desk.shape}</h2><span className="gy-legend"><i className="a" />{g.desk.today}<i className="b" />{g.desk.lastWeekLegend}</span></header>
      <div className="gy-shape-bars" dir="ltr">
        {bars.map((x) => (
          <div key={x.h} className={`gy-shape-col${x.h === nowH ? ' now' : ''}`} title={`${x.h}:00 · ${x.today}`}>
            <span className="b" style={{ height: `${(x.lastWeek / max) * 100}%` }} />
            <span className="a" style={{ height: `${(x.today / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="gy-shape-x" dir="ltr"><span>6</span><span>12</span><span>18</span><span>23</span></div>
    </section>
  );
}

