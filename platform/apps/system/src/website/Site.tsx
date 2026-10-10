// The Website add-on: turn a business's site on, shape its look and words, give it an address, publish it, and manage
// its pages. Hemlo stays the source of truth — a site renders Hemlo's data, it never copies it. The full structured
// section editor comes next; here a page carries its title, address and kind.
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Empty, Icon, Sheet } from '../components/ui';
import { go } from '../lib/app';
import { HwBadge, SAMPLE_SITE } from '../components/HwBadge';
import { useW } from './i18n';
import { useSite, type Site as SiteT, type Two, type WebPage, type WebSection, type WebSettings, type WebTheme } from './data';

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
  const { site, pages, url, themes, pageKinds, sectionTypes, offer, entitlement, request, hasUnpublishedChanges } = q.data;
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

  return (
    <div className="web-wrap grid gap-2">
      <Hero site={site} url={url} hasUnpublishedChanges={hasUnpublishedChanges} onChanged={refresh} />
      <Identity site={site} onSaved={refresh} />
      <Look site={site} presets={themes} onSaved={refresh} />
      <Contact site={site} onSaved={refresh} />
      <Address site={site} url={url} onSaved={refresh} />
      <Pages pages={pages} kinds={pageKinds} sectionTypes={sectionTypes} onChanged={refresh} />
    </div>
  );
}

const Sec = ({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) => (
  <div className="web-sec"><h2>{title}</h2>{action}</div>
);

function Hero({ site, url, hasUnpublishedChanges, onChanged }: { site: SiteT; url: string | null; hasUnpublishedChanges: boolean; onChanged(): void }) {
  const { w, toast, err } = useW();
  const publish = useMutation({ mutationFn: () => api('/v1/web/site/publish', { body: {} }), onSuccess: () => { toast(w.published); onChanged(); }, onError: (e) => toast(err(e), 'bad') });
  const unpublish = useMutation({ mutationFn: () => api('/v1/web/site/unpublish', { body: {} }), onSuccess: () => { toast(w.unpublished); onChanged(); }, onError: (e) => toast(err(e), 'bad') });
  const live = site.status === 'published';
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); toast(w.live.copied); } catch { toast(err('BAD_URL'), 'bad'); } };
  return (
    <div className="panel web-hero">
      <div className="web-hero-top">
        <span className={`web-pill ${live ? 'ok' : site.status === 'setup' ? 'warn' : ''}`}><i />{w.status[site.status]}</span>
        <h2>{live ? w.live.head : w.ready.head}</h2>
      </div>
      {live && hasUnpublishedChanges && <p className="note warn">{w.draftNotice}</p>}
      {live && url && <div className="web-url"><Icon n="globe" /><a href={url} target="_blank" rel="noopener">{url}</a></div>}
      {!live && <p className="sub">{w.ready.body}</p>}
      <div className="web-hero-acts">
        {live && url && <a className="btn btn-secondary" href={url} target="_blank" rel="noopener"><Icon n="globe" />{w.preview}</a>}
        {live && url && <button className="btn btn-secondary" onClick={copy}><Icon n="clip" />{w.live.copy}</button>}
        {(!live || hasUnpublishedChanges) && <button className="btn btn-accent" disabled={publish.isPending} onClick={() => publish.mutate()}><Icon n="sparkle" />{publish.isPending ? w.publishing : live ? w.publishChanges : w.publish}</button>}
        {live && <button className="btn btn-secondary" disabled={unpublish.isPending} onClick={() => unpublish.mutate()}>{w.unpublish}</button>}
      </div>
    </div>
  );
}

