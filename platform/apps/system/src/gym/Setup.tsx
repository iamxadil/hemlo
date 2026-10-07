// The gym's set-up: memberships and prices, coaches (and their share of personal training), the weekly timetable,
// opening hours with ladies' or men's time, and how the door behaves (re-entry, grace days, self check-in, the screen).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useRoute } from '../lib/app';
import { DinarInput, Icon, Sheet } from '../components/ui';
import { useG } from './i18n';
import { SlideSeg } from './ui';
import { useSetup, type Hours, type Klass, type Plan, type Trainer } from './data';

type Tab = 'plans' | 'coaches' | 'timetable' | 'door';
const COLORS = ['#E4572E', '#C2410C', '#B38B3A', '#1F7A4D', '#2F6FB0', '#6B4FA0', '#0E1420', '#A8532E'];

export function Setup() {
  const { g } = useG();
  const { params } = useRoute();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'plans');
  const s = useSetup();
  if (!s.data) return <div className="skeleton h-72" />;
  return (
    <div className="grid gap-5">
      <SlideSeg value={tab} onChange={(v) => setTab(v as Tab)} options={[['plans', g.setup.plans], ['coaches', g.setup.coaches], ['timetable', g.setup.timetable], ['door', g.setup.door]]} className="justify-self-start gy-tabs-wrap" />
      {tab === 'plans' && <Plans plans={s.data.plans} />}
      {tab === 'coaches' && <Coaches trainers={s.data.trainers} members={s.data.members} />}
      {tab === 'timetable' && <Timetable classes={s.data.classes} trainers={s.data.trainers} />}
      {tab === 'door' && <Door settings={s.data.settings} />}
    </div>
  );
}

const useSave = () => {
  const { g, toast, err } = useG();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, method }: { path: string; body: unknown; method?: string }) => api(path, { method: method ?? 'POST', body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gym-setup'] }); toast(g.setup.saved); },
    onError: (e) => toast(err(e), 'bad'),
  });
};

