// A sheet: on phones it rises from the bottom and follows your finger — drag it down (or flick it) to dismiss; on wider
// screens it slides in from the side. Both move on springs from wherever they are, so a sheet can be caught and
// reversed mid-flight. The page behind dims and stays still; Esc or a tap outside closes; focus returns to its opener.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { project, rubberband, spring, tracker, type Spring } from '../lib/motion';

const phone = () => matchMedia('(max-width: 720px)').matches;

export function Sheet({ open, onClose, label, children, class: c = '' }: { open: boolean; onClose(): void; label: string; children: ComponentChildren; class?: string }) {
  const mounted = useSignal(open);
  const panel = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null), opener = useRef<Element | null>(null);
  const st = useRef({ p: 1, anim: null as Spring | null, bottom: false, size: 1, thrown: false });

  // p: 0 = open, 1 = closed. One place paints it.
  const paint = (p: number) => {
    const s = st.current, el = panel.current; s.p = p;
    if (!el) return;
    const rtl = document.documentElement.dir === 'rtl';
    // the side panel floats 12px from the edge, so it travels its width plus that gap to leave the screen
    el.style.transform = s.bottom ? `translate3d(0, ${p * 100}%, 0)` : `translate3d(calc(${(rtl ? -p : p) * 100}% + ${(rtl ? -p : p) * 24}px), 0, 0)`;
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, Math.min(1, 1 - p)));
    // phones: the page behind recedes as the sheet rises (iOS card presentation), tied to the sheet's position
    if (s.bottom) document.documentElement.style.setProperty('--sheet', Math.max(0, Math.min(1, 1 - p)).toFixed(4));
  };
  const go = (to: 0 | 1, velocity = 0, done?: () => void) => {
    const s = st.current; s.anim?.stop();
    s.anim = spring({ from: s.p, to, velocity, damping: to === 0 && velocity ? 0.82 : 1, response: to === 0 ? 0.42 : 0.34, onUpdate: paint, onDone: done });
  };

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      if (mounted.value) go(0); // reopened while closing: turn around from where it is
      else mounted.value = true;
    } else if (mounted.value) {
      if (st.current.thrown) { st.current.thrown = false; return; } // already flying out with the finger's speed
      go(1, 0, () => (mounted.value = false));
      (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    }
  }, [open]);

  // once mounted: start closed, then spring open; lock the page behind
  useEffect(() => {
    if (!mounted.value) return;
    const s = st.current; s.bottom = phone();
    const html = document.documentElement, page = document.querySelector<HTMLElement>('.store-page');
    if (s.bottom && page) {
      // the visible part of the page becomes a rounded card that recedes as the sheet rises
      const below = Math.max(0, page.scrollHeight - scrollY - innerHeight);
      page.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
      page.style.clipPath = `inset(${scrollY}px 0 ${below}px 0 round calc(var(--sheet, 0) * 26px))`;
      html.classList.add('sheet-on');
    }
    paint(s.p = 1);
    requestAnimationFrame(() => { go(0); panel.current?.focus({ preventScroll: true }); });
    const gap = innerWidth - html.clientWidth;
    const body = document.body; body.style.overflow = 'hidden'; body.style.paddingInlineEnd = `${gap}px`; // body, not html: html would unstick the header
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    return () => { removeEventListener('keydown', key); body.style.overflow = ''; body.style.paddingInlineEnd = ''; html.classList.remove('sheet-on'); html.style.removeProperty('--sheet'); const pg = document.querySelector<HTMLElement>('.store-page'); if (pg) { pg.style.clipPath = ''; pg.style.transformOrigin = ''; } st.current.anim?.stop(); };
  }, [mounted.value]);

  // dragging a bottom sheet (by its handle, header or free-delivery bar): it waits for a deliberate 8 px before
  // taking over, then follows the finger 1:1, rubber-bands past the top, and on release lets the velocity decide
  const drag = useRef({ on: false, live: false, y0: 0, p0: 0, id: -1, tr: tracker() });
  const down = (e: PointerEvent) => {
    if (!st.current.bottom || e.button !== 0) return;
    if ((e.target as Element).closest('[data-scroll], input, textarea, select, button, a')) return; // lists scroll, controls stay controls
    Object.assign(drag.current, { on: true, live: false, y0: e.clientY, id: e.pointerId });
  };
  const move = (e: PointerEvent) => {
    const d = drag.current, s = st.current;
    if (!d.on || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y0;
    if (!d.live) {
      if (Math.abs(dy) < 8) return;
      d.live = true; s.anim?.stop(); d.p0 = s.p; d.y0 = e.clientY; d.tr.reset();
      s.size = panel.current!.getBoundingClientRect().height;
      panel.current!.setPointerCapture(e.pointerId);
    }
    d.tr.add(e.clientY);
    const px = d.p0 * s.size + (e.clientY - d.y0);
    paint((px < 0 ? -rubberband(-px, s.size) : px) / s.size);
  };
  const up = (e: PointerEvent) => {
    const d = drag.current, s = st.current;
    if (!d.on || e.pointerId !== d.id) return;
    d.on = false;
    if (!d.live) return;
    const v = d.tr.velocity(), landing = s.p * s.size + project(v);
    if (landing > s.size * 0.4) { s.thrown = true; go(1, v / s.size, () => (mounted.value = false)); onClose(); } else go(0, v / s.size);
  };

  if (!mounted.value) return null;
  return (
    <>
      <div ref={scrim} class="sheet-scrim" style={{ opacity: 0 }} onClick={onClose} />
      <div ref={panel} class={`sheet ${c}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        style={{ transform: 'translate3d(0, 100%, 0)' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span class="sheet-grab" aria-hidden="true" />
        {children}
      </div>
    </>
  );
}
