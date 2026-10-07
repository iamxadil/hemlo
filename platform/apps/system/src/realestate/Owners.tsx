// Owners: the people whose homes the agency sells or rents. An owner's page shows their listings with each one's numbers
// (views, viewings), their deals, documents and timeline — and sends them a report in two taps.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet, toLatin } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Empty, Pill, RIcon, Sec, StatusPill, Timeline } from './ui';
import { Documents, OwnerReport } from './PropertyFile';
import { fmt, price, titleOf, waLink, telLink, localPhone, stageTone, type Owner, type Card } from './data';

export function Owners() {
  const { r, can } = useR();
  const { params } = useRoute();
  const id = params.get('id');
  const [q, setQ] = useState(''), [dq, setDq] = useState(''), [adding, setAdding] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDq(toLatin(q.trim())), 200); return () => clearTimeout(t); }, [q]);
  const list = useQuery<{ owners: Owner[] }>({ queryKey: ['re-owners', dq], queryFn: () => api(`/v1/re/owners?limit=100${dq ? `&q=${encodeURIComponent(dq)}` : ''}`), enabled: !id });
  if (id) return <OwnerFile id={id} />;
  return (
    <div>
      <div className="re-tools">
        <div className="search"><Icon n="search" /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={r.owners.search} /></div>
        {can('listings.create') && <button className="btn btn-accent" onClick={() => setAdding(true)}><Icon n="plus" />{r.owners.new}</button>}
      </div>
      {list.isLoading ? <div className="skeleton h-80" /> : !(list.data?.owners.length) ? <div className="panel"><Empty icon="key" title={r.owners.empty} body={r.owners.emptyBody} action={can('listings.create') && <button className="btn btn-accent" onClick={() => setAdding(true)}><Icon n="plus" />{r.owners.new}</button>} /></div>
        : <div className="panel">{list.data.owners.map((o) => (
          <div key={o.id} className="re-item"><Avatar name={o.name} />
            <button className="min-w-0 flex-1 text-start" onClick={() => go(`#/owners?id=${o.id}`)}><b className="block truncate font-medium">{o.name}</b><span className="sub">{fmt(r.owners.listings, { n: o.listings ?? 0, l: o.live ?? 0 })} · <span dir="ltr">{localPhone(o.phone)}</span></span></button>
            {waLink(o.whatsapp ?? o.phone) && <a className="icon-btn re-icon-wa" href={waLink(o.whatsapp ?? o.phone)!} target="_blank" rel="noopener"><Icon n="wa" /></a>}
            {o.phone && <a className="icon-btn" href={telLink(o.phone)!}><Icon n="phone" /></a>}
          </div>
        ))}</div>}
      {adding && <OwnerForm onClose={() => setAdding(false)} onSaved={(o) => { setAdding(false); go(`#/owners?id=${o.id}`); }} />}
    </div>
  );
}

