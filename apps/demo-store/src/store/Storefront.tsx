// The shop's frame: the announcement, a glass header (dark over dark sections), Apple-style search and phone menu, the
// page for the current URL, the footer with photo credits, the bag, and — for the demo — a pill to the control panel.
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { cartOpen, cartTotals } from '../lib/cart';
import { lang, s, tx, fill } from '../lib/i18n';
import { observeReveals } from '../lib/motion';
import { HowPage, warmProps } from '../lib/preload';
import { match, navigate, path } from '../lib/router';
import { watchTone } from '../lib/scroll';
import { search } from '../lib/search';
import { categories, doc, live, settings } from '../lib/store';
import { Icon, Img, Price } from '../ui/kit';
import { BagGlyph, MiniBag } from './BagFeedback';
import { CartSheet } from './Cart';
import { Checkout } from './Checkout';
import { Home } from './Home';
import { Listing } from './Listing';
import { Logo } from './Logo';
import { OrderPage } from './OrderPage';
import { ProductPage } from './Product';

/** Inside the control panel's live preview the shop hides its demo extras. */
export const embedded = window.self !== window.top;

function Page() {
  const p = path.value;
  let m: Record<string, string> | null;
  if (p === '/') return <Home />;
  if (p === '/shop') return <Listing kind="all" />;
  if (p === '/search') return <Listing kind="search" />;
  if ((m = match('/c/:slug'))) return <Listing key={m.slug} kind="category" slug={m.slug} />;
  if ((m = match('/p/:slug'))) return <ProductPage key={m.slug} slug={m.slug} />;
  if (p === '/checkout') return <Checkout />;
  if ((m = match('/order/:no'))) return <OrderPage no={Number(m.no)} />;
  if (p === '/how') return <HowPage />;
  return <NotFound />;
}

export const NotFound = () => (
  <section class="wrap empty-state"><h1 class="display">404</h1><p class="muted">{s.value.notFound}</p><a class="btn btn-solid" href="/">{s.value.home}</a></section>
);

