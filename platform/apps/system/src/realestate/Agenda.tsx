// The agenda: viewings (today, tomorrow, the week, and requests from public pages to schedule) and follow-ups (overdue,
// today, upcoming). Everything an agent does to one is a tap away: confirm on WhatsApp, remind, done (and "follow up?"),
// no-show, reschedule; a follow-up is done, snoozed, or answered on WhatsApp.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Empty, LeadPicker, Pill, RIcon, Sec } from './ui';
import { fmt, titleOf, waLink, telLink, toLocalInput, fromLocalInput, localPhone, isToday, type Viewing, type Followup, type Lead, type Card } from './data';

const hm = (d: string | null, lang: string) => (d ? new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-IQ-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Baghdad' }).format(new Date(d)) : '—');
const dayName = (d: string, lang: string) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-IQ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Baghdad' }).format(new Date(d));
const at = (days: number, h: number) => { const n = new Date(Date.now() + 3 * 3600_000); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + days, h - 3)).toISOString(); };

export function Agenda() {
  const { r, lang } = useR();
  const { params } = useRoute();
  const [tab, setTab] = useState<'today' | 'tomorrow' | 'week' | 'requests' | 'followups'>((params.get('tab') as any) || 'today');
  const range = tab === 'tomorrow' ? [at(1, 0), at(2, 0)] : tab === 'week' ? [at(0, 0), at(7, 0)] : [at(0, 0), at(1, 0)];
  const viewings = useQuery<{ viewings: Viewing[] }>({ queryKey: ['re-viewings', tab], queryFn: () => api(`/v1/re/viewings?${tab === 'requests' ? 'status=requested' : `from=${range[0]}&to=${range[1]}`}`), enabled: tab !== 'followups' });
  const follow = useQuery<{ followups: Followup[] }>({ queryKey: ['re-followups'], queryFn: () => api('/v1/re/followups?days=14') });
  const [adding, setAdding] = useState(false);
  const list = (viewings.data?.viewings ?? []).filter((v) => (tab === 'requests' ? v.status === 'requested' : v.startsAt && v.status !== 'requested'));
  const byDay = list.reduce<Record<string, Viewing[]>>((m, v) => { const k = new Date(+new Date(v.startsAt!) + 3 * 3600_000).toISOString().slice(0, 10); (m[k] ??= []).push(v); return m; }, {});
  const fl = follow.data?.followups ?? [];
  const reqN = useQuery<{ viewings: Viewing[] }>({ queryKey: ['re-viewings', 'requests'], queryFn: () => api('/v1/re/viewings?status=requested') }).data?.viewings.length ?? 0;
  const overdue = fl.filter((f) => f.when === 'overdue').length;
  return (
    <div>
      <div className="re-tools">
        <div className="re-tabs">
          {([['today', r.agenda.today], ['tomorrow', r.agenda.tomorrow], ['week', r.agenda.week], ['requests', r.agenda.requests, reqN], ['followups', r.agenda.followups, overdue]] as const).map(([k, t, n]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); history.replaceState(null, '', `#/agenda?tab=${k}`); }}>{t}{!!n && <span className="c">{n}</span>}</button>
          ))}
        </div>
        <span className="flex-1" />
        <button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}><Icon n="plus" />{r.agenda.newViewing}</button>
      </div>
      {tab === 'followups' ? (
        (['overdue', 'today', 'upcoming'] as const).map((w) => { const xs = fl.filter((f) => f.when === w); return xs.length > 0 && (
          <div key={w}><Sec title={<span className="inline-flex items-center gap-2"><i className={`re-tone-${w} inline-block h-2 w-2 rounded-full`} />{w === 'overdue' ? r.agenda.overdue : w === 'today' ? r.agenda.dueToday : r.agenda.upcoming}</span>} />
            <div className="panel">{xs.map((f) => <FollowRow key={f.id} f={f} />)}</div></div>
        ); })
      ) : viewings.isLoading ? <div className="skeleton h-64" /> : !list.length ? <div className="panel"><Empty icon="calendar" title={r.agenda.empty} action={<button className="btn btn-accent" onClick={() => setAdding(true)}><Icon n="plus" />{r.agenda.newViewing}</button>} /></div>
        : tab === 'requests' ? <div className="panel">{list.map((v) => <ViewingRow key={v.id} v={v} />)}</div>
        : Object.entries(byDay).map(([day, xs]) => <div key={day}><Sec title={dayName(xs[0].startsAt!, lang)} /><div className="panel">{xs.map((v) => <ViewingRow key={v.id} v={v} />)}</div></div>)}
      {tab === 'followups' && !fl.length && <div className="panel"><Empty icon="bell" title={r.today.noFollow} /></div>}
      {adding && <ViewingForm onClose={() => setAdding(false)} />}
    </div>
  );
}

