// Small shared pieces: icons, the sheet (side drawer on desktop, bottom sheet on phones), money, empty states.
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../lib/app';
import { LANGS, rtl, type Lang } from '../lib/i18n';

const P: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></>,
  sell: <><path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7L4 7Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></>,
  products: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  customers: <><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4Z" /><path d="M8 9h8M8 13h5" /></>,
  sales: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />, minus: <path d="M5 12h14" />, close: <path d="M18 6 6 18M6 6l12 12" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  scan: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M8 8v8M11 8v8M14 8v8M17 8v8" /></>,
  print: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  wa: <><path d="M3 21l1.65-4.94A9 9 0 1 1 7.9 19.3L3 21Z" /><path d="M9 10c.5 2 2 3.5 4 4l1.2-1.2a1 1 0 0 1 1-.25l1.8.6" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />,
  check: <path d="M20 6 9 17l-5-5" />, globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>,
  out: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />, user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  box: <><path d="M3 7h18v13H3z" /><path d="M3 7l2-4h14l2 4M9 11h6" /></>, info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  wifi: <><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><path d="M12 20h.01" /><path d="M3 3l18 18" /></>,
  edit: <><path d="M4 20h4L20 8l-4-4L4 16v4Z" /></>, store: <><path d="M4 9h16l-1-5H5L4 9Z" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  truck: <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  wallet: <><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Z" /><path d="M4 7l11-3v3M16 13h.01" /></>,
  drawer: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 13h18M10 16.5h4" /><circle cx="12" cy="8.5" r="1.5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  download: <><path d="M12 4v12m0 0-4-4m4 4 4-4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  back: <path d="M15 6l-6 6 6 6" />,
  display: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" /></>,
  camera: <><path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" /><path d="M7.5 14h9" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  tooth: <path d="M7 3c-2.2 0-4 1.8-4 4.3 0 2.2.9 3.5 1.6 5.4.7 2 .9 4.6 1.4 6.6.3 1.3 1 2.2 1.9 2.2 1.3 0 1.6-1.6 2-3.6.3-1.5.6-2.9 2.1-2.9s1.8 1.4 2.1 2.9c.4 2 .7 3.6 2 3.6.9 0 1.6-.9 1.9-2.2.5-2 .7-4.6 1.4-6.6.7-1.9 1.6-3.2 1.6-5.4C21 4.8 19.2 3 17 3c-1.7 0-2.8 1-5 1S8.7 3 7 3Z" />,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  pen: <><path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="m14 6 4 4" /></>,
  pill: <><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" /><path d="m9 9 6 6" /></>,
  chair: <><path d="M6 3v8.5a2 2 0 0 0 2 2h9" /><path d="M17 13.5V10a2 2 0 0 1 2-2" /><path d="M9 13.5 7 21M15 13.5l2 7.5M8 18h8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  door: <><path d="M14 3H6a1 1 0 0 0-1 1v17h9" /><path d="M14 3l5 2v16l-5 0Z" /><path d="M11 12h.01" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  dumbbell: <><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></>,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  clip: <path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />,
};
export const Icon = ({ n, className = '' }: { n: keyof typeof P | string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{P[n]}</svg>
);

/** The Hemlo Systems lockup, in the page's language and theme. */
export function Logo({ className = '' }: { className?: string }) {
  const { lang } = useApp();
  const base = rtl(lang) ? '/brand/hemlo-systems-ar' : '/brand/hemlo-systems';
  return (
    <picture>
      <source srcSet={`${base}-on-dark.svg`} media="(prefers-color-scheme: dark)" />
      <img src={`${base}.svg`} alt="Hemlo Systems" className={className} />
    </picture>
  );
}

export function Money({ v, className = '' }: { v: number | null | undefined; className?: string }) {
  const { num, t } = useApp();
  if (v == null) return <span className={className}>—</span>;
  return <span className={`money ${className}`}>{num(v)}<small>{t.iqd}</small></span>;
}

export function Sheet({ title, sub, onClose, children, footer, center = false, icon }: { title: ReactNode; sub?: ReactNode; onClose(): void; children: ReactNode; footer?: ReactNode; center?: boolean; icon?: ReactNode }) {
  const { t } = useApp();
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  // a portal: a parent with a blur or transform must never become the sheet's frame
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <section className={`sheet${center ? ' center' : ''}`} role="dialog" aria-modal="true">
        <header className="sheet-h">
          {icon}
          <div className="min-w-0 flex-1"><h2 className="truncate">{title}</h2>{sub && <div className="sub mt-0.5">{sub}</div>}</div>
          <button className="icon-btn" onClick={onClose} aria-label={t.close}><Icon n="close" /></button>
        </header>
        <div className="sheet-b">{children}</div>
        {footer && <footer className="sheet-f">{footer}</footer>}
      </section>
    </>,
    document.body,
  );
}

/** Pick the language: Arabic, Kurdish, English. */
export function LangPick({ lang, setLang, className = '' }: { lang: Lang; setLang(l: Lang): void; className?: string }) {
  return (
    <label className={`lang-pick ${className}`}><Icon n="globe" />
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language · اللغة · زمان">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    </label>
  );
}

export const Empty = ({ icon = 'box', text, action }: { icon?: string; text: string; action?: ReactNode }) => (
  <div className="empty"><Icon n={icon} /><p>{text}</p>{action && <div className="mt-4">{action}</div>}</div>
);

/** Whole-dinar input: digits only (Arabic-Indic digits accepted), shown with thousands separators while typing. */
export function DinarInput({ value, onChange, autoFocus, id, placeholder }: { value: number | null; onChange(v: number | null): void; autoFocus?: boolean; id?: string; placeholder?: string }) {
  const { num } = useApp();
  return (
    <input id={id} className="input money" inputMode="numeric" dir="ltr" autoFocus={autoFocus} placeholder={placeholder}
      value={value == null ? '' : num(value)}
      onChange={(e) => { const d = toLatin(e.target.value).replace(/\D/g, ''); onChange(d ? Math.min(2_000_000_000, Number(d)) : null); }} />
  );
}
export const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
