// Hemlo Connect in the app: the team's WhatsApp inbox (the assistant's answers, the automations' messages and the
// agents' own, in one thread per customer), the automations as switches, and connecting the number. Fast on purpose:
// one overview call, the list and the open chat refresh themselves only while the page is on screen, a sent message
// shows at once, and nothing re-fetches what didn't change.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, go } from '../lib/app';
import { Empty, Icon, Sheet } from '../components/ui';
import { HwBadge } from '../components/HwBadge';
import { copyOf, type Copy } from './words';
import './connect.css';

type Plan = 'connect' | 'connect-pro' | 'ai-studio' | null;
type Offer = { code: 'connect' | 'connect-pro' | 'ai-studio'; name: Record<string, string>; description: Record<string, string>; priceMonth: number | null; priceYear: number | null;
  free: boolean; active: boolean; ai: { day: number; week: number; month: number }; studio: boolean };
type AiState = { open: boolean; reason: 'plan' | 'day' | 'week' | 'month' | null; resetsAt: string | null };
const RANK: Record<string, number> = { connect: 0, 'connect-pro': 1, 'ai-studio': 2 };
const hasAi = (p: Plan) => (RANK[p ?? ''] ?? -1) >= 1;
type Recipe = { key: string; plan: string; marketing: boolean; allowed: boolean; on: boolean; settings: Record<string, any>; template: string | null; approved: boolean };
type Channel = { provider: 'sandbox' | 'meta'; status: string; displayPhone: string | null; verifiedName: string | null; tokenHint: string | null; ai: boolean;
  persona: { greeting?: { ar?: string; en?: string }; hours?: string | null; notes?: string | null; quick?: QuickReply[] }; templates: Record<string, { status: string; reason?: string | null }>; error: string | null };
type QuickReply = { title: string; text: string };
type Overview = { plan: Plan; ai: AiState; messaging: { state: 'ok' | 'low' | 'out'; pct: number }; offers: Offer[]; canConfigure: boolean; channel: Channel | null;
  signup: { appId: string; configId: string } | null; recipes: Recipe[]; counts: { unread: number; waiting: number; chats: number }; week: { sent: number; pending: number; missed: number };
  summary: { chats: number; replies: number; viewings: number; replySeconds: number | null } };
type Conv = { id: string; phone: string; name: string | null; leadId: string | null; leadName: string | null; leadStatus: string | null; status: string; handoff: boolean; optedOut: boolean;
  unread: number; lastMessageAt: string; preview: string | null; open: boolean };
type Msg = { id: string; direction: 'in' | 'out'; author: 'customer' | 'agent' | 'ai' | 'automation'; kind: string; body: string; recipe: string | null; status: string; error: string | null; meta: any; createdAt: string; pending?: boolean };
type Thread = { conversation: Conv & { lastInboundAt: string | null }; messages: Msg[]; lead: any; more: boolean };
type Tab = 'inbox' | 'automations' | 'settings';

/** Wide enough for the list and the chat side by side (the CSS breakpoint); on a phone a chat opens full screen. */
const useWide = () => {
  const q = '(min-width: 900px)';
  const [w, setW] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q), on = () => setW(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return w;
};
const useVisible = () => {
  const [v, setV] = useState(() => document.visibilityState === 'visible');
  useEffect(() => { const on = () => setV(document.visibilityState === 'visible'); document.addEventListener('visibilitychange', on); return () => document.removeEventListener('visibilitychange', on); }, []);
  return v;
};

export function Connect() {
  const { lang, errorText } = useApp();
  const C = copyOf(lang);
  const q = useQuery<Overview>({ queryKey: ['connect'], queryFn: () => api('/v1/connect'), staleTime: 30_000 });
  const [tab, setTab] = useState<Tab>('inbox');
  const [plans, setPlans] = useState(false);
  if (q.isLoading) return <div className="grid gap-4"><div className="skeleton h-20" /><div className="skeleton h-[28rem]" /></div>;
  if (!q.data) return <Empty icon="alert" text={errorText(q.error)} />;
  const o = q.data;
  if (!o.plan) return <Offers o={o} C={C} />;
  if (!o.channel || o.channel.status !== 'connected') return <Setup o={o} C={C} />;
  return (
    <div className="cx">
      <header className="cx-head">
        <div className="cx-head-l">
          <HwBadge label="Connect" />
          <span className={`cx-chip ${o.channel.provider === 'sandbox' ? 'warn' : 'ok'}`}><i />{o.channel.provider === 'sandbox' ? C.sandbox : o.channel.displayPhone ?? C.connected}</span>
          <button type="button" className="cx-chip tier" onClick={() => setPlans(true)} title={C.plans}>{C.tiers[o.plan] ?? o.plan}{(RANK[o.plan] ?? 0) < 2 && <small>{C.upgrade}</small>}</button>
        </div>
        <div className="cx-meters">
          <span className={`cx-chip ${o.messaging.state === 'ok' ? '' : 'warn'}`} title={o.messaging.state === 'out' ? C.messagingOut : C.waIncluded}><Icon n="wa" />{C.messaging[o.messaging.state]}</span>
        </div>
      </header>
      <AiNotice o={o} C={C} />
      {plans && <Sheet title={C.plans} onClose={() => setPlans(false)}><Offers o={o} C={C} bare /></Sheet>}
      <nav className="cx-tabs" role="tablist">
        {(['inbox', 'automations', 'settings'] as Tab[]).filter((k) => k !== 'settings' || o.canConfigure).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {C.tabs[k]}{k === 'inbox' && o.counts.unread > 0 && <b className="cx-dot">{o.counts.unread}</b>}
          </button>
        ))}
      </nav>
      {tab === 'inbox' && <Inbox o={o} C={C} />}
      {tab === 'automations' && <Automations o={o} C={C} />}
      {tab === 'settings' && <Settings o={o} C={C} />}
    </div>
  );
}

