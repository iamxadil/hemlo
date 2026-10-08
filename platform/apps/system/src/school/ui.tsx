// Hemlo School's kit: Radix primitives (select, tabs, segmented control, menus) styled with the School's tokens,
// Vaul sheets (a bottom sheet on phones, a side panel on wide screens), Motion for the moving parts (the active pill,
// numbers that count, a ring that fills), Sonner toasts. Small on purpose: every screen builds from these.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Select as RSelect, Tabs as RTabs, ToggleGroup } from 'radix-ui';
import { Drawer } from 'vaul';
import { motion, animate, useReducedMotion } from 'motion/react';
import { Toaster } from 'sonner';

// ---------- icons (one stroke family) ----------
const P: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  roll: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="m8.5 11 2 2 4-4M8.5 17h7"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 11h-5a2 2 0 0 0 0 4h5z"/>',
  school: '<path d="m4 10 8-6 8 6"/><path d="M6 9v11h12V9M10 20v-5h4v5"/>',
  sparkle: '<path d="M12 3l1.8 4.6L18.5 9.4 13.8 11.2 12 16l-1.8-4.8L5.5 9.4l4.7-1.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  next: '<path d="m9 6 6 6-6 6"/>', prev: '<path d="m15 6-6 6 6 6"/>',
  wa: '<path d="M3 21l1.65-4.94A9 9 0 1 1 7.9 19.3L3 21Z"/><path d="M9 10c.5 2 2 3.5 4 4l1.2-1.2a1 1 0 0 1 1-.25l1.8.6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  bus: '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M8 21v-4M16 21v-4M8 14h.01M16 14h.01"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
};
export function SIcon({ n, className = '' }: { n: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden dangerouslySetInnerHTML={{ __html: P[n] ?? '' }} />;
}

// ---------- small things ----------
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const initialsOf = (name: string) => { const w = (name || '·').trim().split(/\s+/); return /[؀-ۿ]/.test(w[0]) ? w[0][0] : w.slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
export function Avatar({ name, lg = false }: { name: string; lg?: boolean }) {
  return <span className={`sc-avatar${lg ? ' lg' : ''}`} style={{ ['--h' as any]: hue(name) }} aria-hidden>{initialsOf(name)}</span>;
}
export function Empty({ icon = 'users', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return <div className="sc-empty"><span className="ic"><SIcon n={icon} /></span><h3>{title}</h3>{body && <p>{body}</p>}{action}</div>;
}
export const Skel = ({ h = 64, className = '' }: { h?: number; className?: string }) => <div className={`sc-skel ${className}`} style={{ height: h }} />;

export function useWide(min = 768) {
  const q = `(min-width: ${min}px)`;
  const [wide, set] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q), on = () => set(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, [q]);
  return wide;
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
  return <span ref={ref} className="sc-num">{format(value)}</span>;
}

/** A progress ring (attendance taken, present). */
export function Ring({ value, total, label, sub }: { value: number; total: number; label: ReactNode; sub: ReactNode }) {
  const r = 46, c = 2 * Math.PI * r, p = total ? Math.min(1, value / total) : 0;
  return (
    <div className="sc-ring" role="img" aria-label={`${value} / ${total}`}>
      <svg viewBox="0 0 112 112"><circle className="track" cx="56" cy="56" r={r} fill="none" strokeWidth="10" />
        <motion.circle className="fill" cx="56" cy="56" r={r} fill="none" strokeWidth="10" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 1, ease: [0.22, 0.8, 0.24, 1] }} /></svg>
      <div className="center"><b>{label}</b><small>{sub}</small></div>
    </div>
  );
}
export function Bar({ value }: { value: number }) {
  return <div className="sc-bar"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0, Math.min(1, value)) }} transition={{ duration: 0.8, ease: [0.22, 0.8, 0.24, 1] }} /></div>;
}

// ---------- Radix: segmented control, select, tabs ----------
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange(v: T): void; options: { value: T; label: ReactNode }[]; label: string }) {
  const id = useId();
  return (
    <ToggleGroup.Root type="single" className="sc-seg" value={value} onValueChange={(v) => v && onChange(v as T)} aria-label={label}>
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="sc-seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span>{o.label}</span>
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function Select({ value, onChange, options, placeholder, label, id }: { value: string; onChange(v: string): void; options: { value: string; label: string }[]; placeholder?: string; label?: string; id?: string }) {
  return (
    <RSelect.Root value={value || undefined} onValueChange={onChange}>
      <RSelect.Trigger className="sc-select" aria-label={label} id={id}><RSelect.Value placeholder={placeholder} /><RSelect.Icon><SIcon n="chevron" /></RSelect.Icon></RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className="sc-pop" position="popper" sideOffset={6}>
          <RSelect.Viewport>{options.map((o) => <RSelect.Item key={o.value} value={o.value}><RSelect.ItemText>{o.label}</RSelect.ItemText></RSelect.Item>)}</RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

export function Tabs({ value, onChange, tabs, children }: { value: string; onChange(v: string): void; tabs: { value: string; label: ReactNode }[]; children: ReactNode }) {
  const id = useId();
  return (
    <RTabs.Root value={value} onValueChange={onChange}>
      <RTabs.List className="sc-tabs-list">
        {tabs.map((t) => <RTabs.Trigger key={t.value} value={t.value} className="sc-tab">{t.label}{value === t.value && <motion.span layoutId={`tab-${id}`} className="sc-tab-line" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}</RTabs.Trigger>)}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}
export const TabPanel = RTabs.Content;

// ---------- Vaul: the sheet ----------
/** A bottom sheet on phones (drag to close), a side panel on wide screens; Esc and the backdrop close it. */
export function Sheet({ open, onClose, title, sub, children, footer, rtl }: { open: boolean; onClose(): void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; rtl: boolean }) {
  const wide = useWide();
  const direction = wide ? (rtl ? 'left' : 'right') : 'bottom';
  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }} direction={direction as any}>
      <Drawer.Portal>
        <Drawer.Overlay className="sc-overlay" />
        <Drawer.Content className={`sc-sheet ${wide ? `side ${direction}` : 'bottom'}`} dir={rtl ? 'rtl' : 'ltr'} aria-describedby={undefined}>
          {!wide && <div className="sc-sheet-grip" aria-hidden />}
          <div className="sc-sheet-h">
            <div className="min-w-0 flex-1"><Drawer.Title asChild><h2>{title}</h2></Drawer.Title>{sub && <p className="sc-sub mt-1">{sub}</p>}</div>
            <button className="sc-btn sc-btn-ghost sc-btn-icon sc-btn-sm" onClick={onClose} aria-label="close"><SIcon n="close" /></button>
          </div>
          <div className="sc-sheet-b">{children}</div>
          {footer && <div className="sc-sheet-f">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function SToaster({ rtl }: { rtl: boolean }) {
  return <Toaster position="top-center" dir={rtl ? 'rtl' : 'ltr'} richColors closeButton={false} toastOptions={{ duration: 2600 }} />;
}

/** Page entrance: a short rise (nothing with reduced motion). Keeps every screen consistent. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const still = useReducedMotion();
  return <motion.div className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${className}`} initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}>{children}</motion.div>;
}

/** Staggered list items (first paint only: lists that refresh don't dance). */
export function useStagger() {
  const first = useRef(true);
  useEffect(() => { const t = setTimeout(() => { first.current = false; }, 900); return () => clearTimeout(t); }, []);
  return useMemo(() => (i: number) => (first.current ? { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { delay: Math.min(i, 12) * 0.025, duration: 0.25 } } : {}), []);
}
