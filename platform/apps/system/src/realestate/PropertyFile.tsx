// One property, in context: what an agent needs while selling it, on one screen. Status and price; share, publish,
// schedule, start a deal; who may want it (and why); who was sent it and what they did; viewings, deals, documents;
// its funnel from page views to a deal; the owner and the agent. Nothing to hunt for.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, postBlob } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Empty, Pill, RIcon, Score, Sec, ShareSheet, StatusPill, Timeline, Why, Qr, LeadPicker } from './ui';
import { NewContract } from './Contracts';
import { ViewingForm } from './Agenda';
import { LiveSheet } from './Studio';
import { fmt, price, titleOf, waLink, telLink, localPhone, ago, useTeam, useSetup, stageTone, type Property, type Photo, type Card, type Activity, type Deal, type Viewing, type Share, type Owner } from './data';

const MOVES: Record<string, string[]> = {
  draft: ['available', 'archived'], available: ['reserved', 'negotiating', 'sold', 'rented', 'archived', 'draft'], negotiating: ['available', 'reserved', 'sold', 'rented', 'archived'],
  reserved: ['available', 'negotiating', 'sold', 'rented', 'archived'], sold: ['available', 'archived'], rented: ['available', 'archived'], archived: ['draft', 'available'],
};
type Full = { property: Property; photos: Photo[]; owner: Owner | null; viewings: Viewing[]; deals: (Deal & { lead: any; offers: any[] })[]; interested: any[]; matches: any[]; matchCount: number;
  activity: Activity[]; documents: any[]; collections: { n: number; fav: number }; funnel: { views: number; inquiries: number; viewings: number; offers: number; deal: boolean }; share: Share };

