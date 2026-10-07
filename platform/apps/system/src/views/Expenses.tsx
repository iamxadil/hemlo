// Expenses: rent, the generator, salaries… so profit is real profit. Paid from the drawer or from elsewhere.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, dayRange } from '../lib/app';
import { DinarInput, Empty, Icon, Money, Sheet } from '../components/ui';
import { Attachments } from '../components/Images';
import type { UploadedFile } from '../lib/api';

const CATS = ['rent', 'generator', 'electricity', 'salaries', 'transport', 'supplies', 'other'] as const;
const PERIODS = { month: [0, 30], week: [0, 7], today: [0, 1] } as const;

export function Expenses() {
  const { t, can, dateTime, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<keyof typeof PERIODS>('month');
  const [adding, setAdding] = useState(false);
  const range = dayRange(PERIODS[period][0], PERIODS[period][1]);
  const q = useQuery({ queryKey: ['expenses', period], queryFn: async () => (await api(`/v1/sys/expenses?from=${range.from}&to=${range.to}`)).expenses as any[] });
  const rows = q.data ?? [];
  const total = rows.reduce((s, x) => s + x.amount, 0);
  const byCat = CATS.map((c) => ({ c, v: rows.filter((x) => x.category === c).reduce((s, x) => s + x.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const del = useMutation({
    mutationFn: (id: string) => api(`/v1/sys/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['report'] }); qc.invalidateQueries({ queryKey: ['shift'] }); toast(t.expenses.deleted); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="chips">{(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((p) => <button key={p} className="chip" aria-pressed={period === p} onClick={() => setPeriod(p)}>{t.home.periods[p]}</button>)}</div>
        {can('expenses.create') && <button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{t.expenses.add}</button>}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="panel rows overflow-clip">
          {q.isLoading ? <div className="skeleton m-4 h-40" /> : !rows.length ? <Empty icon="wallet" text={t.expenses.empty} /> : rows.map((x) => (
            <div key={x.id} className="row">
              <span className="thumb"><Icon n={x.category === 'generator' || x.category === 'electricity' ? 'drawer' : 'wallet'} className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><b className="block font-medium">{t.expenses.cats[x.category]}</b><span className="sub">{dateTime(x.at)}{x.note ? ` · ${x.note}` : ''}{x.fromDrawer ? ` · ${t.expenses.fromDrawer}` : ''}</span>{x.attachments?.length > 0 && <span className="mt-1.5 block"><Attachments purpose="expense" files={x.attachments} readOnly /></span>}</span>
              <Money v={x.amount} className="font-semibold" />
              {can('expenses.create') && <button className="icon-btn" aria-label={t.expenses.delete} onClick={() => del.mutate(x.id)}><Icon n="trash" /></button>}
            </div>
          ))}
        </div>
        <div className="panel kpi self-start">
          <p>{t.expenses.total}</p><p className="v"><Money v={total} /></p>
          <div className="mt-3 grid gap-1.5">{byCat.map((x) => <div key={x.c} className="flex justify-between text-sm"><span className="muted">{t.expenses.cats[x.c]}</span><Money v={x.v} /></div>)}</div>
        </div>
      </div>
      {adding && <AddExpense onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddExpense({ onClose }: { onClose(): void }) {
  const { t, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>('generator');
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [fromDrawer, setFromDrawer] = useState(true);
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const save = useMutation({
    mutationFn: () => api('/v1/sys/expenses', { body: { category, amount, note: note || null, fromDrawer, attachmentIds: photos.map((p) => p.id) } }),
    onSuccess: () => { ['expenses', 'report', 'shift'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(t.expenses.saved); onClose(); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  return (
    <Sheet title={t.expenses.add} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!amount || save.isPending} onClick={() => save.mutate()}>{t.expenses.save}</button>}>
      <section><p className="sec-t">{t.expenses.category}</p><div className="chips">{CATS.map((c) => <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>{t.expenses.cats[c]}</button>)}</div></section>
      <label className="field">{t.expenses.amount}<DinarInput value={amount} onChange={setAmount} autoFocus /></label>
      <label className="field">{t.expenses.note}<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={fromDrawer} onChange={(e) => setFromDrawer(e.target.checked)} />{t.expenses.fromDrawer}</label>
      <section className="grid gap-2"><p className="sec-t !mb-0">{t.images.expense}</p><p className="sub">{t.images.expenseHint}</p><Attachments purpose="expense" files={photos} onChange={setPhotos} /></section>
    </Sheet>
  );
}
