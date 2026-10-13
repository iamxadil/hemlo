// The Hemlo sidebar: one sidebar for every system (a store, a gym, a clinic, an agency), in that system's accent.
// A floating card with three parts that never crop: the business on top, the pages in the middle (they scroll when a
// short screen can't hold them), and the plan and the account at the bottom. One pill slides to the page you open;
// Hemlo's products sit in their own card; it folds to icons. Chosen in Settings → Appearance (lib/interface.ts).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { initials, useApp } from '../lib/app';
import { setInterface, useInterface } from '../lib/interface';
import { preloadPages, type Page } from '../pages';
import { PRODUCTS, ProductTiles } from './Products';
import { Icon, LangPick } from './ui';
import '../styles/rail.css';

const W = {
  ar: { manage: 'الإدارة', search: 'ابحث', fold: 'تصغير الشريط', unfold: 'توسيع الشريط', trial: 'تجربة · {n} يوم', ended: 'انتهى', grace: 'حان الدفع', free: 'مجاني',
    sidebar: 'الشريط الجانبي', rail: 'Hemlo', classic: 'الكلاسيكي', icons: 'أيقونات فقط', menu: 'حسابك',
    kind: { realestate: 'Hemlo Real Estate', gym: 'Hemlo Gym', dental: 'Hemlo Dental', school: 'Hemlo School', store: 'Hemlo Store' } },
  en: { manage: 'Manage', search: 'Search', fold: 'Collapse sidebar', unfold: 'Expand sidebar', trial: 'Trial · {n} days', ended: 'Ended', grace: 'Payment due', free: 'Free',
    sidebar: 'Sidebar', rail: 'Hemlo', classic: 'Classic', icons: 'Icons only', menu: 'Your account',
    kind: { realestate: 'Hemlo Real Estate', gym: 'Hemlo Gym', dental: 'Hemlo Dental', school: 'Hemlo School', store: 'Hemlo Store' } },
  ckb: { manage: 'بەڕێوەبردن', search: 'گەڕان', fold: 'بچووککردنەوەی شریت', unfold: 'گەورەکردنی شریت', trial: 'تاقیکردنەوە · {n} ڕۆژ', ended: 'کۆتایی هات', grace: 'کاتی پارەدان', free: 'بەخۆڕایی',
    sidebar: 'شریتی لاتەنیشت', rail: 'Hemlo', classic: 'کلاسیک', icons: 'تەنها ئایکۆن', menu: 'هەژمارەکەت',
    kind: { realestate: 'Hemlo Real Estate', gym: 'Hemlo Gym', dental: 'Hemlo Dental', school: 'Hemlo School', store: 'Hemlo Store' } },
} as const;
export const railWords = (lang: string) => W[lang as keyof typeof W] ?? W.ar;

