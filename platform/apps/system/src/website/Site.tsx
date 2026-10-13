// The Website add-on: turn a business's site on, shape its look and words, give it an address, publish it, and manage
// its pages. Hemlo stays the source of truth — a site renders Hemlo's data, it never copies it. The full structured
// section editor comes next; here a page carries its title, address and kind.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHtml } from '../lib/api';
import { Empty, Icon, Sheet } from '../components/ui';
import { go } from '../lib/app';
import { HwBadge, SAMPLE_SITE } from '../components/HwBadge';
import { useW } from './i18n';
import { useSite, type Dashboard, type Site as SiteT, type Two, type WebPage, type WebSection, type WebSettings, type WebTheme } from './data';

const t2 = (x: Two | undefined, l: 'ar' | 'en') => x?.[l] ?? '';
const L = (l: 'ar' | 'en') => (l === 'ar' ? 'العربية' : 'English');

export function Site() {
  const { w, toast, err, lang, money } = useW();
  const q = useSite();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['web-site'] });
  const enable = useMutation({ mutationFn: () => api('/v1/web/site/enable', { body: {} }), onSuccess: () => { toast(w.saved); refresh(); }, onError: (e) => toast(err(e), 'bad') });

  if (q.isLoading) return <div className="grid gap-4"><div className="skeleton h-24" /><div className="skeleton h-64" /></div>;
  if (!q.data) return <Empty icon="globe" text={err(q.error)} />;
  const { site, offer, entitlement, request } = q.data;
  const addCopy = lang === 'en' ? {
    intro: 'Extend your Hemlo Real Estate workspace', body: 'Create your own branded business website, connected directly to your Hemlo workspace.',
    price: 'Hemlo Website', unconfigured: 'Price is being configured. Activation is not available yet.', pending: 'Your activation request is waiting for Hemlo to confirm it.',
    activate: 'Request activation', plan: 'View add-ons and pricing', paused: 'Website access is inactive. Review the add-on in billing to reactivate it.',
  } : {
    intro: 'وسّع مساحة عمل Hemlo Real Estate', body: 'أنشئ موقعاً تجارياً بعلامتك، متصلاً مباشرة بمساحة عمل Hemlo.',
    price: 'Hemlo Website', unconfigured: 'السعر قيد الإعداد، والتفعيل غير متاح بعد.', pending: 'طلب التفعيل ينتظر تأكيد Hemlo.',
    activate: 'اطلب التفعيل', plan: 'عرض الإضافات والأسعار', paused: 'الوصول إلى الموقع غير نشط. راجع الإضافة في الفوترة لإعادة تفعيلها.',
  };

  if (!site && !entitlement?.active) return (
    <div className="web-wrap">
      <div className="panel web-off">
        <HwBadge />
        <h2>{addCopy.intro}</h2>
        <p>{offer?.description?.[lang === 'en' ? 'en' : 'ar'] || addCopy.body}</p>
        <div className="grid max-w-md gap-2 rounded-xl bg-[var(--surface)] p-4 text-start">
          <b>{addCopy.price}</b>
          {offer?.configured ? <span>{money(offer.priceMonth)} / {lang === 'en' ? 'month' : 'شهرياً'} · {money(offer.priceYear)} / {lang === 'en' ? 'year' : 'سنوياً'}</span>
            : <span className="sub">{addCopy.unconfigured}</span>}
          {request && <span className="pill warn"><Icon n="clock" className="h-4 w-4" />{addCopy.pending}</span>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-accent" onClick={() => go('/plan')}><Icon n="sparkle" />{addCopy.plan}</button>
          <a className="btn btn-secondary" href={SAMPLE_SITE(lang)} target="_blank" rel="noopener">{lang === 'en' ? 'See a sample site' : lang === 'ckb' ? 'ماڵپەڕێکی نموونە ببینە' : 'شاهد موقعاً نموذجياً'}</a>
        </div>
      </div>
    </div>
  );

  if (site && !entitlement?.active) return <div className="web-wrap"><div className="panel web-off"><span className="art"><Icon n="globe" /></span><h2>{w.off.head}</h2><p>{addCopy.paused}</p><button className="btn btn-accent" onClick={() => go('/plan')}>{addCopy.plan}</button></div></div>;

  if (!site) return (
    <div className="web-wrap">
      <div className="panel web-off">
        <span className="art"><Icon n="globe" /></span>
        <h2>{w.off.head}</h2><p>{w.off.body}</p>
        <button className="btn btn-accent" disabled={enable.isPending} onClick={() => enable.mutate()}>
          <Icon n="sparkle" />{enable.isPending ? w.off.working : w.off.cta}
        </button>
      </div>
    </div>
  );

  return <Studio data={q.data} site={site} />;
}