/** When the assistant has reached a limit: until when it rests (it comes back by itself), and that chats wait for a person. */
function AiNotice({ o, C }: { o: Overview; C: Copy }) {
  const { dateTime } = useApp();
  if (!hasAi(o.plan) || o.ai.open || !o.ai.resetsAt || !o.channel?.ai) return null;
  return <p className="cx-notice"><Icon n="clock" />{C.aiPaused(o.ai.reason ?? 'day', dateTime(o.ai.resetsAt))}</p>;
}

// ------------------------------------------------------------------------------------------------- the tiers
/** Basic (free with the System), Pro and AI Studio: what each adds, its price, and asking for it (the owner). */
function Offers({ o, C, bare }: { o: Overview; C: Copy; bare?: boolean }) {
  const { money, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<'month' | 'year'>('month');
  const req = useQuery({ queryKey: ['billing-addons'], queryFn: () => api<{ addons: any[]; requests: any[]; owner: boolean }>('/v1/billing/addons') });
  const pending = (code: string) => { const a = req.data?.addons.find((x) => x.code === code); return a && req.data?.requests.find((r) => r.addonId === a.id && r.status === 'new'); };
  const ask = useMutation({
    mutationFn: (code: string) => api(`/v1/billing/addons/${code}/request`, { body: { billing: cycle } }),
    onSuccess: () => { toast(C.requested); void qc.invalidateQueries({ queryKey: ['billing-addons'] }); }, onError: (e) => toast(errorText(e), 'bad'),
  });
  const owner = !!req.data?.owner;
  const mine = RANK[o.plan ?? ''] ?? -1;
  const cards = (
    <>
      <div className="seg w-fit mx-auto">{(['month', 'year'] as const).map((c) => <button key={c} aria-pressed={cycle === c} onClick={() => setCycle(c)}>{c === 'month' ? C.monthly : C.yearly}</button>)}</div>
      <div className="cx-plans">
        {o.offers.map((x) => {
          const pro = x.code === 'connect-pro', price = cycle === 'year' ? x.priceYear : x.priceMonth, p = pending(x.code), here = o.plan === x.code, below = RANK[x.code] < mine;
          return (
            <article key={x.code} className={`cx-plan ${pro ? 'pro' : ''} ${here ? 'here' : ''}`}>
              {pro && !here && !below && <span className="cx-ribbon">{C.recommended}</span>}
              {here && <span className="cx-ribbon soft">{C.yourPlan}</span>}
              <h3>Connect {C.tiers[x.code]}</h3>
              <div className="cx-price">{x.free ? C.freeWith : <>{price == null ? '—' : money(price)}<small>{cycle === 'year' ? C.perYear : C.perMonth}</small></>}</div>
              <ul>{(x.code === 'ai-studio' ? C.studioFeatures : pro ? C.proFeatures2 : C.basicFeatures).map((f) => <li key={f}><Icon n="check" />{f}</li>)}
                <li><Icon n="check" />{C.waIncluded}</li>
                {x.ai.month > 0 && <li><Icon n="check" />{C.aiLine(x.ai.day, x.ai.month)}</li>}</ul>
              {x.free || here || below || x.active ? <span className="pill"><Icon n="check" className="h-4 w-4" />{C.included}</span>
                : p ? <span className="pill warn"><Icon n="clock" className="h-4 w-4" />{C.pending}</span>
                : owner ? <button className={`btn ${pro ? 'btn-accent' : 'btn-secondary'} justify-center`} disabled={ask.isPending || price == null} onClick={() => ask.mutate(x.code)}>{C.request}</button>
                : <p className="sub">{C.ownerOnly}</p>}
            </article>
          );
        })}
      </div>
      <p className="sub text-center">{C.manualNote}</p>
    </>
  );
  if (bare) return <div className="grid gap-4">{cards}</div>;
  return (
    <div className="cx">
      <section className="cx-hero">
        <HwBadge label="Connect" tone="ink" size="lg" />
        <h1>{C.heroTitle}</h1>
        <p>{C.heroBody}</p>
        <div className="cx-flow">{C.flow.map((s, i) => <div key={i} className="cx-step"><span>{i + 1}</span><b>{s[0]}</b><small>{s[1]}</small></div>)}</div>
      </section>
      {cards}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- connecting
function Setup({ o, C }: { o: Overview; C: Copy }) {
  const { toast, errorText } = useApp();
  const qc = useQueryClient();
  const [manual, setManual] = useState(false);
  const done = () => qc.invalidateQueries({ queryKey: ['connect'] });
  const sandbox = useMutation({ mutationFn: () => api('/v1/connect/channel/sandbox', { body: {} }), onSuccess: () => { toast(C.sandboxOn); void done(); }, onError: (e) => toast(errorText(e), 'bad') });
  if (!o.canConfigure) return <div className="cx"><Empty icon="wa" text={C.askManager} /></div>;
  return (
    <div className="cx">
      <section className="cx-hero">
        <HwBadge label="Connect" tone="ink" size="lg" />
        <h1>{C.setupTitle}</h1>
        <p>{C.setupBody}</p>
      </section>
      <div className="cx-plans">
        <article className="cx-plan pro">
          <span className="cx-ribbon">WhatsApp</span>
          <h3>{C.connectNumber}</h3>
          <p className="sub">{C.connectNumberBody}</p>
          <ul>{C.connectSteps.map((s) => <li key={s}><Icon n="check" />{s}</li>)}</ul>
          {o.signup ? <SignupButton signup={o.signup} C={C} onDone={done} /> : null}
          <button className={`btn ${o.signup ? 'btn-ghost' : 'btn-accent'} justify-center`} onClick={() => setManual(true)}>{o.signup ? C.manualLink : C.connectNumber}</button>
        </article>
        <article className="cx-plan">
          <span className="cx-ribbon soft">{C.sandbox}</span>
          <h3>{C.tryTitle}</h3>
          <p className="sub">{C.tryBody}</p>
          <button className="btn btn-secondary justify-center" disabled={sandbox.isPending} onClick={() => sandbox.mutate()}><Icon n="sparkle" />{C.tryCta}</button>
        </article>
      </div>
      {manual && <ManualConnect C={C} onClose={() => setManual(false)} onDone={() => { setManual(false); void done(); }} />}
    </div>
  );
}

/** Meta's Embedded Signup: the owner logs in with Facebook, picks or creates the WhatsApp number, and we get a code. */
function SignupButton({ signup, C, onDone }: { signup: { appId: string; configId: string }; C: Copy; onDone(): void }) {
  const { toast, errorText } = useApp();
  const [busy, setBusy] = useState(false);
  const ids = useRef<{ phoneNumberId?: string; wabaId?: string }>({});
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!String(e.origin).endsWith('facebook.com')) return;
      try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (d?.type === 'WA_EMBEDDED_SIGNUP' && d.data) ids.current = { phoneNumberId: d.data.phone_number_id, wabaId: d.data.waba_id }; } catch { /* other messages */ }
    };
    window.addEventListener('message', on); return () => window.removeEventListener('message', on);
  }, []);
  const start = async () => {
    setBusy(true);
    try {
      const FB = await loadFb(signup.appId);
      FB.login((res: any) => {
        const code = res?.authResponse?.code;
        if (!code) { setBusy(false); return; }
        api('/v1/connect/channel/meta', { body: { code, ...ids.current } }).then(() => { toast(C.connectedToast); onDone(); }).catch((e) => toast(errorText(e), 'bad')).finally(() => setBusy(false));
      }, { config_id: signup.configId, response_type: 'code', override_default_response_type: true, extras: { setup: {}, featureType: '', sessionInfoVersion: '3' } });
    } catch (e) { toast(errorText(e), 'bad'); setBusy(false); }
  };
  return <button className="btn btn-accent justify-center" disabled={busy} onClick={start}><Icon n="wa" />{busy ? C.connecting : C.signupCta}</button>;
}
let fbLoading: Promise<any> | null = null;
function loadFb(appId: string): Promise<any> {
  if ((window as any).FB) return Promise.resolve((window as any).FB);
  fbLoading ??= new Promise((resolve, reject) => {
    (window as any).fbAsyncInit = () => { (window as any).FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v23.0' }); resolve((window as any).FB); };
    const s = document.createElement('script'); s.src = 'https://connect.facebook.net/en_US/sdk.js'; s.async = true; s.crossOrigin = 'anonymous'; s.onerror = () => { fbLoading = null; reject(new Error('NETWORK')); };
    document.body.appendChild(s);
  });
  return fbLoading;
}

function ManualConnect({ C, onClose, onDone }: { C: Copy; onClose(): void; onDone(): void }) {
  const { toast, errorText } = useApp();
  const [f, setF] = useState({ phoneNumberId: '', wabaId: '', token: '' });
  const save = useMutation({ mutationFn: () => api('/v1/connect/channel/meta', { body: f }), onSuccess: () => { toast(C.connectedToast); onDone(); }, onError: (e) => toast(errorText(e), 'bad') });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.trim() });
  return (
    <Sheet title={C.connectNumber} sub={C.manualSub} onClose={onClose}
      footer={<button className="btn btn-accent justify-center" disabled={save.isPending || !f.phoneNumberId || !f.wabaId || f.token.length < 20} onClick={() => save.mutate()}>{save.isPending ? C.connecting : C.connectNumber}</button>}>
      <div className="grid gap-3">
        <label className="field">{C.phoneId}<input className="input" dir="ltr" inputMode="numeric" value={f.phoneNumberId} onChange={set('phoneNumberId')} /></label>
        <label className="field">{C.wabaId}<input className="input" dir="ltr" inputMode="numeric" value={f.wabaId} onChange={set('wabaId')} /></label>
        <label className="field">{C.token}<input className="input" dir="ltr" type="password" autoComplete="off" value={f.token} onChange={set('token')} /></label>
        <p className="sub text-sm">{C.tokenNote}</p>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------------------------------------- the inbox
function Inbox({ o, C }: { o: Overview; C: Copy }) {
  const visible = useVisible();
  const [filter, setFilter] = useState<'all' | 'unread' | 'waiting' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('c'));
  const [sim, setSim] = useState(false);
  const wide = useWide();
  useEffect(() => { const t = window.setTimeout(() => setQ(search.trim()), 250); return () => window.clearTimeout(t); }, [search]);
  const list = useQuery<{ conversations: Conv[] }>({
    queryKey: ['connect-convs', filter, q], queryFn: () => api(`/v1/connect/conversations?filter=${filter}&q=${encodeURIComponent(q)}`),
    placeholderData: keepPreviousData, refetchInterval: visible ? 6000 : false, staleTime: 3000,
  });
  const convs = list.data?.conversations ?? [];
  return (
    <>
    <WeekStrip s={o.summary} C={C} />
    <div className="cx-inbox">
      <aside className="cx-list panel">
        <div className="cx-list-top">
          <div className="cx-search"><Icon n="search" /><input placeholder={C.search} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="cx-filters">{(['all', 'unread', 'waiting', 'mine'] as const).map((k) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{C.filters[k]}{k === 'waiting' && o.counts.waiting > 0 ? ` · ${o.counts.waiting}` : ''}</button>)}</div>
          {o.channel?.provider === 'sandbox' && o.canConfigure && <button className="cx-sim-btn" onClick={() => setSim(true)}><Icon n="sparkle" />{C.simulate}</button>}
        </div>
        <div className="cx-rows">
          {list.isLoading ? Array.from({ length: 6 }, (_, i) => <div key={i} className="cx-row"><div className="skeleton h-10 w-10 rounded-full" /><div className="skeleton h-9 flex-1" /></div>)
            : convs.length ? convs.map((c) => <Row key={c.id} c={c} on={open === c.id} C={C} onOpen={() => setOpen(c.id)} />)
            : <div className="cx-empty"><Icon n="wa" /><p>{q || filter !== 'all' ? C.noMatch : o.channel?.provider === 'sandbox' ? C.emptySandbox : C.empty}</p></div>}
        </div>
      </aside>
      {wide ? <section className="cx-thread panel">
        {open ? <ThreadView id={open} C={C} o={o} onBack={() => setOpen(null)} /> : <div className="cx-empty big"><Icon n="wa" /><p>{C.pick}</p></div>}
      </section>
        : open && createPortal(<section className="cx-thread cx-full"><ThreadView id={open} C={C} o={o} onBack={() => setOpen(null)} /></section>, document.body)}
      {sim && <Simulator C={C} onClose={() => setSim(false)} onSent={(id) => { setSim(false); setOpen(id); }} />}
    </div>
    </>
  );
}

