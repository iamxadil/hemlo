// Today, live: the clinic's day as a board. Coming → Waiting → the chairs → Done. Drag a card to move a patient along
// (drop them on a chair to seat them there), or tap the one button each card shows. Timers say how long someone has
// waited or been in the chair; a strip across the top shows the whole day and where "now" is.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { api } from '../lib/api';
import { go } from '../lib/app';
import { Icon, Money } from '../components/ui';
import { useD } from './i18n';
import { useSetup, hhmm, type Appointment, type Chair } from './data';
import { Alerts } from './Patients';
import { AppointmentSheet } from './Schedule';
import { Ring, useCountUp } from './ui';

type Ap = {
  id: string; patient_id: string; starts_at: string; ends_at: string; arrived_at: string | null; seated_at: string | null; finished_at: string | null; reminded_at: string | null;
  status: string; reason: string | null; dentist_id: string | null; chair_id: string | null; name: string; file_no: number; alerts: string[]; phone: string | null; balance: number;
};
type Stage = 'coming' | 'waiting' | 'chairs' | 'done';
const STAGES: Stage[] = ['coming', 'waiting', 'chairs', 'done'];
const stageOf = (s: string): Stage => (s === 'booked' || s === 'confirmed' ? 'coming' : s === 'arrived' ? 'waiting' : s === 'seated' ? 'chairs' : 'done');
const KEY = ['dent-dashboard'];

/** Re-render every 30 seconds, so timers tick. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  return now;
}
/** Animate a change of the board (cards glide to their new place) where the browser can. */
function glide(fn: () => void) {
  const doc = document as any;
  if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(() => flushSync(fn));
  else fn();
}
const narrow = () => matchMedia('(max-width: 699px)').matches;