// ---------------------------------------------------------------------------------------------------------------
// The studio: what you change on the left is saved as you type and shows up in the real site on the right, drawn by
// the same renderer visitors get (your draft, until you publish). No save buttons, no page reloads.

type Patch = Partial<Pick<SiteT, 'name' | 'tagline' | 'about' | 'lang' | 'theme' | 'settings'>>;
type Tab = 'design' | 'words' | 'contact' | 'address' | 'pages';
const SWATCHES = ['#1F6F5C', '#2F4A3A', '#0F766E', '#24507A', '#0E1420', '#6E4A86', '#9A3B26', '#B38B3A'];

const studioCopy = (lang: string) => lang === 'en' ? {
  tabs: { design: 'Design', words: 'Words', contact: 'Contact', address: 'Address', pages: 'Pages' } as Record<Tab, string>,
  saving: 'Saving…', saved: 'Saved', draft: 'Unpublished changes', live: 'Live', notLive: 'Not published yet', open: 'Open site', copy: 'Copy link', copied: 'Link copied',
  desktop: 'Computer', phone: 'Phone', previewTitle: 'Your site, as visitors see it', previewDraft: 'Preview of your changes', preview: 'Preview', close: 'Close',
  color: 'Colour', custom: 'Your own', mode: 'Appearance', light: 'Light', darkMode: 'Dark', presets: 'Style',
  wordsHint: 'Your name, a line about you, and a short story. Both languages show on the site.',
  contactHint: 'How visitors reach you. WhatsApp is the button people press most.', buttons: 'Buttons on the site',
  addressHint: 'Letters, numbers and hyphens. Your site moves to the new address as soon as you save it.', saveAddress: 'Save address',
  firstLang: 'First language', home: 'Home', properties: 'Properties', about: 'About', contactPage: 'Contact', unpublish: 'Take offline',
  demo: 'Demo preview', demoNote: 'In the demo your site stays a preview. On your own account, Publish puts it live at your own address.',
} : {
  tabs: { design: 'التصميم', words: 'النصوص', contact: 'التواصل', address: 'العنوان', pages: 'الصفحات' } as Record<Tab, string>,
  saving: 'يُحفظ…', saved: 'محفوظ', draft: 'تعديلات لم تُنشر', live: 'منشور', notLive: 'لم يُنشر بعد', open: 'افتح الموقع', copy: 'انسخ الرابط', copied: 'نُسخ الرابط',
  desktop: 'حاسبة', phone: 'موبايل', previewTitle: 'موقعك كما يراه الزوار', previewDraft: 'معاينة تعديلاتك', preview: 'معاينة', close: 'إغلاق',
  color: 'اللون', custom: 'لون آخر', mode: 'المظهر', light: 'فاتح', darkMode: 'داكن', presets: 'النمط',
  wordsHint: 'اسمك، وسطر عنك، ونبذة قصيرة. تظهر اللغتان في الموقع.',
  contactHint: 'كيف يصل إليك الزوار. واتساب هو الزر الأكثر استخداماً.', buttons: 'الأزرار في الموقع',
  addressHint: 'أحرف إنجليزية وأرقام وشرطات. ينتقل موقعك إلى العنوان الجديد فور حفظه.', saveAddress: 'احفظ العنوان',
  firstLang: 'اللغة الأولى', home: 'الرئيسية', properties: 'العقارات', about: 'من نحن', contactPage: 'تواصل', unpublish: 'أوقف النشر',
  demo: 'معاينة تجريبية', demoNote: 'في النسخة التجريبية يبقى موقعك معاينة. في حسابك الحقيقي، زر النشر يضعه على عنوانك الخاص.',
};

