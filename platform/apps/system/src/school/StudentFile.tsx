// A student's file: who they are, their parents (WhatsApp, and the parent's private link), brothers and sisters here,
// the account (every charge and receipt, newest last, with the balance), and four months of attendance at a glance.
// Taking a payment is one sheet that ends on a receipt: print it, or send it on WhatsApp.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { go } from '../lib/app';
import { rtl } from '../lib/i18n';
import { useS } from './i18n';
import { SIcon, Avatar, Page, Skel, Empty, Sheet, Select, Segmented, Tabs, TabPanel, Bar } from './ui';
import { addDays, classOptions, familyLink, fill, localPhone, todayIso, useHashQuery, useSetup, waLink } from './data';

type FileData = {
  student: any; enrollment: { classId: string; className: string; gradeId: string; gradeName: string; enrolledOn: string } | null;
  guardians: { id: string; name: string; relation: string; phone: string | null; token: string; primary: boolean }[]; siblings: { id: string; name: string; number: number }[];
  charges: { id: string; kind: string; label: string; amount: number; dueOn: string }[]; payments: { id: string; number: number; amount: number; method: string; payer: string | null; note: string | null; void: boolean; at: string }[];
  money: { charged: number; paid: number; balance: number; overdue: number; nextDue: string | null };
  attendance: { days: { day: string; status: string; note: string | null }[]; counts: Record<string, number> };
};

export function StudentFile() {
  const { s, can, money, num, date, sys } = useS();
  const id = useHashQuery().get('id') ?? '';
  const [tab, setTab] = useState('overview'), [paying, setPaying] = useState(false), [charging, setCharging] = useState(false), [moving, setMoving] = useState(false);
  const q = useQuery<FileData>({ queryKey: ['sch-student', id], queryFn: () => api(`/v1/sch/students/${id}`), enabled: !!id });
  if (!id) { go('#/students'); return null; }
  if (q.isLoading || !q.data) return <div className="grid gap-4"><Skel h={140} /><Skel h={320} /></div>;
  const f = q.data, st = f.student, m = f.money, g0 = f.guardians[0];
  const klass = f.enrollment ? `${f.enrollment.gradeName} · ${f.enrollment.className}` : s.students.noClass;
  return (
    <Page>
      <section className="sc-card flex flex-wrap items-center gap-4 p-5">
        <Avatar name={st.name} lg />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-semibold tracking-tight">{st.name}</h2>
          <p className="sc-sub mt-1 flex flex-wrap items-center gap-2"><span className="sc-num">#{st.number}</span><span>·</span><span>{klass}</span>
            {st.status !== 'active' && <span className="sc-pill">{s.file.status[st.status]}</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('fees.collect') && <button className="sc-btn sc-btn-primary" onClick={() => setPaying(true)}><SIcon n="wallet" />{s.shell.collect}</button>}
          {g0?.phone && <a className="sc-btn sc-btn-wa" target="_blank" rel="noopener" href={waLink(g0.phone, '')}><SIcon n="wa" />{s.relations[g0.relation]}</a>}
        </div>
      </section>

      {can('fees.read') && (
        <div className="sc-stats">
          <div className="sc-card sc-stat"><span className="l">{s.file.balance}</span><span className="v">{money(m.balance)}</span><Bar value={m.charged ? m.paid / m.charged : 1} /><span className="sc-sub">{s.file.paidT} {money(m.paid)} / {money(m.charged)}</span></div>
          <div className={`sc-card sc-stat${m.overdue ? ' bad' : ''}`}><span className="l">{s.file.overdue}</span><span className="v">{money(m.overdue)}</span><span className="sc-sub">{m.nextDue ? fill(s.file.nextDue, { date: date(m.nextDue) }) : '—'}</span></div>
        </div>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: s.file.overview }, ...(can('fees.read') ? [{ value: 'fees', label: s.file.fees }] : []), { value: 'attendance', label: s.file.attendance }]}>
        <TabPanel value="overview" className="mt-4 grid gap-4">
          {st.health && <div className="sc-callout"><SIcon n="heart" /><span><b>{s.file.health}: </b>{st.health}</span></div>}
          <section className="sc-card">
            <div className="sc-card-h"><h2>{s.file.guardians}</h2></div>
            <div className="sc-list">
              {f.guardians.map((g) => <Guardian key={g.id} g={g} student={st.name} onChanged={() => q.refetch()} />)}
            </div>
          </section>
          {f.siblings.length > 0 && <section className="sc-card p-4"><h2 className="sc-h2 mb-3">{s.file.siblings}</h2><div className="flex flex-wrap gap-2">{f.siblings.map((x) => <a key={x.id} href={`#/student?id=${x.id}`} className="sc-chip inline-flex items-center gap-2"><Avatar name={x.name} />{x.name}</a>)}</div></section>}
          <section className="sc-card p-4">
            <h2 className="sc-h2 mb-3">{s.file.details}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14.5px]">
              {st.birthDate && <><dt className="sc-sub">{s.file.born}</dt><dd><bdi>{date(st.birthDate)}</bdi></dd></>}
              {st.gender && <><dt className="sc-sub">{s.students.gender}</dt><dd>{s.gender[st.gender]}</dd></>}
              {f.enrollment?.enrolledOn && <><dt className="sc-sub">{s.file.joined}</dt><dd><bdi>{date(f.enrollment.enrolledOn)}</bdi></dd></>}
            </dl>
            {can('students.update') && <button className="sc-btn sc-btn-line sc-btn-sm mt-4" onClick={() => setMoving(true)}><SIcon n="move" />{s.file.move}</button>}
          </section>
        </TabPanel>

        <TabPanel value="fees" className="mt-4">
          <Ledger f={f} onCharge={can('fees.manage') ? () => setCharging(true) : undefined} onChanged={() => q.refetch()} />
        </TabPanel>

        <TabPanel value="attendance" className="mt-4">
          <AttendanceStrip days={f.attendance.days} counts={f.attendance.counts} />
        </TabPanel>
      </Tabs>

      <PaySheet open={paying} onClose={() => setPaying(false)} studentId={id} studentName={st.name} klass={klass} money={m} guardianPhone={g0?.phone ?? null} guardianToken={g0?.token ?? null} school={sys.business.name}
        onPaid={() => q.refetch()} />
      <ChargeSheet open={charging} onClose={() => setCharging(false)} studentId={id} onDone={() => q.refetch()} />
      <MoveSheet open={moving} onClose={() => setMoving(false)} studentId={id} current={f.enrollment?.classId ?? ''} onDone={() => q.refetch()} />
    </Page>
  );
}

