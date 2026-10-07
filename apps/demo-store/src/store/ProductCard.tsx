// A product in a grid or a row: its photograph (a second one cross-fades in on hover, loaded only then), name, size,
// price, and a quick add that throws the photo into the bag. Tapping it morphs the photo into the product's page.
import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { fill, s, tx } from '../lib/i18n';
import { addToBag } from './BagFeedback';
import { heroFrom } from '../lib/router';
import type { Product } from '../lib/types';
import { Icon, Img, Price } from '../ui/kit';

const SIZES = '(min-width: 1320px) 320px, (min-width: 1024px) 25vw, (min-width: 720px) 33vw, 50vw';

export function ProductCard({ p, eager = false }: { p: Product; eager?: boolean }) {
  const out = p.stock <= 0, low = !out && p.stock <= 5, sale = p.compareAt != null && p.compareAt > p.price;
  const second = useSignal(false), done = useSignal(false), media = useRef<HTMLDivElement>(null);
  return (
    <article class="card" data-slug={p.slug} onPointerEnter={(e) => e.pointerType === 'mouse' && p.pics[1] && (second.value = true)}>
      <a href={`/p/${p.slug}`} class="card-link" onClick={() => heroFrom(media.current?.querySelector('.card-pic') as HTMLElement)}>
        <div class="card-media" ref={media}>
          <Img pic={p.pics[0]} alt={tx(p.name)} eager={eager} class="card-pic" sizes={SIZES} />
          {second.value && <Img pic={p.pics[1]} alt="" class="card-pic-2" sizes={SIZES} />}
          <div class="card-tags">
            {sale && <span class="tag tag-sale">{s.value.sale}</span>}
            {out && <span class="tag">{s.value.soldOut}</span>}
            {low && <span class="tag">{fill(s.value.left, { n: p.stock })}</span>}
          </div>
        </div>
        <div class="card-info">
          <h3 class="card-name">{tx(p.name)}</h3>
          <p class="card-meta"><bdi>{p.size}</bdi></p>
          <Price value={p.price} was={p.compareAt} />
        </div>
      </a>
      {!out && (
        <button class={`card-add${done.value ? ' done' : ''}`} aria-label={`${s.value.add}: ${tx(p.name)}`}
          onClick={() => { if (done.value) return; addToBag(p.id); done.value = true; setTimeout(() => (done.value = false), 1600); }}>
          <Icon n="plus" class="card-add-plus" />
          <svg class="draw-check card-add-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
        </button>
      )}
    </article>
  );
}
