// Categories: rename, reorder (the store's menu follows the order), change the picture, add, and remove empty ones.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { deleteCategory, moveCategory, saveCategory } from '../lib/actions';
import { fill, tx } from '../lib/i18n';
import { categories, products } from '../lib/store';
import type { Category } from '../lib/types';
import { Icon, Img, toast } from '../ui/kit';
import { PicField, TFields } from './forms';
import { previewAt } from './state';
import { a } from './strings';

const blank = (): Category => ({ id: '', slug: '', name: { ar: '', en: '' }, blurb: { ar: '', en: '' }, pic: 'art:round:#C9A06A:#2A211B:#EFE7DC', order: 0 });

function Editor({ c, onDone }: { c: Category; onDone(): void }) {
  const v = useSignal(structuredClone(c)), t = a.value.c;
  return (
    <form class="panel form-grid" onSubmit={(e) => { e.preventDefault(); if (!v.value.name.ar.trim() && !v.value.name.en.trim()) return; saveCategory(v.value); onDone(); }}>
      <TFields labels={[t.nameAr, t.nameEn]} value={v.value.name} onChange={(name) => (v.value = { ...v.value, name })} />
      <TFields labels={[t.blurbAr, t.blurbEn]} value={v.value.blurb} onChange={(blurb) => (v.value = { ...v.value, blurb })} />
      <PicField label={t.pic} pic={v.value.pic} onChange={(pic) => (v.value = { ...v.value, pic })} />
      <div class="actions"><button class="btn btn-solid btn-sm" type="submit">{t.save}</button><button class="btn btn-ghost btn-sm" type="button" onClick={onDone}>×</button></div>
    </form>
  );
}

export function Categories() {
  useEffect(() => { previewAt.value = '/'; }, []);
  const t = a.value.c, open = useSignal<string | null>(null);
  const count = (id: string) => products.value.filter((p) => p.categoryId === id).length;
  const list = categories.value;
  return (
    <div class="adm-stack">
      <div class="adm-title"><h1 class="adm-h1">{a.value.nav.categories}</h1><button class="btn btn-solid btn-sm" onClick={() => (open.value = 'new')}><Icon n="plus" />{t.new}</button></div>
      {open.value === 'new' && <Editor c={blank()} onDone={() => (open.value = null)} />}
      <ul class="rows panel">
        {list.map((c, i) => open.value === c.id ? <li><Editor c={c} onDone={() => (open.value = null)} /></li> : (
          <li class="row">
            <Img pic={c.pic} ratio="1 / 1" class="row-pic" />
            <span class="row-main"><b>{tx(c.name)}</b><small class="muted">{fill(t.count, { n: count(c.id) })}</small></span>
            <button class="icon-btn" disabled={i === 0} onClick={() => moveCategory(c.id, -1)} aria-label="↑"><Icon n="up" /></button>
            <button class="icon-btn" disabled={i === list.length - 1} onClick={() => moveCategory(c.id, 1)} aria-label="↓"><Icon n="down" /></button>
            <button class="icon-btn" onClick={() => (open.value = c.id)} aria-label="edit"><Icon n="edit" /></button>
            <button class="icon-btn" onClick={() => { if (!deleteCategory(c.id)) toast(t.notEmpty); }} aria-label={t.delete}><Icon n="trash" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
