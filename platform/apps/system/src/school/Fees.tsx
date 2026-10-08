// The accountant's screen: what came in (today, this month, this year against what is due), who is late (most first,
// a reminder on WhatsApp, a payment in two taps), what falls due in the next two weeks, every receipt, and the year's
// fee plans (instalments by date; a new plan is applied to the students at once).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, CircleCheck, MessageCircle, Plus, Receipt, Wallet } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useS } from './i18n';
import { Avatar, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction, CountUp, Empty, Field, Input, Page, Progress, Row, Sheet, SimpleSelect, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, useStagger } from './ui';
import { fill, useSetup, waLink } from './data';
import { PaySheet } from './StudentFile';

type Overview = {
  totals: { expected: number; due: number; collected: number; month: number; today: number; todayCount: number; late: number; lateCount: number };
  late: { id: string; name: string; number: number; overdue: number; balance: number; className: string; gradeName: string; guardianName: string | null; guardianPhone: string | null; lastPaid: string | null }[];
  upcoming: { id: string; name: string; dueOn: string; amount: number; className: string; guardianPhone: string | null }[];
};

export function Fees() {
  const { s, money, num, date, can, sys, lang } = useS();
  const [tab, setTab] = useState('late'), [pay, setPay] = useState<Overview['late'][number] | null>(null), [planning, setPlanning] = useState(false);
  const q = useQuery<Overview>({ queryKey: ['sch-fees'], queryFn: () => api('/v1/sch/fees/overview') });
  const receipts = useQuery<{ payments: any[] }>({ queryKey: ['sch-receipts'], queryFn: () => api('/v1/sch/payments?days=60'), enabled: tab === 'receipts' });
  const setup = useSetup();
  const stagger = useStagger();
  if (q.isLoading || !q.data) return <div className="grid gap-4"><div className="sc-stats"><Skeleton className="h-30" /><Skeleton className="h-30" /><Skeleton className="h-30" /></div><Skeleton className="h-75" /></div>;
  const T = q.data.totals;
  const feeText = (setup.data?.school.feeText as any)?.[lang] || s.fees.remindMsg;
  return (
    <Page>
      <div className="sc-stats">
        <Card className="sc-stat"><span className="l">{s.fees.collectedToday}</span><span className="v"><CountUp value={T.today} format={money} /></span><span className="text-muted-foreground text-[13px] tabular-nums">{num(T.todayCount)} {s.fees.receipts}</span></Card>
        <Card className="sc-stat"><span className="l">{s.fees.collectedMonth}</span><span className="v"><CountUp value={T.month} format={money} /></span><span className="text-muted-foreground text-[13px]">{fill(s.fees.expected, { v: money(T.expected) })}</span></Card>
        <Card className="sc-stat"><span className="l">{s.fees.collectedYear}</span><span className="v"><CountUp value={T.collected} format={money} /></span>
          <Progress value={T.due ? Math.min(100, (T.collected / T.due) * 100) : 100} /><span className="text-muted-foreground text-[13px]">{fill(s.fees.ofDue, { p: num(T.due ? Math.min(100, Math.round((T.collected / T.due) * 100)) : 100) })}</span></Card>
        <Card className={`sc-stat${T.late ? ' bad' : ''}`}><span className="l">{s.fees.late}</span><span className="v"><CountUp value={T.late} format={money} /></span><span className="text-muted-foreground text-[13px]">{fill(s.today.lateStudents, { n: num(T.lateCount) })}</span></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="late">{s.fees.late} <span className="text-muted-foreground tabular-nums">{num(q.data.late.length)}</span></TabsTrigger>
          <TabsTrigger value="soon">{s.fees.soon}</TabsTrigger><TabsTrigger value="receipts">{s.fees.receipts}</TabsTrigger><TabsTrigger value="plans">{s.fees.plans}</TabsTrigger>
        </TabsList>
        <TabsContent value="late">
          <Card className="overflow-hidden">
            {q.data.late.length ? <div>{q.data.late.map((x, i) => (
              <Row key={x.id} className="flex-wrap sm:flex-nowrap" {...stagger(i)}>
                <a href={`#/student?id=${x.id}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={x.name} />
                  <span className="min-w-0"><b className="block truncate font-medium">{x.name}</b><span className="text-muted-foreground text-[13px]">{x.gradeName} · {x.className} · {x.lastPaid ? fill(s.fees.lastPaid, { date: date(x.lastPaid) }) : s.fees.never}</span></span></a>
                <b className="text-destructive tabular-nums">{money(x.overdue)}</b>
                <span className="flex gap-2">
                  {x.guardianPhone && <Button asChild variant="outline" size="sm"><a target="_blank" rel="noopener" href={waLink(x.guardianPhone, fill(feeText, { student: x.name, amount: money(x.overdue), school: sys.business.name, link: '' }))}><MessageCircle />{s.fees.remind}</a></Button>}
                  {can('fees.collect') && <Button size="sm" onClick={() => setPay(x)}>{s.fees.collect}</Button>}
                </span>
              </Row>))}</div> : <Empty icon={CircleCheck} title={s.fees.noLate} />}
          </Card>
        </TabsContent>
        <TabsContent value="soon">
          <Card className="overflow-hidden">
            {q.data.upcoming.length ? <div>{q.data.upcoming.map((x) => (
              <Row key={x.id} href={`#/student?id=${x.id}`}><Avatar name={x.name} />
                <span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.name}</b><span className="text-muted-foreground text-[13px]">{x.className} · {fill(s.fees.due, { date: date(x.dueOn) })}</span></span>
                <b className="tabular-nums">{money(x.amount)}</b></Row>))}</div> : <Empty icon={CalendarDays} title={s.fees.noSoon} />}
          </Card>
        </TabsContent>
        <TabsContent value="receipts">
          <Card className="overflow-hidden">
            {receipts.isLoading ? <div className="grid gap-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : receipts.data?.payments.length ? <div>{receipts.data.payments.map((p) => (
              <Row key={p.id} href={`#/student?id=${p.studentId}`} className={p.void ? 'opacity-55' : ''}>
                <span className="bg-success-soft text-success grid size-9 shrink-0 place-items-center rounded-xl"><Receipt className="size-[18px]" /></span>
                <span className="min-w-0 flex-1"><b className="block truncate font-medium">{p.studentName}</b><span className="text-muted-foreground text-[13px]">{fill(s.file.receipt, { n: p.number })} · {s.methods[p.method]} · {date(p.at)}{p.void ? ` · ${s.fees.voidedTag}` : ''}</span></span>
                <b className={`tabular-nums ${p.void ? 'line-through' : ''}`}>{money(p.amount)}</b></Row>))}</div> : <Empty icon={Receipt} title={s.fees.noReceipts} />}
          </Card>
        </TabsContent>
        <TabsContent value="plans" className="grid gap-3">
          {can('fees.manage') && <Button variant="secondary" className="justify-self-start" onClick={() => setPlanning(true)}><Plus />{s.fees.newPlan}</Button>}
          {setup.data?.plans.length ? setup.data.plans.map((p) => (
            <Card key={p.id}>
              <CardHeader><CardTitle>{p.name}</CardTitle><CardDescription>{p.gradeId ? setup.data!.grades.find((g) => g.id === p.gradeId)?.name : s.fees.allGrades} · {fill(s.fees.total2, { v: money(p.total) })}</CardDescription>
                <CardAction><Badge variant={p.active ? 'success' : 'secondary'}>{p.active ? s.fees.active : s.fees.retired}</Badge></CardAction></CardHeader>
              <CardContent><ol className="grid gap-2">{p.installments.map((x) => <li key={x.label} className="bg-secondary flex items-center justify-between rounded-xl px-3 py-2 text-[14px]"><span>{x.label} · <span className="text-muted-foreground">{date(x.dueOn)}</span></span><b className="tabular-nums">{money(x.amount)}</b></li>)}</ol></CardContent>
            </Card>)) : <Card><Empty icon={Wallet} title={s.fees.plans} body={s.fees.noPlans} /></Card>}
        </TabsContent>
      </Tabs>

      {pay && <PaySheet open={!!pay} onClose={() => setPay(null)} studentId={pay.id} studentName={pay.name} klass={`${pay.gradeName} · ${pay.className}`} money={{ balance: pay.balance, overdue: pay.overdue }}
        guardianPhone={pay.guardianPhone} guardianToken={null} school={sys.business.name} onPaid={() => q.refetch()} />}
      <PlanSheet open={planning} onClose={() => setPlanning(false)} />
    </Page>
  );
}

function PlanSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const { s, lang, money, num } = useS();
  const setup = useSetup();
  const qc = useQueryClient();
  const y = Number(setup.data?.school.year?.startsOn.slice(0, 4) ?? new Date().getFullYear());
  const L = lang === 'en' ? ['First instalment', 'Second instalment', 'Third instalment'] : ['القسط الأول', 'القسط الثاني', 'القسط الثالث'];
  const [name, setName] = useState(''), [grade, setGrade] = useState('all'), [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([{ label: L[0], dueOn: `${y}-09-21`, amount: '' }, { label: L[1], dueOn: `${y + 1}-01-04`, amount: '' }, { label: L[2], dueOn: `${y + 1}-03-01`, amount: '' }]);
  const total = rows.reduce((t, r) => t + (Number(r.amount.replace(/[^\d]/g, '')) || 0), 0);
  const edit = (i: number, k: 'label' | 'dueOn' | 'amount', v: string) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ charged: number }>('/v1/sch/fees/plans', { body: { name, gradeId: grade === 'all' ? null : grade, installments: rows.map((x) => ({ ...x, amount: Number(x.amount.replace(/[^\d]/g, '')) })) } });
      toast.success(fill(s.fees.planSaved, { n: num(r.charged) }));
      qc.invalidateQueries({ queryKey: ['sch-setup'] }); qc.invalidateQueries({ queryKey: ['sch-fees'] }); qc.invalidateQueries({ queryKey: ['sch-students'] });
      onClose();
    } catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.fees.newPlan} description={s.fees.planHint}
      footer={<Button size="lg" onClick={save} disabled={busy || !name.trim() || total <= 0}>{s.fees.savePlan} · {money(total)}</Button>}>
      <Field label={s.fees.planName} htmlFor="pl-name"><Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === 'en' ? 'Yearly tuition' : 'القسط السنوي'} /></Field>
      <Field label={s.fees.grade} htmlFor="pl-grade"><SimpleSelect id="pl-grade" value={grade} onChange={setGrade} options={[{ value: 'all', label: s.fees.allGrades }, ...(setup.data?.grades ?? []).map((g) => ({ value: g.id, label: g.name }))]} /></Field>
      <div className="grid gap-2">
        <span className="text-foreground/80 text-[13px] font-medium">{s.fees.installments}</span>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_8.5rem] gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[1fr_9rem_8rem]">
            <Input className="col-span-2 h-10 text-[14px] sm:col-span-1" value={r.label} onChange={(e) => edit(i, 'label', e.target.value)} aria-label={s.fees.label} />
            <Input className="h-10 text-[14px]" type="date" value={r.dueOn} onChange={(e) => edit(i, 'dueOn', e.target.value)} aria-label={s.fees.dueOn} />
            <Input className="h-10 text-[14px] tabular-nums" inputMode="numeric" dir="ltr" placeholder="0" value={r.amount} onChange={(e) => edit(i, 'amount', e.target.value)} aria-label={s.fees.amount} />
          </div>
        ))}
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setRows([...rows, { label: `${s.fees.installments} ${rows.length + 1}`, dueOn: rows[rows.length - 1]?.dueOn ?? `${y}-09-21`, amount: '' }])}><Plus />{s.fees.addInstallment}</Button>
      </div>
    </Sheet>
  );
}
