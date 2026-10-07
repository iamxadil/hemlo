// Deals: the pipeline (one column per stage), and a deal's own sheet — the negotiation as a timeline ($200k asking →
// $185k offer → $192k counter → $190k agreed), moving it along, closing it (which sells the home and sets the other
// offers aside), and the commission: expected, received, still to come.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet, toLatin } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Empty, Pill, RIcon, Timeline } from './ui';
import { Documents } from './PropertyFile';
import { DealContracts } from './Contracts';
import { fmt, price, titleOf, ago, waLink, stageTone, type Deal } from './data';

const STAGES = ['interested', 'viewing', 'offer', 'negotiation', 'reserved', 'closed'] as const;

export function Deals() {
  const { r, lang } = useR();
  const { params } = useRoute();
  const deals = useQuery<{ deals: Deal[] }>({ queryKey: ['re-deals'], queryFn: () => api('/v1/re/deals') });
  const comm = useQuery<any>({ queryKey: ['re-commission'], queryFn: () => api('/v1/re/commission') });
  const open = params.get('id');
  const list = deals.data?.deals ?? [];
  return (
    <div>
      {comm.data && Object.keys(comm.data.totals).length > 0 && (
        <div className="re-totals">{Object.entries(comm.data.totals as Record<string, any>).flatMap(([cur, t]) => [
          <div key={cur + 'e'} className="re-kpi"><small>{r.deals.expectedT} · {cur}</small><b>{price(t.expected, cur, lang)}</b></div>,
          <div key={cur + 'c'} className="re-kpi"><small>{r.deals.collected}</small><b style={{ color: 'var(--ok)' }}>{price(t.collected, cur, lang)}</b></div>,
          <div key={cur + 'p'} className="re-kpi"><small>{r.deals.pendingT}</small><b style={{ color: 'var(--warn)' }}>{price(t.pending, cur, lang)}</b></div>,
          <div key={cur + 'l'} className="re-kpi"><small>{r.deals.pipelineT}</small><b>{price(t.pipeline, cur, lang)}</b></div>,
        ])}</div>
      )}
      {deals.isLoading ? <div className="skeleton h-96" /> : !list.length ? <div className="panel"><Empty icon="wallet" title={r.deals.empty} /></div> : (
        <div className="re-pipe">
          {STAGES.map((s) => { const xs = list.filter((d) => d.stage === s); return (
            <section key={s} className="re-col">
              <h3><Pill tone={stageTone(s)}>{r.stages[s]}</Pill><span>{xs.length}</span></h3>
              {xs.map((d) => (
                <button key={d.id} className="re-deal" onClick={() => go(`#/deals?id=${d.id}`)}>
                  <span className="t">{d.property ? titleOf(d.property, lang) : ''}</span>
                  <span className="m"><span className="inline-flex items-center gap-1"><Avatar name={d.lead?.name ?? '?'} />{d.lead?.name}</span></span>
                  <span className="m"><span>{d.lastOffer && d.lastOffer.kind !== 'asking' ? r.offer[d.lastOffer.kind] : r.deals.asking}</span><b>{price(d.agreed ?? d.lastOffer?.amount ?? d.asking, d.currency, lang, null, true)}</b></span>
                  {d.commission && <span className="m"><span>{r.deals.commission}</span><b>{price(d.commission.total, d.currency, lang, null, true)}</b></span>}
                  <span className="m"><span>{ago(d.updatedAt, r)}</span></span>
                </button>
              ))}
            </section>
          ); })}
        </div>
      )}
      {open && <DealSheet id={open} onClose={() => go('#/deals')} />}
    </div>
  );
}

