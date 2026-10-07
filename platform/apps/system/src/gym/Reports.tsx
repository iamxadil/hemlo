// The owner's numbers: money (memberships and the shop, collected, spent), members won and kept (the renewal rate),
// when the gym is busy (a day × hour map), what sells, and what each coach earned from personal training.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dayRange } from '../lib/app';
import { Empty } from '../components/ui';
import { useG } from './i18n';
import { SlideSeg } from './ui';
import { fmt } from './data';

export function Reports() {
  const { g, num, money } = useG();
  const [span, setSpan] = useState<'7' | '30' | '90'>('30');
  const range = dayRange(0, Number(span));
  const q = useQuery({ queryKey: ['gym-reports', span], queryFn: () => api(`/v1/gym/reports?from=${range.from}&to=${range.to}`), placeholderData: (x) => x });
  const r = q.data;
  return (
    <div className="grid gap-5">
      <SlideSeg value={span} onChange={(v) => setSpan(v as typeof span)} options={(['7', '30', '90'] as const).map((k) => [k, g.reports.period[k]])} className="justify-self-start" />
      {!r ? <div className="grid gap-4"><div className="skeleton h-28" /><div className="skeleton h-72" /></div> : <>
        <div className="gy-kpi-row">
          <Kpi label={g.reports.memberships} v={money(r.money.memberships)} hero />
          <Kpi label={g.reports.shop} v={money(r.money.shop)} sub={fmt(g.reports.shopProfit, { v: money(r.money.shopProfit) })} />
          <Kpi label={g.reports.collected} v={money(r.money.collected)} />
          <Kpi label={g.reports.expenses} v={money(r.money.expenses)} />
        </div>
        <div className="gy-kpi-row">
          <Kpi label={g.reports.activeNow} v={num(r.members.activeNow)} />
          <Kpi label={g.reports.newMembers} v={num(r.members.new)} />
          <Kpi label={g.reports.visits} v={num(r.members.visits)} sub={fmt(g.reports.visitors, { n: num(r.members.visitors) })} />
          <Kpi label={g.reports.renewal} v={r.members.ended ? `${Math.round((r.members.renewed / r.members.ended) * 100)}%` : '—'} sub={fmt(g.reports.renewalSub, { r: num(r.members.renewed), e: num(r.members.ended) })} />
        </div>
        <MoneyBars days={r.days} from={r.from} to={r.to} />
        <Heat heat={r.heat} />
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="gy-card">
            <header className="gy-card-h"><h2>{g.reports.plans}</h2></header>
            {!r.plans.length ? <Empty icon="chart" text={g.reports.noData} /> : (
              <ul className="gy-rank">{r.plans.map((p: any) => { const max = r.plans[0].total || 1; return (
                <li key={p.name + p.category}><span className="truncate">{p.name}</span><i style={{ width: `${(p.total / max) * 100}%` }} /><b>{money(p.total)}</b><em>×{num(p.n)}</em></li>
              ); })}</ul>
            )}
          </section>
          <section className="gy-card">
            <header className="gy-card-h"><h2>{g.reports.coaches}</h2></header>
            {!r.coaches.some((c: any) => c.sessions) ? <Empty icon="user" text={g.reports.noData} /> : (
              <div className="rows">{r.coaches.filter((c: any) => c.sessions).map((c: any) => (
                <div key={c.id} className="row">
                  <span className="gy-dot" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1"><b className="block truncate font-medium">{c.name}</b><span className="sub">{fmt(g.reports.sessions, { n: num(c.sessions) })} · {g.reports.worth} {money(c.value)}</span></span>
                  <span className="text-end"><b className="block">{money(c.share)}</b><span className="sub">{g.reports.share} {num(c.pt_share)}%</span></span>
                </div>
              ))}</div>
            )}
          </section>
        </div>
        {r.members.turnedBack > 0 && <p className="sub">{fmt(g.reports.turnedBack, { n: num(r.members.turnedBack) })}</p>}
      </>}
    </div>
  );
}