function Plans({ plans }: { plans: Plan[] }) {
  const { g, money, num } = useG();
  const [edit, setEdit] = useState<Plan | 'new' | null>(null);
  return (
    <section className="grid gap-3">
      <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setEdit('new')}><Icon n="plus" className="h-4 w-4" />{g.setup.addPlan}</button>
      <div className="gy-card rows overflow-clip">
        {plans.map((p) => (
          <button key={p.id} className={`row${p.active ? '' : ' opacity-55'}`} onClick={() => setEdit(p)}>
            <span className="gy-dot" style={{ background: p.color ?? 'var(--gy-ember)' }} />
            <span className="min-w-0 flex-1 text-start"><b className="block truncate font-medium">{p.name}</b>
              <span className="sub">{g.sell.cats[p.category]} · {num(p.duration)} {g.setup.unit[p.unit]}{p.visits ? ` · ${num(p.visits)} ${g.setup.visits}` : ''}{p.gender !== 'all' ? ` · ${g.setup.who[p.gender]}` : ''}{!p.active ? ` · ${g.setup.hidden}` : ''}</span></span>
            <b className="money">{money(p.price)}</b>
          </button>
        ))}
      </div>
      {edit && <PlanSheet plan={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function PlanSheet({ plan, onClose }: { plan: Plan | null; onClose(): void }) {
  const { g } = useG();
  const save = useSave();
  const [f, setF] = useState({ name: plan?.name ?? '', category: plan?.category ?? 'gym', duration: plan?.duration ?? 1, unit: plan?.unit ?? 'month', visits: plan?.visits ?? null as number | null,
    price: plan?.price ?? null as number | null, gender: plan?.gender ?? 'all', freezeDays: plan?.freezeDays ?? 0, color: plan?.color ?? null as string | null, active: plan?.active ?? true });
  const go = () => save.mutate({ path: plan ? `/v1/gym/plans/${plan.id}` : '/v1/gym/plans', method: plan ? 'PATCH' : 'POST', body: { ...f, price: f.price ?? 0 } }, { onSuccess: onClose });
  return (
    <Sheet title={plan ? plan.name : g.setup.addPlan} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!f.name.trim() || save.isPending} onClick={go}>{g.common.save}</button>}>
      <label className="field">{g.setup.name}<input className="input" autoFocus={!plan} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="seg">{(['gym', 'pt', 'class', 'other'] as const).map((c) => <button key={c} type="button" aria-pressed={f.category === c} onClick={() => setF({ ...f, category: c })}>{g.sell.cats[c]}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{g.setup.duration}<input className="input" inputMode="numeric" dir="ltr" value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value.replace(/\D/g, '')) || 1 })} /></label>
        <label className="field">&nbsp;<select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as any })}><option value="month">{g.setup.unit.month}</option><option value="day">{g.setup.unit.day}</option></select></label>
        <label className="field">{g.setup.visits}<input className="input" inputMode="numeric" dir="ltr" placeholder={g.setup.unlimited} value={f.visits ?? ''} onChange={(e) => setF({ ...f, visits: e.target.value.replace(/\D/g, '') ? Number(e.target.value.replace(/\D/g, '')) : null })} /></label>
        <label className="field">{g.setup.price}<DinarInput value={f.price} onChange={(v) => setF({ ...f, price: v })} /></label>
        <label className="field">{g.setup.gender}<select className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>{(['all', 'f', 'm'] as const).map((x) => <option key={x} value={x}>{g.setup.who[x]}</option>)}</select></label>
        <label className="field">{g.setup.freeze}<input className="input" inputMode="numeric" dir="ltr" value={f.freezeDays} onChange={(e) => setF({ ...f, freezeDays: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
      </div>
      <Swatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
      <label className="gy-switch"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>{g.setup.active}</span></label>
    </Sheet>
  );
}

function Swatches({ value, onChange }: { value: string | null; onChange(c: string): void }) {
  const { g } = useG();
  return <div className="grid gap-2"><span className="text-sm font-medium text-[var(--fg-2)]">{g.setup.color}</span>
    <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" className="gy-swatch" style={{ background: c }} aria-pressed={value === c} onClick={() => onChange(c)} aria-label={c} />)}</div></div>;
}

function Coaches({ trainers, members }: { trainers: Trainer[]; members: { id: string; role: string; name: string }[] }) {
  const { g, num } = useG();
  const [edit, setEdit] = useState<Trainer | 'new' | null>(null);
  return (
    <section className="grid gap-3">
      <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setEdit('new')}><Icon n="plus" className="h-4 w-4" />{g.setup.addCoach}</button>
      <div className="gy-card rows overflow-clip">
        {trainers.map((t) => (
          <button key={t.id} className={`row${t.active ? '' : ' opacity-55'}`} onClick={() => setEdit(t)}>
            <span className="gy-dot lg" style={{ background: t.color }} />
            <span className="min-w-0 flex-1 text-start"><b className="block truncate font-medium">{t.name}</b><span className="sub">{[t.specialty, t.gender ? g.form[t.gender as 'f'] : null].filter(Boolean).join(' · ')}</span></span>
            {t.ptShare > 0 && <span className="pill">{num(t.ptShare)}%</span>}
          </button>
        ))}
      </div>
      {edit && <CoachSheet t={edit === 'new' ? null : edit} members={members} onClose={() => setEdit(null)} />}
    </section>
  );
}

function CoachSheet({ t, members, onClose }: { t: Trainer | null; members: { id: string; role: string; name: string }[]; onClose(): void }) {
  const { g } = useG();
  const save = useSave();
  const [f, setF] = useState({ name: t?.name ?? '', phone: (t?.phone ?? '').replace(/^\+964/, '0'), gender: t?.gender ?? '', specialty: t?.specialty ?? '', ptShare: t?.ptShare ?? 0, color: t?.color ?? '#E4572E', active: t?.active ?? true, memberId: t?.memberId ?? '' });
  const go = () => save.mutate({ path: t ? `/v1/gym/trainers/${t.id}` : '/v1/gym/trainers', method: t ? 'PATCH' : 'POST', body: { ...f, phone: f.phone || null, gender: f.gender || null, memberId: f.memberId || null } }, { onSuccess: onClose });
  return (
    <Sheet title={t ? t.name : g.setup.addCoach} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!f.name.trim() || save.isPending} onClick={go}>{g.common.save}</button>}>
      <label className="field">{g.setup.name}<input className="input" autoFocus={!t} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{g.setup.phone}<input className="input" dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label className="field">{g.setup.specialty}<input className="input" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></label>
      </div>
      <div className="seg">{(['m', 'f'] as const).map((x) => <button key={x} type="button" aria-pressed={f.gender === x} onClick={() => setF({ ...f, gender: f.gender === x ? '' : x })}>{g.form[x]}</button>)}</div>
      <label className="field">{g.setup.share}<input className="input" inputMode="numeric" dir="ltr" value={f.ptShare} onChange={(e) => setF({ ...f, ptShare: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) })} /></label>
      <label className="field">{g.setup.account}<select className="input" value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })}>
        <option value="">{g.setup.noAccount}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <Swatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
      <label className="gy-switch"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>{g.setup.active}</span></label>
    </Sheet>
  );
}