function Guardian({ g, student }: { g: FileData['guardians'][number]; student: string; onChanged(): void }) {
  const { s, sys } = useS();
  const link = familyLink(g.token);
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success(s.file.copied); } catch { toast(link); } };
  return (
    <div className="sc-row flex-wrap">
      <Avatar name={g.name} />
      <span className="min-w-0 flex-1"><b className="block truncate">{g.name}</b><span className="sc-sub">{s.relations[g.relation]}{g.phone ? ` · ` : ''}<span dir="ltr">{localPhone(g.phone)}</span></span></span>
      <span className="flex gap-2">
        {g.phone && <a className="sc-btn sc-btn-line sc-btn-sm sc-btn-icon" href={`tel:${g.phone}`} aria-label="call"><SIcon n="phone" /></a>}
        <button className="sc-btn sc-btn-line sc-btn-sm" onClick={copy} title={s.file.familyLinkHint}><SIcon n="link" />{s.file.familyLink}</button>
        {g.phone && <a className="sc-btn sc-btn-wa sc-btn-sm" target="_blank" rel="noopener" href={waLink(g.phone, fill(s.file.linkMsg, { name: g.name, student, school: sys.business.name, link }))}><SIcon n="wa" />{s.file.send}</a>}
      </span>
    </div>
  );
}

