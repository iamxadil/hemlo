// Hemlo AI Studio in the app: marketing from the agency's own listings. A campaign (copy for WhatsApp, Instagram and
// Facebook, in Arabic and English), a content plan for the coming weeks, and post images. Every limit is the server's;
// this page only shows what's left and says plainly when a tool isn't connected yet.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import { Empty, Icon } from '../components/ui';
import { HwBadge } from '../components/HwBadge';
import { wordsOf, type W } from './words';
type SW = W & { shop: boolean };
import './studio.css';

type State = { active: boolean; offer: { code: string; name: Record<string, string>; description: Record<string, string>; priceMonth: number | null; priceYear: number | null } | null;
  allowance: { copy: number; images: number; videos: number }; used: { copy: number; images: number; videos: number }; tools: { copy: boolean; plan: boolean; image: boolean; video: boolean } };
type Listing = { id: string; ref: number; title: string; titleEn: string | null; cover: string | null; area: string | null; city: string | null };
type Channel = 'whatsapp' | 'instagram' | 'facebook';
type Campaign = { headline: { ar: string; en: string }; ar: Record<string, any>; en: Record<string, any> };
type Tab = 'campaign' | 'plan' | 'images' | 'video';

export function Studio() {
  const { lang, errorText, sys } = useApp();
  const w = wordsOf(lang, sys.business.kind !== 'realestate');
  const q = useQuery<State>({ queryKey: ['studio'], queryFn: () => api('/v1/studio'), staleTime: 30_000 });
  const [tab, setTab] = useState<Tab>('campaign');
  if (q.isLoading) return <div className="grid gap-4"><div className="skeleton h-24" /><div className="skeleton h-80" /></div>;
  if (!q.data) return <Empty icon="alert" text={errorText(q.error)} />;
  const s = q.data;
  if (!s.active) return <Offer s={s} w={w} />;
  const left = (k: 'copy' | 'images') => Math.max(0, s.allowance[k] - s.used[k]);
  return (
    <div className="st">
      <header className="st-head">
        <HwBadge label="AI Studio" />
        <div className="st-left">
          <span><b>{left('copy')}</b>{w.leftCopy}</span>
          {s.tools.image && <span><b>{left('images')}</b>{w.leftImages}</span>}
        </div>
      </header>
      <nav className="st-tabs" role="tablist">
        {(['campaign', 'plan', 'images', 'video'] as Tab[]).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}><Icon n={w.tabIcon[k]} />{w.tabs[k]}</button>)}
      </nav>
      {tab === 'campaign' && <CampaignTab w={w} />}
      {tab === 'plan' && <PlanTab w={w} />}
      {tab === 'images' && (s.tools.image ? <ImagesTab w={w} /> : <Soon icon="image" title={w.imagesSoon} body={w.imagesSoonBody} />)}
      {tab === 'video' && <Soon icon="camera" title={w.videoSoon} body={w.videoSoonBody} />}
    </div>
  );
}

function Soon({ icon, title, body }: { icon: string; title: string; body: string }) {
  return <div className="st-soon panel"><span className="st-soon-ic"><Icon n={icon} /></span><b>{title}</b><p>{body}</p></div>;
}

/** Before AI Studio: what it adds, its price, and asking for it (the account owner). */
function Offer({ s, w }: { s: State; w: W }) {
  const { lang, money, toast, errorText, t } = useApp();
  const qc = useQueryClient();
  const req = useQuery({ queryKey: ['billing-addons'], queryFn: () => api<{ addons: any[]; requests: any[]; owner: boolean }>('/v1/billing/addons') });
  const mine = req.data?.addons.find((x) => x.code === 'ai-studio');
  const pending = mine && req.data?.requests.find((r) => r.addonId === mine.id && r.status === 'new');
  const ask = useMutation({
    mutationFn: () => api('/v1/billing/addons/ai-studio/request', { body: { billing: 'month' } }),
    onSuccess: (r: any) => { if (r?.activated) { toast(t.errors.demoOn); void qc.invalidateQueries(); return; } toast(w.requested); void qc.invalidateQueries({ queryKey: ['billing-addons'] }); }, onError: (e) => toast(errorText(e), 'bad'),
  });
  const L = (x?: Record<string, string>) => x?.[lang === 'en' ? 'en' : 'ar'] ?? '';
  return (
    <div className="st">
      <section className="st-hero">
        <HwBadge label="AI Studio" tone="ink" size="lg" />
        <h1>{w.heroTitle}</h1>
        <p>{L(s.offer?.description) || w.heroBody}</p>
        <ul className="st-feats">{w.features.map(([t, b], i) => <li key={i}><Icon n={w.featIcons[i]} /><b>{t}</b><span>{b}</span></li>)}</ul>
        <div className="st-buy">
          {s.offer?.priceMonth != null && <span className="st-price">{money(s.offer.priceMonth)}<small>{w.perMonth}</small></span>}
          {pending ? <span className="pill warn"><Icon n="clock" className="h-4 w-4" />{w.pending}</span>
            : req.data?.owner ? <button className="btn btn-accent" disabled={ask.isPending || s.offer?.priceMonth == null} onClick={() => ask.mutate()}><Icon n="sparkle" />{w.request}</button>
            : <p className="sub">{w.ownerOnly}</p>}
        </div>
        <p className="sub">{w.includesPro}</p>
      </section>
    </div>
  );
}