export function Today() {
  const { d, num, toast, err, can } = useD();
  const qc = useQueryClient();
  const setup = useSetup();
  const now = useNow();
  const dash = useQuery({ queryKey: KEY, queryFn: () => api('/v1/dent/dashboard'), refetchInterval: 30_000 });
  const [edit, setEdit] = useState<Appointment | null>(null);
  const [booking, setBooking] = useState(false);
  const [dragging, setDragging] = useState<Ap | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('coming');
  const lanes = useRef<HTMLDivElement>(null);
  const x = dash.data;
  const chairs: Chair[] = (setup.data?.chairs ?? []).filter((c) => !c.archivedAt);
  const dentists = setup.data?.dentists ?? [];
  const manage = can('appointments.manage');

  type Move = { id: string; patch: Record<string, any>; animate?: boolean };
  const move = useMutation<unknown, unknown, Move, { prev: unknown }>({
    mutationFn: ({ id, patch }) => api(`/v1/dent/appointments/${id}`, { method: 'PATCH', body: patch }),
    onMutate: async ({ id, patch, animate }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData(KEY);
      const stamp = new Date().toISOString();
      const apply = () => qc.setQueryData(KEY, (old: any) => old && ({ ...old, today: old.today.map((a: Ap) => a.id !== id ? a : {
        ...a, status: patch.status ?? a.status, chair_id: patch.chairId !== undefined ? patch.chairId : a.chair_id,
        arrived_at: patch.status === 'arrived' && !a.arrived_at ? stamp : a.arrived_at, seated_at: patch.status === 'seated' && !a.seated_at ? stamp : a.seated_at,
      }) }));
      if (animate) glide(apply); else apply();
      return { prev };
    },
    onError: (e, _v, c) => { qc.setQueryData(KEY, c?.prev); toast(err(e), 'bad'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ['dent-appts'] }); },
  });
  const step = (a: Ap, patch: Record<string, unknown>, animate = true) => move.mutate({ id: a.id, patch, animate });

  const occupant = (chairId: string, list: Ap[]) => list.find((a) => a.status === 'seated' && a.chair_id === chairId);
  const seat = (a: Ap, chairId: string | null, animate = true) => {
    const list: Ap[] = x?.today ?? [];
    if (chairId) {
      const who = occupant(chairId, list);
      if (who && who.id !== a.id) return toast(d.board.taken.replace('{chair}', chairs.find((c) => c.id === chairId)?.name ?? ''), 'bad');
    }
    step(a, { status: 'seated', chairId, force: true }, animate);
  };

  // drag and drop: mouse at once, a long press on touch screens (phones use the buttons)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const onDragStart = (e: DragStartEvent) => setDragging((x?.today ?? []).find((a: Ap) => a.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const a = dragging; setDragging(null);
    if (!a || !e.over) return;
    const to = String(e.over.id);
    if (to.startsWith('nochair:')) return;
    if (to.startsWith('chair:')) { const id = to.slice(6) || null; if (a.status !== 'seated' || a.chair_id !== id) seat(a, id, false); return; }
    const target = to as Stage;
    if (target === stageOf(a.status)) return;
    step(a, { status: target === 'coming' ? 'confirmed' : target === 'waiting' ? 'arrived' : 'done' }, false);
  };

  // phones: one stage at a time, swipe or tap the stage bar
  const showStage = (s: Stage) => { setStage(s); lanes.current?.querySelector(`[data-stage="${s}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); };
  useEffect(() => {
    const el = lanes.current; if (!el) return;
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && e.intersectionRatio > 0.6 && narrow()) setStage((e.target as HTMLElement).dataset.stage as Stage); }, { root: el, threshold: [0.6] });
    el.querySelectorAll('[data-stage]').forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [x]);
  const spotlight = (id: string) => {
    const a = (x?.today ?? []).find((y: Ap) => y.id === id); if (!a) return;
    if (narrow()) showStage(stageOf(a.status));
    setTimeout(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), narrow() ? 250 : 0);
    setFlash(id); setTimeout(() => setFlash(null), 1400);
  };

  if (!x || !setup.data) return <div className="grid gap-4"><div className="skeleton h-20" /><div className="skeleton h-14" /><div className="grid gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-72" />)}</div></div>;
  const all: Ap[] = x.today;
  const by = (s: Stage) => all.filter((a) => stageOf(a.status) === s).sort((p, q) => (s === 'done' ? +new Date(q.finished_at ?? q.starts_at) - +new Date(p.finished_at ?? p.starts_at) : +new Date(p.starts_at) - +new Date(q.starts_at)));
  const counts = Object.fromEntries(STAGES.map((s) => [s, by(s).length])) as Record<Stage, number>;
  const card = (a: Ap, overlay = false) => (
    <ApptCard key={a.id} a={a} now={now} overlay={overlay} flash={flash === a.id} chairs={chairs} dentist={dentists.find((y) => y.id === a.dentist_id)}
      free={chairs.filter((c) => !occupant(c.id, all))} onStep={(p) => step(a, p)} onSeat={(c) => seat(a, c)} onEdit={() => setEdit(toAppointment(a))} />
  );

  return (
    <div className="today">
      <Glance all={all} counts={counts} x={x} chairs={chairs} dentists={dentists} now={now} manage={manage} money={can('reports.read') || can('sales.read')}
        onArrive={(a) => step(a, { status: 'arrived' })} onPick={spotlight} />
      {all.length > 0 && <DayStrip appts={all} now={now} dentists={dentists} hours={setup.data.settings.hours} onPick={spotlight} />}

      {!all.length ? (
        <div className="t-quiet"><span className="t-quiet-ic"><Icon n="sparkle" /></span><p>{d.board.quiet}</p>
          {manage && <button className="btn btn-accent" onClick={() => setBooking(true)}><Icon n="calendar" className="h-4 w-4" />{d.today.newAppt}</button>}</div>
      ) : (
        <DndContext sensors={manage && !narrow() ? sensors : undefined} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="t-stages" role="tablist">
            {STAGES.map((s) => <button key={s} role="tab" aria-selected={stage === s} className={`t-stage s-${s}`} onClick={() => showStage(s)}>{d.board[s]}<b>{num(counts[s])}</b></button>)}
          </div>
          <div className={`t-board${dragging ? ' is-dragging' : ''}`} ref={lanes}>
            <Lane stage="coming" title={d.board.coming} count={counts.coming} empty={d.board.emptyComing} drag={dragging}>{by('coming').map((a) => card(a))}</Lane>
            <Lane stage="waiting" title={d.board.waiting} count={counts.waiting} empty={d.board.emptyWaiting} drag={dragging}>{by('waiting').map((a) => card(a))}</Lane>
            <section className="t-lane t-chairs" data-stage="chairs">
              <header><span className="t-dot s-chairs" />{d.board.chairs}<b>{num(counts.chairs)}</b></header>
              <div className="t-chair-list">
                {chairs.map((c) => { const a = occupant(c.id, all); return <ChairSlot key={c.id} id={c.id} name={c.name} busy={!!a} drag={dragging} now={now}>{a && card(a)}</ChairSlot>; })}
                {by('chairs').filter((a) => !a.chair_id || !chairs.some((c) => c.id === a.chair_id)).map((a) => <ChairSlot key={a.id} id="" dropId={`nochair:${a.id}`} name={d.board.noChair} busy drag={dragging} now={now}>{card(a)}</ChairSlot>)}
              </div>
            </section>
            <Lane stage="done" title={d.board.done} count={counts.done} empty={d.board.emptyDone} drag={dragging}>{by('done').map((a) => card(a))}</Lane>
          </div>
          {manage && <p className="t-hint"><Icon n="grip" className="h-4 w-4" />{d.board.hint}</p>}
          <DragOverlay dropAnimation={null}>{dragging && card(dragging, true)}</DragOverlay>
        </DndContext>
      )}
      {edit && <AppointmentSheet appt={edit} onClose={() => { setEdit(null); qc.invalidateQueries({ queryKey: KEY }); }} />}
      {booking && <AppointmentSheet onClose={() => { setBooking(false); qc.invalidateQueries({ queryKey: KEY }); }} />}
    </div>
  );
}

function Lane({ stage, title, count, empty, drag, children }: { stage: Stage; title: string; count: number; empty: string; drag: Ap | null; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const { d } = useD();
  const target = !!drag && stageOf(drag.status) !== stage;
  return (
    <section ref={setNodeRef} className={`t-lane${isOver && target ? ' over' : ''}${target ? ' target' : ''}`} data-stage={stage}>
      <header><span className={`t-dot s-${stage}`} />{title}<b>{count}</b></header>
      <div className="t-cards">{count ? children : <p className="t-empty">{target ? d.board.drop : empty}</p>}</div>
    </section>
  );
}

function ChairSlot({ id, dropId, name, busy, drag, now, children }: { id: string; dropId?: string; name: string; busy: boolean; drag: Ap | null; now: number; children?: ReactNode }) {
  const { d } = useD();
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? `chair:${id}`, disabled: !!dropId || busy && !!drag && !(drag.status === 'seated' && drag.chair_id === id) });
  void now;
  return (
    <div ref={setNodeRef} className={`t-chair${busy ? ' busy' : ''}${isOver ? (busy ? ' deny' : ' over') : ''}${drag && !busy ? ' target' : ''}`}>
      <p className="t-chair-name"><Icon n="chair" className="h-4 w-4" />{name}{!busy && <span className="t-free">{d.board.free}</span>}</p>
      {busy ? children : <p className="t-empty">{drag ? d.board.drop : d.board.dropChair}</p>}
    </div>
  );
}

/** One patient on the board: when, who (with their alerts), what for, how long, and the one next step. */
function ApptCard({ a, now, overlay, flash, chairs, free, dentist, onStep, onSeat, onEdit }: {
  a: Ap; now: number; overlay: boolean; flash: boolean; chairs: Chair[]; free: Chair[]; dentist?: { name: string; color: string };
  onStep(p: Record<string, unknown>): void; onSeat(chairId: string | null): void; onEdit(): void;
}) {
  const { d, can, toast, err, lang } = useD();
  const manage = can('appointments.manage');
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: a.id, disabled: !manage || overlay || a.status === 'no_show' });
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState(false);
  const s = stageOf(a.status);
  const mins = (from: string | null) => (from ? Math.max(0, Math.round((now - +new Date(from)) / 60_000)) : 0);
  const fmt = (m: number) => (m < 60 ? d.board.min.replace('{n}', String(m)) : d.board.hr.replace('{h}', String(Math.floor(m / 60))).replace('{m}', String(m % 60)));
  const planned = Math.round((+new Date(a.ends_at) - +new Date(a.starts_at)) / 60_000);
  const late = s === 'coming' && now - +new Date(a.starts_at) > 5 * 60_000 ? mins(a.starts_at) : 0;
  const inChair = s === 'chairs' ? mins(a.seated_at) : 0;
  const remind = async () => {
    setMenu(false);
    try { const r = await api(`/v1/dent/appointments/${a.id}/remind`, { body: { lang } }); if (r.whatsappUrl) window.open(r.whatsappUrl, '_blank'); } catch (e) { toast(err(e), 'bad'); }
  };
  const openFile = () => go(`#/patient?id=${a.patient_id}`);
  const visit = () => go(`#/patient?id=${a.patient_id}&tab=visits&visit=new&appt=${a.id}`);
  const seatNext = () => { if (free.length === 1) onSeat(free[0].id); else if (free.length > 1) setPick(true); else onSeat(null); };
  const primary: [string, string, () => void] | null =
    s === 'coming' && manage ? [d.board.arrived, 'door', () => onStep({ status: 'arrived' })]
    : s === 'waiting' && manage ? [d.board.seat, 'chair', seatNext]
    : s === 'chairs' && can('clinical.write') ? [d.board.visit, 'tooth', visit]
    : null;
  const items: [string, string, () => void][] = [
    ...(s === 'coming' && a.status === 'booked' && manage ? [[d.board.confirm, 'check', () => onStep({ status: 'confirmed' })] as [string, string, () => void]] : []),
    ...(s === 'coming' && a.phone && manage ? [[d.board.remind, 'wa', remind] as [string, string, () => void]] : []),
    ...(s === 'chairs' && manage ? [[d.board.finish, 'check', () => onStep({ status: 'done' })] as [string, string, () => void]] : []),
    ...(s !== 'coming' && s !== 'done' && manage ? [[d.board.back, 'undo', () => onStep({ status: s === 'waiting' ? 'confirmed' : 'arrived' })] as [string, string, () => void]] : []),
    ...(s === 'coming' && manage ? [[d.board.noShow, 'close', () => onStep({ status: 'no_show' })] as [string, string, () => void]] : []),
    ...(manage && s !== 'done' ? [[d.board.edit, 'edit', onEdit] as [string, string, () => void]] : []),
    [d.board.open, 'user', openFile],
  ];
  return (
    <article id={overlay ? undefined : `card-${a.id}`} ref={overlay ? undefined : setNodeRef}
      className={`t-card s-${s} st-${a.status}${isDragging ? ' ghost' : ''}${overlay ? ' lifted' : ''}${flash ? ' flash' : ''}${late ? ' is-late' : ''}`}
      style={{ ['--dc' as any]: dentist?.color ?? 'var(--line-strong)', viewTransitionName: overlay ? undefined : `ap-${a.id.replace(/[^a-zA-Z0-9_-]/g, '')}` }}
      {...(overlay ? {} : attributes)} {...(overlay ? {} : listeners)}>
      <div className="t-card-top">
        <b className="t-time" dir="ltr">{hhmm(a.starts_at)}</b>
        {late > 0 && <span className="t-tag warn"><Icon n="clock" />{d.board.late.replace('{m}', fmt(late))}</span>}
        {s === 'waiting' && <span className="t-tag"><Icon n="clock" />{d.board.waitFor.replace('{m}', fmt(mins(a.arrived_at)))}</span>}
        {s === 'chairs' && <span className={`t-tag${inChair > planned ? ' warn' : ''}`}><Icon n="clock" />{inChair > planned ? d.board.over.replace('{m}', fmt(inChair - planned)) : d.board.inFor.replace('{m}', fmt(inChair))}</span>}
        {a.status === 'no_show' && <span className="t-tag bad">{d.status.no_show}</span>}
        <span className="flex-1" />
        {primary && s === 'coming' && !overlay && <button className="t-go-mini" onClick={(e) => { e.stopPropagation(); primary[2](); }} onPointerDown={(e) => e.stopPropagation()}><Icon n={primary[1]} />{primary[0]}</button>}
        {!overlay && <button className="t-more" onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }} onPointerDown={(e) => e.stopPropagation()} aria-label={d.board.actions} aria-expanded={menu}><Icon n="more" /></button>}
      </div>
      <button className="t-who" onClick={openFile} onPointerDown={(e) => e.stopPropagation()}>
        <b className="truncate">{a.name}</b>
        {a.alerts?.length > 0 && <Alerts list={a.alerts} small />}
      </button>
      <p className="t-what truncate">{[a.reason, dentist?.name].filter(Boolean).join(' · ') || ' '}</p>
      {s === 'chairs' && <span className="t-bar"><i style={{ width: `${Math.min(100, (inChair / Math.max(planned, 5)) * 100)}%` }} /></span>}
      {primary && !overlay && s !== 'coming' && (
        <button className={`t-go go-${s}`} onClick={(e) => { e.stopPropagation(); primary[2](); }} onPointerDown={(e) => e.stopPropagation()}>
          <Icon n={primary[1]} />{primary[0]}<Icon n="arrow" className="t-go-arrow" />
        </button>
      )}
      {pick && (
        <div className="t-pop" onPointerDown={(e) => e.stopPropagation()}>
          <p>{d.board.pickChair}</p>
          {free.map((c) => <button key={c.id} onClick={() => { setPick(false); onSeat(c.id); }}><Icon n="chair" />{c.name}</button>)}
          <button className="muted" onClick={() => setPick(false)}>{d.common.cancel}</button>
        </div>
      )}
      {menu && (
        <>
          <div className="t-pop-scrim" onClick={() => setMenu(false)} onPointerDown={(e) => e.stopPropagation()} />
          <div className="t-pop t-menu" onPointerDown={(e) => e.stopPropagation()}>
            {items.map(([text, icon, run]) => <button key={text} onClick={() => { setMenu(false); run(); }}><Icon n={icon} />{text}</button>)}
          </div>
        </>
      )}
      <span hidden>{chairs.length}</span>
    </article>
  );
}

