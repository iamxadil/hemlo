// Contracts: a sale, a rent, a deposit receipt or the owner's authorisation, drawn up from the deal in a minute.
// The editor is the form on one side and the paper on the other, updating as you type; it saves itself, prints (or
// saves a PDF) on A4, and once signed it is fixed. The amounts are written out in words, the balance works itself out.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, postBlob } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet, toLatin } from '../components/ui';
import { RSTRINGS, useR } from './i18n';
import { Empty, Pill, RIcon, LeadPicker } from './ui';
import { PropertyPicker } from './Agenda';
import { fmt, price } from './data';
import { inWords } from './words';

type L = 'ar' | 'en';
type Party = { name: string; idNo?: string | null; address?: string | null; phone?: string | null; rep?: string | null };
export type CData = {
  purpose: 'sale' | 'rent'; date: string; place?: string | null; first: Party; second: Party;
  agency: { name: string; phone?: string | null; address?: string | null; agent?: string | null };
  property: { type?: string | null; ref?: number | null; title?: string | null; address?: string | null; area?: string | null; city?: string | null; plot?: string | null; size?: number | null; land?: number | null; rooms?: string | null; details?: string | null };
  money: { currency: 'USD' | 'IQD'; price?: number | null; paid?: number | null; restDue?: string | null; rent?: number | null; period?: 'month' | 'year'; start?: string | null; end?: string | null;
    payEvery?: 'month' | 'quarter' | 'half' | 'year'; insurance?: number | null; deposit?: number | null; holdUntil?: string | null;
    commission?: number | null; commissionNote?: string | null; commissionBy?: 'first' | 'second' | 'both' | null; exclusive?: boolean; validUntil?: string | null };
  clauses: string[]; witnesses: { name: string; idNo?: string | null }[]; notes?: string | null;
};
export interface Contract { id: string; number: number; kind: string; status: 'draft' | 'signed' | 'void'; lang: L; dealId: string | null; propertyId: string | null; leadId: string | null; ownerId: string | null;
  data: CData; documentId: string | null; signedAt: string | null; createdAt: string; updatedAt: string }
interface Row { id: string; number: number; kind: string; status: string; first: string | null; second: string | null; title: string | null; currency: string | null; amount: number | null; date: string | null; updatedAt: string }

const KINDS = ['sale', 'rent', 'deposit', 'brokerage'] as const;
const KIND_ICON: Record<string, string> = { sale: 'key', rent: 'calendar', deposit: 'wallet', brokerage: 'pen' };
const statusTone = (s: string) => (s === 'signed' ? 'ok' : s === 'void' ? 'idle' : 'warn');
const nf = new Intl.NumberFormat('en-US');
const day = (iso?: string | null) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}/${y}`; };
const contractLang = (l: string): L => (l === 'en' ? 'en' : 'ar');
const rolesOf = (kind: string, purpose: string, R: (typeof RSTRINGS)['ar']['contract']) => R.roles[kind === 'deposit' && purpose === 'rent' ? 'depositRent' : kind] ?? R.roles.sale;

// ---------- the list ----------
export function Contracts() {
  const { r, lang, can } = useR();
  const { params } = useRoute();
  const [q, setQ] = useState(''), [dq, setDq] = useState(''), [kind, setKind] = useState(''), [adding, setAdding] = useState(params.get('new') === '1');
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  const list = useQuery<{ contracts: Row[] }>({ queryKey: ['re-contracts', kind, dq], queryFn: () => api(`/v1/re/contracts?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(dq ? { q: dq } : {}) })}`), placeholderData: (x) => x });
  const rows = list.data?.contracts ?? [];
  return (
    <div className="grid gap-4">
      <div className="ct-bar">
        <div className="search flex-1"><Icon n="search" /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={r.contract.search} /></div>
        {can('deals.manage') && <button className="btn btn-accent" onClick={() => setAdding(true)}><Icon n="plus" />{r.contract.new}</button>}
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={!kind} onClick={() => setKind('')}>{r.contract.all}</button>
        {KINDS.map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{r.contract.kinds[k]}</button>)}
      </div>
      {list.isLoading ? <div className="skeleton h-64" /> : !rows.length ? <div className="panel"><Empty icon="file" title={r.contract.empty} /></div> : (
        <div className="panel">{rows.map((x) => <ContractRow key={x.id} x={x} lang={lang} />)}</div>
      )}
      {adding && <NewContract onClose={() => setAdding(false)} />}
    </div>
  );
}

function ContractRow({ x, lang }: { x: Row; lang: string }) {
  const { r } = useR();
  return (
    <button className="re-item" onClick={() => go(`#/contract?id=${x.id}`)}>
      <span className="ct-no"><RIcon n={KIND_ICON[x.kind] ?? 'file'} /></span>
      <span className="min-w-0 flex-1">
        <b className="block truncate font-medium">{r.contract.kinds[x.kind]} · #{x.number}</b>
        <span className="sub block truncate">{[x.first, x.second].filter(Boolean).join(' ⇄ ')}{x.title ? ` · ${x.title}` : ''}</span>
      </span>
      {x.amount != null && <b className="re-num hidden sm:block">{price(x.amount, x.currency ?? 'USD', lang as L)}</b>}
      <Pill tone={statusTone(x.status)}>{r.contract.status[x.status]}</Pill>
    </button>
  );
}