/** What the business sells, in one shape: an agency's live listings, or a shop's products (the ones online first). */
const useListings = (shop = false) => useQuery<{ properties: Listing[] }>({ queryKey: ['studio-listings', shop], staleTime: 60_000,
  queryFn: async () => shop
    ? { properties: ((await api<{ products: any[] }>('/v1/sys/products')).products).sort((a, b) => Number(b.online) - Number(a.online)).slice(0, 48)
      .map((p, i) => ({ id: p.id, ref: i + 1, title: p.name, titleEn: null, cover: p.imageUrl ?? null, area: p.category ?? null, city: null })) }
    : api('/v1/re/properties?status=live&limit=24') });
const errOf = (w: SW, errorText: (e: unknown) => string) => (e: any) => (e?.code && w.errors[e.code]) || errorText(e);

// ------------------------------------------------------------------------------------------------- a campaign
function CampaignTab({ w }: { w: SW }) {
  const { lang, toast, errorText } = useApp();
  const qc = useQueryClient();
  const list = useListings(w.shop);
  const [picked, setPicked] = useState<string[]>([]);
  const [goal, setGoal] = useState('sell');
  const [channels, setChannels] = useState<Channel[]>(['whatsapp', 'instagram', 'facebook']);
  const [note, setNote] = useState('');
  const [view, setView] = useState<'ar' | 'en'>(lang === 'en' ? 'en' : 'ar');
  const run = useMutation({
    mutationFn: () => api<{ campaign: Campaign; checked: boolean }>('/v1/studio/campaign', { body: { propertyIds: picked, goal, channels, note } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio'] }), onError: (e) => toast(errOf(w, errorText)(e), 'bad'),
  });
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 6 ? p : [...p, id]));
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast(w.copied); } catch { /* it's on screen */ } };
  const out = run.data;
  return (
    <div className="st-grid">
      <section className="panel st-form">
        <h3>{w.pickListings}</h3>
        <div className="st-picks">
          {list.isLoading ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-24" />)
            : list.data?.properties.length ? list.data.properties.map((p) => (
              <button key={p.id} type="button" className="st-pick" aria-pressed={picked.includes(p.id)} onClick={() => toggle(p.id)}>
                {p.cover ? <img src={p.cover} alt="" loading="lazy" /> : <span className="ph" />}
                <span><b>{(lang === 'en' && p.titleEn) || p.title}</b><small>#{p.ref}</small></span>
                <i aria-hidden="true"><Icon n="check" /></i>
              </button>)) : <p className="sub">{w.noListings}</p>}
        </div>
        <h3>{w.goal}</h3>
        <div className="st-chips">{w.goals.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={goal === k} onClick={() => setGoal(k)}>{l}</button>)}</div>
        <h3>{w.channels}</h3>
        <div className="st-chips">{(['whatsapp', 'instagram', 'facebook'] as Channel[]).map((c) => <button key={c} type="button" className="chip" aria-pressed={channels.includes(c)}
          onClick={() => setChannels((x) => (x.includes(c) ? (x.length > 1 ? x.filter((y) => y !== c) : x) : [...x, c]))}>{w.channelNames[c]}</button>)}</div>
        <label className="field">{w.note}<textarea className="input" rows={2} value={note} maxLength={400} placeholder={w.notePh} onChange={(e) => setNote(e.target.value)} /></label>
        <button className="btn btn-accent justify-center" disabled={!picked.length || run.isPending} onClick={() => run.mutate()}><Icon n="sparkle" />{run.isPending ? w.writing : w.write}</button>
      </section>
      <section className="st-out">
        {run.isPending ? <div className="panel st-wait"><span className="st-dots"><i /><i /><i /></span>{w.writing}</div>
          : out ? (
            <div className="panel st-result">
              <div className="st-result-h">
                <b>{out.campaign.headline?.[view]}</b>
                <div className="seg">{(['ar', 'en'] as const).map((l) => <button key={l} aria-pressed={view === l} onClick={() => setView(l)}>{l === 'ar' ? 'العربية' : 'English'}</button>)}</div>
              </div>
              {!out.checked && <p className="st-warn"><Icon n="alert" />{w.checkNumbers}</p>}
              {channels.map((c) => out.campaign[view]?.[c] ? (
                <article key={c} className="st-post" dir={view === 'ar' ? 'rtl' : 'ltr'}>
                  <header><b>{w.channelNames[c]}</b><button className="btn btn-ghost btn-sm" onClick={() => copy(out.campaign[view][c] + (c !== 'whatsapp' && out.campaign[view].hashtags?.length ? `\n\n${out.campaign[view].hashtags.map((h: string) => `#${h.replace(/^#/, '').replace(/\s+/g, '_')}`).join(' ')}` : ''))}><Icon n="clip" />{w.copy}</button></header>
                  <p>{out.campaign[view][c]}</p>
                </article>) : null)}
              {out.campaign[view]?.hashtags?.length > 0 && <p className="st-tags" dir={view === 'ar' ? 'rtl' : 'ltr'}>{out.campaign[view].hashtags.map((h: string) => <span key={h}>#{h.replace(/^#/, '')}</span>)}</p>}
            </div>)
          : <div className="panel st-empty"><Icon n="sparkle" /><p>{w.campaignEmpty}</p></div>}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- a content plan
function PlanTab({ w }: { w: SW }) {
  const { lang, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [weeks, setWeeks] = useState(4);
  const [focus, setFocus] = useState('');
  const run = useMutation({
    mutationFn: () => api<{ plan: { weeks: { title: string; posts: { day: string; channel: string; idea: string; ref: number }[] }[] }; items?: { ref: number; title: string }[] }>('/v1/studio/plan', { body: { weeks, focus, lang: lang === 'en' ? 'en' : 'ar' } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio'] }), onError: (e) => toast(errOf(w, errorText)(e), 'bad'),
  });
  return (
    <div className="st-grid">
      <section className="panel st-form">
        <h3>{w.weeks}</h3>
        <div className="seg w-fit">{[1, 2, 3, 4].map((n) => <button key={n} aria-pressed={weeks === n} onClick={() => setWeeks(n)}>{n}</button>)}</div>
        <label className="field">{w.focus}<input className="input" value={focus} maxLength={300} placeholder={w.focusPh} onChange={(e) => setFocus(e.target.value)} /></label>
        <button className="btn btn-accent justify-center" disabled={run.isPending} onClick={() => run.mutate()}><Icon n="calendar" />{run.isPending ? w.writing : w.makePlan}</button>
      </section>
      <section className="st-out">
        {run.isPending ? <div className="panel st-wait"><span className="st-dots"><i /><i /><i /></span>{w.writing}</div>
          : run.data ? <div className="st-weeks">{run.data.plan.weeks.map((wk, i) => (
            <article key={i} className="panel st-week" style={{ ['--i' as string]: i }}>
              <b>{wk.title}</b>
              <ul>{wk.posts.map((p, j) => <li key={j}><span className="st-day">{p.day}</span><span className="st-ch">{w.channelNames[p.channel as Channel] ?? p.channel}</span><p>{p.idea}{p.ref ? <small> · {w.shop ? run.data!.items?.find((x) => x.ref === p.ref)?.title ?? `#${p.ref}` : `#${p.ref}`}</small> : null}</p></li>)}</ul>
            </article>))}</div>
          : <div className="panel st-empty"><Icon n="calendar" /><p>{w.planEmpty}</p></div>}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- post images
function ImagesTab({ w }: { w: SW }) {
  const { lang, toast, errorText } = useApp();
  const qc = useQueryClient();
  const list = useListings(w.shop);
  const [propertyId, setPropertyId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photo');
  const [made, setMade] = useState<{ id: string; url: string }[]>([]);
  const run = useMutation({
    mutationFn: () => api<{ file: { id: string; url: string } }>('/v1/studio/image', { body: { propertyId: propertyId || undefined, prompt, style } }),
    onSuccess: (r) => { setMade((m) => [r.file, ...m]); void qc.invalidateQueries({ queryKey: ['studio'] }); }, onError: (e) => toast(errOf(w, errorText)(e), 'bad'),
  });
  return (
    <div className="st-grid">
      <section className="panel st-form">
        <label className="field">{w.forListing}<select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">{w.noListing}</option>
          {list.data?.properties.map((p) => <option key={p.id} value={p.id}>{w.shop ? p.title : `#${p.ref} · ${(lang === 'en' && p.titleEn) || p.title}`}</option>)}
        </select></label>
        <label className="field">{w.describe}<textarea className="input" rows={3} value={prompt} maxLength={600} placeholder={w.describePh} onChange={(e) => setPrompt(e.target.value)} /></label>
        <h3>{w.style}</h3>
        <div className="st-chips">{w.styles.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={style === k} onClick={() => setStyle(k)}>{l}</button>)}</div>
        <button className="btn btn-accent justify-center" disabled={(!prompt.trim() && !propertyId) || run.isPending} onClick={() => run.mutate()}><Icon n="image" />{run.isPending ? w.drawing : w.draw}</button>
        <p className="sub">{w.imageNote}</p>
      </section>
      <section className="st-out">
        {run.isPending && <div className="panel st-wait"><span className="st-dots"><i /><i /><i /></span>{w.drawing}</div>}
        {made.length ? <div className="st-images">{made.map((f) => <a key={f.id} href={f.url} target="_blank" rel="noopener" download className="st-img"><img src={f.url} alt="" /><span><Icon n="download" />{w.download}</span></a>)}</div>
          : !run.isPending && <div className="panel st-empty"><Icon n="image" /><p>{w.imagesEmpty}</p></div>}
      </section>
    </div>
  );
}
