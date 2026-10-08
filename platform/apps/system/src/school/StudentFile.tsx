// A student's file: who they are, their parents (WhatsApp, and the parent's private link), brothers and sisters here,
// the account (every charge and receipt by date, with the running balance), and four months of attendance at a glance.
// Taking a payment is one sheet that ends on a receipt: print it, or send it on WhatsApp.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowRightLeft, Bus, CalendarDays, ClipboardCheck, Ellipsis, HeartPulse, Link2, MessageCircle, Phone, Plus, Printer, Receipt, Wallet } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { go } from '../lib/app';
import { useS } from './i18n';
import { Avatar, Badge, Button, Card, CardAction, CardContent, CardHeader, CardTitle, Empty, Field, Input, Page, Progress, Row, Sheet, SimpleSelect, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem } from './ui';
import { addDays, classOptions, familyLink, fill, localPhone, todayIso, useHashQuery, useSetup, waLink } from './data';

type FileData = {
  student: any; enrollment: { classId: string; className: string; gradeId: string; gradeName: string; enrolledOn: string } | null;
  guardians: { id: string; name: string; relation: string; phone: string | null; token: string; primary: boolean }[]; siblings: { id: string; name: string; number: number }[];
  charges: { id: string; kind: string; label: string; amount: number; dueOn: string }[]; payments: { id: string; number: number; amount: number; method: string; payer: string | null; note: string | null; void: boolean; at: string }[];
  money: { charged: number; paid: number; balance: number; overdue: number; nextDue: string | null };
  attendance: { days: { day: string; status: string; note: string | null }[]; counts: Record<string, number> };
};

