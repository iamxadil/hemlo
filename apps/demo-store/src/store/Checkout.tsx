// Checkout on one page: details, payment, the order summary. The order lands in the control panel's Orders at once.
import { useSignal } from '@preact/signals';
import { cartTotals, code, emptyCart, lines } from '../lib/cart';
import { placeOrder } from '../lib/order';
import { s, tx } from '../lib/i18n';
import { navigate } from '../lib/router';
import { settings } from '../lib/store';
import type { Order } from '../lib/types';
import { Icon, Img, toast } from '../ui/kit';
import { CodeBox, Sums } from './Cart';

type Form = Order['customer'];
const PHONE = /^\+?[\d\s-]{9,16}$/;

export function Checkout() {
  const f = useSignal<Form>({ name: '', phone: '', city: '', address: '', note: '' });
  const pay = useSignal<Order['pay']>('cod'), tried = useSignal(false), busy = useSignal(false);
  const t = cartTotals.value, v = f.value;
  if (!lines.value.length && !busy.value) {
    return <section class="wrap empty-state"><Icon n="bag" /><p>{s.value.cartEmpty}</p><a href="/shop" class="btn btn-solid">{s.value.keepShopping}</a></section>;
  }
  const errs: Partial<Record<keyof Form, string>> = {
    name: v.name.trim() ? '' : s.value.required,
    phone: !v.phone.trim() ? s.value.required : PHONE.test(v.phone.trim()) ? '' : s.value.phoneErr,
    city: v.city.trim() ? '' : s.value.required,
    address: v.address.trim() ? '' : s.value.required,
  };
  const ok = !Object.values(errs).some(Boolean);
  const field = (k: keyof Form, label: string, o: { tel?: boolean; area?: boolean; auto?: string } = {}) => {
    const err = tried.value ? errs[k] : '';
    const onInput = (e: Event) => (f.value = { ...f.value, [k]: (e.target as HTMLInputElement).value });
    return (
      <label class="field">{label}
        {o.area
          ? <textarea class="input" value={v[k]} onInput={onInput} />
          : o.tel
            ? <input class="input" type="tel" dir="ltr" autoComplete={o.auto} value={v[k]} aria-invalid={!!err} onInput={onInput} />
            : <input class="input" type="text" autoComplete={o.auto} value={v[k]} aria-invalid={!!err} onInput={onInput} />}
        {err && <span class="field-err">{err}</span>}
      </label>
    );
  };
  const submit = (e: Event) => {
    e.preventDefault(); tried.value = true;
    if (!ok || busy.value) return;
    busy.value = true;
    const out = placeOrder(lines.value, code.value, { name: v.name.trim(), phone: v.phone.trim(), city: v.city.trim(), address: v.address.trim(), note: v.note.trim() }, pay.value);
    if (typeof out === 'string') { busy.value = false; toast(out === 'stock' ? s.value.stockErr : s.value.codeErr.unknown); return; }
    emptyCart();
    navigate(`/order/${out.no}`, { replace: true });
  };
  const pays: [Order['pay'], string][] = [['cod', s.value.cod], ['card', s.value.card], ['wallet', s.value.wallet]];
  return (
    <section class="wrap section checkout">
      <form class="co-form" onSubmit={submit} noValidate>
        <h1 class="display">{s.value.checkout}</h1>
        <fieldset><legend>{s.value.you}</legend>
          {field('name', s.value.name, { auto: 'name' })}
          {field('phone', s.value.phone, { tel: true, auto: 'tel' })}
          {field('city', s.value.city, { auto: 'address-level2' })}
          {field('address', s.value.address, { auto: 'street-address' })}
          {field('note', s.value.note, { area: true })}
        </fieldset>
        <fieldset><legend>{s.value.pay}</legend>
          <div class="pay-opts">{pays.map(([k, label]) => (
            <label class={`pay-opt${pay.value === k ? ' on' : ''}`}><input type="radio" name="pay" value={k} checked={pay.value === k} onChange={() => (pay.value = k)} /><span>{label}</span></label>
          ))}</div>
        </fieldset>
        <button class="btn btn-solid btn-lg btn-block co-place" type="submit" disabled={busy.value}>{busy.value ? s.value.placing : s.value.place}</button>
        <p class="muted co-note">{tx(settings.value.city)} · <span dir="ltr">{settings.value.phone}</span></p>
      </form>
      <aside class="co-summary">
        <ul class="lines lines-sm">
          {lines.value.map(({ product: p, qty }) => (
            <li key={p.id}><Img pic={p.pics[0]} ratio="1 / 1" class="line-pic" sizes="64px" /><div class="line-main"><span class="line-name">{tx(p.name)}</span><span class="muted num">× {qty}</span></div></li>
          ))}
        </ul>
        <CodeBox />
        <Sums t={t} codeName={t.code?.code} />
      </aside>
    </section>
  );
}