/** The whole day on one line: every appointment where it sits in the clinic's hours, and a moving "now". */
function DayStrip({ appts, now, dentists, hours, onPick }: { appts: Ap[]; now: number; dentists: { id: string; color: string; name: string }[]; hours: Record<string, [string, string] | null> | null; onPick(id: string): void }) {
  const { d } = useD();
  const toMin = (iso: string | number) => { const [h, m] = hhmm(new Date(iso)).split(':').map(Number); return h * 60 + m; };
  const dow = String(new Date(now + 3 * 3600_000).getUTCDay());
  const open = hours?.[dow];
  const [h0, h1] = open ? open.map((v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; }) : [9 * 60, 21 * 60];
  const start = Math.floor(Math.min(h0, ...appts.map((a) => toMin(a.starts_at))) / 60) * 60;
  const end = Math.ceil(Math.max(h1, ...appts.map((a) => toMin(a.ends_at))) / 60) * 60;
  const span = Math.max(60, end - start);
  const pct = (m: number) => `${((m - start) / span) * 100}%`;
  const nowMin = toMin(now);
  // two lanes, so overlapping appointments (two chairs) stay visible
  const laneEnd = [0, 0];
  const placed = [...appts].sort((p, q) => +new Date(p.starts_at) - +new Date(q.starts_at)).map((a) => {
    const s = toMin(a.starts_at), e = Math.max(s + 10, toMin(a.ends_at));
    const lane = laneEnd[0] <= s ? 0 : laneEnd[1] <= s ? 1 : laneEnd[0] <= laneEnd[1] ? 0 : 1;
    laneEnd[lane] = e;
    return { a, s, e, lane };
  });
  const hoursList = Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => start + i * 60);
  return (
    <div className="t-strip" dir="ltr">
      <div className="t-strip-track">
        {hoursList.map((m) => <span key={m} className="t-hour" style={{ left: pct(m) }}>{String(Math.floor(m / 60)).padStart(2, '0')}</span>)}
        {placed.map(({ a, s, e, lane }) => {
          const dn = dentists.find((y) => y.id === a.dentist_id);
          return <button key={a.id} className={`t-seg s-${stageOf(a.status)} st-${a.status}`} style={{ left: pct(s), width: `calc(${((e - s) / span) * 100}% - 2px)`, top: lane ? '52%' : '14%', ['--dc' as any]: dn?.color ?? 'var(--accent)' }}
            title={`${hhmm(a.starts_at)} · ${a.name}${dn ? ` · ${dn.name}` : ''}`} onClick={() => onPick(a.id)} aria-label={`${hhmm(a.starts_at)} ${a.name}`}><span dir="auto">{a.name.split(/\s+/)[0]}</span></button>;
        })}
        {nowMin >= start && nowMin <= end && <span className="t-now" style={{ left: pct(nowMin) }}><em>{d.board.now}</em></span>}
      </div>
    </div>
  );
}