function OwnerFile({ id }: { id: string }) {
  const { r, lang, can } = useR();
  const qc = useQueryClient();
  const q = useQuery<any>({ queryKey: ['re-owner', id], queryFn: () => api(`/v1/re/owners/${id}`) });
  const [edit, setEdit] = useState(false), [report, setReport] = useState<Card | null>(null);
  if (q.isLoading) return <div className="skeleton h-96" />;
  if (!q.data) return <div className="panel"><Empty icon="alert" title={r.errors.OWNER_NOT_FOUND} /></div>;
  const { owner: o, properties, deals, activity, documents } = q.data;
  const phone = o.whatsapp ?? o.phone;
  return (
    <div>
      <a href="#/owners" className="sub mb-3 inline-flex items-center gap-1"><Icon n="back" className="h-4 w-4 rtl:-scale-x-100" />{r.shell.owners}</a>
      <div className="panel p-5">
        <div className="flex flex-wrap items-center gap-4"><Avatar name={o.name} lg /><div className="min-w-0 flex-1"><h2 className="text-2xl font-semibold tracking-tight">{o.name}</h2><p className="sub" dir="ltr">{localPhone(o.phone)}</p></div>
          {o.commission && <Pill tone="accent">{r.owners.commission}: {o.commission.kind === 'percent' ? `${o.commission.value / 100}%` : price(o.commission.value, 'USD', lang)}</Pill>}</div>
        <div className="re-actions">
          {phone && <a className="btn btn-wa" href={waLink(phone)!} target="_blank" rel="noopener"><Icon n="wa" />{r.lead.wa}</a>}
          {o.phone && <a className="btn btn-secondary" href={telLink(o.phone)!}><Icon n="phone" />{r.lead.call}</a>}
          {can('listings.update') && <button className="btn btn-secondary" onClick={() => setEdit(true)}><Icon n="edit" />{r.common.edit}</button>}
          {can('listings.create') && <a className="btn btn-secondary" href="#/studio"><Icon n="plus" />{r.props.new}</a>}
        </div>
        {o.notes && <p className="sub mt-3 whitespace-pre-line">{o.notes}</p>}
      </div>
      <Sec title={r.owners.properties} />
      <div className="panel">{properties.length ? properties.map((p: any) => (
        <div key={p.id} className="re-row-p">{p.cover ? <img src={p.cover} alt="" /> : <span className="ph" />}
          <button className="min-w-0 flex-1 text-start" onClick={() => go(`#/property?id=${p.id}`)}><b className="block truncate font-medium">{titleOf(p, lang)}</b>
            <span className="sub">{[price(p.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null), fmt(r.today.views, { n: p.stats?.views ?? 0 }), fmt(r.owners.viewingsN, { n: p.viewings }), p.upcoming ? fmt(r.owners.upcomingN, { n: p.upcoming }) : ''].filter(Boolean).join(' · ')}</span></button>
          <StatusPill status={p.status} />
          <button className="btn btn-secondary btn-sm" onClick={() => setReport(p)}><Icon n="chart" />{r.owners.report}</button>
        </div>
      )) : <p className="sub p-4">{r.props.empty}</p>}</div>
      {deals.length > 0 && <><Sec title={r.lead.deals} /><div className="panel">{deals.map((d: any) => (
        <button key={d.id} className="re-item" onClick={() => go(`#/deals?id=${d.id}`)}><span className="min-w-0 flex-1 truncate">{properties.find((p: any) => p.id === d.propertyId)?.title}</span><span className="re-num sub">{price(d.agreed ?? d.asking, d.currency, lang)}</span><Pill tone={stageTone(d.stage)}>{r.stages[d.stage]}</Pill></button>
      ))}</div></>}
      <Sec title={r.prop.documents} /><Documents docs={documents} ownerId={o.id} onChanged={() => qc.invalidateQueries({ queryKey: ['re-owner', id] })} />
      <Sec title={r.lead.activity} /><div className="panel"><Timeline items={activity} names={Object.fromEntries(properties.map((p: any) => [p.id, p.title]))} /></div>
      {edit && <OwnerForm owner={o} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); qc.invalidateQueries({ queryKey: ['re-owner', id] }); }} />}
      {report && <OwnerReport propertyId={report.id} title={titleOf(report, lang)} onClose={() => setReport(null)} />}
    </div>
  );
}

