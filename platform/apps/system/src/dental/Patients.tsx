// Patients: search (name, phone, file number), check-ups due, and a new patient in a few taps. The picker is shared by
// the schedule and the lab.
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go } from '../lib/app';
import { Empty, Icon, Money, Sheet, toLatin } from '../components/ui';
import { Importer } from '../components/Importer';
import { useD } from './i18n';
import { ageOf, type PatientCard } from './data';

export function Alerts({ list, small = false }: { list: string[]; small?: boolean }) {
  const { d } = useD();
  if (!list?.length) return null;
  return <span className={`alerts${small ? ' sm' : ''}`}>{list.map((a) => <span key={a} className="alert-chip"><b>!</b>{d.medical.alerts[a] ?? a}</span>)}</span>;
}

export function Patients() {
  const { d, t, can, num, date, money } = useD();
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<'all' | 'recalls' | 'installments'>('all');
  const [adding, setAdding] = useState(false);
  const needle = toLatin(q.trim());
  const list = useQuery({ queryKey: ['dent-patients', needle], queryFn: async () => (await api(`/v1/dent/patients?q=${encodeURIComponent(needle)}`)).patients as PatientCard[], enabled: tab === 'all', placeholderData: (x) => x });
  const recalls = useQuery({ queryKey: ['dent-recalls'], queryFn: async () => (await api('/v1/dent/recalls')).patients as PatientCard[], enabled: tab === 'recalls' });
  const inst = useQuery({ queryKey: ['dent-installments'], queryFn: async () => (await api('/v1/dent/installments')).installments as any[], enabled: tab === 'installments' });
  const rows = tab === 'recalls' ? recalls.data ?? [] : list.data ?? [];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="search min-w-0 flex-1"><Icon n="search" /><input className="input" autoFocus placeholder={d.patients.search} value={q} onChange={(e) => { setQ(e.target.value); setTab('all'); }} /></div>
        <div className="chips">
          <button className="chip" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>{d.common.all}</button>
          <button className="chip" aria-pressed={tab === 'recalls'} onClick={() => setTab('recalls')}><Icon n="bell" className="h-4 w-4" />{d.patients.recalls}</button>
          <button className="chip" aria-pressed={tab === 'installments'} onClick={() => setTab('installments')}>{d.patients.installments}</button>
        </div>
        {can('patients.create') && <button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}><Icon n="upload" className="h-4 w-4" />{t.importer.choice}</button>}
        {can('patients.create') && <button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{d.patients.new}</button>}
      </div>
      {tab === 'recalls' && <p className="sub -mt-2">{d.patients.recallsSub}</p>}
      {tab === 'installments' ? (
        <div className="panel rows overflow-clip">
          {!inst.data?.length ? <Empty icon="wallet" text={d.common.none} /> : inst.data.map((i) => (
            <a key={i.id} className="row" href={`#/patient?id=${i.patientId}&tab=plans`}>
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{i.name}</b><span className="sub">{date(i.dueDate)}{i.note ? ` · ${i.note}` : ''}</span></span>
              <span className={`pill ${new Date(i.dueDate) < new Date(new Date().toDateString()) ? 'bad' : 'warn'}`}>{money(i.amount)}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="panel rows overflow-clip">
          {(tab === 'all' ? list : recalls).isLoading && !rows.length ? <div className="skeleton m-4 h-40" />
            : !rows.length ? <Empty icon="customers" text={needle ? d.patients.none : d.patients.empty} action={!needle && can('patients.create') && <div className="flex flex-wrap justify-center gap-2"><button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}>{d.patients.new}</button><button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}><Icon n="upload" className="h-4 w-4" />{t.importer.choice}</button></div>} />
            : rows.map((p) => (
              <a key={p.id} className="row" href={`#/patient?id=${p.id}`}>
                <span className="thumb">{p.gender === 'f' ? '♀' : p.gender === 'm' ? '♂' : p.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-2 truncate font-medium">{p.name}<Alerts list={p.alerts} small /></b>
                  <span className="sub" dir="auto">{d.patients.file} {num(p.fileNo)}{p.birthDate ? ` · ${ageOf(p.birthDate, d)}` : ''}{p.phone ? ` · ${p.phone.replace(/^\+964/, '0')}` : ''}</span>
                </span>
                <span className="hidden text-end sm:block">
                  {p.nextAppointment ? <span className="pill">{date(p.nextAppointment)}</span> : p.recallDue ? <span className="sub">{d.patients.recalls}: {date(p.recallDue)}</span> : null}
                </span>
                {p.balance > 0 && <span className="w-28 text-end font-semibold text-[var(--warn)]"><Money v={p.balance} /></span>}
              </a>
            ))}
        </div>
      )}
      {adding && <PatientForm onClose={() => setAdding(false)} onSaved={(p) => go(`#/patient?id=${p.id}`)} />}
      {importing && <Importer kind="patients" onClose={() => setImporting(false)} />}
    </div>
  );
}

