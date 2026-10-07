// Selling (or renewing) a membership: pick the plan, see exactly when it starts and ends (a renewal continues after the
// current one), take what they pay now; the rest goes on their account.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DinarInput, Icon, Sheet } from '../components/ui';
import { useG } from './i18n';
import { useSetup, todayISO, addDays, endOf, fmt, type Membership, type Plan } from './data';

export function SellSheet({ memberId, name, onClose, onSold }: { memberId: string; name: string; onClose(): void; onSold?(): void }) {
  const { g, can, money, date, toast, err } = useG();
  const qc = useQueryClient();
  const setup = useSetup();
  const file = useQuery({ queryKey: ['gym-member', memberId], queryFn: () => api(`/v1/gym/members/${memberId}`) });
  const plans = (setup.data?.plans ?? []).filter((p) => p.active);
  const [planId, setPlanId] = useState<string | null>(null);
  const plan: Plan | undefined = plans.find((p) => p.id === planId) ?? undefined;
  const [startsOn, setStartsOn] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);
  const [discount, setDiscount] = useState<number | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [trainerId, setTrainerId] = useState('');
  const [note, setNote] = useState('');
  const day = todayISO();
  // where a renewal would start: the day after the current one of the same kind ends
  const after = useMemo(() => {
    if (!plan) return null;
    const ms = ((file.data?.memberships ?? []) as Membership[]).filter((m) => m.category === plan.category && m.status !== 'canceled' && m.endsOn >= day).sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
    return ms ? addDays(ms.endsOn, 1) : null;
  }, [plan, file.data, day]);
  const start = startsOn || after || day;
  const ends = plan ? endOf(start, plan.duration, plan.unit) : null;
  const listPrice = plan?.price ?? 0, p = price ?? listPrice, total = Math.max(0, p - (discount ?? 0));
  const pay = paid ?? total, rest = Math.max(0, total - pay);
  const pick = (x: Plan) => { setPlanId(x.id); setPrice(null); setDiscount(null); setPaid(null); setStartsOn(''); if (x.category === 'pt') setTrainerId(file.data?.member?.trainerId ?? ''); };
  const sell = useMutation({
    mutationFn: () => api('/v1/gym/memberships', { body: { memberId, planId, startsOn: startsOn || undefined, price: price ?? undefined, discount: discount ?? 0, paid: Math.min(pay, total), method, trainerId: trainerId || undefined, note: note || undefined } }),
    onSuccess: () => {
      for (const k of ['gym-member', 'gym-members', 'gym-today', 'gym-renewals', 'customers']) qc.invalidateQueries({ queryKey: [k] });
      toast(g.sell.done); onSold?.(); onClose();
    },
    onError: (e) => toast(err(e), 'bad'),
  });
  const cats = ['gym', 'pt', 'class', 'other'].filter((c) => plans.some((x) => x.category === c));
  return (
    <Sheet title={after ? g.sell.renew : g.sell.title} sub={name} onClose={onClose}
      footer={<button className="btn btn-accent justify-center" disabled={!plan || sell.isPending} onClick={() => sell.mutate()}>{sell.isPending ? <span className="spinner" /> : fmt(g.sell.go, { v: money(total) })}</button>}>
      {cats.map((c) => (
        <section key={c} className="grid gap-2">
          {cats.length > 1 && <p className="sec-t !mb-0">{g.sell.cats[c]}</p>}
          <div className="gy-plans">
            {plans.filter((x) => x.category === c).map((x) => (
              <button key={x.id} type="button" className="gy-plan" aria-pressed={x.id === planId} onClick={() => pick(x)}>
                <b>{x.name}</b>
                <span className="gy-plan-p">{money(x.price)}</span>
                <span className="sub">{x.duration} {g.setup.unit[x.unit]}{x.visits ? ` · ${fmt(g.sell.visits, { n: x.visits })}` : ''}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {plan && <>
        <div className="gy-when">
          <Icon n="calendar" />
          <div className="min-w-0 flex-1">
            <b>{date(start)} – {ends && date(ends)}</b>
            <span className="sub block">{after && !startsOn ? fmt(g.sell.after, { date: date(after) }) : g.sell.starts}</span>
          </div>
          <input type="date" className="input w-auto" dir="ltr" value={start} min={addDays(day, -60)} onChange={(e) => setStartsOn(e.target.value)} aria-label={g.sell.starts} />
        </div>
        {plan.category === 'pt' && (
          <label className="field">{g.sell.coach}
            <select className="input" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
              <option value="">—</option>{(setup.data?.trainers ?? []).filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{g.sell.price}{can('memberships.manage') ? <DinarInput value={p} onChange={setPrice} /> : <span className="input grid items-center money" dir="ltr">{money(listPrice)}</span>}</label>
          <label className="field">{g.sell.discount}<DinarInput value={discount} onChange={setDiscount} placeholder="0" /></label>
        </div>
        <label className="field">{g.sell.paid}<DinarInput value={paid ?? total} onChange={setPaid} /></label>
        <div className="seg">{(['cash', 'card'] as const).map((m) => <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>{g.sell[m]}</button>)}</div>
        {rest > 0 && <p className="note warn"><Icon n="info" />{fmt(g.sell.rest, { v: money(rest) })}</p>}
        <label className="field">{g.sell.note}<input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
      </>}
    </Sheet>
  );
}
