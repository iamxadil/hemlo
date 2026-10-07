// The gym's frame: five places (a slim rail on tablets and computers, a dock with a big "+" on phones), one search that
// finds any member in two keystrokes (Ctrl+K or /), and one "+" for what a desk starts all day: a member, a membership,
// a sale in the shop. Its own look: iron and chalk, with an ember accent (html.gym), so it never feels like the shop.
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, initials } from '../lib/app';
import { locale } from '../lib/i18n';
import { Icon, LangPick } from '../components/ui';
import type { Page } from '../pages';
import { useG } from './i18n';
import { Face, HMark, MemberPicker, Panel, StatePill } from './ui';
import { MemberForm } from './Members';
import { SellSheet } from './Sell';
import { Sheet } from '../components/ui';
import { fmt, type MemberRow } from './data';
import './gym.css';

const PRIMARY = ['desk', 'members', 'renewals', 'classes', 'reports'];
const PHONE_TABS = ['desk', 'members', 'renewals'];
type Add = null | 'menu' | 'member' | 'sell';

export function GymShell({ pages, current, label, banner, signOut, signOutLabel, orgs, choose }: {
  pages: Page[]; current: Page; label(p: Page): string; banner: ReactNode; signOut(): void; signOutLabel: string; orgs: any[]; choose(id: string): Promise<void>;
}) {
  const { g, t, lang, setLang, sys, me, can } = useG();
  const [find, setFind] = useState(false);
  const [add, setAdd] = useState<Add>(null);
  const [more, setMore] = useState(false);
  const [quick, setQuick] = useState('');
  const [selling, setSelling] = useState<MemberRow | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = /^(input|textarea|select)$/i.test(el?.tagName ?? '') || el?.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setFind(true); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { setMore(false); }, [current.path]);
  useEffect(() => { document.documentElement.classList.add('gym'); return () => document.documentElement.classList.remove('gym'); }, []);

  const primary = pages.filter((p) => PRIMARY.includes(p.path));
  const secondary = pages.filter((p) => !PRIMARY.includes(p.path) && !p.hidden && p.path !== 'more');
  const onPage = (p: Page) => p.path === current.path || (current.path === 'member' && p.path === 'members');
  const View = current.view;
  const dateLine = new Intl.DateTimeFormat(lang === 'ckb' ? 'ar-IQ-u-nu-latn' : locale(lang), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Baghdad' }).format(new Date());
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date()));
  const greet = hour >= 5 && hour < 12 ? g.shell.morning : hour >= 12 && hour < 17 ? g.shell.afternoon : g.shell.evening;
  const title = current.path === 'desk' ? fmt(g.shell.greetFmt, { greet, name: (me.user.name || '').split(/\s+/)[0] }) : label(current);
  const canNew = can('members.create') || can('memberships.sell') || can('sales.create');
  const [condensed, setCondensed] = useState(false);
  useEffect(() => { const on = () => setCondensed(window.scrollY > 28); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [current.path]);

  return (
    <div className="gymf">
      <aside className="gy-side" aria-label={g.shell.gym}>
        <a className="gy-brand" href="#/desk" title={sys.business.name}>
          <HMark className="gy-h" />
          <span className="gy-brand-t"><b>Hemlo</b><small>{sys.business.name}</small></span>
        </a>
        <nav className="gy-side-nav">
          {primary.map((p) => <a key={p.path} className="gy-nav" href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined} title={label(p)}><Icon n={p.icon} /><span>{label(p)}</span></a>)}
        </nav>
        <div className="gy-side-foot">
          <button className="gy-nav" onClick={() => setMore(true)} aria-expanded={more} title={g.shell.more}><Icon n="more" /><span>{g.shell.more}</span></button>
          <button className="gy-me-row" onClick={() => setMore(true)} title={me.user.name}>
            {sys.business.logoUrl ? <img src={sys.business.logoUrl} alt="" className="gy-me img" /> : <span className="gy-me">{initials(me.user.name)}</span>}
            <span className="gy-me-t"><b className="truncate">{me.user.name}</b><small className="truncate">{g.shell.account}</small></span>
          </button>
        </div>
      </aside>

      <div className="gy-main">
        {banner}
        <header className={`gy-top${condensed ? ' condensed' : ''}`}>
          <div className="gy-titles">
            {current.path === 'desk' && <p className="gy-kicker">{dateLine}</p>}
            <h1>{title}</h1>
          </div>
          <button className="gy-search" onClick={() => setFind(true)} aria-label={g.shell.search}><Icon n="search" /><span>{g.shell.search}</span><kbd dir="ltr">Ctrl K</kbd></button>
          {canNew && <button className="gy-add" onClick={() => setAdd('menu')} aria-label={g.shell.new}><Icon n="plus" /><span>{g.shell.new}</span></button>}
        </header>
        <main key={current.path} className={`gy-page gy-page-${current.path}`}>
          <Suspense fallback={<div className="grid gap-4"><div className="skeleton h-24" /><div className="skeleton h-72" /></div>}><View /></Suspense>
        </main>
      </div>

      <nav className="gy-dock" aria-label={g.shell.gym}>
        {PHONE_TABS.slice(0, 2).map((path) => { const p = pages.find((x) => x.path === path); return p && <a key={path} href={`#/${path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>; })}
        {canNew ? <button className="gy-fab" onClick={() => setAdd('menu')} aria-label={g.shell.new}><Icon n="plus" /></button> : <span />}
        {PHONE_TABS.slice(2).map((path) => { const p = pages.find((x) => x.path === path); return p && <a key={path} href={`#/${path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>; })}
        <button onClick={() => setMore(true)} aria-current={!PHONE_TABS.some((x) => x === current.path || (x === 'members' && current.path === 'member')) ? 'page' : undefined}><Icon n="more" /><span>{g.shell.more}</span></button>
      </nav>

      {find && <Finder onClose={() => setFind(false)} pages={[...primary, ...secondary]} label={label} onNew={(q) => { setFind(false); setQuick(q); setAdd('member'); }} />}
      {add === 'menu' && (
        <Panel onClose={() => setAdd(null)} className="gy-quick">
          {([
            ['member', 'user', g.shell.newMember, can('members.create')],
            ['sell', 'plus', g.shell.sell, can('memberships.sell')],
            ['shop', 'sell', label(pages.find((p) => p.path === 'sell') ?? current), can('sales.create')],
            ['door', 'display', g.shell.door, true],
          ] as const).filter((x) => x[3]).map(([k, icon, text]) => (
            <button key={k} className="gy-quick-item" onClick={() => { if (k === 'shop') { setAdd(null); go('#/sell'); } else if (k === 'door') { setAdd(null); window.open('#/door', '_blank'); } else setAdd(k); }}>
              <span className={`gy-quick-ic q-${k}`}><Icon n={icon} /></span>{text}
            </button>
          ))}
        </Panel>
      )}
      {add === 'member' && <MemberForm quickName={quick} onClose={() => { setAdd(null); setQuick(''); }} onSaved={(m, sell) => { setAdd(null); setQuick(''); go(`#/member?id=${m.id}${sell ? '&sell=1' : ''}`); }} />}
      {add === 'sell' && !selling && <Sheet title={g.shell.sell} sub={g.shell.pickMember} onClose={() => setAdd(null)}><MemberPicker onPick={(m) => setSelling(m)} /></Sheet>}
      {selling && <SellSheet memberId={selling.id} name={selling.name} onClose={() => { setSelling(null); setAdd(null); }} />}
      {more && (
        <Panel onClose={() => setMore(false)} className="gy-more">
          <div className="gy-more-head">
            {sys.business.logoUrl ? <img src={sys.business.logoUrl} alt="" className="gy-more-logo" /> : <span className="gy-more-logo"><HMark /></span>}
            <div className="min-w-0 flex-1">
              {orgs.length > 1 ? <select className="gy-org" value={sys.business.id} onChange={(e) => choose(e.target.value)} aria-label={g.shell.gym}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                : <b className="block truncate">{sys.business.name}</b>}
              <span className="sub block truncate">{me.user.name}</span>
            </div>
          </div>
          <div className="gy-more-grid">
            {[...primary.filter((p) => !PHONE_TABS.includes(p.path)).map((p) => ({ p, phone: true })), ...secondary.map((p) => ({ p, phone: false }))].map(({ p, phone }) => (
              <a key={p.path} href={`#/${p.path}`} className={`gy-tile-link${phone ? ' gy-phone-only' : ''}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>
            ))}
            <a href="#/door" target="_blank" rel="noopener" className="gy-tile-link"><Icon n="display" /><span>{g.shell.door}</span></a>
          </div>
          <div className="gy-more-foot">
            <LangPick lang={lang} setLang={setLang} />
            <button className="btn btn-secondary btn-sm" onClick={signOut}><Icon n="out" className="h-4 w-4" />{signOutLabel}</button>
          </div>
        </Panel>
      )}
      <span hidden>{t.app}</span>
    </div>
  );
}

type Hit = { key: string; icon?: string; m?: MemberRow; title: string; sub?: string; run(): void };

/** Find anything: members as you type (or a scanned card), pages, and "add as a new member". */
function Finder({ onClose, pages, label, onNew }: { onClose(): void; pages: Page[]; label(p: Page): string; onNew(q: string): void }) {
  const { g, can, num } = useG();
  const [q, setQ] = useState('');
  const [d, setD] = useState('');
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { const x = setTimeout(() => setD(q.trim()), 140); return () => clearTimeout(x); }, [q]);
  const found = useQuery({ queryKey: ['gym-members', 'find', d], queryFn: async () => (await api(`/v1/gym/members?q=${encodeURIComponent(d)}`)).members as MemberRow[], staleTime: 15_000 });
  const open = (m: MemberRow) => { onClose(); go(`#/member?id=${m.id}`); };
  const hits = useMemo(() => {
    const ql = d.toLowerCase();
    const people: Hit[] = (found.data ?? []).slice(0, d ? 8 : 5).map((m) => ({ key: `m${m.id}`, m, title: m.name, sub: [fmt(g.members.no, { n: num(m.memberNo) }), m.membership?.name].filter(Boolean).join(' · '), run: () => open(m) }));
    const pageHits: Hit[] = pages.filter((p) => !ql || label(p).toLowerCase().includes(ql)).slice(0, ql ? 4 : 0).map((p) => ({ key: `g${p.path}`, icon: p.icon, title: label(p), run: () => { onClose(); go(`#/${p.path}`); } }));
    const acts: Hit[] = can('members.create') && d && !people.length ? [{ key: 'add', icon: 'plus', title: fmt(g.shell.addAs, { q: d }), run: () => onNew(d) }] : [];
    return { people, pageHits, acts };
  }, [found.data, d]); // eslint-disable-line react-hooks/exhaustive-deps
  const flat = [...hits.people, ...hits.pageHits, ...hits.acts];
  useEffect(() => { setSel(0); }, [d]);
  useEffect(() => { list.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[sel]?.run(); }
    else if (e.key === 'Escape') onClose();
  };
  let i = -1;
  const section = (title: string, xs: Hit[]) => xs.length > 0 && (
    <div className="gy-find-sec"><p className="gy-find-t">{title}</p>
      {xs.map((h) => { i++; const at = i; return (
        <button key={h.key} className="gy-find-hit" data-on={at === sel} onMouseMove={() => setSel(at)} onClick={h.run}>
          {h.m ? <Face name={h.m.name} url={h.m.photoUrl} state={h.m.state} size="sm" /> : <span className="gy-find-ic"><Icon n={h.icon!} /></span>}
          <span className="min-w-0 flex-1 text-start"><b className="block truncate">{h.title}</b>{h.sub && <span className="sub block truncate" dir="auto">{h.sub}</span>}</span>
          {h.m && <StatePill state={h.m.state} />}
        </button>
      ); })}
    </div>
  );
  return createPortal(
    <><div className="gy-scrim" onClick={onClose} />
      <div className="gy-find" role="dialog" aria-modal="true" aria-label={g.shell.search}>
        <div className="gy-find-bar">
          <Icon n="search" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={g.shell.searchLong} aria-label={g.shell.searchLong} />
          {found.isFetching ? <span className="spinner" /> : <button className="icon-btn" onClick={onClose} aria-label={g.common.close}><Icon n="close" /></button>}
        </div>
        <div className="gy-find-list" ref={list}>
          {section(d ? g.shell.members : g.shell.recent, hits.people)}
          {section(g.shell.goTo, hits.pageHits)}
          {section(g.shell.actions, hits.acts)}
          {d && !flat.length && !found.isFetching && <p className="gy-find-none">{fmt(g.shell.none, { q: d })}</p>}
        </div>
        <p className="gy-find-keys">{g.shell.keys}</p>
      </div>
    </>,
    document.body,
  );
}