const toAppointment = (a: Ap): Appointment => ({
  id: a.id, patientId: a.patient_id, dentistId: a.dentist_id, chairId: a.chair_id, startsAt: a.starts_at, endsAt: a.ends_at, status: a.status, reason: a.reason, note: null,
  remindedAt: a.reminded_at, arrivedAt: a.arrived_at, patient: { id: a.patient_id, fileNo: a.file_no, alerts: a.alerts ?? [], name: a.name, phone: a.phone, balance: a.balance },
});

/** The day at a glance: a ring of who's been seen, who's next (with a countdown), what came in, each chair live,
 *  and what needs you. Calm cards, numbers that count up, nothing you have to read twice. */
function Glance({ all, counts, x, chairs, dentists, now, manage, money, onArrive, onPick }: {
  all: Ap[]; counts: Record<Stage, number>; x: any; chairs: Chair[]; dentists: { id: string; name: string; color: string }[]; now: number; manage: boolean; money: boolean;
  onArrive(a: Ap): void; onPick(id: string): void;
}) {
  const { d, num } = useD();
  const live = all.filter((a) => a.status !== 'no_show' && a.status !== 'canceled');
  const done = useCountUp(counts.done);
  const collected = useCountUp(x.collected ?? 0, 1100);
  const fmt = (m: number) => (m < 60 ? d.board.min.replace('{n}', String(m)) : d.board.hr.replace('{h}', String(Math.floor(m / 60))).replace('{m}', String(m % 60)));
  const next = all.filter((a) => a.status === 'booked' || a.status === 'confirmed').sort((p, q) => +new Date(p.starts_at) - +new Date(q.starts_at))[0];
  const nextMin = next ? Math.round((+new Date(next.starts_at) - now) / 60_000) : 0;
  const nd = next && dentists.find((y) => y.id === next.dentist_id);
  const attention = [
    x.lab.ready && { href: '#/lab', icon: 'flask', text: d.today.labReady, n: x.lab.ready, kind: 'ok' },
    x.lab.overdue && { href: '#/lab', icon: 'alert', text: d.today.labOverdue, n: x.lab.overdue, kind: 'bad' },
    x.installments.due && { href: '#/patients?tab=installments', icon: 'wallet', text: d.today.installments, n: x.installments.due, kind: 'warn' },
    x.recalls && { href: '#/patients?tab=recalls', icon: 'bell', text: d.today.recalls, n: x.recalls, kind: '' },
  ].filter(Boolean) as { href: string; icon: string; text: string; n: number; kind: string }[];
  return (
    <section className="glance">
      <article className="g-card g-day">
        <Ring total={Math.max(1, live.length)} parts={[{ value: counts.done, className: 'r-done' }, { value: counts.chairs, className: 'r-chair' }, { value: counts.waiting, className: 'r-wait' }]}>
          <b className="g-big">{num(done)}<small>/{num(live.length)}</small></b>
          <span className="g-cap">{d.board.done}</span>
        </Ring>
        <ul className="g-legend">
          {(['coming', 'waiting', 'chairs', 'done'] as const).map((s) => <li key={s}><i className={`g-dot s-${s}`} /><span>{d.board[s]}</span><b>{num(counts[s])}</b></li>)}
        </ul>
      </article>

      <article className="g-card g-next">
        <p className="g-label">{d.board.nextUp}</p>
        {next ? (
          <>
            <div className="g-next-when">
              <b className="g-time" dir="ltr">{hhmm(next.starts_at)}</b>
              <span className={`g-count${nextMin < 0 ? ' late' : ''}`}>{nextMin >= 0 ? d.board.startsIn.replace('{m}', fmt(nextMin)) : d.board.late.replace('{m}', fmt(-nextMin))}</span>
            </div>
            <button className="g-next-who" onClick={() => onPick(next.id)}>
              <b className="truncate">{next.name}</b>
              {next.alerts?.length > 0 && <Alerts list={next.alerts} small />}
            </button>
            <p className="g-sub truncate">{[next.reason, nd?.name].filter(Boolean).join(' · ') || ' '}</p>
            {manage && <button className="g-action" onClick={() => onArrive(next)}><Icon n="door" />{d.board.arrived}</button>}
          </>
        ) : <p className="g-empty"><Icon n="check" />{d.board.noneNext}</p>}
      </article>

      {money ? (
        <article className="g-card g-money">
          <p className="g-label">{d.board.collected}</p>
          <b className="g-money-n"><span>{num(collected)}</span><small>{d.common.iqd}</small></b>
          <div className="g-money-row">
            <div><span>{d.board.workDone}</span><b>{num(x.billed ?? 0)}</b></div>
            <a href="#/customers"><span>{d.board.owe}</span><b className="warn">{num(x.outstanding ?? 0)}</b></a>
            <div><span>{d.board.newP}</span><b>{num(x.newPatients ?? 0)}</b></div>
          </div>
        </article>
      ) : null}

      <article className="g-card g-chairs">
        <p className="g-label">{d.board.chairs}</p>
        <ul className="g-chair-list">
          {chairs.map((c) => {
            const a = all.find((y) => y.status === 'seated' && y.chair_id === c.id);
            const dn = a && dentists.find((y) => y.id === a.dentist_id);
            const m = a?.seated_at ? Math.max(0, Math.round((now - +new Date(a.seated_at)) / 60_000)) : 0;
            const planned = a ? Math.max(5, Math.round((+new Date(a.ends_at) - +new Date(a.starts_at)) / 60_000)) : 1;
            return (
              <li key={c.id} className={a ? 'busy' : 'free'}>
                <span className="g-chair-ic"><Icon n="chair" /></span>
                <span className="min-w-0 flex-1">
                  <span className="g-chair-name">{c.name}</span>
                  {a ? <button className="g-chair-who truncate" onClick={() => onPick(a.id)}>{a.name}{dn ? <small> · {dn.name}</small> : null}</button> : <span className="g-free">{d.board.free}</span>}
                  {a && <span className="g-bar"><i style={{ width: `${Math.min(100, (m / planned) * 100)}%` }} className={m > planned ? 'over' : ''} /></span>}
                </span>
                {a && <span className={`g-timer${m > planned ? ' over' : ''}`}><i className="g-pulse" />{fmt(m)}</span>}
              </li>
            );
          })}
        </ul>
      </article>

      <article className="g-card g-attn">
        <p className="g-label">{d.board.attention}</p>
        {attention.length ? (
          <ul className="g-attn-list">
            {attention.map((y) => <li key={y.text}><a href={y.href} className={`k-${y.kind}`}><span className="g-attn-ic"><Icon n={y.icon} /></span><span className="flex-1">{y.text}</span><b>{num(y.n)}</b><Icon n="arrow" className="g-chev" /></a></li>)}
          </ul>
        ) : <p className="g-empty"><Icon n="check" />{d.board.allClear}</p>}
      </article>
    </section>
  );
}
