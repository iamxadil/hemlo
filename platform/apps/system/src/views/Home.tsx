// Today, for the owner: sales, profit, how people paid, debts, best sellers, and what's running out.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, fill, dayRange } from '../lib/app';
import { Empty, Icon, Money } from '../components/ui';
import { useShift } from '../components/Drawer';
import { AskShop } from '../components/Ai';

const PERIODS = { today: [0, 1], yesterday: [1, 1], week: [0, 7], month: [0, 30] } as const;

export function Home() {
  const { t, me, num, qty, money, sys, time } = useApp();
  const [period, setPeriod] = useState<keyof typeof PERIODS>('today');
  const range = dayRange(PERIODS[period][0], PERIODS[period][1]);
  const r = useQuery({ queryKey: ['report', period], queryFn: () => api(`/v1/sys/reports/summary?from=${range.from}&to=${range.to}`), refetchInterval: 60_000 });
  const d = r.data;
  const words = (me.user.name || '').split(/\s+/);
  const shift = useShift();
  const first = /^(abu|umm|أبو|ابو|أم|ام)$/i.test(words[0] ?? '') ? words.slice(0, 2).join(' ') : words[0]; // "Abu Hussein" is one name

  if (!d) return <div className="grid gap-4"><div className="kpis">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28" />)}</div><div className="skeleton h-56" /></div>;
  const max = Math.max(1, ...d.series.values);
  const margin = d.total ? Math.round((d.profit / d.total) * 100) : 0;
  const labels = d.series.unit === 'hour' ? ['0', '6', '12', '18', '23'] : [];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-medium">{fill(t.home.hello, { name: first })}</p>
        <div className="chips">{(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((p) => <button key={p} className="chip" aria-pressed={period === p} onClick={() => setPeriod(p)}>{t.home.periods[p]}</button>)}</div>
      </div>
      <AskShop />
      {sys.business.demo && <section className="try">
        <p className="text-sm font-semibold">{t.demo.tipsTitle}</p>
        <ol className="grid gap-1.5 sm:grid-cols-2">{t.demo.tips.map((tip, i) => (
          <li key={i}><a className="flex items-baseline gap-2 text-sm hover:underline" href={`#/${t.demo.tipLinks[i]}`}><span className="pill accent">{num(i + 1)}</span>{tip}</a></li>
        ))}</ol>
      </section>}
      <section className="kpis">
        <div className="panel kpi hero"><p>{period === 'today' ? t.home.sales : t.home.periods[period]}</p><p className="v"><Money v={d.total} /></p><p className="d">{fill(t.home.count, { n: num(d.count) })}</p></div>
        <div className="panel kpi"><p>{t.home.profit}</p><p className="v"><Money v={d.profit} /></p><p className="d">{fill(t.home.margin, { p: margin })}</p></div>
        <div className="panel kpi"><p>{t.home.collected}</p><p className="v"><Money v={d.collected} /></p><p className="d">{t.home.cash} {money(d.byMethod.cash)} · {t.home.card} {money(d.byMethod.card)}{d.byMethod.fib ? ` · FIB ${money(d.byMethod.fib)}` : ''}</p></div>
        <a className="panel kpi hover:border-[var(--line-strong)]" href="#/customers"><p>{t.home.debt}</p><p className="v text-[var(--warn)]"><Money v={d.debt.total} /></p><p className="d">{fill(t.home.debtPeople, { n: num(d.debt.people) })}</p></a>
      </section>
      <section className="kpis">
        <div className="panel kpi"><p>{t.homeV2.net}</p><p className={`v ${d.netProfit < 0 ? 'text-[var(--bad)]' : ''}`}><Money v={d.netProfit} /></p><p className="d">{fill(t.homeV2.afterExpenses, { n: money(d.expenses.total) })}</p></div>
        <a className="panel kpi hover:border-[var(--line-strong)]" href="#/sales"><p>{t.returns.list}</p><p className="v"><Money v={d.returns.total} /></p><p className="d">{fill(t.homeV2.returns, { n: num(d.returns.n) })}</p></a>
        <a className="panel kpi hover:border-[var(--line-strong)]" href="#/purchases"><p>{t.homeV2.owedSuppliers}</p><p className="v"><Money v={d.owedToSuppliers} /></p><p className="d">{t.purchases.suppliers}</p></a>
        <div className="panel kpi"><p>{t.drawer.title}</p><p className="v">{shift.data?.drawer ? <Money v={shift.data.drawer.expected} /> : '—'}</p>
          <p className="d">{shift.data?.shift ? t.drawer.openSince.replace('{t}', time(shift.data.shift.openedAt)) : t.drawer.closed}</p></div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="panel">
          <div className="panel-h"><h2>{t.home.byHour}</h2><span className="sub">{t.home.credit}: {money(d.byMethod.credit)}</span></div>
          {d.count === 0 ? <Empty icon="sell" text={t.home.none} action={<a className="btn btn-accent btn-sm" href="#/sell">{t.home.startSelling}</a>} /> : <>
            <div className="bars" role="img" aria-label={t.home.byHour}>
              {d.series.values.map((v: number, i: number) => <div key={i} className={v ? '' : 'zero'} style={{ height: `${(v / max) * 100}%` }} title={`${d.series.unit === 'hour' ? `${i}:00` : `+${i}`} · ${money(v)}`} />)}
            </div>
            <div className="bars-x">{labels.length ? labels.map((l) => <span key={l}>{l}:00</span>) : <><span>{t.home.periods[period]}</span><span>{t.home.periods.today}</span></>}</div>
          </>}
        </div>
        <div className="panel">
          <div className="panel-h"><h2>{t.home.top}</h2></div>
          {!d.top.length ? <p className="sub px-5 pb-5">{t.home.none}</p> : <ol className="rows">
            {d.top.map((p: any, i: number) => <li key={p.productId ?? i} className="row"><span className="thumb text-sm">{i + 1}</span><span className="min-w-0 flex-1 truncate">{p.name}<span className="sub block">× {num(p.qty)}</span></span><Money v={p.total} className="font-semibold" /></li>)}
          </ol>}
        </div>
      </section>
      {d.byUser.length > 0 && <section className="panel">
        <div className="panel-h"><h2>{t.homeV2.byUser}</h2></div>
        <div className="rows">{d.byUser.map((u: any) => <div key={u.userId ?? 'x'} className="row"><span className="avatar">{(u.name ?? '·').slice(0, 1)}</span><span className="min-w-0 flex-1 truncate">{u.name ?? '—'}<span className="sub block">{fill(t.home.count, { n: num(u.count) })}</span></span><Money v={u.total} className="font-semibold" /></div>)}</div>
      </section>}
      <section className="panel">
        <div className="panel-h"><h2>{t.home.low}</h2><a className="link-arrow text-sm" href="#/products">{t.nav.products} <span className="arr">→</span></a></div>
        {!d.lowStock.length ? <p className="sub flex items-center gap-2 px-5 pb-5"><Icon n="check" className="h-4 w-4 text-[var(--ok)]" />{t.home.allGood}</p> : <div className="rows">
          {d.lowStock.map((p: any) => <a key={p.id} className="row" href={`#/products?id=${p.id}`}><span className="min-w-0 flex-1 truncate">{p.name}</span><span className={`pill ${p.stock <= 0 ? 'bad' : 'warn'}`}>{qty(p.stock, p.unit)}</span></a>)}
        </div>}
      </section>
    </div>
  );
}
