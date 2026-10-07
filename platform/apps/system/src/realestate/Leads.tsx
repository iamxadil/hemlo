// Leads: everyone looking to buy or rent, with what they want and what's next. The form takes a request the way it
// arrives ("a villa under 200k in Dream City, 3 bedrooms") and the matcher answers at once.
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet, toLatin } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Empty, Pill } from './ui';
import { fmt, price, ago, waLink, telLink, localPhone, useSetup, type Lead } from './data';

const FILTERS: Record<string, string> = { open: 'status=open', due: 'due=1', mine: 'agent=me&status=open', unassigned: 'agent=none&status=open', new: 'status=new', quiet: 'quiet=1', won: 'status=won', lost: 'status=lost' };

/** "Villa, apartment · Dream City, Zawa · up to $220k" */
export function wantsLine(l: Lead, r: any, lang: string, types: Record<string, any>) {
  const what = l.types.length ? l.types.map((t) => types[t]?.[lang === 'en' ? 'en' : 'ar'] ?? t).join('، ') : r.leads.any;
  const budget = l.budgetMax != null ? fmt(r.leads.upTo, { v: price(l.budgetMax, l.currency, lang as any, null, true) }) : l.budgetMin != null ? fmt(r.leads.from, { v: price(l.budgetMin, l.currency, lang as any, null, true) }) : r.leads.noBudget;
  return [r.wants[l.purpose], what, l.areas.slice(0, 3).join('، '), budget].filter(Boolean).join(' · ');
}

export function Leads() {
  const { r, lang, can } = useR();
  const { params } = useRoute();
  const setup = useSetup();
  const [f, setF] = useState(params.get('f') ?? 'open'), [q, setQ] = useState(''), [dq, setDq] = useState(''), [adding, setAdding] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDq(toLatin(q.trim())), 200); return () => clearTimeout(t); }, [q]);
  const list = useInfiniteQuery<{ leads: Lead[]; total: number }>({
    queryKey: ['re-leads', f, dq], initialPageParam: 0,
    queryFn: ({ pageParam }) => api(`/v1/re/leads?${FILTERS[f] ?? ''}${dq ? `&q=${encodeURIComponent(dq)}` : ''}&limit=40&offset=${pageParam}`),
    getNextPageParam: (last, all) => { const n = all.reduce((s, p) => s + p.leads.length, 0); return n < last.total ? n : undefined; },
  });
  const items = list.data?.pages.flatMap((p) => p.leads) ?? [];
  const types = setup.data?.types ?? {};
  const team = setup.data?.team ?? [];
  return (
    <div>
      <div className="re-tools">
        <div className="search"><Icon n="search" /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={r.leads.search} /></div>
        {can('leads.create') && <button className="btn btn-accent" onClick={() => setAdding(true)}><Icon n="plus" />{r.leads.new}</button>}
      </div>
      <div className="re-tools"><div className="re-tabs">{Object.keys(FILTERS).filter((k) => k !== 'unassigned' || can('leads.read-all')).map((k) => (
        <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{r.leads.filters[k]}{f === k && !list.isLoading && <span className="c">{list.data?.pages[0]?.total ?? 0}</span>}</button>
      ))}</div></div>
      {list.isLoading ? <div className="skeleton h-96" /> : !items.length
        ? <div className="panel">{f === 'open' && !dq ? <Empty icon="customers" title={r.leads.empty} body={r.leads.emptyBody} action={can('leads.create') && <button className="btn btn-accent" onClick={() => setAdding(true)}><Icon n="plus" />{r.leads.new}</button>} /> : <Empty icon="search" title={r.leads.none} />}</div>
        : <div className="panel">{items.map((l) => {
          const due = l.nextFollowAt && +new Date(l.nextFollowAt) < Date.now();
          return (
            <div key={l.id} className="re-lead-row">
              <Avatar name={l.name} />
              <button className="min-w-0 text-start" onClick={() => go(`#/lead?id=${l.id}`)}>
                <span className="flex items-center gap-2"><b className="truncate font-medium">{l.name}</b>{l.status !== 'active' && <Pill tone={l.status === 'new' ? 'accent' : l.status === 'won' ? 'ok' : l.status === 'lost' ? '' : 'warn'}>{r.leadStatus[l.status]}</Pill>}</span>
                <span className="sub block truncate">{wantsLine(l, r, lang, types)}</span>
                <span className="sub block truncate" style={due ? { color: 'var(--bad)' } : undefined}>{l.nextFollowAt ? fmt(r.lead.due, { when: ago(l.nextFollowAt, r) }) : l.lastContactAt ? fmt(r.leads.last, { when: ago(l.lastContactAt, r) }) : r.today.never}
                  {l.agentId && team.length > 1 ? ` · ${team.find((m) => m.id === l.agentId)?.name ?? ''}` : ''}</span>
              </button>
              <span className="flex gap-1">
                {waLink(l.whatsapp ?? l.phone) && <a className="icon-btn re-icon-wa" href={waLink(l.whatsapp ?? l.phone)!} target="_blank" rel="noopener" aria-label={r.lead.wa}><Icon n="wa" /></a>}
                {l.phone && <a className="icon-btn" href={telLink(l.phone)!} aria-label={r.lead.call} title={localPhone(l.phone)}><Icon n="phone" /></a>}
              </span>
            </div>
          );
        })}</div>}
      {list.hasNextPage && <div className="mt-5 grid place-items-center"><button className="btn btn-secondary" onClick={() => list.fetchNextPage()}>{r.props.more}</button></div>}
      {adding && <LeadForm onClose={() => setAdding(false)} onSaved={(l) => { setAdding(false); go(`#/lead?id=${l.id}`); }} />}
    </div>
  );
}

