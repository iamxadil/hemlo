// The clinic's frame. Five places to go (a slim rail on tablets and computers, a tab bar with a big "+" on phones),
// one search that finds any patient in two keystrokes (Ctrl+K or /), and one "+" for everything new.
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, initials } from '../lib/app';
import { locale } from '../lib/i18n';
import { Icon, LangPick } from '../components/ui';
import type { Page } from '../pages';
import { useD } from './i18n';
import { useSetup, type PatientCard } from './data';
import { Alerts, PatientForm } from './Patients';
import { AppointmentSheet } from './Schedule';
import { LabOrderSheet } from './Lab';
import { HMark } from './ui';
import './clinic.css';

const PRIMARY = ['today', 'schedule', 'patients', 'lab', 'reports'];
const PHONE_TABS = ['today', 'schedule', 'patients'];
type Add = null | 'menu' | 'appt' | 'patient' | 'lab' | 'visit';

export function DentalShell({ pages, current, label, banner, signOut, signOutLabel, orgs, choose }: {
  pages: Page[]; current: Page; label(p: Page): string; banner: ReactNode; signOut(): void; signOutLabel: string; orgs: any[]; choose(id: string): Promise<void>;
}) {
  const { d, t, lang, setLang, sys, me, can } = useD();
  const [find, setFind] = useState<null | 'find' | 'visit'>(null);
  const [add, setAdd] = useState<Add>(null);
  const [more, setMore] = useState(false);
  const [quickName, setQuickName] = useState('');
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = /^(input|textarea|select)$/i.test(el?.tagName ?? '') || el?.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setFind('find'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { setMore(false); }, [current.path]);
  // the clinic's colours reach sheets and panels too (they render outside the frame)
  useEffect(() => { document.documentElement.classList.add('dental'); return () => document.documentElement.classList.remove('dental'); }, []);

  const primary = pages.filter((p) => PRIMARY.includes(p.path));
  const secondary = pages.filter((p) => !PRIMARY.includes(p.path) && !p.hidden && p.path !== 'more');
  const onPage = (p: Page) => p.path === current.path || (current.path === 'patient' && p.path === 'patients');
  const View = current.view;
  const dateLine = new Intl.DateTimeFormat(lang === 'ckb' ? 'ar-IQ-u-nu-latn' : locale(lang), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Baghdad' }).format(new Date());
  const setup = useSetup();
  const isDentist = !!setup.data?.dentists.some((y) => y.memberId && y.memberId === sys.memberId);
  const first = (me.user.name || '').replace(/^(د\.|دكتور|Dr\.?)\s*/i, '').split(/\s+/)[0];
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date()));
  const greet = hour < 12 ? d.shell.morning : hour < 17 ? d.shell.afternoon : d.shell.evening;
  const who = isDentist ? d.shell.dr.replace('{n}', first) : first;
  const title = current.path === 'today' ? d.shell.greetFmt.replace('{greet}', greet).replace('{name}', who) : label(current);
  const canNew = can('appointments.manage') || can('patients.create') || can('clinical.write') || can('lab.manage');
  // the large title shrinks into the bar as the page scrolls (as on iPhone and Mac)
  const [condensed, setCondensed] = useState(false);
  useEffect(() => { const on = () => setCondensed(window.scrollY > 28); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [current.path]);

  return (
    <div className="clinic">
      <aside className="c-side" aria-label={d.shell.clinic}>
        <a className="c-brand" href="#/today" title={sys.business.name}>
          <HMark className="c-h" />
          <span className="c-brand-t"><b>Hemlo</b><small>{sys.business.name}</small></span>
        </a>
        <nav className="c-side-nav">
          {primary.map((p) => (
            <a key={p.path} className="c-nav" href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined} title={label(p)}><Icon n={p.icon} /><span>{label(p)}</span></a>
          ))}
        </nav>
        <div className="c-side-foot">
          <button className="c-nav" onClick={() => setMore(true)} aria-expanded={more} title={d.shell.more}><Icon n="more" /><span>{d.shell.more}</span></button>
          <button className="c-me-row" onClick={() => setMore(true)} title={me.user.name}>
            {sys.business.logoUrl ? <img src={sys.business.logoUrl} alt="" className="c-me img" /> : <span className="c-me">{initials(me.user.name)}</span>}
            <span className="c-me-t"><b className="truncate">{me.user.name}</b><small className="truncate">{d.shell.account}</small></span>
          </button>
        </div>
      </aside>

      <div className="c-main">
        {banner}
        <header className={`c-top${condensed ? ' condensed' : ''}`}>
          <div className="c-titles">
            {current.path === 'today' && <p className="c-kicker">{dateLine}</p>}
            <h1>{title}</h1>
          </div>
          <button className="c-search" onClick={() => setFind('find')} aria-label={d.shell.search}>
            <Icon n="search" /><span>{d.shell.search}</span><kbd dir="ltr">Ctrl K</kbd>
          </button>
          {canNew && <button className="c-add" onClick={() => setAdd('menu')} aria-label={d.shell.new}><Icon n="plus" /><span>{d.shell.new}</span></button>}
        </header>
        <main key={current.path} className={`c-page c-page-${current.path}`}>
          <Suspense fallback={<div className="grid gap-4"><div className="skeleton h-24" /><div className="skeleton h-72" /></div>}><View /></Suspense>
        </main>
      </div>

      <nav className="c-dock" aria-label={d.shell.clinic}>
        {PHONE_TABS.slice(0, 2).map((path) => { const p = pages.find((x) => x.path === path); return p && <a key={path} href={`#/${path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>; })}
        {canNew ? <button className="c-fab" onClick={() => setAdd('menu')} aria-label={d.shell.new}><Icon n="plus" /></button> : <span />}
        {PHONE_TABS.slice(2).map((path) => { const p = pages.find((x) => x.path === path); return p && <a key={path} href={`#/${path}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>; })}
        <button onClick={() => setMore(true)} aria-current={!PHONE_TABS.some((x) => x === current.path || (x === 'patients' && current.path === 'patient')) ? 'page' : undefined}><Icon n="more" /><span>{d.shell.more}</span></button>
      </nav>

      {find && <Finder mode={find} onClose={() => setFind(null)} pages={[...primary, ...secondary]} label={label}
        onNew={(k, q) => { setFind(null); setQuickName(q ?? ''); setAdd(k); }} />}
      {add === 'menu' && <QuickAdd onPick={(k) => (k === 'visit' ? (setAdd(null), setFind('visit')) : setAdd(k))} onClose={() => setAdd(null)} />}
      {add === 'appt' && <AppointmentSheet onClose={() => setAdd(null)} />}
      {add === 'patient' && <PatientForm quickName={quickName} onClose={() => { setAdd(null); setQuickName(''); }} onSaved={(p) => { setAdd(null); setQuickName(''); go(`#/patient?id=${p.id}`); }} />}
      {add === 'lab' && <LabOrderSheet onClose={() => setAdd(null)} />}
      {more && (
        <Panel onClose={() => setMore(false)} className="c-more">
          <div className="c-more-head">
            {sys.business.logoUrl ? <img src={sys.business.logoUrl} alt="" className="c-more-logo" /> : <span className="c-more-logo"><HMark /></span>}
            <div className="min-w-0 flex-1">
              {orgs.length > 1 ? (
                <select className="c-org" value={sys.business.id} onChange={(e) => choose(e.target.value)} aria-label={d.shell.clinic}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              ) : <b className="block truncate">{sys.business.name}</b>}
              <span className="sub block truncate">{me.user.name}</span>
            </div>
          </div>
          <div className="c-more-grid">
            {[...primary.filter((p) => !PHONE_TABS.includes(p.path)).map((p) => ({ p, phone: true })), ...secondary.map((p) => ({ p, phone: false }))].map(({ p, phone }) => (
              <a key={p.path} href={`#/${p.path}`} className={`c-tile${phone ? ' c-phone-only' : ''}`} aria-current={onPage(p) ? 'page' : undefined}><Icon n={p.icon} /><span>{label(p)}</span></a>
            ))}
            <a href="#/waiting" target="_blank" rel="noopener" className="c-tile"><Icon n="display" /><span>{d.shell.waitingScreen}</span></a>
          </div>
          <div className="c-more-foot">
            <LangPick lang={lang} setLang={setLang} />
            <button className="btn btn-secondary btn-sm" onClick={signOut}><Icon n="out" className="h-4 w-4" />{signOutLabel}</button>
          </div>
        </Panel>
      )}
      <span hidden>{t.app}</span>
    </div>
  );
}

/** A floating panel: next to the rail on bigger screens, a bottom sheet on phones. Closes on Esc or a tap outside. */
function Panel({ children, onClose, className = '' }: { children: ReactNode; onClose(): void; className?: string }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return createPortal(<><div className="c-scrim" onClick={onClose} /><div className={`c-panel ${className}`} role="dialog" aria-modal="true">{children}</div></>, document.body);
}

/** "+": the four things a clinic starts every day. */
function QuickAdd({ onPick, onClose }: { onPick(k: Exclude<Add, null | 'menu'>): void; onClose(): void }) {
  const { d, can } = useD();
  const items = ([
    ['appt', 'calendar', d.shell.newAppt, can('appointments.manage')],
    ['patient', 'user', d.shell.newPatient, can('patients.create')],
    ['visit', 'tooth', d.shell.newVisit, can('clinical.write')],
    ['lab', 'flask', d.shell.newLab, can('lab.manage')],
  ] as const).filter((x) => x[3]);
  return (
    <Panel onClose={onClose} className="c-quick">
      {items.map(([k, icon, text]) => <button key={k} className="c-quick-item" onClick={() => onPick(k)}><span className={`c-quick-ic q-${k}`}><Icon n={icon} /></span>{text}</button>)}
    </Panel>
  );
}

type Hit = { key: string; icon: string; title: string; sub?: string; alerts?: string[]; badge?: string; run(): void };

/** Find anything: patients as you type, pages, and actions. Keyboard first, and just as good with a thumb. */
function Finder({ mode, onClose, pages, label, onNew }: { mode: 'find' | 'visit'; onClose(): void; pages: Page[]; label(p: Page): string; onNew(k: 'appt' | 'patient' | 'lab', q?: string): void }) {
  const { d, can, num, money } = useD();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 140); return () => clearTimeout(t); }, [q]);
  const found = useQuery({ queryKey: ['dent-find', debounced], queryFn: async () => (await api(`/v1/dent/patients${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`)).patients as PatientCard[], staleTime: 15_000 });
  const open = (p: PatientCard) => { onClose(); go(mode === 'visit' ? `#/patient?id=${p.id}&tab=visits&visit=new` : `#/patient?id=${p.id}`); };
  const hits = useMemo(() => {
    const ql = debounced.toLowerCase();
    const people: Hit[] = (found.data ?? []).slice(0, debounced ? 8 : 5).map((p) => ({
      key: `p${p.id}`, icon: 'user', title: p.name, sub: [`${d.patients.file} ${num(p.fileNo)}`, p.phone ? p.phone.replace(/^\+964/, '0') : null].filter(Boolean).join(' · '),
      alerts: p.alerts, badge: p.balance > 0 ? money(p.balance) : undefined, run: () => open(p),
    }));
    if (mode === 'visit') return { people, pages: [] as Hit[], acts: [] as Hit[] };
    const pageHits: Hit[] = pages.filter((p) => !ql || label(p).toLowerCase().includes(ql)).slice(0, ql ? 4 : 0)
      .map((p) => ({ key: `g${p.path}`, icon: p.icon, title: label(p), run: () => { onClose(); go(`#/${p.path}`); } }));
    const acts: Hit[] = [
      can('patients.create') && debounced && !people.length ? { key: 'addq', icon: 'plus', title: d.shell.addAs.replace('{q}', debounced), run: () => onNew('patient', debounced) } : null,
      can('appointments.manage') && (!ql || d.shell.newAppt.toLowerCase().includes(ql)) ? { key: 'a1', icon: 'calendar', title: d.shell.newAppt, run: () => onNew('appt') } : null,
      can('patients.create') && (!ql || d.shell.newPatient.toLowerCase().includes(ql)) ? { key: 'a2', icon: 'user', title: d.shell.newPatient, run: () => onNew('patient') } : null,
    ].filter(Boolean) as Hit[];
    return { people, pages: pageHits, acts };
  }, [found.data, debounced, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const flat = [...hits.people, ...hits.pages, ...hits.acts];
  useEffect(() => { setSel(0); }, [debounced]);
  useEffect(() => { list.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[sel]?.run(); }
    else if (e.key === 'Escape') onClose();
  };
  let i = -1;
  const section = (title: string, xs: Hit[]) => xs.length > 0 && (
    <div className="c-find-sec"><p className="c-find-t">{title}</p>
      {xs.map((h) => { i++; const on = i === sel; const at = i; return (
        <button key={h.key} className="c-find-hit" data-on={on} onMouseMove={() => setSel(at)} onClick={h.run}>
          <span className="c-find-ic"><Icon n={h.icon} /></span>
          <span className="min-w-0 flex-1 text-start"><b className="flex items-center gap-2 truncate">{h.title}{h.alerts?.length ? <Alerts list={h.alerts} small /> : null}</b>{h.sub && <span className="sub block truncate" dir="auto">{h.sub}</span>}</span>
          {h.badge && <span className="pill warn">{h.badge}</span>}
          <Icon n="arrow" className="c-find-go" />
        </button>
      ); })}
    </div>
  );
  return createPortal(
    <><div className="c-scrim" onClick={onClose} />
      <div className="c-find" role="dialog" aria-modal="true" aria-label={d.shell.search}>
        <div className="c-find-bar">
          <Icon n="search" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder={mode === 'visit' ? d.shell.pickPatient : d.shell.searchLong} aria-label={d.shell.searchLong} />
          {found.isFetching ? <span className="spinner" /> : <button className="icon-btn" onClick={onClose} aria-label={d.common.close}><Icon n="close" /></button>}
        </div>
        <div className="c-find-list" ref={list}>
          {section(debounced ? d.shell.patients : d.shell.recent, hits.people)}
          {section(d.shell.goTo, hits.pages)}
          {section(d.shell.actions, hits.acts)}
          {debounced && !flat.length && !found.isFetching && <p className="c-find-none">{d.shell.none.replace('{q}', debounced)}</p>}
        </div>
        <p className="c-find-keys">{d.shell.keys}</p>
      </div>
    </>,
    document.body,
  );
}