/** What Connect did this week, in four numbers: the reason the owner keeps paying for it. */
function WeekStrip({ s, C }: { s: Overview['summary']; C: Copy }) {
  const { num, lang } = useApp();
  if (!s || (!s.chats && !s.replies)) return null;
  const t = s.replySeconds;
  const speed = t == null ? '—' : t < 90 ? `${num(t)}${C.unitS}` : t < 5400 ? `${num(Math.round(t / 60))}${C.unitM}` : `${num(Math.round(t / 3600))}${C.unitH}`;
  return (
    <div className="cx-weekstrip" aria-label={C.thisWeek}>
      <span className="cx-ws-k">{C.thisWeek}</span>
      {([[s.chats, C.wsChats], [s.replies, C.wsReplies], [s.viewings, C.wsViewings]] as [number, string][]).map(([v, l]) => <span key={l}><b>{num(v)}</b>{l}</span>)}
      <span><b dir={lang === 'en' ? undefined : 'auto'}>{speed}</b>{C.wsSpeed}</span>
    </div>
  );
}

const initials = (s: string) => s.replace(/^\+/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
function Row({ c, on, C, onOpen }: { c: Conv; on: boolean; C: Copy; onOpen(): void }) {
  const { time, date } = useApp();
  const name = c.leadName || c.name || c.phone;
  const today = new Date(c.lastMessageAt).toDateString() === new Date().toDateString();
  return (
    <button className={`cx-row ${on ? 'on' : ''} ${c.unread ? 'unread' : ''}`} onClick={onOpen}>
      <span className="cx-av" aria-hidden="true">{initials(name)}</span>
      <span className="cx-row-m">
        <span className="cx-row-t"><b><bdi>{name}</bdi></b><small>{today ? time(c.lastMessageAt) : date(c.lastMessageAt)}</small></span>
        <span className="cx-row-p">
          {c.handoff && <span className="cx-tag warn">{C.waitingTag}</span>}
          {c.optedOut && <span className="cx-tag">{C.optedOutTag}</span>}
          <span className="cx-prev">{c.preview}</span>
          {c.unread > 0 && <b className="cx-dot">{c.unread}</b>}
        </span>
      </span>
    </button>
  );
}

function ThreadView({ id, C, o, onBack }: { id: string; C: Copy; o: Overview; onBack(): void }) {
  const { toast, errorText, dateTime, lang } = useApp();
  const visible = useVisible();
  const qc = useQueryClient();
  const key = ['connect-conv', id];
  const q = useQuery<Thread>({ queryKey: key, queryFn: () => api(`/v1/connect/conversations/${id}`), refetchInterval: visible ? 4000 : false, staleTime: 2000 });
  const [text, setText] = useState('');
  const [tool, setTool] = useState<'quick' | 'listing' | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const assist = useMutation({
    mutationFn: (mode: 'suggest' | 'summary') => api<{ text: string }>(`/v1/connect/conversations/${id}/assist`, { body: { mode, lang: lang === 'en' ? 'en' : 'ar' } }).then((r) => ({ mode, text: r.text })),
    onSuccess: (r) => { if (r.mode === 'suggest') { setText(r.text); area.current?.focus(); } else setBrief(r.text); },
    onError: (e: any) => { toast(e?.code === 'AI_PAUSED' ? C.aiPaused(o.ai.reason ?? 'day', o.ai.resetsAt ? dateTime(o.ai.resetsAt) : '') : errorText(e), 'bad'); void qc.invalidateQueries({ queryKey: ['connect'] }); },
  });
  const tools = hasAi(o.plan);
  const area = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = q.data?.messages.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [count, id]);
  useEffect(() => { void qc.invalidateQueries({ queryKey: ['connect-convs'] }); }, [id, qc]); // its unread count is now 0
  const send = useMutation({
    mutationFn: (body: string) => api<{ message: Msg }>(`/v1/connect/conversations/${id}/messages`, { body: { text: body } }),
    onMutate: (body) => {
      const prev = qc.getQueryData<Thread>(key);
      if (prev) qc.setQueryData<Thread>(key, { ...prev, conversation: { ...prev.conversation, handoff: true }, messages: [...prev.messages, { id: `tmp-${Date.now()}`, direction: 'out', author: 'agent', kind: 'text', body, recipe: null, status: 'queued', error: null, meta: {}, createdAt: new Date().toISOString(), pending: true }] });
      setText('');
      return { prev, body };
    },
    onError: (e, _b, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); setText(ctx?.body ?? ''); toast(errorText(e), 'bad'); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['connect-convs'] }); },
  });
  const hand = useMutation({
    mutationFn: (handoff: boolean) => api(`/v1/connect/conversations/${id}`, { method: 'PATCH', body: { handoff } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['connect-convs'] }); }, onError: (e) => toast(errorText(e), 'bad'),
  });
  const groups = useMemo(() => {
    const out: { day: string; items: Msg[] }[] = [];
    for (const m of q.data?.messages ?? []) { const day = new Date(m.createdAt).toDateString(); if (out.at(-1)?.day !== day) out.push({ day, items: [] }); out.at(-1)!.items.push(m); }
    return out;
  }, [q.data?.messages]);
  if (q.isLoading) return <div className="grid gap-3 p-4"><div className="skeleton h-12" /><div className="skeleton h-64" /></div>;
  if (!q.data) return <Empty icon="alert" text={errorText(q.error)} />;
  const c = q.data.conversation, lead = q.data.lead, name = lead?.name || c.name || c.phone;
  const assistant = hasAi(o.plan) && o.channel?.ai;
  return (
    <>
      <header className="cx-th-head">
        <button className="cx-back" onClick={onBack} aria-label={C.back}><Icon n="back" className="rtl:-scale-x-100" /></button>
        <span className="cx-av" aria-hidden="true">{initials(name)}</span>
        <div className="cx-th-who">
          <b><bdi>{name}</bdi></b>
          <small><bdi dir="ltr">{c.phone}</bdi></small>
        </div>
        <div className="cx-th-acts">
          {tools && <button className="btn btn-ghost btn-sm" disabled={assist.isPending} onClick={() => assist.mutate('summary')} aria-label={C.summary} title={C.summary}><Icon n="sparkle" /><span className="cx-wide-only">{assist.isPending && assist.variables === 'summary' ? C.thinking : C.summary}</span></button>}
          {lead && <button className="btn btn-ghost btn-sm" onClick={() => go(`#/lead?id=${lead.id}`)} aria-label={C.openLead} title={C.openLead}><Icon n="user" /><span className="cx-wide-only">{C.openLead}</span></button>}
          {assistant && (c.handoff
            ? <button className="btn btn-secondary btn-sm" disabled={hand.isPending} onClick={() => hand.mutate(false)}><Icon n="sparkle" />{C.giveBack}</button>
            : <button className="btn btn-secondary btn-sm" disabled={hand.isPending} onClick={() => hand.mutate(true)}>{C.takeOver}</button>)}
        </div>
      </header>
      {lead && <LeadStrip lead={lead} C={C} />}
      {brief && <div className="cx-brief"><b><Icon n="sparkle" />{C.summaryTitle}</b><p>{brief}</p><button className="cx-x" onClick={() => setBrief(null)} aria-label={C.back}>×</button></div>}
      <div className="cx-msgs">
        {groups.map((g) => (
          <div key={g.day} className="cx-day">
            <span className="cx-day-l">{new Date(g.items[0].createdAt).toDateString() === new Date().toDateString() ? C.today : dateTime(g.items[0].createdAt).split(/[,،]/)[0]}</span>
            {g.items.map((m) => <Bubble key={m.id} m={m} C={C} />)}
          </div>
        ))}
        <div ref={end} />
      </div>
      <footer className="cx-compose">
        {c.optedOut ? <p className="cx-note">{C.optedOutNote}</p>
          : !c.open ? <p className="cx-note"><Icon n="clock" />{C.windowClosed}</p>
          : <>
            {assistant && !c.handoff && <p className="cx-note soft"><Icon n="sparkle" />{C.assistantOn}</p>}
            {tool === 'quick' && <QuickPick o={o} C={C} onPick={(t) => { setText((x) => (x ? `${x} ${t}` : t)); setTool(null); area.current?.focus(); }} onClose={() => setTool(null)} />}
            <form onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t && !send.isPending) send.mutate(t); }}>
              <span className="cx-tools">
                <button type="button" className="cx-tool" aria-pressed={tool === 'quick'} aria-label={C.quick} title={C.quick} onClick={() => setTool(tool === 'quick' ? null : 'quick')}><Icon n="sparkle" /></button>
                <button type="button" className="cx-tool" aria-label={C.sendListing} title={C.sendListing} onClick={() => setTool('listing')}><Icon n="home" /></button>
                {tools && <button type="button" className={`cx-tool ${assist.isPending && assist.variables === 'suggest' ? 'busy' : ''}`} disabled={assist.isPending} aria-label={C.suggest} title={C.suggest} onClick={() => assist.mutate('suggest')}><Icon n="pen" /></button>}
              </span>
              <textarea ref={area} rows={1} value={text} placeholder={C.write} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
              <button className="cx-send" disabled={!text.trim()} aria-label={C.send}><Icon n="arrow" className="rtl:-scale-x-100" /></button>
            </form>
          </>}
      </footer>
      {tool === 'listing' && <ListingPick convId={id} C={C} onClose={() => setTool(null)} onSent={() => { setTool(null); void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['connect-convs'] }); }} />}
    </>
  );
}