/** The account: charges and receipts together by date, with a running balance. */
function Ledger({ f, onCharge, onChanged }: { f: FileData; onCharge?: () => void; onChanged(): void }) {
  const { s, money, date, can } = useS();
  const [voiding, setVoiding] = useState<string | null>(null), [reason, setReason] = useState('');
  const items = [
    ...f.charges.map((c) => ({ k: 'c' as const, id: c.id, at: c.dueOn, label: c.label, kind: c.kind, amount: c.amount, void: false, number: 0, method: '' })),
    ...f.payments.map((p) => ({ k: 'p' as const, id: p.id, at: p.at.slice(0, 10), label: fill(s.file.receipt, { n: p.number }), kind: '', amount: -p.amount, void: p.void, number: p.number, method: p.method })),
  ].sort((a, b) => a.at.localeCompare(b.at) || (a.k === 'c' ? -1 : 1));
  let run = 0;
  const rows = items.map((x) => { if (!x.void) run += x.amount; return { ...x, run }; });
  const doVoid = async (id: string) => {
    try { await api(`/v1/sch/payments/${id}/void`, { body: { reason } }); toast.success(s.file.voidedOk); setVoiding(null); setReason(''); onChanged(); }
    catch (e) { toast.error(e instanceof ApiError ? e.code : String(e)); }
  };
  const today = todayIso();
  return (
    <section className="sc-card overflow-hidden">
      <div className="sc-card-h"><h2>{s.file.ledger}</h2>{onCharge && <button className="sc-btn sc-btn-soft sc-btn-sm" onClick={onCharge}><SIcon n="plus" />{s.file.addCharge}</button>}</div>
      {rows.length ? (
        <div className="sc-list">
          {rows.map((x) => (
            <div key={x.id} className={`sc-row${x.void ? ' opacity-55' : ''}`}>
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${x.k === 'p' ? 'bg-[var(--s-present-soft)] text-[var(--s-present)]' : x.kind === 'discount' ? 'bg-[var(--s-excused-soft)] text-[var(--s-excused)]' : 'bg-[var(--s-sunken)] text-[var(--s-ink-2)]'}`}>
                <SIcon n={x.k === 'p' ? 'receipt' : x.kind === 'transport' ? 'bus' : 'calendar'} className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1"><b className={`block truncate${x.void ? ' line-through' : ''}`}>{x.label}</b>
                <span className="sc-sub">{date(x.at)}{x.k === 'p' ? ` · ${s.methods[x.method] ?? x.method}` : x.at > today ? '' : ''}{x.void ? ` · ${s.file.voided}` : ''}</span></span>
              <span className="text-end"><b className={`sc-num block ${x.k === 'p' ? 'text-[var(--s-present)]' : ''}`}>{x.k === 'p' ? '−' : ''}{money(Math.abs(x.amount))}</b><span className="sc-sub sc-num">{money(x.run)}</span></span>
              {x.k === 'p' && !x.void && can('fees.manage') && <button className="sc-btn sc-btn-ghost sc-btn-sm sc-btn-icon" onClick={() => setVoiding(voiding === x.id ? null : x.id)} aria-label={s.file.void}><SIcon n="more" /></button>}
              <AnimatePresence>{voiding === x.id && (
                <motion.div className="flex w-full gap-2 pt-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <input className="sc-input h-[38px] flex-1 text-[14px]" placeholder={s.file.voidAsk} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="sc-btn sc-btn-sm bg-[var(--s-absent)] text-white" onClick={() => doVoid(x.id)}>{s.file.voidDo}</button>
                </motion.div>)}</AnimatePresence>
            </div>
          ))}
        </div>
      ) : <Empty icon="wallet" title={s.file.noCharges} />}
    </section>
  );
}

function AttendanceStrip({ days, counts }: { days: { day: string; status: string }[]; counts: Record<string, number> }) {
  const { s, num } = useS();
  if (!days.length) return <section className="sc-card"><Empty icon="roll" title={s.file.noAttendance} /></section>;
  const by = new Map(days.map((d) => [d.day, d.status]));
  // school weeks, Sunday to Thursday, oldest first
  const end = todayIso(); let start = addDays(end, -119);
  while (new Date(`${start}T12:00:00Z`).getUTCDay() !== 0) start = addDays(start, -1);
  const cells: { day: string; s?: string }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); if (w <= 4) cells.push({ day: d, s: by.get(d) }); }
  return (
    <section className="sc-card grid gap-4 p-5">
      <div className="sc-stats">
        {(['absent', 'late', 'present'] as const).map((k) => <div key={k} className="grid gap-1"><span className="sc-sub">{k === 'absent' ? s.file.absentDays : k === 'late' ? s.file.lateDays : s.file.presentDays}</span>
          <b className={`sc-num text-[24px] font-semibold ${k === 'absent' && counts.absent ? 'text-[var(--s-absent)]' : ''}`}>{num(counts[k] ?? 0)}</b></div>)}
      </div>
      <div><p className="sc-sub mb-2">{s.file.last120}</p><div className="sc-cal" aria-hidden>{cells.map((c) => <i key={c.day} data-s={c.s} title={`${c.day} ${c.s ? s.marks[c.s] : ''}`} />)}</div>
        <div className="mt-3 flex flex-wrap gap-2">{(['present', 'absent', 'late', 'excused'] as const).map((k) => <span key={k} className={`sc-pill ${k === 'present' ? 'ok' : k === 'absent' ? 'bad' : k === 'late' ? 'warn' : 'info'}`}>{s.marks[k]}</span>)}</div></div>
    </section>
  );
}

/** Take a payment: the amount (one tap for what is late, the next instalment, or everything), how, then the receipt. */
export function PaySheet({ open, onClose, studentId, studentName, klass, money: m, guardianPhone, guardianToken, school, onPaid }: {
  open: boolean; onClose(): void; studentId: string; studentName: string; klass: string; money: { balance: number; overdue: number }; guardianPhone: string | null; guardianToken: string | null; school: string; onPaid(): void;
}) {
  const { s, lang, money, me, num, dateTime } = useS();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(''), [method, setMethod] = useState('cash'), [payer, setPayer] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState<any>(null);
  const close = () => { onClose(); setTimeout(() => { setDone(null); setAmount(''); setPayer(''); setMethod('cash'); }, 300); };
  const n = Number(amount.replace(/[^\d]/g, '')) || 0;
  const take = async () => {
    setBusy(true);
    try {
      const r = await api<any>(`/v1/sch/students/${studentId}/payments`, { body: { amount: n, method, payer: payer || null } });
      setDone(r); onPaid();
      qc.invalidateQueries({ queryKey: ['sch-today'] }); qc.invalidateQueries({ queryKey: ['sch-fees'] }); qc.invalidateQueries({ queryKey: ['sch-students'] });
      toast.success(fill(s.pay.done, { v: money(n), n: r.payment.number }));
    } catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
    finally { setBusy(false); }
  };
  const print = () => { document.documentElement.classList.add('sc-printing'); window.print(); setTimeout(() => document.documentElement.classList.remove('sc-printing'), 500); };
  const quick = [m.overdue > 0 && { k: s.pay.overdue, v: m.overdue }, m.balance > 0 && m.balance !== m.overdue && { k: s.pay.all, v: m.balance }].filter(Boolean) as { k: string; v: number }[];
  return (
    <Sheet open={open} onClose={close} title={done ? s.pay.receiptTitle : s.pay.title} sub={done ? undefined : fill(s.pay.for, { student: studentName })} rtl={rtl(lang)}
      footer={done ? <>
        <div className="grid grid-cols-2 gap-2"><button className="sc-btn sc-btn-line" onClick={print}><SIcon n="print" />{s.pay.print}</button>
          <a className="sc-btn sc-btn-wa" target="_blank" rel="noopener" href={waLink(guardianPhone, fill(s.pay.receiptMsg, { amount: money(done.payment.amount), student: studentName, n: done.payment.number, balance: money(done.balance), school }) + (guardianToken ? `\n${familyLink(guardianToken)}` : ''))}><SIcon n="wa" />{s.pay.whatsapp}</a></div>
        <button className="sc-btn sc-btn-ink sc-btn-block" onClick={close}>{s.pay.close}</button></>
        : <button className="sc-btn sc-btn-primary sc-btn-block" onClick={take} disabled={busy || n <= 0}>{fill(s.pay.take, { v: money(n) })}</button>}>
      {done ? (
        <motion.div className="sc-receipt sc-print-root" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
          <div className="flex items-center justify-between"><b className="text-[16px]">{school}</b><span className="sc-pill ok sc-num">{s.pay.receiptNo} {num(done.payment.number)}</span></div>
          <dl><dt>{s.pay.student}</dt><dd>{studentName}</dd><dt>{s.pay.klass}</dt><dd>{klass}</dd><dt>{s.pay.received}</dt><dd className="sc-num">{money(done.payment.amount)}</dd>
            <dt>{s.pay.method}</dt><dd>{s.methods[done.payment.method]}</dd><dt>{s.pay.after}</dt><dd className="sc-num">{money(done.balance)}</dd><dt>{s.pay.by}</dt><dd>{me.user.name}</dd></dl>
          <p className="sc-sub text-center">{dateTime(done.payment.at)}</p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <label className="sc-field"><span>{s.pay.amount}</span><input id="pay-amount" className="sc-input sc-input-big sc-num" inputMode="numeric" dir="ltr" value={amount ? Number(amount.replace(/[^\d]/g, '')).toLocaleString('en-US') : ''} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus /></label>
          {quick.length > 0 && <div className="flex flex-wrap gap-2">{quick.map((x) => <button key={x.k} className="sc-chip" data-on={n === x.v} onClick={() => setAmount(String(x.v))}>{x.k} · {money(x.v)}</button>)}</div>}
          <div className="sc-field"><span>{s.pay.method}</span><Segmented label={s.pay.method} value={method} onChange={setMethod} options={['cash', 'fib', 'zaincash', 'transfer'].map((v) => ({ value: v, label: s.methods[v] }))} /></div>
          <label className="sc-field"><span>{s.pay.payer}</span><input id="pay-payer" className="sc-input" value={payer} onChange={(e) => setPayer(e.target.value)} /></label>
        </div>
      )}
    </Sheet>
  );
}

function ChargeSheet({ open, onClose, studentId, onDone }: { open: boolean; onClose(): void; studentId: string; onDone(): void }) {
  const { s, lang } = useS();
  const [kind, setKind] = useState('books'), [label, setLabel] = useState(''), [amount, setAmount] = useState(''), [due, setDue] = useState(todayIso()), [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api(`/v1/sch/students/${studentId}/charges`, { body: { kind, label: label || s.chargeKinds[kind], amount: Number(amount.replace(/[^\d]/g, '')), dueOn: due } }); onDone(); onClose(); setLabel(''); setAmount(''); }
    catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.pay.charge.title} rtl={rtl(lang)} footer={<button className="sc-btn sc-btn-primary sc-btn-block" onClick={save} disabled={busy || !amount}>{s.pay.charge.save}</button>}>
      <div className="sc-field"><span>{s.pay.charge.kind}</span><Select id="ch-kind" value={kind} onChange={setKind} options={['registration', 'transport', 'books', 'uniform', 'activity', 'discount', 'other'].map((v) => ({ value: v, label: s.chargeKinds[v] }))} /></div>
      {kind === 'discount' && <p className="sc-sub">{s.pay.charge.discountHint}</p>}
      <label className="sc-field"><span>{s.pay.charge.label}</span><input id="ch-label" className="sc-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={s.chargeKinds[kind]} /></label>
      <label className="sc-field"><span>{s.pay.charge.amount}</span><input id="ch-amount" className="sc-input sc-num" inputMode="numeric" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="sc-field"><span>{s.pay.charge.due}</span><input id="ch-due" className="sc-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
    </Sheet>
  );
}

function MoveSheet({ open, onClose, studentId, current, onDone }: { open: boolean; onClose(): void; studentId: string; current: string; onDone(): void }) {
  const { s, lang } = useS();
  const setup = useSetup();
  const [to, setTo] = useState(current);
  const save = async () => {
    try { await api(`/v1/sch/students/${studentId}/move`, { body: { classId: to } }); toast.success(fill(s.file.moved, { klass: classOptions(setup.data).find((x) => x.value === to)?.label ?? '' })); onDone(); onClose(); }
    catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.file.move} rtl={rtl(lang)} footer={<button className="sc-btn sc-btn-primary sc-btn-block" onClick={save} disabled={!to || to === current}>{s.file.move}</button>}>
      <Select id="mv-class" value={to} onChange={setTo} options={classOptions(setup.data)} label={s.students.klass} />
    </Sheet>
  );
}
