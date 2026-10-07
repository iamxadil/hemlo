// Renewals: the money a gym loses quietly. Memberships ending this week, and the ones that ended lately and weren't
// renewed, each with a WhatsApp reminder written for them (the owner's own words, from the set-up) and a "renew" that
// sells the next one in place. Birthdays this week too: a message on the day keeps people coming.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Empty, Icon } from '../components/ui';
import { useG } from './i18n';
import { Face } from './ui';
import { SellSheet } from './Sell';
import { useSetup, todayISO, daysBetween, waLink, fmt } from './data';

const sent = { get: (id: string) => { try { return localStorage.getItem(`hemlo.gym.reminded.${id}`) === todayISO(); } catch { return false; } }, set: (id: string) => { try { localStorage.setItem(`hemlo.gym.reminded.${id}`, todayISO()); } catch {} } };

export function Renewals() {
  const { g, can, num, date, money, sys } = useG();
  const setup = useSetup();
  const list = useQuery({ queryKey: ['gym-renewals'], queryFn: async () => (await api('/v1/gym/renewals')).renewals as any[] });
  const bdays = useQuery({ queryKey: ['gym-birthdays'], queryFn: async () => (await api('/v1/gym/birthdays')).birthdays as any[] });
  const [selling, setSelling] = useState<{ id: string; name: string } | null>(null);
  const [, bump] = useState(0);
  const day = todayISO();
  const ending = (list.data ?? []).filter((x) => x.endsOn >= day), lapsed = (list.data ?? []).filter((x) => x.endsOn < day).reverse();
  const first = (n: string) => n.split(/\s+/)[0];
  const message = (x: any, gone: boolean) => fmt(gone ? g.renewals.lapsedMsg : setup.data?.settings.reminderText || g.renewals.msg, { name: first(x.member), plan: x.name, date: date(x.endsOn), gym: sys.business.name });
  const when = (end: string) => { const n = daysBetween(day, end); return n === 0 ? g.renewals.today : n > 0 ? fmt(g.renewals.inDays, { n: num(n) }) : fmt(g.renewals.agoDays, { n: num(-n) }); };
  const row = (x: any, gone: boolean) => {
    const wa = waLink(x.phone, message(x, gone)), done = sent.get(x.id);
    return (
      <div key={x.id} className="row gy-rrow">
        <Face name={x.member} state={gone ? 'expired' : 'ending'} />
        <a className="min-w-0 flex-1" href={`#/member?id=${x.memberId}`}>
          <b className="block truncate font-medium">{x.member}</b>
          <span className="sub block truncate">{x.name} · {date(x.endsOn)} · <span className={gone ? 'text-[var(--bad)]' : 'text-[var(--warn)]'}>{when(x.endsOn)}</span>{x.balance > 0 ? ` · ${money(x.balance)}` : ''}</span>
        </a>
        {wa && <a className={`btn btn-sm ${done ? 'btn-ghost' : 'btn-secondary'}`} href={wa} target="_blank" rel="noopener" onClick={() => { sent.set(x.id); bump((n) => n + 1); }}><Icon n={done ? 'check' : 'wa'} className="h-4 w-4" />{done ? g.renewals.reminded : g.renewals.remind}</a>}
        {can('memberships.sell') && <button className="btn btn-accent btn-sm" onClick={() => setSelling({ id: x.memberId, name: x.member })}>{g.renewals.renew}</button>}
      </div>
    );
  };
  if (list.isLoading) return <div className="grid gap-4"><div className="skeleton h-40" /><div className="skeleton h-40" /></div>;
  return (
    <div className="grid gap-6">
      {!ending.length && !lapsed.length ? <Empty icon="check" text={g.renewals.none} /> : <>
        {ending.length > 0 && <section className="grid gap-2"><h2 className="gy-h2">{g.renewals.ending}<span>{num(ending.length)}</span></h2><div className="gy-card rows overflow-clip">{ending.map((x) => row(x, false))}</div></section>}
        {lapsed.length > 0 && <section className="grid gap-2"><h2 className="gy-h2">{g.renewals.lapsed}<span>{num(lapsed.length)}</span></h2><div className="gy-card rows overflow-clip">{lapsed.map((x) => row(x, true))}</div></section>}
      </>}
      {(bdays.data?.length ?? 0) > 0 && (
        <section className="grid gap-2">
          <h2 className="gy-h2">{g.renewals.birthdays} 🎂</h2>
          <div className="gy-card rows overflow-clip">
            {bdays.data!.map((b) => {
              const wa = waLink(b.phone, fmt(g.renewals.birthdayMsg, { name: first(b.name), gym: sys.business.name }));
              const md = b.birthDate.slice(5), on = md === day.slice(5);
              return (
                <div key={b.id} className="row">
                  <Face name={b.name} />
                  <a className="min-w-0 flex-1" href={`#/member?id=${b.id}`}><b className="block truncate font-medium">{b.name}</b><span className="sub">{on ? g.renewals.today : date(`${day.slice(0, 4)}-${md}`)}</span></a>
                  {wa && <a className="btn btn-secondary btn-sm" href={wa} target="_blank" rel="noopener"><Icon n="wa" className="h-4 w-4" />{g.renewals.greet}</a>}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {selling && <SellSheet memberId={selling.id} name={selling.name} onClose={() => setSelling(null)} />}
    </div>
  );
}