/** Saved answers, one tap each (the agency's own, or a few to start with). */
function QuickPick({ o, C, onPick, onClose }: { o: Overview; C: Copy; onPick(t: string): void; onClose(): void }) {
  const list = o.channel?.persona.quick?.length ? o.channel.persona.quick : C.quickDefaults;
  useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); }, [onClose]);
  return (
    <div className="cx-quick" role="menu">
      {list.map((q) => <button key={q.title} role="menuitem" onClick={() => onPick(q.text)}><b>{q.title}</b><span>{q.text}</span></button>)}
      {!o.channel?.persona.quick?.length && o.canConfigure && <p className="cx-quick-note">{C.quickHint}</p>}
    </div>
  );
}

/** One of the agency's homes, into the chat: its title, price and page. */
function ListingPick({ convId, C, onClose, onSent }: { convId: string; C: Copy; onClose(): void; onSent(): void }) {
  const { lang, toast, errorText } = useApp();
  const [q, setQ] = useState(''), [term, setTerm] = useState('');
  useEffect(() => { const t = window.setTimeout(() => setTerm(q.trim()), 250); return () => window.clearTimeout(t); }, [q]);
  const list = useQuery<{ listings: { id: string; ref: number; title: string; titleEn: string | null; area: string | null; city: string | null; cover: string | null; price: string; priceEn: string }[] }>({
    queryKey: ['connect-listings', term], queryFn: () => api(`/v1/connect/listings?q=${encodeURIComponent(term)}`), placeholderData: keepPreviousData, staleTime: 60_000 });
  const send = useMutation({ mutationFn: (propertyId: string) => api(`/v1/connect/conversations/${convId}/listing`, { body: { propertyId, lang: lang === 'en' ? 'en' : 'ar' } }),
    onSuccess: () => { toast(C.listingSent); onSent(); }, onError: (e) => toast(errorText(e), 'bad') });
  return (
    <Sheet title={C.sendListing} sub={C.sendListingSub} onClose={onClose}>
      <div className="grid gap-3">
        <div className="cx-search"><Icon n="search" /><input autoFocus placeholder={C.listingSearch} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="cx-plist">
          {list.isLoading ? <div className="skeleton h-40" /> : list.data?.listings.length ? list.data.listings.map((p) => (
            <button key={p.id} disabled={send.isPending} onClick={() => send.mutate(p.id)}>
              {p.cover ? <img src={p.cover} alt="" loading="lazy" /> : <span className="ph" />}
              <span className="min-w-0 flex-1"><b>{lang === 'en' ? p.titleEn || p.title : p.title}</b><small>#{p.ref} · {[p.area, p.city].filter(Boolean).join('، ')}</small></span>
              <em dir="ltr">{lang === 'en' ? p.priceEn : p.price}</em>
            </button>
          )) : <p className="sub">{C.noListings}</p>}
        </div>
      </div>
    </Sheet>
  );
}

