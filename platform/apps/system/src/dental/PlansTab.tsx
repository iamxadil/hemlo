// Treatment plans: procedures on teeth, in phases, in IQD or USD; options side by side (accepting one declines the
// others); a quote to print or send on WhatsApp; and a payment schedule for long treatments.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DinarInput, Empty, Icon, Sheet } from '../components/ui';
import { useD } from './i18n';
import { useSetup, usePrice, toIqd, waLink, todayISO, type Plan, type Procedure } from './data';
import { printDoc, esc } from './print';

export function PlansTab({ patient }: { patient: any }) {
  const { d, can } = useD();
  const q = useQuery({ queryKey: ['dent-plans', patient.id], queryFn: async () => (await api(`/v1/dent/patients/${patient.id}/plans`)).plans as Plan[] });
  const [building, setBuilding] = useState(false);
  const plans = q.data ?? [];
  const groups = useMemo(() => {
    const out: { key: string; plans: Plan[] }[] = [];
    for (const p of plans) { const k = p.optionGroup ? `g:${p.optionGroup}` : p.id; const g = out.find((x) => x.key === k); if (g) g.plans.push(p); else out.push({ key: k, plans: [p] }); }
    return out;
  }, [plans]);
  return (
    <div className="grid gap-4">
      {can('clinical.write') && <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setBuilding(true)}><Icon n="plus" className="h-4 w-4" />{d.plans.new}</button>}
      {q.isLoading ? <div className="skeleton h-40" /> : !plans.length ? <div className="panel"><Empty icon="tooth" text={d.plans.empty} /></div> : groups.map((g) => (
        <div key={g.key} className={g.plans.length > 1 ? 'plan-options' : ''}>
          {g.plans.length > 1 && <p className="sec-t">{d.plans.options}</p>}
          <div className={g.plans.length > 1 ? 'grid gap-3 lg:grid-cols-2' : ''}>{g.plans.map((p) => <PlanCard key={p.id} plan={p} patient={patient} />)}</div>
        </div>
      ))}
      {building && <PlanBuilder patient={patient} onClose={() => setBuilding(false)} />}
    </div>
  );
}

