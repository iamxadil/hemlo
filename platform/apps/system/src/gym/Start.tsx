// Start a gym (hemlohq.com → system.hemlohq.com/?start=gym): three questions, then a 30-day free trial with everything,
// a ready price list and opening hours. One free trial per person; after it, Hemlo's team activates the gym.
import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { STRINGS, rtl, type Lang } from '../lib/i18n';
import { Icon, LangPick } from '../components/ui';
import { GSTRINGS } from './i18n';

export function GymStart({ lang, setLang, userName, onStarted, onSkip }: { lang: Lang; setLang(l: Lang): void; userName: string; onStarted(orgId: string): Promise<void>; onSkip?: () => void }) {
  const g = GSTRINGS[lang], t = STRINGS[lang];
  const [f, setF] = useState({ name: '', city: '', who: 'all' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const r = await api<{ organizationId: string }>('/v1/gym/start', { body: { ...f, lang } }); await onStarted(r.organizationId); }
    catch (x) { setError(x instanceof ApiError ? x.code : 'ERROR'); setBusy(false); }
  };
  const contact = `https://hemlohq.com${lang === 'en' ? '/en' : ''}/contact/?topic=gym&business=${encodeURIComponent(f.name)}`;
  return (
    <main className="gate"><form className="box start" onSubmit={submit}>
      <picture><source srcSet={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} media="(prefers-color-scheme: dark)" /><img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}.svg`} alt="Hemlo Systems" /></picture>
      <span className="start-badge"><Icon n="dumbbell" className="h-5 w-5" /></span>
      <h1 className="text-2xl font-semibold">{g.start.title}</h1>
      <p className="muted">{g.start.sub}</p>
      <div className="grid w-full gap-3 text-start">
        <label className="field">{g.start.name}<input className="input" required minLength={2} maxLength={80} autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={g.start.namePh.replace('{name}', userName.split(/\s+/)[0] || '')} /></label>
        <label className="field">{g.start.city}<input className="input" maxLength={60} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder={g.start.cityPh} /></label>
        <div className="grid gap-1.5"><span className="text-sm font-medium text-[var(--fg-2)]">{g.start.who}</span>
          <div className="seg">{(['all', 'm', 'f'] as const).map((w) => <button key={w} type="button" aria-pressed={f.who === w} onClick={() => setF({ ...f, who: w })}>{g.start.whoOpts[w]}</button>)}</div></div>
      </div>
      {error && <p className="note bad w-full text-start" role="alert">{error === 'TRIAL_USED' ? <>{g.start.used} <a className="underline" href={contact}>{t.plan.continue}</a></> : error === 'NETWORK' ? t.errors.network : t.errors.generic}</p>}
      <button className="btn btn-accent w-full justify-center" disabled={busy || f.name.trim().length < 2}>{busy ? <span className="spinner" /> : g.start.go}</button>
      {onSkip && <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>{g.common.back}</button>}
      <LangPick lang={lang} setLang={setLang} />
    </form></main>
  );
}
