// What the customer sees on the second screen: the receipt as it's scanned, the total, the FIB code to scan, thanks.
import { useEffect, useState } from 'react';
import { STRINGS, locale, readLang, rtl } from '../lib/i18n';
import { onDisplay, toDisplay, type DisplayMsg } from '../lib/display';

export function Display() {
  const [m, setM] = useState<DisplayMsg | null>(null);
  useEffect(() => { const off = onDisplay((x) => { if (x.type !== 'hello') setM(x); }); toDisplay({ type: 'hello' }); return off; }, []);
  useEffect(() => { if (m && m.type !== 'hello') { document.documentElement.lang = m.lang; document.documentElement.dir = rtl(m.lang) ? 'rtl' : 'ltr'; } }, [m]);
  const lang = m && m.type !== 'hello' ? m.lang : readLang();
  const t = STRINGS[lang];
  const n = (v: number) => new Intl.NumberFormat(locale(lang)).format(v);
  const shop = m && m.type !== 'hello' ? m.shop : '';
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => { if (m?.type === 'cart' && m.logo !== undefined) setLogo(m.logo ?? null); }, [m]);

  return (
    <main className="cd">
      <header className="cd-h">
        <picture><source srcSet={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}-on-dark.svg`} media="(prefers-color-scheme: dark)" /><img src={`/brand/hemlo-systems${rtl(lang) ? '-ar' : ''}.svg`} alt="" className="h-8" /></picture>
        <span className="flex items-center gap-3">{logo && <img src={logo} alt="" className="cd-logo" />}<b className="text-2xl">{shop}</b></span>
      </header>
      {(!m || (m.type === 'cart' && !m.lines.length)) && <div className="cd-center">{logo && <img src={logo} alt="" className="cd-logo-lg" />}<p className="text-5xl font-semibold">{t.display.welcome}</p><p className="muted mt-4">{shop}</p></div>}
      {m?.type === 'cart' && m.lines.length > 0 && (
        <div className="cd-cart">
          <ol className="cd-lines">{m.lines.map((l, i) => <li key={i}><span className="truncate">{l.name}</span><span className="muted" dir="ltr">{l.qty}</span><b className="money">{n(l.total)}</b></li>)}</ol>
          <div className="cd-total"><span>{t.display.total}<small className="muted block text-base font-normal">{t.display.items.replace('{n}', n(m.count))}</small></span><b className="money">{n(m.total)} <small>{t.iqd}</small></b></div>
        </div>
      )}
      {m?.type === 'fib' && (
        <div className="cd-center">
          <p className="text-3xl font-semibold">{t.display.scan}</p>
          <img src={m.qr} alt="FIB" className="cd-qr" />
          <p className="text-2xl tracking-[.2em]" dir="ltr">{m.code}</p>
          <p className="money mt-2 text-5xl font-bold">{n(m.amount)} <small className="text-2xl">{t.iqd}</small></p>
        </div>
      )}
      {m?.type === 'done' && (
        <div className="cd-center">
          <span className="cd-ok">✓</span>
          <p className="mt-6 text-5xl font-semibold">{t.display.thanks}</p>
          {m.change ? <p className="mt-6 text-3xl">{t.display.change}: <b className="money">{n(m.change)} {t.iqd}</b></p> : null}
        </div>
      )}
    </main>
  );
}