/** A new owner (or editing one): name, phone, the commission agreement. */
export function OwnerForm({ onClose, onSaved, owner }: { onClose(): void; onSaved(o: Owner): void; owner?: Owner }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const [x, setX] = useState<Partial<Owner>>(owner ?? { lang: 'ar', commission: { kind: 'percent', value: 200 } });
  const [twin, setTwin] = useState(false);
  const save = useMutation({
    mutationFn: (force: boolean) => (owner ? api<any>(`/v1/re/owners/${owner.id}`, { method: 'PATCH', body: x }) : api<any>('/v1/re/owners', { body: { ...x, force } })),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['re-owners'] }); onSaved(res.owner); },
    onError: (e) => { if (e instanceof ApiError && e.code === 'OWNER_EXISTS') setTwin(true); else toast(err(e), 'bad'); },
  });
  const c = x.commission;
  return (
    <Sheet title={owner ? r.common.edit : r.owners.new} onClose={onClose} center footer={<>{twin && <p className="note"><Icon n="alert" />{fmt(r.owners.exists, { name: '' })}</p>}
      <button className="btn btn-accent justify-center" disabled={!x.name?.trim() || save.isPending} onClick={() => save.mutate(twin)}>{twin ? r.lead.addAnyway : r.owners.save}</button></>}>
      <label className="field">{r.owners.name}<input className="input" autoFocus value={x.name ?? ''} onChange={(e) => setX({ ...x, name: e.target.value })} /></label>
      <label className="field">{r.owners.phone}<input className="input" dir="ltr" inputMode="tel" value={x.phone ?? ''} onChange={(e) => { setX({ ...x, phone: e.target.value }); setTwin(false); }} placeholder="07xx xxx xxxx" /></label>
      <div className="field">{r.owners.commission}
        <div className="grid grid-cols-[1fr_8rem] gap-2"><div className="seg">{(['percent', 'fixed'] as const).map((k) => <button key={k} aria-pressed={c?.kind === k} onClick={() => setX({ ...x, commission: { kind: k, value: k === 'percent' ? 200 : 1000 } })}>{k === 'percent' ? r.deals.percent : r.deals.fixed}</button>)}</div>
          <input className="input" inputMode="decimal" value={c ? (c.kind === 'percent' ? c.value / 100 : c.value) : ''} onChange={(e) => { const v = Number(toLatin(e.target.value)) || 0; setX({ ...x, commission: { kind: c?.kind ?? 'percent', value: c?.kind === 'fixed' ? Math.round(v) : Math.round(v * 100) } }); }} /></div>
      </div>
      <label className="field">{r.owners.notes}<textarea className="input" rows={3} value={x.notes ?? ''} onChange={(e) => setX({ ...x, notes: e.target.value })} /></label>
    </Sheet>
  );
}

/** Collections: every shortlist sent, how often it was opened, what was saved. */
export function Collections() {
  const { r } = useR();
  const q = useQuery<{ collections: any[] }>({ queryKey: ['re-collections'], queryFn: () => api('/v1/re/collections') });
  return q.isLoading ? <div className="skeleton h-80" /> : !(q.data?.collections.length) ? <div className="panel"><Empty icon="clip" title={r.collections.title} body={r.collections.empty} /></div> : (
    <div className="panel">{q.data.collections.map((c) => (
      <div key={c.id} className="re-item"><span className="re-av"><RIcon n="clip" className="h-4 w-4" /></span>
        <button className="min-w-0 flex-1 text-start" onClick={() => c.lead && go(`#/lead?id=${c.lead.id}`)}><b className="block truncate font-medium">{c.title}</b>
          <span className="sub">{[c.lead?.name, fmt(r.collections.items, { n: c.items }), c.opens ? fmt(r.collections.opens, { n: c.opens }) : r.collections.never, c.favorites ? fmt(r.collections.favs, { n: c.favorites }) : ''].filter(Boolean).join(' · ')}</span></button>
        <a className="btn btn-secondary btn-sm" href={c.url} target="_blank" rel="noopener">{r.collections.open}</a>
      </div>
    ))}</div>
  );
}