function Timetable({ classes, trainers }: { classes: Klass[]; trainers: Trainer[] }) {
  const { g, num } = useG();
  const [edit, setEdit] = useState<Klass | 'new' | null>(null);
  const order = [6, 0, 1, 2, 3, 4, 5];
  return (
    <section className="grid gap-3">
      <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setEdit('new')}><Icon n="plus" className="h-4 w-4" />{g.setup.addClass}</button>
      <div className="gy-tt">
        {order.map((d) => (
          <div key={d} className="gy-tt-day">
            <b>{g.setup.days[d]}</b>
            {classes.filter((k) => k.day === d).map((k) => (
              <button key={k.id} className={`gy-tt-k${k.active ? '' : ' off'}`} style={{ ['--k' as any]: k.color ?? 'var(--gy-ember)' }} onClick={() => setEdit(k)}>
                <span dir="ltr">{k.startsAt}</span><b>{k.name}</b><small>{[trainers.find((t) => t.id === k.trainerId)?.name, k.gender !== 'all' ? g.setup.who[k.gender] : null, k.capacity ? num(k.capacity) : null].filter(Boolean).join(' · ')}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
      {edit && <ClassSheet k={edit === 'new' ? null : edit} trainers={trainers} onClose={() => setEdit(null)} />}
    </section>
  );
}

function ClassSheet({ k, trainers, onClose }: { k: Klass | null; trainers: Trainer[]; onClose(): void }) {
  const { g } = useG();
  const save = useSave();
  const [f, setF] = useState({ name: k?.name ?? '', trainerId: k?.trainerId ?? '', day: k?.day ?? 6, startsAt: k?.startsAt ?? '18:00', minutes: k?.minutes ?? 60, capacity: k?.capacity ?? null as number | null, gender: k?.gender ?? 'all', color: k?.color ?? null as string | null, active: k?.active ?? true });
  const go = () => save.mutate({ path: k ? `/v1/gym/classes/${k.id}` : '/v1/gym/classes', method: k ? 'PATCH' : 'POST', body: { ...f, trainerId: f.trainerId || null } }, { onSuccess: onClose });
  return (
    <Sheet title={k ? k.name : g.setup.addClass} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!f.name.trim() || save.isPending} onClick={go}>{g.common.save}</button>}>
      <label className="field">{g.setup.name}<input className="input" autoFocus={!k} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{g.setup.day}<select className="input" value={f.day} onChange={(e) => setF({ ...f, day: Number(e.target.value) })}>{[6, 0, 1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{g.setup.days[d]}</option>)}</select></label>
        <label className="field">{g.setup.time}<input className="input" type="time" dir="ltr" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></label>
        <label className="field">{g.setup.minutes}<input className="input" inputMode="numeric" dir="ltr" value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value.replace(/\D/g, '')) || 60 })} /></label>
        <label className="field">{g.setup.capacity}<input className="input" inputMode="numeric" dir="ltr" placeholder={g.setup.noLimit} value={f.capacity ?? ''} onChange={(e) => setF({ ...f, capacity: e.target.value.replace(/\D/g, '') ? Number(e.target.value.replace(/\D/g, '')) : null })} /></label>
        <label className="field">{g.setup.coach}<select className="input" value={f.trainerId} onChange={(e) => setF({ ...f, trainerId: e.target.value })}><option value="">—</option>{trainers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="field">{g.setup.gender}<select className="input" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>{(['all', 'f', 'm'] as const).map((x) => <option key={x} value={x}>{g.setup.who[x]}</option>)}</select></label>
      </div>
      <Swatches value={f.color} onChange={(c) => setF({ ...f, color: c })} />
      <label className="gy-switch"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>{g.setup.active}</span></label>
    </Sheet>
  );
}

