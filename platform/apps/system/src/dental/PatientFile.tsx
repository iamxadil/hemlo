// A patient's file: who they are, what to watch out for (red alerts, always on top), and tabs for everything clinical and
// financial. Tabs a role may not see are simply not there.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Empty, Icon, Money } from '../components/ui';
import { useD } from './i18n';
import { ageOf, waLink, hhmm, useSetup } from './data';
import { Alerts, PatientForm } from './Patients';
import { AppointmentSheet } from './Schedule';
import { ChartTab } from './ChartTab';
import { PlansTab } from './PlansTab';
import { VisitsTab } from './VisitsTab';
import { ImagesTab } from './ImagesTab';
import { RxTab, PerioTab, ConsentsTab, LabTab } from './RecordTabs';

const TABS = ['overview', 'chart', 'plans', 'visits', 'images', 'rx', 'perio', 'consents', 'lab', 'account'] as const;
const NEED: Record<string, string> = { chart: 'clinical.read', images: 'clinical.read', rx: 'clinical.read', perio: 'clinical.read', lab: 'lab.read', account: 'customers.read' };

export function PatientFile() {
  const { d, t, can, num } = useD();
  const { params } = useRoute();
  const id = params.get('id') ?? '';
  const tab = (params.get('tab') ?? 'overview') as (typeof TABS)[number];
  const q = useQuery({ queryKey: ['dent-patient', id], queryFn: () => api(`/v1/dent/patients/${id}`), enabled: !!id });
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const p = q.data?.patient;
  if (q.isLoading) return <div className="grid gap-4"><div className="skeleton h-28" /><div className="skeleton h-72" /></div>;
  if (!p) return <Empty icon="customers" text={d.errors.PATIENT_NOT_FOUND} action={<a className="btn btn-secondary btn-sm" href="#/patients">{t.dnav.patients}</a>} />;
  const tabs = TABS.filter((x) => !NEED[x] || can(NEED[x]));
  const setTab = (x: string) => go(`#/patient?id=${id}&tab=${x}`);
  const wa = waLink(p.phone);

  return (
    <div className="grid gap-4">
      <section className="panel file-head">
        <div className="flex flex-wrap items-start gap-4">
          <span className="thumb !h-14 !w-14 text-xl">{p.gender === 'f' ? '♀' : p.gender === 'm' ? '♂' : p.name.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="sub" dir="auto">{d.patients.file} {num(p.fileNo)}{p.birthDate ? ` · ${ageOf(p.birthDate, d)}` : ''}{p.phone ? ` · ${p.phone.replace(/^\+964/, '0')}` : ''}{p.guardian ? ` · ${d.patients.guardian}: ${p.guardian}` : ''}</p>
            {p.alerts?.length > 0 && <div className="mt-2"><Alerts list={p.alerts} /></div>}
          </div>
          <div className="text-end">
            <p className="sub">{d.patients.balance}</p>
            <p className={`text-xl font-semibold ${p.balance > 0 ? 'text-[var(--warn)]' : ''}`}><Money v={p.balance} /></p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.phone && <a className="btn btn-secondary btn-sm" href={`tel:${p.phone}`}><Icon n="phone" className="h-4 w-4" />{d.file.call}</a>}
          {wa && <a className="btn btn-wa btn-sm" href={wa} target="_blank" rel="noopener"><Icon n="wa" className="h-4 w-4" />{d.file.whatsapp}</a>}
          {can('appointments.manage') && <button className="btn btn-secondary btn-sm" onClick={() => setBooking(true)}><Icon n="calendar" className="h-4 w-4" />{d.file.book}</button>}
          {can('patients.update') && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><Icon n="edit" className="h-4 w-4" />{d.file.edit}</button>}
          {can('clinical.write') && <button className="btn btn-accent btn-sm" onClick={() => go(`#/patient?id=${id}&tab=visits&visit=new`)}><Icon n="tooth" className="h-4 w-4" />{d.visit.new}</button>}
        </div>
      </section>

      <nav className="file-tabs" role="tablist">
        {tabs.map((x) => <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>{d.file.tabs[x]}</button>)}
      </nav>

      {tab === 'overview' && <Overview data={q.data} />}
      {tab === 'chart' && <ChartTab key={p.id} patient={p} />}
      {tab === 'plans' && <PlansTab key={p.id} patient={p} />}
      {tab === 'visits' && <VisitsTab key={p.id} patient={p} />}
      {tab === 'images' && <ImagesTab key={p.id} patient={p} />}
      {tab === 'rx' && <RxTab key={p.id} patient={p} />}
      {tab === 'perio' && <PerioTab key={p.id} patient={p} />}
      {tab === 'consents' && <ConsentsTab key={p.id} patient={p} />}
      {tab === 'lab' && <LabTab key={p.id} patient={p} />}
      {tab === 'account' && <AccountTab key={p.id} patient={p} />}
      {editing && <PatientForm patient={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); q.refetch(); }} />}
      {booking && <AppointmentSheet patient={p} onClose={() => { setBooking(false); q.refetch(); }} />}
    </div>
  );
}