/** Find a patient (or start a new one from what was typed). */
export function PatientPicker({ value, onPick }: { value: PatientCard | null; onPick(p: PatientCard | null): void }) {
  const { d, num } = useD();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const needle = toLatin(q.trim());
  const found = useQuery({ queryKey: ['dent-patients', needle], queryFn: async () => (await api(`/v1/dent/patients?q=${encodeURIComponent(needle)}`)).patients as PatientCard[], enabled: needle.length >= 2 });
  if (value) return (
    <div className="picked"><span className="min-w-0 flex-1"><b className="block truncate">{value.name}</b><span className="sub">{d.patients.file} {num(value.fileNo)}</span></span>
      <Alerts list={value.alerts} small /><button type="button" className="icon-btn" onClick={() => onPick(null)} aria-label={d.common.cancel}><Icon n="close" /></button></div>
  );
  return (
    <div className="grid gap-2">
      <div className="search"><Icon n="search" /><input className="input" autoFocus placeholder={d.schedule.findPatient} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {needle.length >= 2 && (
        <div className="panel rows max-h-60 overflow-y-auto">
          {(found.data ?? []).slice(0, 8).map((p) => (
            <button type="button" key={p.id} className="row w-full text-start" onClick={() => onPick(p)}>
              <span className="min-w-0 flex-1"><b className="block truncate">{p.name}</b><span className="sub" dir="auto">{d.patients.file} {num(p.fileNo)}{p.phone ? ` · ${p.phone.replace(/^\+964/, '0')}` : ''}</span></span>
              <Alerts list={p.alerts} small />
            </button>
          ))}
          <button type="button" className="row w-full text-start text-[var(--accent)]" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{d.schedule.addPatient.replace('{name}', q.trim())}</button>
        </div>
      )}
      {adding && <PatientForm quickName={/\d{5,}/.test(needle) ? '' : q.trim()} quickPhone={/\d{5,}/.test(needle) ? needle : ''} onClose={() => setAdding(false)} onSaved={(p) => { setAdding(false); onPick(p); }} />}
    </div>
  );
}

