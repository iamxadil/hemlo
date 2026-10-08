// Starting a school: its name, what kind it is (the grades are set up from that), city and phone. 30 days free.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api, ApiError } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { sOf } from './i18n';
import { SIcon } from './ui';
import './school.css';

export function SchStart({ lang, setLang, userName, onStarted, onSkip }: { lang: Lang; setLang(l: Lang): void; userName: string; onStarted(orgId: string): void; onSkip?: () => void }) {
  const s = sOf(lang);
  useEffect(() => { document.documentElement.classList.add('sc'); return () => document.documentElement.classList.remove('sc'); }, []);
  const [name, setName] = useState(''), [kind, setKind] = useState('school'), [city, setCity] = useState(''), [phone, setPhone] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr(s.errors.BAD_NAME);
    setBusy(true); setErr('');
    try { const r = await api<{ organizationId: string }>('/v1/sch/start', { body: { name, kind, city: city || null, phone: phone || null, lang: lang === 'en' ? 'en' : 'ar' } }); onStarted(r.organizationId); }
    catch (x) { setErr(x instanceof ApiError ? s.errors[x.code] ?? x.code : String(x)); setBusy(false); }
  };
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.form onSubmit={go} className="sc-card grid w-full max-w-[520px] gap-5 p-6 sm:p-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 0.8, 0.24, 1] }}>
        <div className="flex items-center justify-between"><span className="flex items-center gap-2"><img src="/brand/hemlo-mark.svg" alt="" className="h-7 w-7" /><b>Hemlo School</b></span>
          <button type="button" className="sc-btn sc-btn-ghost sc-btn-sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}><SIcon n="globe" />{lang === 'en' ? 'العربية' : 'English'}</button></div>
        <div><h1 className="text-[26px] font-semibold tracking-tight">{s.start.title}{userName ? '' : ''}</h1><p className="sc-sub mt-1 text-[14.5px]">{s.start.sub}</p></div>
        <label className="sc-field"><span>{s.start.name}</span><input id="ss-name" className="sc-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <div className="sc-field"><span>{s.start.kind}</span>
          <div className="grid gap-2 sm:grid-cols-3">{(['school', 'institute', 'kindergarten'] as const).map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)} className={`grid gap-1 rounded-2xl border p-3 text-start transition-colors ${kind === k ? 'border-[var(--s-accent)] bg-[var(--s-accent-soft)]' : 'border-[var(--s-line)]'}`}>
              <b className="text-[14.5px]">{s.kinds[k]}</b><span className="sc-sub text-[12.5px]">{s.start.kindSub[k]}</span></button>))}</div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sc-field"><span>{s.start.city}</span><input id="ss-city" className="sc-input" value={city} onChange={(e) => setCity(e.target.value)} /></label>
          <label className="sc-field"><span>{s.start.phone}</span><input id="ss-phone" className="sc-input" dir="ltr" type="tel" inputMode="tel" placeholder="07XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        </div>
        {err && <p className="text-[13.5px] text-[var(--s-absent)]" role="alert">{err}</p>}
        <button className="sc-btn sc-btn-primary sc-btn-block h-12" disabled={busy}>{s.start.go}</button>
        {onSkip && <button type="button" className="sc-btn sc-btn-ghost" onClick={onSkip}>{s.start.skip}</button>}
      </motion.form>
    </main>
  );
}
