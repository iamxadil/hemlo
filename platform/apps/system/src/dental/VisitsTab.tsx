// Visits: what was done (from the plan, or added), the notes (templates), the bill (discount, paid now, the rest on the
// account) and the receipt. Past notes show with their corrections.
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { DinarInput, Empty, Icon, Money, Sheet } from '../components/ui';
import { Receipt, printSale, receiptData } from '../components/Receipt';
import { useD } from './i18n';
import { useSetup, usePrice, toIqd, type Plan } from './data';
import { RxSheet } from './RecordTabs';

export function VisitsTab({ patient }: { patient: any }) {
  const { d, can, date, dateTime } = useD();
  const { params } = useRoute();
  const setup = useSetup();
  const q = useQuery({ queryKey: ['dent-visits', patient.id], queryFn: async () => (await api(`/v1/dent/patients/${patient.id}/visits`)).visits as any[] });
  const [amend, setAmend] = useState<any>(null);
  const newOpen = params.get('visit') === 'new';
  const close = () => go(`#/patient?id=${patient.id}&tab=visits`);
  const dn = (id: string | null) => setup.data?.dentists.find((x) => x.id === id)?.name;
  return (
    <div className="grid gap-4">
      {can('clinical.write') && <button className="btn btn-accent btn-sm justify-self-start" onClick={() => go(`#/patient?id=${patient.id}&tab=visits&visit=new`)}><Icon n="plus" className="h-4 w-4" />{d.visit.new}</button>}
      {q.isLoading ? <div className="skeleton h-40" /> : !q.data?.length ? <div className="panel"><Empty icon="tooth" text={d.visit.noVisits} /></div> : q.data.map((v) => (
        <section key={v.id} className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><b className="font-semibold">{date(v.at)}</b><span className="sub"> · {dateTime(v.at).split(/[,،]/).pop()}{dn(v.dentistId) ? ` · ${dn(v.dentistId)}` : ''}</span></div>
            {v.sale && <span className="text-end text-sm"><Money v={v.sale.total} className="font-semibold" />{v.sale.due > 0 && <span className="sub block">{d.visit.onAccount.replace('{n}', new Intl.NumberFormat().format(v.sale.due))}</span>}{v.sale.voidedAt && <span className="pill bad">✕</span>}</span>}
          </div>
          {v.items.length > 0 && <ul className="mt-2 grid gap-1 text-sm">{v.items.map((i: any) => <li key={i.id} className="flex justify-between gap-2"><span>{i.name}{i.tooth ? <span className="sub" dir="ltr"> · {i.tooth}{i.surfaces ? ' ' + i.surfaces : ''}</span> : ''}</span><Money v={i.amount} /></li>)}</ul>}
          {v.complaint && <p className="mt-2 text-sm"><b>{d.visit.complaint}:</b> {v.complaint}</p>}
          {v.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{v.notes}</p>}
          {v.anesthesia && <p className="sub mt-1">{d.visit.anesthesia}: {v.anesthesia}</p>}
          {v.amendments?.length > 0 && <div className="amendments">{v.amendments.map((a: any, k: number) => <p key={k}><span className="sub">{dateTime(a.at)} · </span>{a.text}</p>)}</div>}
          {v.rx?.length > 0 && <p className="sub mt-2">℞ {v.rx.flatMap((r: any) => r.items.map((i: any) => i.drug)).join('، ')}</p>}
          {can('clinical.write') && 'notes' in v && <button className="link-arrow mt-2 text-sm" onClick={() => setAmend(v)}>{d.visit.edit}</button>}
        </section>
      ))}
      {newOpen && <NewVisit patient={patient} appointmentId={params.get('appt')} onClose={close} />}
      {amend && <AmendSheet visit={amend} patient={patient} onClose={() => setAmend(null)} />}
    </div>
  );
}

type Line = { key: string; procedureId: string | null; planItemId: string | null; name: string; tooth: string; surfaces: string; currency: 'IQD' | 'USD'; price: number };

