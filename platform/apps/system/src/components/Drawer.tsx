// The cash drawer (تسليم الصندوق): open with the float, close with a count. Shows what should be there, line by line.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, fill } from '../lib/app';
import { DinarInput, Icon, Money, Sheet } from './ui';

export const useShift = () => useQuery({ queryKey: ['shift'], queryFn: () => api('/v1/sys/shift'), refetchInterval: 60_000 });

export function DrawerButton() {
  const { t, time } = useApp();
  const shift = useShift();
  const [open, setOpen] = useState(false);
  const s = shift.data?.shift;
  return (
    <>
      <button className={`btn btn-sm ${s ? 'btn-secondary' : 'btn-accent'}`} onClick={() => { shift.refetch(); setOpen(true); }} title={s ? fill(t.drawer.openSince, { t: time(s.openedAt) }) : t.drawer.closed}>
        <Icon n="drawer" className="h-4 w-4" /><span className="hidden sm:inline">{s ? t.drawer.close : t.drawer.open}</span>
      </button>
      {open && (s ? <CloseDrawer data={shift.data} onClose={() => setOpen(false)} /> : <OpenDrawer onClose={() => setOpen(false)} />)}
    </>
  );
}

function OpenDrawer({ onClose }: { onClose(): void }) {
  const { t, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [cash, setCash] = useState<number | null>(null);
  const open = useMutation({
    mutationFn: () => api('/v1/sys/shift/open', { body: { openingCash: cash ?? 0 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift'] }); toast(t.drawer.opened); onClose(); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  return (
    <Sheet center title={t.drawer.open} onClose={onClose} icon={<span className="thumb"><Icon n="drawer" className="h-5 w-5" /></span>}
      footer={<button className="btn btn-accent pay-btn" disabled={open.isPending} onClick={() => open.mutate()}>{t.drawer.open}</button>}>
      <label className="field">{t.drawer.openBody}<DinarInput value={cash} onChange={setCash} autoFocus placeholder="0" /></label>
    </Sheet>
  );
}

export function DrawerLines({ drawer }: { drawer: Record<string, number> }) {
  const { t } = useApp();
  const row = (k: string, sign: '' | '+' | '−', muted = false) => (
    <div key={k} className={`flex justify-between py-1.5 text-sm ${muted ? 'muted' : ''}`}><span>{t.drawer.lines[k]}</span><span className="money">{sign && drawer[k] ? `${sign} ` : ''}<Money v={drawer[k]} /></span></div>
  );
  return (
    <div className="rounded-2xl border border-[var(--line)] px-4 py-2">
      {row('opening', '')}{row('cashSales', '+')}{row('debtPayments', '+')}{row('refunds', '−')}{row('expenses', '−')}{row('supplierPayments', '−')}
      <div className="my-1 border-t border-[var(--line)]" />
      <div className="flex justify-between py-1.5 font-semibold"><span>{t.drawer.expected}</span><Money v={drawer.expected} /></div>
      {row('cardSales', '', true)}{drawer.fibSales ? row('fibSales', '', true) : null}{row('onAccount', '', true)}
    </div>
  );
}

export function Difference({ diff }: { diff: number }) {
  const { t } = useApp();
  return <div className={`change${diff < 0 ? ' short' : ''}`}><span>{diff === 0 ? t.drawer.exact : diff < 0 ? t.drawer.short : t.drawer.over}</span>{diff !== 0 && <Money v={Math.abs(diff)} />}</div>;
}

function CloseDrawer({ data, onClose }: { data: any; onClose(): void }) {
  const { t, time, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [counted, setCounted] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<any>(null);
  const close = useMutation({
    mutationFn: () => api('/v1/sys/shift/close', { body: { countedCash: counted, note: note || null } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['shift'] }); qc.invalidateQueries({ queryKey: ['shifts'] }); setDone(r); toast(t.drawer.closed_); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const d = done?.drawer ?? data.drawer;
  return (
    <Sheet center title={t.drawer.close} sub={fill(t.drawer.openSince, { t: time(data.shift.openedAt) })} onClose={onClose} icon={<span className="thumb"><Icon n="drawer" className="h-5 w-5" /></span>}
      footer={done ? <button className="btn btn-accent pay-btn" onClick={onClose}>{t.close}</button>
        : <button className="btn btn-accent pay-btn" disabled={counted == null || close.isPending} onClick={() => close.mutate()}>{t.drawer.closeBtn}</button>}>
      <DrawerLines drawer={d} />
      {done ? <Difference diff={done.difference} /> : <>
        <label className="field">{t.drawer.counted}<DinarInput value={counted} onChange={setCounted} autoFocus /></label>
        {counted != null && <Difference diff={counted - d.expected} />}
        <label className="field">{t.drawer.note}<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </>}
    </Sheet>
  );
}