function Overview({ data }: { data: any }) {
  const { d, num, date, can } = useD();
  const setup = useSetup();
  const p = data.patient, m = p.medical ?? {};
  const conditions = ['diabetes', 'hypertension', 'heart', 'anticoagulants', 'bleeding', 'asthma', 'epilepsy', 'hepatitis', 'hiv', 'kidney', 'thyroid', 'bisphosphonates', 'radiotherapy', 'surgeryRecent', 'pregnant', 'breastfeeding', 'smoker'].filter((k) => m[k]);
  const allergies = ['penicillin', 'latex', 'anesthetic', 'nsaids'].filter((k) => m.allergies?.[k]);
  const timeline = useQuery({ queryKey: ['dent-timeline', p.id], queryFn: async () => (await api(`/v1/dent/patients/${p.id}/timeline`)).events as any[] });
  const access = useQuery({ queryKey: ['dent-access', p.id], queryFn: async () => (await api(`/v1/dent/patients/${p.id}/access`)).access as any[], enabled: can('clinic.configure') });
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel p-5">
        <p className="sec-t">{d.medical.title}</p>
        {!conditions.length && !allergies.length && !m.medications && !m.allergies?.other ? <p className="muted text-sm">{d.medical.none}</p> : (
          <div className="grid gap-2 text-sm">
            {allergies.length > 0 && <p><b className="text-[var(--bad)]">{d.medical.allergies}:</b> {allergies.map((k) => (d.medical as any)[k]).join('، ')}{m.allergies?.other ? `، ${m.allergies.other}` : ''}</p>}
            {conditions.length > 0 && <p>{conditions.map((k) => (d.medical as any)[k]).join(' · ')}</p>}
            {m.medications && <p><b>{d.medical.medications}:</b> {m.medications}</p>}
          </div>
        )}
        {p.notes && <><p className="sec-t mt-4">{d.patients.notes}</p><p className="whitespace-pre-wrap text-sm">{p.notes}</p></>}
        <dl className="kv mt-4 text-sm">
          {p.referral && <><dt>{d.patients.referral}</dt><dd>{p.referral}</dd></>}
          {p.occupation && <><dt>{d.patients.occupation}</dt><dd>{p.occupation}</dd></>}
          {p.address && <><dt>{d.patients.address}</dt><dd>{p.address}</dd></>}
          {p.recallDue && <><dt>{d.patients.recalls}</dt><dd>{date(p.recallDue)}</dd></>}
          <dt>{d.file.visits}</dt><dd>{num(data.counts.visits)}</dd>
          <dt>{d.file.plans}</dt><dd>{num(data.counts.open_plans)}</dd>
        </dl>
      </section>
      <section className="panel p-5">
        <p className="sec-t">{d.file.upcoming}</p>
        {!data.upcoming.length ? <p className="muted text-sm">{d.file.noUpcoming}</p> : <ul className="grid gap-2">{data.upcoming.map((a: any) => {
          const dn = setup.data?.dentists.find((x) => x.id === a.dentistId);
          return <li key={a.id} className="flex items-center justify-between gap-2 text-sm"><span>{date(a.startsAt)} · <span dir="ltr">{hhmm(a.startsAt)}</span>{a.reason ? ` · ${a.reason}` : ''}{dn ? ` · ${dn.name}` : ''}</span><span className={`pill st-${a.status}`}>{d.status[a.status]}</span></li>;
        })}</ul>}
        <p className="sec-t mt-5">{d.file.timeline}</p>
        <ul className="timeline-list">{(timeline.data ?? []).slice(0, 25).map((e) => <li key={e.type + e.id}><span className="sub">{date(e.at)}</span> <span>{eventText(e, d)}</span></li>)}</ul>
        {access.data && access.data.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer muted">{d.file.access}</summary>
          <ul className="mt-2 grid gap-1">{access.data.slice(0, 30).map((x, i) => <li key={i} className="sub">{date(x.at)} · {x.name ?? '—'} · {x.action}</li>)}</ul></details>}
      </section>
    </div>
  );
}

function eventText(e: any, d: any) {
  switch (e.type) {
    case 'visit': return `${d.file.tabs.visits}: ${e.items.map((i: any) => i.name + (i.tooth ? ` ${i.tooth}` : '')).join('، ') || '—'}${e.dentist ? ` · ${e.dentist}` : ''}`;
    case 'payment': return `${d.visit.payNow}: ${new Intl.NumberFormat().format(e.amount)}`;
    case 'plan': return `${d.file.tabs.plans}: ${e.title} (${d.plans.status[e.status] ?? e.status})`;
    case 'rx': return `${d.file.tabs.rx}: ${e.items.map((i: any) => i.drug).join('، ')}`;
    case 'lab': return `${d.file.tabs.lab}: ${e.work} (${d.lab.status[e.status] ?? e.status})`;
    case 'consent': return `${d.file.tabs.consents}: ${d.consents.kinds[e.kind] ?? e.kind}`;
    case 'no_show': case 'canceled': return d.status[e.type];
    default: return e.type;
  }
}

function AccountTab({ patient }: { patient: any }) {
  const { d, t } = useD();
  return (
    <section className="panel p-5">
      <p className="sec-t">{d.patients.balance}</p>
      <p className={`text-3xl font-semibold ${patient.balance > 0 ? 'text-[var(--warn)]' : ''}`}><Money v={patient.balance} /></p>
      <a className="btn btn-accent btn-sm mt-4" href={`#/customers?id=${patient.id}`}><Icon n="wallet" className="h-4 w-4" />{t.customers.payment}</a>
    </section>
  );
}
