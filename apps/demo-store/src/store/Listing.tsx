// A list of products: a category (with its photograph), everything, or a search. The category pills and the sorting
// are part of the URL, so they survive Back and sharing.
import { useRef } from 'preact/hooks';
import { fill, lang, s, tx } from '../lib/i18n';
import { navigate, query } from '../lib/router';
import { search } from '../lib/search';
import { categories, categoryBySlug, live } from '../lib/store';
import { Icon, Img } from '../ui/kit';
import { ProductCard } from './ProductCard';
import { NotFound } from './Storefront';

type Sort = 'featured' | 'new' | 'low' | 'high';
const SORTS: Record<'ar' | 'en', Record<Sort, string>> = {
  ar: { featured: 'المميّزة أولاً', new: 'الأحدث', low: 'السعر: الأقل', high: 'السعر: الأعلى' },
  en: { featured: 'Featured', new: 'Newest', low: 'Price: low to high', high: 'Price: high to low' },
};

export function Listing({ kind, slug }: { kind: 'all' | 'category' | 'search'; slug?: string }) {
  const q = query.value.get('q') ?? '', sort = (query.value.get('sort') as Sort) || 'featured';
  const cat = kind === 'category' ? categoryBySlug.value.get(slug!) : null;
  const input = useRef<HTMLInputElement>(null);
  if (kind === 'category' && !cat) return <NotFound />;
  let list = cat ? live.value.filter((p) => p.categoryId === cat.id) : live.value;
  if (kind === 'search') list = search(list, q);
  list = [...list].sort((a, b) =>
    sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : sort === 'new' ? b.createdAt - a.createdAt : Number(b.featured) - Number(a.featured) || b.createdAt - a.createdAt);
  const set = (k: string, v: string) => { const u = new URLSearchParams(query.value); v ? u.set(k, v) : u.delete(k); const qs = u.toString(); navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true, keepScroll: true }); };
  const L = SORTS[lang.value];
  return (
    <div class="listing">
      {cat ? (
        <header class="cat-hero" data-tone="dark">
          <Img pic={cat.pic} ratio="auto" eager sizes="100vw" alt="" />
          <span class="cat-hero-shade" />
          <div class="wrap cat-hero-copy">
            <h1 class="display">{tx(cat.name)}</h1>
            <p>{tx(cat.blurb)}</p>
          </div>
        </header>
      ) : kind === 'search' ? (
        <header class="wrap list-head">
          <form class="search-big" role="search" onSubmit={(e) => { e.preventDefault(); set('q', input.current!.value.trim()); }}>
            <Icon n="search" />
            <input ref={input} type="search" name="q" defaultValue={q} placeholder={s.value.search} autoFocus enterKeyHint="search" onInput={(e) => set('q', (e.target as HTMLInputElement).value)} />
          </form>
        </header>
      ) : (
        <header class="wrap list-head"><h1 class="display">{s.value.all}</h1></header>
      )}
      <div class="wrap list-tools">
        <nav class="pills" aria-label={s.value.shop}>
          <a href="/shop" aria-current={kind === 'all' ? 'page' : undefined}>{s.value.all}</a>
          {categories.value.map((c) => <a href={`/c/${c.slug}`} aria-current={cat?.id === c.id ? 'page' : undefined}>{tx(c.name)}</a>)}
        </nav>
        <div class="list-sort">
          <span class="muted num">{fill(s.value.products, { n: list.length })}</span>
          <label class="select"><select value={sort} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; set('sort', v === 'featured' ? '' : v); }} aria-label="Sort">
            {(Object.keys(L) as Sort[]).map((k) => <option value={k}>{L[k]}</option>)}
          </select><Icon n="down" /></label>
        </div>
      </div>
      <section class="wrap list-grid-wrap">
        {list.length ? <div class="grid">{list.map((p, i) => <div class="rv" style={{ '--d': i % 4 }} key={p.id}><ProductCard p={p} eager={i < 4} /></div>)}</div>
          : <p class="empty-state muted">{kind === 'search' && q ? fill(s.value.searchNone, { q }) : s.value.emptyList}</p>}
      </section>
    </div>
  );
}
