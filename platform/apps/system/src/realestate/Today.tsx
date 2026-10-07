// Today: "what is happening, and what should I do?" The morning brief first (only what has something in it, each line
// taking you to it), then what needs attention (viewings, follow-ups, requests from the public pages, negotiations
// waiting on an answer), then opportunities (homes getting interest, leads going quiet, listings going stale) and the
// month's numbers. An agent sees their own day; a manager can switch to the whole agency.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go } from '../lib/app';
import { Icon } from '../components/ui';
import { useR } from './i18n';
import { Empty, RIcon, Sec, Timeline, Avatar } from './ui';
import { ViewingRow, FollowRow } from './Agenda';
import { fmt, price, ago, waLink, type Viewing, type Followup, type Card } from './data';

export function Today() {
  const { r, lang, can } = useR();
  const [scope, setScope] = useState<'me' | 'all'>(() => (can('leads.read-all') ? 'all' : 'me'));
  const q = useQuery<any>({ queryKey: ['re-today', scope], queryFn: () => api(`/v1/re/today?scope=${scope}`), refetchInterval: 120_000 });
  if (q.isLoading) return <div className="grid gap-4"><div className="skeleton h-44" /><div className="skeleton h-72" /></div>;
  if (!q.data) return <div className="panel"><Empty icon="alert" title={r.common.retry} action={<button className="btn btn-secondary" onClick={() => q.refetch()}>{r.common.retry}</button>} /></div>;
  const d = q.data, b = d.brief;
  const lines = ([
    [b.overdue, 'var(--bad)', r.today.overdue, '#/agenda?tab=followups'],
    [b.followups - b.overdue, 'var(--warn)', r.today.followups, '#/agenda?tab=followups'],
    [b.viewings, '#5FC4A4', r.today.viewings, '#/agenda?tab=today'],
    [b.requests, '#6CA3DE', r.today.requests, '#/agenda?tab=requests'],
    [b.negotiations, 'var(--warn)', r.today.negotiations, '#/deals'],
    [b.newLeads, '#5FC4A4', r.today.newLeads, '#/leads?f=new'],
    [b.matches, '#C9A55A', r.today.matches, '#/properties'],
    [b.documents, 'var(--bad)', r.today.documents, '#/properties'],
    [b.tomorrow, '#8D9A95', r.today.tomorrow, '#/agenda?tab=tomorrow'],
  ] as const).filter(([n]) => n > 0);
  const first = lines[0]?.[3] ?? '#/properties';
  const empty = !d.followups.length && !d.viewings.length && !d.requests.length && !d.negotiations.length && d.business.live === 0;
  return (
    <div>
      <section className="re-brief">
        <h2>{r.today.brief}</h2>
        {lines.length ? <div className="re-brief-list">{lines.map(([n, c, t, href]) => (
          <button key={t} className="re-brief-item" onClick={() => go(href)}><span className="d" style={{ background: c }} /><span>{fmt(t, { n })}</span></button>
        ))}</div> : <p className="lead mt-3">{r.today.allClear}</p>}
        <button className="btn start" onClick={() => go(first)}>{r.today.start}<Icon n="arrow" className="h-4 w-4 rtl:-scale-x-100" /></button>
      </section>
      {can('leads.read-all') && <div className="mt-4 flex justify-end"><div className="re-tabs">{(['me', 'all'] as const).map((s) => <button key={s} aria-pressed={scope === s} onClick={() => setScope(s)}>{r.today[s]}</button>)}</div></div>}

      {empty ? <div className="panel mt-6"><Empty icon="store" title={r.props.empty} body={r.props.emptyBody} action={can('listings.create') && <a className="btn btn-accent" href="#/studio"><Icon n="plus" />{r.props.new}</a>} /></div> : (
        <div className="re-grid2">
          <div>
            <Sec title={r.today.viewTitle} action={<a href="#/agenda">{r.common.more}</a>} />
            <div className="panel">{d.viewings.length ? d.viewings.map((v: Viewing) => <ViewingRow key={v.id} v={v} />) : <p className="sub p-4">{r.today.noViewings}</p>}</div>
            {d.requests.length > 0 && <><Sec title={r.today.reqTitle} /><div className="panel">{d.requests.map((v: Viewing) => <ViewingRow key={v.id} v={v} />)}</div></>}
            <Sec title={r.today.followTitle} action={<a href="#/agenda?tab=followups">{r.common.more}</a>} />
            <div className="panel">{d.followups.length ? d.followups.map((f: Followup) => <FollowRow key={f.id} f={f} />) : <p className="sub p-4">{r.today.noFollow}</p>}</div>
            {d.negotiations.length > 0 && <>
              <Sec title={r.today.negoTitle} action={<a href="#/deals">{r.common.more}</a>} />
              <div className="panel">{d.negotiations.map((x: any) => (
                <button key={x.id} className="re-item" onClick={() => go(`#/deals?id=${x.id}`)}>
                  <span className="re-av"><RIcon n="wallet" className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.property?.title}</b>
                    <span className="sub">{[x.lead?.name, x.last && fmt(r.today.lastWord, { kind: r.offer[x.last.kind] ?? x.last.kind, amount: price(x.last.amount, x.currency, lang) })].filter(Boolean).join(' · ')}</span></span>
                  <span className="sub">{ago(x.updatedAt, r)}</span>
                </button>
              ))}</div>
            </>}
          </div>
          <div>
            <Sec title={r.today.business} />
            <div className="re-kpis">
              {([[r.today.live, d.business.live, `${r.today.published} · ${d.business.published}`], [r.today.openLeads, d.business.openLeads], [r.today.viewingsMonth, d.business.viewingsMonth],
                [r.today.negotiating, d.business.negotiating], [r.today.closedMonth, d.business.closedMonth]] as const).map(([t, v, s]) => <div key={t} className="re-kpi"><small>{t}</small><b>{v}</b>{s && <span>{s}</span>}</div>)}
              {d.business.commission && Object.entries(d.business.commission as Record<string, { month: number; pipeline: number }>).map(([cur, m]) => (
                <div key={cur} className="re-kpi" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}><small style={{ color: 'inherit', opacity: .8 }}>{r.today.commission}</small><b>{price(m.month, cur, lang)}</b><span style={{ color: 'inherit', opacity: .8 }}>{price(m.pipeline, cur, lang, null, true)} {r.today.pipeline}</span></div>
              ))}
            </div>
            {d.opportunities.hot.length > 0 && <><Sec title={<span className="inline-flex items-center gap-2"><RIcon n="flame" className="h-4 w-4 text-[var(--warn)]" />{r.today.hot}</span>} />
              <div className="panel">{d.opportunities.hot.map((p: Card & { views: number; inquiries: number }) => (
                <button key={p.id} className="re-row-p" onClick={() => go(`#/property?id=${p.id}`)}>{p.cover ? <img src={p.cover} alt="" /> : <span className="ph" />}
                  <span className="min-w-0 flex-1"><b className="block truncate font-medium">{p.title}</b><span className="sub">{fmt(r.today.views, { n: p.views })} · {fmt(r.today.inquiries, { n: p.inquiries })}</span></span></button>
              ))}</div></>}
            {d.opportunities.quiet.length > 0 && <><Sec title={r.today.quiet} action={<a href="#/leads?f=quiet">{r.common.more}</a>} />
              <div className="panel">{d.opportunities.quiet.map((l: any) => (
                <div key={l.id} className="re-item"><Avatar name={l.name} /><button className="min-w-0 flex-1 text-start" onClick={() => go(`#/lead?id=${l.id}`)}><b className="block truncate font-medium">{l.name}</b><span className="sub">{l.lastContactAt ? ago(l.lastContactAt, r) : r.today.never}</span></button>
                  {waLink(l.whatsapp ?? l.phone) && <a className="icon-btn re-icon-wa" href={waLink(l.whatsapp ?? l.phone)!} target="_blank" rel="noopener"><Icon n="wa" /></a>}</div>
              ))}</div></>}
            {d.opportunities.stale.length > 0 && <><Sec title={r.today.stale} />
              <div className="panel">{d.opportunities.stale.map((p: Card) => (
                <button key={p.id} className="re-row-p" onClick={() => go(`#/property?id=${p.id}`)}>{p.cover ? <img src={p.cover} alt="" /> : <span className="ph" />}
                  <span className="min-w-0 flex-1"><b className="block truncate font-medium">{p.title}</b><span className="sub">{fmt(r.prop.daysOn, { n: Math.round((Date.now() - +new Date(p.statusAt)) / 86400_000) })} · {price(p.price, p.currency, lang)}</span></span></button>
              ))}</div></>}
            <Sec title={r.today.recent} />
            <div className="panel"><Timeline items={d.recent.slice(0, 10)} /></div>
          </div>
        </div>
      )}
      {d.opportunities.newLeads?.length > 0 && <div className="mt-6"><Sec title={fmt(r.today.newLeads, { n: d.opportunities.newLeads.length })} /><div className="re-cards">{d.opportunities.newLeads.slice(0, 4).map((l: any) => (
        <button key={l.id} className="panel re-item" onClick={() => go(`#/lead?id=${l.id}`)}><Avatar name={l.name} /><span className="min-w-0 flex-1"><b className="block truncate">{l.name}</b><span className="sub">{r.sources[l.source]} · {ago(l.createdAt, r)}</span></span></button>
      ))}</div></div>}
      <div className="h-2" />
    </div>
  );
}
