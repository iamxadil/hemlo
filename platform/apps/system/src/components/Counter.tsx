// The shared shop device, locked: choose your name, enter your PIN. It locks itself after 10 idle minutes.
import { useEffect, useState } from 'react';
import { api, ApiError, setCounterMode } from '../lib/api';
import { STRINGS, locale, rtl, type Lang } from '../lib/i18n';
import { initials } from '../lib/app';
import { Icon, LangPick } from './ui';

export function CounterLock({ lang, setLang, state, onUnlocked }: { lang: Lang; setLang(l: Lang): void; state: any; onUnlocked(): void }) {
  const t = STRINGS[lang];
  const [who, setWho] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value = pin) => {
    if (value.length < 4 || busy) return;
    setBusy(true); setError('');
    try { setCounterMode(true); await api('/v1/counter/unlock', { body: { memberId: who.memberId, pin: value } }); onUnlocked(); }
    catch (e) {
      setPin('');
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'PIN_LOCKED' ? t.counter.locked : code === 'WRONG_PIN' ? t.counter.wrong : code === 'NETWORK' ? t.errors.network : t.errors.generic);
    } finally { setBusy(false); }
  };
  const press = (k: string) => { if (k === '⌫') setPin((p) => p.slice(0, -1)); else if (k === '✓') submit(); else setPin((p) => (p.length < 8 ? p + k : p)); };
  useEffect(() => {
    if (!who) return;
    const on = (e: KeyboardEvent) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') press('✓'); else if (e.key === 'Escape') setWho(null); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });

  const staff: any[] = state.staff ?? [];
  return (
    <main className="gate"><div className="box w-full max-w-md">
      <picture><source srcSet={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} media="(prefers-color-scheme: dark)" /><img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}.svg`} alt="Hemlo Systems" /></picture>
      <p className="muted mt-4">{state.device.organization.name} · {state.device.name}</p>
      {!who ? <>
        <h1 className="text-2xl font-semibold">{t.counter.pickTitle}</h1>
        {!staff.length ? <p className="note">{t.counter.noStaff}</p> : (
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
            {staff.map((s) => (
              <button key={s.memberId} className="panel grid justify-items-center gap-2 p-4 hover:border-[var(--accent)]" onClick={() => { setWho(s); setPin(''); setError(''); }} disabled={s.locked}>
                <span className="avatar !h-12 !w-12 text-base">{initials(s.name)}</span><b className="font-medium">{s.name}</b>
                {s.locked && <span className="pill bad"><Icon n="lock" className="h-3 w-3" />{t.counter.lockedTitle}</span>}
              </button>
            ))}
          </div>
        )}
      </> : <>
        <button className="link-arrow" onClick={() => setWho(null)}><Icon n="back" className="h-4 w-4 rtl:scale-x-[-1]" />{t.counter.switchUser}</button>
        <span className="avatar !h-14 !w-14 text-lg">{initials(who.name)}</span>
        <h1 className="text-xl font-semibold">{who.name}</h1>
        <p className="muted">{t.counter.pin}</p>
        <div className="pin-dots" dir="ltr" aria-live="polite">{Array.from({ length: Math.max(4, pin.length) }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="pinpad" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => (
            <button key={k} className={k === '✓' ? 'go' : ''} disabled={busy || (k === '✓' && pin.length < 4)} onClick={() => press(k)} aria-label={k === '⌫' ? 'Backspace' : k === '✓' ? t.counter.unlock : k}>
              {k === '⌫' ? <Icon n="back" className="h-5 w-5" /> : k === '✓' ? <Icon n="check" className="h-6 w-6" /> : k}
            </button>
          ))}
        </div>
      </>}
      <LangPick lang={lang} setLang={setLang} className="mt-2" />
    </div></main>
  );
}