export function PropertyFile() {
  const { r, lang, can, toast, err } = useR();
  const { params } = useRoute();
  const id = params.get('id') ?? '';
  const qc = useQueryClient();
  const team = useTeam();
  const setup = useSetup();
  const q = useQuery<Full>({ queryKey: ['re-property', id], queryFn: () => api(`/v1/re/properties/${id}`), enabled: !!id });
  const [tab, setTab] = useState<string>(params.get('tab') ?? 'overview');
  const [sheet, setSheet] = useState<null | 'share' | 'status' | 'viewing' | 'deal' | 'collection' | 'report' | 'photos' | 'doc' | 'contract'>(null);
  const [live, setLive] = useState<any>(null), [photoAt, setPhotoAt] = useState(0);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['re-property', id] }); qc.invalidateQueries({ queryKey: ['re-props'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); };
  const publish = useMutation({ mutationFn: (on: boolean) => api<any>(`/v1/re/properties/${id}/publish`, { body: { on } }), onSuccess: (x, on) => { refresh(); if (on) setLive(x); }, onError: (e) => toast(err(e), 'bad') });
  if (q.isLoading) return <div className="grid gap-4"><div className="skeleton h-80" /><div className="skeleton h-40" /></div>;
  if (!q.data) return <div className="panel"><Empty icon="alert" title={err(q.error)} action={<a className="btn btn-secondary" href="#/properties">{r.common.back}</a>} /></div>;
  const { property: p, photos, owner, funnel } = q.data;
  const card: Card = { ...p, cover: photos[0]?.url ?? null };
  const agent = team(p.agentId);
  const facts = ([['size', p.size && fmt(r.props.m2, { n: p.size }), r.studio.size], ['size', p.land && p.land !== p.size && fmt(r.props.m2, { n: p.land }), r.studio.land], ['bed', p.bedrooms, r.studio.bedrooms],
    ['bath', p.bathrooms, r.studio.bathrooms], ['apartment', p.floors, r.studio.floors], ['car', p.parking, r.studio.parking], ['calendar', p.yearBuilt, r.studio.year]] as const).filter(([, v]) => v);
  const maxF = Math.max(1, funnel.views);
  const names = { [p.id]: titleOf(p, lang) };
  return (
    <div>
      <a href="#/properties" className="sub inline-flex items-center gap-1 mb-3"><Icon n="back" className="h-4 w-4 rtl:-scale-x-100" />{r.shell.properties}</a>
      <div className={`re-hero${photos.length < 3 ? ` n${photos.length}` : ''}`}>
        {photos.length ? photos.slice(0, 5).map((ph, i) => <button key={ph.id} onClick={() => { setPhotoAt(i); setSheet('photos'); }} aria-label={titleOf(p, lang)}><img src={ph.url} alt="" loading={i ? 'lazy' : 'eager'} /></button>)
          : <div className="grid place-items-center gap-2 text-center"><RIcon n="image" className="h-8 w-8" /><a className="btn btn-secondary btn-sm" href={`#/studio?id=${p.id}&step=4`}>{r.studio.addPhotos}</a></div>}
      </div>

      <div className="re-head">
        <div>
          <div className="flex flex-wrap items-center gap-2"><StatusPill status={p.status} /><Pill>{r.purpose[p.purpose]}</Pill><Pill>#{p.ref}</Pill>
            {p.publishedAt ? <Pill tone="ok"><Icon n="globe" className="h-3 w-3" />{r.prop.live}</Pill> : <Pill>{r.prop.notLive}</Pill>}</div>
          <h2 className="mt-2">{titleOf(p, lang)}</h2>
          {(p.area || p.city) && <p className="place"><RIcon n="pin" />{[p.area, p.city].filter(Boolean).join(lang === 'ar' ? '، ' : ', ')}</p>}
        </div>
        <div><p className="re-price-big">{price(p.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}</p>
          <p className="sub text-end">{[p.negotiable && r.studio.negotiable, fmt(r.prop.daysOn, { n: Math.max(0, Math.round((Date.now() - +new Date(p.statusAt)) / 86400_000)) })].filter(Boolean).join(' · ')}</p></div>
      </div>

      <div className="re-actions">
        <button className="btn btn-wa" onClick={() => setSheet('share')}><Icon n="wa" />{r.prop.share}</button>
        {p.publishedAt ? <a className="btn btn-secondary" href={q.data.share.url} target="_blank" rel="noopener"><Icon n="globe" />{r.prop.viewPage}</a>
          : can('listings.publish') && <button className="btn btn-accent" disabled={publish.isPending} onClick={() => publish.mutate(true)}><Icon n="globe" />{r.prop.publish}</button>}
        {can('viewings.manage') && ['available', 'negotiating', 'reserved'].includes(p.status) && <button className="btn btn-secondary" onClick={() => setSheet('viewing')}><Icon n="calendar" />{r.prop.schedule}</button>}
        {can('deals.manage') && ['available', 'negotiating', 'reserved'].includes(p.status) && <button className="btn btn-secondary" onClick={() => setSheet('deal')}><Icon n="wallet" />{r.prop.newDeal}</button>}
        {p.publishedAt && <button className="btn btn-secondary" onClick={() => setSheet('collection')}><Icon n="clip" />{r.prop.addToCollection}</button>}
        {can('listings.update') && <button className="btn btn-secondary" onClick={() => setSheet('status')}><RIcon n="key" />{r.prop.status}</button>}
        {can('listings.update') && <a className="btn btn-secondary" href={`#/studio?id=${p.id}`}><Icon n="edit" />{r.prop.edit}</a>}
        {owner && <button className="btn btn-secondary" onClick={() => setSheet('report')}><Icon n="chart" />{r.prop.report}</button>}
        {can('deals.manage') && <button className="btn btn-secondary" onClick={() => setSheet('contract')}><Icon n="pen" />{r.contract.new}</button>}
      </div>
      {facts.length > 0 && <div className="re-facts">{facts.map(([ic, v, t], i) => <span key={i} className="re-fact"><RIcon n={ic === 'car' ? 'truck' : ic} /><b>{v}</b><span className="sub">{t}</span></span>)}</div>}

      <div className="re-cols">
        <div>
          <div className="re-tabs mb-3">
            {([['overview', r.prop.overview], ['interested', `${r.prop.interested}`, q.data.interested.length + q.data.matchCount], ['viewings', r.prop.viewings, q.data.viewings.length], ['deals', r.prop.deals, q.data.deals.length], ['activity', r.prop.activity], ['documents', r.prop.documents, q.data.documents.length]] as const)
              .map(([k, t, n]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t}{!!n && <span className="c">{n}</span>}</button>)}
          </div>

          {tab === 'overview' && <>
            <div className="panel">
              <div className="panel-h"><h2>{r.prop.funnel}</h2></div>
              <div className="re-funnel">{([[r.prop.views, funnel.views], [r.prop.inquiries, funnel.inquiries], [r.prop.viewingsDone, funnel.viewings], [r.prop.offers, funnel.offers], [r.prop.deal, funnel.deal ? 1 : 0]] as const).map(([t, n]) => (
                <div key={t}><b>{n}</b><i style={{ width: `${Math.max(8, (n / maxF) * 100)}%` }} /><small>{t}</small></div>))}</div>
            </div>
            <Sec title={q.data.matchCount ? fmt(r.prop.matchesN, { n: q.data.matchCount }) : r.prop.match} action={q.data.matchCount > 3 && <button onClick={() => setTab('interested')}>{r.common.more}</button>} />
            <div className="panel">{q.data.matches.length ? q.data.matches.slice(0, 4).map((m) => <MatchRow key={m.lead.id} m={m} propertyId={p.id} published={!!p.publishedAt} />) : <p className="sub p-4">{r.prop.noMatches}</p>}</div>
            {(p.description?.ar || p.description?.en) && <><Sec title={r.studio.description} /><div className="panel p-5 leading-relaxed whitespace-pre-line text-[var(--fg-2)]">{p.description[lang === 'en' ? 'en' : 'ar'] || p.description.ar || p.description.en}</div></>}
            <Sec title={r.prop.details} />
            <div className="panel p-5"><dl className="kv">
              <dt>{r.studio.type}</dt><dd>{setup.data?.types[p.type]?.[lang === 'en' ? 'en' : 'ar'] ?? p.type}</dd>
              {p.furnished && <><dt>{r.studio.furnished}</dt><dd>{r.furnished[p.furnished]}</dd></>}
              {p.condition && <><dt>{r.studio.condition}</dt><dd>{r.condition[p.condition]}</dd></>}
              {p.features.length > 0 && <><dt>{r.studio.features}</dt><dd className="flex flex-wrap gap-1">{p.features.map((f) => <Pill key={f}>{f}</Pill>)}</dd></>}
              {p.address && <><dt>{r.prop.address}</dt><dd>{p.address} <span className="sub">· {r.prop.private}</span></dd></>}
              {p.ownerMin != null && <><dt>{r.prop.ownerMin}</dt><dd className="re-num">{price(p.ownerMin, p.currency, lang)} <span className="sub">· {r.prop.private}</span></dd></>}
              {p.notes && <><dt>{r.prop.notes}</dt><dd className="whitespace-pre-line">{p.notes}</dd></>}
            </dl></div>
          </>}

          {tab === 'interested' && <>
            {q.data.interested.length > 0 && <><Sec title={r.lead.seenTitle} /><div className="panel">{q.data.interested.map((x: any) => (
              <button key={x.id} className="re-item" onClick={() => go(`#/lead?id=${x.lead.id}`)}><Avatar name={x.lead.name} /><span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.lead.name}</b><span className="sub">{ago(x.lastOpenAt ?? x.sentAt, r)}{x.opens ? ` · ${fmt(r.lead.opened, { n: x.opens })}` : ''}</span></span>
                <Pill tone={x.status === 'favorite' ? 'bad' : x.status === 'viewed' ? 'ok' : x.status === 'opened' ? 'info' : x.status === 'dismissed' ? '' : 'accent'}>{(r.prop as any)[x.status] ?? x.status}</Pill></button>
            ))}</div></>}
            <Sec title={fmt(r.prop.matchesN, { n: q.data.matchCount })} />
            <div className="panel">{q.data.matches.length ? q.data.matches.map((m) => <MatchRow key={m.lead.id} m={m} propertyId={p.id} published={!!p.publishedAt} />) : <p className="sub p-4">{r.prop.noMatches}</p>}</div>
          </>}

          {tab === 'viewings' && <div className="panel">{q.data.viewings.length ? q.data.viewings.map((v) => (
            <button key={v.id} className="re-item" onClick={() => v.lead && go(`#/lead?id=${v.lead.id}`)}><span className="time">{v.startsAt ? new Date(v.startsAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-IQ', { day: 'numeric', month: 'short' }) : '—'}</span>
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{v.lead?.name ?? '—'}</b><span className="sub">{[v.outcome && r.outcome[v.outcome], v.feedback].filter(Boolean).join(' · ')}</span></span><Pill>{r.vstatus[v.status]}</Pill></button>
          )) : <p className="sub p-4">{r.prop.noViewings}</p>}</div>}

          {tab === 'deals' && <div className="panel">{q.data.deals.length ? q.data.deals.map((x) => (
            <button key={x.id} className="re-item" onClick={() => go(`#/deals?id=${x.id}`)}><span className="re-av"><RIcon n="wallet" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.lead?.name ?? '—'}</b>
              <span className="sub">{x.offers.filter((o: any) => o.kind !== 'asking').map((o: any) => price(o.amount, x.currency, lang, null, true)).join(' → ') || price(x.asking, x.currency, lang)}</span></span><Pill tone={stageTone(x.stage)}>{r.stages[x.stage]}</Pill></button>
          )) : <p className="sub p-4">{r.prop.noDeals}</p>}</div>}

          {tab === 'activity' && <div className="panel"><Timeline items={q.data.activity} names={names} /></div>}

          {tab === 'documents' && <Documents docs={q.data.documents} propertyId={p.id} onChanged={refresh} />}
        </div>

        <aside className="grid gap-3">
          <div className="panel p-4">
            <p className="sec-t">{r.prop.owner}</p>
            {owner ? <div className="flex items-center gap-3"><Avatar name={owner.name} /><button className="min-w-0 flex-1 text-start" onClick={() => go(`#/owners?id=${owner.id}`)}><b className="block truncate">{owner.name}</b><span className="sub" dir="ltr">{localPhone(owner.phone)}</span></button>
              {waLink(owner.whatsapp ?? owner.phone) && <a className="icon-btn re-icon-wa" href={waLink(owner.whatsapp ?? owner.phone)!} target="_blank" rel="noopener"><Icon n="wa" /></a>}
              {owner.phone && <a className="icon-btn" href={telLink(owner.phone)!}><Icon n="phone" /></a>}</div>
              : <a className="sub underline" href={`#/studio?id=${p.id}&step=6`}>{r.prop.noOwner}</a>}
          </div>
          <div className="panel p-4"><p className="sec-t">{r.prop.agent}</p>{agent ? <div className="flex items-center gap-3"><Avatar name={agent.name} /><b className="truncate">{agent.name}</b></div> : <span className="sub">—</span>}</div>
          {p.publishedAt && <div className="panel p-4 grid justify-items-center gap-2 text-center">
            <div className="re-qr" style={{ padding: '.5rem' }}><Qr text={q.data.share.qr} className="block [&_svg]:h-32 [&_svg]:w-32" /></div>
            <span className="sub break-all" dir="ltr">{q.data.share.url.replace('https://', '')}</span>
            <span className="sub">{fmt(r.prop.inCollections, { n: q.data.collections.n, f: q.data.collections.fav })}</span>
          </div>}
        </aside>
      </div>

      {sheet === 'share' && <ShareSheet propertyId={p.id} card={{ ...card, description: p.description, features: p.features } as any} onClose={() => setSheet(null)} />}
      {sheet === 'status' && <StatusSheet p={p} onClose={() => setSheet(null)} onDone={refresh} />}
      {sheet === 'viewing' && <ViewingForm property={p} onClose={() => { setSheet(null); refresh(); }} />}
      {sheet === 'deal' && <DealStart propertyId={p.id} title={titleOf(p, lang)} onClose={() => setSheet(null)} />}
      {sheet === 'collection' && <AddToCollection propertyId={p.id} onClose={() => setSheet(null)} />}
      {sheet === 'contract' && <NewContract propertyId={p.id} purpose={p.purpose} onClose={() => setSheet(null)} />}
      {sheet === 'report' && <OwnerReport propertyId={p.id} title={titleOf(p, lang)} onClose={() => setSheet(null)} />}
      {sheet === 'photos' && <Sheet title={titleOf(p, lang)} sub={`${photoAt + 1} / ${photos.length}`} onClose={() => setSheet(null)}>
        <div className="grid gap-2">{photos.map((ph, i) => <img key={ph.id} src={ph.url} alt="" loading={Math.abs(i - photoAt) > 2 ? 'lazy' : 'eager'} className="w-full rounded-xl" ref={(el) => { if (el && i === photoAt) el.scrollIntoView({ block: 'start' }); }} />)}</div>
      </Sheet>}
      {live && <LiveSheet res={live} onClose={() => setLive(null)} />}
    </div>
  );
}

/** One lead who may want this listing: the score, why, and "send it" (WhatsApp with the message ready). */
function MatchRow({ m, propertyId, published }: { m: any; propertyId: string; published: boolean }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const send = async () => {
    try { const x = await api<{ wa: string }>(`/v1/re/leads/${m.lead.id}/send`, { body: { propertyIds: [propertyId] } }); window.open(x.wa, '_blank', 'noopener'); qc.invalidateQueries({ queryKey: ['re-property', propertyId] }); }
    catch (e) { toast(err(e), 'bad'); }
  };
  return (
    <div className="re-match">
      <Score s={m.score} />
      <button className="min-w-0 flex-1 text-start" onClick={() => go(`#/lead?id=${m.lead.id}`)}><b className="block truncate font-medium">{m.lead.name}</b><Why reasons={m.reasons} /></button>
      {m.sent ? <Pill tone="info">{(r.prop as any)[m.sent] ?? r.prop.sent}</Pill> : published && (m.lead.whatsapp || m.lead.phone) && <button className="btn btn-wa btn-sm" onClick={send}><Icon n="wa" />{r.prop.sendTo}</button>}
    </div>
  );
}

function StatusSheet({ p, onClose, onDone }: { p: Property; onClose(): void; onDone(): void }) {
  const { r, toast, err, can } = useR();
  const set = useMutation({ mutationFn: (status: string) => api<{ told: number }>(`/v1/re/properties/${p.id}/status`, { body: { status } }),
    onSuccess: (x) => { onDone(); if (x.told) toast(fmt(r.prop.soldTold, { n: x.told })); onClose(); }, onError: (e) => toast(err(e), 'bad') });
  const moves = (MOVES[p.status] ?? []).filter((s) => (s !== 'sold' || p.purpose === 'sale') && (s !== 'rented' || p.purpose === 'rent') && (s !== 'archived' || can('listings.publish') || can('listings.archive')));
  return (
    <Sheet title={r.prop.status} sub={r.status[p.status]} onClose={onClose} center>
      <div className="grid gap-2">{moves.map((s) => <button key={s} className={`btn ${s === 'archived' ? 'btn-danger' : 'btn-secondary'} justify-start`} disabled={set.isPending} onClick={() => set.mutate(s)}><StatusPill status={s} />{r.statusDo[s]}</button>)}</div>
    </Sheet>
  );
}

/** Start a deal on this property with a lead. */
export function DealStart({ propertyId, title, onClose, lead }: { propertyId: string; title: string; onClose(): void; lead?: { id: string; name: string } }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const start = useMutation({ mutationFn: (leadId: string) => api<any>('/v1/re/deals', { body: { propertyId, leadId } }),
    onSuccess: (x) => { qc.invalidateQueries({ queryKey: ['re-deals'] }); qc.invalidateQueries({ queryKey: ['re-property', propertyId] }); onClose(); go(`#/deals?id=${x.deal.id}`); },
    onError: (e: any) => { if (e instanceof ApiError && e.code === 'DEAL_EXISTS') toast(r.deals.exists, 'bad'); else toast(err(e), 'bad'); } });
  if (lead) return <Sheet title={r.deals.start} sub={fmt(r.deals.startFor, { property: title })} onClose={onClose} center footer={<button className="btn btn-accent justify-center" disabled={start.isPending} onClick={() => start.mutate(lead.id)}>{r.deals.start} · {lead.name}</button>}><span /></Sheet>;
  return <Sheet title={r.deals.start} sub={fmt(r.deals.startFor, { property: title })} onClose={onClose}><p className="sec-t">{r.deals.pickLead}</p><LeadPicker onPick={(l) => start.mutate(l.id)} /></Sheet>;
}

/** Add this property to one of the collections (or a new one). */
export function AddToCollection({ propertyId, onClose }: { propertyId: string; onClose(): void }) {
  const { r, toast, err } = useR();
  const cols = useQuery<{ collections: any[] }>({ queryKey: ['re-collections'], queryFn: () => api('/v1/re/collections') });
  const [title, setTitle] = useState('');
  const add = async (id: string) => { try { await api(`/v1/re/collections/${id}/items`, { body: { propertyId } }); toast(r.common.done); onClose(); } catch (e) { toast(err(e), 'bad'); } };
  const make = async () => { try { await api('/v1/re/collections', { body: { title, propertyIds: [propertyId] } }); toast(r.collections.created); onClose(); } catch (e) { toast(err(e), 'bad'); } };
  return (
    <Sheet title={r.collections.add} onClose={onClose}>
      <p className="sec-t">{r.collections.pick}</p>
      <div className="panel">{(cols.data?.collections ?? []).map((c) => <button key={c.id} className="re-item" onClick={() => add(c.id)}><RIcon n="clip" /><span className="min-w-0 flex-1"><b className="block truncate">{c.title}</b><span className="sub">{c.lead?.name ?? ''} · {fmt(r.collections.items, { n: c.items })}</span></span></button>)}
        {cols.data && !cols.data.collections.length && <p className="sub p-4">{r.collections.empty}</p>}</div>
      <p className="sec-t mt-2">{r.collections.newOne}</p>
      <div className="flex gap-2"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={r.lead.collectionTitle} /><button className="btn btn-accent" disabled={!title.trim()} onClick={make}>{r.common.add}</button></div>
    </Sheet>
  );
}

/** A report link for the owner: views, inquiries, viewings, offers. Ready to send on WhatsApp. */
export function OwnerReport({ propertyId, title, onClose }: { propertyId: string; title: string; onClose(): void }) {
  const { r, err } = useR();
  const [note, setNote] = useState('');
  const make = useMutation({ mutationFn: () => api<{ url: string; text: string; wa: string | null }>('/v1/re/owners/reports', { body: { propertyId, note } }) });
  return (
    <Sheet title={r.prop.report} sub={fmt(r.owners.reportFor, { property: title })} onClose={onClose} center
      footer={make.data ? <div className="grid gap-2">{make.data.wa && <a className="btn btn-wa justify-center" href={make.data.wa} target="_blank" rel="noopener"><Icon n="wa" />{r.owners.sendReport}</a>}<a className="btn btn-secondary justify-center" href={make.data.url} target="_blank" rel="noopener">{r.owners.openReport}</a></div>
        : <button className="btn btn-accent justify-center" disabled={make.isPending} onClick={() => make.mutate()}>{r.owners.report}</button>}>
      {make.data ? <p className="note"><Icon n="check" />{r.owners.reportReady}</p> : <label className="field">{r.owners.reportNote}<textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>}
      {make.error && <p className="error">{err(make.error)}</p>}
    </Sheet>
  );
}

/** Documents: title deed, contract, ID… private links that last an hour; upload an image or a PDF. */
export function Documents({ docs, propertyId, ownerId, dealId, onChanged }: { docs: any[]; propertyId?: string; ownerId?: string; dealId?: string; onChanged(): void }) {
  const { r, toast, err, can } = useR();
  const [adding, setAdding] = useState(false), [title, setTitle] = useState(''), [kind, setKind] = useState('deed'), [expires, setExpires] = useState(''), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false);
  const upload = async () => {
    if (!file || !title.trim()) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams({ title, kind, ...(expires ? { expiresOn: expires } : {}), ...(propertyId ? { propertyId } : {}), ...(ownerId ? { ownerId } : {}), ...(dealId ? { dealId } : {}) });
      await postBlob(`/v1/re/documents?${qs}`, file);
      setAdding(false); setTitle(''); setFile(null); onChanged();
    } catch (e) { toast(err(e), 'bad'); } finally { setBusy(false); }
  };
  return (
    <div className="panel">
      {docs.length ? docs.map((d) => (
        <a key={d.id} className="re-item" href={d.url} target="_blank" rel="noopener"><span className="re-av"><RIcon n="file" className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><b className="block truncate font-medium">{d.title}</b><span className="sub">{r.prop.docKind[d.kind] ?? d.kind}{d.expiresOn ? ` · ${r.prop.expires} ${d.expiresOn}` : ''}</span></span><Icon n="download" className="h-4 w-4" /></a>
      )) : <p className="sub p-4">{r.prop.noDocs}</p>}
      {can('listings.update') && <div className="border-t border-[var(--line)] p-3"><button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}><Icon n="plus" />{r.prop.addDoc}</button></div>}
      {adding && <Sheet title={r.prop.addDoc} onClose={() => setAdding(false)} center footer={<button className="btn btn-accent justify-center" disabled={busy || !file || !title.trim()} onClick={upload}>{busy ? <span className="spinner" /> : r.common.save}</button>}>
        <label className="field">{r.prop.docTitle}<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="chips">{Object.entries(r.prop.docKind).map(([k, t]) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{t}</button>)}</div>
        <label className="field">{r.prop.expires} <small>({r.common.optional})</small><input className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Sheet>}
    </div>
  );
}
