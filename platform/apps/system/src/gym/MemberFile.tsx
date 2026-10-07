// A member's file: who they are and what's left at a glance, then their memberships (renew, pause, resume, sessions),
// their visits as a 12-week map, their progress (measurements on a chart), and their profile. Plus their card: a QR
// code to scan at the desk or the door, sent to their phone or printed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, upload } from '../lib/api';
import { go, useRoute, localPhone } from '../lib/app';
import { prepareImage } from '../lib/images';
import { Empty, Icon, Money, Sheet } from '../components/ui';
import { useG } from './i18n';
import { Face, LeftArc, StatePill, SlideSeg } from './ui';
import { passImage, printCard, type CardData } from './card';
import { MemberForm } from './Members';
import { SellSheet } from './Sell';
import { useSetup, todayISO, addDays, daysBetween, leftOf, waLink, fmt, tone, type Membership } from './data';

type Tab = 'memberships' | 'visits' | 'progress' | 'profile';

export function MemberFile() {
  const { params } = useRoute();
  const id = params.get('id') ?? '';
  return <FileView key={id + (params.get('sell') ?? '')} id={id} startTab={(params.get('tab') as Tab) || 'memberships'} sell={params.get('sell') === '1'} />;
}

function FileView({ id, startTab, sell }: { id: string; startTab: Tab; sell: boolean }) {
  const { g, can, num, date, toast, err, sys } = useG();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(startTab);
  const [selling, setSelling] = useState(sell);
  const [editing, setEditing] = useState(false);
  const [card, setCard] = useState(false);
  const file = useQuery({ queryKey: ['gym-member', id], queryFn: () => api(`/v1/gym/members/${id}`), enabled: !!id });
  const setup = useSetup();
  const photoIn = useRef<HTMLInputElement>(null);
  useEffect(() => { if (sell) history.replaceState(null, '', `#/member?id=${id}`); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => { for (const k of ['gym-member', 'gym-members', 'gym-today', 'gym-checkins', 'gym-renewals']) qc.invalidateQueries({ queryKey: [k] }); };
  const checkin = useMutation({
    mutationFn: (override: boolean) => api('/v1/gym/checkin', { body: { memberId: id, override } }),
    onSuccess: (r: any) => { refresh(); toast(r.result === 'denied' ? `${g.pass.denied}: ${g.pass.reasons[r.reason] ?? r.reason}` : r.result === 'again' ? g.pass.again : g.pass.ok, r.result === 'denied' ? 'bad' : 'ok'); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const photo = useMutation({
    mutationFn: async (f: File) => { const img = await prepareImage(f, { max: 640, quality: 0.82 }); const up = await upload('member', img); return api(`/v1/gym/members/${id}`, { method: 'PATCH', body: { photoId: up.id } }); },
    onSuccess: () => refresh(), onError: (e) => toast(err(e), 'bad'),
  });
  if (!file.data) return file.error ? <Empty icon="user" text={err(file.error)} /> : <div className="grid gap-4"><div className="skeleton h-48" /><div className="skeleton h-72" /></div>;
  const m = file.data.member, list = file.data.memberships as Membership[];
  const day = todayISO();
  const current = list.find((x) => ['active', 'grace', 'frozen'].includes(x.state) && x.category !== 'other')
    ?? list.filter((x) => x.state === 'future').sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? list.find((x) => x.state !== 'canceled') ?? null;
  const state = !current ? 'none' : current.state === 'active' ? (current.visits != null ? (current.visitsLeft ?? 0) <= 2 : current.daysLeft <= 5) ? 'ending' : 'active' : current.state;
  const wa = waLink(m.phone);
  const coach = setup.data?.trainers.find((t) => t.id === m.trainerId);
  const big = current ? (current.visits != null ? current.visitsLeft ?? 0 : current.state === 'future' ? daysBetween(current.startsOn, current.endsOn) + 1 : current.daysLeft) : 0;

  return (
    <div className="grid gap-5">
      <section className="gy-hero">
        <div className="gy-hero-who">
          <button className="gy-hero-face" onClick={() => can('members.update') && photoIn.current?.click()} disabled={!can('members.update')} aria-label={g.form.changePhoto}>
            <Face name={m.name} url={m.photoUrl} state={state} size="xl" />
            {can('members.update') && <span className="gy-hero-cam">{photo.isPending ? <span className="spinner" /> : <Icon n="camera" />}</span>}
          </button>
          <input ref={photoIn} type="file" accept="image/*" capture="user" hidden onChange={(e) => e.target.files?.[0] && photo.mutate(e.target.files[0])} />
          <div className="min-w-0 flex-1">
            <h2 className="gy-hero-name">{m.name}</h2>
            <p className="sub" dir="auto">{fmt(g.members.no, { n: num(m.memberNo) })}{m.phone ? ` · ${localPhone(m.phone)}` : ''}{coach ? ` · ${coach.name}` : ''}</p>
            {m.alerts?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{m.alerts.map((a: string) => <span key={a} className="gy-chip bad">! {g.form.conditions[a] ?? a}</span>)}</div>}
            <div className="gy-hero-acts">
              {m.phone && <a className="gy-round" href={`tel:${m.phone}`} title={g.file.call}><Icon n="phone" /></a>}
              {wa && <a className="gy-round wa" href={wa} target="_blank" rel="noopener" title={g.file.whatsapp}><Icon n="wa" /></a>}
              <button className="gy-round" onClick={() => setCard(true)} title={g.file.card}><Icon n="scan" /></button>
              {can('members.update') && <button className="gy-round" onClick={() => setEditing(true)} title={g.common.edit}><Icon n="edit" /></button>}
            </div>
          </div>
        </div>
        <div className={`gy-hero-pass tn-${tone(state)}`}>
          {current ? <>
            <LeftArc value={current.state === 'future' ? 1 : leftOf(current, day)} state={state} size={128} stroke={10}>
              <b>{num(big)}</b><small>{current.visits != null ? g.pass.visitsLeft : g.pass.daysLeft}</small>
            </LeftArc>
            <div className="min-w-0 flex-1">
              <StatePill state={state} />
              <p className="gy-hero-ms">{current.name}</p>
              <p className="sub">{current.state === 'frozen' && current.frozenFrom ? fmt(g.file.paused, { date: date(current.frozenFrom) }) : `${date(current.startsOn)} – ${date(current.endsOn)}`}</p>
            </div>
          </> : <p className="muted flex-1">{g.file.noMs}</p>}
          <div className="gy-hero-btns">
            {can('checkin.create') && <button className="btn btn-secondary btn-sm" disabled={checkin.isPending} onClick={() => checkin.mutate(false)}><Icon n="door" className="h-4 w-4" />{g.file.checkin}</button>}
            {can('memberships.sell') && <button className="btn btn-accent btn-sm" onClick={() => setSelling(true)}><Icon n="plus" className="h-4 w-4" />{g.file.sell}</button>}
          </div>
        </div>
      </section>

      <div className="gy-stats">
        <div><b>{num(file.data.stats?.month ?? 0)}</b><span>{g.file.month}</span></div>
        <div><b>{num(file.data.stats?.total ?? 0)}</b><span>{g.file.total}</span></div>
        <div><b className="text-base">{date(m.createdAt)}</b><span>{fmt(g.file.since, { date: '' }).trim()}</span></div>
        <a href={`#/customers?id=${m.id}`} className={m.balance > 0 ? 'owe' : ''}><b><Money v={m.balance} /></b><span>{m.balance > 0 ? g.file.owes : g.file.account}</span></a>
      </div>

      <SlideSeg value={tab} onChange={(v) => setTab(v as Tab)} options={(['memberships', 'visits', ...(can('training.read') ? ['progress'] : []), 'profile'] as Tab[]).map((k) => [k, g.file.tabs[k]])} />

      {tab === 'memberships' && <Memberships list={list} onSell={() => setSelling(true)} />}
      {tab === 'visits' && <Visits visits={file.data.visits} />}
      {tab === 'progress' && <Progress memberId={id} measures={file.data.measures} gender={m.gender} />}
      {tab === 'profile' && <Profile m={m} coach={coach?.name} bookings={file.data.bookings} />}

      {selling && <SellSheet memberId={id} name={m.name} onClose={() => setSelling(false)} />}
      {editing && <MemberForm member={m} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {card && <CardSheet m={m} ms={current} active={state === 'active' || state === 'ending'} gym={sys.business.name} logo={sys.business.logoUrl ?? null} onClose={() => setCard(false)} />}
    </div>
  );
}

function Memberships({ list, onSell }: { list: Membership[]; onSell(): void }) {
  const { g, can, num, date, money, toast, err } = useG();
  const qc = useQueryClient();
  const [fixing, setFixing] = useState<Membership | null>(null);
  const act = useMutation({
    mutationFn: ({ ms, what }: { ms: Membership; what: 'freeze' | 'unfreeze' | 'cancel' | 'session' }) => api(`/v1/gym/memberships/${ms.id}/${what}`, { body: {} }),
    onSuccess: (r: any, v) => {
      for (const k of ['gym-member', 'gym-members', 'gym-today', 'gym-renewals']) qc.invalidateQueries({ queryKey: [k] });
      toast(v.what === 'freeze' ? g.file.pausedNow : v.what === 'unfreeze' ? fmt(g.file.resumed, { n: num(r.added ?? 0) }) : v.what === 'cancel' ? g.file.canceled : g.file.sessionDone);
    },
    onError: (e) => toast(err(e), 'bad'),
  });
  if (!list.length) return <Empty icon="calendar" text={g.file.noMs} action={can('memberships.sell') && <button className="btn btn-accent btn-sm" onClick={onSell}>{g.file.sell}</button>} />;
  return (
    <div className="grid gap-3">
      {list.map((ms) => {
        const used = ms.visits != null ? ms.visitsUsed / Math.max(1, ms.visits) : null;
        return (
          <article key={ms.id} className={`gy-ms${ms.state === 'canceled' || ms.state === 'ended' || ms.state === 'used' ? ' past' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2"><b className="text-[1.02rem]">{ms.name}</b><StatePill state={ms.state} /></p>
                <p className="sub mt-1" dir="auto">{date(ms.startsOn)} – {date(ms.endsOn)}{ms.price ? ` · ${money(ms.price)}` : ''}{ms.discount ? ` (−${money(ms.discount)})` : ''}</p>
                {ms.state === 'frozen' && ms.frozenFrom && <p className="sub text-[var(--info)]">{fmt(g.file.paused, { date: date(ms.frozenFrom) })}</p>}
                {ms.freezeDays > 0 && ms.state !== 'ended' && ms.state !== 'canceled' && <p className="sub">{fmt(g.file.freezeLeft, { n: num(Math.max(0, ms.freezeDays - ms.frozenDays)) })}</p>}
              </div>
              {ms.state !== 'ended' && ms.state !== 'canceled' && ms.state !== 'used' && <b className="gy-ms-left">{ms.visits != null ? `${num(ms.visitsLeft ?? 0)}` : num(ms.state === 'future' ? daysBetween(ms.startsOn, ms.endsOn) + 1 : ms.daysLeft)}<small>{ms.visits != null ? g.pass.visitsLeft : g.pass.daysLeft}</small></b>}
            </div>
            {used != null && <div className="gy-meter"><i style={{ width: `${used * 100}%` }} /><span>{fmt(g.file.sessions, { u: num(ms.visitsUsed), n: num(ms.visits!) })}</span></div>}
            {ms.state !== 'canceled' && (
              <div className="gy-ms-acts">
                {ms.category === 'pt' && ms.state === 'active' && can('training.write') && <button className="btn btn-accent btn-sm" disabled={act.isPending} onClick={() => act.mutate({ ms, what: 'session' })}><Icon n="check" className="h-4 w-4" />{g.file.session}</button>}
                {(ms.state === 'active' || ms.state === 'future') && can('memberships.sell') && (ms.frozenDays < ms.freezeDays || can('memberships.manage')) && <button className="btn btn-secondary btn-sm" onClick={() => act.mutate({ ms, what: 'freeze' })}>{g.file.freeze}</button>}
                {ms.state === 'frozen' && can('memberships.sell') && <button className="btn btn-accent btn-sm" onClick={() => act.mutate({ ms, what: 'unfreeze' })}>{g.file.unfreeze}</button>}
                {can('memberships.manage') && <button className="btn btn-ghost btn-sm" onClick={() => setFixing(ms)}>{g.file.edit}</button>}
                {can('memberships.manage') && ms.state !== 'ended' && <button className="btn btn-ghost btn-sm text-[var(--bad)]" onClick={() => confirm(g.file.cancelSure) && act.mutate({ ms, what: 'cancel' })}>{g.file.cancel}</button>}
              </div>
            )}
          </article>
        );
      })}
      {fixing && <FixSheet ms={fixing} onClose={() => setFixing(null)} />}
    </div>
  );
}

/** A manager corrects a membership: dates, visits, note. */
function FixSheet({ ms, onClose }: { ms: Membership; onClose(): void }) {
  const { g, toast, err } = useG();
  const qc = useQueryClient();
  const [f, setF] = useState({ startsOn: ms.startsOn, endsOn: ms.endsOn, visits: ms.visits == null ? '' : String(ms.visits), visitsUsed: String(ms.visitsUsed), note: ms.note ?? '' });
  const save = useMutation({
    mutationFn: () => api(`/v1/gym/memberships/${ms.id}`, { method: 'PATCH', body: { ...f, visits: f.visits === '' ? null : Number(f.visits), visitsUsed: Number(f.visitsUsed) || 0 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-member'] }); qc.invalidateQueries({ queryKey: ['gym-members'] }); toast(g.setup.saved); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  return (
    <Sheet title={g.file.edit} sub={ms.name} onClose={onClose} center footer={<button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{g.common.save}</button>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{g.sell.starts}<input className="input" type="date" dir="ltr" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} /></label>
        <label className="field">{fmt(g.sell.ends, { date: '' })}<input className="input" type="date" dir="ltr" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} /></label>
        <label className="field">{g.setup.visits}<input className="input" inputMode="numeric" dir="ltr" placeholder={g.setup.unlimited} value={f.visits} onChange={(e) => setF({ ...f, visits: e.target.value.replace(/\D/g, '') })} /></label>
        <label className="field">{g.file.used}<input className="input" inputMode="numeric" dir="ltr" value={f.visitsUsed} onChange={(e) => setF({ ...f, visitsUsed: e.target.value.replace(/\D/g, '') })} /></label>
      </div>
      <label className="field">{g.sell.note}<input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
    </Sheet>
  );
}

/** Twelve weeks of visits as a map (a square per day), then the list. */
function Visits({ visits }: { visits: any[] }) {
  const { g, dateTime } = useG();
  const day = todayISO();
  const byDay = useMemo(() => { const s = new Map<string, number>(); for (const v of visits) if (v.result !== 'denied') { const k = new Date(+new Date(v.at) + 3 * 3600_000).toISOString().slice(0, 10); s.set(k, (s.get(k) ?? 0) + 1); } return s; }, [visits]);
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(), start = addDays(day, -(7 * 11 + dow));
  const cells = Array.from({ length: 7 * 11 + dow + 1 }, (_, i) => addDays(start, i));
  if (!visits.length) return <Empty icon="door" text={g.file.noVisits} />;
  return (
    <div className="grid gap-4">
      <section className="gy-card p-4">
        <p className="sec-t">{g.file.visitsMap}</p>
        <div className="gy-map" dir="ltr">{cells.map((c) => <i key={c} className={byDay.get(c) ? 'on' : ''} title={c} />)}</div>
      </section>
      <div className="gy-card rows overflow-clip">
        {visits.slice(0, 60).map((v) => (
          <div key={v.id} className="row">
            <span className={`gy-res res-${v.result}`}>{v.result === 'denied' ? <Icon n="close" /> : <Icon n="check" />}</span>
            <span className="min-w-0 flex-1"><b className="block font-medium" dir="auto">{dateTime(v.at)}</b><span className="sub">{g.file.via[v.via] ?? v.via}{v.reason ? ` · ${g.pass.reasons[v.reason] ?? v.reason}` : ''}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

const KEYS = ['weight', 'bodyFat', 'muscle', 'waist', 'chest', 'arm', 'thigh', 'hip', 'height'] as const;
const unitOf = (k: string) => (k === 'weight' || k === 'muscle' ? 'kg' : k === 'bodyFat' ? 'pct' : 'cm');

/** Measurements over time: the line that keeps people coming back. */
function Progress({ memberId, measures, gender }: { memberId: string; measures: any[]; gender: string | null }) {
  const { g, can, date, toast, err } = useG();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState<'weight' | 'bodyFat' | 'waist'>('weight');
  const del = useMutation({ mutationFn: (id: string) => api(`/v1/gym/measures/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['gym-member'] }), onError: (e) => toast(err(e), 'bad') });
  const asc = [...measures].reverse();
  const series = asc.filter((x) => x[metric] != null).map((x) => ({ at: x.at, v: Number(x[metric]) }));
  const first = series[0], last = series[series.length - 1];
  const latest = measures[0];
  const bmi = latest?.weight && (latest?.height ?? measures.find((x) => x.height)?.height) ? Number(latest.weight) / ((Number(latest.height ?? measures.find((x) => x.height)?.height) / 100) ** 2) : null;
  return (
    <div className="grid gap-4">
      {can('training.write') && <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{g.progress.add}</button>}
      {!measures.length ? <Empty icon="chart" text={g.progress.empty} /> : <>
        <section className="gy-card gy-prog">
          <header className="flex flex-wrap items-center gap-3">
            <SlideSeg value={metric} onChange={(v) => setMetric(v as typeof metric)} options={(['weight', 'bodyFat', 'waist'] as const).map((k) => [k, g.progress[k]])} />
            {first && last && first !== last && (
              <p className={`gy-delta ${last.v < first.v ? 'down' : 'up'}`}>
                <b>{last.v - first.v > 0 ? '+' : '−'}{Math.abs(Math.round((last.v - first.v) * 10) / 10)} {g.progress[unitOf(metric) as 'kg']}</b>
                <span className="sub">{fmt(g.progress.since, { date: date(first.at) })}</span>
              </p>
            )}
          </header>
          <Line points={series} unit={g.progress[unitOf(metric) as 'kg']} />
        </section>
        <div className="gy-kpis">
          {KEYS.filter((k) => latest?.[k] != null).map((k) => <div key={k}><span>{g.progress[k]}</span><b>{Number(latest[k])}<small> {g.progress[unitOf(k) as 'kg']}</small></b></div>)}
          {bmi && <div><span>{g.progress.bmi}</span><b>{Math.round(bmi * 10) / 10}</b></div>}
        </div>
        <section className="gy-card rows overflow-clip">
          <p className="sec-t px-5 pt-4">{g.progress.history}</p>
          {measures.map((x) => (
            <div key={x.id} className="row">
              <span className="min-w-0 flex-1"><b className="block font-medium">{date(x.at)}</b>
                <span className="sub" dir="auto">{KEYS.filter((k) => x[k] != null).map((k) => `${g.progress[k]} ${Number(x[k])}`).join(' · ')}</span></span>
              {can('training.write') && <button className="icon-btn" onClick={() => del.mutate(x.id)} aria-label={g.common.cancel}><Icon n="trash" /></button>}
            </div>
          ))}
        </section>
      </>}
      {adding && <MeasureSheet memberId={memberId} last={latest} female={gender === 'f'} onClose={() => setAdding(false)} />}
    </div>
  );
}

/** A line over time, drawn in, with the first and last values marked. */
function Line({ points, unit }: { points: { at: string; v: number }[]; unit: string }) {
  if (points.length < 1) return null;
  const W = 640, H = 200, P = 26;
  const vs = points.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = Math.max(1, hi - lo);
  const t0 = +new Date(points[0].at), t1 = +new Date(points[points.length - 1].at), ts = Math.max(1, t1 - t0);
  const xy = points.map((p) => [P + ((+new Date(p.at) - t0) / ts) * (W - 2 * P), P + (1 - (p.v - lo) / span) * (H - 2 * P)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${d} L${xy[xy.length - 1][0].toFixed(1)} ${H - 4} L${xy[0][0].toFixed(1)} ${H - 4} Z`;
  return (
    <svg className="gy-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ direction: 'ltr' }} role="img" aria-label={`${vs[0]} → ${vs[vs.length - 1]} ${unit}`}>
      <path d={area} className="gy-line-area" />
      <path d={d} className="gy-line-path" />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 5 : 3} className={i === xy.length - 1 ? 'last' : ''} />)}
      <text x={xy[0][0]} y={xy[0][1] - 10} className="gy-line-t">{vs[0]}</text>
      {xy.length > 1 && <text x={xy[xy.length - 1][0]} y={xy[xy.length - 1][1] - 12} className="gy-line-t b" textAnchor="end">{vs[vs.length - 1]}</text>}
    </svg>
  );
}

function MeasureSheet({ memberId, last, female, onClose }: { memberId: string; last: any; female: boolean; onClose(): void }) {
  const { g, toast, err } = useG();
  const qc = useQueryClient();
  const [f, setF] = useState<Record<string, string>>({ at: todayISO(), height: last?.height ? String(Number(last.height)) : '' });
  const save = useMutation({
    mutationFn: () => api(`/v1/gym/members/${memberId}/measures`, { body: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : k === 'at' ? v : Number(v.replace(',', '.'))])) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-member'] }); toast(g.progress.saved); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const field = (k: (typeof KEYS)[number]) => (
    <label key={k} className="field">{g.progress[k]} <small>{g.progress[unitOf(k) as 'kg']}</small>
      <input className="input" inputMode="decimal" dir="ltr" placeholder={last?.[k] != null ? String(Number(last[k])) : ''} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/[^\d.,]/g, '') })} /></label>
  );
  return (
    <Sheet title={g.progress.add} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{g.common.save}</button>}>
      <label className="field">{g.progress.date}<input className="input" type="date" dir="ltr" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">{KEYS.filter((k) => k !== 'hip' || female).map(field)}</div>
    </Sheet>
  );
}

function Profile({ m, coach, bookings }: { m: any; coach?: string; bookings: any[] }) {
  const { g, can, date, toast, err } = useG();
  const qc = useQueryClient();
  const newCard = useMutation({ mutationFn: () => api(`/v1/gym/members/${m.id}/new-card`, { body: {} }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-member'] }); toast(g.file.newCardDone); }, onError: (e) => toast(err(e), 'bad') });
  const archive = useMutation({ mutationFn: () => api(`/v1/gym/members/${m.id}/archive`, { body: { archived: true } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-members'] }); toast(g.file.archived); go('#/members'); }, onError: (e) => toast(err(e), 'bad') });
  const h = m.health ?? {};
  const conds = Object.keys(g.form.conditions).filter((k) => h[k]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="gy-card p-5">
        <dl className="kv">
          {m.goal && <><dt>{g.file.goal}</dt><dd>{g.form.goals[m.goal] ?? m.goal}</dd></>}
          {coach && <><dt>{g.file.coach}</dt><dd>{coach}</dd></>}
          {m.birthDate && <><dt>{g.form.birth}</dt><dd>{date(m.birthDate)}</dd></>}
          {m.gender && <><dt>{g.form.gender}</dt><dd>{g.form[m.gender as 'f']}</dd></>}
          {(m.emergencyName || m.emergencyPhone) && <><dt>{g.file.emergency}</dt><dd dir="auto">{[m.emergencyName, localPhone(m.emergencyPhone)].filter(Boolean).join(' · ')}</dd></>}
          {m.referral && <><dt>{g.file.referral}</dt><dd>{m.referral}</dd></>}
          {m.notes && <><dt>{g.form.notes}</dt><dd className="whitespace-pre-wrap">{m.notes}</dd></>}
        </dl>
      </section>
      {h && (can('training.read') || can('members.update')) && (
        <section className="gy-card p-5">
          <p className="sec-t">{g.file.health}</p>
          {conds.length || h.notes ? <>
            <div className="flex flex-wrap gap-1.5">{conds.map((k) => <span key={k} className="gy-chip bad">! {g.form.conditions[k]}</span>)}</div>
            {h.notes && <p className="mt-3 whitespace-pre-wrap text-[.95rem]">{h.notes}</p>}
          </> : <p className="muted">{g.file.noHealth}</p>}
        </section>
      )}
      {bookings?.length > 0 && (
        <section className="gy-card p-5">
          <p className="sec-t">{g.file.bookings}</p>
          <ul className="grid gap-2">{bookings.map((b) => <li key={b.id} className="flex justify-between gap-3"><span>{b.name}</span><span className="sub" dir="ltr">{date(b.date)} · {b.starts_at}</span></li>)}</ul>
        </section>
      )}
      {can('members.update') && (
        <section className="flex flex-wrap gap-2 lg:col-span-2">
          <button className="btn btn-secondary btn-sm" onClick={() => confirm(g.file.newCardSure) && newCard.mutate()}><Icon n="scan" className="h-4 w-4" />{g.file.newCard}</button>
          <button className="btn btn-ghost btn-sm text-[var(--bad)]" onClick={() => confirm(`${g.file.archive}?`) && archive.mutate()}>{g.file.archive}</button>
        </section>
      )}
    </div>
  );
}

/** The member's card: a QR to scan at the desk or the door. The sheet shows the very image that's sent (WhatsApp or the
 *  gallery); printing draws it at real ID-card size. Both come from ./card. */
function CardSheet({ m, ms, active, gym, logo, onClose }: { m: any; ms: Membership | null; active: boolean; gym: string; logo: string | null; onClose(): void }) {
  const { g, num, date, toast, lang } = useG();
  const [pass, setPass] = useState<{ url: string; blob: Blob | null } | null>(null);
  const [printing, setPrinting] = useState(false);
  const data = useMemo<CardData>(() => ({
    gym, logo, name: m.name, no: `${g.card.no} ${num(m.memberNo)}`, code: m.cardCode, photo: m.photoUrl ?? null,
    plan: ms?.name ?? null, active, kicker: g.card.kicker, hint: g.card.hint, rtl: lang !== 'en',
    detail: !ms ? null : ms.visits != null ? fmt(g.card.visits, { n: num(ms.visitsLeft ?? 0) }) : ms.state === 'future' ? fmt(g.card.starts, { date: date(ms.startsOn) }) : fmt(g.card.until, { date: date(ms.endsOn) }),
  }), [m, ms, active, gym, logo, lang]);
  useEffect(() => { let off = false; passImage(data).then((p) => !off && setPass(p)); return () => { off = true; }; }, [data]);
  const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const share = async (only: 'share' | 'save') => {
    const blob = pass?.blob; if (!blob) return;
    const fileOut = new File([blob], `card-${m.memberNo}.png`, { type: 'image/png' });
    if (only === 'share' && (navigator as any).canShare?.({ files: [fileOut] })) { try { await navigator.share({ files: [fileOut], title: g.card.title }); } catch { /* closed */ } return; }
    save(blob, fileOut.name);
    toast(g.card.download);
  };
  const print = async () => { setPrinting(true); try { await printCard(data); } finally { setTimeout(() => setPrinting(false), 800); } };
  return (
    <Sheet title={g.card.title} sub={m.name} onClose={onClose} center>
      <div className="gy-pass">
        {pass ? <img src={pass.url} alt={`${g.card.title}: ${m.name}`} width={1080} height={1680} /> : <div className="gy-pass-wait"><span className="spinner" /><span>{g.card.making}</span></div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn btn-accent justify-center" disabled={!pass} onClick={() => share('share')}><Icon n="wa" className="h-4 w-4" />{g.card.share}</button>
        <button className="btn btn-secondary justify-center" disabled={!pass} onClick={() => share('save')}><Icon n="download" className="h-4 w-4" />{g.card.download}</button>
        <button className="btn btn-secondary justify-center" disabled={printing} onClick={print}>{printing ? <span className="spinner" /> : <Icon n="print" className="h-4 w-4" />}{g.card.print}</button>
      </div>
      <p className="sub text-center text-[.8rem]">{g.card.printHint}</p>
    </Sheet>
  );
}