function Identity({ site, onSaved }: { site: SiteT; onSaved(): void }) {
  const { w, toast, err } = useW();
  const [name, setName] = useState<Two>(site.name ?? {});
  const [tagline, setTagline] = useState<Two>(site.tagline ?? {});
  const [about, setAbout] = useState<Two>(site.about ?? {});
  const [lang, setLang] = useState(site.lang);
  useEffect(() => { setName(site.name ?? {}); setTagline(site.tagline ?? {}); setAbout(site.about ?? {}); setLang(site.lang); }, [site]);
  const save = useMutation({ mutationFn: () => api('/v1/web/site', { method: 'PUT', body: { name, tagline, about, lang } }), onSuccess: () => { toast(w.saved); onSaved(); }, onError: (e) => toast(err(e), 'bad') });
  return (
    <>
      <Sec title={w.identity} />
      <div className="panel web-form">
        <div className="web-row2">
          {(['ar', 'en'] as const).map((l) => <label key={l} className="field">{L(l)} · {w.name}<input className="input" dir={l === 'ar' ? 'rtl' : 'ltr'} value={t2(name, l)} onChange={(e) => setName({ ...name, [l]: e.target.value })} /></label>)}
        </div>
        <div className="web-row2">
          {(['ar', 'en'] as const).map((l) => <label key={l} className="field">{L(l)} · {w.tagline}<input className="input" dir={l === 'ar' ? 'rtl' : 'ltr'} value={t2(tagline, l)} onChange={(e) => setTagline({ ...tagline, [l]: e.target.value })} /></label>)}
        </div>
        <label className="field">{w.about}<textarea className="input" rows={3} dir={lang === 'en' ? 'ltr' : 'rtl'} value={t2(about, lang === 'en' ? 'en' : 'ar')} onChange={(e) => setAbout({ ...about, [lang === 'en' ? 'en' : 'ar']: e.target.value })} /></label>
        <div className="field">{w.lang}<div className="seg w-fit">{(['ar', 'en'] as const).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{w.langName[l]}</button>)}</div></div>
        <button className="btn btn-accent w-fit" disabled={save.isPending} onClick={() => save.mutate()}>{w.save}</button>
      </div>
    </>
  );
}

function Look({ site, presets, onSaved }: { site: SiteT; presets: string[]; onSaved(): void }) {
  const { w, toast, err } = useW();
  const [theme, setTheme] = useState<WebTheme>(site.theme ?? {});
  useEffect(() => { setTheme(site.theme ?? {}); }, [site]);
  const save = useMutation({ mutationFn: () => api('/v1/web/site', { method: 'PUT', body: { theme } }), onSuccess: () => { toast(w.saved); onSaved(); }, onError: (e) => toast(err(e), 'bad') });
  return (
    <>
      <Sec title={w.look} />
      <div className="panel web-form">
        <div className="web-themes">
          {presets.map((p) => (
            <button key={p} className="web-swatch" aria-pressed={(theme.preset ?? 'classic') === p} onClick={() => setTheme({ ...theme, preset: p })}>
              <span className="art"><i /><i className="b" /><i className="b" /></span>
              <b>{w.themes[p] ?? p}</b>
            </button>
          ))}
        </div>
        <div className="web-row2">
          <label className="field">{w.accent}
            <span className="web-accent">
              <input type="color" value={theme.accent ?? '#1F6F5C'} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} />
              <input className="input" dir="ltr" value={theme.accent ?? ''} placeholder="#1F6F5C" onChange={(e) => setTheme({ ...theme, accent: e.target.value })} />
            </span>
          </label>
          <div className="field">{w.radius}<div className="seg">{(['sm', 'md', 'lg'] as const).map((r) => <button key={r} aria-pressed={(theme.radius ?? 'md') === r} onClick={() => setTheme({ ...theme, radius: r })}>{r.toUpperCase()}</button>)}</div></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!theme.dark} onChange={(e) => setTheme({ ...theme, dark: e.target.checked })} />{w.dark}</label>
        <button className="btn btn-accent w-fit" disabled={save.isPending} onClick={() => save.mutate()}>{w.save}</button>
      </div>
    </>
  );
}