export function Rail({ pages, current, label, primary, onPage, signOut, signOutLabel, orgs, choose, search }: {
  pages: Page[]; current: Page; label(p: Page): string; primary: string[]; onPage(p: Page): boolean;
  signOut(): void; signOutLabel: string; orgs: any[]; choose(id: string): Promise<void>;
  /** the system has a Ctrl+K finder */
  search?: boolean;
}) {
  const { t, lang, setLang, sys, me } = useApp();
  const w = railWords(lang);
  const ui = useInterface();
  const [menu, setMenu] = useState(false);
  const kind = (sys.business.kind ?? 'store') as keyof typeof w.kind;
  useEffect(() => { preloadPages(sys.business.kind); }, [sys.business.kind]);
  useEffect(() => { setMenu(false); }, [current.path]);

  const main = primary.map((path) => pages.find((p) => p.path === path && !p.hidden)).filter(Boolean) as Page[];
  const rest = pages.filter((p) => !primary.includes(p.path) && !PRODUCTS.includes(p.path) && !p.hidden && !['more', 'settings', 'plan'].includes(p.path));
  const settings = pages.find((p) => p.path === 'settings'), plan = pages.find((p) => p.path === 'plan');

  // the pill: one element that moves to the open page (a transform, so it never re-lays out the list)
  const list = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null), first = useRef(true);
  useLayoutEffect(() => {
    const at = list.current?.querySelector<HTMLElement>('.hr-link[aria-current="page"]'), el = pill.current;
    if (!el) return;
    if (!at) { el.style.opacity = '0'; return; }
    el.style.transition = first.current ? 'none' : '';
    el.style.opacity = '1'; el.style.height = `${at.offsetHeight}px`; el.style.transform = `translateY(${at.offsetTop}px)`;
    first.current = false;
  }, [current.path, ui.compact, pages.length, lang]);

  // the nav scrolls on a short screen; a soft fade says there's more above or below
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const on = () => setEdges({ top: el.scrollTop > 2, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2 });
    on(); el.addEventListener('scroll', on, { passive: true });
    const ro = new ResizeObserver(on); ro.observe(el);
    return () => { el.removeEventListener('scroll', on); ro.disconnect(); };
  }, [ui.compact]);

  const s = sys.subscription;
  const planText = !s ? null : s.status === 'trial' ? w.trial.replace('{n}', String(s.daysLeft ?? 0)) : s.status === 'ended' ? w.ended : s.status === 'grace' ? w.grace
    : s.status === 'free' ? w.free : s.plan ? ((s.plan.name as any)[lang] ?? s.plan.name.ar) : null;
  const link = (p: Page) => (
    <a key={p.path} className="hr-link" href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined} data-tip={label(p)}>
      <Icon n={p.icon} /><span className="hr-l">{label(p)}</span>
    </a>
  );
  const find = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

  return (
    <aside className="hr" aria-label={sys.business.name}>
      <div className="hr-card">
        <div className="hr-top">
          <a className="hr-biz" href={`#/${main[0]?.path ?? ''}`} data-tip={sys.business.name}>
            {sys.business.logoUrl ? <img className="hr-logo" src={sys.business.logoUrl} alt="" /> : <span className="hr-logo hr-init">{initials(sys.business.name)}</span>}
            <span className="hr-biz-t"><b>{sys.business.name}</b><small>{w.kind[kind] ?? 'Hemlo'}</small></span>
          </a>
          <button className="hr-fold" onClick={() => setInterface({ compact: !ui.compact })} aria-label={ui.compact ? w.unfold : w.fold} data-tip={ui.compact ? w.unfold : w.fold}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9.5 4.5v15" /><path d={ui.compact ? 'm13.5 10 2 2-2 2' : 'm15.5 10-2 2 2 2'} /></svg>
          </button>
        </div>
        {search && <button className="hr-search" onClick={find} data-tip={w.search}><Icon n="search" /><span className="hr-l">{w.search}</span><kbd dir="ltr">Ctrl K</kbd></button>}

        <div className={`hr-scroll${edges.top ? ' fade-t' : ''}${edges.bottom ? ' fade-b' : ''}`} ref={scroller}>
          <div className="hr-list" ref={list}>
            <span className="hr-pill" ref={pill} aria-hidden />
            {main.map(link)}
            {rest.length > 0 && <p className="hr-h"><span>{w.manage}</span></p>}
            {rest.map(link)}
          </div>
        </div>

        <ProductTiles pages={pages} onPage={onPage} />
        <div className="hr-foot">
          {plan && <a className={`hr-plan${s && (s.status === 'ended' || s.status === 'grace') ? ' warn' : ''}`} href="#/plan" aria-current={current.path === 'plan' ? 'page' : undefined} data-tip={label(plan)}>
            <Icon n="sparkle" /><span className="hr-l"><b>{label(plan)}</b>{planText && <small>{planText}</small>}</span>
          </a>}
          <div className="hr-me-row">
            <button className="hr-me" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label={w.menu} data-tip={me.user.name}>
              <span className="hr-av">{initials(me.user.name)}</span>
              <span className="hr-l hr-me-t"><b>{me.user.name}</b><small>{w.menu}</small></span>
              <Icon n="more" className="hr-l hr-more" />
            </button>
            {settings && <a className="hr-gear" href="#/settings" aria-current={current.path === 'settings' ? 'page' : undefined} aria-label={t.settings.title} data-tip={t.settings.title}><Icon n="gear" /></a>}
          </div>
          {menu && <RailMenu onClose={() => setMenu(false)} signOut={signOut} signOutLabel={signOutLabel} orgs={orgs} choose={choose} lang={lang} setLang={setLang} />}
        </div>
      </div>
    </aside>
  );
}

/** The account menu: another business, the language, the sidebar itself, signing out. */
function RailMenu({ onClose, signOut, signOutLabel, orgs, choose, lang, setLang }: {
  onClose(): void; signOut(): void; signOutLabel: string; orgs: any[]; choose(id: string): Promise<void>; lang: any; setLang(l: any): void;
}) {
  const { sys } = useApp();
  const w = railWords(lang);
  const ui = useInterface();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.hr-me')) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);
  return (
    <div className="hr-menu" ref={box} role="menu">
      {orgs.length > 1 && <>
        {orgs.map((o) => <button key={o.id} className="hr-mi" role="menuitemradio" aria-checked={o.id === sys.business.id} onClick={() => { onClose(); void choose(o.id); }}>
          <span className="hr-av sm">{initials(o.name)}</span><span className="truncate">{o.name}</span>{o.id === sys.business.id && <Icon n="check" className="ms-auto" />}
        </button>)}
        <hr />
      </>}
      <div className="hr-mi static"><LangPick lang={lang} setLang={setLang} className="hr-lang" /></div>
      <p className="hr-mh">{w.sidebar}</p>
      <div className="hr-seg" role="radiogroup" aria-label={w.sidebar}>
        {(['rail', 'classic'] as const).map((k) => <button key={k} role="radio" aria-checked={ui.sidebar === k} onClick={() => setInterface({ sidebar: k })}>{w[k]}</button>)}
      </div>
      <label className="hr-mi hr-check"><input type="checkbox" checked={ui.compact} onChange={(e) => setInterface({ compact: e.target.checked })} />{w.icons}</label>
      <hr />
      <button className="hr-mi" onClick={signOut}><Icon n="out" />{signOutLabel}</button>
    </div>
  );
}