/** Areas as chips: type one and press Enter (or a comma). */
export function ChipsInput({ value, onChange, placeholder }: { value: string[]; onChange(v: string[]): void; placeholder?: string }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim().replace(/[,،]$/, ''); if (v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return (
    <div className="re-chips-input">
      {value.map((v) => <span key={v}>{v}<button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label="×"><Icon n="close" /></button></span>)}
      <input value={t} onChange={(e) => (/[,،]$/.test(e.target.value) ? (setT(e.target.value), setTimeout(add)) : setT(e.target.value))} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)); }} onBlur={add} placeholder={value.length ? '' : placeholder} />
    </div>
  );
}

/** A new lead (or editing one): who, and what they want. The matcher answers as soon as it's saved. */
export function LeadForm({ onClose, onSaved, lead }: { onClose(): void; onSaved(l: Lead): void; lead?: Lead }) {
  const { r, lang, can, toast, err } = useR();
  const setup = useSetup();
  const qc = useQueryClient();
  const [x, setX] = useState<Partial<Lead>>(lead ?? { purpose: 'sale', types: [], areas: [], must: [], source: 'whatsapp', currency: setup.data?.settings.currency ?? 'USD', lang: lang === 'en' ? 'en' : 'ar' });
  const [twin, setTwin] = useState<{ id: string; name: string } | null>(null);
  const set = (p: Partial<Lead>) => setX((v) => ({ ...v, ...p }));
  const n = (v: string) => { const d = toLatin(v).replace(/[^\d]/g, ''); return d ? Number(d) : null; };
  const save = useMutation({
    mutationFn: (force: boolean) => (lead ? api<{ lead: Lead }>(`/v1/re/leads/${lead.id}`, { method: 'PATCH', body: x }) : api<{ lead: Lead; matchCount: number }>('/v1/re/leads', { body: { ...x, force } })),
    onSuccess: (res: any) => { qc.invalidateQueries({ queryKey: ['re-leads'] }); qc.invalidateQueries({ queryKey: ['re-lead'] }); qc.invalidateQueries({ queryKey: ['re-today'] });
      toast(lead ? r.lead.saved : res.matchCount ? fmt(r.lead.matchesN, { n: res.matchCount, name: res.lead.name }) : r.lead.created); onSaved(res.lead); },
    onError: async (e: any) => {
      if (e instanceof ApiError && e.code === 'LEAD_EXISTS') {
        const found = await api<{ leads: Lead[] }>(`/v1/re/leads?q=${encodeURIComponent((x.phone ?? '').replace(/\D/g, '').slice(-9))}&limit=1`).catch(() => null);
        setTwin(found?.leads[0] ? { id: found.leads[0].id, name: found.leads[0].name } : { id: '', name: '' });
      } else toast(err(e), 'bad');
    },
  });
  const types = setup.data?.types ?? {}, features = setup.data?.features ?? {};
  return (
    <Sheet title={lead ? r.lead.editWants : r.leads.new} onClose={onClose} footer={<>
      {twin && <div className="note"><Icon n="alert" /><span className="flex-1">{fmt(r.lead.exists, { name: twin.name })}</span>{twin.id && <a className="btn btn-secondary btn-sm" href={`#/lead?id=${twin.id}`} onClick={onClose}>{r.lead.openExisting}</a>}</div>}
      <button className="btn btn-accent justify-center" disabled={!x.name?.trim() || save.isPending} onClick={() => save.mutate(!!twin)}>{twin ? r.lead.addAnyway : r.lead.save}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{r.lead.name}<input className="input" autoFocus={!lead} value={x.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="field">{r.lead.phone}<input className="input" dir="ltr" inputMode="tel" value={x.phone ?? ''} onChange={(e) => { set({ phone: e.target.value }); setTwin(null); }} placeholder="07xx xxx xxxx" /></label>
      </div>
      <div className="field">{r.lead.purpose}<div className="seg">{(['sale', 'rent'] as const).map((k) => <button key={k} aria-pressed={x.purpose === k} onClick={() => set({ purpose: k })}>{k === 'sale' ? r.lead.buy : r.lead.rent}</button>)}</div></div>
      <div className="field">{r.lead.types}<div className="chips">{Object.entries(types).map(([k, v]) => { const on = x.types?.includes(k); return <button key={k} className="chip" aria-pressed={on} onClick={() => set({ types: on ? x.types!.filter((t) => t !== k) : [...(x.types ?? []), k] })}>{v[lang === 'en' ? 'en' : 'ar']}</button>; })}</div></div>
      <div className="field">{r.lead.areas}<ChipsInput value={x.areas ?? []} onChange={(areas) => set({ areas })} placeholder={r.lead.areasPh} /></div>
      <div className="field">{r.lead.budget}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input className="input money" dir="ltr" inputMode="numeric" placeholder={r.lead.min} value={x.budgetMin == null ? '' : new Intl.NumberFormat('en-US').format(x.budgetMin)} onChange={(e) => set({ budgetMin: n(e.target.value) })} />
          <input className="input money" dir="ltr" inputMode="numeric" placeholder={r.lead.max} value={x.budgetMax == null ? '' : new Intl.NumberFormat('en-US').format(x.budgetMax)} onChange={(e) => set({ budgetMax: n(e.target.value) })} />
          <div className="seg">{(['USD', 'IQD'] as const).map((c) => <button key={c} aria-pressed={x.currency === c} onClick={() => set({ currency: c })}>{c === 'USD' ? '$' : 'د.ع'}</button>)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="field">{r.lead.beds}<input className="input" inputMode="numeric" value={x.bedrooms ?? ''} onChange={(e) => set({ bedrooms: n(e.target.value) })} /></label>
        <label className="field">{r.lead.sizeMin}<input className="input" inputMode="numeric" value={x.sizeMin ?? ''} onChange={(e) => set({ sizeMin: n(e.target.value) })} /></label>
        <label className="field">{r.lead.baths}<input className="input" inputMode="numeric" value={x.bathrooms ?? ''} onChange={(e) => set({ bathrooms: n(e.target.value) })} /></label>
      </div>
      <div className="field">{r.lead.must}<div className="chips">{Object.entries(features).slice(0, 14).map(([k, v]) => { const on = x.must?.includes(k); return <button key={k} className="chip" aria-pressed={on} onClick={() => set({ must: on ? x.must!.filter((t) => t !== k) : [...(x.must ?? []), k] })}>{v[lang === 'en' ? 'en' : 'ar']}</button>; })}</div></div>
      {!lead && <div className="field">{r.lead.source}<div className="chips">{Object.entries(r.sources).filter(([k]) => k !== 'website').map(([k, t]) => <button key={k} className="chip" aria-pressed={x.source === k} onClick={() => set({ source: k })}>{t}</button>)}</div></div>}
      <label className="field">{r.lead.notes}<textarea className="input" rows={2} value={x.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!x.consent} onChange={(e) => set({ consent: e.target.checked })} />{r.lead.consent}</label>
      <div className="field">{r.lead.lang}<div className="seg">{(['ar', 'en'] as const).map((l) => <button key={l} aria-pressed={x.lang === l} onClick={() => set({ lang: l })}>{l === 'ar' ? 'العربية' : 'English'}</button>)}</div></div>
      {can('leads.assign') && (setup.data?.team.length ?? 0) > 1 && <div className="field">{r.lead.agent}<div className="chips">{setup.data!.team.map((m) => <button key={m.id} className="chip" aria-pressed={x.agentId === m.id} onClick={() => set({ agentId: m.id })}>{m.name}</button>)}</div></div>}
    </Sheet>
  );
}
