// What happens when something goes into the bag (premium-storefront skill §3): the button answers in place with a
// drawn check, the bag's count rolls, and a mini bag drops from the bag pill showing what was added — no thumbnails
// flying across the screen. Every "add" in the shop goes through addToBag().
import { signal, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { add, cartOpen, cartTotals } from '../lib/cart';
import { price } from '../lib/format';
import { s, tx } from '../lib/i18n';
import { tick } from '../lib/motion';
import { navigate } from '../lib/router';
import { productById } from '../lib/store';
import { Icon, Img } from '../ui/kit';

/** The last add: shown by the mini bag. `n` changes on every add so a repeat add refreshes it in place. */
export const lastAdd = signal<{ id: string; qty: number; n: number } | null>(null);
let seq = 0;

export function addToBag(id: string, qty = 1) {
  add(id, qty);
  tick();
  lastAdd.value = { id, qty, n: ++seq };
  // the bag catches it: a small dip and tilt, as if something was dropped in
  document.querySelector('.bag-glyph')?.animate(
    [{ transform: 'none' }, { transform: 'translateY(2px) rotate(-9deg)', offset: 0.3 }, { transform: 'translateY(-1px) rotate(5deg)', offset: 0.62 }, { transform: 'none' }],
    { duration: 560, easing: 'cubic-bezier(.23,1,.32,1)' },
  );
}

/** A button that confirms in place: its label cross-fades to a drawn check + "Added", then back. */
export function AddButton({ id, qty = 1, class: c = '', children, disabled }: { id: string; qty?: number; class?: string; children: ComponentChildren; disabled?: boolean }) {
  const done = useSignal(false), t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button class={`btn add-btn ${c}${done.value ? ' done' : ''}`} disabled={disabled} aria-live="polite"
      onClick={() => { if (done.value) return; addToBag(id, qty); done.value = true; clearTimeout(t.current); t.current = window.setTimeout(() => (done.value = false), 1700); }}>
      <span class="add-btn-idle">{children}</span>
      <span class="add-btn-done" aria-hidden={!done.value}><svg class="draw-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" /></svg>{s.value.addedShort}</span>
    </button>
  );
}

/** The bag, drawn: empty it's an outline; with items it fills and carries the count inside it (the new number rolls in). */
export function BagGlyph() {
  const n = cartTotals.value.count;
  return (
    <span class={`bag-glyph${n ? ' has' : ''}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="bag-handle" d="M8.6 8.4V7.1a3.4 3.4 0 0 1 6.8 0v1.3" />
        <path class="bag-body" d="M5.6 8.4h12.8a.9.9 0 0 1 .9 1l-.95 10.3a1.7 1.7 0 0 1-1.7 1.55H7.35a1.7 1.7 0 0 1-1.7-1.55L4.7 9.4a.9.9 0 0 1 .9-1Z" />
      </svg>
      {n > 0 && <span class="bag-count num"><span key={n}>{n > 9 ? '9+' : n}</span></span>}
    </span>
  );
}

/** The mini bag under the bag pill: what was just added, and the way to the bag or checkout. */
export function MiniBag() {
  const a = lastAdd.value, hold = useSignal(false), panel = useRef<HTMLDivElement>(null), y0 = useRef(0);
  const close = () => (lastAdd.value = null);
  useEffect(() => {
    if (!a || hold.value) return;
    const t = setTimeout(close, 4200);
    return () => clearTimeout(t);
  }, [a?.n, hold.value]);
  useEffect(() => {
    if (!a) return;
    const out = (e: PointerEvent) => !panel.current?.contains(e.target as Node) && !(e.target as Element).closest('.add-btn, .card-add') && close();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('pointerdown', out); addEventListener('keydown', key);
    return () => { removeEventListener('pointerdown', out); removeEventListener('keydown', key); };
  }, [!!a]);
  if (!a) return null;
  const p = productById.value.get(a.id);
  if (!p) return null;
  const count = cartTotals.value.count;
  return (
    <div ref={panel} class="minibag" role="status" key={a.n}
      onPointerEnter={() => (hold.value = true)} onPointerLeave={() => (hold.value = false)}
      onPointerDown={(e) => (y0.current = e.clientY)} onPointerUp={(e) => e.clientY - y0.current < -30 && close()}>
      <p class="minibag-head"><span class="minibag-ok"><svg class="draw-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" /></svg></span>{s.value.added}</p>
      <div class="minibag-item">
        <Img pic={p.pics[0]} ratio="1 / 1" sizes="64px" />
        <span><b>{tx(p.name)}</b><small class="muted"><bdi>{p.size}</bdi>{a.qty > 1 ? ` · × ${a.qty}` : ''}</small></span>
        <span class="num minibag-price">{price(p.price * a.qty)}</span>
      </div>
      <div class="minibag-actions">
        <button class="btn btn-line" onClick={() => { close(); cartOpen.value = true; }}>{s.value.viewBag} <span class="num muted">({count})</span></button>
        <button class="btn btn-solid" onClick={() => { close(); navigate('/checkout'); }}>{s.value.checkout}</button>
      </div>
      <button class="icon-btn minibag-x" onClick={close} aria-label={s.value.close}><Icon n="close" /></button>
    </div>
  );
}
