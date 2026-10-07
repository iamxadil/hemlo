// Orders: a list filtered by status (the filter is in the URL), and one order with its customer, items, money,
// history, and the buttons that move it along. Moving it shows on the customer's order page at once.
import { useEffect } from 'preact/hooks';
import { setOrderStatus } from '../lib/actions';
import { orderByNo } from '../lib/order';
import { ago, price, when } from '../lib/format';
import { s, tx } from '../lib/i18n';
import { query } from '../lib/router';
import { doc } from '../lib/store';
import type { OrderStatus } from '../lib/types';
import { Icon, Img } from '../ui/kit';
import { previewAt } from './state';
import { a } from './strings';

const FLOW: OrderStatus[] = ['new', 'preparing', 'shipped', 'delivered'];
export const StatusPill = ({ status }: { status: OrderStatus }) => <span class={`pill st-${status}`}>{a.value.status[status]}</span>;

export function Orders() {
  useEffect(() => { previewAt.value = '/'; }, []);
  const t = a.value, f = (query.value.get('s') as OrderStatus | null) ?? null;
  const list = doc.value.orders.filter((o) => !f || o.status === f);
  const count = (s: OrderStatus) => doc.value.orders.filter((o) => o.status === s).length;
  return (
    <div class="adm-stack">
      <h1 class="adm-h1">{t.nav.orders}</h1>
      <div class="chips" role="tablist">
        <a href="/admin/orders" role="tab" aria-selected={!f}>{t.o.all}</a>
        {[...FLOW, 'canceled' as const].map((s) => <a href={`/admin/orders?s=${s}`} role="tab" aria-selected={f === s}>{t.status[s]} <span class="num">{count(s)}</span></a>)}
      </div>
      {list.length ? (
        <ul class="rows panel">{list.map((o) => (
          <li><a href={`/admin/orders/${o.no}`} class="row">
            <span class="num muted">#{o.no}</span>
            <span class="row-main"><b>{o.customer.name}</b><small class="muted">{o.customer.city} · {ago(o.createdAt)}</small></span>
            <span class="row-end"><b class="num">{price(o.total)}</b><StatusPill status={o.status} /></span>
          </a></li>
        ))}</ul>
      ) : <p class="panel muted">{t.o.none}</p>}
    </div>
  );
}

export function OrderView({ no }: { no: number }) {
  useEffect(() => { previewAt.value = `/order/${no}`; }, [no]);
  doc.value; // follow live changes
  const t = a.value, S = s.value, o = orderByNo(no);
  if (!o) return <div class="adm-stack"><a href="/admin/orders" class="back"><Icon n="back" class="flip" />{t.o.back}</a><p class="panel muted">{t.o.none}</p></div>;
  const at = FLOW.indexOf(o.status), next = at >= 0 && at < FLOW.length - 1 ? FLOW[at + 1] : null;
  const wa = o.customer.phone.replace(/\D/g, '');
  return (
    <div class="adm-stack">
      <a href="/admin/orders" class="back"><Icon n="back" class="flip" />{t.o.back}</a>
      <div class="adm-title"><h1 class="adm-h1">#{o.no}</h1><StatusPill status={o.status} /><span class="muted">{when(o.createdAt)}</span></div>
      <div class="actions">
        {next && <button class="btn btn-solid" onClick={() => setOrderStatus(o.id, next)}>{t.o.move}: {t.status[next]}</button>}
        {o.status !== 'canceled' && o.status !== 'delivered' && <button class="btn btn-ghost bad" onClick={() => setOrderStatus(o.id, 'canceled')}>{t.status.canceled}</button>}
        <a class="btn btn-line" href={`https://wa.me/${wa}`} target="_blank" rel="noopener"><Icon n="whatsapp" />{t.o.whatsapp}</a>
      </div>
      <div class="two">
        <section class="panel">
          <h2>{t.o.items}</h2>
          <ul class="rows">{o.lines.map((l) => <li class="row"><Img pic={l.pic} ratio="1 / 1" class="row-pic" /><span class="row-main"><b>{tx(l.name)}</b><small class="muted num">{price(l.price)} × {l.qty}</small></span><b class="num">{price(l.price * l.qty)}</b></li>)}</ul>
          <dl class="sums num">
            <div><dt>{S.subtotal}</dt><dd>{price(o.subtotal)}</dd></div>
            {o.discount > 0 && <div class="good"><dt>{S.discount} · {o.code}</dt><dd>−{price(o.discount)}</dd></div>}
            <div><dt>{S.delivery}</dt><dd>{o.delivery ? price(o.delivery) : S.free}</dd></div>
            <div class="sums-total"><dt>{S.total} · <small class="muted">{t.o.pay[o.pay]}</small></dt><dd>{price(o.total)}</dd></div>
          </dl>
        </section>
        <section class="panel">
          <h2>{t.o.customer}</h2>
          <dl class="kv">
            <div><dt>{o.customer.name}</dt></div>
            <div><dd dir="ltr">{o.customer.phone}</dd></div>
            <div><dd>{o.customer.city}{o.customer.address ? ` — ${o.customer.address}` : ''}</dd></div>
            {o.customer.note && <div><dt class="muted">{t.o.note}</dt><dd>{o.customer.note}</dd></div>}
          </dl>
          <h2>{t.o.history}</h2>
          <ol class="hist">{o.history.map((h) => <li><StatusPill status={h.status} /><span class="muted num">{when(h.at)}</span></li>)}</ol>
        </section>
      </div>
    </div>
  );
}
