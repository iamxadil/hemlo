// Sales: receipts for a day or a week, reprint, and void (owners and managers).
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Sale } from '../lib/api';
import { useApp, useRoute, go, fill, dayRange } from '../lib/app';
import { Empty, Icon, Money, Sheet } from '../components/ui';
import { Receipt, printReceipt } from '../components/Receipt';

const PERIODS = { today: [0, 1], yesterday: [1, 1], week: [0, 7] } as const;

export function Sales() {
  const { t, num, time, date } = useApp();
  const { params } = useRoute();
  const [period, setPeriod] = useState<keyof typeof PERIODS>('today');
  const range = dayRange(PERIODS[period][0], PERIODS[period][1]);
  const list = useQuery<Sale[]>({ queryKey: ['sales', period], queryFn: async () => (await api(`/v1/sys/sales?from=${range.from}&to=${range.to}`)).sales });
  const rows = list.data ?? [];
  const live = rows.filter((s) => !s.voidedAt);
  const open = params.get('id');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="chips">{(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((p) => <button key={p} className="chip" aria-pressed={period === p} onClick={() => setPeriod(p)}>{t.home.periods[p]}</button>)}</div>
        <div className="flex items-center gap-3">
          <p className="muted text-sm">{fill(t.sales.count, { n: num(live.length) })} · <Money v={live.reduce((s, x) => s + x.total, 0)} className="font-semibold text-[var(--fg)]" /></p>
          {rows.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(rows, t, period)}><Icon n="download" className="h-4 w-4" />{t.export}</button>}
        </div>
      </div>
      <div className="panel rows overflow-clip">
        {list.isLoading ? <div className="skeleton m-4 h-40" /> : !rows.length ? <Empty icon="sales" text={t.sales.empty} /> : rows.map((s) => (
          <a key={s.id} className={`row${s.voidedAt ? ' opacity-55' : ''}`} href={`#/sales?id=${s.id}`}>
            <span className="thumb text-sm">#{s.number}</span>
            <span className="min-w-0 flex-1"><b className="block truncate font-medium">{s.customerName ?? t.sales.walkIn}</b><span className="sub">{period === 'week' ? `${date(s.createdAt)} · ` : ''}{time(s.createdAt)}</span></span>
            {!!s.returned && !s.voidedAt && <span className="pill warn hidden sm:inline-flex"><Icon n="undo" className="h-3 w-3" />{t.returns.btn}</span>}
            {s.voidedAt ? <span className="pill bad">{t.sales.voided}</span> : <span className={`pill ${s.due > 0 ? 'warn' : s.method === 'card' ? 'info' : ''}`}>{t.sales.method[s.method] ?? s.method}</span>}
            <span className={`w-28 text-end font-semibold${s.voidedAt ? ' line-through' : ''}`}><Money v={s.total} /></span>
          </a>
        ))}
      </div>
      {open && <SaleSheet id={open} onClose={() => go('#/sales')} />}
    </div>
  );
}

