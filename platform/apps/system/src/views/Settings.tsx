// Settings: language, your own PIN for the shared device, and turning this device into the shop device.
import { LANGS } from '../lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, ACCOUNT, setCounterMode } from '../lib/api';
import { useApp } from '../lib/app';
import { Icon } from '../components/ui';
import { printerPrefs, choosePrinter, printDirect, openDrawer, directSupported } from '../lib/escpos';
import { ImagePick } from '../components/Images';

const MANAGERS = ['owner', 'admin', 'manager'];

export function Settings() {
  const { t, lang, setLang, sys, me } = useApp();
  const counter = sys.counter;
  const isManager = !!sys.role && sys.role.split(',').some((r) => MANAGERS.includes(r));
  return (
    <div className="grid max-w-2xl gap-4">
      <section className="panel p-5">
        <p className="sec-t">{t.settings.language}</p>
        <div className="seg">{LANGS.map(({ id: l, name }) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{name}</button>)}</div>
      </section>
      {!counter && sys.role?.split(',').some((r) => r === 'owner' || r === 'admin') && <LogoSettings />}
      <PrinterSettings />
      {!counter && sys.role?.split(',').some((r) => r === 'owner' || r === 'admin') && <AiSettings />}
      {sys.business.demo && <section className="try"><p className="text-sm">{t.demo.notHere}</p></section>}
      {!counter && !sys.business.demo && sys.role?.split(',').some((r) => r === 'owner' || r === 'admin') && <FibSettings />}
      {!counter && sys.can['products.manage'] && <ScaleSettings />}
      {!counter && <MyPin />}
      {!counter && !sys.business.demo && isManager && <TrustDevice />}
      {counter && <section className="panel p-5"><p className="sec-t">{t.counter.trust}</p><p className="muted text-sm">{t.counter.device.replace('{name}', me.counter.device.name ?? '')}</p></section>}
      {!counter && !sys.business.demo && <a className="panel row" href={`${ACCOUNT}${lang === 'en' ? '/en/' : '/'}`}><Icon n="user" className="h-5 w-5" /><span className="flex-1">{t.settings.account}</span></a>}
    </div>
  );
}

function LogoSettings() {
  const { t, sys, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [url, setUrl] = useState(sys.business.logoUrl ?? null);
  const save = async (fileId: string | null, nextUrl: string | null) => {
    try {
      await api('/v1/sys/files/logo', { method: 'PUT', body: { fileId } });
      setUrl(nextUrl); qc.invalidateQueries({ queryKey: ['sys-me'] });
      toast(fileId ? t.images.logoSaved : t.images.logoRemoved);
    } catch (e) { toast(errorText(e), 'bad'); }
  };
  return (
    <section className="panel p-5">
      <ImagePick purpose="logo" url={url} label={t.images.logo} hint={t.images.logoHint} onChange={(up) => save(up?.id ?? null, up?.url ?? null)} />
    </section>
  );
}

function MyPin() {
  const { t, date, toast, errorText } = useApp();
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ['my-pin'], queryFn: () => api('/v1/counter/pin') });
  const [pin, setPin] = useState('');
  const save = useMutation({
    mutationFn: () => api('/v1/counter/pin', { method: 'PUT', body: { pin } }),
    onSuccess: () => { setPin(''); qc.invalidateQueries({ queryKey: ['my-pin'] }); toast(t.counter.pinSaved); },
    onError: (e) => toast(e instanceof ApiError && (t.counter as any)[e.code] ? (t.counter as any)[e.code] : errorText(e), 'bad'),
  });
  return (
    <section className="panel grid gap-3 p-5">
      <div><p className="sec-t !mb-1">{t.counter.myPin}</p><p className="sub">{state.data?.hasPin ? t.counter.hasPin.replace('{d}', date(state.data.updatedAt)) : t.counter.noPin}</p></div>
      <p className="muted text-sm">{t.counter.pinBody}</p>
      <div className="flex gap-2">
        <input className="input max-w-[12rem] tracking-[.4em]" type="password" inputMode="numeric" autoComplete="new-password" dir="ltr" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
        <button className="btn btn-accent btn-sm" disabled={pin.length < 4 || save.isPending} onClick={() => save.mutate()}>{t.counter.setPin}</button>
      </div>
    </section>
  );
}

