// A horizontal row of cards, Apple-store style: it snaps card by card, scrolls natively on touch and trackpads, has
// round arrow buttons that know when an end is reached, and with a mouse you can grab it and throw it.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { project, reduced, tracker } from '../lib/motion';
import { Icon } from './kit';

export function Rail({ title, sub, link, children }: { title: string; sub?: string; link?: ComponentChildren; children: ComponentChildren }) {
  const track = useRef<HTMLDivElement>(null), ends = useSignal<[boolean, boolean]>([true, false]);
  const sense = () => {
    const el = track.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth, x = Math.abs(el.scrollLeft); // RTL scrolls negative
    ends.value = [x < 4, x > max - 4];
  };
  useEffect(() => { sense(); const el = track.current!; el.addEventListener('scroll', sense, { passive: true }); addEventListener('resize', sense); return () => { el.removeEventListener('scroll', sense); removeEventListener('resize', sense); }; }, []);
  const page = (dir: 1 | -1) => {
    const el = track.current!, rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: reduced.value ? 'auto' : 'smooth' });
  };
  // mouse: grab and throw (touch and trackpads already scroll natively)
  const d = useRef({ on: false, x: 0, left: 0, moved: false, tr: tracker() });
  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = track.current!;
    Object.assign(d.current, { on: true, x: e.clientX, left: el.scrollLeft, moved: false });
    d.current.tr.reset(); d.current.tr.add(e.clientX);
  };
  const move = (e: PointerEvent) => {
    const s = d.current; if (!s.on) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) < 6) return;
    if (!s.moved) { s.moved = true; track.current!.setPointerCapture(e.pointerId); track.current!.classList.add('grabbing'); }
    s.tr.add(e.clientX);
    track.current!.scrollLeft = s.left - dx;
  };
  const up = () => {
    const s = d.current; if (!s.on) return;
    s.on = false;
    const el = track.current!; el.classList.remove('grabbing');
    if (s.moved) el.scrollBy({ left: -project(s.tr.velocity(), 0.994), behavior: 'smooth' }); // throw, then snap
  };
  return (
    <section class="rail">
      <div class="wrap rail-head rv">
        <div><h2 class="display">{title}</h2>{sub && <p class="muted">{sub}</p>}</div>
        {link}
      </div>
      <div class="rail-track" ref={track} data-scroll onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => { if (d.current.moved) { e.preventDefault(); e.stopPropagation(); d.current.moved = false; } }}>
        {children}
      </div>
      <div class="wrap rail-nav">
        <button class="rail-btn" disabled={ends.value[0]} onClick={() => page(-1)} aria-label="‹"><Icon n="chev" class="flip mirror" /></button>
        <button class="rail-btn" disabled={ends.value[1]} onClick={() => page(1)} aria-label="›"><Icon n="chev" class="flip" /></button>
      </div>
    </section>
  );
}
