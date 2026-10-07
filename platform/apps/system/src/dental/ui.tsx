// Small pieces of the clinic's look: the Hemlo H (the founder's mark, exactly as drawn; the product colour goes on
// it), a segmented control whose pill slides to the chosen option, numbers that count up, and a progress ring.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const H = 'M16.298 3.894L15.781 3.547C14.576 2.739 12.958 3.602 12.958 5.053L12.958 11.671L11.742 11.2C11.32 11.037 11.042 10.631 11.042 10.178L11.042 7.162C11.042 5.289 10.109 3.539 8.553 2.496L6.602 1.187C5.874 0.699 4.896 1.221 4.896 2.097L4.896 15.368C4.896 17.605 6.037 19.687 7.923 20.89L9.357 21.805C10.087 22.271 11.042 21.747 11.042 20.882L11.042 14.878C11.042 14.108 11.815 13.578 12.533 13.856L12.958 14.021L12.958 16.586C12.958 19.068 14.224 21.378 16.317 22.713C17.523 23.483 19.104 22.616 19.104 21.184L19.104 9.155C19.104 7.043 18.052 5.07 16.298 3.894Z';
export const HMark = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d={H} fill="currentColor" /></svg>
);

/** A segmented control: the white pill glides to the chosen option. */
export function SlideSeg<T extends string>({ value, options, onChange, className = '' }: { value: T; options: [T, ReactNode][]; onChange(v: T): void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current?.querySelector<HTMLButtonElement>(`[data-v="${CSS.escape(value)}"]`);
    if (el && box.current) { const b = box.current.getBoundingClientRect(), r = el.getBoundingClientRect(); setPill({ x: r.left - b.left, w: r.width }); }
  }, [value, options.length]);
  useEffect(() => {
    const on = () => { const el = box.current?.querySelector<HTMLButtonElement>(`[data-v="${CSS.escape(value)}"]`); if (el && box.current) { const b = box.current.getBoundingClientRect(), r = el.getBoundingClientRect(); setPill({ x: r.left - b.left, w: r.width }); } };
    window.addEventListener('resize', on); return () => window.removeEventListener('resize', on);
  }, [value]);
  return (
    <div ref={box} className={`sseg ${className}`} role="tablist">
      {pill && <span className="sseg-pill" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} aria-hidden="true" />}
      {options.map(([v, label]) => <button key={v} data-v={v} role="tab" aria-selected={v === value} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  );
}

/** A number that counts up to its value (and glides between values), like a watch face. */
export function useCountUp(value: number, ms = 800) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); from.current = value; return; }
    const a = from.current, start = performance.now(); let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** A progress ring (the day: how many of today's patients are done). Segments by stage, drawn in on arrival. */
export function Ring({ parts, total, size = 148, stroke = 12, children }: { parts: { value: number; className: string }[]; total: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let at = 0;
  return (
    <div className="hring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="hring-track" strokeWidth={stroke} fill="none" />
        {parts.map((p, i) => {
          if (!p.value) return null;
          const len = total ? (p.value / total) * c : 0;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} className={`hring-part ${p.className}`} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${Math.max(0, len - (len > stroke ? 3 : 0))} ${c}`} strokeDashoffset={-at} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ ['--len' as any]: len }} />;
          at += len;
          return el;
        })}
      </svg>
      <div className="hring-in">{children}</div>
    </div>
  );
}