function NewVisit({ patient, appointmentId, onClose }: { patient: any; appointmentId: string | null; onClose(): void }) {
  const { d, t, toast, err, money, me, sys, lang, dateTime } = useD();
  const qc = useQueryClient();
  const setup = useSetup();
  const price = usePrice();
  const s = setup.data;
  const rate = s?.settings.usdRate ?? 1450;
  const plans = useQuery({ queryKey: ['dent-plans', patient.id], queryFn: async () => (await api(`/v1/dent/patients/${patient.id}/plans`)).plans as Plan[] });
  const myDentist = s?.dentists.find((x) => x.memberId && x.memberId === sys.memberId);
  const [dentistId, setDentistId] = useState('');
  const apptDentist = useQuery({ queryKey: ['dent-appt-dentist', appointmentId], enabled: !!appointmentId,
    queryFn: async () => ((await api(`/v1/dent/appointments?patientId=${patient.id}`)).appointments as any[]).find((a) => a.id === appointmentId)?.dentistId ?? null });
  useEffect(() => { if (!dentistId && s && (!appointmentId || apptDentist.isFetched)) setDentistId(apptDentist.data ?? myDentist?.id ?? s.dentists.find((x) => x.active)?.id ?? ''); }, [s, apptDentist.isFetched]); // eslint-disable-line react-hooks/exhaustive-deps
  const [complaint, setComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [anesthesia, setAnesthesia] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState<number | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [pq, setPq] = useState('');
  const [done, setDone] = useState<any>(null);
  const [rx, setRx] = useState(false);
  const planned = useMemo(() => (plans.data ?? []).filter((p) => ['accepted', 'in_progress', 'proposed'].includes(p.status)).flatMap((p) => p.items.filter((i) => i.status === 'planned').map((i) => ({ ...i, plan: p.title }))), [plans.data]);
  const togglePlanned = (i: any) => setLines((l) => (l.some((x) => x.planItemId === i.id) ? l.filter((x) => x.planItemId !== i.id)
    : [...l, { key: i.id, procedureId: i.procedureId, planItemId: i.id, name: i.name, tooth: i.tooth ? String(i.tooth) : '', surfaces: i.surfaces ?? '', currency: i.currency, price: i.price }]));
  const procs = (s?.procedures ?? []).filter((p) => p.active && (!pq.trim() || p.name.toLowerCase().includes(pq.trim().toLowerCase())));
  const addProc = (p: any) => { setLines((l) => [...l, { key: `${p.id}-${Date.now()}`, procedureId: p.id, planItemId: null, name: p.name, tooth: '', surfaces: '', currency: p.currency, price: p.price }]); setPq(''); };
  const total = Math.max(0, lines.reduce((t, l) => t + toIqd(l.currency, l.price, rate), 0) - (discount ?? 0));
  const payNow = paid ?? total;
  const save = useMutation({
    mutationFn: () => api('/v1/dent/visits', { body: { patientId: patient.id, appointmentId, dentistId: dentistId || null, complaint: complaint || null, notes: notes || null, anesthesia: anesthesia || null,
      items: lines.map((l) => ({ procedureId: l.procedureId, planItemId: l.planItemId, name: l.name, tooth: l.tooth ? Number(l.tooth) : null, surfaces: l.surfaces || null, price: l.price, currency: l.currency })),
      discount: discount ?? 0, paid: Math.min(payNow, total), method } }),
    onSuccess: (r: any) => { ['dent-visits', 'dent-plans', 'dent-chart', 'dent-patient', 'dent-dashboard', 'dent-appts', 'customers', 'shift', 'report'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(d.visit.saved); setDone(r); },
    onError: (e) => toast(err(e), 'bad'),
  });
  if (done) {
    const saleLines = done.items.map((i: any) => ({ id: i.id, productId: null, name: i.name + (i.tooth ? ` · ${i.tooth}` : ''), qty: 1, price: i.amount, total: i.amount }));
    return (
      <Sheet center title={d.visit.saved} onClose={onClose} footer={<button className="btn btn-accent justify-center" onClick={onClose}>{d.common.close}</button>}>
        {done.sale && <div className="big-total"><span className="sub">{d.visit.total}</span><b><Money v={done.sale.total} /></b></div>}
        {done.sale?.due > 0 && <div className="note"><Icon n="wallet" /><span>{d.visit.onAccount.replace('{n}', money(done.sale.due))}</span></div>}
        <div className="grid grid-cols-2 gap-2">
          {done.sale && <button className="btn btn-secondary justify-center" onClick={() => printSale(receiptData(lang, { shop: sys.business.name, logo: sys.business.logoUrl, city: sys.business.city, cashier: me.user.name, dateTime: dateTime(done.sale.createdAt), sale: done.sale, lines: saleLines, customer: done.customer }), done.sale.method === 'cash')}><Icon n="print" className="h-5 w-5" />{d.visit.receipt}</button>}
          <button className="btn btn-secondary justify-center" onClick={() => setRx(true)}><Icon n="pill" className="h-5 w-5" />{d.rx.new}</button>
        </div>
        {done.sale && <Receipt sale={done.sale} lines={saleLines} customer={done.customer} />}
        {rx && <RxSheet patient={patient} visitId={done.visit.id} onClose={() => setRx(false)} />}
      </Sheet>
    );
  }
  return (
    <Sheet title={d.visit.new} sub={patient.name} onClose={onClose}
      footer={<>
        <div className="flex justify-between text-lg font-bold"><span>{d.visit.total}</span><Money v={total} /></div>
        <button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{d.visit.save}</button>
      </>}>
      {patient.alerts?.length > 0 && <div className="note bad"><Icon n="alert" /><span>{patient.alerts.map((a: string) => d.medical.alerts[a] ?? a).join(' · ')}</span></div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.visit.dentist}<select className="input" value={dentistId} onChange={(e) => setDentistId(e.target.value)}>{s?.dentists.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="field">{d.visit.complaint}<input className="input" value={complaint} onChange={(e) => setComplaint(e.target.value)} /></label>
      </div>
      {planned.length > 0 && <section className="grid gap-1.5"><p className="sec-t !mb-0">{d.visit.fromPlan}</p>
        {planned.map((i) => <label key={i.id} className="plan-pick"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={lines.some((x) => x.planItemId === i.id)} onChange={() => togglePlanned(i)} />
          <span className="min-w-0 flex-1 truncate">{i.name}{i.tooth ? <span className="sub" dir="ltr"> · {i.tooth}</span> : null} <span className="sub">· {i.plan}</span></span><span className="sub">{price(i.currency, i.price)}</span></label>)}
      </section>}
      <section className="grid gap-2">
        <p className="sec-t !mb-0">{d.visit.items}</p>
        <div className="search"><Icon n="search" /><input className="input" placeholder={d.visit.add} value={pq} onChange={(e) => setPq(e.target.value)} /></div>
        {pq.trim() && <div className="panel rows max-h-44 overflow-y-auto">{procs.slice(0, 20).map((p) => <button type="button" key={p.id} className="row w-full text-start" onClick={() => addProc(p)}><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="sub">{price(p.currency, p.price)}</span></button>)}</div>}
        {!lines.length ? <p className="sub">{d.visit.noItems}</p> : lines.map((l, i) => {
          const set = (v: Partial<Line>) => setLines((x) => x.map((y, j) => (j === i ? { ...y, ...v } : y)));
          return (
            <div key={l.key} className="grid grid-cols-[1fr_3.8rem_4rem_5.5rem_auto] items-end gap-2 rounded-2xl border border-[var(--line)] p-2.5">
              <b className="min-w-0 truncate text-sm">{l.name}{l.planItemId && <span className="pill accent ms-1 !py-0 text-[10px]">✓</span>}</b>
              <label className="field text-xs">{d.plans.tooth}<input className="input !px-2" dir="ltr" inputMode="numeric" value={l.tooth} disabled={!!l.planItemId} onChange={(e) => set({ tooth: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></label>
              <label className="field text-xs">{d.visit.surfaces}<input className="input !px-2 uppercase" dir="ltr" value={l.surfaces} onChange={(e) => set({ surfaces: e.target.value.toUpperCase().replace(/[^MODBLI]/g, '') })} /></label>
              <label className="field text-xs">{l.currency === 'USD' ? '$' : d.visit.price}<input className="input !px-2" dir="ltr" inputMode="numeric" value={l.price} onChange={(e) => set({ price: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></label>
              <button type="button" className="icon-btn" onClick={() => setLines((x) => x.filter((_, j) => j !== i))} aria-label={d.common.delete}><Icon n="trash" /></button>
            </div>
          );
        })}
      </section>
      <section className="grid gap-2">
        <div className="flex items-center justify-between"><p className="sec-t !mb-0">{d.visit.notes}</p>
          <span className="flex flex-wrap gap-1">{d.tpl.map(([name, text]) => <button key={name} type="button" className="chip !px-2 !py-0.5 text-xs" onClick={() => setNotes((n) => (n ? n + '\n' : '') + text)}>{name}</button>)}</span></div>
        <textarea className="input min-h-28" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className="field">{d.visit.anesthesia}<input className="input" dir="auto" list="dent-anesthesia" value={anesthesia} onChange={(e) => setAnesthesia(e.target.value)} />
          <datalist id="dent-anesthesia">{['Lidocaine 2% × 1', 'Lidocaine 2% × 2', 'Articaine 4% × 1', 'Articaine 4% × 2', 'Mepivacaine 3% × 1'].map((x) => <option key={x} value={x} />)}</datalist></label>
      </section>
      {lines.length > 0 && <section className="grid gap-2">
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{d.visit.discount}<DinarInput value={discount} onChange={setDiscount} /></label>
          <label className="field">{d.visit.payNow}<DinarInput value={paid ?? total} onChange={setPaid} /></label>
        </div>
        <div className="seg">{(['cash', 'card'] as const).map((m) => <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>{m === 'cash' ? '💵' : '💳'} {t.sales.method[m]}</button>)}</div>
        {payNow < total && <div className="note"><Icon n="wallet" /><span>{d.visit.onAccount.replace('{n}', money(total - payNow))}</span></div>}
      </section>}
    </Sheet>
  );
}

function AmendSheet({ visit, patient, onClose }: { visit: any; patient: any; onClose(): void }) {
  const { d, toast, err, me } = useD();
  const qc = useQueryClient();
  const open = Date.now() - +new Date(visit.at) < 24 * 3600_000 && visit.createdBy === (me.user as any).id;
  const [text, setText] = useState(open ? visit.notes ?? '' : '');
  const save = useMutation({
    mutationFn: () => api(`/v1/dent/visits/${visit.id}`, { method: 'PATCH', body: open ? { notes: text } : { amendment: text } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dent-visits', patient.id] }); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  return (
    <Sheet center title={open ? d.visit.edit : d.visit.amend} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!text.trim() || save.isPending} onClick={() => save.mutate()}>{d.common.save}</button>}>
      {!open && <p className="note"><Icon n="info" /><span>{d.visit.amendHint}</span></p>}
      <textarea className="input min-h-32" autoFocus value={text} onChange={(e) => setText(e.target.value)} />
    </Sheet>
  );
}
