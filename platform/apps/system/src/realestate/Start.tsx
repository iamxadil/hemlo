// Start an agency (hemlohq.com/realestate → system.hemlohq.com/?start=realestate): a name, a city, a phone, the currency
// they sell in; then straight to adding the first property (the first good moment: add → publish → share).
import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { STRINGS, rtl, type Lang } from '../lib/i18n';
import { LangPick } from '../components/ui';
import { RSTRINGS } from './i18n';
import { RIcon } from './ui';

export function ReStart({ lang, setLang, userName, onStarted, onSkip }: { lang: Lang; setLang(l: Lang): void; userName: string; onStarted(orgId: string): Promise<void>; onSkip?: () => void }) {
  const r = RSTRINGS[lang], t = STRINGS[lang];
  const [f, setF] = useState({ name: '', city: '', phone: '', currency: 'USD' });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const x = await api<{ organizationId: string }>('/v1/re/start', { body: f }); await onStarted(x.organizationId); }
    catch (x) { setError(x instanceof ApiError ? x.code : 'ERROR'); setBusy(false); }
  };
  return (
    <main className="gate"><form className="box start" onSubmit={submit}>
      <picture><source srcSet={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} media="(prefers-color-scheme: dark)" /><img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}.svg`} alt="Hemlo Systems" /></picture>
      <span className="start-badge"><RIcon n="key" className="h-5 w-5" /></span>
      <h1 className="text-2xl font-semibold">{r.start.title}</h1>
      <p className="muted">{r.start.sub}</p>
      <div className="grid w-full gap-3 text-start">
        <label className="field">{r.start.name}<input className="input" required minLength={2} maxLength={80} autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={r.start.namePh.replace('{name}', userName.split(/\s+/)[0] || '')} /></label>
        <label className="field">{r.start.city}<input className="input" maxLength={60} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder={r.start.cityPh} /></label>
        <label className="field">{r.start.phone}<input className="input" dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="07xx xxx xxxx" /></label>
        <div className="grid gap-1.5"><span className="text-sm font-medium text-[var(--fg-2)]">{r.start.currency}</span>
          <div className="seg">{(['USD', 'IQD'] as const).map((c) => <button key={c} type="button" aria-pressed={f.currency === c} onClick={() => setF({ ...f, currency: c })}>{c === 'USD' ? r.common.usd : r.common.iqd}</button>)}</div></div>
      </div>
      {error && <p className="note bad w-full text-start" role="alert">{error === 'TRIAL_USED' ? r.start.used : error === 'BAD_PHONE' ? r.errors.BAD_PHONE : error === 'NETWORK' ? t.errors.network : t.errors.generic}</p>}
      <button className="btn btn-accent w-full justify-center" disabled={busy || f.name.trim().length < 2}>{busy ? <span className="spinner" /> : r.start.go}</button>
      {onSkip && <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>{r.common.back}</button>}
      <LangPick lang={lang} setLang={setLang} />
    </form></main>
  );
}
