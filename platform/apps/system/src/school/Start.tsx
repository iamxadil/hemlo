// Starting a school: its name, what kind it is (the grades are set up from that), city and phone. 30 days free.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Globe } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { sOf } from './i18n';
import { Button, Card, Field, Input, cn } from './ui';
import './school.css';

export function SchStart({ lang, setLang, onStarted, onSkip }: { lang: Lang; setLang(l: Lang): void; userName: string; onStarted(orgId: string): void; onSkip?: () => void }) {
  const s = sOf(lang);
  useEffect(() => { document.documentElement.classList.add('sc'); return () => document.documentElement.classList.remove('sc'); }, []);
  const [name, setName] = useState(''), [kind, setKind] = useState('school'), [city, setCity] = useState(''), [phone, setPhone] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr(s.errors.BAD_NAME);
    setBusy(true); setErr('');
    try { const r = await api<{ organizationId: string }>('/v1/sch/start', { body: { name, kind, city: city || null, phone: phone || null, lang: lang === 'en' ? 'en' : 'ar' } }); onStarted(r.organizationId); }
    catch (x) { setErr(x instanceof ApiError ? s.errors[x.code] ?? x.code : String(x)); setBusy(false); }
  };
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 0.8, 0.24, 1] }} className="w-full max-w-[520px]">
        <Card className="p-6 sm:p-8">
          <form onSubmit={start} className="grid gap-5">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2"><img src="/brand/hemlo-mark.svg" alt="" className="size-7" /><b>Hemlo School</b></span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}><Globe />{lang === 'en' ? 'العربية' : 'English'}</Button></div>
            <div><h1 className="text-[26px] font-semibold tracking-tight">{s.start.title}</h1><p className="text-muted-foreground mt-1 text-[14.5px]">{s.start.sub}</p></div>
            <Field label={s.start.name} htmlFor="ss-name"><Input id="ss-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
            <Field label={s.start.kind}>
              <div className="grid gap-2 sm:grid-cols-3">{(['school', 'institute', 'kindergarten'] as const).map((k) => (
                <button type="button" key={k} onClick={() => setKind(k)} className={cn('grid gap-1 rounded-2xl border p-3 text-start transition-colors', kind === k ? 'border-primary bg-primary-soft' : 'border-border hover:bg-accent')}>
                  <b className="text-[14.5px]">{s.kinds[k]}</b><span className="text-muted-foreground text-[12.5px]">{s.start.kindSub[k]}</span></button>))}</div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.start.city} htmlFor="ss-city"><Input id="ss-city" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              <Field label={s.start.phone} htmlFor="ss-phone"><Input id="ss-phone" dir="ltr" type="tel" inputMode="tel" placeholder="07XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            </div>
            {err && <p className="text-destructive text-[13.5px]" role="alert">{err}</p>}
            <Button size="lg" disabled={busy}>{s.start.go}</Button>
            {onSkip && <Button type="button" variant="ghost" onClick={onSkip}>{s.start.skip}</Button>}
          </form>
        </Card>
      </motion.div>
    </main>
  );
}