function Contact({ site, onSaved }: { site: SiteT; onSaved(): void }) {
  const { w, toast, err } = useW();
  const [s, setS] = useState<WebSettings>(site.settings ?? {});
  useEffect(() => { setS(site.settings ?? {}); }, [site]);
  const c = s.contact ?? {}, so = s.social ?? {}, cta = s.cta ?? {};
  const setC = (k: string, v: string) => setS({ ...s, contact: { ...c, [k]: v } });
  const setSo = (k: string, v: string) => setS({ ...s, social: { ...so, [k]: v } });
  const save = useMutation({ mutationFn: () => api('/v1/web/site', { method: 'PUT', body: { settings: s } }), onSuccess: () => { toast(w.saved); onSaved(); }, onError: (e) => toast(err(e), 'bad') });
  return (
    <>
      <Sec title={w.contact} />
      <div className="panel web-form">
        <div className="web-row2">
          <label className="field">{w.phone}<input className="input" dir="ltr" value={c.phone ?? ''} onChange={(e) => setC('phone', e.target.value)} /></label>
          <label className="field">{w.whatsapp}<input className="input" dir="ltr" value={c.whatsapp ?? ''} onChange={(e) => setC('whatsapp', e.target.value)} /></label>
        </div>
        <div className="web-row2">
          <label className="field">{w.email}<input className="input" dir="ltr" value={c.email ?? ''} onChange={(e) => setC('email', e.target.value)} /></label>
          <label className="field">{w.address}<input className="input" value={c.address ?? ''} onChange={(e) => setC('address', e.target.value)} /></label>
        </div>
        <label className="field">{w.mapUrl}<input className="input" dir="ltr" value={c.mapUrl ?? ''} onChange={(e) => setC('mapUrl', e.target.value)} /></label>

        <div className="field">{w.actions}
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!cta.whatsapp} onChange={(e) => setS({ ...s, cta: { ...cta, whatsapp: e.target.checked } })} />{w.actionWa}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!cta.phone} onChange={(e) => setS({ ...s, cta: { ...cta, phone: e.target.checked } })} />{w.actionPhone}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!cta.inquiry} onChange={(e) => setS({ ...s, cta: { ...cta, inquiry: e.target.checked } })} />{w.actionInquiry}</label>
          </div>
        </div>

        <div className="web-sec" style={{ margin: 0 }}><h2>{w.social}</h2></div>
        <div className="web-row2">
          <label className="field">{w.instagram}<input className="input" dir="ltr" value={so.instagram ?? ''} onChange={(e) => setSo('instagram', e.target.value)} /></label>
          <label className="field">{w.facebook}<input className="input" dir="ltr" value={so.facebook ?? ''} onChange={(e) => setSo('facebook', e.target.value)} /></label>
          <label className="field">{w.tiktok}<input className="input" dir="ltr" value={so.tiktok ?? ''} onChange={(e) => setSo('tiktok', e.target.value)} /></label>
          <label className="field">{w.youtube}<input className="input" dir="ltr" value={so.youtube ?? ''} onChange={(e) => setSo('youtube', e.target.value)} /></label>
        </div>
        <button className="btn btn-accent w-fit" disabled={save.isPending} onClick={() => save.mutate()}>{w.save}</button>
      </div>
    </>
  );
}

function Address({ site, url, onSaved }: { site: SiteT; url: string | null; onSaved(): void }) {
  const { w, toast, err } = useW();
  const [sub, setSub] = useState(site.subdomain ?? '');
  useEffect(() => { setSub(site.subdomain ?? ''); }, [site]);
  const save = useMutation({ mutationFn: () => api('/v1/web/site', { method: 'PUT', body: { subdomain: sub.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.hemlohq\.com$/, '') } }), onSuccess: () => { toast(w.saved); onSaved(); }, onError: (e) => toast(err(e), 'bad') });
  return (
    <>
      <Sec title={w.addressSec} />
      <div className="panel web-form">
        <label className="field">{w.subdomain}
          <span className="web-url"><input className="input" dir="ltr" value={sub} placeholder="agency" onChange={(e) => setSub(e.target.value.replace(/^https?:\/\//i, '').replace(/\.hemlohq\.com\/?$/i, ''))} /><span className="sub">.hemlohq.com</span></span>
          <small className="sub">{w.subdomainHint}</small>
        </label>
        {site.status === 'published' && url && <div className="web-url"><Icon n="globe" /><a href={url} target="_blank" rel="noopener">{url}</a></div>}
        <button className="btn btn-accent w-fit" disabled={save.isPending} onClick={() => save.mutate()}>{w.save}</button>
      </div>
    </>
  );
}

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