function SaleSheet({ id, onClose }: { id: string; onClose(): void }) {
  const { t, can, num, dateTime, toast, errorText } = useApp();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['sale', id], queryFn: () => api(`/v1/sys/sales/${id}`) });
  const [confirm, setConfirm] = useState(false);
  const [returning, setReturning] = useState(false);
  const returns = useQuery({ queryKey: ['returns', id], queryFn: async () => (await api(`/v1/sys/sales/${id}/returns`)).returns as any[] });
  const voidIt = useMutation({
    mutationFn: () => api(`/v1/sys/sales/${id}/void`, { body: {} }),
    onSuccess: (r: any) => {
      ['sales', 'sale', 'products', 'customers', 'report', 'shift'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      if (r.fibRefund === 'refunded') toast(t.fib.refunded); else if (r.fibRefund === 'failed') toast(t.fib.refundFailed, 'bad'); else if (r.fibRefund === 'too_late') toast(t.fib.refundLate, 'bad'); else toast(t.sales.voided);
    },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const s: Sale | undefined = data.data?.sale;
  if (!s) return <Sheet title="…" onClose={onClose}><div className="skeleton h-40" /></Sheet>;
  return (
    <Sheet title={fill(t.sell.receipt, { n: s.number })} sub={dateTime(s.createdAt)} onClose={onClose} icon={<span className="thumb"><Icon n="sales" className="h-5 w-5" /></span>}
      footer={<div className={`grid gap-2 ${can('sales.refund') && !s.voidedAt ? 'grid-cols-3' : ''}`}>
        <button className="btn btn-secondary justify-center" onClick={printReceipt}><Icon n="print" className="h-4 w-4" />{t.sales.reprint}</button>
        {can('sales.refund') && !s.voidedAt && (s.returned ?? 0) < s.total && <button className="btn btn-secondary justify-center" onClick={() => setReturning(true)}><Icon n="undo" className="h-4 w-4" />{t.returns.btn}</button>}
        {can('sales.refund') && !s.voidedAt && !s.returned && <button className="btn btn-danger justify-center" disabled={voidIt.isPending}
          onClick={() => (confirm ? voidIt.mutate() : (setConfirm(true), setTimeout(() => setConfirm(false), 3000)))}>{confirm ? t.sales.voidConfirm : t.sales.void}</button>}
      </div>}>
      {s.voidedAt && <div className="note"><Icon n="info" /><span>{t.sales.voided} · {dateTime(s.voidedAt)}{s.note ? ` · ${s.note}` : ''}</span></div>}
      <div className="big-total"><span className="sub">{t.sell.total}</span><b className={s.voidedAt ? 'line-through opacity-50' : ''}><Money v={s.total} /></b>
        <span className="pill mt-2">{t.sales.method[s.method] ?? s.method}</span></div>
      <section>
        <p className="sec-t">{t.sales.lines}</p>
        <ul className="ledger">{data.data.lines.map((l: any) => <li key={l.id}><span>{l.name}{l.packSize ? <span className="pill accent ms-2">{fill(t.pack.of, { n: l.packSize })}</span> : null}
          <span className="sub block" dir="ltr">{num(l.qty)} × {num(l.price)}</span>{l.returnedQty > 0 && <span className="pill warn mt-1">{fill(t.returns.returned, { n: num(l.returnedQty) })}</span>}</span><Money v={l.total} className="font-semibold" /></li>)}</ul>
      </section>
      {(returns.data ?? []).length > 0 && <section><p className="sec-t">{t.returns.list}</p>
        <ul className="ledger">{returns.data!.map((r) => <li key={r.id}><span>{r.lines.map((l: any) => `${l.name} × ${num(l.qty)}`).join('، ')}<span className="sub block">{dateTime(r.createdAt)} · {r.refund === 'account' ? t.returns.account : t.returns.cash}{r.reason ? ` · ${r.reason}` : ''}</span></span><b className="minus" dir="ltr">−{num(r.total)}</b></li>)}</ul></section>}
      <dl className="kv">
        {s.discount > 0 && <><dt>{t.sell.discount}</dt><dd><Money v={s.discount} /></dd></>}
        <dt>{t.sales.paid}</dt><dd><Money v={s.paid} /></dd>
        {s.due > 0 && <><dt>{t.sales.due}</dt><dd><Money v={s.due} /></dd></>}
        {data.data.customer && <><dt>{t.sell.customer}</dt><dd><a className="link-arrow" href={`#/customers?id=${data.data.customer.id}`}>{data.data.customer.name}</a></dd></>}
      </dl>
      <Receipt sale={s} lines={data.data.lines} customer={data.data.customer} />
      {returning && <ReturnSheet sale={s} lines={data.data.lines} customer={data.data.customer} onClose={() => setReturning(false)} />}
    </Sheet>
  );
}

function ReturnSheet({ sale, lines, customer, onClose }: { sale: Sale; lines: any[]; customer: any; onClose(): void }) {
  const { t, num, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [refund, setRefund] = useState<'cash' | 'account'>(customer ? 'account' : 'cash');
  const [reason, setReason] = useState('');
  const factor = sale.subtotal ? sale.total / sale.subtotal : 1;
  const amount = lines.reduce((s, l) => s + Math.round((qty[l.id] ?? 0) * l.price * factor), 0);
  const go = useMutation({
    mutationFn: () => api(`/v1/sys/sales/${sale.id}/returns`, { body: { refund, reason: reason || null, lines: Object.entries(qty).filter(([, n]) => n > 0).map(([lineId, n]) => ({ lineId, qty: n })) } }),
    onSuccess: () => { ['sales', 'sale', 'returns', 'products', 'customers', 'customer', 'report', 'shift'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(t.returns.done); onClose(); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  return (
    <Sheet center title={t.returns.title} sub={fill(t.sell.receipt, { n: sale.number })} onClose={onClose} icon={<span className="thumb"><Icon n="undo" className="h-5 w-5" /></span>}
      footer={<button className="btn btn-accent pay-btn" disabled={!amount || go.isPending} onClick={() => go.mutate()}>{fill(t.returns.confirm, { amount: `${num(amount)} ${t.iqd}` })}</button>}>
      <section><p className="sec-t">{t.returns.pick}</p>
        <div className="grid gap-2">{lines.map((l) => {
          const left = Math.round((l.qty - (l.returnedQty ?? 0)) * 1000) / 1000;
          const n = qty[l.id] ?? 0;
          const step = (d: number) => setQty((q) => ({ ...q, [l.id]: Math.min(left, Math.max(0, Math.round((n + d) * 1000) / 1000)) }));
          return (
            <div key={l.id} className={`flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3${left <= 0 ? ' opacity-50' : ''}`}>
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{l.name}</b><span className="sub" dir="ltr">{num(left)} × {num(l.price)}</span></span>
              <span className="stepper"><button onClick={() => step(-1)} disabled={!n}><Icon n="minus" className="h-4 w-4" /></button><input readOnly value={num(n)} /><button onClick={() => step(1)} disabled={n >= left}><Icon n="plus" className="h-4 w-4" /></button></span>
            </div>
          );
        })}</div></section>
      <section><p className="sec-t">{t.returns.refund}</p>
        <div className="seg"><button aria-pressed={refund === 'cash'} onClick={() => setRefund('cash')}>{t.returns.cash}</button>{customer && <button aria-pressed={refund === 'account'} onClick={() => setRefund('account')}>{t.returns.account}</button>}</div></section>
      <label className="field">{t.returns.reason} <small>· {t.returns.optional}</small><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    </Sheet>
  );
}

/** The period's receipts as a spreadsheet (UTF-8 with BOM, so Excel shows Arabic correctly). */
function exportCsv(rows: Sale[], t: any, period: string) {
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['#', t.receipt.date, t.sell.customer, t.sales.method.cash + '/' + t.sales.method.card, t.sell.subtotal, t.sell.discount, t.sell.total, t.sales.paid, t.sales.due, t.returns.list, t.sales.voided];
  const lines = rows.map((s) => [s.number, new Date(s.createdAt).toISOString().replace('T', ' ').slice(0, 16), s.customerName ?? '', t.sales.method[s.method] ?? s.method, s.subtotal, s.discount, s.total, s.paid, s.due, s.returned ?? 0, s.voidedAt ? '✓' : ''].map(esc).join(','));
  const blob = new Blob(['\ufeff' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hemlo-sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
