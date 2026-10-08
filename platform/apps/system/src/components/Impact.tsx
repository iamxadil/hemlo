// What Hemlo brought back: the money that came in after the business's WhatsApp reminders (a membership renewed, a member
// back, a debt paid), set against what Hemlo costs for the same time. A card for the reports and the plan page, and a slim
// line for the desk. One small request, remembered for five minutes; the figure counts up once, then sits still.
import { useEffect, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, fill } from '../lib/app';
import { Icon } from './ui';

type Part = { n: number; money: number };
export type Impact = { days: number; window: number; reminders: number; total: number; price: number | null; renewals: Part; back: Part; payments: Part; trial: { daysLeft: number } | null };

export const useImpact = (days = 30, enabled = true) =>
  useQuery({ queryKey: ['impact', days], queryFn: () => api<Impact>(`/v1/sys/impact?days=${days}`), staleTime: 300_000, enabled });

/** A reminder went out on WhatsApp: noted for "what Hemlo brought back" (never in the way of the message itself). */
export function logReminder(body: { customerId: string; kind: 'renewal' | 'lapsed' | 'debt'; refId?: string; amount?: number }) {
  api('/v1/sys/reminders', { body }).catch(() => {});
}

/** A number that counts up to its value once (not with reduced motion). */
function useCountUp(to: number, ms = 1000) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / ms); setV(to * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

/** quiet: show nothing until a reminder has gone out (where the card would only be in the way). */
export function ImpactCard({ days = 30, kind, quiet = false }: { days?: number; kind: 'gym' | 'store'; quiet?: boolean }) {
  const { t, money, num, can } = useApp();
  const allowed = can('reports.read');
  const q = useImpact(days, allowed);
  const x = q.data;
  const shown = useCountUp(x?.total ?? 0);
  if (!allowed) return null;
  if (!x) return quiet ? null : <div className="skeleton h-40" />;
  const I = t.impact;
  if (!x.reminders && !x.total) return quiet ? null : (
    <section className="impact is-empty">
      <span className="impact-ic"><Icon n="wa" /></span>
      <span className="min-w-0"><b>{I.emptyTitle}</b><p>{kind === 'gym' ? I.emptyGym : I.emptyStore}</p></span>
      <a className="btn btn-secondary btn-sm" href={kind === 'gym' ? '#/renewals' : '#/customers'}>{kind === 'gym' ? I.goGym : I.goStore}</a>
    </section>
  );
  const rows = ([[I.renewals, x.renewals], [I.back, x.back], [I.payments, x.payments]] as [string, Part][]).filter(([, v]) => v.n > 0);
  const cost = x.price ? Math.round((x.price * x.days) / 30) : 0; // Hemlo for the same days
  const top = Math.max(x.total, cost, 1), ratio = cost ? x.total / cost : 0;
  const bar = (v: number) => ({ '--w': `${Math.max(2, (v / top) * 100)}%` }) as CSSProperties;
  return (
    <section className="impact">
      <header className="impact-h">
        <span className="impact-ic"><Icon n="sparkle" /></span>
        <span className="min-w-0 flex-1"><b>{I.title}</b><small>{fill(I.period, { n: num(x.days) })} · {fill(I.sent, { n: num(x.reminders) })}</small></span>
        {ratio >= 1 && <span className="impact-x">{ratio >= 1.5 ? fill(I.times, { x: num(Math.floor(ratio * 10) / 10) }) : I.cover}</span>}
      </header>
      <div className="impact-big"><b>{money(Math.round(shown))}</b><span>{I.after}</span></div>
      {x.total === 0 ? <p className="impact-wait">{fill(I.waiting, { n: num(x.reminders) })}</p> : <>
        <ul className="impact-rows">
          {rows.map(([label, v]) => <li key={label}><span className="dot" /><span className="min-w-0 flex-1">{label}<small> · {num(v.n)}</small></span><b>{money(v.money)}</b></li>)}
        </ul>
        {cost > 0 && (
          <div className="impact-vs">
            <div className="bar"><span>{I.returned}</span><i style={bar(x.total)} /><b>{money(x.total)}</b></div>
            <div className="bar hemlo"><span>{I.costs}</span><i style={bar(cost)} /><b>{money(cost)}{x.days === 30 && <small> {I.perMonth}</small>}</b></div>
          </div>
        )}
      </>}
      <p className="impact-how">{fill(I.how, { d: num(x.window) })}</p>
    </section>
  );
}

/** One line for the desk: what came back this month, and where to see how. Shown only when there's something to show. */
export function ImpactBanner() {
  const { t, money, can } = useApp();
  const allowed = can('reports.read');
  const q = useImpact(30, allowed);
  if (!allowed || !q.data || q.data.total <= 0) return null;
  return (
    <a className="impact-banner" href="#/reports">
      <span className="impact-ic sm"><Icon n="sparkle" /></span>
      <span className="min-w-0 flex-1">{fill(t.impact.banner, { amount: money(q.data.total) })}</span>
      <span className="go">{t.impact.see}<Icon n="arrow" className="rtl:-scale-x-100" /></span>
    </a>
  );
}
