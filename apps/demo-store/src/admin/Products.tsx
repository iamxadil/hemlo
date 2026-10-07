// Products: search, filter by category or low stock (all in the URL), switch a product on/off or featured in one tap.
import { useEffect } from 'preact/hooks';
import { toggleProduct } from '../lib/actions';
import { price } from '../lib/format';
import { tx } from '../lib/i18n';
import { navigate, query } from '../lib/router';
import { search } from '../lib/search';
import { categories, products } from '../lib/store';
import { Icon, Img } from '../ui/kit';
import { previewAt } from './state';
import { a } from './strings';

export function Products() {
  useEffect(() => { previewAt.value = '/shop'; }, []);
  const t = a.value, q = query.value.get('q') ?? '', cat = query.value.get('c') ?? '', low = query.value.has('low');
  const set = (k: string, v: string) => { const u = new URLSearchParams(query.value); v ? u.set(k, v) : u.delete(k); navigate(`/admin/products?${u}`, { replace: true, keepScroll: true }); };
  let list = products.value;
  if (cat) list = list.filter((p) => p.categoryId === cat);
  if (low) list = list.filter((p) => p.stock <= 5);
  list = search(list, q);
  const catName = new Map(categories.value.map((c) => [c.id, tx(c.name)]));
  return (
    <div class="adm-stack">
      <div class="adm-title"><h1 class="adm-h1">{t.nav.products}</h1><a href="/admin/products/new" class="btn btn-solid btn-sm"><Icon n="plus" />{t.p.new}</a></div>
      <div class="filters">
        <input class="input" type="search" placeholder={t.p.search} value={q} onInput={(e) => set('q', (e.target as HTMLInputElement).value)} />
        <select class="input" value={cat} onChange={(e) => set('c', (e.target as HTMLSelectElement).value)}>
          <option value="">{t.p.all}</option>
          {categories.value.map((c) => <option value={c.id}>{tx(c.name)}</option>)}
        </select>
        {low && <button class="btn btn-line btn-sm" onClick={() => set('low', '')}>{a.value.dash.low}<Icon n="close" /></button>}
      </div>
      {list.length ? (
        <ul class="rows panel">{list.map((p) => (
          <li class="row prod-row">
            <a href={`/admin/products/${p.id}`} class="row-link"><Img pic={p.pics[0]} ratio="1 / 1" class="row-pic" /><span class="row-main"><b>{tx(p.name)}</b><small class="muted">{catName.get(p.categoryId)} · {p.sku}</small></span></a>
            <b class="num">{price(p.price)}</b>
            <span class={`num stock ${p.stock <= 0 ? 'bad' : p.stock <= 5 ? 'warn' : ''}`}>{p.stock}</span>
            <button class={`pill tgl${p.featured ? ' on' : ''}`} onClick={() => toggleProduct(p.id, 'featured')} aria-pressed={p.featured}>★<span class="sr">{t.p.featured}</span></button>
            <button class={`pill tgl${p.active ? ' on' : ''}`} onClick={() => toggleProduct(p.id, 'active')} aria-pressed={p.active}>{p.active ? t.p.on : t.p.off}</button>
          </li>
        ))}</ul>
      ) : <p class="panel muted">{t.p.none}</p>}
    </div>
  );
}
