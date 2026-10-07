// The schedule: a day per chair (or per dentist), tap an empty time to book, tap an appointment to move it along the day.
// A week view for planning. No double-booking unless deliberately forced.
import { locale } from '../lib/i18n';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet } from '../components/ui';
import { useD } from './i18n';
import { useSetup, dayBounds, todayISO, addDays, hhmm, type Appointment, type PatientCard } from './data';
import { PatientPicker, Alerts } from './Patients';

const PX = 1.6; // pixels per minute
const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const minOfDay = (iso: string) => toMin(hhmm(iso));

export function useAppointments(from: Date, to: Date) {
  return useQuery({ queryKey: ['dent-appts', +from, +to], queryFn: async () => (await api(`/v1/dent/appointments?from=${from.toISOString()}&to=${to.toISOString()}`)).appointments as Appointment[], refetchInterval: 30_000 });
}

export function Schedule() {
  const { d, lang, can } = useD();
  const { params } = useRoute();
  const setup = useSetup();
  const [date, setDate] = useState(params.get('date') ?? todayISO());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [by, setBy] = useState<'chair' | 'dentist'>('chair');
  const [open, setOpen] = useState<{ appt?: Appointment; at?: string; chairId?: string | null; dentistId?: string | null } | null>(null);
  const weekStart = addDays(date, -new Date(`${date}T12:00:00Z`).getUTCDay()); // Sunday
  const range = view === 'day' ? dayBounds(date) : { from: dayBounds(weekStart).from, to: dayBounds(addDays(weekStart, 7)).from };
  const appts = useAppointments(range.from, range.to);
  const s = setup.data;
  const dow = String(new Date(`${date}T12:00:00Z`).getUTCDay());
  const hours = s?.settings.hours?.[dow] ?? (s?.settings.hours ? null : ['09:00', '21:00']);
  const dayName = (iso: string) => d.clinic.days[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  const label = lang === 'ckb' ? `${dayName(date)} ${date.slice(8, 10)}/${date.slice(5, 7)}` : new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00Z`));

  const columns = useMemo(() => {
    if (!s) return [];
    const list = (appts.data ?? []).filter((a) => a.status !== 'canceled');
    if (by === 'dentist') {
      const cols = s.dentists.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name, color: x.color }));
      if (list.some((a) => !a.dentistId)) cols.push({ id: '', name: '—', color: '#999' });
      return cols;
    }
    const cols = s.chairs.filter((c) => !c.archivedAt).map((c) => ({ id: c.id, name: c.name, color: '' }));
    if (list.some((a) => !a.chairId)) cols.push({ id: '', name: d.schedule.noChair, color: '' });
    return cols;
  }, [s, appts.data, by, d]);

  // the opening hours, stretched to fit anything booked outside them
  const booked = view === 'day' ? (appts.data ?? []).filter((a) => a.status !== 'canceled') : [];
  const start = Math.floor(Math.min(hours ? toMin(hours[0]) : 9 * 60, ...booked.map((a) => minOfDay(a.startsAt))) / 60) * 60;
  const end = Math.min(24 * 60, Math.ceil(Math.max(hours ? toMin(hours[1]) : 21 * 60, ...booked.map((a) => Math.max(minOfDay(a.endsAt), minOfDay(a.startsAt) + 15))) / 60) * 60);
  const slot = s?.settings.slotMinutes ?? 15;
  const colOf = (a: Appointment) => (by === 'chair' ? a.chairId ?? '' : a.dentistId ?? '');
  const dentistColor = (id: string | null) => s?.dentists.find((x) => x.id === id)?.color ?? 'var(--accent)';
  const clickEmpty = (e: React.MouseEvent<HTMLDivElement>, colId: string) => {
    if (!can('appointments.manage')) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const m = start + Math.floor(y / PX / slot) * slot;
    const at = `${date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00+03:00`;
    setOpen({ at, chairId: by === 'chair' ? colId || null : null, dentistId: by === 'dentist' ? colId || null : null });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button className="icon-btn" aria-label="‹" onClick={() => setDate(addDays(date, view === 'day' ? -1 : -7))}><Icon n="back" className="ltr:rotate-0 rtl:rotate-180" /></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setDate(todayISO())}>{d.schedule.todayBtn}</button>
          <button className="icon-btn" aria-label="›" onClick={() => setDate(addDays(date, view === 'day' ? 1 : 7))}><Icon n="back" className="rotate-180 rtl:rotate-0" /></button>
        </div>
        <input type="date" className="input !w-auto" dir="ltr" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <b className="me-auto text-lg font-semibold">{view === 'day' ? label : ''}</b>
        <div className="seg !w-auto">{(['day', 'week'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{d.schedule[v]}</button>)}</div>
        {view === 'day' && <div className="seg !w-auto">{(['chair', 'dentist'] as const).map((v) => <button key={v} aria-pressed={by === v} onClick={() => setBy(v)}>{v === 'chair' ? d.schedule.byChair : d.schedule.byDentist}</button>)}</div>}
        {can('appointments.manage') && <button className="btn btn-accent btn-sm" onClick={() => setOpen({ at: `${date}T${hhmm(new Date(Math.ceil(Date.now() / (slot * 60_000)) * slot * 60_000))}:00+03:00` })}><Icon n="plus" className="h-4 w-4" />{d.schedule.new}</button>}
      </div>

      {view === 'day' ? (!hours && !(appts.data ?? []).length ? <div className="panel p-8 text-center muted">{d.schedule.closed}</div> : (
        <div className="panel day-grid overflow-x-auto" dir="ltr">
          <div className="day-cols" style={{ gridTemplateColumns: `3.2rem repeat(${Math.max(1, columns.length)}, minmax(9rem, 1fr))` }}>
            <div />
            {columns.map((c) => <div key={c.id} className="day-head">{c.color && <i style={{ background: c.color }} />}{c.name}</div>)}
            <div className="day-times" style={{ height: (end - start) * PX }}>
              {Array.from({ length: Math.floor((end - start) / 60) + 1 }, (_, i) => <span key={i} style={{ top: i * 60 * PX }}>{String(Math.floor(start / 60) + i).padStart(2, '0')}:00</span>)}
            </div>
            {columns.map((c) => (
              <div key={c.id} className="day-col" style={{ height: (end - start) * PX, backgroundSize: `100% ${slot * PX}px` }} onClick={(e) => clickEmpty(e, c.id)}>
                {(appts.data ?? []).filter((a) => a.status !== 'canceled' && colOf(a) === c.id).map((a) => {
                  const top = (minOfDay(a.startsAt) - start) * PX, h = Math.max(22, (minOfDay(a.endsAt) - minOfDay(a.startsAt)) * PX - 2);
                  return (
                    <button key={a.id} className={`appt st-${a.status}${h < 40 ? ' tiny' : h < 64 ? ' short' : ''}`} style={{ top, height: h, borderInlineStartColor: dentistColor(a.dentistId) }} dir="auto"
                      onClick={(e) => { e.stopPropagation(); setOpen({ appt: a }); }}>
                      <b className="truncate">{a.patient?.name}{a.patient?.alerts?.length ? ' ⚠' : ''}</b>
                      <span className="truncate">{hhmm(a.startsAt)} · {a.reason ?? d.status[a.status]}</span>
                      <em>{d.status[a.status]}</em>
                    </button>
                  );
                })}
                {date === todayISO() && <div className="now-line" style={{ top: (minOfDay(new Date().toISOString()) - start) * PX }} />}
              </div>
            ))}
          </div>
        </div>
      )) : (
        <div className="week-grid">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
            const list = (appts.data ?? []).filter((a) => a.startsAt && new Date(a.startsAt).toISOString() >= dayBounds(day).from.toISOString() && new Date(a.startsAt) < dayBounds(day).to && a.status !== 'canceled');
            return (
              <div key={day} className={`panel week-day${day === todayISO() ? ' today' : ''}`}>
                <button className="week-head" onClick={() => { setDate(day); setView('day'); }}>
                  {lang === 'ckb' ? `${dayName(day)} ${Number(day.slice(8, 10))}` : new Intl.DateTimeFormat(locale(lang), { weekday: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`))}<span className="sub">{list.length || ''}</span>
                </button>
                {list.map((a) => <button key={a.id} className={`week-item st-${a.status}`} style={{ borderInlineStartColor: dentistColor(a.dentistId) }} onClick={() => setOpen({ appt: a })}>
                  <span dir="ltr" className="sub">{hhmm(a.startsAt)}</span> <span className="truncate">{a.patient?.name}</span></button>)}
              </div>
            );
          })}
        </div>
      )}
      {open && <AppointmentSheet {...open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Book or change an appointment, and move it through the day. */
export function AppointmentSheet({ appt, at, chairId, dentistId, patient, onClose }: { appt?: Appointment; at?: string; chairId?: string | null; dentistId?: string | null; patient?: PatientCard; onClose(): void }) {
  const { d, toast, err, date: fmtDate, can, lang } = useD();
  const qc = useQueryClient();
  const setup = useSetup();
  const s = setup.data;
  const [who, setWho] = useState<PatientCard | null>(patient ?? null);
  const startIso = appt?.startsAt ?? at ?? new Date().toISOString();
  const [f, setF] = useState({
    date: new Date(+new Date(startIso) + 3 * 3600_000).toISOString().slice(0, 10), time: hhmm(startIso),
    minutes: appt ? Math.round((+new Date(appt.endsAt) - +new Date(appt.startsAt)) / 60_000) : 30,
    dentistId: appt?.dentistId ?? dentistId ?? s?.dentists.find((x) => x.active)?.id ?? '', chairId: appt?.chairId ?? chairId ?? '', reason: appt?.reason ?? '', note: appt?.note ?? '',
  });
  const [clash, setClash] = useState(false);
  const set = (k: string, v: any) => { setF((x) => ({ ...x, [k]: v })); setClash(false); };
  const refresh = () => { qc.invalidateQueries({ queryKey: ['dent-appts'] }); qc.invalidateQueries({ queryKey: ['dent-dashboard'] }); qc.invalidateQueries({ queryKey: ['dent-queue'] }); };
  const save = useMutation({
    mutationFn: (force: boolean) => {
      const body = { startsAt: `${f.date}T${f.time}:00+03:00`, minutes: f.minutes, endsAt: new Date(+new Date(`${f.date}T${f.time}:00+03:00`) + f.minutes * 60_000).toISOString(),
        dentistId: f.dentistId || null, chairId: f.chairId || null, reason: f.reason || null, note: f.note || null, force };
      return appt ? api(`/v1/dent/appointments/${appt.id}`, { method: 'PATCH', body }) : api('/v1/dent/appointments', { body: { ...body, patientId: who!.id } });
    },
    onSuccess: () => { refresh(); toast(d.schedule.saved); onClose(); },
    onError: (e) => { if (e instanceof ApiError && e.code === 'SLOT_TAKEN') setClash(true); else toast(err(e), 'bad'); },
  });
  const step = useMutation({
    mutationFn: (status: string) => api(`/v1/dent/appointments/${appt!.id}`, { method: 'PATCH', body: { status } }),
    onSuccess: (_r, status) => { refresh(); toast(d.status[status]); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const remind = async () => {
    try { const r = await api(`/v1/dent/appointments/${appt!.id}/remind`, { body: { lang } }); if (r.whatsappUrl) window.open(r.whatsappUrl, '_blank'); refresh(); }
    catch (e) { toast(err(e), 'bad'); }
  };
  const p = appt?.patient ?? who;
  const canManage = can('appointments.manage');
  const next: Record<string, string[]> = { booked: ['confirmed', 'arrived', 'no_show'], confirmed: ['arrived', 'no_show'], arrived: ['seated'], seated: [] };
  return (
    <Sheet title={appt ? d.schedule.edit : d.schedule.new} sub={appt ? `${fmtDate(appt.startsAt)} · ${hhmm(appt.startsAt)} · ${d.status[appt.status]}` : undefined} onClose={onClose}
      footer={canManage && <>
        {clash && <div className="note warn"><Icon n="alert" /><span>{d.schedule.taken}</span></div>}
        <button className="btn btn-accent justify-center" disabled={(!appt && !who) || save.isPending} onClick={() => save.mutate(clash)}>{clash ? d.schedule.bookAnyway : d.schedule.save}</button>
      </>}>
      {appt ? p && (
        <a className="picked" href={`#/patient?id=${appt.patientId}`} onClick={onClose}>
          <span className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><span className="sub">{d.schedule.openFile} →</span></span><Alerts list={(p as any).alerts ?? []} small />
        </a>
      ) : <><p className="sec-t !mb-0">{d.schedule.patient}</p><PatientPicker value={who} onPick={setWho} /></>}
      {appt && canManage && !['done', 'no_show', 'canceled'].includes(appt.status) && (
        <div className="flex flex-wrap gap-2">
          {(next[appt.status] ?? []).map((st) => <button key={st} className={`btn btn-sm ${st === 'no_show' ? 'btn-secondary' : 'btn-accent'}`} disabled={step.isPending} onClick={() => step.mutate(st)}>{st === 'confirmed' ? d.schedule.confirm : st === 'arrived' ? d.schedule.arrived : st === 'seated' ? d.schedule.seat : d.schedule.noShow}</button>)}
          {['arrived', 'seated'].includes(appt.status) && can('clinical.write') && <button className="btn btn-accent btn-sm" onClick={() => { onClose(); go(`#/patient?id=${appt.patientId}&tab=visits&visit=new&appt=${appt.id}`); }}><Icon n="tooth" className="h-4 w-4" />{d.today.startVisit}</button>}
          {appt.patient?.phone && <button className="btn btn-wa btn-sm" onClick={remind}><Icon n="wa" className="h-4 w-4" />{appt.remindedAt ? d.schedule.reminded : d.schedule.remind}</button>}
        </div>
      )}
      {canManage && <>
        <div className="grid grid-cols-3 gap-3">
          <label className="field col-span-1">{d.schedule.date}<input className="input" type="date" dir="ltr" value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label className="field">{d.schedule.time}<input className="input" type="time" dir="ltr" step={300} value={f.time} onChange={(e) => set('time', e.target.value)} /></label>
          <label className="field">{d.schedule.minutes}<select className="input" value={f.minutes} onChange={(e) => set('minutes', Number(e.target.value))}>{[15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{d.schedule.dentist}<select className="input" value={f.dentistId} onChange={(e) => set('dentistId', e.target.value)}><option value="">{d.schedule.any}</option>{s?.dentists.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="field">{d.schedule.chair}<select className="input" value={f.chairId} onChange={(e) => set('chairId', e.target.value)}><option value="">{d.schedule.any}</option>{s?.chairs.filter((c) => !c.archivedAt).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <label className="field">{d.schedule.reason}<input className="input" list="dent-reasons" value={f.reason} onChange={(e) => set('reason', e.target.value)} />
          <datalist id="dent-reasons">{s?.procedures.filter((x) => x.active).map((x) => <option key={x.id} value={x.name} />)}</datalist></label>
        <label className="field">{d.schedule.note}<input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></label>
        {appt && !['done', 'canceled'].includes(appt.status) && <button className="btn btn-secondary btn-sm justify-self-start text-[var(--bad)]" onClick={() => step.mutate('canceled')}>{d.schedule.cancel}</button>}
      </>}
    </Sheet>
  );
}