function Kpi({ label, v, sub, hero }: { label: string; v: string; sub?: string; hero?: boolean }) {
  return <div className={`gy-kpi${hero ? ' hero' : ''}`}><span>{label}</span><b>{v}</b>{sub && <em>{sub}</em>}</div>;
}

/** Money in by day: memberships (ember) and the shop (blue), stacked, one bar a day. */
function MoneyBars({ days, from, to }: { days: { day: string; memberships: number; shop: number }[]; from: string; to: string }) {
  const { g, money, date } = useG();
  const [hover, setHover] = useState<number | null>(null);
  const all = useMemo(() => {
    const out: { day: string; memberships: number; shop: number }[] = [];
    const start = new Date(+new Date(from) + 3 * 3600_000).toISOString().slice(0, 10), end = new Date(+new Date(to) + 3 * 3600_000 - 1).toISOString().slice(0, 10);
    for (let d = start; d <= end; d = new Date(+new Date(`${d}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10)) out.push(days.find((x) => x.day === d) ?? { day: d, memberships: 0, shop: 0 });
    return out;
  }, [days, from, to]);
  const max = Math.max(1, ...all.map((x) => x.memberships + x.shop));
  const h = hover != null ? all[hover] : null;
  return (
    <section className="gy-card">
      <header className="gy-card-h"><h2>{g.reports.money}</h2><span className="gy-legend"><i className="a" />{g.reports.memberships}<i className="c" />{g.reports.shop}</span></header>
      <div className="gy-mbars" dir="ltr" onMouseLeave={() => setHover(null)}>
        {all.map((x, i) => (
          <div key={x.day} className={`gy-mbar${hover === i ? ' on' : ''}`} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
            <span className="s" style={{ height: `${(x.shop / max) * 100}%` }} />
            <span className="m" style={{ height: `${(x.memberships / max) * 100}%` }} />
          </div>
        ))}
        {h && <div className="gy-tip" style={{ insetInlineStart: `${((hover! + 0.5) / all.length) * 100}%` }}><b>{date(h.day)}</b><span><i className="a" />{money(h.memberships)}</span><span><i className="c" />{money(h.shop)}</span></div>}
      </div>
    </section>
  );
}

/** When it's busy: visits by day of week × hour, one ember ramp (darker = busier). */
function Heat({ heat }: { heat: { dow: number; h: number; n: number }[] }) {
  const { g, num } = useG();
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6:00 – 23:00
  const order = [6, 0, 1, 2, 3, 4, 5]; // the Iraqi week starts on Saturday
  const max = Math.max(1, ...heat.map((x) => x.n));
  const at = (d: number, h: number) => heat.find((x) => x.dow === d && x.h === h)?.n ?? 0;
  const peak = heat.reduce((a, b) => (b.n > (a?.n ?? 0) ? b : a), null as null | { dow: number; h: number; n: number });
  if (!heat.length) return null;
  return (
    <section className="gy-card">
      <header className="gy-card-h"><h2>{g.reports.busy}</h2>{peak && <span className="sub">{fmt(g.reports.peak, { day: g.reports.days[peak.dow], h: `${peak.h}:00` })}</span>}</header>
      <div className="gy-heat" dir="ltr">
        <span />
        {hours.map((h) => <span key={h} className="gy-heat-x">{h % 3 === 0 ? h : ''}</span>)}
        {order.map((d) => [
          <span key={`l${d}`} className="gy-heat-y">{g.reports.days[d]}</span>,
          ...hours.map((h) => { const n = at(d, h); return <i key={`${d}-${h}`} style={{ ['--v' as any]: n / max }} className={n ? '' : 'z'} title={`${g.reports.days[d]} ${h}:00 · ${num(n)}`} />; }),
        ])}
      </div>
    </section>
  );
}
