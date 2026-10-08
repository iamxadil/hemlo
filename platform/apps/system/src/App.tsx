// The door and the frame: who is signed in (or which shop device), which business, what they may open. Then the pages.
import { Suspense, lazy, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, ACCOUNT, demo, outbox, remembered, setCounterMode, type SysMe } from './lib/api';
import { AppProvider, useApp, useLang, useRoute, initials } from './lib/app';
import { STRINGS, rtl, type Lang } from './lib/i18n';
import { Icon, LangPick, Logo } from './components/ui';
import { CounterLock } from './components/Counter';
import { DrawerButton } from './components/Drawer';
import { More } from './views/More';
import { STORE_PAGES, DENTAL_PAGES, GYM_PAGES, RE_PAGES, SCHOOL_PAGES, type Page } from './pages';
import { productPath, readTrade, rememberTrade, type Trade } from './lib/trade';

const Start = lazy(() => import('./dental/Start').then((x) => ({ default: x.Start })));
const StoreStart = lazy(() => import('./views/StoreStart').then((x) => ({ default: x.StoreStart })));
const DentalShell = lazy(() => import('./dental/Shell').then((x) => ({ default: x.DentalShell })));
const GymShell = lazy(() => import('./gym/Shell').then((x) => ({ default: x.GymShell })));
const GymStart = lazy(() => import('./gym/Start').then((x) => ({ default: x.GymStart })));
const ReShell = lazy(() => import('./realestate/Shell').then((x) => ({ default: x.ReShell })));
const ReStart = lazy(() => import('./realestate/Start').then((x) => ({ default: x.ReStart })));
const SchShell = lazy(() => import('./school/Shell').then((x) => ({ default: x.SchShell })));
const SchStart = lazy(() => import('./school/Start').then((x) => ({ default: x.SchStart })));

const WEBSITE = 'https://hemlohq.com';
const site = (lang: Lang, path: string) => `${WEBSITE}${lang === 'en' ? '/en' : ''}${path}`;
const wantsDemo = () => new URLSearchParams(location.search).has('demo');
// ?demo=dental | ?demo=gym (or &kind=…): the demo clinic or gym; anything else: the demo shop
const demoKind = () => { const q = new URLSearchParams(location.search), k = q.get('kind') ?? q.get('demo'); return k === 'dental' || k === 'gym' || k === 'realestate' || k === 'school' ? k : 'store'; };
const homeOf = (kind: string) => (kind === 'dental' || kind === 'realestate' || kind === 'school' ? 'today' : kind === 'gym' ? 'desk' : 'home');
/** A demo of the kind asked for is already open on this device. */
const haveDemo = () => { const x = demo.get(); return !!x && (x.kind ?? 'store') === demoKind(); };
let demoStarting: Promise<unknown> | null = null; // once, even when React runs effects twice

const signInUrl = (lang: Lang) => `${ACCOUNT}${lang === 'en' ? '/en' : ''}/sign-in/?return_to=${encodeURIComponent(location.href)}`;

