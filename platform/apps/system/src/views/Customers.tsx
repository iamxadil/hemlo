// The debt book (الدفتر): who owes what, the full history per customer, payments, and a WhatsApp reminder.
import { locale } from '../lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Customer } from '../lib/api';
import { useApp, useRoute, go, fill, localPhone, initials } from '../lib/app';
import { DinarInput, Empty, Icon, Money, Sheet } from '../components/ui';
import { logReminder } from '../components/Impact';
import { Importer } from '../components/Importer';

export function Customers() {
  const { t, num, can, sys } = useApp();
  const { params } = useRoute();
  const shop = sys.business.kind !== 'dental' && sys.business.kind !== 'gym';
  const [q, setQ] = useState('');
  const list = useQuery<Customer[]>({ queryKey: ['customers', q], queryFn: async () => (await api(`/v1/sys/customers?q=${encodeURIComponent(q)}`)).customers });
  const rows = list.data ?? [];
  const owed = rows.filter((c) => c.balance > 0);
  const total = owed.reduce((s, c) => s + c.balance, 0);
  const open = params.get('id');
  const close = () => go('#/customers');

  return (
    <div className="grid gap-4">
      <div className="kpis !grid-cols-1 sm:!grid-cols-2">
        <div className="panel kpi hero"><p>{t.customers.totalDebt}</p><p className="v"><Money v={total} /></p><p className="d">{fill(t.customers.people, { n: num(owed.length) })}</p></div>
        <div className="flex flex-col justify-center gap-3">
          <div className="search"><Icon n="search" /><input className="input" placeholder={t.customers.search} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {can('customers.create') && <div className="flex flex-wrap gap-2">
            <a className="btn btn-accent btn-sm" href="#/customers?id=new"><Icon n="plus" className="h-4 w-4" />{t.customers.add}</a>
            {shop && <a className="btn btn-secondary btn-sm" href="#/customers?id=import"><Icon n="upload" className="h-4 w-4" />{t.importer.choice}</a>}
          </div>}
        </div>
      </div>
      <div className="panel rows overflow-clip">
        {list.isLoading ? <div className="skeleton m-4 h-40" /> : !rows.length ? <Empty icon="customers" text={t.customers.empty} /> : rows.map((c) => (
          <a key={c.id} className="row" href={`#/customers?id=${c.id}`}>
            <span className="avatar">{initials(c.name)}</span>
            <span className="min-w-0 flex-1"><b className="block truncate font-medium">{c.name}</b><span className="sub" dir="ltr">{localPhone(c.phone) || ' '}</span></span>
            <Balance v={c.balance} />
          </a>
        ))}
      </div>
      {open === 'new' && <NewCustomer onClose={close} />}
      {open === 'import' && shop && can('customers.create') && <Importer kind="customers" onClose={close} />}
      {open && open !== 'new' && open !== 'import' && <CustomerSheet id={open} onClose={close} />}
    </div>
  );
}

function Balance({ v, big = false }: { v: number; big?: boolean }) {
  const { t } = useApp();
  const cls = big ? 'text-2xl font-bold' : 'font-semibold';
  if (v > 0) return <span className="text-end"><span className="sub block">{t.customers.owes}</span><Money v={v} className={`${cls} text-[var(--warn)]`} /></span>;
  if (v < 0) return <span className="text-end"><span className="sub block">{t.customers.credit}</span><Money v={-v} className={`${cls} text-[var(--ok)]`} /></span>;
  return <span className="pill ok">{t.customers.clear}</span>;
}

function NewCustomer({ onClose }: { onClose(): void }) {
  const { t, errorText } = useApp();
  const qc = useQueryClient();
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [note, setNote] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => api('/v1/sys/customers', { body: { name, phone: phone || null, note: note || null } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['customers'] }); go(`#/customers?id=${r.customer.id}`); },
    onError: (e) => setError(errorText(e)),
  });
  return (
    <Sheet title={t.customers.add} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{t.customers.save}</button>}>
      <label className="field">{t.customers.name}<input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">{t.customers.phone}<input className="input" dir="ltr" inputMode="tel" placeholder="07xx xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="field">{t.customers.note}<textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
    </Sheet>
  );
}

