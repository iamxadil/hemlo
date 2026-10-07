// One lead: what they want, what fits, what they've seen, and what to do next. The next action sits at the top;
// matching homes come with their score and why; pick a few and send them (one WhatsApp message) or make them a
// collection (one link). Everything they did with what we sent shows on their timeline.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { Icon, Sheet } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Empty, Pill, RIcon, Score, Sec, Timeline, Why } from './ui';
import { FollowupForm, ViewingForm } from './Agenda';
import { LeadForm } from './Leads';
import { DealStart } from './PropertyFile';
import { fmt, price, titleOf, ago, waLink, telLink, localPhone, useSetup, stageTone, type Lead, type Card, type Reason, type Followup, type Activity } from './data';

type Full = { lead: Lead; matches: { property: Card; score: number; reasons: Reason[]; sent: any }[]; matchCount: number; sent: any[]; viewings: any[]; followups: Followup[]; deals: any[]; activity: Activity[]; collections: any[] };

export function LeadFile() {
  const { r, lang, can, toast, err } = useR();
  const { params } = useRoute();
  const id = params.get('id') ?? '';
  const setup = useSetup();
  const qc = useQueryClient();
  const q = useQuery<Full>({ queryKey: ['re-lead', id], queryFn: () => api(`/v1/re/leads/${id}`), enabled: !!id });
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<null | 'edit' | 'follow' | 'viewing' | 'collection' | 'deal' | 'log'>(null);
  const [colTitle, setColTitle] = useState(''), [colNote, setColNote] = useState(''), [log, setLog] = useState('');
  const [all, setAll] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['re-lead', id] }); qc.invalidateQueries({ queryKey: ['re-leads'] }); qc.invalidateQueries({ queryKey: ['re-today'] }); };
  const more = useQuery<{ matches: Full['matches']; total: number }>({ queryKey: ['re-lead-matches', id], queryFn: () => api(`/v1/re/leads/${id}/matches`), enabled: all });
  if (q.isLoading) return <div className="grid gap-4"><div className="skeleton h-40" /><div className="skeleton h-80" /></div>;
  if (!q.data) return <div className="panel"><Empty icon="alert" title={err(q.error)} action={<a className="btn btn-secondary" href="#/leads">{r.common.back}</a>} /></div>;
  const { lead: l } = q.data;
  const matches = all && more.data ? more.data.matches : q.data.matches;
  const phone = l.whatsapp ?? l.phone;
  const next = q.data.followups[0];
  const types = setup.data?.types ?? {}, features = setup.data?.features ?? {};
  const names = Object.fromEntries([...q.data.sent.map((s) => [s.propertyId, titleOf(s.property, lang)]), ...q.data.matches.map((m) => [m.property.id, titleOf(m.property, lang)])]);
  const send = async () => {
    try { const x = await api<{ wa: string }>(`/v1/re/leads/${id}/send`, { body: { propertyIds: [...pick] } }); window.open(x.wa, '_blank', 'noopener'); setPick(new Set()); refresh(); }
    catch (e) { toast(err(e), 'bad'); }
  };
  const makeCollection = async () => {
    try { const x = await api<{ wa: string | null; collection: any }>('/v1/re/collections', { body: { title: colTitle || fmt(r.lead.collectionDef, { name: l.name }), note: colNote, leadId: id, propertyIds: [...pick] } });
      setSheet(null); setPick(new Set()); refresh(); toast(r.collections.created); if (x.wa) window.open(x.wa, '_blank', 'noopener'); }
    catch (e) { toast(err(e), 'bad'); }
  };
  const dismiss = async (propertyId: string) => { try { await api(`/v1/re/leads/${id}/dismiss`, { body: { propertyId } }); refresh(); } catch (e) { toast(err(e), 'bad'); } };
  const logContact = async () => { try { await api(`/v1/re/leads/${id}/contact`, { body: { channel: 'call', note: log } }); setSheet(null); setLog(''); toast(r.lead.logged); refresh(); } catch (e) { toast(err(e), 'bad'); } };
  const setStatus = async (status: string) => { try { await api(`/v1/re/leads/${id}`, { method: 'PATCH', body: { status } }); refresh(); } catch (e) { toast(err(e), 'bad'); } };
  const toggle = (pid: string) => setPick((s) => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });

  return (
    <div>
      <a href="#/leads" className="sub mb-3 inline-flex items-center gap-1"><Icon n="back" className="h-4 w-4 rtl:-scale-x-100" />{r.shell.leads}</a>
      <div className="panel p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={l.name} lg />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">{l.name}</h2>
            <p className="sub"><span dir="ltr">{localPhone(l.phone)}</span>{[r.sources[l.source], l.createdAt && ago(l.createdAt, r)].filter(Boolean).map((x) => ` · ${x}`).join('')}</p>
          </div>
          <select className="re-select" value={l.status} onChange={(e) => setStatus(e.target.value)} aria-label={r.lead.title}>{Object.entries(r.leadStatus).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </div>
        <div className="re-actions">
          {phone && <a className="btn btn-wa" href={waLink(phone)!} target="_blank" rel="noopener"><Icon n="wa" />{r.lead.wa}</a>}
          {l.phone && <a className="btn btn-secondary" href={telLink(l.phone)!}><Icon n="phone" />{r.lead.call}</a>}
          <button className="btn btn-secondary" onClick={() => setSheet('log')}><Icon n="check" />{r.lead.logContact}</button>
          <button className="btn btn-secondary" onClick={() => setSheet('follow')}><Icon n="bell" />{r.lead.addFollow}</button>
          {can('viewings.manage') && <button className="btn btn-secondary" onClick={() => setSheet('viewing')}><Icon n="calendar" />{r.prop.schedule}</button>}
          {can('leads.update') && <button className="btn btn-secondary" onClick={() => setSheet('edit')}><Icon n="edit" />{r.lead.editWants}</button>}
        </div>
      </div>

      <div className={`re-next mt-4${next && +new Date(next.dueAt) < Date.now() ? ' overdue' : ''}`}>
        <span className="ic"><Icon n={next ? 'bell' : 'clock'} /></span>
        <span className="min-w-0 flex-1"><b className="block">{r.lead.nextAction}</b>
          <span className="sub">{next ? `${r.fkind[next.kind]}${next.note ? ` · ${next.note}` : ''} · ${ago(next.dueAt, r)}` : r.lead.noNext}</span></span>
        {next ? <button className="btn btn-secondary btn-sm" onClick={async () => { await api(`/v1/re/followups/${next.id}`, { method: 'PATCH', body: { done: true } }); refresh(); }}><Icon n="check" />{r.agenda.complete}</button>
          : <button className="btn btn-accent btn-sm" onClick={() => setSheet('follow')}>{r.lead.addFollow}</button>}
      </div>

      <div className="re-cols">
        <div>
          <Sec title={r.lead.wantsTitle} action={<button onClick={() => setSheet('edit')}>{r.common.edit}</button>} />
          <div className="panel p-4">
            <div className="re-wants">
              <span><b>{r.wants[l.purpose]}</b></span>
              {(l.types.length ? l.types : ['']).map((t) => <span key={t}>{t ? types[t]?.[lang === 'en' ? 'en' : 'ar'] ?? t : r.leads.any}</span>)}
              {(l.budgetMin != null || l.budgetMax != null) && <span>{r.lead.budget}: <b>{[l.budgetMin != null && price(l.budgetMin, l.currency, lang, null, true), l.budgetMax != null && price(l.budgetMax, l.currency, lang, null, true)].filter(Boolean).join(' – ')}</b></span>}
              {l.areas.map((a) => <span key={a}><RIcon n="pin" className="inline h-3.5 w-3.5" /> {a}</span>)}
              {l.bedrooms != null && <span>{l.bedrooms}+ 🛏</span>}
              {l.sizeMin != null && <span>{l.sizeMin}+ m²</span>}
              {l.must.map((m) => <span key={m}>✓ {features[m]?.[lang === 'en' ? 'en' : 'ar'] ?? m}</span>)}
            </div>
            {l.notes && <p className="sub mt-3 whitespace-pre-line">{l.notes}</p>}
          </div>

          <Sec title={q.data.matchCount ? fmt(r.lead.matchesN, { n: q.data.matchCount, name: l.name.split(' ')[0] }) : r.lead.matchesTitle} action={q.data.matchCount > q.data.matches.length && !all && <button onClick={() => setAll(true)}>{r.common.more}</button>} />
          <div className="panel">
            {matches.length ? matches.map((m) => (
              <div key={m.property.id} className="re-match">
                <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={pick.has(m.property.id)} onChange={() => toggle(m.property.id)} disabled={!m.property.publishedAt} aria-label={titleOf(m.property, lang)} />
                {m.property.cover ? <img src={m.property.cover} alt="" className="h-14 w-20 rounded-lg object-cover" loading="lazy" /> : <span className="h-14 w-20 rounded-lg bg-[var(--sunken)]" />}
                <button className="min-w-0 flex-1 text-start" onClick={() => go(`#/property?id=${m.property.id}`)}>
                  <b className="block truncate font-medium">{titleOf(m.property, lang)}</b>
                  <span className="sub block">{price(m.property.price, m.property.currency, lang, m.property.purpose === 'rent' ? m.property.rentPeriod : null)} · {m.property.area}</span>
                  <Why reasons={m.reasons} />
                </button>
                <span className="grid justify-items-center gap-1"><Score s={m.score} />{m.sent ? <Pill tone="info">{(r.prop as any)[m.sent.status] ?? r.prop.sent}</Pill> : <button className="sub underline" onClick={() => dismiss(m.property.id)}>{r.lead.notFor}</button>}</span>
              </div>
            )) : <p className="sub p-4">{r.lead.noMatches}</p>}
          </div>
          {pick.size > 0 && <div className="re-bulk"><b className="me-2">{fmt(r.props.selected, { n: pick.size })}</b>
            <button className="btn" style={{ background: 'var(--wa)' }} onClick={send}><Icon n="wa" />{fmt(r.lead.sendSelected, { n: pick.size })}</button>
            <button className="btn" onClick={() => { setColTitle(fmt(r.lead.collectionDef, { name: l.name.split(' ')[0] })); setSheet('collection'); }}><Icon n="clip" />{r.lead.makeCollection}</button>
            <span className="flex-1" /><button className="icon-btn" style={{ color: 'inherit' }} onClick={() => setPick(new Set())}><Icon n="close" /></button></div>}

          {q.data.sent.length > 0 && <><Sec title={r.lead.seenTitle} /><div className="panel">{q.data.sent.map((s) => (
            <button key={s.id} className="re-row-p" onClick={() => go(`#/property?id=${s.propertyId}`)}>{s.property.cover ? <img src={s.property.cover} alt="" /> : <span className="ph" />}
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{titleOf(s.property, lang)}</b><span className="sub">{ago(s.lastOpenAt ?? s.sentAt, r)}{s.opens ? ` · ${fmt(r.lead.opened, { n: s.opens })}` : ''}</span></span>
              <Pill tone={s.status === 'favorite' ? 'bad' : s.status === 'viewed' ? 'ok' : s.status === 'opened' ? 'info' : ''}>{(r.prop as any)[s.status] ?? s.status}</Pill></button>
          ))}</div></>}
        </div>

        <aside>
          {q.data.viewings.length > 0 && <><Sec title={r.lead.viewings} /><div className="panel">{q.data.viewings.map((v) => (
            <button key={v.id} className="re-item" onClick={() => go(`#/property?id=${v.property.id}`)}><span className="time">{v.startsAt ? new Date(v.startsAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-IQ', { day: 'numeric', month: 'short' }) : '—'}</span>
              <span className="min-w-0 flex-1 truncate">{v.property.title}</span><Pill>{v.outcome ? r.outcome[v.outcome] : r.vstatus[v.status]}</Pill></button>))}</div></>}
          <Sec title={r.lead.deals} action={can('deals.manage') && q.data.matches[0] && <button onClick={() => setSheet('deal')}>{r.deals.start}</button>} />
          <div className="panel">{q.data.deals.length ? q.data.deals.map((x) => (
            <button key={x.id} className="re-item" onClick={() => go(`#/deals?id=${x.id}`)}><span className="min-w-0 flex-1 truncate">{x.property.title}</span><Pill tone={stageTone(x.stage)}>{r.stages[x.stage]}</Pill></button>
          )) : <p className="sub p-4">{r.prop.noDeals}</p>}</div>
          {q.data.collections.length > 0 && <><Sec title={r.lead.collections} /><div className="panel">{q.data.collections.map((c) => (
            <a key={c.id} className="re-item" href={c.url} target="_blank" rel="noopener"><RIcon n="clip" /><span className="min-w-0 flex-1"><b className="block truncate">{c.title}</b><span className="sub">{c.opens ? fmt(r.collections.opens, { n: c.opens }) : r.collections.never}</span></span></a>))}</div></>}
          <Sec title={r.lead.activity} />
          <div className="panel"><Timeline items={q.data.activity} names={names} /></div>
        </aside>
      </div>

      {sheet === 'edit' && <LeadForm lead={l} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); refresh(); qc.invalidateQueries({ queryKey: ['re-lead-matches', id] }); }} />}
      {sheet === 'follow' && <FollowupForm leadId={id} onClose={() => { setSheet(null); refresh(); }} />}
      {sheet === 'viewing' && <ViewingForm lead={l} property={pick.size === 1 ? matches.find((m) => pick.has(m.property.id))?.property : null} onClose={() => { setSheet(null); refresh(); }} />}
      {sheet === 'deal' && <DealStartPick leadId={id} leadName={l.name} options={q.data.matches.map((m) => m.property)} onClose={() => setSheet(null)} />}
      {sheet === 'collection' && <Sheet title={r.lead.makeCollection} sub={fmt(r.collections.items, { n: pick.size })} onClose={() => setSheet(null)} center footer={<button className="btn btn-accent justify-center" onClick={makeCollection}><Icon n="wa" />{r.collections.send}</button>}>
        <label className="field">{r.lead.collectionTitle}<input className="input" value={colTitle} onChange={(e) => setColTitle(e.target.value)} /></label>
        <label className="field">{r.lead.collectionNote}<textarea className="input" rows={2} value={colNote} onChange={(e) => setColNote(e.target.value)} /></label>
      </Sheet>}
      {sheet === 'log' && <Sheet title={r.lead.logContact} onClose={() => setSheet(null)} center footer={<button className="btn btn-accent justify-center" onClick={logContact}>{r.common.save}</button>}>
        <label className="field">{r.agenda.note}<textarea className="input" rows={3} value={log} onChange={(e) => setLog(e.target.value)} autoFocus /></label>
      </Sheet>}
    </div>
  );
}

/** A deal for this lead: on which of their matching homes? */
function DealStartPick({ leadId, leadName, options, onClose }: { leadId: string; leadName: string; options: Card[]; onClose(): void }) {
  const { r, lang } = useR();
  const [p, setP] = useState<Card | null>(null);
  if (p) return <DealStart propertyId={p.id} title={titleOf(p, lang)} lead={{ id: leadId, name: leadName }} onClose={onClose} />;
  return <Sheet title={r.deals.start} onClose={onClose}><div className="panel">{options.map((o) => <button key={o.id} className="re-row-p" onClick={() => setP(o)}>{o.cover ? <img src={o.cover} alt="" /> : <span className="ph" />}<span className="min-w-0 flex-1 truncate">{titleOf(o, lang)}</span></button>)}</div></Sheet>;
}