export function App() {
  const [lang, setLang] = useLang();
  const t = STRINGS[lang];
  const qc = useQueryClient();
  // the product they came for (from hemlohq.com/gym etc., or the business last opened here): the screens before
  // sign-in speak to that business only
  const [trade] = useState<Trade | null>(readTrade);
  const [otherKinds, setOtherKinds] = useState(false);
  // ?demo=1 (from hemlohq.com): open this visitor's own demo shop, or go back to the one they already have
  const [starting, setStarting] = useState(() => wantsDemo() && !haveDemo());
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoEnded, setDemoEnded] = useState(false);
  // ?start=dental (from hemlohq.com): a signed-in dentist starts their clinic's free trial here
  const [startClinic, setStartClinic] = useState(() => new URLSearchParams(location.search).get('start') === 'dental');
  // ?start=store: the same, for a shop
  const [startShop, setStartShop] = useState(() => new URLSearchParams(location.search).get('start') === 'store');
  // ?start=gym: the same, for a gym
  const [startGym, setStartGym] = useState(() => new URLSearchParams(location.search).get('start') === 'gym');
  // ?start=realestate: a real-estate agency
  const [startEstate, setStartEstate] = useState(() => new URLSearchParams(location.search).get('start') === 'realestate');
  // ?start=school: a school or tutoring institute
  const [startSchool, setStartSchool] = useState(() => new URLSearchParams(location.search).get('start') === 'school');
  useEffect(() => {
    if (!wantsDemo()) return;
    const kind = demoKind();
    const clean = () => history.replaceState(null, '', `${location.pathname}#/${homeOf(kind)}`);
    if (haveDemo()) { clean(); return; }
    if (demo.get()) demo.end(); // the other kind of demo: start this one instead
    // building a demo is the heaviest request there is: if the server stumbles (a cold start), quietly try again
    const start = async (tries = 3): Promise<{ token: string; expiresAt: string }> => {
      try { return await api<{ token: string; expiresAt: string }>('/v1/demo/start', { body: { lang, kind } }); }
      catch (e) { if (tries > 1 && e instanceof ApiError && (e.code === 'NETWORK' || e.status >= 500)) { await new Promise((r) => setTimeout(r, 600)); return start(tries - 1); } throw e; }
    };
    demoStarting ??= start()
      .then((r) => { demo.set({ token: r.token, expiresAt: r.expiresAt, kind }); clean(); qc.clear(); setStarting(false); })
      .catch((e) => { demoStarting = null; setDemoError(e instanceof ApiError ? e.code : 'ERROR'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inDemo = !starting && !!demo.get();

  // a person's session first; with none, maybe this is a trusted shop device
  const me = useQuery({ queryKey: ['me'], queryFn: () => remembered('me', () => api('/v1/me')), retry: false, enabled: !starting });
  // the demo shop was cleaned away (after 24 hours): say so, instead of asking a visitor to sign in
  useEffect(() => { if (inDemo && me.error instanceof ApiError && me.error.status === 401) { demo.clear(); setDemoEnded(true); } }, [inDemo, me.error]);
  const device = useQuery({
    queryKey: ['counter-state'], enabled: me.error instanceof ApiError && me.error.status === 401 && !inDemo && !demoEnded, retry: false,
    queryFn: async () => { setCounterMode(true); try { return await remembered('counter', () => api('/v1/counter/state')); } catch (e) { setCounterMode(false); throw e; } },
  });
  const counter = !!device.data;
  const activeOrg = counter ? device.data.device.organization.id : me.data?.activeOrganizationId;
  const unlocked = !counter || !!device.data.active;
  const sys = useQuery<SysMe>({ queryKey: ['sys-me', activeOrg, device.data?.active?.memberId], queryFn: () => remembered(`sys.${activeOrg}`, () => api('/v1/sys/me')), enabled: !!activeOrg && unlocked, retry: false });
  useEffect(() => { const on = () => qc.invalidateQueries({ queryKey: ['counter-state'] }); window.addEventListener('hemlo-locked', on); return () => window.removeEventListener('hemlo-locked', on); }, [qc]);

  const gate = (title: string, body: string, action?: React.ReactNode) => (
    <main className="gate"><div className="box">
      {trade ? <div className="gate-product"><img src="/brand/hemlo-mark.svg" alt="" /><span>{t.gate.product[trade]}</span></div>
        : <picture><source srcSet={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} media="(prefers-color-scheme: dark)" /><img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}.svg`} alt="Hemlo Systems" /></picture>}
      <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
      {body && <p className="muted">{body}</p>}
      {action}
      <LangPick lang={lang} setLang={setLang} className="mt-4" />
    </div></main>
  );

  if (starting) {
    if (!demoError) return demoKind() === 'school' ? gate(t.demo.startingSchool, t.demo.startingBodySchool, <span className="spinner mt-6 inline-block" aria-hidden />) : demoKind() === 'realestate' ? gate(t.demo.startingRe, t.demo.startingBodyRe, <span className="spinner mt-6 inline-block" aria-hidden />) : demoKind() === 'dental' ? gate(t.demo.startingDental, t.demo.startingBodyDental, <span className="spinner mt-6 inline-block" aria-hidden />) : demoKind() === 'gym' ? gate(t.demo.startingGym, t.demo.startingBodyGym, <span className="spinner mt-6 inline-block" aria-hidden />) : gate(t.demo.starting, t.demo.startingBody, <span className="spinner mt-6 inline-block" aria-hidden />);
    const msg = demoError === 'DEMO_LIMIT' ? t.demo.limit : demoError === 'DEMO_BUSY' ? t.demo.busy : demoError === 'NETWORK' ? t.errors.network : t.errors.generic;
    return gate(t.gate.error, msg, <a className="btn btn-secondary" href={site(lang, productPath(trade))}>hemlohq.com</a>);
  }
  if (demoEnded) return gate(t.demo.endedTitle, t.demo.endedBody, <a className="btn btn-accent" href={`/?demo=${demoKind() === 'store' ? '1' : demoKind()}&lang=${lang}`}>{t.demo.again}</a>);
  if (me.isLoading || device.isLoading) return gate(t.gate.loading, '');
  if (me.error && !counter) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      const [title, body] = trade === 'school' ? [t.gate.signInSchool, t.gate.signInSchoolBody] : trade === 'realestate' ? [t.gate.signInRe, t.gate.signInReBody] : trade === 'gym' ? [t.gate.signInGym, t.gate.signInGymBody] : trade === 'dental' ? [t.gate.signInDental, t.gate.signInDentalBody] : trade === 'store' ? [t.gate.signInTitle, t.gate.signInBody] : [t.gate.signInAny, t.gate.signInAnyBody];
      return gate(title, body, <a className="btn btn-accent" href={signInUrl(lang)}>{t.gate.signIn}</a>);
    }
    return gate(t.gate.error, '', <button className="btn btn-accent" onClick={() => me.refetch()}>{t.gate.retry}</button>);
  }
  if (counter && !device.data.active) return <CounterLock lang={lang} setLang={setLang} state={device.data} onUnlocked={() => qc.invalidateQueries()} />;

  if (startClinic && !counter && !inDemo) {
    const leave = () => { history.replaceState(null, '', `${location.pathname}#/today`); setStartClinic(false); };
    const started = async (orgId: string) => { await api('/v1/auth/organization/set-active', { body: { organizationId: orgId } }); leave(); qc.clear(); await qc.invalidateQueries(); };
    return <Suspense fallback={gate(t.gate.loading, '')}><Start lang={lang} setLang={setLang} userName={me.data.user?.name ?? ''} onStarted={started} onSkip={me.data.organizations?.length ? leave : undefined} /></Suspense>;
  }
  if (startShop && !counter && !inDemo) {
    const leave = () => { history.replaceState(null, '', `${location.pathname}#/home`); setStartShop(false); };
    const started = async (orgId: string) => { await api('/v1/auth/organization/set-active', { body: { organizationId: orgId } }); leave(); qc.clear(); await qc.invalidateQueries(); };
    return <Suspense fallback={gate(t.gate.loading, '')}><StoreStart lang={lang} setLang={setLang} userName={me.data.user?.name ?? ''} onStarted={started} onSkip={leave} /></Suspense>;
  }
  if (startGym && !counter && !inDemo) {
    const leave = () => { history.replaceState(null, '', `${location.pathname}#/desk`); setStartGym(false); };
    const started = async (orgId: string) => { await api('/v1/auth/organization/set-active', { body: { organizationId: orgId } }); leave(); qc.clear(); await qc.invalidateQueries(); };
    return <Suspense fallback={gate(t.gate.loading, '')}><GymStart lang={lang} setLang={setLang} userName={me.data.user?.name ?? ''} onStarted={started} onSkip={me.data.organizations?.length ? leave : undefined} /></Suspense>;
  }
  if (startEstate && !counter && !inDemo) {
    const leave = () => { history.replaceState(null, '', `${location.pathname}#/today`); setStartEstate(false); };
    const started = async (orgId: string) => { await api('/v1/auth/organization/set-active', { body: { organizationId: orgId } }); history.replaceState(null, '', `${location.pathname}#/studio`); setStartEstate(false); qc.clear(); await qc.invalidateQueries(); };
    return <Suspense fallback={gate(t.gate.loading, '')}><ReStart lang={lang} setLang={setLang} userName={me.data.user?.name ?? ''} onStarted={started} onSkip={me.data.organizations?.length ? leave : undefined} /></Suspense>;
  }
  if (startSchool && !counter && !inDemo) {
    const leave = () => { history.replaceState(null, '', `${location.pathname}#/today`); setStartSchool(false); };
    const started = async (orgId: string) => { await api('/v1/auth/organization/set-active', { body: { organizationId: orgId } }); history.replaceState(null, '', `${location.pathname}#/school`); setStartSchool(false); qc.clear(); await qc.invalidateQueries(); };
    return <Suspense fallback={gate(t.gate.loading, '')}><SchStart lang={lang} setLang={setLang} userName={me.data.user?.name ?? ''} onStarted={started} onSkip={me.data.organizations?.length ? leave : undefined} /></Suspense>;
  }
  const orgs: any[] = counter ? [device.data.device.organization] : me.data.organizations ?? [];
  if (!orgs.length) {
    // no business yet: the product they came for first; the other kinds only if they ask
    const kinds: Record<Trade, React.ReactNode> = {
      dental: <button key="dental" className="row panel" onClick={() => { history.replaceState(null, '', '/?start=dental'); setStartClinic(true); }}>
        <span className="thumb"><Icon n="tooth" /></span><span className="min-w-0 flex-1"><b className="block font-medium">{t.gate.startClinic}</b><span className="sub">{t.gate.startClinicSub}</span></span></button>,
      store: <button key="store" className="row panel" onClick={() => { history.replaceState(null, '', '/?start=store'); setStartShop(true); }}>
        <span className="thumb"><Icon n="sell" /></span><span className="min-w-0 flex-1"><b className="block font-medium">{t.gate.shop}</b><span className="sub">{t.gate.shopSub}</span></span></button>,
      gym: <button key="gym" className="row panel" onClick={() => { history.replaceState(null, '', '/?start=gym'); setStartGym(true); }}>
        <span className="thumb"><Icon n="dumbbell" /></span><span className="min-w-0 flex-1"><b className="block font-medium">{t.gate.gym}</b><span className="sub">{t.gate.gymSub}</span></span></button>,
      school: <button key="school" className="row panel" onClick={() => { history.replaceState(null, '', '/?start=school'); setStartSchool(true); }}>
        <span className="thumb"><Icon n="calendar" /></span><span className="min-w-0 flex-1"><b className="block font-medium">{t.gate.school}</b><span className="sub">{t.gate.schoolSub}</span></span></button>,
      realestate: <button key="realestate" className="row panel" onClick={() => { history.replaceState(null, '', '/?start=realestate'); setStartEstate(true); }}>
        <span className="thumb"><Icon n="home" /></span><span className="min-w-0 flex-1"><b className="block font-medium">{t.gate.estate}</b><span className="sub">{t.gate.estateSub}</span></span></button>,
    };
    const all: Trade[] = ['dental', 'store', 'gym', 'realestate', 'school'];
    const shown = trade && !otherKinds ? [trade] : trade ? [trade, ...all.filter((k) => k !== trade)] : all;
    return gate(t.gate.noBizTitle, t.gate.noBizBody, (
      <div className="grid w-full gap-2 text-start">
        {shown.map((k) => kinds[k])}
        {shown.length === 1 && <button className="gate-other" onClick={() => setOtherKinds(true)}>{t.gate.otherKind}</button>}
        <p className="sub mt-2 text-center">{t.gate.invited}</p>
      </div>));
  }
  const choose = async (id: string) => { await api('/v1/auth/organization/set-active', { body: { organizationId: id } }); await qc.invalidateQueries(); };
  if (!activeOrg) {
    return gate(t.gate.pickTitle, '', <div className="grid w-full gap-2">{orgs.map((o) => (
      <button key={o.id} className="row panel" onClick={() => choose(o.id)}><span className="thumb">{initials(o.name)}</span><span className="flex-1 font-medium">{o.name}</span></button>
    ))}</div>);
  }
  if (sys.isLoading || !sys.data) return sys.error ? gate(t.gate.error, '', <button className="btn btn-accent" onClick={() => sys.refetch()}>{t.gate.retry}</button>) : gate(t.gate.loading, '');

  // on the shop device, "me" is whoever unlocked it
  const who = counter ? { user: { id: null, name: device.data.active.name }, organizations: orgs, activeOrganizationId: activeOrg, counter: device.data } : me.data;
  return <AppProvider lang={lang} setLang={setLang} me={who} sys={sys.data}><Shell orgs={orgs} choose={choose} /></AppProvider>;
}

function Shell({ orgs, choose }: { orgs: any[]; choose(id: string): Promise<void> }) {
  const { t, lang, setLang, sys, me, can, toast } = useApp();
  const { path } = useRoute();
  const dental = sys.business.kind === 'dental', gym = sys.business.kind === 'gym', estate = sys.business.kind === 'realestate', school = sys.business.kind === 'school';
  const tradeOf = (): Trade => (dental ? 'dental' : gym ? 'gym' : estate ? 'realestate' : school ? 'school' : 'store');
  // remember the kind of business opened here, so the next sign-in screen speaks to it
  useEffect(() => { if (!sys.business.demo) rememberTrade(tradeOf()); }, [sys.business.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const MORE: Page = { path: 'more', icon: 'more', need: null, view: More, label: (x) => x.more.title };
  const pages = [...(dental ? DENTAL_PAGES : gym ? GYM_PAGES : estate ? RE_PAGES : school ? SCHOOL_PAGES : STORE_PAGES), MORE].filter((p) => !p.need || can(p.need));
  const current = pages.find((p) => p.path === path) ?? pages.find((p) => p.path === homeOf(sys.business.kind ?? 'store')) ?? pages.find((p) => p.path === 'sell') ?? pages[0];
  useEffect(() => { if (current.path !== path) history.replaceState(null, '', `#/${current.path}`); }, [current.path, path]);
  const counter = sys.counter;

  // offline: show it, and send waiting sales as soon as the connection is back
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(outbox.all().length);
  const qc = useQueryClient();
  useEffect(() => {
    const sync = async () => { if (!outbox.all().length) return; await outbox.flush(); qc.invalidateQueries(); };
    const on = () => { setOnline(true); sync(); }, off = () => setOnline(false), count = () => setPending(outbox.all().length);
    window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('hemlo-outbox', count);
    const every = setInterval(sync, 20_000); sync();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('hemlo-outbox', count); clearInterval(every); };
  }, [qc]);

  const exitDemo = () => { demo.end(); qc.clear(); location.href = site(lang, productPath(tradeOf())); };
  // from the demo clinic to a real one: leave the demo, sign in, start the trial
  const startReal = () => { demo.end(); qc.clear(); location.href = `/?start=${tradeOf()}&lang=${lang}`; };
  const signOut = async () => {
    if (sys.business.demo) return exitDemo();
    if (counter) { await api('/v1/counter/lock', { body: {} }).catch(() => {}); qc.invalidateQueries(); return; }
    await api('/v1/auth/sign-out', { body: {} }).catch(() => {}); document.cookie = 'hemlo.hint=; Max-Age=0; Path=/; Domain=.hemlohq.com'; location.reload();
  };
  const label = (p: Page) => (p.label ? p.label(t) : (t.nav as any)[p.path] as string);
  const View = current.view;
  const sideLinks = pages.filter((p) => p.path !== 'more' && p.path !== 'settings' && !p.hidden);
  const tabs = [...pages.filter((p) => p.tab).slice(0, 4), pages.find((p) => p.path === 'more')!];
  const moreLinks = pages.filter((p) => !p.tab && !p.hidden && p.path !== 'more');
  const banner = <>
    {sys.business.demo && <div className="demo-bar" role="note">
      <span className="demo-text">{dental ? t.demo.bannerDental : gym ? t.demo.bannerGym : estate ? t.demo.bannerRe : school ? t.demo.bannerSchool : t.demo.banner}</span>
      <button className="btn btn-accent btn-sm" onClick={startReal}>{dental ? t.demo.wantDental : gym ? t.demo.wantGym : estate ? t.demo.wantRe : school ? t.demo.wantSchool : t.demo.want}</button>
      <button className="btn btn-secondary btn-sm" onClick={exitDemo}>{t.demo.exit}</button>
    </div>}
    <PlanBar />
  </>;
  // a school: its own frame (the morning's roll call and the money, a parent one tap away)
  if (school) return (
    <Suspense fallback={<div className="grid h-dvh place-items-center"><span className="spinner" /></div>}>
      <SchShell pages={pages} current={current} label={label} banner={banner} orgs={counter ? [] : orgs} choose={choose} signOut={signOut}
        signOutLabel={counter ? `${t.counter.lock} · ${me.user.name}` : sys.business.demo ? t.demo.exit : t.nav.signOut} />
    </Suspense>
  );
  // a real-estate agency: its own frame (the day's work first, a property one tap from WhatsApp)
  if (estate) return (
    <Suspense fallback={<div className="grid h-dvh place-items-center"><span className="spinner" /></div>}>
      <ReShell pages={pages} current={current} label={label} banner={banner} orgs={counter ? [] : orgs} choose={choose} signOut={signOut}
        signOutLabel={counter ? `${t.counter.lock} · ${me.user.name}` : sys.business.demo ? t.demo.exit : t.nav.signOut} />
    </Suspense>
  );
  // a gym too: iron and chalk, the front desk first
  if (gym) return (
    <Suspense fallback={<div className="grid h-dvh place-items-center"><span className="spinner" /></div>}>
      <GymShell pages={pages} current={current} label={label} banner={banner} orgs={counter ? [] : orgs} choose={choose} signOut={signOut}
        signOutLabel={counter ? `${t.counter.lock} · ${me.user.name}` : sys.business.demo ? t.demo.exit : t.nav.signOut} />
    </Suspense>
  );
  // a clinic gets its own frame (its own look, five places, search, one "+")
  if (dental) return (
    <Suspense fallback={<div className="grid h-dvh place-items-center"><span className="spinner" /></div>}>
      <DentalShell pages={pages} current={current} label={label} banner={banner} orgs={counter ? [] : orgs} choose={choose} signOut={signOut}
        signOutLabel={counter ? `${t.counter.lock} · ${me.user.name}` : sys.business.demo ? t.demo.exit : t.nav.signOut} />
    </Suspense>
  );

  return (
    <div className="shell">
      <aside className="side">
        <Logo className="logo" />
        {orgs.length > 1 && !counter ? (
          <select className="biz" value={sys.business.id} onChange={(e) => choose(e.target.value).catch(() => toast(t.errors.generic, 'bad'))} aria-label={t.gate.pickTitle}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        ) : <div className={`biz${sys.business.logoUrl ? ' has-logo' : ''}`}>{sys.business.logoUrl && <img src={sys.business.logoUrl} alt="" className="biz-logo" />}<b className="truncate">{sys.business.name}</b><span>{counter ? t.counter.device.replace('{name}', me.counter.device.name ?? '') : me.user.name}</span></div>}
        <nav className="grid gap-0.5">
          {sideLinks.map((p) => <a key={p.path} className={`nav${p.gapBefore ? ' mt-3' : ''}`} href={`#/${p.path}`} aria-current={p.path === current.path ? 'page' : undefined}><Icon n={p.icon} />{label(p)}</a>)}
        </nav>
        <div className="foot">
          <a className="nav" href="#/settings" aria-current={current.path === 'settings' ? 'page' : undefined}><Icon n="gear" />{t.settings.title}</a>
          <LangPick lang={lang} setLang={setLang} className="nav" />
          <button className="nav" onClick={signOut}><Icon n={counter ? 'lock' : 'out'} />{counter ? `${t.counter.lock} · ${me.user.name}` : sys.business.demo ? t.demo.exit : t.nav.signOut}</button>
        </div>
      </aside>
      <div className="main">
        {banner}
        <header className="top">
          <h1 className="truncate">{label(current)}</h1>
          {!online && <span className="offline"><Icon n="wifi" className="h-4 w-4" />{t.offline}</span>}
          {pending > 0 && <span className="pill warn">{t.sell.pending.replace('{n}', String(pending))}</span>}
          {can('sales.create') && ['sell', 'home', 'today'].includes(current.path) && <DrawerButton />}
          {counter ? <button className="btn btn-secondary btn-sm md:hidden" onClick={signOut}><Icon n="lock" className="h-4 w-4" />{initials(me.user.name)}</button>
            : <span className="avatar md:hidden" title={me.user.name}>{initials(me.user.name)}</span>}
        </header>
        <main className="page"><Suspense fallback={<div className="grid gap-4"><div className="skeleton h-24" /><div className="skeleton h-64" /></div>}>{current.path === 'more' ? <More links={moreLinks.map((p) => ({ href: `#/${p.path}`, icon: p.icon, label: label(p) }))} /> : <View />}</Suspense></main>
      </div>
      <nav className="tabbar">
        {tabs.map((p) => <a key={p.path} href={`#/${p.path}`} aria-current={p.path === current.path || (p.path === 'more' && !tabs.some((x) => x.path === current.path)) ? 'page' : undefined}><Icon n={p.icon} />{label(p)}</a>)}
      </nav>
    </div>
  );
}

/** A trial's days left, or the end of the trial/paid period (everything still opens; nothing new can be added). */
function PlanBar() {
  const { t, sys, lang } = useApp();
  const s = sys.subscription;
  if (!s || sys.business.demo || (s.status !== 'trial' && s.status !== 'ended' && s.status !== 'grace')) return null;
  const wa = '#/plan'; // choose a plan; Hemlo's team takes it from there
  if (s.status === 'trial') return (
    <div className={`plan-bar${(s.daysLeft ?? 0) <= 2 ? ' soon' : ''}`} role="note">
      <span className="flex-1">{(s.daysLeft ?? 0) <= 1 ? t.plan.lastDay : t.plan.trial.replace('{n}', String(s.daysLeft))}</span>
      <a className="btn btn-accent btn-sm" href={wa}>{t.plan.choose}</a>
    </div>
  );
  if (s.status === 'grace') return (
    <div className="plan-bar soon" role="note">
      <span className="flex-1">{t.plan.grace.replace('{n}', String(s.daysLeft ?? 0))}</span>
      <a className="btn btn-accent btn-sm" href={wa}>{t.plan.choose}</a>
    </div>
  );
  return (
    <div className="plan-bar ended" role="alert">
      <span className="flex-1"><b>{s.paidUntil ? t.plan.endedPaid : t.plan.ended}</b> {t.plan.endedBody}</span>
      <a className="btn btn-accent btn-sm" href={wa}>{t.plan.continue}</a>
    </div>
  );
}
