// Add or edit one product: both languages, price (and the "was" price), stock, photos (upload, reorder, remove),
// notes, and whether it's shown. The live preview beside the panel shows the product's page as it's saved.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { blankProduct, deleteProduct, saveProduct } from '../lib/actions';
import { tx } from '../lib/i18n';
import { navigate } from '../lib/router';
import { categories, productById } from '../lib/store';
import type { Product, T } from '../lib/types';
import { Icon, Img, toast } from '../ui/kit';
import { Field, MoneyInput, PhotoButton, Switch, TFields } from './forms';
import { previewAt } from './state';
import { a } from './strings';

export function ProductEdit({ id }: { id: string }) {
  const isNew = id === 'new', existing = productById.value.get(id);
  const p = useSignal<Product>(existing ? structuredClone(existing) : blankProduct(categories.value[0]?.id ?? ''));
  const tried = useSignal(false);
  useEffect(() => { previewAt.value = existing ? `/p/${existing.slug}` : '/shop'; }, []);
  const t = a.value.f, v = p.value, set = (patch: Partial<Product>) => (p.value = { ...p.value, ...patch });
  if (!isNew && !existing) return <div class="adm-stack"><a href="/admin/products" class="back"><Icon n="back" class="flip" />{t.back}</a><p class="panel muted">{a.value.p.none}</p></div>;
  const errName = !v.name.ar.trim() && !v.name.en.trim(), errPrice = v.price <= 0;
  const save = () => {
    tried.value = true;
    if (errName || errPrice) return;
    const newId = saveProduct(v);
    const saved = productById.value.get(newId)!;
    previewAt.value = `/p/${saved.slug}`;
    toast(t.saved);
    if (isNew) navigate(`/admin/products/${newId}`, { replace: true });
    else p.value = structuredClone(saved);
  };
  const notes: T[] = [0, 1, 2].map((i) => v.notes[i] ?? { ar: '', en: '' });
  const setNote = (i: number, n: T) => { const next = [...notes]; next[i] = n; set({ notes: next.filter((x) => x.ar || x.en) }); };
  const movePic = (i: number, by: number) => { const pics = [...v.pics], j = i + by; if (j < 0 || j >= pics.length) return; [pics[i], pics[j]] = [pics[j], pics[i]]; set({ pics }); };
  return (
    <form class="adm-stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <a href="/admin/products" class="back"><Icon n="back" class="flip" />{t.back}</a>
      <div class="adm-title">
        <h1 class="adm-h1">{isNew ? t.titleNew : tx(v.name) || t.titleEdit}</h1>
        {!isNew && <a href={`/p/${existing!.slug}`} class="btn btn-ghost btn-sm" target="_blank"><Icon n="eye" />{t.preview}</a>}
        <button class="btn btn-solid btn-sm save-btn" type="submit"><Icon n="check" />{t.save}</button>
      </div>
      <section class="panel form-grid">
        <TFields labels={[t.nameAr, t.nameEn]} value={v.name} onChange={(name) => set({ name })} err={tried.value && errName ? t.required : undefined} />
        <TFields labels={[t.shortAr, t.shortEn]} value={v.short} onChange={(short) => set({ short })} />
        <TFields labels={[t.bodyAr, t.bodyEn]} value={v.body} onChange={(body) => set({ body })} area />
      </section>
      <section class="panel">
        <h2>{t.pics}</h2>
        <div class="pics">
          {v.pics.map((pic, i) => (
            <div class="pics-item">
              <Img pic={pic} ratio="4 / 5" />
              {i === 0 && <span class="pill on pics-cover">{t.cover}</span>}
              <div class="pics-tools">
                <button type="button" class="icon-btn" disabled={i === 0} onClick={() => movePic(i, -1)} aria-label="←"><Icon n="back" class="flip" /></button>
                <button type="button" class="icon-btn" onClick={() => set({ pics: v.pics.filter((_, k) => k !== i) })} aria-label="×"><Icon n="trash" /></button>
                <button type="button" class="icon-btn" disabled={i === v.pics.length - 1} onClick={() => movePic(i, 1)} aria-label="→"><Icon n="arrow" class="flip" /></button>
              </div>
            </div>
          ))}
          <div class="pics-add"><PhotoButton label={t.addPic} multiple onPicked={(pic) => (p.value = { ...p.value, pics: [...p.value.pics, pic] })} /><small class="muted">{t.picHint}</small></div>
        </div>
      </section>
      <section class="panel form-grid cols-3">
        <MoneyInput label={t.price} value={v.price} onChange={(price) => set({ price: price ?? 0 })} err={tried.value && errPrice ? t.required : undefined} />
        <MoneyInput label={t.compareAt} value={v.compareAt} allowEmpty onChange={(compareAt) => set({ compareAt })} />
        <Field label={t.stock}><input class="input num" inputMode="numeric" dir="ltr" value={v.stock} onInput={(e) => set({ stock: Math.max(0, parseInt((e.target as HTMLInputElement).value.replace(/\D/g, '') || '0', 10)) })} /></Field>
        <Field label={t.category}>
          <select class="input" value={v.categoryId} onChange={(e) => set({ categoryId: (e.target as HTMLSelectElement).value })}>
            {categories.value.map((c) => <option value={c.id}>{tx(c.name)}</option>)}
          </select>
        </Field>
        <Field label={t.size}><input class="input" value={v.size} onInput={(e) => set({ size: (e.target as HTMLInputElement).value })} /></Field>
        <Field label={t.sku}><input class="input" dir="ltr" value={v.sku} onInput={(e) => set({ sku: (e.target as HTMLInputElement).value })} /></Field>
      </section>
      <section class="panel form-grid">
        <h2>{t.notes}</h2>
        {notes.map((n, i) => <TFields labels={[`${i + 1} · ${t.noteAr}`, `${i + 1} · ${t.noteEn}`]} value={n} onChange={(x) => setNote(i, x)} />)}
      </section>
      <section class="panel form-grid">
        <Switch label={t.active} on={v.active} onChange={(active) => set({ active })} />
        <Switch label={t.featured} on={v.featured} onChange={(featured) => set({ featured })} />
        <Field label={t.slug}><input class="input" dir="ltr" value={v.slug} placeholder="nafha-noir" onInput={(e) => set({ slug: (e.target as HTMLInputElement).value })} /></Field>
      </section>
      <div class="actions">
        <button class="btn btn-solid" type="submit"><Icon n="check" />{t.save}</button>
        {!isNew && <button type="button" class="btn btn-ghost bad" onClick={() => { if (confirm(t.deleteSure)) { deleteProduct(existing!.id); toast(t.deleted); navigate('/admin/products', { replace: true }); } }}><Icon n="trash" />{t.delete}</button>}
      </div>
    </form>
  );
}
