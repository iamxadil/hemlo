// The school's morning: how much of today's roll call is done (a ring that fills), which classes haven't taken it yet,
// who is absent (a WhatsApp to their parent, with how often they missed this month), and the money: what came in today,
// what is late. A teacher sees the same morning without the money.
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { useS } from './i18n';
import { SIcon, Avatar, Ring, CountUp, Bar, Page, Skel, Empty, useStagger } from './ui';
import { fill, waLink, useSetup } from './data';

type TodayData = {
  day: string; attendance: { students: number; marked: number; absent: number; late: number; classesDone: number; classes: number };
  classes: { id: string; name: string; gradeName: string; teacherName: string | null; students: number; marked: number; absent: number; late: number }[];
  absent: { id: string; name: string; status: string; className: string; gradeName: string; guardianName: string | null; guardianPhone: string | null; absent30: number }[];
  money: { today: number; month: number; late: number; lateCount: number; weekDue: number } | null;
};

export function Today() {
  const { s, sys, money, num, lang, date } = useS();
  const q = useQuery<TodayData>({ queryKey: ['sch-today'], queryFn: () => api('/v1/sch/today'), refetchInterval: 60_000 });
  const setup = useSetup();
  const stagger = useStagger();
  if (q.isLoading || !q.data) return <div className="grid gap-4"><div className="sc-stats"><Skel h={150} /><Skel h={150} /><Skel h={150} /></div><Skel h={260} /></div>;
  const d = q.data, a = d.attendance;
  const absentText = (setup.data?.school.absentText as any)?.[lang] || s.roll.absentMsg;
  const present = a.marked - a.absent;
  return (
    <Page>
      <div className="sc-stats">
        <section className="sc-card sc-stat flex items-center gap-5" style={{ gridColumn: 'span 1' }}>
          <Ring value={a.marked} total={a.students} label={a.students ? `${Math.round((a.marked / a.students) * 100)}%` : '—'} sub={<span className="sc-num">{num(a.marked)}/{num(a.students)}</span>} />
          <div className="grid gap-1.5">
            <b className="text-[15px]">{s.today.attendance}</b>
            <span className="l">{fill(s.today.taken, { n: num(a.classesDone), total: num(a.classes) })}</span>
            <span className="text-[15px]"><b className="sc-num">{num(present)}</b> <span className="sc-sub">{s.today.present}</span></span>
            <span className="flex flex-wrap gap-1.5">{a.absent > 0 && <span className="sc-pill bad">{fill(s.today.absentN, { n: num(a.absent) })}</span>}{a.late > 0 && <span className="sc-pill warn">{fill(s.today.lateN, { n: num(a.late) })}</span>}</span>
          </div>
        </section>
        {d.money && <>
          <a href="#/fees" className="sc-card sc-stat">
            <span className="l">{s.today.collectedToday}</span>
            <span className="v"><CountUp value={d.money.today} format={(n) => money(n)} /></span>
            <span className="sc-sub">{fill(s.today.collectedMonth, { v: money(d.money.month) })}</span>
          </a>
          <a href="#/fees" className={`sc-card sc-stat${d.money.late ? ' bad' : ''}`}>
            <span className="l">{s.today.late}</span>
            <span className="v"><CountUp value={d.money.late} format={(n) => money(n)} /></span>
            <span className="sc-sub">{fill(s.today.lateStudents, { n: num(d.money.lateCount) })} · {s.today.weekDue} {money(d.money.weekDue)}</span>
          </a>
        </>}
      </div>

      <section className="sc-card">
        <div className="sc-card-h"><h2>{s.today.classes}</h2><a href="#/attendance">{s.today.takeIt}</a></div>
        {d.classes.length ? (
          <div className="sc-classes">
            {d.classes.map((c, i) => {
              const done = c.students > 0 && c.marked >= c.students;
              return (
                <motion.a key={c.id} href={`#/attendance?class=${c.id}`} className="sc-class" data-todo={!done && c.students > 0} {...stagger(i)}>
                  <span className="flex items-start justify-between gap-2"><span className="min-w-0 flex-1"><b className="block truncate text-[15px] font-semibold">{c.gradeName} · {c.name}</b><span className="sc-sub truncate">{c.teacherName ?? `${num(c.students)} ${s.students.title}`}</span></span>
                    {done ? <span className="sc-pill ok flex-none"><SIcon n="check" className="h-3.5 w-3.5" />{s.today.done}</span> : <span className="sc-pill accent flex-none">{s.today.notYet}</span>}</span>
                  <Bar value={c.students ? c.marked / c.students : 0} />
                  <span className="flex gap-1.5 text-[12.5px]"><span className="sc-sub sc-num">{num(c.marked)}/{num(c.students)}</span>{c.absent > 0 && <span className="sc-pill bad">{fill(s.today.absentN, { n: num(c.absent) })}</span>}</span>
                </motion.a>
              );
            })}
          </div>
        ) : <Empty icon="school" title={s.today.noClasses} />}
      </section>

      <section className="sc-card">
        <div className="sc-card-h"><h2>{s.today.absentToday}</h2>{d.absent.length > 0 && <span className="sc-sub sc-num">{num(d.absent.length)}</span>}</div>
        {d.absent.length ? (
          <div className="sc-list">
            {d.absent.map((x, i) => (
              <motion.div key={x.id} className="sc-row" {...stagger(i)}>
                <a href={`#/student?id=${x.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={x.name} />
                  <span className="min-w-0"><b className="block truncate">{x.name}</b><span className="sc-sub">{x.gradeName} · {x.className}{x.absent30 > 1 ? ` · ${fill(s.today.thisMonth, { n: num(x.absent30) })}` : ''}</span></span>
                </a>
                <span className={`sc-pill ${x.status === 'absent' ? 'bad' : 'warn'}`}>{s.marks[x.status]}</span>
                {x.guardianPhone && <a className="sc-btn sc-btn-line sc-btn-sm sc-btn-icon" title={s.today.message} aria-label={s.today.message} target="_blank" rel="noopener"
                  href={waLink(x.guardianPhone, fill(x.status === 'late' ? s.roll.lateMsg : absentText, { student: x.name, date: date(d.day), school: sys.business.name }))}><SIcon n="wa" /></a>}
              </motion.div>
            ))}
          </div>
        ) : <p className="px-5 pb-5 pt-1 text-[14px] text-[var(--s-muted)]">{s.today.noAbsent}</p>}
      </section>
    </Page>
  );
}