// ---------- a new contract: which kind, which property, which lead ----------
export function NewContract({ onClose, propertyId, dealId, purpose }: { onClose(): void; propertyId?: string; dealId?: string; purpose?: string }) {
  const { r, lang, toast, err } = useR();
  const qc = useQueryClient();
  const [kind, setKind] = useState<string | null>(null), [prop, setProp] = useState<string | null>(propertyId ?? null), [busy, setBusy] = useState(false);
  const kinds = dealId ? [purpose === 'rent' ? 'rent' : 'sale', 'deposit'] : purpose === 'rent' ? ['rent', 'deposit', 'brokerage'] : purpose === 'sale' ? ['sale', 'deposit', 'brokerage'] : [...KINDS];
  const make = async (k: string, p: string | null, leadId?: string) => {
    setBusy(true);
    try {
      const x = await api<{ contract: Contract }>('/v1/re/contracts', { body: { kind: k, lang: contractLang(lang), dealId, propertyId: p, leadId } });
      qc.invalidateQueries({ queryKey: ['re-contracts'] });
      onClose(); go(`#/contract?id=${x.contract.id}`);
    } catch (e) { toast(err(e), 'bad'); setBusy(false); }
  };
  const pickKind = (k: string) => { setKind(k); if (dealId) make(k, null); else if (k === 'brokerage' && prop) make(k, prop); };
  return (
    <Sheet title={r.contract.new} sub={kind ? r.contract.kinds[kind] : r.contract.pickKind} onClose={onClose} center>
      {busy ? <div className="grid place-items-center gap-3 py-10"><span className="spinner" /><span className="sub">{r.contract.making}</span></div>
        : !kind ? (
          <div className="grid gap-2">{kinds.map((k) => (
            <button key={k} className="ct-kind" onClick={() => pickKind(k)}>
              <span className="ct-no"><RIcon n={KIND_ICON[k]} /></span>
              <span className="min-w-0 flex-1"><b className="block">{r.contract.kinds[k]}</b><span className="sub">{r.contract.kindHelp[k]}</span></span>
              <Icon n="back" className="ct-go h-4 w-4" />
            </button>
          ))}</div>
        ) : !prop ? (
          <div className="grid gap-2"><p className="sec-t m-0">{r.contract.pickProperty}</p><PropertyPicker live={false} onPick={(p) => { setProp(p.id); if (kind === 'brokerage') make(kind, p.id); }} /></div>
        ) : (
          <div className="grid gap-2"><p className="sec-t m-0">{r.contract.pickLead}</p><LeadPicker onPick={(l) => make(kind, prop, l.id)} />
            <button className="btn btn-secondary justify-center" onClick={() => make(kind, prop)}>{r.contract.skipLead}</button></div>
        )}
    </Sheet>
  );
}

/** A deal's contracts, and the two it usually needs, one tap each. */
export function DealContracts({ dealId, purpose }: { dealId: string; purpose: string }) {
  const { r, lang, can, toast, err } = useR();
  const list = useQuery<{ contracts: Row[] }>({ queryKey: ['re-contracts', 'deal', dealId], queryFn: () => api(`/v1/re/contracts?dealId=${dealId}`) });
  const make = useMutation({ mutationFn: (kind: string) => api<{ contract: Contract }>('/v1/re/contracts', { body: { kind, dealId, lang: contractLang(lang) } }),
    onSuccess: (x) => go(`#/contract?id=${x.contract.id}`), onError: (e) => toast(err(e), 'bad') });
  const rows = list.data?.contracts ?? [];
  return (
    <div className="panel">
      {rows.map((x) => <ContractRow key={x.id} x={x} lang={lang} />)}
      {!rows.length && <p className="sub p-4">{r.contract.noneForDeal}</p>}
      {can('deals.manage') && <div className="flex flex-wrap gap-2 border-t border-[var(--line)] p-3">
        {[purpose === 'rent' ? 'rent' : 'sale', 'deposit'].map((k) => (
          <button key={k} className="btn btn-secondary btn-sm" disabled={make.isPending} onClick={() => make.mutate(k)}><RIcon n={KIND_ICON[k]} />{fmt(r.contract.write, { kind: r.contract.kinds[k] })}</button>
        ))}
      </div>}
    </div>
  );
}

