// The store's front: the announcement bar and the home banners (text in both languages, picture, button, order,
// shown or not). The preview beside the panel shows the home page, so each change is visible as it's saved.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { deleteBanner, moveBanner, saveBanner, saveSettings } from '../lib/actions';
import { tx } from '../lib/i18n';
import { doc, settings } from '../lib/store';
import type { Banner } from '../lib/types';
import { Icon, Img } from '../ui/kit';
import { Field, PicField, Switch, TFields } from './forms';
import { previewAt } from './state';
import { a } from './strings';

const blank = (): Banner => ({ id: '', title: { ar: '', en: '' }, sub: { ar: '', en: '' }, cta: { ar: 'تسوّق الآن', en: 'Shop now' }, href: '/shop', pic: 'art:flacon:#C9727A:#3A2A2A:#F3E3E1', tone: 'light', active: true });

function BannerForm({ b, onDone }: { b: Banner; onDone(): void }) {
  const v = useSignal(structuredClone(b)), t = a.value.b, set = (x: Partial<Banner>) => (v.value = { ...v.value, ...x });
  return (
    <form class="panel form-grid" onSubmit={(e) => { e.preventDefault(); saveBanner(v.value); onDone(); }}>
      <TFields labels={[t.titleAr, t.titleEn]} value={v.value.title} onChange={(title) => set({ title })} />
      <TFields labels={[t.subAr, t.subEn]} value={v.value.sub} onChange={(sub) => set({ sub })} area />
      <TFields labels={[t.ctaAr, t.ctaEn]} value={v.value.cta} onChange={(cta) => set({ cta })} />
      <div class="pair">
        <Field label={t.href}><input class="input" dir="ltr" value={v.value.href} onInput={(e) => set({ href: (e.target as HTMLInputElement).value })} /></Field>
        <Field label={t.tone}><select class="input" value={v.value.tone} onChange={(e) => set({ tone: (e.target as HTMLSelectElement).value as Banner['tone'] })}><option value="dark">{t.dark}</option><option value="light">{t.light}</option></select></Field>
      </div>
      <div class="pair">
        <PicField label={t.pic} pic={v.value.pic} onChange={(pic) => set({ pic, picTall: undefined })} />
        <PicField label={t.picTall} pic={v.value.picTall ?? v.value.pic} onChange={(picTall) => set({ picTall })} />
      </div>
      <Switch label={t.active} on={v.value.active} onChange={(active) => set({ active })} />
      <div class="actions"><button class="btn btn-solid btn-sm" type="submit">{t.save}</button><button class="btn btn-ghost btn-sm" type="button" onClick={onDone}>×</button></div>
    </form>
  );
}

export function StorefrontEditor() {
  useEffect(() => { previewAt.value = '/'; }, []);
  const t = a.value.b, open = useSignal<string | null>(null), ann = settings.value.announcement, list = doc.value.banners;
  return (
    <div class="adm-stack">
      <h1 class="adm-h1">{a.value.nav.storefront}</h1>
      <section class="panel form-grid">
        <h2>{t.ann}</h2>
        <TFields labels={[t.annAr, t.annEn]} value={ann} onChange={(x) => saveSettings({ announcement: { ...ann, ...x } })} />
        <Switch label={t.annOn} on={ann.on} onChange={(on) => saveSettings({ announcement: { ...ann, on } })} />
      </section>
      <div class="adm-title"><h2 class="adm-h2">{t.title}</h2><button class="btn btn-solid btn-sm" onClick={() => (open.value = 'new')}><Icon n="plus" />{t.add}</button></div>
      {open.value === 'new' && <BannerForm b={blank()} onDone={() => (open.value = null)} />}
      <ul class="rows panel">
        {list.map((b, i) => open.value === b.id ? <li><BannerForm b={b} onDone={() => (open.value = null)} /></li> : (
          <li class="row">
            <Img pic={b.pic} ratio="16 / 10" class="row-pic wide" />
            <span class="row-main"><b>{tx(b.title)}</b><small class="muted">{b.active ? a.value.p.on : a.value.p.off} · <span dir="ltr">{b.href}</span></small></span>
            <button class="icon-btn" disabled={i === 0} onClick={() => moveBanner(b.id, -1)} aria-label="↑"><Icon n="up" /></button>
            <button class="icon-btn" disabled={i === list.length - 1} onClick={() => moveBanner(b.id, 1)} aria-label="↓"><Icon n="down" /></button>
            <button class="icon-btn" onClick={() => (open.value = b.id)} aria-label="edit"><Icon n="edit" /></button>
            <button class="icon-btn" onClick={() => deleteBanner(b.id)} aria-label={t.delete}><Icon n="trash" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