function CustomerSheet({ id, onClose }: { id: string; onClose(): void }) {
  const { t, sys, can, num, dateTime, toast, errorText, lang } = useApp();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['customer', id], queryFn: () => api(`/v1/sys/customers/${id}`) });
  const [amount, setAmount] = useState<number | null>(null);
  const pay = useMutation({
    mutationFn: () => api(`/v1/sys/customers/${id}/payments`, { body: { amount } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); qc.invalidateQueries({ queryKey: ['customer', id] }); qc.invalidateQueries({ queryKey: ['report'] }); qc.invalidateQueries({ queryKey: ['shift'] }); setAmount(null); toast(t.customers.recorded); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const c: Customer | undefined = data.data?.customer;
  if (!c) return <Sheet title="…" onClose={onClose}><div className="skeleton h-40" /></Sheet>;
  const digits = c.phone?.replace(/\D/g, '');
  const reminder = fill(t.customers.reminder, { name: c.name.split(/\s+/)[0], shop: sys.business.name, amount: new Intl.NumberFormat(locale(lang)).format(c.balance) });
  return (
    <Sheet title={c.name} sub={<span dir="ltr">{localPhone(c.phone)}</span>} onClose={onClose} icon={<span className="avatar !h-11 !w-11">{initials(c.name)}</span>}>
      <div className="flex items-center justify-between rounded-2xl bg-[var(--sunken)] p-4"><span className="muted">{t.sell.balance}</span><Balance v={c.balance} big /></div>
      {digits && <div className="grid grid-cols-2 gap-2">
        <a className={`btn btn-secondary justify-center${c.balance > 0 ? '' : ' pointer-events-none opacity-50'}`} href={`https://wa.me/${digits}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noopener" onClick={() => logReminder({ customerId: c.id, kind: 'debt', amount: c.balance })}><Icon n="wa" className="h-5 w-5" />{t.customers.remind}</a>
        <a className="btn btn-secondary justify-center" href={`tel:${c.phone}`}><Icon n="phone" className="h-5 w-5" />{t.customers.call}</a>
      </div>}
      {can('sales.create') && <section>
        <p className="sec-t">{t.customers.payment}</p>
        <div className="flex gap-2"><DinarInput value={amount} onChange={setAmount} placeholder={c.balance > 0 ? num(c.balance) : '0'} />
          <button className="btn btn-accent shrink-0" disabled={!amount || pay.isPending} onClick={() => pay.mutate()}>{t.customers.record}</button></div>
        {c.balance > 0 && <button className="link-arrow mt-2 text-sm" onClick={() => setAmount(c.balance)}>{t.sell.exact}: <Money v={c.balance} /></button>}
      </section>}
      {c.note && <div className="note"><Icon n="info" /><span>{c.note}</span></div>}
      <section>
        <p className="sec-t">{t.customers.history}</p>
        <ul className="ledger">
          {(data.data?.ledger ?? []).map((l: any) => (
            <li key={l.id}>
              <span>{t.customers.kinds[l.kind] ?? l.kind}{l.saleNumber ? <> · <a className="link-arrow" href={`#/sales?id=${l.saleId}`}>{fill(t.customers.saleN, { n: l.saleNumber })}</a></> : null}
                <span className="sub block">{dateTime(l.at)}{l.note ? ` · ${l.note}` : ''}</span></span>
              <span className="text-end"><b className={l.amount > 0 ? 'plus' : 'minus'} dir="ltr">{l.amount > 0 ? '+' : '−'}{num(Math.abs(l.amount))}</b><span className="sub block"><Money v={l.balance} /></span></span>
            </li>
          ))}
        </ul>
      </section>
    </Sheet>
  );
}