function Door({ settings }: { settings: { hours: Hours | null; reentryMinutes: number; graceDays: number; reminderText: string | null; selfCheckin: boolean } }) {
  const { g, can, toast, err } = useG();
  const save = useSave();
  const [hours, setHours] = useState<Hours>(() => settings.hours ?? {});
  const [f, setF] = useState({ reentryMinutes: settings.reentryMinutes, graceDays: settings.graceDays, reminderText: settings.reminderText ?? g.renewals.msg, selfCheckin: settings.selfCheckin });
  const order = ['6', '0', '1', '2', '3', '4', '5'];
  const setDay = (d: string, list: Hours[string]) => setHours((h) => ({ ...h, [d]: list }));
  const reset = useMutation({ mutationFn: () => api('/v1/gym/door-link/reset', { body: {} }), onSuccess: () => toast(g.setup.saved), onError: (e) => toast(err(e), 'bad') });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="gy-card p-5 grid gap-3 content-start">
        <h2 className="gy-h2">{g.setup.hours}</h2>
        <p className="sub">{g.setup.hoursHint}</p>
        {order.map((d) => (
          <div key={d} className="gy-hours">
            <b>{g.setup.days[Number(d)]}</b>
            <div className="grid gap-1.5">
              {!(hours[d] ?? []).length && <span className="sub">{g.setup.closed}</span>}
              {(hours[d] ?? []).map((b, i) => (
                <div key={i} className={`gy-block who-${b.who}`}>
                  <input type="time" dir="ltr" value={b.from} onChange={(e) => setDay(d, hours[d].map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} aria-label={g.setup.from} />
                  <span>–</span>
                  <input type="time" dir="ltr" value={b.to} onChange={(e) => setDay(d, hours[d].map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} aria-label={g.setup.to} />
                  <select value={b.who} onChange={(e) => setDay(d, hours[d].map((x, j) => (j === i ? { ...x, who: e.target.value as any } : x)))}>{(['all', 'f', 'm'] as const).map((w) => <option key={w} value={w}>{g.setup.who[w]}</option>)}</select>
                  <button type="button" className="icon-btn" onClick={() => setDay(d, hours[d].filter((_, j) => j !== i))} aria-label={g.common.cancel}><Icon n="close" /></button>
                </div>
              ))}
              <button type="button" className="link-arrow justify-self-start text-sm" onClick={() => { const l = hours[d] ?? []; setDay(d, [...l, { from: l.at(-1)?.to ?? '06:00', to: '23:59', who: 'all' }]); }}>+ {g.setup.addBlock}</button>
            </div>
          </div>
        ))}
        <button className="btn btn-accent btn-sm justify-self-start" disabled={save.isPending} onClick={() => save.mutate({ path: '/v1/gym/settings', method: 'PUT', body: { hours } })}>{g.common.save}</button>
      </section>
      <section className="gy-card p-5 grid gap-4 content-start">
        <h2 className="gy-h2">{g.setup.door}</h2>
        <p className="sub">{g.setup.doorHint}</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-secondary btn-sm" href="#/door" target="_blank" rel="noopener"><Icon n="display" className="h-4 w-4" />{g.setup.openDoor}</a>
          {can('gym.configure') && <button className="btn btn-ghost btn-sm" onClick={() => confirm(g.setup.resetSure) && reset.mutate()}>{g.setup.resetDoor}</button>}
        </div>
        <label className="gy-switch"><input type="checkbox" checked={f.selfCheckin} onChange={(e) => setF({ ...f, selfCheckin: e.target.checked })} /><span>{g.setup.self}</span></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{g.setup.reentry}<input className="input" inputMode="numeric" dir="ltr" value={f.reentryMinutes} onChange={(e) => setF({ ...f, reentryMinutes: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
          <label className="field">{g.setup.grace}<input className="input" inputMode="numeric" dir="ltr" value={f.graceDays} onChange={(e) => setF({ ...f, graceDays: Math.min(30, Number(e.target.value.replace(/\D/g, '')) || 0) })} /></label>
        </div>
        <label className="field">{g.setup.reminder}<textarea className="input min-h-24" value={f.reminderText} onChange={(e) => setF({ ...f, reminderText: e.target.value })} /><small>{g.setup.reminderHint}</small></label>
        <button className="btn btn-accent btn-sm justify-self-start" disabled={save.isPending} onClick={() => save.mutate({ path: '/v1/gym/settings', method: 'PUT', body: f })}>{g.common.save}</button>
      </section>
    </div>
  );
}
