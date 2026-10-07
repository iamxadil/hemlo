// The panel's first page: today's sales, the week, new orders, what's running low, the latest orders, and four
// things to try (the point of the demo: change something, see the store follow).
import { useEffect } from 'preact/hooks';
import { ago, price } from '../lib/format';
import { tx } from '../lib/i18n';
import { doc } from '../lib/store';
import { Icon, Img } from '../ui/kit';
import { previewAt } from './state';
import { a } from './strings';
import { StatusPill } from './Orders';

const DAY = 86400000;

export function Dashboard() {
  useEffect(() => { previewAt.value = '/'; }, []);
  const t = a.value, d = doc.value, now = Date.now(), start = new Date().setHours(0, 0, 0, 0);
  const paid = d.orders.filter((o) => o.status !== 'canceled');
  const today = paid.filter((o) => o.createdAt >= start).reduce((s, o) => s + o.total, 0);
  const week = paid.filter((o) => o.createdAt >= now - 7 * DAY).reduce((s, o) => s + o.total, 0);
  const fresh = d.orders.filter((o) => o.status === 'new').length;
  const low = d.products.filter((p) => p.active && p.stock <= 5).sort((x, y) => x.stock - y.stock);
  return (
    <div class="adm-stack">
      <h1 class="adm-h1">{t.nav.home}</h1>
      <div class="kpis">
        <div class="kpi"><span>{t.dash.today}</span><b class="num">{price(today)}</b></div>
        <div class="kpi"><span>{t.dash.week}</span><b class="num">{price(week)}</b></div>
        <a href="/admin/orders?s=new" class="kpi"><span>{t.dash.newOrders}</span><b class="num">{fresh}</b></a>
        <a href="/admin/products?low=1" class="kpi"><span>{t.dash.low}</span><b class="num">{low.length}</b></a>
      </div>
      <section class="panel">
        <h2>{t.dash.try}</h2>
        <ol class="tries">{t.dash.tries.map((x, i) => <li><span class="num">{i + 1}</span>{x}</li>)}</ol>
      </section>
      <div class="two">
        <section class="panel">
          <div class="panel-head"><h2>{t.dash.latest}</h2><a href="/admin/orders" class="link-more">{t.nav.orders}<Icon n="arrow" class="flip" /></a></div>
          {d.orders.length ? (
            <ul class="rows">{d.orders.slice(0, 5).map((o) => (
              <li><a href={`/admin/orders/${o.no}`} class="row"><span class="num muted">#{o.no}</span><span class="row-main"><b>{o.customer.name}</b><small class="muted">{ago(o.createdAt)}</small></span><span class="row-end"><b class="num">{price(o.total)}</b><StatusPill status={o.status} /></span></a></li>
            ))}</ul>
          ) : <p class="muted">{t.dash.none}</p>}
        </section>
        <section class="panel">
          <div class="panel-head"><h2>{t.dash.lowList}</h2></div>
          {low.length ? (
            <ul class="rows">{low.slice(0, 5).map((p) => (
              <li><a href={`/admin/products/${p.id}`} class="row"><Img pic={p.pics[0]} ratio="1 / 1" class="row-pic" /><span class="row-main"><b>{tx(p.name)}</b><small class="muted">{p.sku}</small></span><b class={`num ${p.stock <= 0 ? 'bad' : 'warn'}`}>{p.stock}</b></a></li>
            ))}</ul>
          ) : <p class="muted">{t.dash.none}</p>}
        </section>
      </div>
    </div>
  );
}