export function StudentFile() {
  const { s, can, money, date, sys } = useS();
  const id = useHashQuery().get('id') ?? '';
  const [tab, setTab] = useState('overview'), [paying, setPaying] = useState(false), [charging, setCharging] = useState(false), [moving, setMoving] = useState(false);
  const q = useQuery<FileData>({ queryKey: ['sch-student', id], queryFn: () => api(`/v1/sch/students/${id}`), enabled: !!id });
  if (!id) { go('#/students'); return null; }
  if (q.isLoading || !q.data) return <div className="grid gap-4"><Skeleton className="h-35" /><Skeleton className="h-80" /></div>;
  const f = q.data, st = f.student, m = f.money, g0 = f.guardians[0];
  const klass = f.enrollment ? `${f.enrollment.gradeName} · ${f.enrollment.className}` : s.students.noClass;
  return (
    <Page>
      <Card className="flex-row flex-wrap items-center gap-4 p-5">
        <Avatar name={st.name} className="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-semibold tracking-tight">{st.name}</h2>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[13.5px]"><span className="tabular-nums">#{st.number}</span><span>·</span><span>{klass}</span>
            {st.status !== 'active' && <Badge variant="secondary">{s.file.status[st.status]}</Badge>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('fees.collect') && <Button onClick={() => setPaying(true)}><Wallet />{s.shell.collect}</Button>}
          {g0?.phone && <Button asChild variant="whatsapp"><a target="_blank" rel="noopener" href={waLink(g0.phone, '')}><MessageCircle />{s.relations[g0.relation]}</a></Button>}
        </div>
      </Card>

      {can('fees.read') && (
        <div className="sc-stats">
          <Card className="sc-stat"><span className="l">{s.file.balance}</span><span className="v">{money(m.balance)}</span><Progress value={m.charged ? (m.paid / m.charged) * 100 : 100} /><span className="text-muted-foreground text-[13px]">{s.file.paidT} {money(m.paid)} / {money(m.charged)}</span></Card>
          <Card className={`sc-stat${m.overdue ? ' bad' : ''}`}><span className="l">{s.file.overdue}</span><span className="v">{money(m.overdue)}</span><span className="text-muted-foreground text-[13px]">{m.nextDue ? fill(s.file.nextDue, { date: date(m.nextDue) }) : '—'}</span></Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="overview">{s.file.overview}</TabsTrigger>{can('fees.read') && <TabsTrigger value="fees">{s.file.fees}</TabsTrigger>}<TabsTrigger value="attendance">{s.file.attendance}</TabsTrigger></TabsList>
        <TabsContent value="overview" className="grid gap-4">
          {st.health && <div className="bg-warning-soft flex gap-3 rounded-2xl px-4 py-3 text-[14px]"><HeartPulse className="text-warning mt-0.5 size-[18px] shrink-0" /><span><b>{s.file.health}: </b>{st.health}</span></div>}
          <Card>
            <CardHeader><CardTitle>{s.file.guardians}</CardTitle></CardHeader>
            <div className="pb-1">{f.guardians.map((g) => <Guardian key={g.id} g={g} student={st.name} />)}</div>
          </Card>
          {f.siblings.length > 0 && <Card><CardHeader><CardTitle>{s.file.siblings}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
            {f.siblings.map((x) => <Button key={x.id} asChild variant="outline" className="rounded-full ps-1.5"><a href={`#/student?id=${x.id}`}><Avatar name={x.name} className="size-7 rounded-full text-[12px]" />{x.name}</a></Button>)}</CardContent></Card>}
          <Card>
            <CardHeader><CardTitle>{s.file.details}</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14.5px]">
                {st.birthDate && <><dt className="text-muted-foreground">{s.file.born}</dt><dd><bdi>{date(st.birthDate)}</bdi></dd></>}
                {st.gender && <><dt className="text-muted-foreground">{s.students.gender}</dt><dd>{s.gender[st.gender]}</dd></>}
                {f.enrollment?.enrolledOn && <><dt className="text-muted-foreground">{s.file.joined}</dt><dd><bdi>{date(f.enrollment.enrolledOn)}</bdi></dd></>}
              </dl>
              {can('students.update') && <Button variant="outline" size="sm" className="mt-4" onClick={() => setMoving(true)}><ArrowRightLeft />{s.file.move}</Button>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fees"><Ledger f={f} onCharge={can('fees.manage') ? () => setCharging(true) : undefined} onChanged={() => q.refetch()} /></TabsContent>
        <TabsContent value="attendance"><AttendanceStrip days={f.attendance.days} counts={f.attendance.counts} /></TabsContent>
      </Tabs>

      <PaySheet open={paying} onClose={() => setPaying(false)} studentId={id} studentName={st.name} klass={klass} money={m} guardianPhone={g0?.phone ?? null} guardianToken={g0?.token ?? null} school={sys.business.name} onPaid={() => q.refetch()} />
      <ChargeSheet open={charging} onClose={() => setCharging(false)} studentId={id} onDone={() => q.refetch()} />
      <MoveSheet open={moving} onClose={() => setMoving(false)} studentId={id} current={f.enrollment?.classId ?? ''} onDone={() => q.refetch()} />
    </Page>
  );
}

function Guardian({ g, student }: { g: FileData['guardians'][number]; student: string }) {
  const { s, sys } = useS();
  const link = familyLink(g.token);
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success(s.file.copied); } catch { toast(link); } };
  return (
    <Row className="flex-wrap">
      <Avatar name={g.name} />
      <span className="min-w-0 flex-1"><b className="block truncate font-medium">{g.name}</b><span className="text-muted-foreground text-[13px]">{s.relations[g.relation]}{g.phone ? ' · ' : ''}<span dir="ltr">{localPhone(g.phone)}</span></span></span>
      <span className="flex gap-2">
        {g.phone && <Button asChild variant="outline" size="icon-sm"><a href={`tel:${g.phone}`} aria-label="call"><Phone /></a></Button>}
        <Button variant="outline" size="sm" onClick={copy} title={s.file.familyLinkHint}><Link2 />{s.file.familyLink}</Button>
        {g.phone && <Button asChild variant="whatsapp" size="sm"><a target="_blank" rel="noopener" href={waLink(g.phone, fill(s.file.linkMsg, { name: g.name, student, school: sys.business.name, link }))}><MessageCircle />{s.file.send}</a></Button>}
      </span>
    </Row>
  );
}