function LeadStrip({ lead, C }: { lead: any; C: Copy }) {
  const { money } = useApp();
  const budget = lead.budgetMax ? <bdi dir="ltr">≤ {lead.currency === 'USD' ? `$${Number(lead.budgetMax).toLocaleString('en-US')}` : money(Number(lead.budgetMax))}</bdi> : null;
  const bits = [lead.purpose === 'rent' ? C.rent : C.buy, ...(lead.types ?? []).slice(0, 2).map((t: string) => C.types[t] ?? t), ...(lead.areas ?? []).slice(0, 2),
    budget, lead.bedrooms ? `${lead.bedrooms}+ ${C.beds}` : null].filter(Boolean);
  return <div className="cx-strip">{bits.map((b, i) => <span key={i}>{b}</span>)}{!lead.consent && <span className="muted">{C.noConsent}</span>}</div>;
}

function Bubble({ m, C }: { m: Msg; C: Copy }) {
  const { time } = useApp();
  const out = m.direction === 'out';
  const by = m.author === 'ai' ? <><Icon n="sparkle" />{C.byAi}</> : m.author === 'automation' ? <><Icon n="clock" />{C.recipes[m.recipe ?? ''] ?? C.byAuto}</> : null;
  const ticks = out ? (m.pending ? '…' : m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : m.status === 'failed' ? '!' : '✓') : null;
  return (
    <div className={`cx-b ${out ? 'out' : 'in'} ${m.author} ${m.status === 'failed' ? 'failed' : ''}`}>
      {by && <span className="cx-by">{by}</span>}
      <p>{linkify(m.body)}</p>
      <span className="cx-meta">{time(m.createdAt)}{ticks && <i className={m.status === 'read' ? 'read' : ''}>{ticks}</i>}</span>
      {m.status === 'failed' && m.error && <span className="cx-err">{m.error}</span>}
    </div>
  );
}
const linkify = (s: string) => s.split(/(https?:\/\/[^\s]+)/g).map((part, i) => (/^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener" dir="ltr">{part.replace(/^https?:\/\//, '')}</a> : part));

function Simulator({ C, onClose, onSent }: { C: Copy; onClose(): void; onSent(id: string): void }) {
  const { toast, errorText } = useApp();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: C.simName, phone: '+9647700000001', text: C.simText });
  const send = useMutation({
    mutationFn: () => api<{ conversationId: string }>('/v1/connect/simulate', { body: f }),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['connect-convs'] }); void qc.invalidateQueries({ queryKey: ['connect'] }); onSent(r.conversationId); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  return (
    <Sheet title={C.simulate} sub={C.simSub} onClose={onClose}
      footer={<button className="btn btn-accent justify-center" disabled={send.isPending || !f.text.trim()} onClick={() => send.mutate()}>{send.isPending ? C.sending : C.send}</button>}>
      <div className="grid gap-3">
        <div className="web-row2">
          <label className="field">{C.simWho}<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field">{C.simPhone}<input className="input" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        </div>
        <label className="field">{C.simMessage}<textarea className="input" rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------------------------------------- automations
function Automations({ o, C }: { o: Overview; C: Copy }) {
  const { toast, errorText, dateTime } = useApp();
  const qc = useQueryClient();
  const log = useQuery<{ jobs: any[] }>({ queryKey: ['connect-log'], queryFn: () => api('/v1/connect/activity'), staleTime: 15_000 });
  const set = useMutation({
    mutationFn: (r: { key: string; enabled: boolean; settings?: Record<string, unknown> }) => api(`/v1/connect/recipes/${r.key}`, { method: 'PUT', body: { enabled: r.enabled, settings: r.settings } }),
    onMutate: (r) => {
      const prev = qc.getQueryData<Overview>(['connect']);
      if (prev) qc.setQueryData<Overview>(['connect'], { ...prev, recipes: prev.recipes.map((x) => (x.key === r.key ? { ...x, on: r.enabled, settings: r.settings ?? x.settings } : x)) });
      return { prev };
    },
    onError: (e, _r, ctx) => { if (ctx?.prev) qc.setQueryData(['connect'], ctx.prev); toast(errorText(e), 'bad'); },
  });
  return (
    <div className="cx-auto">
      <div className="cx-week">
        <div><b>{o.week.sent}</b><span>{C.weekSent}</span></div>
        <div><b>{o.week.pending}</b><span>{C.weekPending}</span></div>
        <div><b>{o.week.missed}</b><span>{C.weekMissed}</span></div>
      </div>
      <div className="cx-recipes">
        {o.recipes.map((r) => (
          <article key={r.key} className={`cx-recipe ${r.on && r.allowed ? 'on' : ''} ${!r.allowed ? 'locked' : ''}`}>
            <span className="cx-r-ic"><Icon n={C.recipeIcon[r.key] ?? 'sparkle'} /></span>
            <div className="cx-r-m">
              <b>{C.recipes[r.key]}{r.plan === 'connect-pro' && <span className="cx-tag pro">Pro</span>}{r.marketing && <span className="cx-tag">{C.consentTag}</span>}</b>
              <p>{C.recipeBody[r.key]}</p>
              {r.key === 'cold_lead' && r.allowed && <label className="cx-inline">{C.coldDays}<select className="input" value={r.settings.days ?? 21} onChange={(e) => set.mutate({ key: r.key, enabled: r.on, settings: { days: Number(e.target.value) } })}>{[14, 21, 30, 45, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
              {o.channel?.provider === 'meta' && r.template && !r.approved && <span className="cx-tag warn">{C.awaitingApproval}</span>}
            </div>
            {r.allowed
              ? <label className="cx-switch" aria-label={C.recipes[r.key]}><input type="checkbox" role="switch" checked={r.on} disabled={!o.canConfigure} onChange={(e) => set.mutate({ key: r.key, enabled: e.target.checked })} /><i aria-hidden="true" /></label>
              : <span className="cx-tag pro">{C.needsPro}</span>}
          </article>
        ))}
      </div>
      <h3 className="cx-h3">{C.lately}</h3>
      <div className="panel cx-log">
        {log.isLoading ? <div className="skeleton h-24" /> : log.data?.jobs.length ? log.data.jobs.map((j) => (
          <div key={j.id} className="cx-log-row">
            <span className={`cx-st ${j.status}`}>{C.jobStatus[j.status] ?? j.status}</span>
            <div className="min-w-0 flex-1"><b>{C.recipes[j.recipe] ?? j.recipe}</b><p>{j.text}</p>{j.error && j.status !== 'done' && <small>{C.why[j.error] ?? j.error}</small>}</div>
            <small className="flex-none">{dateTime(j.doneAt ?? j.dueAt)}</small>
          </div>
        )) : <div className="cx-empty"><Icon n="clock" /><p>{C.noLog}</p></div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- settings
function Settings({ o, C }: { o: Overview; C: Copy }) {
  const { toast, errorText } = useApp();
  const qc = useQueryClient();
  const ch = o.channel!;
  const [p, setP] = useState({ hours: ch.persona.hours ?? '', notes: ch.persona.notes ?? '', ar: ch.persona.greeting?.ar ?? '', en: ch.persona.greeting?.en ?? '' });
  const done = () => qc.invalidateQueries({ queryKey: ['connect'] });
  const save = useMutation({ mutationFn: (body: any) => api('/v1/connect/settings', { method: 'PATCH', body }), onSuccess: () => { toast(C.saved); void done(); }, onError: (e) => toast(errorText(e), 'bad') });
  const sync = useMutation({ mutationFn: () => api('/v1/connect/channel/templates', { body: {} }), onSuccess: () => { toast(C.synced); void done(); }, onError: (e) => toast(errorText(e), 'bad') });
  const off = useMutation({ mutationFn: () => api('/v1/connect/channel', { method: 'DELETE' }), onSuccess: () => void done(), onError: (e) => toast(errorText(e), 'bad') });
  const tpl = Object.entries(ch.templates ?? {});
  return (
    <div className="cx-set">
      <section className="panel cx-card">
        <div className="cx-card-h"><span className="cx-r-ic"><Icon n="sparkle" /></span><div><b>{C.assistant}</b><p className="sub">{hasAi(o.plan) ? C.assistantBody : C.assistantPro}</p></div>
          {hasAi(o.plan) && <label className="cx-switch"><input type="checkbox" role="switch" checked={ch.ai} onChange={(e) => save.mutate({ ai: e.target.checked })} /><i aria-hidden="true" /></label>}</div>
        <div className="web-row2">
          <label className="field">{C.hours}<input className="input" value={p.hours} placeholder={C.hoursHint} onChange={(e) => setP({ ...p, hours: e.target.value })} /></label>
        </div>
        <label className="field">{C.notes}<textarea className="input" rows={3} value={p.notes} placeholder={C.notesHint} onChange={(e) => setP({ ...p, notes: e.target.value })} /></label>
        <div className="web-row2">
          <label className="field">{C.greetingAr}<textarea className="input" rows={2} dir="rtl" value={p.ar} placeholder={C.greetingHint} onChange={(e) => setP({ ...p, ar: e.target.value })} /></label>
          <label className="field">{C.greetingEn}<textarea className="input" rows={2} dir="ltr" value={p.en} onChange={(e) => setP({ ...p, en: e.target.value })} /></label>
        </div>
        <button className="btn btn-accent w-fit" disabled={save.isPending} onClick={() => save.mutate({ persona: { hours: p.hours, notes: p.notes, greeting: { ar: p.ar, en: p.en } } })}>{C.save}</button>
      </section>
      <QuickEditor ch={ch} C={C} />
      <section className="panel cx-card">
        <div className="cx-card-h"><span className="cx-r-ic"><Icon n="wa" /></span><div><b>{ch.provider === 'sandbox' ? C.sandbox : ch.verifiedName ?? 'WhatsApp'}</b>
          <p className="sub" dir={ch.displayPhone ? 'ltr' : undefined}>{ch.provider === 'sandbox' ? C.sandboxBody : ch.displayPhone}</p></div></div>
        {ch.provider === 'meta' && <>
          <div className="cx-tpls">{tpl.length ? tpl.map(([k, v]) => <span key={k} className={`cx-tag ${v.status === 'approved' ? 'ok' : v.status === 'rejected' ? 'bad' : 'warn'}`} title={v.reason ?? ''}>{C.recipes[k.split(':')[0].replace(/^hemlo_/, '').replace('inquiry_reply', 'instant_reply')] ?? k} · {k.split(':')[1]} · {C.tplStatus[v.status] ?? v.status}</span>) : <p className="sub">{C.noTemplates}</p>}</div>
          <button className="btn btn-secondary btn-sm w-fit" disabled={sync.isPending} onClick={() => sync.mutate()}>{C.sync}</button>
        </>}
        <div className="flex flex-wrap gap-2">
          {ch.provider === 'sandbox' && <button className="btn btn-accent btn-sm" onClick={() => { void off.mutateAsync().then(done); }}>{C.connectNumber}</button>}
          <button className="btn btn-ghost btn-sm" disabled={off.isPending} onClick={() => { if (confirm(C.disconnectQ)) off.mutate(); }}>{C.disconnect}</button>
        </div>
      </section>
    </div>
  );
}

/** The agency's saved answers: a title to find it, and the text it puts in the chat. */
function QuickEditor({ ch, C }: { ch: Channel; C: Copy }) {
  const { toast, errorText } = useApp();
  const qc = useQueryClient();
  const [rows, setRows] = useState<QuickReply[]>(() => (ch.persona.quick?.length ? ch.persona.quick : C.quickDefaults).map((x) => ({ ...x })));
  const save = useMutation({ mutationFn: () => api('/v1/connect/settings', { method: 'PATCH', body: { persona: { quick: rows.filter((r) => r.title.trim() && r.text.trim()) } } }),
    onSuccess: () => { toast(C.saved); void qc.invalidateQueries({ queryKey: ['connect'] }); }, onError: (e) => toast(errorText(e), 'bad') });
  const set = (i: number, k: keyof QuickReply, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <section className="panel cx-card">
      <div className="cx-card-h"><span className="cx-r-ic"><Icon n="sparkle" /></span><div><b>{C.quick}</b><p className="sub">{C.quickBody}</p></div></div>
      <div className="cx-qrows">
        {rows.map((r, i) => (
          <div key={i} className="cx-qrow">
            <input className="input" value={r.title} maxLength={40} placeholder={C.quickTitle} onChange={(e) => set(i, 'title', e.target.value)} />
            <textarea className="input" rows={2} value={r.text} maxLength={1000} placeholder={C.quickText} onChange={(e) => set(i, 'text', e.target.value)} />
            <button className="btn btn-ghost btn-sm" aria-label={C.remove} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon n="trash" /></button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.length < 20 && <button className="btn btn-secondary btn-sm" onClick={() => setRows([...rows, { title: '', text: '' }])}><Icon n="plus" />{C.quickAdd}</button>}
        <button className="btn btn-accent btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>{C.save}</button>
      </div>
    </section>
  );
}