/** Search drops down from the header: type and see products at once; Enter shows them all. */
function SearchPanel({ onClose }: { onClose(): void }) {
  const q = useSignal(''), input = useRef<HTMLInputElement>(null);
  useEffect(() => { requestAnimationFrame(() => input.current?.focus()); const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const found = q.value.trim() ? search(live.value, q.value).slice(0, 5) : [];
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <>
      <div class="search-scrim" onClick={onClose} />
      <div class="search-panel glass" role="dialog" aria-label={s.value.search}>
        <div class="wrap search-in">
          <form class="search-row" role="search" onSubmit={(e) => { e.preventDefault(); if (q.value.trim()) go(`/search?q=${encodeURIComponent(q.value.trim())}`); }}>
            <Icon n="search" />
            <input ref={input} class="search-field" type="search" value={q.value} onInput={(e) => (q.value = (e.target as HTMLInputElement).value)} placeholder={s.value.search} enterKeyHint="search" aria-label={s.value.search} />
            <button type="button" class="icon-btn" onClick={onClose} aria-label={s.value.close}><Icon n="close" /></button>
          </form>
          {found.length > 0 ? (
            <ul class="search-results">
              {found.map((p, i) => (
                <li style={{ '--d': i }}><a href={`/p/${p.slug}`} onClick={onClose}><Img pic={p.pics[0]} ratio="1 / 1" sizes="56px" /><span><b>{tx(p.name)}</b><small class="muted" dir="auto">{p.size}</small></span><Price value={p.price} /></a></li>
              ))}
              <li style={{ '--d': found.length }}><a class="search-all" href={`/search?q=${encodeURIComponent(q.value.trim())}`} onClick={onClose}>{fill(s.value.seeAll, { q: q.value.trim() })}<Icon n="chev" class="flip" /></a></li>
            </ul>
          ) : (
            <div class="search-quick"><p class="muted">{s.value.quick}</p>{categories.value.map((c, i) => <a href={`/c/${c.slug}`} onClick={onClose} style={{ '--d': i }}><Icon n="arrow" class="flip" />{tx(c.name)}</a>)}</div>
          )}
        </div>
      </div>
    </>
  );
}

/** The header: a floating glass capsule. On wide screens one highlight slides between the links; on phones the menu
 *  grows out of the capsule itself into a full-height glass panel (premium-storefront skill §2, §4). */
function Header() {
  const st = settings.value, count = cartTotals.value.count, all = live.value;
  const menu = useSignal(false), searching = useSignal(false), tight = useSignal(false);
  const links = useRef<HTMLElement>(null), hl = useRef<HTMLSpanElement>(null), sentinel = useRef<HTMLSpanElement>(null);
  useEffect(() => { menu.value = false; searching.value = false; }, [path.value]);
  useEffect(() => {
    const html = document.documentElement;
    // the menu fills the screen below wherever the capsule sits (under the announcement bar at the top of the page)
    if (menu.value) html.style.setProperty('--menu-top', `${document.querySelector('.nav-bar')!.getBoundingClientRect().top}px`);
    html.classList.toggle('menu-open', menu.value);
  }, [menu.value]);
  // the capsule tightens once the page has scrolled a little (an observer, not a scroll listener)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (tight.value = !e.isIntersecting));
    io.observe(sentinel.current!);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (!menu.value) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && (menu.value = false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [menu.value]);
  // one highlight that glides to whichever link the pointer or focus is on
  const glide = (e: Event) => {
    const a = (e.target as Element).closest('a'), box = links.current, h = hl.current;
    if (!a || !box || !h) return;
    const r = a.getBoundingClientRect(), b = box.getBoundingClientRect();
    h.style.width = `${r.width}px`; h.style.transform = `translateX(${r.left - b.left}px)`; h.classList.add('on');
  };
  const rest = () => hl.current?.classList.remove('on');
  // swipe the open menu up to close it
  const swipe = useRef({ y: 0, on: false });
  const count1 = (c: string) => all.filter((p) => p.categoryId === c).length;
  return (
    <>
      <span class="nav-sentinel" ref={sentinel} aria-hidden="true" />
      {st.announcement.on && tx(st.announcement) && <div class="announce"><span>{tx(st.announcement)}</span></div>}
      <header class={`nav${menu.value ? ' open' : ''}${tight.value ? ' tight' : ''}`}>
        <div class="nav-bar">
          <div class="nav-bg" aria-hidden="true" />
          <div class="nav-row">
            <Logo />
            <nav class="nav-links" ref={links} aria-label={s.value.shop} onPointerOver={glide} onFocusIn={glide} onPointerLeave={rest} onFocusOut={rest}>
              <span class="nav-hl" ref={hl} aria-hidden="true" />
              <a href="/shop" aria-current={path.value === '/shop' ? 'page' : undefined}>{s.value.shopAll}</a>
              {categories.value.map((c) => <a href={`/c/${c.slug}`} aria-current={path.value === `/c/${c.slug}` ? 'page' : undefined}>{tx(c.name)}</a>)}
            </nav>
            <div class="nav-act">
              <button class="icon-btn" onClick={() => { menu.value = false; searching.value = true; }} aria-label={s.value.search}><Icon n="search" /></button>
              <button class={`lang-tog${lang.value === 'ar' ? ' ar' : ''}`} dir="ltr" onClick={() => (lang.value = lang.value === 'ar' ? 'en' : 'ar')} aria-label={lang.value === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
                <span class="lang-thumb" aria-hidden="true" /><span class={lang.value === 'en' ? 'on' : ''}>EN</span><span class={lang.value === 'ar' ? 'on' : ''} lang="ar">ع</span>
              </button>
              <button class="bag-pill" onClick={() => { menu.value = false; cartOpen.value = true; }} aria-label={`${s.value.cart} (${count})`}>
                <BagGlyph /><span class="bag-label">{s.value.cart}</span>
              </button>
              <button class="icon-btn nav-burger" onClick={() => (menu.value = !menu.value)} aria-expanded={menu.value} aria-label={s.value.menu}><span /><span /></button>
            </div>
          </div>
          <div class="nav-menu" aria-hidden={!menu.value} inert={!menu.value}
            onPointerDown={(e) => (swipe.current = { y: e.clientY, on: true })}
            onPointerUp={(e) => { if (swipe.current.on && e.clientY - swipe.current.y < -70) menu.value = false; swipe.current.on = false; }}>
            <nav class="menu-cats">
              <a href="/shop" class="menu-row" style={{ '--d': 0 }}><span class="menu-ic"><Icon n="store" /></span><span class="menu-name">{s.value.shopAll}<small>{fill(s.value.products, { n: all.length })}</small></span><Icon n="chev" class="flip" /></a>
              {categories.value.map((c, i) => (
                <a href={`/c/${c.slug}`} class="menu-row" style={{ '--d': i + 1 }}>
                  <Img pic={c.pic} ratio="1 / 1" sizes="56px" class="menu-pic" />
                  <span class="menu-name">{tx(c.name)}<small>{fill(s.value.products, { n: count1(c.id) })}</small></span>
                  <Icon n="chev" class="flip" />
                </a>
              ))}
            </nav>
            <div class="menu-foot" style={{ '--d': categories.value.length + 1 }}>
              <div class="seg" role="group" aria-label="Language">
                <button aria-pressed={lang.value === 'ar'} onClick={() => (lang.value = 'ar')}>العربية</button>
                <button aria-pressed={lang.value === 'en'} onClick={() => (lang.value = 'en')}>English</button>
              </div>
              <a class="btn btn-line btn-block" href={`https://wa.me/${st.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"><Icon n="whatsapp" />{s.value.footer.help}</a>
              {!embedded && <div class="menu-demo"><a href="/how">{s.value.demoHow}</a><a href="/admin" {...warmProps}>{s.value.demoOpen}</a></div>}
            </div>
          </div>
        </div>
        <MiniBag />
      </header>
      {menu.value && <div class="menu-scrim" onClick={() => (menu.value = false)} />}
      {searching.value && <SearchPanel onClose={() => (searching.value = false)} />}
    </>
  );
}

function Footer() {
  const st = settings.value, f = s.value.footer;
  return (
    <footer class="ftr">
      <div class="wrap">
        <p class="ftr-line display">{tx(st.tagline)}.</p>
        <div class="ftr-grid">
          <div><Logo /><p class="muted">{tx(st.city)}</p></div>
          <div><h2>{s.value.shop}</h2><ul>{categories.value.map((c) => <li><a href={`/c/${c.slug}`}>{tx(c.name)}</a></li>)}</ul></div>
          <div><h2>{f.help}</h2><ul><li><a href={`https://wa.me/${st.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" dir="ltr">{st.whatsapp}</a></li><li><a href={`mailto:${st.email}`}>{st.email}</a></li></ul></div>
          <div><h2>{f.follow}</h2><ul><li><a href={`https://instagram.com/${st.instagram}`} target="_blank" rel="noopener" dir="ltr">@{st.instagram}</a></li></ul></div>
        </div>
        <div class="ftr-bottom">
          <span>© {new Date().getFullYear()} {tx(st.name)}. {f.rights}</span>
          <a href="/how#credits">{f.credits}</a>
          {!embedded && <a href="https://studio.hemlohq.com" target="_blank" rel="noopener">{f.built}</a>}
        </div>
      </div>
    </footer>
  );
}

/** For the demo: a small glass capsule that takes anyone to the control panel. */
const DemoPill = () => (
  <a href="/admin" class={`demo-pill glass${path.value.startsWith('/p/') ? ' on-pdp' : ''}`} {...warmProps}><Icon n="panel" /><span>{s.value.tryPanel}</span></a>
);

export function Storefront() {
  // after every page or language change: watch the new page's dark sections and reveals
  useEffect(() => { const id = requestAnimationFrame(() => { watchTone(); observeReveals(); }); return () => cancelAnimationFrame(id); }, [path.value, lang.value, doc.value.rev]);
  // anything that appears later (sorting, a filter, a lazy page) gets its reveal too
  useEffect(() => {
    let raf = 0;
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; observeReveals(); }); });
    mo.observe(document.getElementById('main')!, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div class="store">
      <div class="store-page">
        <Header />
        <main id="main"><Page /></main>
        <Footer />
      </div>
      <CartSheet />
      {!embedded && path.value !== '/checkout' && <DemoPill />}
    </div>
  );
}
