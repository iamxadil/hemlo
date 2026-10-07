// Motion, the Apple way (WWDC "Designing Fluid Interfaces"): springs described by damping ratio and response, that
// start from where things are and carry the finger's velocity; momentum projection; rubber-band edges; reveals that
// happen once. Everything respects "reduce motion".
import { signal } from '@preact/signals';

const rm = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = signal(rm.matches);
rm.addEventListener('change', (e) => (reduced.value = e.matches));

export interface Spring { stop(): void }
/**
 * Animates a number from `from` to `to`. `damping` 1 = no overshoot (the default for UI); ~0.8 only after a flick.
 * `response` ≈ how quickly it gets there, in seconds. `velocity` is in units per second (px/s for positions).
 */
export function spring(o: { from: number; to: number; velocity?: number; damping?: number; response?: number; onUpdate(v: number): void; onDone?(): void }): Spring {
  const { to, damping = 1, response = 0.38, onUpdate, onDone } = o;
  if (reduced.value) { onUpdate(to); onDone?.(); return { stop() {} }; }
  const k = (2 * Math.PI / response) ** 2, c = (4 * Math.PI * damping) / response; // unit mass
  let x = o.from - to, v = o.velocity ?? 0, last = 0, raf = 0;
  const step = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
    for (let i = 0; i < n; i++) { v += (-k * x - c * v) * h; x += v * h; } // semi-implicit Euler, small steps: stable
    if (Math.abs(x) < 0.25 && Math.abs(v) < 4) { onUpdate(to); onDone?.(); return; }
    onUpdate(to + x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { stop: () => cancelAnimationFrame(raf) };
}

/** Where a flick would come to rest (Apple's projection, the same deceleration as scrolling). */
export const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);
/** Past an edge, things slow before they stop. */
export const rubberband = (over: number, size: number, c = 0.55) => (over * size * c) / (size + c * Math.abs(over));

/** Tracks a pointer's recent positions so a release can hand its velocity (px/s) to a spring. */
export function tracker() {
  let pts: [number, number][] = [];
  return {
    add(v: number) { const t = performance.now(); pts.push([t, v]); pts = pts.filter(([pt]) => t - pt < 100); },
    velocity() { const now = performance.now(); pts = pts.filter(([pt]) => now - pt < 100); if (pts.length < 2) return 0; // a finger that stopped before letting go has no velocity
      const [t0, v0] = pts[0], [t1, v1] = pts[pts.length - 1]; return t1 > t0 ? ((v1 - v0) / (t1 - t0)) * 1000 : 0; },
    reset() { pts = []; },
  };
}

// ---- reveals: elements with .rv rise into place once, the first time they come into view (staggered by --d) ----
let io: IntersectionObserver | null = null;
export function observeReveals(root: ParentNode = document) {
  const els = root.querySelectorAll<HTMLElement>('.rv:not(.in)');
  if (reduced.value || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  io ??= new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io!.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  els.forEach((e) => io!.observe(e));
}

/** Light haptic tick where phones allow it (Android); silent elsewhere. Used only on commit moments. */
export const tick = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };
