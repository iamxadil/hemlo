// What every School screen builds from: the shadcn/ui components (components/ui), lucide icons, and the few pieces
// of our own on top: the page entrance, a number that counts, the attendance ring, an empty state, list stagger.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { motion, animate, useReducedMotion, useMotionValue, useSpring, useTransform } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
export * from './components/ui/core';
export * from './components/ui/overlay';
export { cn } from './lib/utils';

export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2.5 px-5 py-12 text-center">
      <span className="bg-primary-soft text-primary grid size-14 place-items-center rounded-2xl"><Icon className="size-6" /></span>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {body && <p className="text-muted-foreground max-w-[34ch] text-[14px]">{body}</p>}
      {action}
    </div>
  );
}

/** Page entrance: a short rise (nothing with reduced motion). */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  return <motion.div className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${className}`} initial={still ? false : { opacity: 0, y: 14, scale: 0.985, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.45, ease: [0.22, 0.8, 0.24, 1] }}>{children}</motion.div>;
}

/** A number that counts to its value (instantly with reduced motion). */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null), from = useRef(0), still = useReducedMotion();
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (still) { el.textContent = format(value); from.current = value; return; }
    const c = animate(from.current, value, { duration: 0.9, ease: [0.22, 0.8, 0.24, 1], onUpdate: (v) => { el.textContent = format(Math.round(v)); } });
    from.current = value;
    return () => c.stop();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className="tabular-nums">{format(value)}</span>;
}

/** A progress ring (today's attendance). */
export function Ring({ value, total, label, sub }: { value: number; total: number; label: ReactNode; sub: ReactNode }) {
  const r = 46, c = 2 * Math.PI * r, p = total ? Math.min(1, value / total) : 0;
  return (
    <div className="sc-ring" role="img" aria-label={`${value} / ${total}`}>
      <svg viewBox="0 0 112 112"><defs><linearGradient id="sc-ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5EEAB0" /><stop offset="1" stopColor="#7CC8FF" /></linearGradient></defs><circle className="track" cx="56" cy="56" r={r} fill="none" strokeWidth="9" />
        <motion.circle className="fill" cx="56" cy="56" r={r} fill="none" strokeWidth="9" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 1, ease: [0.22, 0.8, 0.24, 1] }} /></svg>
      <div className="center"><b>{label}</b><small>{sub}</small></div>
    </div>
  );
}

/** Staggered list items on first paint only (lists that refresh don't dance). */
export function useStagger() {
  const first = useRef(true);
  useEffect(() => { const t = setTimeout(() => { first.current = false; }, 900); return () => clearTimeout(t); }, []);
  return useMemo(() => (i: number) => (first.current ? { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { delay: Math.min(i, 12) * 0.025, duration: 0.25 } } : {}), []);
}

/** A row in a list card: avatar, text, trailing things. Clickable when it has an href. */
export function Row({ href, onClick, children, className = '', ...motionProps }: { href?: string; onClick?(): void; children: ReactNode; className?: string } & Record<string, unknown>) {
  const cls = `flex w-full items-center gap-3 border-t border-border px-5 py-3 text-start first:border-t-0 ${href || onClick ? 'transition-colors hover:bg-secondary/60' : ''} ${className}`;
  if (href) return <motion.a href={href} className={cls} {...motionProps}>{children}</motion.a>;
  if (onClick) return <motion.button type="button" onClick={onClick} className={cls} {...motionProps}>{children}</motion.button>;
  return <motion.div className={cls} {...motionProps}>{children}</motion.div>;
}

/** The living field behind everything: slow drifting light, nudged by the pointer (still with reduced motion). */
export function Aurora() {
  const ref = useRef<HTMLDivElement>(null), still = useReducedMotion();
  useEffect(() => {
    if (still || matchMedia('(hover: none)').matches) return;
    let raf = 0;
    const on = (e: PointerEvent) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const el = ref.current; if (!el) return;
      el.style.setProperty('--px', String((e.clientX / innerWidth - 0.5) * 2)); el.style.setProperty('--py', String((e.clientY / innerHeight - 0.5) * 2)); }); };
    addEventListener('pointermove', on, { passive: true });
    return () => { removeEventListener('pointermove', on); cancelAnimationFrame(raf); };
  }, [still]);
  return <div ref={ref} className="sc-aurora" aria-hidden><i /><i /><i /><i /></div>;
}

/** A panel that leans toward the pointer, a few degrees, on a spring (flat on touch screens and with reduced motion). */
export function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 220, damping: 22 }), ry = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 220, damping: 22 });
  if (still) return <div className={className}>{children}</div>;
  return (
    <motion.div className={`sc-tilt ${className}`} style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => { if (e.pointerType !== 'mouse') return; const b = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - b.left) / b.width - 0.5); y.set((e.clientY - b.top) / b.height - 0.5); }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>{children}</motion.div>
  );
}