function PlanCard({ plan, patient }: { plan: Plan; patient: any }) {
  const { d, can, toast, err, money, date, sys, lang } = useD();
  const qc = useQueryClient();
  const price = usePrice();
  const [adding, setAdding] = useState(false);
  const [sched, setSched] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['dent-plans', patient.id] }); qc.invalidateQueries({ queryKey: ['dent-chart', patient.id] }); };
  const decide = useMutation({ mutationFn: (status: string) => api(`/v1/dent/plans/${plan.id}`, { method: 'PATCH', body: { status } }), onSuccess: refresh, onError: (e) => toast(err(e), 'bad') });
  const cancelItem = useMutation({ mutationFn: (id: string) => api(`/v1/dent/plan-items/${id}`, { method: 'PATCH', body: { status: 'canceled' } }), onSuccess: refresh, onError: (e) => toast(err(e), 'bad') });
  const paid = useMutation({ mutationFn: ({ id, v }: { id: string; v: boolean }) => api(`/v1/dent/installments/${id}`, { method: 'PATCH', body: { paid: v } }), onSuccess: refresh, onError: (e) => toast(err(e), 'bad') });
  const T = plan.totals;
  const items = plan.items.filter((i) => i.status !== 'canceled');
  const quoteLines = items.map((i) => `• ${i.name}${i.tooth ? ` (${i.tooth}${i.surfaces ? ' ' + i.surfaces : ''})` : ''}: ${price(i.currency, i.price)}`);
  const quoteText = [d.plans.quoteText.replace('{clinic}', sys.business.name).replace('{name}', patient.name), plan.title, ...quoteLines,
    `${d.plans.total}: ${money(T.net)}${T.usd ? ` (${d.plans.usdAt.replace('{usd}', String(T.usd)).replace('{rate}', String(T.rate))})` : ''}`].join('\n');
  const printQuote = () => printDoc({ lang, clinic: sys.business.name, logo: sys.business.logoUrl, title: `${d.plans.quote} · ${patient.name}`, body: `
    <h2>${esc(d.plans.quote)}: ${esc(plan.title)}</h2><div class="meta"><span>${esc(patient.name)} · ${esc(d.patients.file)} ${esc(patient.fileNo)}</span><span>${esc(date(new Date().toISOString()))}</span></div>
    <table><thead><tr><th>${esc(d.plans.phase)}</th><th>${esc(d.plans.item)}</th><th>${esc(d.plans.tooth)}</th><th class="num">${esc(d.plans.price)}</th></tr></thead><tbody>
    ${items.map((i) => `<tr><td>${i.phase}</td><td>${esc(i.name)}</td><td>${esc(i.tooth ?? '')} ${esc(i.surfaces ?? '')}</td><td class="num">${esc(price(i.currency, i.price))}</td></tr>`).join('')}
    ${plan.discount ? `<tr><td colspan="3">${esc(d.plans.discount)}</td><td class="num">−${esc(money(plan.discount))}</td></tr>` : ''}
    <tr class="total"><td colspan="3">${esc(d.plans.total)}</td><td class="num">${esc(money(T.net))}</td></tr></tbody></table>
    ${T.usd ? `<p class="muted">${esc(d.plans.usdAt.replace('{usd}', String(T.usd)).replace('{rate}', String(T.rate)))}</p>` : ''}${plan.note ? `<p>${esc(plan.note)}</p>` : ''}` });
  return (
    <section className={`panel plan st-${plan.status}`}>
      <div className="panel-h flex-wrap">
        <div className="min-w-0"><h2 className="truncate">{plan.title}</h2><p>{d.plans.kinds[plan.kind] ?? plan.kind} · {d.plans.doneN.replace('{done}', String(T.done)).replace('{count}', String(T.count))}</p></div>
        <span className={`pill plan-${plan.status}`}>{d.plans.status[plan.status]}</span>
      </div>
      <ul className="plan-items">
        {plan.items.map((i) => (
          <li key={i.id} className={`st-${i.status}`}>
            <span className="ph">{i.phase}</span>
            <span className="min-w-0 flex-1 truncate">{i.name}{i.tooth ? <span className="sub" dir="ltr"> · {i.tooth}{i.surfaces ? ' ' + i.surfaces : ''}</span> : null}</span>
            <span className="font-medium">{price(i.currency, i.price)}</span>
            {i.status === 'done' ? <Icon n="check" className="h-4 w-4 text-[var(--ok)]" /> : i.status === 'planned' && can('clinical.write') && !['declined', 'completed'].includes(plan.status)
              ? <button className="icon-btn !h-7 !w-7" aria-label={d.common.delete} onClick={() => cancelItem.mutate(i.id)}><Icon n="close" className="h-3.5 w-3.5" /></button> : <span className="w-7" />}
          </li>
        ))}
      </ul>
      <div className="plan-total">
        {plan.discount > 0 && <div className="flex justify-between text-sm"><span className="muted">{d.plans.discount}</span><span>−{money(plan.discount)}</span></div>}
        <div className="flex justify-between text-lg font-semibold"><span>{d.plans.total}</span><span>{money(T.net)}</span></div>
        {T.usd > 0 && <p className="sub">{d.plans.usdAt.replace('{usd}', String(T.usd)).replace('{rate}', new Intl.NumberFormat().format(T.rate))}</p>}
      </div>
      {plan.installments.length > 0 && (
        <div className="px-5 pb-3"><p className="sec-t">{d.plans.installments}</p>
          <ul className="grid gap-1 text-sm">{plan.installments.map((x) => (
            <li key={x.id} className="flex items-center gap-2"><span className="flex-1">{date(x.dueDate)}</span><span className="font-medium">{money(x.amount)}</span>
              <button className={`chip !px-2 !py-0.5 text-xs${x.paidAt ? ' ok' : ''}`} disabled={!can('sales.create')} onClick={() => paid.mutate({ id: x.id, v: !x.paidAt })}>{x.paidAt ? d.plans.paid : d.plans.markPaid}</button></li>
          ))}</ul></div>
      )}
      <div className="flex flex-wrap gap-2 px-5 pb-5">
        {plan.status === 'proposed' && can('patients.update') && <><button className="btn btn-accent btn-sm" onClick={() => decide.mutate('accepted')}>{d.plans.accept}</button><button className="btn btn-secondary btn-sm" onClick={() => decide.mutate('declined')}>{d.plans.decline}</button></>}
        {can('clinical.write') && !['declined', 'completed'].includes(plan.status) && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{d.plans.addItem}</button>}
        <button className="btn btn-secondary btn-sm" onClick={printQuote}><Icon n="print" className="h-4 w-4" />{d.plans.printQuote}</button>
        {patient.phone && <a className="btn btn-wa btn-sm" href={waLink(patient.phone, quoteText)!} target="_blank" rel="noopener"><Icon n="wa" className="h-4 w-4" />{d.plans.sendQuote}</a>}
        {can('sales.create') && ['accepted', 'in_progress'].includes(plan.status) && <button className="btn btn-secondary btn-sm" onClick={() => setSched(true)}>{d.plans.installments}</button>}
      </div>
      {adding && <PlanBuilder patient={patient} plan={plan} onClose={() => { setAdding(false); refresh(); }} />}
      {sched && <ScheduleSheet plan={plan} onClose={() => { setSched(false); refresh(); }} />}
    </section>
  );
}

type Row = { procedureId: string; tooth: string; surfaces: string; phase: number; price: number | null; currency: 'IQD' | 'USD' };
/** Build a plan (or add to one): procedures on teeth. Picking a procedure with several teeth selected adds one line per tooth. */
export function PlanBuilder({ patient, plan, teeth = [], surfaces = '', onClose }: { patient: any; plan?: Plan; teeth?: number[]; surfaces?: string; onClose(): void }) {
  const { d, toast, err, money } = useD();
  const qc = useQueryClient();
  const setup = useSetup();
  const price = usePrice();
  const procs = (setup.data?.procedures ?? []).filter((p) => p.active);
  const rate = setup.data?.settings.usdRate ?? 1450;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('general');
  const [option, setOption] = useState('');
  const [discount, setDiscount] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pq, setPq] = useState('');
  const add = (p: Procedure) => {
    const ts = teeth.length && ['tooth', 'surface'].includes(p.scope) ? teeth : [null];
    setRows((r) => [...r, ...ts.map((t) => ({ procedureId: p.id, tooth: t ? String(t) : '', surfaces: p.scope === 'surface' ? surfaces : '', phase: 1, price: null, currency: p.currency }))]);
    setPq('');
    if (!title && !plan) setTitle(p.name + (teeth.length ? ` · ${teeth.join('، ')}` : ''));
  };
  const procOf = (id: string) => procs.find((p) => p.id === id);
  const total = rows.reduce((s, r) => s + toIqd(r.currency, r.price ?? procOf(r.procedureId)?.price ?? 0, rate), 0);
  const found = pq.trim() ? procs.filter((p) => p.name.toLowerCase().includes(pq.trim().toLowerCase())) : procs;
  const save = useMutation({
    mutationFn: () => {
      const items = rows.map((r) => ({ procedureId: r.procedureId, tooth: r.tooth ? Number(r.tooth) : null, surfaces: r.surfaces || null, phase: r.phase, ...(r.price != null ? { price: r.price, currency: r.currency } : {}) }));
      return plan ? api(`/v1/dent/plans/${plan.id}/items`, { body: { items } }) : api('/v1/dent/plans', { body: { patientId: patient.id, title, kind, optionGroup: option || null, discount: discount ?? 0, items } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dent-plans', patient.id] }); qc.invalidateQueries({ queryKey: ['dent-chart', patient.id] }); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const groups = [...new Set((qc.getQueryData<Plan[]>(['dent-plans', patient.id]) ?? []).map((p) => p.optionGroup).filter(Boolean))] as string[];
  return (
    <Sheet title={plan ? `${d.plans.addItem} · ${plan.title}` : d.plans.new} onClose={onClose}
      footer={<><div className="flex justify-between text-lg font-bold"><span>{d.plans.total}</span><span>{money(Math.max(0, total - (discount ?? 0)))}</span></div>
        <button className="btn btn-accent justify-center" disabled={!rows.length || (!plan && !title.trim()) || save.isPending} onClick={() => save.mutate()}>{d.plans.save}</button></>}>
      {!plan && <>
        <label className="field">{d.plans.title}<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{d.plans.kind}<select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(d.plans.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field">{d.plans.optionOf}<input className="input" list="dent-groups" placeholder={teeth.join(', ')} value={option} onChange={(e) => setOption(e.target.value)} /><datalist id="dent-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></label>
        </div>
      </>}
      {teeth.length > 0 && <p className="sub">{d.chart.selected.replace('{teeth}', teeth.join('، '))}{surfaces ? ` · ${surfaces}` : ''}</p>}
      <div className="search"><Icon n="search" /><input className="input" placeholder={d.plans.pickProc} value={pq} onChange={(e) => setPq(e.target.value)} /></div>
      <div className="panel rows max-h-52 overflow-y-auto">{found.slice(0, 40).map((p) => (
        <button type="button" key={p.id} className="row w-full text-start" onClick={() => add(p)}><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="sub">{price(p.currency, p.price)}</span></button>
      ))}</div>
      {rows.map((r, i) => {
        const p = procOf(r.procedureId);
        const set = (v: Partial<Row>) => setRows((x) => x.map((y, j) => (j === i ? { ...y, ...v } : y)));
        return (
          <div key={i} className="grid grid-cols-[1fr_4rem_4.5rem_3.5rem_auto] items-end gap-2 rounded-2xl border border-[var(--line)] p-2.5">
            <div className="min-w-0"><b className="block truncate text-sm">{p?.name}</b><span className="sub">{price(r.currency, r.price ?? p?.price ?? 0)}</span></div>
            <label className="field text-xs">{d.plans.tooth}<input className="input !px-2" dir="ltr" inputMode="numeric" value={r.tooth} onChange={(e) => set({ tooth: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></label>
            <label className="field text-xs">{d.plans.price}<input className="input !px-2" dir="ltr" inputMode="numeric" placeholder={String(p?.price ?? '')} value={r.price ?? ''} onChange={(e) => set({ price: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) })} /></label>
            <label className="field text-xs">{d.plans.phase}<input className="input !px-2" dir="ltr" inputMode="numeric" value={r.phase} onChange={(e) => set({ phase: Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1) })} /></label>
            <button type="button" className="icon-btn" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label={d.common.delete}><Icon n="trash" /></button>
          </div>
        );
      })}
      {!plan && rows.length > 0 && <label className="field">{d.plans.discount}<DinarInput value={discount} onChange={setDiscount} /></label>}
    </Sheet>
  );
}

function ScheduleSheet({ plan, onClose }: { plan: Plan; onClose(): void }) {
  const { d, toast, err, money } = useD();
  const [months, setMonths] = useState(6);
  const [down, setDown] = useState<number | null>(null);
  const [first, setFirst] = useState(todayISO());
  const save = useMutation({ mutationFn: () => api(`/v1/dent/plans/${plan.id}/installments`, { body: { months, downPayment: down ?? 0, firstDue: first } }), onSuccess: onClose, onError: (e) => toast(err(e), 'bad') });
  const each = Math.floor((plan.totals.net - (down ?? 0)) / Math.max(1, months) / 250) * 250;
  return (
    <Sheet center title={d.plans.installments} sub={`${d.plans.total}: ${money(plan.totals.net)}`} onClose={onClose}
      footer={<button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{d.plans.makeSchedule}</button>}>
      <label className="field">{d.plans.down}<DinarInput value={down} onChange={setDown} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.plans.months}<input className="input" dir="ltr" inputMode="numeric" value={months} onChange={(e) => setMonths(Math.max(1, Math.min(60, Number(e.target.value.replace(/\D/g, '')) || 1)))} /></label>
        <label className="field">{d.plans.firstDue}<input className="input" type="date" dir="ltr" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
      </div>
      <p className="note"><Icon n="calendar" /><span>{months} × {money(Math.max(0, each))}</span></p>
    </Sheet>
  );
}