/** One viewing: when, which home, with whom; confirm on WhatsApp; done / no-show / cancel / reschedule. */
export function ViewingRow({ v, compact = false }: { v: Viewing; compact?: boolean }) {
  const { r, lang, toast, err } = useR();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<null | 'schedule' | 'done' | 'menu'>(null);
  const msg = async (kind: 'confirm' | 'remind') => {
    try { const m = await api<{ wa: string }>(`/v1/re/viewings/${v.id}/message?kind=${kind}`); window.open(m.wa, '_blank', 'noopener'); if (kind === 'confirm' && v.status === 'scheduled') { await api(`/v1/re/viewings/${v.id}`, { method: 'PATCH', body: { status: 'confirmed' } }); qc.invalidateQueries({ queryKey: ['re-viewings'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); } }
    catch (e) { toast(err(e), 'bad'); }
  };
  const set = async (status: string) => { try { await api(`/v1/re/viewings/${v.id}`, { method: 'PATCH', body: { status } }); qc.invalidateQueries({ queryKey: ['re-viewings'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); setSheet(null); } catch (e) { toast(err(e), 'bad'); } };
  const past = v.startsAt && +new Date(v.startsAt) < Date.now();
  const tone = v.status === 'confirmed' ? 'ok' : v.status === 'completed' ? 'idle' : v.status === 'requested' ? 'warn' : v.status === 'cancelled' || v.status === 'no_show' ? 'bad' : 'info';
  return (
    <div className="re-item re-vrow">
      <span className="time">{v.status === 'requested' ? <RIcon n="sparkle" className="h-5 w-5 text-[var(--warn)]" /> : hm(v.startsAt, lang)}</span>
      {v.property?.cover ? <img className="ph" src={v.property.cover} alt="" /> : <span className="ph" />}
      <button className="min-w-0 flex-1 text-start" onClick={() => v.property && go(`#/property?id=${v.property.id}`)}>
        <b className="block truncate font-medium">{v.property ? titleOf(v.property as any, lang) : ''}</b>
        <span className="sub block truncate">{[v.lead?.name, v.status === 'requested' && v.preferred ? fmt(r.agenda.preferred, { v: v.preferred }) : v.property?.area].filter(Boolean).join(' · ')}</span>
      </button>
      {!compact && <Pill tone={tone}>{r.vstatus[v.status]}</Pill>}
      <span className="acts">
        {v.status === 'requested' ? <button className="btn btn-accent btn-sm" onClick={() => setSheet('schedule')}>{r.agenda.schedule}</button> : <>
          {v.lead && ['scheduled', 'confirmed'].includes(v.status) && !past && <button className="icon-btn re-icon-wa" title={v.status === 'scheduled' ? r.agenda.confirm : r.agenda.remind} onClick={() => msg(v.status === 'scheduled' ? 'confirm' : 'remind')}><Icon n="wa" /></button>}
          {['scheduled', 'confirmed'].includes(v.status) && past && <button className="btn btn-secondary btn-sm" onClick={() => setSheet('done')}><Icon n="check" />{r.agenda.done}</button>}
          {['scheduled', 'confirmed'].includes(v.status) && <button className="icon-btn" onClick={() => setSheet('menu')} aria-label={r.common.more}><Icon n="more" /></button>}
        </>}
      </span>
      {sheet === 'schedule' && <ScheduleSheet v={v} onClose={() => setSheet(null)} />}
      {sheet === 'done' && <CompleteSheet v={v} onClose={() => setSheet(null)} />}
      {sheet === 'menu' && (
        <Sheet title={v.property ? titleOf(v.property as any, lang) : ''} sub={v.startsAt ? `${dayName(v.startsAt, lang)} · ${hm(v.startsAt, lang)}` : ''} onClose={() => setSheet(null)} center>
          <div className="grid gap-2">
            <button className="btn btn-secondary justify-center" onClick={() => setSheet('done')}><Icon n="check" />{r.agenda.done}</button>
            <button className="btn btn-secondary justify-center" onClick={() => setSheet('schedule')}><Icon n="calendar" />{r.agenda.reschedule}</button>
            {v.lead && <button className="btn btn-secondary justify-center" onClick={() => msg('remind')}><Icon n="wa" />{r.agenda.remind}</button>}
            {v.property?.lat != null && <a className="btn btn-secondary justify-center" target="_blank" rel="noopener" href={`https://www.google.com/maps/dir/?api=1&destination=${v.property.lat},${v.property.lng}`}><RIcon n="pin" />{r.agenda.directions}</a>}
            <button className="btn btn-secondary justify-center" onClick={() => set('no_show')}>{r.agenda.noShow}</button>
            <button className="btn btn-danger justify-center" onClick={() => set('cancelled')}>{r.agenda.cancel}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Give a requested (or moved) viewing a time; then confirm it on WhatsApp. */
export function ScheduleSheet({ v, onClose }: { v: Viewing; onClose(): void }) {
  const { r, err } = useR();
  const qc = useQueryClient();
  const [when, setWhen] = useState(toLocalInput(v.startsAt ?? at(1, 17)));
  const [wa, setWa] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => api<{ wa?: string }>(`/v1/re/viewings/${v.id}`, { method: 'PATCH', body: { startsAt: fromLocalInput(when), status: 'scheduled' } }),
    onSuccess: (x) => { qc.invalidateQueries({ queryKey: ['re-viewings'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); if (x.wa) setWa(x.wa); else onClose(); } });
  return (
    <Sheet title={r.agenda.schedule} sub={[v.lead?.name, v.preferred && fmt(r.agenda.preferred, { v: v.preferred })].filter(Boolean).join(' · ')} onClose={onClose} center
      footer={wa ? <a className="btn btn-wa justify-center" href={wa} target="_blank" rel="noopener" onClick={onClose}><Icon n="wa" />{r.agenda.confirm}</a>
        : <button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{r.common.save}</button>}>
      {!wa && <>
        <div className="chips">{([[r.common.today, at(0, 18)], [r.common.tomorrow, at(1, 17)], [r.agenda.followIn.d3, at(3, 17)]] as const).map(([t, d]) => <button key={t} className="chip" onClick={() => setWhen(toLocalInput(d))}>{t}</button>)}</div>
        <label className="field">{r.agenda.when}<input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
        {save.error && <p className="error">{err(save.error)}</p>}
      </>}
      {wa && <p className="note"><Icon n="check" />{r.agenda.booked}</p>}
    </Sheet>
  );
}

/** How did it go? Then: follow up tomorrow / in 3 days / in a week (the moment it's most useful). */
export function CompleteSheet({ v, onClose }: { v: Viewing; onClose(): void }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<string>('liked'), [feedback, setFeedback] = useState(''), [step, setStep] = useState<'how' | 'follow'>('how');
  const done = useMutation({ mutationFn: () => api(`/v1/re/viewings/${v.id}`, { method: 'PATCH', body: { status: 'completed', outcome, feedback } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['re-viewings'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); qc.invalidateQueries({ queryKey: ['re-lead'] }); if (v.leadId) setStep('follow'); else onClose(); } });
  const follow = async (days: number) => {
    try { await api('/v1/re/followups', { body: { leadId: v.leadId, propertyId: v.propertyId, kind: outcome === 'no' ? 'send' : 'call', dueAt: at(days, 12), note: outcome === 'no' ? r.fkind.send : r.agenda.how } }); toast(r.agenda.followSaved); qc.invalidateQueries({ queryKey: ['re-followups'] }); onClose(); }
    catch (e) { toast(err(e), 'bad'); }
  };
  return (
    <Sheet title={step === 'how' ? r.agenda.how : r.agenda.followQ} sub={v.lead?.name} onClose={onClose} center
      footer={step === 'how' ? <button className="btn btn-accent justify-center" disabled={done.isPending} onClick={() => done.mutate()}>{r.agenda.done}</button> : <button className="btn btn-secondary justify-center" onClick={onClose}>{r.agenda.noThanks}</button>}>
      {step === 'how' ? <>
        <div className="seg">{(['liked', 'maybe', 'no'] as const).map((o) => <button key={o} aria-pressed={outcome === o} onClick={() => setOutcome(o)}>{r.outcome[o]}</button>)}</div>
        <label className="field">{r.agenda.feedback}<textarea className="input" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} /></label>
        {done.error && <p className="error">{err(done.error)}</p>}
      </> : <div className="grid gap-2">{([['tomorrow', 1], ['d3', 3], ['week', 7]] as const).map(([k, n]) => <button key={k} className="btn btn-secondary justify-center" onClick={() => follow(n)}><Icon n="bell" />{r.agenda.followIn[k]}</button>)}</div>}
    </Sheet>
  );
}

/** Book a viewing: which home, with whom, when. A clash says so (the agent may insist). */
export function ViewingForm({ onClose, property, lead }: { onClose(): void; property?: { id: string; title: string; titleEn?: string | null; ref?: number } | null; lead?: Lead | { id: string; name: string } | null }) {
  const { r, lang, toast, err } = useR();
  const qc = useQueryClient();
  const [p, setP] = useState(property ?? null), [l, setL] = useState(lead ?? null);
  const [when, setWhen] = useState(toLocalInput(at(1, 17))), [minutes, setMinutes] = useState(45), [notes, setNotes] = useState('');
  const [clash, setClash] = useState<string | null>(null), [wa, setWa] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (force: boolean) => api<{ viewing: Viewing; wa: string | null }>('/v1/re/viewings', { body: { propertyId: p!.id, leadId: l?.id, startsAt: fromLocalInput(when), minutes, notes, force } }),
    onSuccess: (x) => { qc.invalidateQueries({ queryKey: ['re-viewings'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); qc.invalidateQueries({ queryKey: ['re-lead'] }); qc.invalidateQueries({ queryKey: ['re-property'] }); toast(r.agenda.booked); if (x.wa) setWa(x.wa); else onClose(); },
    onError: async (e) => { if (e instanceof ApiError && e.code === 'VIEWING_CONFLICT') setClash(when.replace('T', ' ')); else toast(err(e), 'bad'); },
  });
  if (wa) return <Sheet title={r.agenda.booked} onClose={onClose} center footer={<a className="btn btn-wa justify-center" href={wa} target="_blank" rel="noopener" onClick={onClose}><Icon n="wa" />{r.agenda.confirm}</a>}><p className="note"><Icon n="check" />{l?.name}</p></Sheet>;
  return (
    <Sheet title={r.agenda.newViewing} onClose={onClose} footer={<>
      {clash && <p className="note"><Icon n="alert" />{fmt(r.agenda.clash, { when: clash })}</p>}
      <button className="btn btn-accent justify-center" disabled={!p || save.isPending} onClick={() => save.mutate(!!clash)}>{clash ? r.agenda.force : r.agenda.book}</button></>}>
      <div className="field">{r.agenda.property}{p ? <button className="re-item panel" onClick={() => setP(null)}><RIcon n="store" /><span className="flex-1 truncate">{titleOf(p as any, lang)}</span><Icon n="close" /></button> : <PropertyPicker onPick={(x) => setP(x)} />}</div>
      <div className="field">{r.agenda.lead}{l ? <button className="re-item panel" onClick={() => setL(null)}><Avatar name={l.name} /><span className="flex-1 truncate">{l.name}</span><Icon n="close" /></button> : <LeadPicker onPick={(x) => setL(x)} autoFocus={false} />}</div>
      <div className="chips">{([[r.common.today, at(0, 18)], [r.common.tomorrow, at(1, 17)], [r.agenda.followIn.d3, at(3, 17)]] as const).map(([t, d]) => <button key={t} className="chip" onClick={() => { setWhen(toLocalInput(d)); setClash(null); }}>{t}</button>)}</div>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="field">{r.agenda.when}<input className="input" type="datetime-local" value={when} onChange={(e) => { setWhen(e.target.value); setClash(null); }} /></label>
        <label className="field">{r.agenda.minutes}<input className="input" type="number" min={10} max={480} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 45)} /></label>
      </div>
      <label className="field">{r.agenda.notes}<textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></label>
    </Sheet>
  );
}

/** Find a listing as you type (number, title, area). */
export function PropertyPicker({ onPick, live = true }: { onPick(p: Card): void; live?: boolean }) {
  const { r, lang } = useR();
  const [q, setQ] = useState(''), [d, setD] = useState('');
  useEffect(() => { const t = setTimeout(() => setD(q.trim()), 150); return () => clearTimeout(t); }, [q]);
  const found = useQuery({ queryKey: ['re-props', 'pick', d, live], queryFn: async () => (await api(`/v1/re/properties?limit=10${live ? '&status=live' : ''}${d ? `&q=${encodeURIComponent(d)}` : ''}`)).properties as Card[], placeholderData: (x) => x });
  return (
    <div className="grid gap-2">
      <div className="search"><Icon n="search" /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={r.props.search} /></div>
      <div className="panel max-h-72 overflow-y-auto">{(found.data ?? []).map((p) => (
        <button key={p.id} className="re-row-p" onClick={() => onPick(p)}>{p.cover ? <img src={p.cover} alt="" /> : <span className="ph" />}<span className="min-w-0 flex-1"><b className="block truncate font-medium">{titleOf(p, lang)}</b><span className="sub">#{p.ref} · {p.area}</span></span></button>
      ))}{found.data && !found.data.length && <p className="sub p-4">{r.props.none}</p>}</div>
    </div>
  );
}

/** One follow-up: who, why, when; answer on WhatsApp, call, done, or snooze. */
export function FollowRow({ f }: { f: Followup }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const [snooze, setSnooze] = useState(false);
  const patch = async (body: Record<string, unknown>) => {
    try { await api(`/v1/re/followups/${f.id}`, { method: 'PATCH', body }); qc.invalidateQueries({ queryKey: ['re-followups'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); qc.invalidateQueries({ queryKey: ['re-lead'] }); setSnooze(false); if (body.done) toast(r.common.done); }
    catch (e) { toast(err(e), 'bad'); }
  };
  const when = f.when ?? (+new Date(f.dueAt) < Date.now() ? 'overdue' : isToday(f.dueAt) ? 'today' : 'upcoming');
  return (
    <div className="re-item">
      <span className={`bar re-tone-${when}`} />
      <button className="min-w-0 flex-1 text-start" onClick={() => f.lead && go(`#/lead?id=${f.lead.id}`)}>
        <b className="block truncate font-medium">{f.lead?.name ?? f.property?.title ?? ''}</b>
        <span className="sub block truncate">{r.fkind[f.kind]}{f.note ? ` · ${f.note}` : ''}</span>
      </button>
      <span className="acts">
        {f.lead && waLink(f.lead.whatsapp ?? f.lead.phone) && <a className="icon-btn re-icon-wa" href={waLink(f.lead.whatsapp ?? f.lead.phone)!} target="_blank" rel="noopener" aria-label={r.lead.wa}><Icon n="wa" /></a>}
        {f.lead?.phone && <a className="icon-btn" href={telLink(f.lead.phone)!} aria-label={r.lead.call} title={localPhone(f.lead.phone)}><Icon n="phone" /></a>}
        <button className="icon-btn" onClick={() => setSnooze(true)} aria-label={r.agenda.snooze}><Icon n="clock" /></button>
        <button className="icon-btn" onClick={() => patch({ done: true })} aria-label={r.agenda.complete} style={{ color: 'var(--ok)' }}><Icon n="check" /></button>
      </span>
      {snooze && <Sheet title={r.agenda.snooze} sub={f.lead?.name} onClose={() => setSnooze(false)} center>
        <div className="grid gap-2">{([['h3', new Date(Date.now() + 3 * 3600_000).toISOString()], ['tomorrow', at(1, 11)], ['week', at(7, 11)]] as const).map(([k, d]) => <button key={k} className="btn btn-secondary justify-center" onClick={() => patch({ dueAt: d })}>{r.agenda.snoozeTo[k]}</button>)}</div>
      </Sheet>}
    </div>
  );
}

/** A new follow-up for a lead. */
export function FollowupForm({ leadId, propertyId, onClose }: { leadId: string; propertyId?: string | null; onClose(): void }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const [kind, setKind] = useState('call'), [when, setWhen] = useState(toLocalInput(at(1, 11))), [note, setNote] = useState('');
  const save = useMutation({ mutationFn: () => api('/v1/re/followups', { body: { leadId, propertyId, kind, dueAt: fromLocalInput(when), note } }),
    onSuccess: () => { toast(r.agenda.followSaved); qc.invalidateQueries({ queryKey: ['re-followups'] }); qc.invalidateQueries({ queryKey: ['re-lead'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); onClose(); } });
  return (
    <Sheet title={r.agenda.addFollow} onClose={onClose} center footer={<button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{r.common.save}</button>}>
      <div className="chips">{Object.entries(r.fkind).map(([k, t]) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{t}</button>)}</div>
      <div className="chips">{([[r.agenda.snoozeTo.h3, new Date(Date.now() + 3 * 3600_000).toISOString()], [r.common.tomorrow, at(1, 11)], [r.agenda.followIn.d3, at(3, 11)], [r.agenda.followIn.week, at(7, 11)]] as const).map(([t, d]) => <button key={t} className="chip" onClick={() => setWhen(toLocalInput(d))}>{t}</button>)}</div>
      <label className="field">{r.agenda.due}<input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
      <label className="field">{r.agenda.note}<input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
      {save.error && <p className="error">{err(save.error)}</p>}
    </Sheet>
  );
}
