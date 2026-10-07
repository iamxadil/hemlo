// Clinic set-up (owners and admins): the dollar rate, booking step, check-up interval, reminder and prescription texts;
// opening hours; chairs; dentists and their shares; the price list.
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Icon, Sheet } from '../components/ui';
import { useD } from './i18n';
import { useSetup, usePrice, type Dentist, type Procedure } from './data';

const TABS = ['general', 'hours', 'chairs', 'dentists', 'prices'] as const;

export function Clinic() {
  const { d } = useD();
  const [tab, setTab] = useState<(typeof TABS)[number]>('general');
  const setup = useSetup();
  if (!setup.data) return <div className="skeleton h-72" />;
  return (
    <div className="grid max-w-4xl gap-4">
      <nav className="file-tabs" role="tablist">{TABS.map((x) => <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>{d.clinic.tabs[x]}</button>)}</nav>
      {tab === 'general' && <General />}
      {tab === 'hours' && <Hours />}
      {tab === 'chairs' && <Chairs />}
      {tab === 'dentists' && <Dentists />}
      {tab === 'prices' && <Prices />}
    </div>
  );
}

function useSave() {
  const { d, toast, err } = useD();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = 'POST', body }: { path: string; method?: string; body: unknown }) => api(path, { method, body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dent-setup'] }); toast(d.clinic.saved); },
    onError: (e) => toast(err(e), 'bad'),
  });
}

