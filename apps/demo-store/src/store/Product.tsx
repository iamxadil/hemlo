// One product, Apple-store style: big photographs (stacked on wide screens, swiped on phones), the details beside them
// staying in view, an accordion for the rest, the notes as photographs, more from the house, and — on phones — a
// glass "Add to bag" bar that appears once the main button has scrolled away.
import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { fill, s, tx } from '../lib/i18n';
import { HERO } from '../lib/router';
import { categories, live, productBySlug } from '../lib/store';
import { Icon, Img, Price } from '../ui/kit';
import { Rail } from '../ui/Rail';
import { ProductCard } from './ProductCard';
import { AddButton } from './BagFeedback';
import { NotFound } from './Storefront';

/** A row of the accordion: the height animates open (grid rows 0fr → 1fr), the chevron turns. */
function Fold({ title, children, open: start = false }: { title: string; children: ComponentChildren; open?: boolean }) {
  const open = useSignal(start);
  return (
    <div class={`fold${open.value ? ' open' : ''}`}>
      <button class="fold-head" aria-expanded={open.value} onClick={() => (open.value = !open.value)}><span>{title}</span><Icon n="plus" /></button>
      <div class="fold-body"><div>{children}</div></div>
    </div>
  );
}

export function ProductPage({ slug }: { slug: string }) {
  const p = productBySlug.value.get(slug), qty = useSignal(1), at = useSignal(0), barOn = useSignal(false);
  const buy = useRef<HTMLDivElement>(null), gallery = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!buy.current) return;
    const io = new IntersectionObserver(([e]) => (barOn.value = !e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(buy.current);
    return () => io.disconnect();
  }, [slug]);
  if (!p || !p.active) return <NotFound />;
  const out = p.stock <= 0, pics = p.pics.length ? p.pics : [''];
  const cat = categories.value.find((c) => c.id === p.categoryId);
  const more = live.value.filter((x) => x.id !== p.id && x.categoryId === p.categoryId).concat(live.value.filter((x) => x.categoryId !== p.categoryId && x.featured)).slice(0, 8);
  const labels = [s.value.top, s.value.heart, s.value.base];
  const onSwipe = () => { const el = gallery.current; if (el) at.value = Math.round(Math.abs(el.scrollLeft) / el.clientWidth); };
  return (
    <div class="pdp" data-hero-slug={p.slug}>
      <div class="wrap pdp-grid">
        <div class="pdp-gallery" ref={gallery} onScroll={onSwipe} data-scroll>
          {pics.map((pic, i) => <Img pic={pic} ratio="4 / 5" eager={i === 0} vt={i === 0 ? HERO : undefined} class="pdp-pic" sizes="(min-width: 1024px) 58vw, 100vw" alt={i === 0 ? tx(p.name) : ''} />)}
        </div>
        {pics.length > 1 && <div class="pdp-count num" aria-hidden="true">{at.value + 1} / {pics.length}</div>}
        <div class="pdp-info">
          {cat && <a class="eyebrow" href={`/c/${cat.slug}`}>{tx(cat.name)}</a>}
          <h1 class="display pdp-title">{tx(p.name)}</h1>
          <p class="pdp-short">{tx(p.short)}</p>
          <div class="pdp-price-row"><Price value={p.price} was={p.compareAt} class="pdp-price" /><span class="muted" dir="auto">{p.size}</span></div>
          {out ? <p class="pdp-stock bad">{s.value.soldOut}</p> : p.stock <= 5 && <p class="pdp-stock warn"><span class="dot" />{fill(s.value.left, { n: p.stock })}</p>}
          <div class="pdp-buy" ref={buy}>
            <div class="qty" role="group" aria-label={s.value.qty}>
              <button class="icon-btn" disabled={qty.value <= 1} onClick={() => qty.value--} aria-label="−"><Icon n="minus" /></button>
              <span class="num">{qty.value}</span>
              <button class="icon-btn" disabled={out || qty.value >= p.stock} onClick={() => qty.value++} aria-label="+"><Icon n="plus" /></button>
            </div>
            <AddButton id={p.id} qty={qty.value} class="btn-solid btn-lg pdp-add" disabled={out}>{out ? s.value.soldOut : s.value.add}</AddButton>
          </div>
          {p.notes.length > 0 && (
            <dl class="pdp-notes">{p.notes.slice(0, 3).map((n, k) => <div><dt>{labels[k]}</dt><dd>{tx(n)}</dd></div>)}</dl>
          )}
          <div class="folds">
            <Fold title={s.value.description} open><p>{tx(p.body)}</p></Fold>
            <Fold title={s.value.howToWear}><p>{s.value.wearText}</p></Fold>
            <Fold title={s.value.deliveryReturns}><p>{s.value.deliveryText}</p></Fold>
          </div>
          <ul class="pdp-promise">
            <li><Icon n="truck" />{s.value.promise[0][1]}</li>
            <li><Icon n="shield" />{s.value.promise[1][1]}</li>
            <li><Icon n="gift" />{s.value.promise[2][1]}</li>
          </ul>
        </div>
      </div>

      {p.notePics && p.notePics.length >= 3 && (
        <section class="wrap pdp-notepics">
          <h2 class="display rv">{s.value.notesTitle}</h2>
          <div class="notepics">
            {p.notePics.slice(0, 3).map((pic, k) => (
              <figure class="notepic rv" style={{ '--d': k }}>
                <Img pic={pic} ratio="3 / 4" sizes="(min-width: 900px) 33vw, 80vw" alt="" />
                <figcaption><small>{labels[k]}</small><b class="display">{tx(p.notes[k])}</b></figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {more.length > 0 && <Rail title={s.value.youMayLike}>{more.map((x) => <ProductCard p={x} />)}</Rail>}

      {!out && (
        <div class={`buybar glass${barOn.value ? ' on' : ''}`} aria-hidden={!barOn.value} inert={!barOn.value}>
          <div class="buybar-info"><b>{tx(p.name)}</b><Price value={p.price} /></div>
          <AddButton id={p.id} qty={qty.value} class="btn-solid">{s.value.add}</AddButton>
        </div>
      )}
    </div>
  );
}
