// A small router: real URLs (/p/nafha-noir, /admin/orders), links that don't reload the page, and Back that returns
// to where you were. Page changes cross-fade with the View Transitions API where the browser has it; a product's photo
// morphs from its card into its page (and back). Any <a href="/…"> works; add data-native to force a normal load.
import { signal } from '@preact/signals';
import { reduced } from './motion';

export const path = signal(location.pathname);
export const query = signal(new URLSearchParams(location.search));

const remember = () => history.replaceState({ ...(history.state ?? {}), y: scrollY }, '');
const settle = () => new Promise<void>((ok) => setTimeout(ok, 0)); // let Preact draw the new page

/** The photo that should morph: the product page's main photo carries this name; a card gets it when tapped. */
export const HERO = 'hero-pic';
let tapped: HTMLElement | null = null;
/** Called by a product card on tap, so its photo is the one that flies into the product page. */
export function heroFrom(el: HTMLElement | null) { tapped = el; }

function swap(update: () => void, after?: () => void) {
  const vt = (document as Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } }).startViewTransition;
  if (!vt || reduced.value || document.visibilityState !== 'visible') { update(); after?.(); return; }
  // back from a product page: find that product's card on the new page so the photo flies home
  const fromSlug = document.querySelector<HTMLElement>('[data-hero-slug]')?.dataset.heroSlug;
  const card = tapped; tapped = null;
  if (card) { document.querySelectorAll<HTMLElement>(`[style*="${HERO}"]`).forEach((e) => (e.style.viewTransitionName = '')); card.style.viewTransitionName = HERO; }
  let named: HTMLElement | null = null;
  const t = vt.call(document, async () => {
    if (card) card.style.viewTransitionName = '';
    update(); await settle(); after?.();
    if (fromSlug && !document.querySelector('[data-hero-slug]')) {
      named = document.querySelector<HTMLElement>(`[data-slug="${CSS.escape(fromSlug)}"] .card-pic`);
      if (named) named.style.viewTransitionName = HERO;
    }
  });
  t.finished.finally(() => { if (named) named.style.viewTransitionName = ''; });
}

export function navigate(to: string, { replace = false, keepScroll = false } = {}) {
  const u = new URL(to, location.href);
  if (u.origin !== location.origin) { location.href = to; return; }
  if (u.pathname + u.search === location.pathname + location.search) { if (u.hash) location.hash = u.hash; else if (!keepScroll) scrollTo({ top: 0, behavior: reduced.value ? 'auto' : 'smooth' }); return; }
  remember();
  history[replace ? 'replaceState' : 'pushState']({ y: 0 }, '', u);
  const update = () => { path.value = u.pathname; query.value = u.searchParams; };
  if (keepScroll || replace && u.pathname === path.value) { update(); return; } // filters and sorting: no page change
  swap(update, () => { if (!keepScroll) scrollTo({ top: 0 }); });
}

export function startRouter() {
  history.scrollRestoration = 'manual';
  addEventListener('popstate', (e) => {
    const y = (e.state as { y?: number } | null)?.y ?? 0;
    swap(() => { path.value = location.pathname; query.value = new URLSearchParams(location.search); }, () => scrollTo({ top: y }));
  });
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a');
    if (!a || a.target || a.hasAttribute('download') || a.hasAttribute('data-native')) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    e.preventDefault();
    navigate(href);
  });
}

/** Matches a path against a pattern like "/p/:slug"; returns the named parts, or null. */
export function match(pattern: string, p = path.value): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = p.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}