function TrustDevice() {
  const { t, lang, toast, errorText } = useApp();
  const [name, setName] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const trust = useMutation({
    mutationFn: () => api('/v1/counter/devices', { body: { name: name || t.counter.deviceNamePh.replace(/^.*: /, '') } }),
    onSuccess: () => {
      // this device now belongs to the shop: forget the owner's cached account, reopen as the shop device
      try { localStorage.removeItem('hemlo.cache.me'); } catch {}
      setCounterMode(true); location.hash = '#/sell'; location.reload();
    },
    onError: (e) => { if (e instanceof ApiError && e.code === 'SESSION_NOT_FRESH') setNeedsSignIn(true); else toast(errorText(e), 'bad'); },
  });
  const signInAgain = async () => {
    await api('/v1/auth/sign-out', { body: {} }).catch(() => {});
    location.href = `${ACCOUNT}${lang === 'en' ? '/en' : ''}/sign-in/?return_to=${encodeURIComponent(location.href)}`;
  };
  return (
    <section className="panel grid gap-3 p-5">
      <p className="sec-t !mb-0">{t.counter.trust}</p>
      <p className="muted text-sm">{t.counter.trustBody}</p>
      <label className="field">{t.counter.deviceName}<input className="input" placeholder={t.counter.deviceNamePh} value={name} onChange={(e) => setName(e.target.value)} /></label>
      {needsSignIn ? <div className="note"><Icon n="info" /><span>{t.counter.notFresh} <button className="link-arrow" onClick={signInAgain}>{t.gate.signIn}</button></span></div>
        : <button className="btn btn-accent btn-sm justify-self-start" disabled={trust.isPending} onClick={() => trust.mutate()}><Icon n="lock" className="h-4 w-4" />{t.counter.trustBtn}</button>}
    </section>
  );
}

// ---------------- FIB ----------------
function FibSettings() {
  const { t, toast, errorText } = useApp();
  const qc = useQueryClient();
  const s = useQuery<any>({ queryKey: ['settings'], queryFn: () => api('/v1/sys/settings') });
  const [env, setEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [clientId, setClientId] = useState(''), [secret, setSecret] = useState('');
  const connect = useMutation({
    mutationFn: () => api('/v1/sys/settings/fib', { method: 'PUT', body: { env, clientId, clientSecret: secret } }),
    onSuccess: () => { setSecret(''); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const disconnect = useMutation({ mutationFn: () => api('/v1/sys/settings/fib', { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }) });
  const fib = s.data?.fib;
  return (
    <section className="panel grid gap-3 p-5">
      <p className="sec-t !mb-0">{t.tillSettings.fibTitle}</p>
      <p className="muted text-sm">{t.tillSettings.fibBody}</p>
      {fib?.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--sunken)] p-3">
          <span className="pill ok"><Icon n="check" className="h-3 w-3" />{t.tillSettings.connected.replace('{env}', fib.env === 'production' ? t.tillSettings.production : t.tillSettings.sandbox)} · <span dir="ltr">{fib.clientId}</span></span>
          <button className="btn btn-danger btn-sm" onClick={() => disconnect.mutate()}>{t.tillSettings.disconnect}</button>
        </div>
      ) : <>
        <div className="seg max-w-xs"><button aria-pressed={env === 'sandbox'} onClick={() => setEnv('sandbox')}>{t.tillSettings.sandbox}</button><button aria-pressed={env === 'production'} onClick={() => setEnv('production')}>{t.tillSettings.production}</button></div>
        <label className="field">{t.tillSettings.clientId}<input className="input" dir="ltr" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} /></label>
        <label className="field">{t.tillSettings.clientSecret}<input className="input" dir="ltr" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
        <p className="sub">{t.tillSettings.fibHow}</p>
        <button className="btn btn-accent btn-sm justify-self-start" disabled={!clientId || !secret || connect.isPending} onClick={() => connect.mutate()}>{t.tillSettings.connect}</button>
      </>}
    </section>
  );
}