// ---------- the editor ----------
export function ContractEditor() {
  const { r, can, toast, err } = useR();
  const { params } = useRoute();
  const id = params.get('id') ?? '';
  const qc = useQueryClient();
  const q = useQuery<{ contract: Contract; logo: string | null; signedCopy: { id: string; title: string; url: string } | null }>({ queryKey: ['re-contract', id], queryFn: () => api(`/v1/re/contracts/${id}`), enabled: !!id });
  const [f, setF] = useState<CData | null>(null), [cl, setCl] = useState<L>('ar'), [save, setSave] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit'), [ask, setAsk] = useState<null | 'signed' | 'void' | 'delete'>(null), [busy, setBusy] = useState(false);
  const loaded = useRef<string | null>(null), dirty = useRef(false), pending = useRef<Record<string, unknown> | null>(null);
  const c = q.data?.contract;
  useEffect(() => { if (c && loaded.current !== c.id) { loaded.current = c.id; setF(c.data); setCl(c.lang); dirty.current = false; } }, [c]);
  const editable = c?.status === 'draft' && can('deals.manage');
  // saves itself a moment after the last change; a change still waiting when you leave is sent on the way out
  useEffect(() => {
    if (!dirty.current || !f || !editable) return;
    setSave('saving');
    pending.current = { data: f, lang: cl };
    const t = setTimeout(async () => {
      const body = pending.current;
      try { await api(`/v1/re/contracts/${id}`, { method: 'PATCH', body }); if (pending.current === body) pending.current = null; setSave('saved'); qc.invalidateQueries({ queryKey: ['re-contracts'] }); }
      catch (e) { toast(err(e), 'bad'); setSave('idle'); }
    }, 700);
    return () => clearTimeout(t);
  }, [f, cl]);
  useEffect(() => () => { if (pending.current) api(`/v1/re/contracts/${id}`, { method: 'PATCH', body: pending.current }).catch(() => {}); }, [id]);
  const up = (fn: (d: CData) => void) => { dirty.current = true; setF((x) => { const y = structuredClone(x!); fn(y); return y; }); };
  const setStatus = async (status: 'signed' | 'void') => {
    setBusy(true);
    try {
      await api(`/v1/re/contracts/${id}`, { method: 'PATCH', body: status === 'signed' && editable ? { data: f, lang: cl, status } : { status } });
      pending.current = null; setAsk(null); qc.invalidateQueries({ queryKey: ['re-contract', id] }); qc.invalidateQueries({ queryKey: ['re-contracts'] });
    } catch (e) { toast(err(e), 'bad'); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { pending.current = null; await api(`/v1/re/contracts/${id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['re-contracts'] }); go('#/contracts'); } catch (e) { toast(err(e), 'bad'); }
  };
  const attach = async (file: File) => {
    if (!c) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams({ title: `${RSTRINGS[c.lang].contract.kinds[c.kind]} #${c.number}`, kind: 'contract', ...(c.dealId ? { dealId: c.dealId } : c.propertyId ? { propertyId: c.propertyId } : {}) });
      const x = await postBlob<{ document: { id: string } }>(`/v1/re/documents?${qs}`, file);
      await api(`/v1/re/contracts/${id}`, { method: 'PATCH', body: { documentId: x.document.id } });
      qc.invalidateQueries({ queryKey: ['re-contract', id] });
    } catch (e) { toast(err(e), 'bad'); } finally { setBusy(false); }
  };
  if (!c || !f) return <div className="skeleton h-96" />;
  const roles = rolesOf(c.kind, f.purpose, r.contract);
  return (
    <div className="grid gap-4">
      <div className="ct-head">
        <a href="#/contracts" className="sub inline-flex items-center gap-1"><Icon n="back" className="h-4 w-4 rtl:-scale-x-100" />{r.contract.title}</a>
        <div className="ct-title">
          <h2>{r.contract.kinds[c.kind]} <span className="sub">#{c.number}</span></h2>
          <Pill tone={statusTone(c.status)}>{r.contract.status[c.status]}</Pill>
          {editable && <span className="sub">{save === 'saving' ? r.contract.saving : save === 'saved' ? `✓ ${r.contract.saved}` : ''}</span>}
        </div>
        <div className="ct-acts">
          <button className="btn btn-accent" onClick={() => printPaper(`${r.contract.kinds[c.kind]} ${c.number}`)}><Icon n="print" />{r.contract.print}</button>
          {c.status === 'draft' && can('deals.manage') && <button className="btn btn-secondary" onClick={() => setAsk('signed')}><Icon n="check" />{r.contract.sign}</button>}
          {c.status === 'signed' && can('listings.update') && (q.data?.signedCopy
            ? <a className="btn btn-secondary" href={q.data.signedCopy.url} target="_blank" rel="noopener"><RIcon n="file" />{r.contract.attached}</a>
            : <label className="btn btn-secondary cursor-pointer"><Icon n="upload" />{r.contract.attach}<input type="file" accept="image/*,application/pdf" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} /></label>)}
          {can('deals.manage') && c.status !== 'void' && <button className="btn btn-ghost" onClick={() => setAsk(c.status === 'draft' ? 'delete' : 'void')}>{c.status === 'draft' ? r.contract.remove : r.contract.voidIt}</button>}
        </div>
      </div>
      {!editable && c.status !== 'draft' && <div className="note"><Icon n="lock" /><span>{fmt(r.contract.locked, { status: r.contract.status[c.status] })}</span></div>}
      <div className="seg ct-tabs">{(['edit', 'preview'] as const).map((k) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{r.contract[k]}</button>)}</div>

      <div className="ct-wrap" data-tab={tab}>
        <fieldset className="ct-form" disabled={!editable}>
          <Sec title={r.contract.sec.basics}>
            <div className="ct-grid">
              <label className="field">{r.contract.lang}
                <div className="seg">{(['ar', 'en'] as const).map((l) => <button type="button" key={l} aria-pressed={cl === l} onClick={() => { dirty.current = true; setCl(l); }}>{l === 'ar' ? 'العربية' : 'English'}</button>)}</div></label>
              <Field label={r.contract.f.date}><input className="input" type="date" value={f.date} onChange={(e) => up((d) => { d.date = e.target.value; })} /></Field>
              <Field label={r.contract.f.place} wide><input className="input" value={f.place ?? ''} onChange={(e) => up((d) => { d.place = e.target.value; })} /></Field>
            </div>
          </Sec>
          {(['first', 'second'] as const).map((side, i) => (
            <Sec key={side} title={`${i ? r.contract.paper.second : r.contract.paper.first} · ${roles[i]}`}>
              <div className="ct-grid">
                <Field label={r.contract.f.name} wide><input className="input" value={f[side].name} onChange={(e) => up((d) => { d[side].name = e.target.value; })} /></Field>
                <Field label={r.contract.f.idNo}><input className="input" dir="ltr" value={f[side].idNo ?? ''} onChange={(e) => up((d) => { d[side].idNo = e.target.value; })} /></Field>
                <Field label={r.contract.f.phone}><input className="input" dir="ltr" value={f[side].phone ?? ''} onChange={(e) => up((d) => { d[side].phone = e.target.value; })} /></Field>
                <Field label={r.contract.f.address} wide><input className="input" value={f[side].address ?? ''} onChange={(e) => up((d) => { d[side].address = e.target.value; })} /></Field>
                {c.kind === 'brokerage' && side === 'second' && <Field label={r.contract.f.rep} wide><input className="input" value={f.second.rep ?? ''} onChange={(e) => up((d) => { d.second.rep = e.target.value; })} /></Field>}
              </div>
            </Sec>
          ))}
          <Sec title={r.contract.sec.property}>
            <div className="ct-grid">
              <Field label={r.contract.f.type}><input className="input" value={f.property.type ?? ''} onChange={(e) => up((d) => { d.property.type = e.target.value; })} /></Field>
              <Field label={r.contract.f.plot}><input className="input" value={f.property.plot ?? ''} onChange={(e) => up((d) => { d.property.plot = e.target.value; })} /></Field>
              <Field label={r.contract.f.title} wide><input className="input" value={f.property.title ?? ''} onChange={(e) => up((d) => { d.property.title = e.target.value; })} /></Field>
              <Field label={r.contract.f.propAddress} wide><input className="input" value={f.property.address ?? ''} onChange={(e) => up((d) => { d.property.address = e.target.value; })} /></Field>
              <Field label={r.contract.f.area}><input className="input" value={f.property.area ?? ''} onChange={(e) => up((d) => { d.property.area = e.target.value; })} /></Field>
              <Field label={r.contract.f.city}><input className="input" value={f.property.city ?? ''} onChange={(e) => up((d) => { d.property.city = e.target.value; })} /></Field>
              <Field label={r.contract.f.size}><Num v={f.property.size} on={(v) => up((d) => { d.property.size = v; })} /></Field>
              <Field label={r.contract.f.land}><Num v={f.property.land} on={(v) => up((d) => { d.property.land = v; })} /></Field>
              <Field label={r.contract.f.rooms} wide><input className="input" value={f.property.rooms ?? ''} onChange={(e) => up((d) => { d.property.rooms = e.target.value; })} /></Field>
              <Field label={r.contract.f.details} wide><textarea className="input" rows={2} value={f.property.details ?? ''} onChange={(e) => up((d) => { d.property.details = e.target.value; })} /></Field>
            </div>
          </Sec>
          <Sec title={r.contract.sec.money}><MoneyForm kind={c.kind} f={f} up={up} roles={roles} lang={cl} /></Sec>
          <Sec title={r.contract.sec.terms}><Terms kind={c.kind} lang={cl} clauses={f.clauses} editable={editable} onChange={(list) => up((d) => { d.clauses = list; })} /></Sec>
          <Sec title={r.contract.sec.witnesses}>
            <div className="ct-grid">{f.witnesses.map((w, i) => (
              <Field key={i} label={fmt(r.contract.f.witness, { n: i + 1 })}><input className="input" value={w.name} onChange={(e) => up((d) => { d.witnesses[i].name = e.target.value; })} /></Field>
            ))}</div>
          </Sec>
          <Sec title={r.contract.sec.notes}><textarea className="input" rows={2} placeholder={r.contract.f.notes} value={f.notes ?? ''} onChange={(e) => up((d) => { d.notes = e.target.value; })} /></Sec>
        </fieldset>
        <div className="ct-side"><div className="ct-paper-wrap"><ContractPaper kind={c.kind} number={c.number} status={c.status} lang={cl} d={f} logo={q.data?.logo ?? null} /></div></div>
      </div>

      {ask && <Sheet title={ask === 'signed' ? r.contract.sign : ask === 'void' ? r.contract.voidIt : r.contract.remove} onClose={() => setAsk(null)} center
        footer={<button className={`btn justify-center ${ask === 'signed' ? 'btn-accent' : 'btn-danger'}`} disabled={busy} onClick={() => (ask === 'delete' ? remove() : setStatus(ask))}>{busy ? <span className="spinner" /> : ask === 'signed' ? r.contract.signYes : ask === 'void' ? r.contract.voidIt : r.contract.remove}</button>}>
        <p>{ask === 'signed' ? r.contract.signQ : ask === 'void' ? r.contract.voidQ : ''}</p>
      </Sheet>}
    </div>
  );
}

const Sec = ({ title, children }: { title: ReactNode; children: ReactNode }) => <section className="panel ct-sec"><h3>{title}</h3>{children}</section>;
const Field = ({ label, children, wide = false }: { label: ReactNode; children: ReactNode; wide?: boolean }) => <label className={`field${wide ? ' ct-wide' : ''}`}>{label}{children}</label>;
/** A whole number, shown with thousands separators (Arabic digits typed are understood). */
function Num({ v, on }: { v: number | null | undefined; on(v: number | null): void }) {
  return <input className="input money" dir="ltr" inputMode="numeric" value={v == null ? '' : nf.format(v)} onChange={(e) => { const d = toLatin(e.target.value).replace(/[^\d]/g, ''); on(d ? Number(d) : null); }} />;
}
const Words = ({ n, cur, lang }: { n: number | null | undefined; cur: string; lang: L }) => (n ? <small className="ct-words">{inWords(n, cur, lang)}</small> : null);

function MoneyForm({ kind, f, up, roles, lang: L2 }: { kind: string; f: CData; up(fn: (d: CData) => void): void; roles: string[]; lang: L }) {
  const { r } = useR();
  const m = f.money;
  const cur = (
    <Field label={r.contract.f.currency}><div className="seg">{(['USD', 'IQD'] as const).map((k) => <button type="button" key={k} aria-pressed={m.currency === k} onClick={() => up((d) => { d.money.currency = k; })}>{k === 'USD' ? r.common.usd : r.common.iqd}</button>)}</div></Field>
  );
  const commission = (kind === 'sale' || kind === 'rent') && <>
    <Field label={r.contract.f.commission}><Num v={m.commission} on={(v) => up((d) => { d.money.commission = v; })} /></Field>
    <Field label={r.contract.f.commissionBy}><select className="re-select" value={m.commissionBy ?? ''} onChange={(e) => up((d) => { d.money.commissionBy = (e.target.value || null) as any; })}>
      <option value="">{r.contract.nobody}</option><option value="first">{roles[0]}</option><option value="second">{roles[1]}</option><option value="both">{r.contract.both}</option></select></Field>
  </>;
  if (kind === 'rent') return (
    <div className="ct-grid">
      {cur}
      <Field label={r.contract.f.period}><div className="seg">{(['month', 'year'] as const).map((k) => <button type="button" key={k} aria-pressed={(m.period ?? 'month') === k} onClick={() => up((d) => { d.money.period = k; })}>{r.contract.per[k]}</button>)}</div></Field>
      <Field label={r.contract.f.rent} wide><Num v={m.rent} on={(v) => up((d) => { d.money.rent = v; })} /><Words n={m.rent} cur={m.currency} lang={L2} /></Field>
      <Field label={r.contract.f.start}><input className="input" type="date" value={m.start ?? ''} onChange={(e) => up((d) => { d.money.start = e.target.value; })} /></Field>
      <Field label={r.contract.f.end}><input className="input" type="date" value={m.end ?? ''} onChange={(e) => up((d) => { d.money.end = e.target.value; })} /></Field>
      <Field label={r.contract.f.payEvery}><select className="re-select" value={m.payEvery ?? 'month'} onChange={(e) => up((d) => { d.money.payEvery = e.target.value as any; })}>{Object.entries(r.contract.every).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
      <Field label={r.contract.f.insurance}><Num v={m.insurance} on={(v) => up((d) => { d.money.insurance = v; })} /></Field>
      {commission}
    </div>
  );
  if (kind === 'deposit') return (
    <div className="ct-grid">
      {cur}
      <Field label={r.contract.f.holdUntil}><input className="input" type="date" value={m.holdUntil ?? ''} onChange={(e) => up((d) => { d.money.holdUntil = e.target.value; })} /></Field>
      <Field label={r.contract.f.deposit} wide><Num v={m.deposit} on={(v) => up((d) => { d.money.deposit = v; })} /><Words n={m.deposit} cur={m.currency} lang={L2} /></Field>
      <Field label={r.contract.f.price} wide><Num v={m.price} on={(v) => up((d) => { d.money.price = v; })} /></Field>
    </div>
  );
  if (kind === 'brokerage') return (
    <div className="ct-grid">
      {cur}
      <Field label={r.contract.f.validUntil}><input className="input" type="date" value={m.validUntil ?? ''} onChange={(e) => up((d) => { d.money.validUntil = e.target.value; })} /></Field>
      <Field label={r.contract.f.asking} wide><Num v={m.price} on={(v) => up((d) => { d.money.price = v; })} /></Field>
      <Field label={r.contract.f.commissionNote}><input className="input" value={m.commissionNote ?? ''} onChange={(e) => up((d) => { d.money.commissionNote = e.target.value; })} /></Field>
      <Field label={r.contract.f.commission}><Num v={m.commission} on={(v) => up((d) => { d.money.commission = v; })} /></Field>
      <label className="ct-check ct-wide"><input type="checkbox" checked={!!m.exclusive} onChange={(e) => up((d) => { d.money.exclusive = e.target.checked; })} />{r.contract.f.exclusive}</label>
    </div>
  );
  const rest = m.price != null && m.paid != null ? Math.max(0, m.price - m.paid) : null;
  return (
    <div className="ct-grid">
      {cur}
      <Field label={r.contract.f.restDue}><input className="input" type="date" value={m.restDue ?? ''} onChange={(e) => up((d) => { d.money.restDue = e.target.value; })} /></Field>
      <Field label={r.contract.f.price} wide><Num v={m.price} on={(v) => up((d) => { d.money.price = v; })} /><Words n={m.price} cur={m.currency} lang={L2} /></Field>
      <Field label={r.contract.f.paid}><Num v={m.paid} on={(v) => up((d) => { d.money.paid = v; })} /></Field>
      <Field label={r.contract.f.rest}><input className="input money" dir="ltr" readOnly tabIndex={-1} value={rest == null ? '' : nf.format(rest)} /></Field>
      {commission}
    </div>
  );
}

/** The terms: each one editable, in order; start again from the agency's own (or Hemlo's), or keep these as the agency's. */
function Terms({ kind, lang, clauses, editable, onChange }: { kind: string; lang: L; clauses: string[]; editable: boolean; onChange(list: string[]): void }) {
  const { r, can, toast, err } = useR();
  const move = (i: number, by: number) => { const l = [...clauses]; const [x] = l.splice(i, 1); l.splice(i + by, 0, x); onChange(l); };
  const reset = async () => { try { const x = await api<{ clauses: string[] }>(`/v1/re/contracts/terms?kind=${kind}&lang=${lang}`); onChange(x.clauses); } catch (e) { toast(err(e), 'bad'); } };
  const keep = async () => { try { await api('/v1/re/contracts/terms', { method: 'PUT', body: { kind, lang, clauses } }); toast(r.contract.termsSaved); } catch (e) { toast(err(e), 'bad'); } };
  return (
    <div className="grid gap-2">
      <p className="note m-0"><Icon n="info" /><span>{r.contract.legal}</span></p>
      {clauses.map((t, i) => (
        <div key={i} className="ct-clause">
          <span className="ct-n">{i + 1}</span>
          <textarea className="input" dir="auto" value={t} rows={3} onChange={(e) => { const l = [...clauses]; l[i] = e.target.value; onChange(l); }} />
          {editable && <span className="ct-cl-acts">
            <button type="button" aria-label={r.contract.up} disabled={!i} onClick={() => move(i, -1)}><Icon n="back" className="ct-up" /></button>
            <button type="button" aria-label={r.contract.down} disabled={i === clauses.length - 1} onClick={() => move(i, 1)}><Icon n="back" className="ct-down" /></button>
            <button type="button" aria-label={r.contract.removeClause} onClick={() => onChange(clauses.filter((_, k) => k !== i))}><Icon n="trash" /></button>
          </span>}
        </div>
      ))}
      {editable && <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...clauses, ''])}><Icon n="plus" />{r.contract.addClause}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}><Icon n="undo" />{r.contract.resetTerms}</button>
        {can('agency.configure') && <button type="button" className="btn btn-ghost btn-sm" onClick={keep}><Icon n="check" />{r.contract.saveTerms}</button>}
      </div>}
    </div>
  );
}

