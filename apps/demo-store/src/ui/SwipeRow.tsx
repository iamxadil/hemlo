// A list row you can swipe to reveal Delete, like iOS: it waits for a clearly sideways move (so vertical scrolling
// still works), follows the finger 1:1, resists past its limit, and on release lets velocity decide open or shut.
// Mirrors in Arabic. A tap on an open row closes it instead of following its link.
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { project, rubberband, spring, tracker, type Spring } from '../lib/motion';
import { Icon } from './kit';

const W = 88; // the width of the Delete button

export function SwipeRow({ children, onDelete, label }: { children: ComponentChildren; onDelete(): void; label: string }) {
  const row = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 0, base: 0, x0: 0, y0: 0, id: -1, on: false, side: false, anim: null as Spring | null, tr: tracker(), moved: false });
  const sign = () => (document.documentElement.dir === 'rtl' ? 1 : -1); // which way "open" is
  const set = (x: number) => {
    st.current.x = x;
    const el = row.current; if (!el) return;
    el.style.transform = `translate3d(${x}px,0,0)`;
    el.parentElement!.classList.toggle('swiping', Math.abs(x) > 0.5); // the red only exists while the row is moved
  };
  const to = (open: boolean, velocity = 0) => {
    const s = st.current; s.anim?.stop();
    s.anim = spring({ from: s.x, to: open ? sign() * W : 0, velocity, damping: 0.92, response: 0.32, onUpdate: set });
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const s = st.current; s.anim?.stop();
    Object.assign(s, { on: true, side: false, moved: false, x0: e.clientX, y0: e.clientY, id: e.pointerId, base: s.x });
    s.tr.reset(); s.tr.add(e.clientX);
  };
  const move = (e: PointerEvent) => {
    const s = st.current;
    if (!s.on || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.side) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { s.on = false; return; } // a scroll, not a swipe
      if (Math.abs(dx) < 8) return;
      s.side = true; s.moved = true; row.current!.setPointerCapture(e.pointerId);
    }
    s.tr.add(e.clientX);
    const k = sign(), t = (s.base + dx) * k; // t > 0 means "towards open"
    const shown = t < 0 ? -rubberband(-t, W * 2) : t > W ? W + rubberband(t - W, W * 2) : t;
    set(shown * k);
  };
  const up = (e: PointerEvent) => {
    const s = st.current;
    if (!s.on || e.pointerId !== s.id) return;
    s.on = false;
    if (!s.side) return;
    const v = s.tr.velocity(), landing = s.x * sign() + project(v * sign(), 0.99);
    to(landing > W / 2, v);
  };
  return (
    <div class="swipe">
      <button class="swipe-del" tabIndex={-1} onClick={onDelete} aria-label={label}><Icon n="trash" /><span>{label}</span></button>
      <div class="swipe-front" ref={row} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => { const s = st.current; if (s.moved) { e.preventDefault(); e.stopPropagation(); s.moved = false; } else if (Math.abs(s.x) > 2) { e.preventDefault(); e.stopPropagation(); to(false); } }}>
        {children}
      </div>
    </div>
  );
}