export function DealSheet({ id, onClose }: { id: string; onClose(): void }) {
  const { r, lang, can, toast, err } = useR();
  const qc = useQueryClient();
  const [closed, setClosed] = useState(false);
  const q = useQuery<any>({ queryKey: ['re-deal', id], queryFn: () => api(`/v1/re/deals/${id}`) });
  const [kind, setKind] = useState('offer'), [amount, setAmount] = useState(''), [note, setNote] = useState('');
  const [pay, setPay] = useState(''), [from, setFrom] = useState('owner'), [lose, setLose] = useState(false), [reason, setReason] = useState(''), [confirmClose, setConfirmClose] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['re-deal', id] }); qc.invalidateQueries({ queryKey: ['re-deals'] }); qc.invalidateQueries({ queryKey: ['re-commission'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); qc.invalidateQueries({ queryKey: ['re-props'] }); };
  const n = (v: string) => { const d = toLatin(v).replace(/[^\d]/g, ''); return d ? Number(d) : null; };
  const offer = useMutation({ mutationFn: () => api(`/v1/re/deals/${id}/offers`, { body: { kind, amount: n(amount), note } }), onSuccess: () => { setAmount(''); setNote(''); refresh(); }, onError: (e) => toast(err(e), 'bad') });
  const move = useMutation({ mutationFn: (body: Record<string, unknown>) => api(`/v1/re/deals/${id}`, { method: 'PATCH', body }), onSuccess: (_x, b) => { refresh(); if (b.stage === 'closed') setClosed(true); setLose(false); setConfirmClose(false); }, onError: (e) => toast(err(e), 'bad') });
  const paid = useMutation({ mutationFn: () => api(`/v1/re/deals/${id}/payments`, { body: { amount: n(pay), from } }), onSuccess: () => { setPay(''); refresh(); }, onError: (e) => toast(err(e), 'bad') });
  if (!q.data) return <Sheet title={r.deals.title} onClose={onClose}><div className="skeleton h-64" /></Sheet>;
  const { deal: d, property: p, lead, owner, offers, payments, activity } = q.data;
  const isOpen = !['closed', 'lost'].includes(d.stage);
  const steps = offers as { id: string; kind: string; amount: number | null; note: string | null; at: string }[];
  if (closed) return (
    <Sheet title={r.deals.closed} onClose={onClose} center footer={<button className="btn btn-accent justify-center" onClick={onClose}>{r.common.done}</button>}>
      <div className="re-live"><span className="ok"><RIcon n="star" /></span><h3>{r.deals.closed}</h3><p className="sub">{p ? titleOf(p, lang) : ''} · {lead?.name}</p>
        {d.commission && <p className="re-price-big" style={{ textAlign: 'center' }}>{price(d.commission.total, d.currency, lang)}</p>}{d.commission && <p className="sub">{r.deals.commission}</p>}</div>
    </Sheet>
  );
  return (
    <Sheet title={p ? titleOf(p, lang) : r.deals.title} sub={<span className="inline-flex flex-wrap items-center gap-2"><Pill tone={stageTone(d.stage)}>{r.stages[d.stage]}</Pill>{lead?.name}{owner ? ` · ${owner.name}` : ''}</span>} onClose={onClose}>
      {p?.cover && <button onClick={() => go(`#/property?id=${p.id}`)}><img src={p.cover} alt="" className="h-36 w-full rounded-xl object-cover" /></button>}
      <div className="grid grid-cols-2 gap-2">
        <div className="re-kpi"><small>{r.deals.asking}</small><b className="text-xl">{price(d.asking, d.currency, lang)}</b></div>
        <div className="re-kpi"><small>{r.deals.agreed}</small><b className="text-xl">{d.agreed != null ? price(d.agreed, d.currency, lang) : '—'}</b></div>
        {d.commission && <><div className="re-kpi"><small>{r.deals.commission}</small><b className="text-xl">{price(d.commission.total, d.currency, lang)}</b><span>{r.deals.agentPart}: {price(d.commission.agent, d.currency, lang)}</span></div>
          <div className="re-kpi"><small>{r.deals.paid}</small><b className="text-xl" style={{ color: 'var(--ok)' }}>{price(d.paid ?? 0, d.currency, lang)}</b><span>{r.deals.pending}: {price(Math.max(0, d.commission.total - (d.paid ?? 0)), d.currency, lang)}</span></div></>}
      </div>
      <div className="flex flex-wrap gap-2">
        {lead && waLink(lead.whatsapp ?? lead.phone) && <a className="btn btn-wa btn-sm" href={waLink(lead.whatsapp ?? lead.phone)!} target="_blank" rel="noopener"><Icon n="wa" />{lead.name}</a>}
        {owner && waLink(owner.whatsapp ?? owner.phone) && <a className="btn btn-secondary btn-sm" href={waLink(owner.whatsapp ?? owner.phone)!} target="_blank" rel="noopener"><Icon n="wa" />{owner.name}</a>}
      </div>

      <div><p className="sec-t">{r.deals.timeline}</p>
        <div className="panel re-nego">{steps.map((o) => <div key={o.id} className={o.kind}><span className="dot" /><span><b>{price(o.amount, d.currency, lang)}</b> <span className="sub">{r.offer[o.kind]}{o.note ? ` · ${o.note}` : ''}</span></span><span className="sub">{ago(o.at, r)}</span></div>)}</div>
      </div>
      {isOpen && can('deals.manage') && <div className="panel grid gap-2 p-3">
        <p className="sec-t m-0">{r.deals.addOffer}</p>
        <div className="chips">{(['offer', 'counter', 'agreed', 'rejected'] as const).map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{r.offer[k]}</button>)}</div>
        <div className="grid grid-cols-[1fr_auto] gap-2"><input className="input money" dir="ltr" inputMode="numeric" placeholder={r.deals.amount} value={amount ? new Intl.NumberFormat('en-US').format(n(amount) ?? 0) : ''} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn btn-accent" disabled={offer.isPending || (!n(amount) && kind !== 'rejected')} onClick={() => offer.mutate()}>{r.deals.save}</button></div>
        <input className="input" placeholder={r.deals.note} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>}

      {isOpen && can('deals.manage') && <div><p className="sec-t">{r.deals.moveTo}</p>
        <div className="chips">{STAGES.filter((s) => s !== d.stage && s !== 'closed').map((s) => <button key={s} className="chip" onClick={() => move.mutate({ stage: s })}>{r.stages[s]}</button>)}</div>
        {confirmClose ? <div className="note mt-2"><Icon n="info" /><span className="flex-1">{fmt(r.deals.closeQ, { status: r.status[d.purpose === 'rent' ? 'rented' : 'sold'] })}</span><button className="btn btn-accent btn-sm" onClick={() => move.mutate({ stage: 'closed' })}>{r.deals.close}</button></div>
          : <div className="mt-2 grid grid-cols-2 gap-2"><button className="btn btn-accent justify-center" onClick={() => setConfirmClose(true)}><RIcon n="star" />{r.deals.close}</button><button className="btn btn-danger justify-center" onClick={() => setLose(true)}>{r.deals.lose}</button></div>}
        {lose && <div className="mt-2 grid gap-2"><input className="input" placeholder={r.deals.lostReason} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /><button className="btn btn-danger" onClick={() => move.mutate({ stage: 'lost', lostReason: reason })}>{r.deals.lose}</button></div>}
      </div>}

      {d.commission && <div><p className="sec-t">{r.deals.payments}</p>
        <div className="panel">{payments.map((x: any) => <div key={x.id} className="re-item"><span className="min-w-0 flex-1">{r.deals.from[x.from]}<span className="sub"> · {x.paidOn}</span></span><b className="re-num">{price(Number(x.amount), d.currency, lang)}</b></div>)}
          {!payments.length && <p className="sub p-3">—</p>}</div>
        {can('commission.manage') && <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2">
          <input className="input money" dir="ltr" inputMode="numeric" placeholder={r.deals.amount} value={pay ? new Intl.NumberFormat('en-US').format(n(pay) ?? 0) : ''} onChange={(e) => setPay(e.target.value)} />
          <select className="re-select" value={from} onChange={(e) => setFrom(e.target.value)}>{Object.entries(r.deals.from).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          <button className="btn btn-accent" disabled={!n(pay) || paid.isPending} onClick={() => paid.mutate()}>{r.deals.addPayment}</button></div>}
        {can('commission.manage') && <CommissionTerms d={d} onSave={(b) => move.mutate(b)} />}
      </div>}

      <div><p className="sec-t">{r.contract.ofDeal}</p><DealContracts dealId={id} purpose={d.purpose} /></div>
      <div><p className="sec-t">{r.prop.documents}</p><Documents docs={q.data.documents} dealId={id} onChanged={refresh} /></div>
      <div><p className="sec-t">{r.lead.activity}</p><div className="panel"><Timeline items={activity} /></div></div>
    </Sheet>
  );
}