/** Changes go out a moment after you stop typing, merged into one request; the cached dashboard is patched in place. */
function useAutosave() {
  const qc = useQueryClient();
  const { toast, err } = useW();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [version, setVersion] = useState(0);
  const pending = useRef<Patch>({});
  const timer = useRef<number | undefined>(undefined);
  const flush = async () => {
    window.clearTimeout(timer.current);
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    setState('saving');
    try {
      const r = await api<{ site: SiteT; url: string | null }>('/v1/web/site', { method: 'PUT', body });
      qc.setQueryData<Dashboard>(['web-site'], (d) => d && ({ ...d, site: { ...d.site!, ...r.site }, url: r.url ?? d.url, hasUnpublishedChanges: d.site?.status === 'published' ? true : d.hasUnpublishedChanges }));
      setState('saved');
      setVersion((v) => v + 1);
    } catch (e) { setState('idle'); toast(err(e), 'bad'); }
  };
  const queue = (patch: Patch) => { Object.assign(pending.current, patch); setState('saving'); window.clearTimeout(timer.current); timer.current = window.setTimeout(flush, 650); };
  useEffect(() => () => { void flush(); }, []); // leaving the page never loses the last keystrokes
  return { state, queue, flush, version, bump: () => setVersion((v) => v + 1) };
}

/** Wide enough to keep the preview beside the editor (the same breakpoint as the CSS); a phone opens it on demand. */
function useWide() {
  const q = '(min-width: 1100px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q), on = () => setWide(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return wide;
}