/** A new patient, or editing one: the profile and the medical history. */
export function PatientForm({ patient, quickName = '', quickPhone = '', onClose, onSaved }: { patient?: any; quickName?: string; quickPhone?: string; onClose(): void; onSaved(p: PatientCard): void }) {
  const { d, toast, err } = useD();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: patient?.name ?? quickName, phone: (patient?.phone ?? quickPhone ?? '').replace(/^\+964/, '0'), gender: patient?.gender ?? '', birthDate: patient?.birthDate ?? '',
    address: patient?.address ?? '', occupation: patient?.occupation ?? '', referral: patient?.referral ?? '', guardian: patient?.guardian ?? '', notes: patient?.notes ?? '',
  });
  const [medical, setMedical] = useState<Record<string, any>>(patient?.medical ?? {});
  const [showMore, setShowMore] = useState(!!patient);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, phone: f.phone || null, gender: f.gender || null, birthDate: f.birthDate || null, medical };
      return patient ? api(`/v1/dent/patients/${patient.id}`, { method: 'PATCH', body }) : api('/v1/dent/patients', { body });
    },
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['dent-patients'] }); qc.invalidateQueries({ queryKey: ['dent-patient'] }); toast(patient ? d.patients.saved : d.patients.created); onSaved(r.patient); },
    onError: (e) => toast(err(e), 'bad'),
  });
  return (
    <Sheet title={patient ? d.file.edit : d.patients.new} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>{d.patients.save}</button>}>
      <label className="field">{d.patients.name}<input className="input" autoFocus={!quickName} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.patients.phone}<input className="input" dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        <label className="field">{d.patients.birth}<input className="input" type="date" dir="ltr" value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></label>
      </div>
      <div className="seg">{(['f', 'm'] as const).map((g) => <button key={g} type="button" aria-pressed={f.gender === g} onClick={() => set('gender', f.gender === g ? '' : g)}>{d.patients[g]}</button>)}</div>
      <MedicalForm value={medical} onChange={setMedical} female={f.gender !== 'm'} />
      {!showMore ? <button type="button" className="link-arrow justify-self-start" onClick={() => setShowMore(true)}>{d.common.more} ↓</button> : <>
        <label className="field">{d.patients.referral}<input className="input" list="dent-referrals" value={f.referral} onChange={(e) => set('referral', e.target.value)} />
          <datalist id="dent-referrals">{d.patients.referrals.map((r) => <option key={r} value={r} />)}</datalist></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{d.patients.occupation}<input className="input" value={f.occupation} onChange={(e) => set('occupation', e.target.value)} /></label>
          <label className="field">{d.patients.guardian}<input className="input" value={f.guardian} onChange={(e) => set('guardian', e.target.value)} /></label>
        </div>
        <label className="field">{d.patients.address}<input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></label>
        <label className="field">{d.patients.notes}<textarea className="input min-h-20" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      </>}
    </Sheet>
  );
}

const CONDITIONS = ['diabetes', 'hypertension', 'heart', 'anticoagulants', 'bleeding', 'asthma', 'epilepsy', 'hepatitis', 'hiv', 'kidney', 'thyroid', 'bisphosphonates', 'radiotherapy', 'surgeryRecent', 'smoker'] as const;
/** The medical history: tick what applies. Anything risky becomes a red alert. */
export function MedicalForm({ value, onChange, female }: { value: Record<string, any>; onChange(v: Record<string, any>): void; female: boolean }) {
  const { d } = useD();
  const toggle = (k: string) => onChange({ ...value, [k]: !value[k] });
  const allergy = (k: string) => onChange({ ...value, allergies: { ...(value.allergies ?? {}), [k]: !value.allergies?.[k] } });
  const extra = useMemo(() => (female ? ['pregnant', 'breastfeeding'] : []), [female]);
  useEffect(() => { if (!female && (value.pregnant || value.breastfeeding)) onChange({ ...value, pregnant: false, breastfeeding: false }); }, [female]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="grid gap-2">
      <p className="sec-t !mb-0">{d.medical.title}</p>
      <p className="sub">{d.medical.hint}</p>
      <div className="chips">{[...CONDITIONS, ...extra].map((k) => <button key={k} type="button" className={`chip${value[k] && k !== 'smoker' && k !== 'thyroid' && k !== 'surgeryRecent' ? ' danger' : ''}`} aria-pressed={!!value[k]} onClick={() => toggle(k)}>{(d.medical as any)[k]}</button>)}</div>
      <p className="text-sm font-medium">{d.medical.allergies}</p>
      <div className="chips">{(['penicillin', 'latex', 'anesthetic', 'nsaids'] as const).map((k) => <button key={k} type="button" className="chip danger" aria-pressed={!!value.allergies?.[k]} onClick={() => allergy(k)}>{d.medical[k]}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.medical.otherAllergy}<input className="input" value={value.allergies?.other ?? ''} onChange={(e) => onChange({ ...value, allergies: { ...(value.allergies ?? {}), other: e.target.value } })} /></label>
        <label className="field">{d.medical.medications}<input className="input" value={value.medications ?? ''} onChange={(e) => onChange({ ...value, medications: e.target.value })} /></label>
      </div>
    </section>
  );
}
