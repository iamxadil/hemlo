// The home page, told like a product launch: a full-screen photograph (the owner's banners), the spotlight perfume,
// its three notes as a pinned scroll story, the worlds of the house, the most-loved row, and two short stories.
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { fill, s, tx } from '../lib/i18n';
import { reduced } from '../lib/motion';
import { AddButton } from './BagFeedback';
import { pinProgress } from '../lib/scroll';
import { categories, doc, live, productById } from '../lib/store';
import type { Banner, Product } from '../lib/types';
import { Icon, Img, type IconName } from '../ui/kit';
import { Rail } from '../ui/Rail';
import { ProductCard } from './ProductCard';

const SLIDE_MS = 7000;

/** Full-screen banners: cross-fade with a slow push-in; progress bars like Apple's; swipe on phones; pause on hover. */
function Hero() {
  const banners = doc.value.banners.filter((b) => b.active), at = useSignal(0), paused = useSignal(false);
  const n = banners.length, i = n ? at.value % n : 0;
  const drag = useRef({ x: 0, id: -1 });
  if (!n) return null;
  const go = (k: number) => (at.value = (k + n) % n);
  const b: Banner = banners[i];
  return (
    <section class="hero" data-tone={b.tone} onPointerEnter={(e) => e.pointerType === 'mouse' && (paused.value = true)} onPointerLeave={() => (paused.value = false)}
      onPointerDown={(e) => { drag.current = { x: e.clientX, id: e.pointerId }; }}
      onPointerUp={(e) => { const dx = e.clientX - drag.current.x; if (e.pointerId === drag.current.id && Math.abs(dx) > 50) go(i + ((dx < 0) !== (document.documentElement.dir === 'rtl') ? 1 : -1)); }}>
      <div class="hero-stage">
        {banners.map((x, k) => (
          <div class={`hero-slide${k === i ? ' on' : ''}`} aria-hidden={k !== i} key={x.id}>
            <Img pic={x.pic} tall={x.picTall} ratio="auto" eager={k === 0} class="hero-pic" sizes="100vw" alt="" />
          </div>
        ))}
        <div class="hero-shade" />
      </div>
      <div class="wrap hero-copy" key={b.id}>
        <p class="eyebrow hero-eyebrow">{tx(doc.value.settings.tagline)}</p>
        <h1 class="display hero-title">{tx(b.title)}</h1>
        <p class="hero-sub">{tx(b.sub)}</p>
        <div class="hero-cta">
          <a class="btn btn-light btn-lg" href={b.href}>{tx(b.cta)}</a>
          <a class="btn btn-glass btn-lg" href="/shop">{s.value.shopAll}</a>
        </div>
      </div>
      {n > 1 && (
        <div class={`wrap hero-bars${paused.value ? ' paused' : ''}`} role="tablist">
          {banners.map((_, k) => (
            <button role="tab" aria-selected={k === i} aria-label={fill(s.value.slide, { n: k + 1 })} onClick={() => go(k)}>
              {!reduced.value && <i style={k === i ? { animationDuration: `${SLIDE_MS}ms` } : undefined} onAnimationEnd={() => k === i && go(i + 1)} />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** The house's spotlight, Apple-tile style: name, one line, buy, learn more, and the photograph rising into place. */
function Spotlight({ p }: { p: Product }) {
  const media = useRef<HTMLDivElement>(null);
  return (
    <section class="spot" data-tone="dark">
      <div class="wrap spot-copy">
        <p class="eyebrow rv">{s.value.new}</p>
        <h2 class="display spot-title rv" style={{ '--d': 1 }}>{tx(p.name)}</h2>
        <p class="spot-sub rv" style={{ '--d': 2 }}>{tx(p.short)}</p>
        <div class="spot-cta rv" style={{ '--d': 3 }}>
          <AddButton id={p.id} class="btn-accent">{s.value.buy}</AddButton>
          <a class="link link-light" href={`/p/${p.slug}`}>{s.value.learnMore}<Icon n="chev" class="flip" /></a>
        </div>
      </div>
      <div class="spot-media" ref={media}>
        <Img pic={p.pics[0]} ratio="auto" sizes="(min-width: 1320px) 1320px, 100vw" alt={tx(p.name)} />
      </div>
    </section>
  );
}

/** The scent in three notes: the section pins while you scroll; each note takes the stage in turn. */
function Story({ p }: { p: Product }) {
  const el = useRef<HTMLElement>(null), active = useSignal(0), pics = p.notePics!;
  const labels = [s.value.top, s.value.heart, s.value.base];
  useEffect(() => pinProgress(el.current!, (v) => { const k = Math.min(2, Math.floor(v * 3.2)); if (k !== active.value) active.value = k; }), []);
  return (
    <section class="story" data-tone="dark" ref={el}>
      <div class="story-pin">
        <div class="story-media">
          {pics.slice(0, 3).map((pic, k) => <div class={`story-pic${k === active.value ? ' on' : ''}`}><Img pic={pic} ratio="auto" sizes="(min-width: 900px) 55vw, 100vw" alt={tx(p.notes[k])} /></div>)}
        </div>
        <div class="wrap story-copy">
          <div class="story-head">
            <p class="eyebrow">{tx(p.name)}</p>
            <h2 class="display">{s.value.story}</h2>
            <p class="story-sub">{s.value.storySub}</p>
          </div>
          <ol class="story-notes">
            {p.notes.slice(0, 3).map((n, k) => (
              <li class={k === active.value ? 'on' : k < active.value ? 'past' : ''}>
                <span class="story-k">{labels[k]} · {s.value.noteTimes[k]}</span>
                <span class="display story-v">{tx(n)}</span>
                <p>{s.value.noteDesc[k]}</p>
              </li>
            ))}
          </ol>
          <div class="story-bar" aria-hidden="true"><i /></div>
        </div>
      </div>
    </section>
  );
}

function Worlds() {
  const all = live.value;
  return (
    <section class="wrap section">
      <div class="section-head rv"><h2 class="display">{s.value.worlds}</h2><p class="muted">{s.value.worldsSub}</p></div>
      <div class="worlds">
        {categories.value.map((c, k) => (
          <a href={`/c/${c.slug}`} class="world rv" style={{ '--d': k }}>
            <Img pic={c.pic} ratio="auto" sizes={k === 0 ? '(min-width: 900px) 50vw, 100vw' : '(min-width: 900px) 25vw, 50vw'} alt="" />
            <span class="world-shade" />
            <span class="world-text">
              <b class="display">{tx(c.name)}</b>
              <small>{fill(s.value.products, { n: all.filter((p) => p.categoryId === c.id).length })}</small>
            </span>
            <span class="world-go" aria-hidden="true"><Icon n="arrow" class="flip" /></span>
          </a>
        ))}
      </div>
    </section>
  );
}

function Editorial({ pic, eyebrow, title, text, href, cta, flip = false }: { pic: string; eyebrow: string; title: string; text: string; href: string; cta: string; flip?: boolean }) {
  return (
    <section class={`wrap edit${flip ? ' flip' : ''}`}>
      <div class="edit-media rv"><Img pic={pic} ratio="4 / 5" sizes="(min-width: 900px) 50vw, 100vw" alt="" /></div>
      <div class="edit-copy">
        <p class="eyebrow rv">{eyebrow}</p>
        <h2 class="display rv" style={{ '--d': 1 }}>{title}</h2>
        <p class="rv" style={{ '--d': 2 }}>{text}</p>
        <a class="link rv" style={{ '--d': 3 }} href={href}>{cta}<Icon n="chev" class="flip" /></a>
      </div>
    </section>
  );
}

function Promises() {
  return (
    <section class="wrap promise">
      {s.value.promise.map(([icon, title, sub], k) => (
        <div class="rv" style={{ '--d': k }}><span class="promise-ic"><Icon n={icon as IconName} /></span><b>{title}</b><small class="muted">{sub}</small></div>
      ))}
    </section>
  );
}

export function Home() {
  const featured = live.value.filter((p) => p.featured), byId = productById.value;
  const spot = byId.get('p-nafha-noir')?.active ? byId.get('p-nafha-noir')! : featured[0];
  return (
    <div class="home">
      <Hero />
      {spot && <Spotlight p={spot} />}
      {spot?.notePics && spot.notePics.length >= 3 && spot.notes.length >= 3 && <Story p={spot} />}
      <Worlds />
      {featured.length > 0 && (
        <Rail title={s.value.mostLoved} sub={s.value.mostLovedSub} link={<a class="link" href="/shop">{s.value.shopAll}<Icon n="chev" class="flip" /></a>}>
          {featured.map((p) => <ProductCard p={p} />)}
        </Rail>
      )}
      <Editorial pic="photo:atelier" eyebrow={s.value.atelier} title={s.value.atelierTitle} text={s.value.atelierText} href="/c/perfumes" cta={s.value.shopAll} />
      <Editorial pic="photo:care-ritual" eyebrow={s.value.care} title={s.value.careTitle} text={s.value.careText} href="/c/care" cta={tx(categories.value.find((c) => c.slug === 'care')?.name) || s.value.shopAll} flip />
      <Promises />
    </div>
  );
}