// ---------- the paper ----------
/** The contract as it prints: in its own language, whatever the app's language is. */
export function ContractPaper({ kind, number, status, lang, d, logo }: { kind: string; number: number; status: string; lang: L; d: CData; logo: string | null }) {
  const R = RSTRINGS[lang].contract, P = R.paper, F = R.f;
  const roles = rolesOf(kind, d.purpose, R);
  const m = d.money, cur = m.currency;
  const amt = (n: number | null | undefined) => (n == null ? '' : price(n, cur, lang));
  const money = (n: number | null | undefined, suffix = '') => (n == null ? null : <><b>{amt(n)}{suffix}</b><small>{inWords(n, cur, lang)}</small></>);
  const who = m.commissionBy === 'both' ? R.both : m.commissionBy === 'first' ? roles[0] : m.commissionBy === 'second' ? roles[1] : null;
  const p = d.property;
  const propRows: [string, ReactNode][] = [[F.type, p.type], [F.title, p.title], [F.propAddress, p.address], [F.area, [p.area, p.city].filter(Boolean).join(lang === 'ar' ? '، ' : ', ')], [F.plot, p.plot],
    [F.size, p.size ? nf.format(p.size) : null], [F.land, p.land ? nf.format(p.land) : null], [F.rooms, p.rooms], [F.details, p.details], [F.ref, p.ref ? `#${p.ref}` : null]];
  const rest = m.price != null && m.paid != null ? Math.max(0, m.price - m.paid) : null;
  const moneyRows: [string, ReactNode][] = kind === 'rent'
    ? [[F.rent, money(m.rent, m.period ? ` ${R.per[m.period]}` : '')], [P.duration, m.start || m.end ? fmt(P.fromTo, { start: day(m.start), end: day(m.end) }) : null], [F.payEvery, m.payEvery ? R.every[m.payEvery] : null], [F.insurance, money(m.insurance)]]
    : kind === 'deposit' ? [[F.deposit, money(m.deposit)], [P.forProperty, money(m.price)], [F.holdUntil, day(m.holdUntil)]]
    : kind === 'brokerage' ? [[F.asking, money(m.price)], [F.commission, [m.commissionNote, m.commission != null ? amt(m.commission) : null].filter(Boolean).join(' · ')], [F.validUntil, day(m.validUntil)], [F.exclusive.split(':')[0], m.exclusive ? P.yes : P.nope]]
    : [[F.price, money(m.price)], [F.paid, money(m.paid)], [F.rest, rest ? money(rest) : null], [F.restDue, day(m.restDue)]];
  if ((kind === 'sale' || kind === 'rent') && m.commission) moneyRows.push([F.commission, `${amt(m.commission)}${who ? ` · ${F.commissionBy}: ${who}` : ''}`]);
  const rows = (list: [string, ReactNode][]) => list.filter(([, v]) => v != null && v !== '').map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>);
  const party = (x: Party, i: number) => (
    <div className="ct-party">
      <span className="r">{i ? P.second : P.first} · {roles[i]}</span>
      <span className="n">{x.name || '…'}</span>
      {x.idNo && <div>{P.idNo}: <span dir="ltr">{x.idNo}</span></div>}
      {x.address && <div>{x.address}</div>}
      {x.phone && <div dir="ltr" className="ct-ph">{x.phone}</div>}
      {x.rep && <div>{F.rep}: {x.rep}</div>}
    </div>
  );
  const signers = [roles[0], roles[1], ...(kind === 'brokerage' ? [] : [P.office]), ...d.witnesses.map((w, i) => `${P.witness} ${i + 1}${w.name ? `: ${w.name}` : ''}`)];
  return (
    <article className="ct-paper" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      {status === 'void' && <div className="ct-void" aria-hidden="true">{P.void}</div>}
      <header className="ct-top">
        <div className="ct-ag">{logo && <img src={logo} alt="" />}<div><b>{d.agency.name}</b>{d.agency.phone && <small dir="ltr">{d.agency.phone}</small>}{d.agency.address && <small>{d.agency.address}</small>}</div></div>
        <div className="ct-meta"><div>{P.no}: <b>{number}</b></div><div>{P.date}: <b>{day(d.date)}</b></div>{d.place && <div>{P.place}: <b>{d.place}</b></div>}</div>
      </header>
      <h1>{R.titles[kind]}</h1>
      <p className="ct-intro">{fmt(P.intro, { doc: R.docs[kind], date: day(d.date), place: d.place ? fmt(P.at, { place: d.place }) : '' })}</p>
      <div className="ct-parties">{party(d.first, 0)}{party(d.second, 1)}</div>
      <h2>{P.property}</h2>
      <table className="ct-rows"><tbody>{rows(propRows)}</tbody></table>
      <h2>{P.money}</h2>
      <table className="ct-rows"><tbody>{rows(moneyRows)}</tbody></table>
      <h2>{P.terms}</h2>
      <ol className="ct-terms">{d.clauses.filter((x) => x.trim()).map((x, i) => <li key={i}>{x}</li>)}</ol>
      {d.notes && <p className="ct-notes">{d.notes}</p>}
      <h2>{P.signatures}</h2>
      <div className="ct-sign">{signers.map((s, i) => <div key={i}><span>{s}</span><i /><small>{i === 2 && kind !== 'brokerage' ? P.stamp : P.signName}</small></div>)}</div>
      <footer className="ct-foot">{R.titles[kind]} · {P.no} {number}</footer>
    </article>
  );
}

/** Print the paper alone on A4 (or save it as a PDF), named after the contract. */
export async function printPaper(name: string) {
  const el = document.querySelector('.ct-paper');
  if (!el) return;
  const root = document.createElement('div'); root.className = 're-print-root';
  root.appendChild(el.cloneNode(true));
  document.body.appendChild(root);
  const title = document.title; document.title = name;
  const done = () => { root.remove(); document.title = title; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  await Promise.all([...root.querySelectorAll('img')].filter((i) => !i.complete).map((i) => new Promise((ok) => { i.onload = ok; i.onerror = ok; setTimeout(ok, 2000); })));
  window.print();
}
