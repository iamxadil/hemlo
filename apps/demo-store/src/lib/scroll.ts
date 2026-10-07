// Scroll-linked moments, cheaply: work only while the element is on screen, at most once per frame, writing a CSS
// variable (--p) instead of re-rendering. And the header's tone: it turns dark while it sits over a dark section.

/** Reports how far a tall section has been scrolled through while pinned (0 at its top, 1 at its end). */
export function pinProgress(el: HTMLElement, cb: (p: number) => void) {
  let raf = 0, on = false;
  const read = () => {
    raf = 0;
    const r = el.getBoundingClientRect(), span = r.height - innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    el.style.setProperty('--p', p.toFixed(4));
    cb(p);
  };
  const tick = () => { if (on && !raf) raf = requestAnimationFrame(read); };
  const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) tick(); });
  io.observe(el);
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick, { passive: true });
  read();
  return () => { io.disconnect(); removeEventListener('scroll', tick); removeEventListener('resize', tick); cancelAnimationFrame(raf); };
}

/** The header goes dark (light text on dark glass) while a [data-tone="dark"] section passes under it. */
let toneIO: IntersectionObserver | null = null;
const under = new Set<Element>();
export function watchTone() {
  toneIO?.disconnect(); under.clear();
  // the band where the header sits: from the top of the screen to the header's bottom (it starts lower while the
  // announcement bar is still in view)
  const nav = document.querySelector('.nav')?.getBoundingClientRect(), bottom = Math.round(nav ? Math.max(nav.bottom, nav.height) : 56);
  toneIO = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? under.add(e.target) : under.delete(e.target);
    document.documentElement.classList.toggle('nav-dark', under.size > 0);
  }, { rootMargin: `0px 0px -${Math.max(0, innerHeight - bottom)}px 0px` });
  document.querySelectorAll('[data-tone="dark"]').forEach((el) => toneIO!.observe(el));
  if (!document.querySelector('[data-tone="dark"]')) document.documentElement.classList.remove('nav-dark');
}