function Studio({ data, site }: { data: Dashboard; site: SiteT }) {
  const { w, toast, err, lang, sys } = useW();
  const S = studioCopy(lang);
  const demo = !!sys.business.demo;
  const qc = useQueryClient();
  const save = useAutosave();
  const [tab, setTab] = useState<Tab>('design');
  const [draft, setDraft] = useState<Patch>(() => ({ name: site.name ?? {}, tagline: site.tagline ?? {}, about: site.about ?? {}, lang: site.lang, theme: site.theme ?? {}, settings: site.settings ?? {} }));
  const [sheet, setSheet] = useState(false);
  const wide = useWide();
  const change = (patch: Patch) => { setDraft((d) => ({ ...d, ...patch })); save.queue(patch); };
  const live = site.status === 'published';
  const setDash = (f: (d: Dashboard) => Dashboard) => qc.setQueryData<Dashboard>(['web-site'], (d) => d && f(d));
  const publish = useMutation({
    mutationFn: async () => { await save.flush(); return api<{ site: SiteT; url: string | null }>('/v1/web/site/publish', { body: {} }); },
    onSuccess: (r) => { setDash((d) => ({ ...d, site: { ...d.site!, ...r.site }, url: r.url ?? d.url, hasUnpublishedChanges: false })); toast(w.published); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const unpublish = useMutation({
    mutationFn: () => api<{ site: SiteT }>('/v1/web/site/unpublish', { body: {} }),
    onSuccess: (r) => { setDash((d) => ({ ...d, site: { ...d.site!, ...r.site } })); toast(w.unpublished); }, onError: (e) => toast(err(e), 'bad'),
  });
  const copy = async () => { if (!data.url) return; try { await navigator.clipboard.writeText(data.url); toast(S.copied); } catch { /* the link is on screen */ } };
  const status = save.state === 'saving' ? <span className="ws-save"><i className="spin" />{S.saving}</span>
    : live && data.hasUnpublishedChanges ? <span className="ws-save warn"><i />{S.draft}</span>
    : save.state === 'saved' ? <span className="ws-save ok"><Icon n="check" />{S.saved}</span> : null;
  const focus = tab === 'contact' ? '#contact' : tab === 'words' || tab === 'design' ? 'top' : null;
  return (
    <div className="ws">
      <header className="ws-bar panel">
        <div className="ws-bar-l">
          <HwBadge />
          {demo ? <span className="web-pill" title={S.demoNote}><i />{S.demo}</span> : <span className={`web-pill ${live ? 'ok' : 'warn'}`}><i />{live ? S.live : S.notLive}</span>}
          {data.url && !demo && <a className="ws-url" href={data.url} target="_blank" rel="noopener" dir="ltr">{data.url.replace(/^https:\/\//, '')}</a>}
          {data.url && !demo && <button className="btn btn-ghost btn-sm" onClick={copy} aria-label={S.copy}><Icon n="clip" /></button>}
        </div>
        <div className="ws-bar-r">
          {status}
          {live && data.url && <a className="btn btn-secondary btn-sm" href={data.url} target="_blank" rel="noopener"><Icon n="globe" />{S.open}</a>}
          {demo ? <span className="sub ws-demo-note">{S.demoNote}</span> : (!live || data.hasUnpublishedChanges) && <button className="btn btn-accent btn-sm" disabled={publish.isPending} onClick={() => publish.mutate()}><Icon n="sparkle" />{publish.isPending ? w.publishing : live ? w.publishChanges : w.publish}</button>}
          {live && <button className="btn btn-ghost btn-sm" disabled={unpublish.isPending} onClick={() => unpublish.mutate()}>{S.unpublish}</button>}
        </div>
      </header>

      <div className="ws-main">
        <section className="ws-edit panel">
          <nav className="ws-tabs" role="tablist">
            {(Object.keys(S.tabs) as Tab[]).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{S.tabs[k]}</button>)}
          </nav>
          <div className="ws-pane" key={tab}>
            {tab === 'design' && <DesignTab draft={draft} change={change} vertical={data.vertical} presets={data.themes} S={S} />}
            {tab === 'words' && <WordsTab draft={draft} change={change} S={S} />}
            {tab === 'contact' && <ContactTab draft={draft} change={change} S={S} />}
            {tab === 'address' && <AddressTab site={site} url={data.url} S={S} onSaved={(r) => { setDash((d) => ({ ...d, site: { ...d.site!, ...r.site }, url: r.url ?? d.url })); save.bump(); }} />}
            {tab === 'pages' && <Pages pages={data.pages} kinds={data.pageKinds} sectionTypes={data.sectionTypes} onChanged={() => { void qc.invalidateQueries({ queryKey: ['web-site'] }); save.bump(); }} />}
          </div>
        </section>
        {wide && <section className="ws-view"><Preview version={save.version} focus={focus} S={S} /></section>}
      </div>
      {!wide && <button className="ws-fab btn btn-accent" onClick={() => setSheet(true)}><Icon n="globe" />{S.preview}</button>}
      {sheet && !wide && createPortal(<div className="ws-sheet"><div className="ws-sheet-h"><b>{S.previewDraft}</b><button className="btn btn-secondary btn-sm" onClick={() => setSheet(false)}>{S.close}</button></div><Preview version={save.version} focus={focus} S={S} phoneOnly /></div>, document.body)}
    </div>
  );
}

type SCopy = ReturnType<typeof studioCopy>;
type TabProps = { draft: Patch; change(p: Patch): void; S: SCopy };

function DesignTab({ draft, change, vertical, presets, S }: TabProps & { vertical: string; presets: string[] }) {
  const { w } = useW();
  const theme = draft.theme ?? {};
  const accent = (theme.accent ?? SWATCHES[0]).toLowerCase();
  const set = (p: Partial<WebTheme>) => change({ theme: { ...theme, ...p } });
  return (
    <div className="ws-form">
      <div className="field">{S.color}
        <div className="ws-swatches">
          {SWATCHES.map((c) => <button key={c} className="ws-sw" style={{ background: c }} aria-pressed={accent === c.toLowerCase()} aria-label={c} onClick={() => set({ accent: c.toLowerCase() })}><Icon n="check" /></button>)}
          <label className="ws-sw custom" aria-pressed={!SWATCHES.some((c) => c.toLowerCase() === accent)} title={S.custom} style={{ background: accent }}>
            <input type="color" value={accent} onChange={(e) => set({ accent: e.target.value })} /><Icon n="pen" />
          </label>
        </div>
      </div>
      <div className="field">{S.mode}
        <div className="seg w-fit">{([false, true] as const).map((d) => <button key={String(d)} aria-pressed={!!theme.dark === d} onClick={() => set({ dark: d })}>{d ? S.darkMode : S.light}</button>)}</div>
      </div>
      {vertical !== 'realestate' && <>
        <div className="field">{S.presets}
          <div className="web-themes">{presets.map((p) => <button key={p} className="web-swatch" aria-pressed={(theme.preset ?? 'classic') === p} onClick={() => set({ preset: p })}><span className="art"><i /><i className="b" /><i className="b" /></span><b>{w.themes[p] ?? p}</b></button>)}</div>
        </div>
        <div className="field">{w.radius}<div className="seg w-fit">{(['sm', 'md', 'lg'] as const).map((r) => <button key={r} aria-pressed={(theme.radius ?? 'md') === r} onClick={() => set({ radius: r })}>{r.toUpperCase()}</button>)}</div></div>
      </>}
    </div>
  );
}

function WordsTab({ draft, change, S }: TabProps) {
  const { w } = useW();
  const two = (k: 'name' | 'tagline' | 'about', l: 'ar' | 'en', v: string) => change({ [k]: { ...(draft[k] ?? {}), [l]: v } } as Patch);
  return (
    <div className="ws-form">
      <p className="sub">{S.wordsHint}</p>
      {(['ar', 'en'] as const).map((l) => (
        <fieldset key={l} className="ws-lang">
          <legend>{L(l)}</legend>
          <label className="field">{w.name}<input className="input" dir={l === 'ar' ? 'rtl' : 'ltr'} value={t2(draft.name, l)} onChange={(e) => two('name', l, e.target.value)} /></label>
          <label className="field">{w.tagline}<input className="input" dir={l === 'ar' ? 'rtl' : 'ltr'} value={t2(draft.tagline, l)} onChange={(e) => two('tagline', l, e.target.value)} /></label>
          <label className="field">{w.about}<textarea className="input" rows={4} dir={l === 'ar' ? 'rtl' : 'ltr'} value={t2(draft.about, l)} onChange={(e) => two('about', l, e.target.value)} /></label>
        </fieldset>
      ))}
      <div className="field">{S.firstLang}<div className="seg w-fit">{(['ar', 'en'] as const).map((l) => <button key={l} aria-pressed={draft.lang === l} onClick={() => change({ lang: l })}>{w.langName[l]}</button>)}</div></div>
    </div>
  );
}

function ContactTab({ draft, change, S }: TabProps) {
  const { w } = useW();
  const s = draft.settings ?? {}, c = s.contact ?? {}, so = s.social ?? {}, cta = s.cta ?? {};
  const setC = (k: string, v: string) => change({ settings: { ...s, contact: { ...c, [k]: v } } });
  const setSo = (k: string, v: string) => change({ settings: { ...s, social: { ...so, [k]: v } } });
  const setCta = (k: keyof NonNullable<WebSettings['cta']>, v: boolean) => change({ settings: { ...s, cta: { ...cta, [k]: v } } });
  const field = (k: string, label: string, ltr = true) => <label className="field">{label}<input className="input" dir={ltr ? 'ltr' : undefined} value={(c as any)[k] ?? ''} onChange={(e) => setC(k, e.target.value)} /></label>;
  return (
    <div className="ws-form">
      <p className="sub">{S.contactHint}</p>
      <div className="web-row2">{field('whatsapp', w.whatsapp)}{field('phone', w.phone)}</div>
      <div className="web-row2">{field('email', w.email)}{field('address', w.address, false)}</div>
      {field('mapUrl', w.mapUrl)}
      <div className="field">{S.buttons}
        <div className="ws-toggles">
          {([['whatsapp', w.actionWa], ['phone', w.actionPhone], ['inquiry', w.actionInquiry]] as const).map(([k, label]) => (
            <label key={k} className="ws-toggle"><span>{label}</span><input type="checkbox" role="switch" checked={cta[k] !== false} onChange={(e) => setCta(k, e.target.checked)} /><i aria-hidden="true" /></label>
          ))}
        </div>
      </div>
      <div className="field">{w.social}
        <div className="web-row2">
          {(['instagram', 'facebook', 'tiktok', 'youtube'] as const).map((k) => <label key={k} className="field">{w[k]}<input className="input" dir="ltr" value={so[k] ?? ''} onChange={(e) => setSo(k, e.target.value)} /></label>)}
        </div>
      </div>
    </div>
  );
}

function AddressTab({ site, url, S, onSaved }: { site: SiteT; url: string | null; S: SCopy; onSaved(r: { site: SiteT; url: string | null }): void }) {
  const { w, toast, err } = useW();
  const [sub, setSub] = useState(site.subdomain ?? '');
  const clean = sub.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.hemlohq\.com$/, '');
  const save = useMutation({ mutationFn: () => api<{ site: SiteT; url: string | null }>('/v1/web/site', { method: 'PUT', body: { subdomain: clean } }), onSuccess: (r) => { toast(w.saved); onSaved(r); }, onError: (e) => toast(err(e), 'bad') });
  const changed = clean !== (site.subdomain ?? '');
  return (
    <form className="ws-form" onSubmit={(e) => { e.preventDefault(); if (changed) save.mutate(); }}>
      <p className="sub">{S.addressHint}</p>
      <div className="ws-addr" dir="ltr"><span>https://</span><input className="input" value={sub} placeholder="agency" autoCapitalize="off" spellCheck={false} onChange={(e) => setSub(e.target.value.replace(/^https?:\/\//i, '').replace(/\.hemlohq\.com\/?$/i, ''))} /><span>.hemlohq.com</span></div>
      <button className="btn btn-accent w-fit" type="submit" disabled={!changed || save.isPending}>{S.saveAddress}</button>
      {url && <div className="web-url"><Icon n="globe" /><a href={url} target="_blank" rel="noopener" dir="ltr">{url}</a></div>}
    </form>
  );
}

/** The real site, in a frame: computer or phone, Arabic or English, any page. Reloads (keeping its scroll) on every save. */
function Preview({ version, focus, S, phoneOnly = false }: { version: number; focus: string | null; S: SCopy; phoneOnly?: boolean }) {
  const [device, setDevice] = useState<'desktop' | 'phone'>(phoneOnly ? 'phone' : 'desktop');
  const [plang, setPlang] = useState<'ar' | 'en'>('ar');
  const [page, setPage] = useState('');
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(800);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const y = useRef(0);
  useEffect(() => {
    const on = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && typeof e.data?.hemloY === 'number') y.current = e.data.hemloY; };
    window.addEventListener('message', on); return () => window.removeEventListener('message', on);
  }, []);
  useEffect(() => { if (!box.current) return; const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width)); ro.observe(box.current); return () => ro.disconnect(); }, []);
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    const t = window.setTimeout(() => {
      apiHtml(`/v1/web/pub/_hemlo/preview?page=${encodeURIComponent(page)}&lang=${plang}`, ctl.signal)
        .then((h) => setHtml(h.replace('</body>', `<script>addEventListener('load',function(){scrollTo(0,${Math.round(y.current)})});addEventListener('scroll',function(){parent.postMessage({hemloY:scrollY},'*')},{passive:true});addEventListener('message',function(e){var s=e.data&&e.data.hemloGo;if(!s)return;if(s==='top')scrollTo({top:0,behavior:'smooth'});else{var el=document.querySelector(s);if(el)scrollTo({top:el.getBoundingClientRect().top+scrollY-80,behavior:'smooth'})}})</script></body>`)))
        .catch(() => {}).finally(() => setLoading(false));
    }, 120);
    return () => { ctl.abort(); window.clearTimeout(t); };
  }, [version, plang, page]);
  useEffect(() => { if (focus) frame.current?.contentWindow?.postMessage({ hemloGo: focus }, '*'); }, [focus]);
  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => { const on = () => setVh(window.innerHeight); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  // a computer is drawn 1280 wide and as tall as the screen allows; a phone is a real 390×844 phone, shrunk only to fit
  const room = Math.max(420, vh - (phoneOnly ? 130 : 230));
  const W = device === 'desktop' ? 1280 : 390, fit = Math.max(width, 200), scale = device === 'desktop' ? Math.min(1, fit / W) : Math.min(1, fit / W, room / 844);
  const H = device === 'desktop' ? Math.round(room / scale) : 844;
  const pages: [string, string][] = [['', S.home], ['properties', S.properties], ['about', S.about], ['contact', S.contactPage]];
  return (
    <div className="ws-prev">
      <div className="ws-prev-bar">
        <select className="input ws-page" value={page} onChange={(e) => { y.current = 0; setPage(e.target.value); }}>{pages.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select>
        <div className="seg ws-mini">{(['ar', 'en'] as const).map((l) => <button key={l} aria-pressed={plang === l} onClick={() => setPlang(l)}>{l === 'ar' ? 'ع' : 'EN'}</button>)}</div>
        {!phoneOnly && <div className="seg ws-mini">{(['desktop', 'phone'] as const).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === 'desktop' ? S.desktop : S.phone}</button>)}</div>}
      </div>
      <div className={`ws-stage ${device}`} ref={box}>
        <div className="ws-frame" style={{ width: W * scale, height: H * scale }}>
          {html && <iframe ref={frame} title={S.previewTitle} sandbox="allow-scripts" srcDoc={html} style={{ width: W, height: H, transform: `scale(${scale})` }} />}
          <div className={`ws-loading ${loading ? 'on' : ''}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

const Sec = ({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) => (
  <div className="web-sec"><h2>{title}</h2>{action}</div>
);

function Pages({ pages, kinds, sectionTypes, onChanged }: { pages: WebPage[]; kinds: string[]; sectionTypes: string[]; onChanged(): void }) {
  const { w } = useW();
  const [edit, setEdit] = useState<WebPage | 'new' | null>(null);
  const count = (p: WebPage) => (p.sections?.length === 1 ? w.sectionsOne : p.sections?.length ? w.sections.replace('{n}', String(p.sections.length)) : w.noSections);
  return (
    <>
      <Sec title={w.pages} action={<button onClick={() => setEdit('new')}><Icon n="plus" className="inline" /> {w.addPage}</button>} />
      <div className="panel web-pages">
        {!pages.length && <div className="web-empty">{w.emptyPages}</div>}
        {pages.map((p) => (
          <button key={p.id} className="web-page" onClick={() => setEdit(p)}>
            <span className="ic"><Icon n={p.kind === 'home' ? 'home' : p.kind === 'contact' ? 'phone' : p.kind === 'listings' ? 'store' : p.kind === 'services' ? 'sparkle' : 'pen'} /></span>
            <span className="sp">
              <b>{p.slug === '' ? w.kinds.home : (p.title?.ar || p.title?.en || '/ ' + p.slug)}</b>
              <span className="sub">/{p.slug} · {count(p)}</span>
            </span>
            <span className="web-kind">{w.kinds[p.kind] ?? p.kind}</span>
          </button>
        ))}
      </div>
      {edit && <PageEditor page={edit === 'new' ? null : edit} kinds={kinds} sectionTypes={sectionTypes} onClose={() => setEdit(null)} onChanged={onChanged} />}
    </>
  );
}

function PageEditor({ page, kinds, sectionTypes, onClose, onChanged }: { page: WebPage | null; kinds: string[]; sectionTypes: string[]; onClose(): void; onChanged(): void }) {
  const { w, toast, err } = useW();
  const isHome = page?.slug === '';
  const [title, setTitle] = useState<Two>(page?.title ?? {});
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [kind, setKind] = useState(page?.kind ?? 'custom');
  const [sections, setSections] = useState<WebSection[]>(page?.sections ?? []);
  const [seo, setSeo] = useState(page?.seo ?? {});
  const changeSection = (index: number, patch: Partial<WebSection>) => setSections((all) => all.map((section, i) => i === index ? { ...section, ...patch } : section));
  const save = useMutation({
    mutationFn: () => (page ? api(`/v1/web/pages/${page.id}`, { method: 'PUT', body: { title, slug, kind, sections, seo } }) : api('/v1/web/pages', { body: { title, slug, kind, sections, seo } })),
    onSuccess: () => { toast(w.saved); onChanged(); onClose(); }, onError: (e) => toast(err(e), 'bad'),
  });
  const del = useMutation({ mutationFn: () => api(`/v1/web/pages/${page!.id}`, { method: 'DELETE', body: {} }), onSuccess: () => { toast(w.saved); onChanged(); onClose(); }, onError: (e) => toast(err(e), 'bad') });
  return (
    <Sheet title={page ? (isHome ? w.kinds.home : w.edit) : w.addPage} onClose={onClose}
      footer={<div className="flex w-full gap-2">
        {page && !isHome && <button className="btn btn-secondary" disabled={del.isPending} onClick={() => { if (confirm(w.removeQ)) del.mutate(); }}><Icon n="trash" /></button>}
        <button className="btn btn-accent flex-1 justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{w.save}</button>
      </div>}>
      <div className="web-row2">
        {(['ar', 'en'] as const).map((l) => <label key={l} className="field">{L(l)} · {w.pageTitle}<input className="input" dir={l === 'ar' ? 'rtl' : 'ltr'} value={t2(title, l)} onChange={(e) => setTitle({ ...title, [l]: e.target.value })} /></label>)}
      </div>
      {!isHome && <label className="field">{w.slug}<input className="input" dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} /><small className="sub">{w.slugHint}</small></label>}
      <div className="field">{w.pageKind}
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{w.kinds[k] ?? k}</button>)}
        </div>
      </div>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3"><b>{w.content}</b><button className="btn btn-secondary btn-sm" type="button" disabled={sections.length >= 40} onClick={() => setSections((all) => [...all, { id: crypto.randomUUID(), type: 'about', title: {}, text: {} }])}><Icon n="plus" />{w.addSection}</button></div>
        {!sections.length && <p className="sub">{w.noSections}</p>}
        {sections.map((section, i) => {
          const titleValue = (section.title && typeof section.title === 'object' ? section.title : {}) as Two;
          const textValue = (section.text && typeof section.text === 'object' ? section.text : {}) as Two;
          const textEnabled = ['hero', 'about', 'cta'].includes(section.type);
          return <section key={section.id ?? i} className="panel grid gap-3 p-3">
            <div className="flex items-center justify-between gap-3"><b>{w.content} {i + 1}</b><button type="button" className="btn btn-ghost btn-sm" aria-label={w.removeSection} onClick={() => setSections((all) => all.filter((_, ix) => ix !== i))}><Icon n="trash" /></button></div>
            <label className="field">{w.sectionType}<select className="input" value={section.type} onChange={(e) => changeSection(i, { type: e.target.value })}>{sectionTypes.map((type) => <option key={type} value={type}>{w.kinds[type] ?? type}</option>)}</select></label>
            {(['ar', 'en'] as const).map((l) => <label key={l} className="field">{L(l)} · {w.sectionTitle}<input className="input" dir={l === 'ar' ? 'rtl' : 'ltr'} value={titleValue[l] ?? ''} onChange={(e) => changeSection(i, { title: { ...titleValue, [l]: e.target.value } })} /></label>)}
            {textEnabled && (['ar', 'en'] as const).map((l) => <label key={l} className="field">{L(l)} · {w.sectionText}<textarea className="input" rows={3} dir={l === 'ar' ? 'rtl' : 'ltr'} value={textValue[l] ?? ''} onChange={(e) => changeSection(i, { text: { ...textValue, [l]: e.target.value } })} /></label>)}
          </section>;
        })}
      </div>
      <div className="grid gap-3">
        <b>{w.seo}</b>
        {(['ar', 'en'] as const).map((l) => <div key={l} className="grid gap-2 rounded-xl bg-[var(--surface)] p-3">
          <label className="field">{L(l)} · {w.seoTitle}<input className="input" dir={l === 'ar' ? 'rtl' : 'ltr'} maxLength={120} value={seo.title?.[l] ?? ''} onChange={(e) => setSeo({ ...seo, title: { ...seo.title, [l]: e.target.value } })} /></label>
          <label className="field">{L(l)} · {w.seoDescription}<textarea className="input" rows={2} dir={l === 'ar' ? 'rtl' : 'ltr'} maxLength={300} value={seo.description?.[l] ?? ''} onChange={(e) => setSeo({ ...seo, description: { ...seo.description, [l]: e.target.value } })} /></label>
        </div>)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!seo.noindex} onChange={(e) => setSeo({ ...seo, noindex: e.target.checked })} />{w.noindex}</label>
      </div>
    </Sheet>
  );
}
