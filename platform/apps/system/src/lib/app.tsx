// App-wide context: language, copy, the business and what I may do in it, formatting, toasts, and routing.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STRINGS, fill, locale as localeOf, readLang, rtl, type Lang, type Strings } from './i18n';
import { ApiError, type SysMe } from './api';

export interface AppCtx {
  lang: Lang; t: Strings; setLang(l: Lang): void;
  me: any; sys: SysMe; can(k: string): boolean;
  money(n: number | null | undefined): string; num(n: number): string; qty(n: number, unit: string): string;
  date(d: string | Date): string; time(d: string | Date): string; dateTime(d: string | Date): string;
  toast(text: string, kind?: 'ok' | 'bad'): void; errorText(e: unknown): string;
}
const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => useContext(Ctx)!;
export { fill };

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, set] = useState<Lang>(readLang);
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem('hemlo.lang', l); } catch {}
    document.documentElement.lang = l; document.documentElement.dir = rtl(l) ? 'rtl' : 'ltr';
    document.title = STRINGS[l].app; set(l);
  }, []);
  return [lang, setLang];
}

export function AppProvider({ lang, setLang, me, sys, children }: { lang: Lang; setLang(l: Lang): void; me: any; sys: SysMe; children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const value = useMemo<AppCtx>(() => {
    const t = STRINGS[lang];
    const locale = localeOf(lang);
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    const tz = { timeZone: 'Asia/Baghdad' } as const;
    return {
      lang, t, setLang, me, sys,
      can: (k) => !!sys.can[k],
      money: (n) => (n == null ? '—' : `${nf.format(n)} ${t.iqd}`),
      num: (n) => nf.format(n),
      qty: (n, unit) => (unit === 'piece' ? nf.format(n) : `${nf.format(n)} ${t.products.units[unit] ?? unit}`),
      // browsers have no Kurdish month names: Kurdish shows dates as 30/09/2026 and 24-hour times
      date: (d) => (lang === 'ckb' ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', ...tz }) : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...tz })).format(new Date(d)),
      time: (d) => new Intl.DateTimeFormat(lang === 'ckb' ? 'en-GB' : locale, { timeStyle: 'short', ...tz }).format(new Date(d)),
      dateTime: (d) => (lang === 'ckb' ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', ...tz }) : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', ...tz })).format(new Date(d)),
      toast: (text, kind = 'ok') => { const id = Date.now() + Math.random(); setToasts((x) => [...x, { id, text, kind }]); setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 2800); },
      errorText: (e) => (e instanceof ApiError ? (e.code === 'NETWORK' ? t.errors.network : t.errors[e.code] ?? (t.fib as any)[e.code] ?? (t.tillSettings as any)[e.code] ?? t.errors.generic) : t.errors.generic),
    };
  }, [lang, me, sys, setLang]);
  return <Ctx.Provider value={value}>{children}{toasts.map((x) => <div key={x.id} className={`toast ${x.kind === 'bad' ? 'bad' : ''}`} role="status">{x.text}</div>)}</Ctx.Provider>;
}

/** Hash routes: #/sell, #/products?id=…, #/customers?id=… */
export function useRoute() {
  const read = () => { const [p, q] = (location.hash.slice(2) || '').split('?'); return { path: p, params: new URLSearchParams(q) }; };
  const [r, setR] = useState(read);
  useEffect(() => { const on = () => setR(read()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return r;
}
export const go = (hash: string) => { location.hash = hash; };

/** Iraq is UTC+3 all year: local midnight → UTC instant. */
export function dayRange(daysBack: number, span = 1) {
  const now = new Date(Date.now() + 3 * 3600_000);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * 3600_000 - daysBack * 86400_000;
  return { from: new Date(start - (span - 1) * 86400_000).toISOString(), to: new Date(start + 86400_000).toISOString() };
}
export const initials = (n: string) => { const w = (n || '·').trim().split(/\s+/); return /[؀-ۿ]/.test(w[0]) ? w[0][0] : w.slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
export const localPhone = (p?: string | null) => (p ? p.replace(/^\+964(\d{3})(\d{3})(\d{4})$/, '0$1 $2 $3') : '');