/** The account: charges and receipts together by date, with a running balance. */
function Ledger({ f, onCharge, onChanged }: { f: FileData; onCharge?: () => void; onChanged(): void }) {
  const { s, money, date, can } = useS();
  const [voiding, setVoiding] = useState<string | null>(null), [reason, setReason] = useState('');
  const items = [
    ...f.charges.map((c) => ({ k: 'c' as const, id: c.id, at: c.dueOn, label: c.label, kind: c.kind, amount: c.amount, void: false, method: '' })),
    ...f.payments.map((p) => ({ k: 'p' as const, id: p.id, at: p.at.slice(0, 10), label: fill(s.file.receipt, { n: p.number }), kind: '', amount: -p.amount, void: p.void, method: p.method })),
  ].sort((a, b) => a.at.localeCompare(b.at) || (a.k === 'c' ? -1 : 1));
  let run = 0;
  const rows = items.map((x) => { if (!x.void) run += x.amount; return { ...x, run }; });
  const doVoid = async (id: string) => {
    try { await api(`/v1/sch/payments/${id}/void`, { body: { reason } }); toast.success(s.file.voidedOk); setVoiding(null); setReason(''); onChanged(); }
    catch (e) { toast.error(e instanceof ApiError ? e.code : String(e)); }
  };
  return (
    <Card className="overflow-hidden">
      <CardHeader><CardTitle>{s.file.ledger}</CardTitle>{onCharge && <CardAction><Button variant="secondary" size="sm" onClick={onCharge}><Plus />{s.file.addCharge}</Button></CardAction>}</CardHeader>
      {rows.length ? (
        <div>
          {rows.map((x) => {
            const Icon = x.k === 'p' ? Receipt : x.kind === 'transport' ? Bus : CalendarDays;
            return (
              <Row key={x.id} className={`flex-wrap ${x.void ? 'opacity-55' : ''}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${x.k === 'p' ? 'bg-success-soft text-success' : x.kind === 'discount' ? 'bg-info-soft text-info' : 'bg-secondary text-foreground/70'}`}><Icon className="size-[18px]" /></span>
                <span className="min-w-0 flex-1"><b className={`block truncate font-medium ${x.void ? 'line-through' : ''}`}>{x.label}</b>
                  <span className="text-muted-foreground text-[13px]">{date(x.at)}{x.k === 'p' ? ` · ${s.methods[x.method] ?? x.method}` : ''}{x.void ? ` · ${s.file.voided}` : ''}</span></span>
                <span className="text-end"><b className={`block tabular-nums ${x.k === 'p' ? 'text-success' : ''}`}>{x.k === 'p' ? '−' : ''}{money(Math.abs(x.amount))}</b><span className="text-muted-foreground text-[13px] tabular-nums">{money(x.run)}</span></span>
                {x.k === 'p' && !x.void && can('fees.manage') && <Button variant="ghost" size="icon-sm" onClick={() => setVoiding(voiding === x.id ? null : x.id)} aria-label={s.file.void}><Ellipsis /></Button>}
                <AnimatePresence>{voiding === x.id && (
                  <motion.div className="flex w-full gap-2 pt-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <Input className="h-9 flex-1 text-[14px]" placeholder={s.file.voidAsk} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button variant="destructive" size="sm" onClick={() => doVoid(x.id)}>{s.file.voidDo}</Button>
                  </motion.div>)}</AnimatePresence>
              </Row>
            );
          })}
        </div>
      ) : <Empty icon={Wallet} title={s.file.noCharges} />}
    </Card>
  );
}

function AttendanceStrip({ days, counts }: { days: { day: string; status: string }[]; counts: Record<string, number> }) {
  const { s, num } = useS();
  if (!days.length) return <Card><Empty icon={ClipboardCheck} title={s.file.noAttendance} /></Card>;
  const by = new Map(days.map((d) => [d.day, d.status]));
  // school weeks, Sunday to Thursday, oldest first
  const end = todayIso(); let start = addDays(end, -119);
  while (new Date(`${start}T12:00:00Z`).getUTCDay() !== 0) start = addDays(start, -1);
  const cells: { day: string; s?: string }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); if (w <= 4) cells.push({ day: d, s: by.get(d) }); }
  return (
    <Card className="grid gap-4 p-5">
      <div className="sc-stats">
        {(['absent', 'late', 'present'] as const).map((k) => <div key={k} className="grid gap-1"><span className="text-muted-foreground text-[13px]">{k === 'absent' ? s.file.absentDays : k === 'late' ? s.file.lateDays : s.file.presentDays}</span>
          <b className={`text-[24px] font-semibold tabular-nums ${k === 'absent' && counts.absent ? 'text-destructive' : ''}`}>{num(counts[k] ?? 0)}</b></div>)}
      </div>
      <div><p className="text-muted-foreground mb-2 text-[13px]">{s.file.last120}</p><div className="sc-cal" aria-hidden>{cells.map((c) => <i key={c.day} data-s={c.s} title={`${c.day} ${c.s ? s.marks[c.s] : ''}`} />)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><Badge variant="success">{s.marks.present}</Badge><Badge variant="destructive">{s.marks.absent}</Badge><Badge variant="warning">{s.marks.late}</Badge><Badge variant="info">{s.marks.excused}</Badge></div></div>
    </Card>
  );
}

