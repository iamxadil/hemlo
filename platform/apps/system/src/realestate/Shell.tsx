// The agency's frame: a dark rail on tablets and computers, a dock with a big "+" on phones (an agent works from the car
// and the doorstep), one search box for everything (Ctrl+K or /) that understands "villas under 200k in Dream City",
// a "+" for what an agent starts all day (a property, a lead, a viewing, an owner), and the notices bell.
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, initials } from '../lib/app';
import { locale } from '../lib/i18n';
import { Icon, LangPick } from '../components/ui';
import type { Page } from '../pages';
import { useR } from './i18n';
import { HMark, Panel, RIcon, StatusPill } from './ui';
import { fmt, price, titleOf, localPhone, ago, useSetup } from './data';
import { LeadForm } from './Leads';
import { ViewingForm } from './Agenda';
import { OwnerForm } from './Owners';
import './re.css';

const PRIMARY = ['today', 'properties', 'leads', 'agenda', 'deals'];
const PHONE = ['today', 'properties', 'leads', 'agenda'];
/** Hemlo's own products sit apart from the agency's daily pages: their own colour, a line on what they do, and where the agency stands. */
const PRODUCTS = ['connect', 'marketing', 'website'];
const PW = {
  ar: { group: 'منتجات Hemlo', connect: ['Connect', 'واتساب ومساعد ذكي'], marketing: ['AI Studio', 'تسويق بالذكاء الاصطناعي'], website: ['Website', 'موقع وكالتك على الإنترنت'], on: 'مفعّل', new: 'جديد', add: 'أضِف' },
  en: { group: 'Hemlo products', connect: ['Connect', 'WhatsApp and an AI assistant'], marketing: ['AI Studio', 'Marketing by AI'], website: ['Website', 'Your agency online'], on: 'On', new: 'New', add: 'Add' },
  ckb: { group: 'بەرهەمەکانی Hemlo', connect: ['Connect', 'واتساپ و یاریدەدەری زیرەک'], marketing: ['AI Studio', 'بازاڕکردن بە زیرەکی دەستکرد'], website: ['Website', 'ئاژانسەکەت لەسەر ئینتەرنێت'], on: 'چالاکە', new: 'نوێ', add: 'زیادکردن' },
} as const;

/** Where the agency stands with each product, from the add-ons it has (no answer yet: no badge). */
function useProductState(lang: string) {
  const q = useQuery<{ addons: any[] }>({ queryKey: ['billing-addons'], queryFn: () => api('/v1/billing/addons'), staleTime: 60_000, retry: false });
  const w = PW[lang as keyof typeof PW] ?? PW.ar;
  const on = (code: string) => !!q.data?.addons.some((x) => x.code === code && (x.entitlement?.active || x.included));
  const badge: Record<string, [string, boolean]> = {};
  if (q.data) {
    const tier = on('ai-studio') ? 'Studio' : on('connect-pro') ? 'Pro' : 'Basic';
    badge.connect = [tier, tier !== 'Basic'];
    badge.marketing = on('ai-studio') ? [w.on, true] : [w.new, false];
    badge.website = on('website') ? [w.on, true] : [w.add, false];
  }
  return { w, badge };
}

function Products({ pages, onPage, phone, onPick }: { pages: Page[]; onPage(p: Page): boolean; phone?: boolean; onPick?(): void }) {
  const { lang } = useR();
  const { w, badge } = useProductState(lang);
  const list = PRODUCTS.map((path) => pages.find((p) => p.path === path)).filter(Boolean) as Page[];
  if (!list.length) return null;
  return (
    <div className={`re-pro${phone ? ' phone' : ''}`}>
      <p className="re-pro-h"><HMark className="re-pro-m" />{w.group}</p>
      {list.map((p) => { const [name, sub] = (w as any)[p.path] as [string, string]; const b = badge[p.path]; return (
        <a key={p.path} className={`re-pro-i ${p.path}`} href={`#/${p.path}`} onClick={onPick} aria-current={onPage(p) ? 'page' : undefined}>
          <span className="re-pro-t"><Icon n={p.icon} /></span>
          <span className="re-pro-x"><b>{name}</b><small>{sub}</small></span>
          {b && <span className={`re-pro-b${b[1] ? ' on' : ''}`}>{b[0]}</span>}
        </a>
      ); })}
    </div>
  );
}
type Add = null | 'menu' | 'lead' | 'viewing' | 'owner';

