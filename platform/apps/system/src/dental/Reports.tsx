// Reports: work done vs money in, each dentist's share (with a printable statement), procedures, no-shows, plans
// accepted, where new patients come from, and who owes.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Icon, Money } from '../components/ui';
import { useD } from './i18n';
import { printDoc, esc } from './print';

function range(kind: 'month' | 'last' | 'd30') {
  const now = new Date(Date.now() + 3 * 3600_000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const at = (yy: number, mm: number) => new Date(`${new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 10)}T00:00:00+03:00`);
  if (kind === 'month') return { from: at(y, m), to: new Date(Date.now() + 60_000) };
  if (kind === 'last') return { from: at(y, m - 1), to: at(y, m) };
  return { from: new Date(Date.now() - 30 * 86400_000), to: new Date(Date.now() + 60_000) };
}

export function Reports() {
  const { d, num, money, date, sys, lang } = useD();
  const [kind, setKind] = useState<'month' | 'last' | 'd30'>('month');
  const r = range(kind);
  const q = useQuery({ queryKey: ['dent-reports', kind], queryFn: () => api(`/v1/dent/reports?from=${r.from.toISOString()}&to=${r.to.toISOString()}`) });
  const x = q.data;
  const statement = (row: any) => printDoc({ lang, clinic: sys.business.name, logo: sys.business.logoUrl, title: `${d.reports.statement} · ${row.name}`, size: 'A4', body: `
    <h2>${esc(d.reports.statement)}: ${esc(row.name ?? d.reports.noDentist)}</h2><div class="meta"><span>${esc(date(x.from))} — ${esc(date(x.to))}</span></div>
    <table><tbody>
      <tr><td>${esc(d.reports.billed)}</td><td class="num">${esc(money(row.billed))}</td></tr>
      <tr><td>${esc(d.reports.collected)}</td><td class="num">${esc(money(row.collected))}</td></tr>
      <tr><td>${esc(d.reports.labCost)}</td><td class="num">−${esc(money(row.labCost))}</td></tr>
      <tr><td>${esc(d.reports.share)} (${row.sharePercent}% ${esc(d.reports.basis[row.shareBasis] ?? '')})</td><td class="num"></td></tr>
      <tr class="total"><td>${esc(d.reports.share)}</td><td class="num">${esc(money(row.share))}</td></tr>
    </tbody></table><div class="sign"><div>${esc(row.name ?? '')}</div><div>${esc(sys.business.name)}</div></div>` });
  return (
    <div className="grid gap-4">
      <div className="chips">{(['month', 'last', 'd30'] as const).map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{d.reports[k]}</button>)}</div>
      {!x ? <div className="grid gap-4"><div className="kpis">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28" />)}</div><div className="skeleton h-56" /></div> : <>
        <section className="kpis">
          <div className="panel kpi hero"><p>{d.reports.collected}</p><p className="v"><Money v={x.collected} /></p><p className="d">{d.reports.billed}: {money(x.billed)}</p></div>
          <div className="panel kpi"><p>{d.reports.visits}</p><p className="v">{num(x.visits)}</p><p className="d">{d.reports.seen}: {num(x.patientsSeen)} · {d.reports.newPatients}: {num(x.newPatients)}</p></div>
          <div className="panel kpi"><p>{d.reports.noShow}</p><p className={`v ${x.appointments.noShowRate >= 15 ? 'text-[var(--warn)]' : ''}`}>{x.appointments.noShowRate}%</p><p className="d">{num(x.appointments.no_show)} / {num(x.appointments.total)}</p></div>
          <div className="panel kpi"><p>{d.reports.acceptance}</p><p className="v">{x.plans.acceptance == null ? '—' : `${x.plans.acceptance}%`}</p><p className="d">{num(x.plans.accepted)} / {num(x.plans.accepted + x.plans.declined)}</p></div>
        </section>
        <section className="panel overflow-clip">
          <div className="panel-h"><h2>{d.reports.dentists}</h2></div>
          <table className="tbl"><thead><tr><th>{d.reports.dentist}</th><th>{d.reports.billed}</th><th>{d.reports.collected}</th><th>{d.reports.labCost}</th><th>%</th><th>{d.reports.share}</th><th /></tr></thead>
            <tbody>{x.byDentist.map((row: any) => (
              <tr key={row.dentistId ?? 'none'}>
                <td className="font-medium">{row.name ?? d.reports.noDentist}</td><td><Money v={row.billed} /></td><td><Money v={row.collected} /></td><td><Money v={row.labCost} /></td>
                <td>{row.sharePercent ? `${row.sharePercent}% ${d.reports.basis[row.shareBasis] ?? ''}` : '—'}</td><td className="font-semibold"><Money v={row.share} /></td>
                <td>{row.dentistId && <button className="icon-btn" onClick={() => statement(row)} aria-label={d.reports.statement}><Icon n="print" /></button>}</td>
              </tr>
            ))}</tbody></table>
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel">
            <div className="panel-h"><h2>{d.reports.procedures}</h2></div>
            <ul className="rows">{x.byProcedure.slice(0, 15).map((p: any) => <li key={p.name} className="row"><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="sub">× {num(p.count)}</span><Money v={p.amount} className="w-28 text-end font-semibold" /></li>)}</ul>
          </section>
          <section className="panel">
            <div className="panel-h"><h2>{d.reports.owed}</h2><Money v={x.outstanding.total} className="font-semibold text-[var(--warn)]" /></div>
            <ul className="rows">{x.outstanding.top.map((p: any) => <li key={p.id}><a className="row" href={`#/patient?id=${p.id}&tab=account`}><span className="min-w-0 flex-1 truncate">{p.name}</span><Money v={p.balance} className="font-semibold" /></a></li>)}</ul>
          </section>
          <section className="panel lg:col-span-2">
            <div className="panel-h"><h2>{d.reports.referral}</h2></div>
            <div className="flex flex-wrap gap-2 px-5 pb-5">{x.referral.map((r2: any) => <span key={r2.source} className="pill">{r2.source} · {num(r2.n)}</span>)}</div>
          </section>
        </div>
      </>}
    </div>
  );
}