function CommissionTerms({ d, onSave }: { d: Deal; onSave(b: Record<string, unknown>): void }) {
  const { r } = useR();
  const [kind, setKind] = useState(d.commissionKind), [value, setValue] = useState(String(d.commissionKind === 'percent' ? (d.commissionValue ?? 0) / 100 : d.commissionValue ?? 0)), [share, setShare] = useState(String((d.agentShare ?? 0) / 100));
  return (
    <details className="mt-3"><summary className="sub cursor-pointer">{r.deals.terms}</summary>
      <div className="mt-2 grid gap-2">
        <div className="seg">{(['percent', 'fixed'] as const).map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'percent' ? r.deals.percent : r.deals.fixed}</button>)}</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="field">{kind === 'percent' ? '%' : r.deals.amount}<input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(toLatin(e.target.value))} /></label>
          <label className="field">{r.deals.share}<input className="input" inputMode="decimal" value={share} onChange={(e) => setShare(toLatin(e.target.value))} /></label>
        </div>
        <button className="btn btn-secondary" onClick={() => onSave({ commissionKind: kind, commissionValue: kind === 'percent' ? Math.round(Number(value) * 100) : Math.round(Number(value)), agentShare: Math.round(Number(share) * 100) })}>{r.common.save}</button>
      </div>
    </details>
  );
}
