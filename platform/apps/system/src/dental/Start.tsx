// Start a clinic (hemlohq.com → system.hemlohq.com/?start=dental): four questions, then a 30-day free trial with
// everything. One free trial per person; after that, Hemlo's team activates the clinic.
import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { STRINGS, rtl, type Lang } from '../lib/i18n';
import { Icon, LangPick } from '../components/ui';
import { DSTRINGS } from './i18n';
import './dental.css';

export function Start({ lang, setLang, userName, onStarted, onSkip }: { lang: Lang; setLang(l: Lang): void; userName: string; onStarted(orgId: string): Promise<void>; onSkip?: () => void }) {
  const d = DSTRINGS[lang], t = STRINGS[lang];
  const [f, setF] = useState({ name: '', city: '', specialty: 'general', chairs: 2 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api<{ organizationId: string }>('/v1/dent/start', { body: { ...f, lang } });
      await onStarted(r.organizationId);
    } catch (x) {
      setError(x instanceof ApiError ? x.code : 'ERROR');
      setBusy(false);
    }
  };
  const contact = `https://hemlohq.com${lang === 'en' ? '/en' : ''}/contact/?topic=dental&business=${encodeURIComponent(f.name)}`;
  return (
    <main className="gate"><form className="box start" onSubmit={submit}>
      <picture><source srcSet={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} media="(prefers-color-scheme: dark)" /><img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}.svg`} alt="Hemlo Systems" /></picture>
      <span className="start-badge"><Icon n="tooth" className="h-5 w-5" /></span>
      <h1 className="text-2xl font-semibold">{d.start.title}</h1>
      <p className="muted">{d.start.sub}</p>
      <div className="grid w-full gap-3 text-start">
        <label className="field">{d.start.name}<input className="input" required minLength={2} maxLength={80} autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={d.start.namePh.replace('{name}', userName)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{d.start.city}<input className="input" maxLength={60} value={f.city} onChange={(e) => set('city', e.target.value)} placeholder={d.start.cityPh} /></label>
          <label className="field">{d.start.chairs}<select className="input" value={f.chairs} onChange={(e) => set('chairs', Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <label className="field">{d.start.specialty}<select className="input" value={f.specialty} onChange={(e) => set('specialty', e.target.value)}>{Object.entries(d.clinic.specialties).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      {error && <p className="note bad w-full text-start" role="alert">{error === 'TRIAL_USED' ? <>{d.start.used} <a className="underline" href={contact}>{t.plan.continue}</a></> : error === 'NETWORK' ? t.errors.network : t.errors.generic}</p>}
      <button className="btn btn-accent w-full justify-center" disabled={busy || f.name.trim().length < 2}>{busy ? <span className="spinner" /> : d.start.go}</button>
      {onSkip && <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>{d.common.back}</button>}
      <LangPick lang={lang} setLang={setLang} />
    </form></main>
  );
}