function General() {
  const { d } = useD();
  const s = useSetup().data!.settings;
  const save = useSave();
  const [f, setF] = useState({ usdRate: String(s.usdRate), slotMinutes: s.slotMinutes, recallMonths: String(s.recallMonths), reminderText: s.reminderText ?? '', rxHeader: s.rxHeader ?? '' });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  return (
    <section className="panel grid gap-3 p-5">
      <div className="grid grid-cols-3 gap-3">
        <label className="field">{d.clinic.usdRate}<input className="input" dir="ltr" inputMode="numeric" value={f.usdRate} onChange={(e) => set('usdRate', e.target.value.replace(/\D/g, ''))} /></label>
        <label className="field">{d.clinic.slot}<select className="input" value={f.slotMinutes} onChange={(e) => set('slotMinutes', Number(e.target.value))}>{[5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        <label className="field">{d.clinic.recall}<input className="input" dir="ltr" inputMode="numeric" value={f.recallMonths} onChange={(e) => set('recallMonths', e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <p className="sub">{d.clinic.usdHint}</p>
      <label className="field">{d.clinic.reminder}<textarea className="input min-h-20" value={f.reminderText} onChange={(e) => set('reminderText', e.target.value)} /><small>{d.clinic.reminderHint}</small></label>
      <label className="field">{d.clinic.rxHeader}<textarea className="input min-h-16" value={f.rxHeader} onChange={(e) => set('rxHeader', e.target.value)} /></label>
      <button className="btn btn-accent btn-sm justify-self-start" disabled={save.isPending} onClick={() => save.mutate({ path: '/v1/dent/settings', method: 'PUT', body: { usdRate: Number(f.usdRate), slotMinutes: f.slotMinutes, recallMonths: Number(f.recallMonths || 0), reminderText: f.reminderText || null, rxHeader: f.rxHeader || null } })}>{d.common.save}</button>
    </section>
  );
}

function Hours() {
  const { d } = useD();
  const s = useSetup().data!.settings;
  const save = useSave();
  const [h, setH] = useState<Record<string, [string, string] | null>>(s.hours ?? {});
  return (
    <section className="panel grid gap-2 p-5">
      {d.clinic.days.map((name, i) => {
        const k = String(i), v = h[k] ?? null;
        return (
          <div key={k} className="flex flex-wrap items-center gap-3">
            <b className="w-24">{name}</b>
            <button className={`chip${v ? '' : ' danger'}`} aria-pressed={!!v} onClick={() => setH((x) => ({ ...x, [k]: v ? null : ['14:00', '21:00'] }))}>{v ? d.clinic.open : d.clinic.closed}</button>
            {v && <><input className="input !w-28" type="time" dir="ltr" value={v[0]} onChange={(e) => setH((x) => ({ ...x, [k]: [e.target.value, v[1]] }))} /><span className="sub">—</span>
              <input className="input !w-28" type="time" dir="ltr" value={v[1]} onChange={(e) => setH((x) => ({ ...x, [k]: [v[0], e.target.value] }))} /></>}
          </div>
        );
      })}
      <button className="btn btn-accent btn-sm mt-2 justify-self-start" disabled={save.isPending} onClick={() => save.mutate({ path: '/v1/dent/settings', method: 'PUT', body: { hours: Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, h[k] ?? null])) } })}>{d.common.save}</button>
    </section>
  );
}

function Chairs() {
  const { d } = useD();
  const chairs = useSetup().data!.chairs;
  const save = useSave();
  const [name, setName] = useState('');
  return (
    <section className="panel">
      <ul className="rows">{chairs.map((c) => (
        <li key={c.id} className="row"><span className="thumb"><Icon n="tooth" className="h-5 w-5" /></span><span className={`flex-1 ${c.archivedAt ? 'muted line-through' : ''}`}>{c.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => save.mutate({ path: `/v1/dent/chairs/${c.id}`, method: 'PATCH', body: { archived: !c.archivedAt } })}>{c.archivedAt ? d.clinic.restore : d.clinic.archive}</button></li>
      ))}</ul>
      <div className="flex gap-2 p-4"><input className="input" placeholder={d.clinic.chairName} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-accent btn-sm" disabled={!name.trim()} onClick={() => { save.mutate({ path: '/v1/dent/chairs', body: { name } }); setName(''); }}>{d.clinic.addChair}</button></div>
    </section>
  );
}

function Dentists() {
  const { d } = useD();
  const s = useSetup().data!;
  const [edit, setEdit] = useState<Dentist | 'new' | null>(null);
  return (
    <section className="panel">
      <ul className="rows">{s.dentists.map((x) => (
        <li key={x.id}><button className="row w-full text-start" onClick={() => setEdit(x)}>
          <span className="thumb" style={{ background: x.color, color: '#fff' }}>{x.name.replace(/^(د\.|Dr\.?)\s*/, '').slice(0, 1)}</span>
          <span className={`min-w-0 flex-1 ${x.active ? '' : 'muted'}`}><b className="block truncate">{x.name}</b><span className="sub">{x.specialty ? d.clinic.specialties[x.specialty] : ''}{x.memberId ? '' : ` · ${d.clinic.noAccount}`}</span></span>
          <span className="pill">{x.sharePercent ? `${x.sharePercent}%` : '—'}</span></button></li>
      ))}</ul>
      <div className="p-4"><button className="btn btn-accent btn-sm" onClick={() => setEdit('new')}><Icon n="plus" className="h-4 w-4" />{d.clinic.addDentist}</button></div>
      {edit && <DentistSheet dentist={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function DentistSheet({ dentist, onClose }: { dentist: Dentist | null; onClose(): void }) {
  const { d } = useD();
  const s = useSetup().data!;
  const save = useSave();
  const [f, setF] = useState({ name: dentist?.name ?? '', memberId: dentist?.memberId ?? '', specialty: dentist?.specialty ?? 'general', color: dentist?.color ?? '#2F5DA8',
    sharePercent: String(dentist?.sharePercent ?? 0), shareBasis: dentist?.shareBasis ?? 'collected', labDeduct: dentist?.labDeduct ?? true, active: dentist?.active ?? true });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { if (!f.name && f.memberId) set('name', s.members.find((m) => m.id === f.memberId)?.name ?? ''); }, [f.memberId]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => {
    const body = { ...f, memberId: f.memberId || null, sharePercent: Number(f.sharePercent || 0) };
    save.mutate({ path: dentist ? `/v1/dent/dentists/${dentist.id}` : '/v1/dent/dentists', method: dentist ? 'PATCH' : 'POST', body }, { onSuccess: onClose });
  };
  return (
    <Sheet title={dentist ? dentist.name : d.clinic.addDentist} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!f.name.trim() || save.isPending} onClick={submit}>{d.common.save}</button>}>
      <label className="field">{d.clinic.account}<select className="input" value={f.memberId} onChange={(e) => set('memberId', e.target.value)}><option value="">{d.clinic.noAccount}</option>{s.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label className="field">{d.clinic.dentistName}<input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.clinic.specialty}<select className="input" value={f.specialty} onChange={(e) => set('specialty', e.target.value)}>{Object.entries(d.clinic.specialties).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field">{d.clinic.color}<input className="input !h-11" type="color" value={f.color} onChange={(e) => set('color', e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.clinic.share}<input className="input" dir="ltr" inputMode="numeric" value={f.sharePercent} onChange={(e) => set('sharePercent', e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
        <label className="field">{d.clinic.basis}<select className="input" value={f.shareBasis} onChange={(e) => set('shareBasis', e.target.value)}><option value="collected">{d.reports.basis.collected}</option><option value="billed">{d.reports.basis.billed}</option></select></label>
      </div>
      <p className="sub">{d.clinic.shareHint}</p>
      <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={f.labDeduct} onChange={(e) => set('labDeduct', e.target.checked)} />{d.clinic.labDeduct}</label>
      {dentist && <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={f.active} onChange={(e) => set('active', e.target.checked)} />{d.clinic.active}</label>}
    </Sheet>
  );
}

function Prices() {
  const { d } = useD();
  const procs = useSetup().data!.procedures;
  const price = usePrice();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Procedure | 'new' | null>(null);
  const list = procs.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className="panel">
      <div className="flex gap-2 p-4"><div className="search flex-1"><Icon n="search" /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.common.search} /></div>
        <button className="btn btn-accent btn-sm" onClick={() => setEdit('new')}><Icon n="plus" className="h-4 w-4" />{d.clinic.addProc}</button></div>
      <ul className="rows">{list.map((p) => (
        <li key={p.id}><button className="row w-full text-start" onClick={() => setEdit(p)}>
          <span className={`min-w-0 flex-1 ${p.active ? '' : 'muted line-through'}`}><b className="block truncate">{p.name}</b><span className="sub">{d.clinic.categories[p.category] ?? p.category} · {p.minutes} min</span></span>
          <span className="font-semibold">{price(p.currency, p.price)}</span></button></li>
      ))}</ul>
      {edit && <ProcSheet proc={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function ProcSheet({ proc, onClose }: { proc: Procedure | null; onClose(): void }) {
  const { d } = useD();
  const save = useSave();
  const [f, setF] = useState({ name: proc?.name ?? '', category: proc?.category ?? 'restorative', currency: proc?.currency ?? 'IQD', price: String(proc?.price ?? ''), minutes: String(proc?.minutes ?? 30),
    scope: proc?.scope ?? 'tooth', mark: proc?.mark ?? '', labWork: proc?.labWork ?? false, active: proc?.active ?? true });
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => save.mutate({ path: proc ? `/v1/dent/procedures/${proc.id}` : '/v1/dent/procedures', method: proc ? 'PATCH' : 'POST',
    body: { ...f, price: Number(f.price || 0), minutes: Number(f.minutes || 30), mark: f.mark || null } }, { onSuccess: onClose });
  return (
    <Sheet title={proc ? proc.name : d.clinic.addProc} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!f.name.trim() || save.isPending} onClick={submit}>{d.common.save}</button>}>
      <label className="field">{d.clinic.procName}<input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="field">{d.clinic.currency}<select className="input" value={f.currency} onChange={(e) => set('currency', e.target.value)}><option value="IQD">{d.common.iqd}</option><option value="USD">{d.common.usd}</option></select></label>
        <label className="field">{d.clinic.price}<input className="input" dir="ltr" inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} /></label>
        <label className="field">{d.clinic.minutes}<input className="input" dir="ltr" inputMode="numeric" value={f.minutes} onChange={(e) => set('minutes', e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.clinic.category}<select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(d.clinic.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field">{d.clinic.scope}<select className="input" value={f.scope} onChange={(e) => set('scope', e.target.value)}>{Object.entries(d.clinic.scopes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <label className="field">{d.clinic.mark}<select className="input" value={f.mark} onChange={(e) => set('mark', e.target.value)}><option value="">—</option>{Object.entries(d.chart.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={f.active} onChange={(e) => set('active', e.target.checked)} />{d.clinic.active}</label>
    </Sheet>
  );
}