export function ReShell({ pages, current, label, banner, signOut, signOutLabel, orgs, choose }: {
  pages: Page[]; current: Page; label(p: Page): string; banner: ReactNode; signOut(): void; signOutLabel: string; orgs: any[]; choose(id: string): Promise<void>;
}) {
  const { r, lang, setLang, sys, me, can } = useR();
  const [find, setFind] = useState(false), [add, setAdd] = useState<Add>(null), [more, setMore] = useState(false), [bell, setBell] = useState(false);
  useEffect(() => { document.documentElement.classList.add('re'); return () => document.documentElement.classList.remove('re'); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement, typing = /^(input|textarea|select)$/i.test(el?.tagName ?? '') || el?.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setFind(true); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { setMore(false); window.scrollTo({ top: 0 }); }, [current.path]);
  const [condensed, setCondensed] = useState(false);
  useEffect(() => { const on = () => setCondensed(window.scrollY > 24); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on); }, []);

  const notices = useQuery<{ notices: any[]; unread: number }>({ queryKey: ['re-notices'], queryFn: () => api('/v1/re/notices'), refetchInterval: 60_000, staleTime: 30_000 });
  const primary = pages.filter((p) => PRIMARY.includes(p.path));
  const secondary = pages.filter((p) => !PRIMARY.includes(p.path) && !PRODUCTS.includes(p.path) && !p.hidden && p.path !== 'more');
  const parent: Record<string, string> = { property: 'properties', studio: 'properties', lead: 'leads' };
  const onPage = (p: Page) => p.path === current.path || parent[current.path] === p.path;
  const View = current.view;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date()));
  const greet = hour >= 5 && hour < 12 ? r.shell.morning : hour >= 12 && hour < 17 ? r.shell.afternoon : r.shell.evening;
  const title = current.path === 'today' ? fmt(r.shell.greetFmt, { greet, name: (me.user.name || '').split(/\s+/)[0] }) : current.path === 'studio' && /[?&]id=/.test(location.hash) ? r.studio.titleEdit : label(current);
  const dateLine = new Intl.DateTimeFormat(lang === 'ckb' ? 'ar-IQ-u-nu-latn' : locale(lang), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Baghdad' }).format(new Date());
  const canNew = can('listings.create') || can('leads.create') || can('viewings.manage');

  return (
    <div className="ref">
      <aside className="re-side" aria-label={r.shell.agency}>
        <a className="re-brand" href="#/today" title={sys.business.name}><HMark className="re-h" /><span className="re-brand-t"><b>Hemlo</b><small>{sys.business.name}</small></span></a>
        <nav className="grid gap-0.5">
          {primary.map((p) => <a key={p.path} className="re-nav" href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>)}
          <div className="re-side-sep" />
          {secondary.filter((p) => p.path !== 'settings' && p.path !== 'plan').map((p) => <a key={p.path} className="re-nav" href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>)}
        </nav>
        <Products pages={pages} onPage={onPage} />
        <div className="re-side-foot">
          {secondary.filter((p) => p.path === 'settings' || p.path === 'plan').map((p) => <a key={p.path} className="re-nav" href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>)}
          <button className="re-nav" onClick={() => setMore(true)}><span className="re-av" style={{ width: '1.6rem', height: '1.6rem', fontSize: '.7rem', background: 'rgb(255 255 255 / .1)' }}>{initials(me.user.name)}</span><span className="truncate">{me.user.name}</span></button>
        </div>
      </aside>

      <div className="re-main">
        {banner}
        <header className={`re-top${condensed ? ' condensed' : ''}`}>
          <div className="re-titles">{current.path === 'today' && <p className="re-kicker">{dateLine}</p>}<h1>{title}</h1></div>
          <button className="re-search" onClick={() => setFind(true)} aria-label={r.shell.search}><Icon n="search" /><span>{r.shell.search}</span><kbd dir="ltr">Ctrl K</kbd></button>
          <button className="icon-btn re-bell" onClick={() => setBell(true)} aria-label={r.shell.notices}><Icon n="bell" />{!!notices.data?.unread && <span className="dot" />}</button>
          {canNew && <button className="re-add" onClick={() => setAdd('menu')} aria-label={r.shell.new}><Icon n="plus" /><span>{r.shell.new}</span></button>}
        </header>
        <main key={current.path} className="re-page">
          <Suspense fallback={<div className="grid gap-4"><div className="skeleton h-28" /><div className="skeleton h-72" /></div>}><View /></Suspense>
        </main>
      </div>

      <nav className="re-dock" aria-label={r.shell.agency}>
        {PHONE.slice(0, 2).map((path) => { const p = pages.find((x) => x.path === path); return p && <a key={path} href={`#/${path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>; })}
        {canNew ? <button className="re-fab" onClick={() => setAdd('menu')} aria-label={r.shell.new}><Icon n="plus" /></button> : <span />}
        {PHONE.slice(2).map((path) => { const p = pages.find((x) => x.path === path); return p && <a key={path} href={`#/${path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>; })}
      </nav>
      {/* phones: "more" lives in the menu behind the avatar-less dock; a long press is not discoverable, so it's on the Today page too */}

      {find && <Finder onClose={() => setFind(false)} pages={[...primary, ...pages.filter((p) => PRODUCTS.includes(p.path)), ...secondary]} label={label} />}
      {add === 'menu' && (
        <Panel onClose={() => setAdd(null)}>
          {([
            ['property', 'store', r.shell.newProperty, can('listings.create'), () => { setAdd(null); go('#/studio'); }],
            ['lead', 'user', r.shell.newLead, can('leads.create'), () => setAdd('lead')],
            ['viewing', 'calendar', r.shell.newViewing, can('viewings.manage'), () => setAdd('viewing')],
            ['owner', 'key', r.shell.newOwner, can('listings.create'), () => setAdd('owner')],
          ] as const).filter((x) => x[3]).map(([k, icon, text, , run]) => (
            <button key={k} className="re-menu-item" onClick={run}><span className="ic"><RIcon n={icon} /></span>{text}</button>
          ))}
          <div className="md:hidden"><Products pages={pages} onPage={onPage} phone onPick={() => setAdd(null)} /></div>
          <div className="re-side-sep" style={{ background: 'var(--line)' }} />
          {secondary.map((p) => <a key={p.path} className="re-menu-item md:hidden" href={`#/${p.path}`} onClick={() => setAdd(null)}><span className="ic" style={{ background: 'var(--sunken)', color: 'var(--fg-2)' }}><Icon n={p.icon} /></span>{label(p)}</a>)}
        </Panel>
      )}
      {add === 'lead' && <LeadForm onClose={() => setAdd(null)} onSaved={(l) => { setAdd(null); go(`#/lead?id=${l.id}`); }} />}
      {add === 'viewing' && <ViewingForm onClose={() => setAdd(null)} />}
      {add === 'owner' && <OwnerForm onClose={() => setAdd(null)} onSaved={(o) => { setAdd(null); go(`#/owners?id=${o.id}`); }} />}
      {bell && <Notices onClose={() => setBell(false)} />}
      {more && (
        <Panel onClose={() => setMore(false)}>
          <div className="flex items-center gap-3 p-2">
            {sys.business.logoUrl ? <img src={sys.business.logoUrl} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="re-av lg">{initials(sys.business.name)}</span>}
            <div className="min-w-0 flex-1">
              {orgs.length > 1 ? <select className="input" value={sys.business.id} onChange={(e) => choose(e.target.value)} aria-label={r.shell.agency}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                : <b className="block truncate">{sys.business.name}</b>}
              <span className="sub block truncate">{me.user.name}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 p-2"><LangPick lang={lang} setLang={setLang} /><button className="btn btn-secondary btn-sm" onClick={signOut}><Icon n="out" className="h-4 w-4" />{signOutLabel}</button></div>
        </Panel>
      )}
    </div>
  );
}

/** The notices: a viewing request, a match, an offer, a deal closed. Each one opens what it's about. */
function Notices({ onClose }: { onClose(): void }) {
  const { r } = useR();
  const qc = useQueryClient();
  const q = useQuery<{ notices: any[]; unread: number }>({ queryKey: ['re-notices'], queryFn: () => api('/v1/re/notices') });
  useEffect(() => () => { api('/v1/re/notices/read', { body: {} }).then(() => qc.invalidateQueries({ queryKey: ['re-notices'] })).catch(() => {}); }, [qc]);
  const text = (n: any) => {
    const d = n.detail ?? {};
    return n.kind === 'request' ? `${d.name ?? ''} · ${r.agenda.requests} · #${d.ref ?? ''}` : n.kind === 'match' ? `${fmt(r.prop.matchesN, { n: d.leads ?? 0 })} · #${d.ref ?? ''}` : n.kind === 'offer' ? r.offer.offer
      : n.kind === 'deal_closed' ? r.deals.closed : n.kind === 'property_gone' ? `#${d.ref ?? ''} · ${r.status[d.status] ?? ''}` : n.kind === 'lead_assigned' ? `${d.name ?? ''} · ${r.lead.assign}` : n.kind;
  };
  const open = (n: any) => { onClose(); go(n.leadId && n.kind !== 'match' ? `#/lead?id=${n.leadId}` : n.dealId ? `#/deals?id=${n.dealId}` : n.propertyId ? `#/property?id=${n.propertyId}${n.kind === 'match' ? '&tab=interested' : ''}` : '#/today'); };
  return (
    <Panel onClose={onClose}>
      <p className="re-find-t">{r.shell.notices}</p>
      {(q.data?.notices ?? []).length ? q.data!.notices.slice(0, 20).map((n) => (
        <button key={n.id} className="re-menu-item" onClick={() => open(n)} style={{ opacity: n.readAt ? .65 : 1 }}>
          <span className="ic"><RIcon n={n.kind === 'request' ? 'calendar' : n.kind === 'match' ? 'sparkle' : n.kind === 'offer' ? 'wallet' : n.kind === 'deal_closed' ? 'star' : 'bell'} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate">{text(n)}</span><small>{n.detail?.title ?? ''} · {ago(n.createdAt, r)}</small></span>
        </button>
      )) : <p className="sub p-4">{r.shell.noNotices}</p>}
    </Panel>
  );
}

type Hit = { key: string; icon?: string; img?: string | null; title: string; sub?: string; tail?: ReactNode; run(): void };
/** Find anything: listings (with plain-language filters), leads, owners, deals, pages. */
function Finder({ onClose, pages, label }: { onClose(): void; pages: Page[]; label(p: Page): string }) {
  const { r, lang } = useR();
  const setup = useSetup();
  const [q, setQ] = useState(''), [d, setD] = useState(''), [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { const x = setTimeout(() => setD(q.trim()), 160); return () => clearTimeout(x); }, [q]);
  const found = useQuery<any>({ queryKey: ['re-search', d], queryFn: () => api(`/v1/re/search?q=${encodeURIComponent(d)}`), enabled: d.length > 0, staleTime: 15_000, placeholderData: (x: any) => x });
  const close = (hash: string) => () => { onClose(); go(hash); };
  const hits = useMemo(() => {
    const x = found.data ?? {};
    const props: Hit[] = (x.properties ?? []).map((p: any) => ({ key: `p${p.id}`, img: p.cover, title: titleOf(p, lang), sub: [`#${p.ref}`, p.area, price(p.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)].filter(Boolean).join(' · '), tail: <StatusPill status={p.status} />, run: close(`#/property?id=${p.id}`) }));
    const leads: Hit[] = (x.leads ?? []).map((l: any) => ({ key: `l${l.id}`, icon: 'user', title: l.name, sub: localPhone(l.phone), run: close(`#/lead?id=${l.id}`) }));
    const owners: Hit[] = (x.owners ?? []).map((o: any) => ({ key: `o${o.id}`, icon: 'key', title: o.name, sub: localPhone(o.phone), run: close(`#/owners?id=${o.id}`) }));
    const deals: Hit[] = (x.deals ?? []).map((v: any) => ({ key: `d${v.id}`, icon: 'wallet', title: v.title, sub: [r.stages[v.stage], v.lead].filter(Boolean).join(' · '), run: close(`#/deals?id=${v.id}`) }));
    const viewings: Hit[] = (x.viewings ?? []).map((v: any) => ({ key: `v${v.id}`, icon: 'calendar', title: v.title, sub: v.lead ?? '', run: close('#/agenda') }));
    const ql = d.toLowerCase();
    const pageHits: Hit[] = pages.filter((p) => !ql || label(p).toLowerCase().includes(ql)).slice(0, ql ? 3 : 6).map((p) => ({ key: `g${p.path}`, icon: p.icon, title: label(p), run: close(`#/${p.path}`) }));
    return [[r.shell.properties, props], [r.shell.leads, leads], [r.shell.owners, owners], [r.shell.deals, deals], [r.shell.viewings, viewings], [r.shell.goTo, pageHits]] as [string, Hit[]][];
  }, [found.data, d]); // eslint-disable-line react-hooks/exhaustive-deps
  const flat = hits.flatMap(([, xs]) => xs);
  useEffect(() => { setSel(0); }, [d]);
  useEffect(() => { list.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[sel]?.run(); }
    else if (e.key === 'Escape') onClose();
  };
  const parsed = found.data?.parsed;
  const understood = parsed ? [parsed.type && (setup.data?.types[parsed.type]?.[lang === 'en' ? 'en' : 'ar'] ?? parsed.type), parsed.purpose && r.purpose[parsed.purpose], parsed.max && `≤ ${price(parsed.max, 'USD', lang, null, true)}`, parsed.min && `≥ ${price(parsed.min, 'USD', lang, null, true)}`, parsed.beds && `${parsed.beds}+ 🛏`, parsed.area].filter(Boolean).join(' · ') : '';
  let i = -1;
  return createPortal(
    <><div className="re-scrim" onClick={onClose} />
      <div className="re-find" role="dialog" aria-modal="true" aria-label={r.shell.search}>
        <div className="re-find-bar"><Icon n="search" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={r.shell.searchLong} aria-label={r.shell.searchLong} />
          {found.isFetching ? <span className="spinner" /> : <button className="icon-btn" onClick={onClose} aria-label={r.common.close}><Icon n="close" /></button>}</div>
        {understood && <p className="re-find-parsed">{fmt(r.shell.understood, { what: understood })}</p>}
        <div className="re-find-list" ref={list}>
          {hits.map(([t, xs]) => xs.length > 0 && (
            <div key={t}><p className="re-find-t">{t}</p>
              {xs.map((h) => { i++; const at = i; return (
                <button key={h.key} className="re-find-hit" data-on={at === sel} onMouseMove={() => setSel(at)} onClick={h.run}>
                  {h.img !== undefined ? (h.img ? <img src={h.img} alt="" /> : <span className="ph" />) : <span className="re-av"><RIcon n={h.icon!} className="h-4 w-4" /></span>}
                  <span className="min-w-0 flex-1"><b className="block truncate font-medium">{h.title}</b>{h.sub && <span className="sub block truncate" dir="auto">{h.sub}</span>}</span>{h.tail}
                </button>
              ); })}
            </div>
          ))}
          {d && !flat.length && !found.isFetching && <p className="sub p-5 text-center">{fmt(r.shell.none, { q: d })}</p>}
        </div>
        <p className="re-find-keys">{r.shell.keys}</p>
      </div>
    </>, document.body);
}