// ---------------- label scale ----------------
function ScaleSettings() {
  const { t, toast, errorText } = useApp();
  const qc = useQueryClient();
  const s = useQuery<any>({ queryKey: ['settings'], queryFn: () => api('/v1/sys/settings') });
  const scale = s.data?.scale;
  const save = useMutation({
    mutationFn: (v: any) => api('/v1/sys/settings/scale', { method: 'PUT', body: { ...scale, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
    onError: (e) => toast(errorText(e), 'bad'),
  });
  if (!scale) return null;
  return (
    <section className="panel grid gap-3 p-5">
      <p className="sec-t !mb-0">{t.tillSettings.scaleTitle}</p>
      <p className="muted text-sm">{t.tillSettings.scaleBody}</p>
      <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={scale.enabled} onChange={(e) => save.mutate({ enabled: e.target.checked })} />{t.tillSettings.scaleOn}</label>
      {scale.enabled && <>
        <label className="field">{t.tillSettings.prefixes}<input className="input max-w-sm" dir="ltr" defaultValue={scale.prefixes.join(', ')} onBlur={(e) => save.mutate({ prefixes: e.target.value.split(/[,\s]+/).filter(Boolean) })} /></label>
        <div><p className="field mb-1">{t.tillSettings.mode}</p><div className="seg max-w-sm"><button aria-pressed={scale.mode === 'weight'} onClick={() => save.mutate({ mode: 'weight' })}>{t.tillSettings.weight}</button><button aria-pressed={scale.mode === 'price'} onClick={() => save.mutate({ mode: 'price' })}>{t.tillSettings.price}</button></div></div>
      </>}
    </section>
  );
}

// ---------------- printer & cash drawer (this device) ----------------
function PrinterSettings() {
  const { t, toast } = useApp();
  const [p, setP] = useState(printerPrefs.get());
  const set = (v: Partial<typeof p>) => { printerPrefs.set(v); setP(printerPrefs.get()); };
  const pick = async (kind: 'serial' | 'usb') => { try { await choosePrinter(kind); setP(printerPrefs.get()); toast(t.tillSettings.ready); } catch { /* the chooser was closed */ } };
  const test = async () => {
    try {
      await printDirect({ shop: 'Hemlo', title: t.tillSettings.test, meta: [new Date().toLocaleString()], lines: [{ name: 'بيبسي 330 مل · Pepsi', detail: '2 × 500', amount: '1,000' }],
        totals: [{ label: t.sell.total, value: '1,000 IQD', strong: true }], footer: t.receipt.thanks, rtl: document.documentElement.dir === 'rtl' }, { kick: false });
    } catch { toast(t.tillSettings.noPrinter, 'bad'); }
  };
  return (
    <section className="panel grid gap-3 p-5">
      <p className="sec-t !mb-0">{t.tillSettings.printerTitle}</p>
      <p className="muted text-sm">{t.tillSettings.printerBody}</p>
      <div className="seg max-w-sm"><button aria-pressed={p.mode === 'dialog'} onClick={() => set({ mode: 'dialog' })}>{t.tillSettings.modeDialog}</button><button aria-pressed={p.mode === 'direct'} onClick={() => set({ mode: 'direct' })}>{t.tillSettings.modeDirect}</button></div>
      {p.mode === 'direct' && (directSupported() ? <>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => pick('usb')}><Icon n="print" className="h-4 w-4" />{t.tillSettings.usb}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => pick('serial')}><Icon n="print" className="h-4 w-4" />{t.tillSettings.serial}</button>
          {p.transport && <span className="pill ok self-center">{t.tillSettings.ready} · {p.transport.toUpperCase()}</span>}
        </div>
        <div><p className="field mb-1">{t.tillSettings.paper}</p><div className="seg max-w-[12rem]">{([80, 58] as const).map((w) => <button key={w} aria-pressed={p.paper === w} onClick={() => set({ paper: w })}>{w} mm</button>)}</div></div>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={p.drawer} onChange={(e) => set({ drawer: e.target.checked })} />{t.tillSettings.drawer}</label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" onClick={test}>{t.tillSettings.test}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => openDrawer().catch(() => toast(t.tillSettings.noPrinter, 'bad'))}><Icon n="drawer" className="h-4 w-4" />{t.tillSettings.openDrawer}</button>
        </div>
      </> : <p className="note"><Icon n="info" /><span>{t.tillSettings.unsupported}</span></p>)}
      <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={p.auto} onChange={(e) => set({ auto: e.target.checked })} />{t.tillSettings.auto}</label>
    </section>
  );
}

/** The owner's switch for Hemlo's AI features, and the month's use. */
function AiSettings() {
  const { t, num, toast, errorText } = useApp();
  const qc = useQueryClient();
  const ai = useQuery({ queryKey: ['ai'], queryFn: () => api('/v1/sys/ai') });
  const save = useMutation({
    mutationFn: (off: boolean) => api('/v1/sys/ai/settings', { method: 'PUT', body: { off } }),
    onSuccess: (r) => qc.setQueryData(['ai'], r),
    onError: (e) => toast(errorText(e), 'bad'),
  });
  if (!ai.data) return null;
  return (
    <section className="panel grid gap-3 p-5">
      <div><p className="sec-t !mb-1 flex items-center gap-2"><Icon n="sparkle" className="h-4 w-4" />{t.ai.settings}</p><p className="sub">{t.ai.settingsHint}</p></div>
      <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!ai.data.off} disabled={save.isPending} onChange={(e) => save.mutate(!e.target.checked)} />{ai.data.off ? t.ai.off : t.ai.on}</label>
      <p className="sub">{t.ai.used.replace('{n}', num(ai.data.used)).replace('{m}', num(ai.data.allowance))}</p>
    </section>
  );
}
