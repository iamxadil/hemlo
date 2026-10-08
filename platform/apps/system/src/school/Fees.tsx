// The accountant's screen: what came in (today, this month, this year against what is due), who is late (most first,
// a reminder on WhatsApp with the parent's link, a payment in two taps), what falls due in the next two weeks, every
// receipt, and the year's fee plans (instalments by date; a new plan is applied to the students at once).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { rtl } from '../lib/i18n';
import { useS } from './i18n';
import { SIcon, Avatar, Page, Skel, Empty, Sheet, Select, Tabs, TabPanel, CountUp, Bar, useStagger } from './ui';
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
  if (q.isLoading || !q.data) return <div className="grid gap-4"><div className="sc-stats"><Skel h={120} /><Skel h={120} /><Skel h={120} /></div><Skel h={300} /></div>;
  const T = q.data.totals;
  const feeText = (setup.data?.school.feeText as any)?.[lang] || s.fees.remindMsg;
  return (
    <Page>
      <div className="sc-stats">
        <div className="sc-card sc-stat"><span className="l">{s.fees.collectedToday}</span><span className="v"><CountUp value={T.today} format={money} /></span><span className="sc-sub sc-num">{num(T.todayCount)} {s.fees.receipts}</span></div>
        <div className="sc-card sc-stat"><span className="l">{s.fees.collectedMonth}</span><span className="v"><CountUp value={T.month} format={money} /></span><span className="sc-sub">{fill(s.fees.expected, { v: money(T.expected) })}</span></div>
        <div className="sc-card sc-stat"><span className="l">{s.fees.collectedYear}</span><span className="v"><CountUp value={T.collected} format={money} /></span>
          <Bar value={T.due ? T.collected / T.due : 1} /><span className="sc-sub">{fill(s.fees.ofDue, { p: num(T.due ? Math.min(100, Math.round((T.collected / T.due) * 100)) : 100) })}</span></div>
        <div className={`sc-card sc-stat${T.late ? ' bad' : ''}`}><span className="l">{s.fees.late}</span><span className="v"><CountUp value={T.late} format={money} /></span><span className="sc-sub">{fill(s.today.lateStudents, { n: num(T.lateCount) })}</span></div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'late', label: <>{s.fees.late} <span className="sc-sub sc-num">{num(q.data.late.length)}</span></> }, { value: 'soon', label: s.fees.soon }, { value: 'receipts', label: s.fees.receipts }, { value: 'plans', label: s.fees.plans }]}>
        <TabPanel value="late" className="mt-4">
          <section className="sc-card overflow-hidden">
            {q.data.late.length ? <div className="sc-list">{q.data.late.map((x, i) => (
              <motion.div key={x.id} className="sc-row flex-wrap sm:flex-nowrap" {...stagger(i)}>
                <a href={`#/student?id=${x.id}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={x.name} />
                  <span className="min-w-0"><b className="block truncate">{x.name}</b><span className="sc-sub">{x.gradeName} · {x.className} · {x.lastPaid ? fill(s.fees.lastPaid, { date: date(x.lastPaid) }) : s.fees.never}</span></span></a>
                <b className="sc-num text-[var(--s-absent)]">{money(x.overdue)}</b>
                <span className="flex gap-2">
                  {x.guardianPhone && <a className="sc-btn sc-btn-line sc-btn-sm" target="_blank" rel="noopener" href={waLink(x.guardianPhone, fill(feeText, { student: x.name, amount: money(x.overdue), school: sys.business.name, link: '' }))}><SIcon n="wa" />{s.fees.remind}</a>}
                  {can('fees.collect') && <button className="sc-btn sc-btn-primary sc-btn-sm" onClick={() => setPay(x)}>{s.fees.collect}</button>}
                </span>
              </motion.div>))}</div> : <Empty icon="check" title={s.fees.noLate} />}
          </section>
        </TabPanel>
        <TabPanel value="soon" className="mt-4">
          <section className="sc-card overflow-hidden">
            {q.data.upcoming.length ? <div className="sc-list">{q.data.upcoming.map((x) => (
              <a key={x.id} href={`#/student?id=${x.id}`} className="sc-row"><Avatar name={x.name} />
                <span className="min-w-0 flex-1"><b className="block truncate">{x.name}</b><span className="sc-sub">{x.className} · {fill(s.fees.due, { date: date(x.dueOn) })}</span></span>
                <b className="sc-num">{money(x.amount)}</b></a>))}</div> : <Empty icon="calendar" title={s.fees.noSoon} />}
          </section>
        </TabPanel>
        <TabPanel value="receipts" className="mt-4">
          <section className="sc-card overflow-hidden">
            {receipts.isLoading ? <div className="grid gap-2 p-4"><Skel h={48} /><Skel h={48} /></div> : receipts.data?.payments.length ? <div className="sc-list">{receipts.data.payments.map((p) => (
              <a key={p.id} href={`#/student?id=${p.studentId}`} className={`sc-row${p.void ? ' opacity-55' : ''}`}>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--s-present-soft)] text-[var(--s-present)]"><SIcon n="receipt" className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1"><b className="block truncate">{p.studentName}</b><span className="sc-sub">{fill(s.file.receipt, { n: p.number })} · {s.methods[p.method]} · {date(p.at)}{p.void ? ` · ${s.fees.voidedTag}` : ''}</span></span>
                <b className={`sc-num${p.void ? ' line-through' : ''}`}>{money(p.amount)}</b></a>))}</div> : <Empty icon="receipt" title={s.fees.noReceipts} />}
          </section>
        </TabPanel>
        <TabPanel value="plans" className="mt-4 grid gap-3">
          {can('fees.manage') && <button className="sc-btn sc-btn-soft justify-self-start" onClick={() => setPlanning(true)}><SIcon n="plus" />{s.fees.newPlan}</button>}
          {setup.data?.plans.length ? setup.data.plans.map((p) => (
            <section key={p.id} className="sc-card p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="sc-h2">{p.name}</h3><p className="sc-sub">{p.gradeId ? setup.data!.grades.find((g) => g.id === p.gradeId)?.name : s.fees.allGrades} · {fill(s.fees.total2, { v: money(p.total) })}</p></div>
                <span className={`sc-pill ${p.active ? 'ok' : ''}`}>{p.active ? s.fees.active : s.fees.retired}</span></div>
              <ol className="mt-3 grid gap-2">{p.installments.map((x) => <li key={x.label} className="flex items-center justify-between rounded-xl bg-[var(--s-sunken)] px-3 py-2 text-[14px]"><span>{x.label} · <span className="sc-sub">{date(x.dueOn)}</span></span><b className="sc-num">{money(x.amount)}</b></li>)}</ol>
            </section>)) : <section className="sc-card"><Empty icon="wallet" title={s.fees.plans} body={s.fees.noPlans} /></section>}
        </TabPanel>
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
    <Sheet open={open} onClose={onClose} title={s.fees.newPlan} sub={s.fees.planHint} rtl={rtl(lang)}
      footer={<button className="sc-btn sc-btn-primary sc-btn-block" onClick={save} disabled={busy || !name.trim() || total <= 0}>{s.fees.savePlan} · {money(total)}</button>}>
      <label className="sc-field"><span>{s.fees.planName}</span><input id="pl-name" className="sc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === 'en' ? 'Yearly tuition' : 'القسط السنوي'} /></label>
      <div className="sc-field"><span>{s.fees.grade}</span><Select id="pl-grade" value={grade} onChange={setGrade} options={[{ value: 'all', label: s.fees.allGrades }, ...(setup.data?.grades ?? []).map((g) => ({ value: g.id, label: g.name }))]} /></div>
      <div className="grid gap-2">
        <span className="text-[13px] font-medium text-[var(--s-ink-2)]">{s.fees.installments}</span>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_8.5rem] gap-2 rounded-2xl border border-[var(--s-line)] p-3 sm:grid-cols-[1fr_9rem_8rem]">
            <input className="sc-input h-[40px] text-[14px] col-span-2 sm:col-span-1" value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label={s.fees.label} />
            <input className="sc-input h-[40px] text-[14px]" type="date" value={r.dueOn} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, dueOn: e.target.value } : x)))} aria-label={s.fees.dueOn} />
            <input className="sc-input h-[40px] text-[14px] sc-num" inputMode="numeric" dir="ltr" placeholder="0" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} aria-label={s.fees.amount} />
          </div>
        ))}
        <button className="sc-btn sc-btn-ghost sc-btn-sm justify-self-start" onClick={() => setRows([...rows, { label: `${s.fees.installments} ${rows.length + 1}`, dueOn: rows[rows.length - 1]?.dueOn ?? `${y}-09-21`, amount: '' }])}><SIcon n="plus" />{s.fees.addInstallment}</button>
      </div>
    </Sheet>
  );
}
