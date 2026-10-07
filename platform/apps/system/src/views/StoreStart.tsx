// Start a shop (hemlohq.com → system.hemlohq.com/?start=store): three questions, then a 30-day free trial with
// everything. The same deal as a dental clinic: one free trial per person; after it, Hemlo's team activates the shop.
import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { STRINGS, rtl, type Lang } from '../lib/i18n';
import { Icon, LangPick } from '../components/ui';

export function StoreStart({ lang, setLang, userName, onStarted, onSkip }: { lang: Lang; setLang(l: Lang): void; userName: string; onStarted(orgId: string): Promise<void>; onSkip?: () => void }) {
  const t = STRINGS[lang], s = t.startShop;
  const [f, setF] = useState({ name: '', city: '', shopKind: 'market' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const r = await api<{ organizationId: string }>('/v1/store/start', { body: f }); await onStarted(r.organizationId); }
    catch (x) { setError(x instanceof ApiError ? x.code : 'ERROR'); setBusy(false); }
  };
  const contact = `https://hemlohq.com${lang === 'en' ? '/en' : ''}/contact/?topic=store&business=${encodeURIComponent(f.name)}`;
  return (
    <main className="gate"><form className="box start" onSubmit={submit}>
      <picture><source srcSet={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} media="(prefers-color-scheme: dark)" /><img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}.svg`} alt="Hemlo Systems" /></picture>
      <span className="start-badge"><Icon n="sell" className="h-5 w-5" /></span>
      <h1 className="text-2xl font-semibold">{s.title}</h1>
      <p className="muted">{s.sub}</p>
      <div className="grid w-full gap-3 text-start">
        <label className="field">{s.name}<input className="input" required minLength={2} maxLength={80} autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={s.namePh.replace('{name}', userName.split(/\s+/)[0] || '')} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{s.city}<input className="input" maxLength={60} value={f.city} onChange={(e) => set('city', e.target.value)} placeholder={s.cityPh} /></label>
          <label className="field">{s.kind}<select className="input" value={f.shopKind} onChange={(e) => set('shopKind', e.target.value)}>{Object.entries(s.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
      </div>
      {error && <p className="note bad w-full text-start" role="alert">{error === 'TRIAL_USED' ? <>{s.used} <a className="underline" href={contact}>{t.plan.continue}</a></> : error === 'NETWORK' ? t.errors.network : t.errors.generic}</p>}
      <button className="btn btn-accent w-full justify-center" disabled={busy || f.name.trim().length < 2}>{busy ? <span className="spinner" /> : s.go}</button>
      {onSkip && <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>{s.back}</button>}
      <LangPick lang={lang} setLang={setLang} />
    </form></main>
  );
}