/** Reports: the questions an agency owner asks, answered with numbers. */
export function Reports() {
  const { r, lang } = useR();
  const [days, setDays] = useState(90);
  const q = useQuery<any>({ queryKey: ['re-reports', days], queryFn: () => api(`/v1/re/reports?days=${days}`) });
  const d = q.data;
  const maxSrc = Math.max(1, ...(d?.sources ?? []).map((s: any) => s.leads));
  return (
    <div>
      <div className="re-tools"><div className="re-tabs">{[30, 90, 365].map((n) => <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{fmt(r.reports.period, { n })}</button>)}</div></div>
      {!d ? <div className="skeleton h-96" /> : <>
        <Sec title={r.reports.funnel} />
        <div className="panel re-funnel">{([[r.prop.views, d.funnel.views], [r.prop.inquiries, d.funnel.inquiries], [r.prop.viewingsDone, d.funnel.viewings], [r.prop.offers, d.funnel.offers], [r.reports.closed, d.funnel.deals]] as const).map(([t, n]) => (
          <div key={t}><b>{n}</b><i style={{ width: `${Math.max(6, (n / Math.max(1, d.funnel.views)) * 100)}%` }} /><small>{t}</small></div>))}</div>
        <div className="re-grid2">
          <div>
            <Sec title={r.reports.sources} />
            <div className="panel"><table className="re-table"><thead><tr><th></th><th>{r.reports.leads}</th><th>{r.reports.viewed}</th><th>{r.reports.won}</th></tr></thead>
              <tbody>{d.sources.map((s: any) => <tr key={s.source}><td>{r.sources[s.source] ?? s.source}<div className="re-meter mt-1"><i style={{ width: `${(s.leads / maxSrc) * 100}%` }} /></div></td><td>{s.leads}</td><td>{s.viewed}</td><td>{s.won}</td></tr>)}</tbody></table>
              {!d.sources.length && <p className="sub p-4">{r.reports.none}</p>}</div>
            <Sec title={r.reports.agents} />
            <div className="panel"><table className="re-table"><thead><tr><th></th><th>{r.reports.listings}</th><th>{r.reports.leads}</th><th>{r.reports.viewings}</th><th>{r.reports.closed}</th></tr></thead>
              <tbody>{d.agents.map((a: any) => <tr key={a.id}><td>{a.name}</td><td>{a.listings}</td><td>{a.leads}</td><td>{a.viewings}{a.no_shows ? <span className="sub"> · {a.no_shows}✕</span> : ''}</td><td>{a.closed}</td></tr>)}</tbody></table></div>
          </div>
          <div>
            {d.commission && Object.keys(d.commission).length > 0 && <><Sec title={r.reports.commission} /><div className="re-kpis">{Object.entries(d.commission).map(([cur, v]) => <div key={cur} className="re-kpi"><small>{cur}</small><b>{price(v as number, cur, lang)}</b></div>)}</div></>}
            <Sec title={r.reports.areas} />
            <div className="panel">{d.areas.length ? d.areas.map((a: any) => <div key={a.area} className="re-item"><span className="flex-1">{a.area}</span><span className="sub">{fmt(r.reports.daysOnMarket, { n: a.days })}</span><b>{a.closed}</b></div>) : <p className="sub p-4">{r.reports.none}</p>}</div>
            <Sec title={r.reports.interestNoOffers} />
            <div className="panel">{d.interestNoOffers.length ? d.interestNoOffers.map((p: any) => (
              <button key={p.id} className="re-item" onClick={() => go(`#/property?id=${p.id}`)}><span className="min-w-0 flex-1 truncate">#{p.ref} {p.title}</span><span className="sub">{fmt(r.today.views, { n: p.views ?? 0 })} · {fmt(r.owners.viewingsN, { n: p.viewings })}</span></button>
            )) : <p className="sub p-4">{r.reports.none}</p>}</div>
            <Sec title={r.reports.inventory} />
            <div className="panel"><table className="re-table"><tbody>{Object.entries((d.inventory as any[]).reduce<Record<string, Record<string, number>>>((m, x) => { (m[x.type] ??= {})[x.status] = x.n; return m; }, {})).map(([type, st]) => (
              <tr key={type}><td>{type}</td><td className="flex flex-wrap gap-1">{Object.entries(st).map(([s, n]) => <Pill key={s}>{r.status[s]} {n}</Pill>)}</td></tr>))}</tbody></table></div>
          </div>
        </div>
      </>}
    </div>
  );
}
