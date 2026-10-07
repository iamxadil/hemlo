// "Thank you" and the order's progress. When the owner moves the order along in the control panel, this page follows.
import { orderByNo } from '../lib/order';
import { when } from '../lib/format';
import { fill, s, tx } from '../lib/i18n';
import { doc, settings } from '../lib/store';
import type { OrderStatus } from '../lib/types';
import { Icon } from '../ui/kit';
import { Sums } from './Cart';
import { NotFound } from './Storefront';

const STEPS: OrderStatus[] = ['new', 'preparing', 'shipped', 'delivered'];

export function OrderPage({ no }: { no: number }) {
  doc.value; // follow live changes to the order
  const o = orderByNo(no);
  if (!o) return <NotFound />;
  const at = STEPS.indexOf(o.status), wa = settings.value.whatsapp.replace(/\D/g, '');
  const msg = encodeURIComponent(`${fill(s.value.orderNo, { n: o.no })} · ${o.customer.name}`);
  return (
    <section class="wrap section order">
      <div class="order-head">
        <svg class="order-tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27.5l7 7 15-16" /></svg>
        <h1 class="display">{s.value.thanks}</h1>
        <p class="muted num">{fill(s.value.orderNo, { n: o.no })} · {when(o.createdAt)}</p>
      </div>
      <h2 class="order-sub">{s.value.track}</h2>
      {o.status === 'canceled' ? <p class="bad">{s.value.status.canceled}</p> : (
        <ol class="steps">
          {STEPS.map((st, k) => {
            const h = o.history.find((x) => x.status === st);
            return <li class={k <= at ? 'done' : ''} aria-current={k === at ? 'step' : undefined}><span class="dot" /><b>{s.value.status[st]}</b>{h && <span class="muted num">{when(h.at)}</span>}</li>;
          })}
        </ol>
      )}
      <ul class="lines lines-sm order-lines">
        {o.lines.map((l) => <li><div class="line-main"><span class="line-name">{tx(l.name)}</span><span class="muted num">× {l.qty}</span></div></li>)}
      </ul>
      <Sums t={o} codeName={o.code} />
      <a class="btn btn-line btn-block" href={`https://wa.me/${wa}?text=${msg}`} target="_blank" rel="noopener"><Icon n="whatsapp" />{s.value.whatsapp}</a>
    </section>
  );
}