/** Take a payment: the amount (one tap for what is late, or everything), how, then the receipt. */
export function PaySheet({ open, onClose, studentId, studentName, klass, money: m, guardianPhone, guardianToken, school, onPaid }: {
  open: boolean; onClose(): void; studentId: string; studentName: string; klass: string; money: { balance: number; overdue: number }; guardianPhone: string | null; guardianToken: string | null; school: string; onPaid(): void;
}) {
  const { s, money, me, num, dateTime } = useS();
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
    <Sheet open={open} onClose={close} title={done ? s.pay.receiptTitle : s.pay.title} description={done ? undefined : fill(s.pay.for, { student: studentName })}
      footer={done ? <>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={print}><Printer />{s.pay.print}</Button>
          <Button asChild variant="whatsapp"><a target="_blank" rel="noopener" href={waLink(guardianPhone, fill(s.pay.receiptMsg, { amount: money(done.payment.amount), student: studentName, n: done.payment.number, balance: money(done.balance), school }) + (guardianToken ? `\n${familyLink(guardianToken)}` : ''))}><MessageCircle />{s.pay.whatsapp}</a></Button></div>
        <Button variant="ink" size="lg" onClick={close}>{s.pay.close}</Button></>
        : <Button size="lg" onClick={take} disabled={busy || n <= 0}>{fill(s.pay.take, { v: money(n) })}</Button>}>
      {done ? (
        <motion.div className="sc-receipt sc-print-root" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
          <div className="flex items-center justify-between"><b className="text-[16px]">{school}</b><Badge variant="success" className="tabular-nums">{s.pay.receiptNo} {num(done.payment.number)}</Badge></div>
          <dl><dt>{s.pay.student}</dt><dd>{studentName}</dd><dt>{s.pay.klass}</dt><dd>{klass}</dd><dt>{s.pay.received}</dt><dd className="tabular-nums">{money(done.payment.amount)}</dd>
            <dt>{s.pay.method}</dt><dd>{s.methods[done.payment.method]}</dd><dt>{s.pay.after}</dt><dd className="tabular-nums">{money(done.balance)}</dd><dt>{s.pay.by}</dt><dd>{me.user.name}</dd></dl>
          <p className="text-muted-foreground text-center text-[13px]">{dateTime(done.payment.at)}</p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <Field label={s.pay.amount} htmlFor="pay-amount"><Input id="pay-amount" className="h-15 text-center text-[26px] font-semibold tabular-nums" inputMode="numeric" dir="ltr" value={amount ? Number(amount.replace(/[^\d]/g, '')).toLocaleString('en-US') : ''} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus /></Field>
          {quick.length > 0 && <div className="flex flex-wrap gap-2">{quick.map((x) => <Button key={x.k} variant={n === x.v ? 'ink' : 'outline'} size="sm" className="rounded-full" onClick={() => setAmount(String(x.v))}>{x.k} · {money(x.v)}</Button>)}</div>}
          <Field label={s.pay.method}><ToggleGroup value={method} onValueChange={setMethod} aria-label={s.pay.method} className="w-fit">{['cash', 'fib', 'zaincash', 'transfer'].map((v) => <ToggleGroupItem key={v} value={v}>{s.methods[v]}</ToggleGroupItem>)}</ToggleGroup></Field>
          <Field label={s.pay.payer} htmlFor="pay-payer"><Input id="pay-payer" value={payer} onChange={(e) => setPayer(e.target.value)} /></Field>
        </div>
      )}
    </Sheet>
  );
}

function ChargeSheet({ open, onClose, studentId, onDone }: { open: boolean; onClose(): void; studentId: string; onDone(): void }) {
  const { s } = useS();
  const [kind, setKind] = useState('books'), [label, setLabel] = useState(''), [amount, setAmount] = useState(''), [due, setDue] = useState(todayIso()), [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api(`/v1/sch/students/${studentId}/charges`, { body: { kind, label: label || s.chargeKinds[kind], amount: Number(amount.replace(/[^\d]/g, '')), dueOn: due } }); onDone(); onClose(); setLabel(''); setAmount(''); }
    catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.pay.charge.title} footer={<Button size="lg" onClick={save} disabled={busy || !amount}>{s.pay.charge.save}</Button>}>
      <Field label={s.pay.charge.kind} htmlFor="ch-kind" hint={kind === 'discount' ? s.pay.charge.discountHint : undefined}><SimpleSelect id="ch-kind" value={kind} onChange={setKind} options={['registration', 'transport', 'books', 'uniform', 'activity', 'discount', 'other'].map((v) => ({ value: v, label: s.chargeKinds[v] }))} /></Field>
      <Field label={s.pay.charge.label} htmlFor="ch-label"><Input id="ch-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={s.chargeKinds[kind]} /></Field>
      <Field label={s.pay.charge.amount} htmlFor="ch-amount"><Input id="ch-amount" className="tabular-nums" inputMode="numeric" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label={s.pay.charge.due} htmlFor="ch-due"><Input id="ch-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
    </Sheet>
  );
}

function MoveSheet({ open, onClose, studentId, current, onDone }: { open: boolean; onClose(): void; studentId: string; current: string; onDone(): void }) {
  const { s } = useS();
  const setup = useSetup();
  const [to, setTo] = useState(current);
  const save = async () => {
    try { await api(`/v1/sch/students/${studentId}/move`, { body: { classId: to } }); toast.success(fill(s.file.moved, { klass: classOptions(setup.data).find((x) => x.value === to)?.label ?? '' })); onDone(); onClose(); }
    catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.file.move} footer={<Button size="lg" onClick={save} disabled={!to || to === current}>{s.file.move}</Button>}>
      <SimpleSelect id="mv-class" value={to} onChange={setTo} options={classOptions(setup.data)} label={s.students.klass} />
    </Sheet>
  );
}
