// Settings: the store's name and tagline, contact, currency (moves every price), delivery, colours, and — for the demo —
// starting over as an Iraqi or a Jordanian store.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { saveSettings, setCurrency } from '../lib/actions';
import { reset, settings } from '../lib/store';
import type { Currency, Settings as S } from '../lib/types';
import { toast } from '../ui/kit';
import { Field, MoneyInput, TFields } from './forms';
import { previewAt } from './state';
import { a } from './strings';

const ACCENTS = ['#9A6B3F', '#1F3A5F', '#2F5D50', '#8C2F39', '#5B4B8A', '#C2410C', '#1C1915'];

export function Settings() {
  useEffect(() => { previewAt.value = '/'; }, []);
  const t = a.value.s, v = useSignal<S>(structuredClone(settings.value)), set = (x: Partial<S>) => (v.value = { ...v.value, ...x });
  const live = (x: Partial<S>) => { set(x); saveSettings(x); }; // colours apply as you pick them
  const cur = settings.value.currency;
  return (
    <div class="adm-stack">
      <h1 class="adm-h1">{a.value.nav.settings}</h1>
      <form class="adm-stack" onSubmit={(e) => { e.preventDefault(); const { currency: _c, theme: _t, announcement: _a, ...rest } = v.value; saveSettings(rest); toast(t.saved); }}>
        <section class="panel form-grid">
          <h2>{t.store}</h2>
          <TFields labels={[t.nameAr, t.nameEn]} value={v.value.name} onChange={(name) => set({ name })} />
          <TFields labels={[t.tagAr, t.tagEn]} value={v.value.tagline} onChange={(tagline) => set({ tagline })} />
        </section>
        <section class="panel form-grid cols-2">
          <h2>{t.contact}</h2>
          <Field label={t.phone}><input class="input" dir="ltr" value={v.value.phone} onInput={(e) => set({ phone: (e.target as HTMLInputElement).value })} /></Field>
          <Field label={t.whatsapp}><input class="input" dir="ltr" value={v.value.whatsapp} onInput={(e) => set({ whatsapp: (e.target as HTMLInputElement).value })} /></Field>
          <Field label={t.email}><input class="input" dir="ltr" type="email" value={v.value.email} onInput={(e) => set({ email: (e.target as HTMLInputElement).value })} /></Field>
          <Field label={t.instagram}><input class="input" dir="ltr" value={v.value.instagram} onInput={(e) => set({ instagram: (e.target as HTMLInputElement).value })} /></Field>
        </section>
        <section class="panel form-grid cols-3">
          <h2>{t.money}</h2>
          <Field label={t.currency} hint={t.currencyHint}>
            <select class="input" value={cur} onChange={(e) => { setCurrency((e.target as HTMLSelectElement).value as Currency); v.value = structuredClone(settings.value); }}>
              <option value="IQD">IQD · دينار عراقي</option><option value="JOD">JOD · دينار أردني</option><option value="USD">USD · $</option>
            </select>
          </Field>
          <MoneyInput key={`fee-${cur}`} label={t.fee} value={v.value.delivery.fee} onChange={(fee) => set({ delivery: { ...v.value.delivery, fee: fee ?? 0 } })} />
          <MoneyInput key={`free-${cur}`} label={t.freeOver} value={v.value.delivery.freeOver} onChange={(freeOver) => set({ delivery: { ...v.value.delivery, freeOver: freeOver ?? 0 } })} />
        </section>
        <section class="panel form-grid">
          <h2>{t.look}</h2>
          <div class="field">{t.accent}
            <div class="swatches">{ACCENTS.map((c) => <button type="button" style={{ background: c }} aria-label={c} aria-pressed={v.value.theme.accent === c} onClick={() => live({ theme: { ...v.value.theme, accent: c } })} />)}
              <input type="color" value={v.value.theme.accent} aria-label={t.accent} onInput={(e) => live({ theme: { ...v.value.theme, accent: (e.target as HTMLInputElement).value } })} /></div>
          </div>
          <Field label={`${t.radius} · ${v.value.theme.radius}px`}><input type="range" min="0" max="28" step="2" value={v.value.theme.radius} onInput={(e) => live({ theme: { ...v.value.theme, radius: Number((e.target as HTMLInputElement).value) } })} /></Field>
        </section>
        <div class="actions"><button class="btn btn-solid" type="submit">{t.save}</button></div>
      </form>
      <section class="panel form-grid">
        <h2>{t.demo}</h2>
        <p class="muted">{t.market}</p>
        <div class="actions">
          <button class="btn btn-line" onClick={async () => { if (confirm(t.resetSure)) { await reset('iq'); v.value = structuredClone(settings.value); toast(t.done); } }}>{t.reset} · {t.iq}</button>
          <button class="btn btn-line" onClick={async () => { if (confirm(t.resetSure)) { await reset('jo'); v.value = structuredClone(settings.value); toast(t.done); } }}>{t.reset} · {t.jo}</button>
        </div>
      </section>
    </div>
  );
}
