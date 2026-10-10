// The school's morning: how much of today's roll call is done (a ring that fills), which classes haven't taken it yet,
// who is absent (a WhatsApp to their parent, with how often they missed this month), and the money: what came in today,
// what is late. A teacher sees the same morning without the money.
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Check, MessageCircle, School } from 'lucide-react';
import { api } from '../lib/api';
import { useS } from './i18n';
import { Avatar, Badge, Button, Card, CardAction, CardHeader, CardTitle, CountUp, Empty, Page, Progress, Ring, Row, Skeleton, Tilt, useStagger } from './ui';
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
  if (q.isLoading || !q.data) return <div className="grid gap-4"><div className="sc-stats"><Skeleton className="h-38" /><Skeleton className="h-38" /><Skeleton className="h-38" /></div><Skeleton className="h-65" /></div>;
  const d = q.data, a = d.attendance;
  const absentText = (setup.data?.school.absentText as any)?.[lang] || s.roll.absentMsg;
  return (
    <Page>
      <div className="sc-stats">
        <Tilt><Card className="h-full flex-row flex-wrap items-center gap-6 p-6">
          <Ring value={a.marked} total={a.students} label={a.students ? `${Math.round((a.marked / a.students) * 100)}%` : '—'} sub={<span className="tabular-nums">{num(a.marked)}/{num(a.students)}</span>} />
          <div className="grid gap-1.5">
            <b className="text-[15px]">{s.today.attendance}</b>
            <span className="text-muted-foreground text-[13px]">{fill(s.today.taken, { n: num(a.classesDone), total: num(a.classes) })}</span>
            <span className="text-[15px]"><b className="tabular-nums">{num(a.marked - a.absent)}</b> <span className="text-muted-foreground">{s.today.present}</span></span>
            <span className="flex flex-wrap gap-1.5">{a.absent > 0 && <Badge variant="destructive">{fill(s.today.absentN, { n: num(a.absent) })}</Badge>}{a.late > 0 && <Badge variant="warning">{fill(s.today.lateN, { n: num(a.late) })}</Badge>}</span>
          </div>
        </Card></Tilt>
        {d.money && <>
          <Tilt><Card className="sc-stat h-full"><a href="#/fees" className="grid gap-2">
            <span className="l">{s.today.collectedToday}</span><span className="v"><CountUp value={d.money.today} format={money} /></span>
            <span className="text-muted-foreground text-[13px]">{fill(s.today.collectedMonth, { v: money(d.money.month) })}</span></a></Card></Tilt>
          <Tilt><Card className={`sc-stat h-full${d.money.late ? ' bad' : ''}`}><a href="#/fees" className="grid gap-2">
            <span className="l">{s.today.late}</span><span className="v"><CountUp value={d.money.late} format={money} /></span>
            <span className="text-muted-foreground text-[13px]">{fill(s.today.lateStudents, { n: num(d.money.lateCount) })} · {s.today.weekDue} {money(d.money.weekDue)}</span></a></Card></Tilt>
        </>}
      </div>

      <Card>
        <CardHeader><CardTitle>{s.today.classes}</CardTitle><CardAction><Button asChild variant="link" size="sm" className="h-auto px-0"><a href="#/attendance">{s.today.takeIt}</a></Button></CardAction></CardHeader>
        {d.classes.length ? (
          <div className="sc-classes">
            {d.classes.map((c, i) => {
              const done = c.students > 0 && c.marked >= c.students;
              return (
                <motion.a key={c.id} href={`#/attendance?class=${c.id}`} className="sc-class" data-todo={!done && c.students > 0} {...stagger(i)}>
                  <span className="flex items-start justify-between gap-2"><span className="min-w-0 flex-1"><b className="block truncate text-[15px] font-semibold">{c.gradeName} · {c.name}</b><span className="text-muted-foreground block truncate text-[13px]">{c.teacherName ?? `${num(c.students)} ${s.students.title}`}</span></span>
                    {done ? <Badge variant="success"><Check />{s.today.done}</Badge> : <Badge>{s.today.notYet}</Badge>}</span>
                  <Progress value={c.students ? (c.marked / c.students) * 100 : 0} />
                  <span className="flex gap-1.5 text-[12.5px]"><span className="text-muted-foreground tabular-nums">{num(c.marked)}/{num(c.students)}</span>{c.absent > 0 && <Badge variant="destructive">{fill(s.today.absentN, { n: num(c.absent) })}</Badge>}</span>
                </motion.a>
              );
            })}
          </div>
        ) : <Empty icon={School} title={s.today.noClasses} />}
      </Card>

      <Card>
        <CardHeader><CardTitle>{s.today.absentToday}</CardTitle>{d.absent.length > 0 && <CardAction className="text-muted-foreground text-[13px] tabular-nums">{num(d.absent.length)}</CardAction>}</CardHeader>
        {d.absent.length ? (
          <div className="pb-1">
            {d.absent.map((x, i) => (
              <Row key={x.id} {...stagger(i)}>
                <a href={`#/student?id=${x.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={x.name} />
                  <span className="min-w-0"><b className="block truncate font-medium">{x.name}</b><span className="text-muted-foreground text-[13px]">{x.gradeName} · {x.className}{x.absent30 > 1 ? ` · ${fill(s.today.thisMonth, { n: num(x.absent30) })}` : ''}</span></span>
                </a>
                <Badge variant={x.status === 'absent' ? 'destructive' : 'warning'}>{s.marks[x.status]}</Badge>
                {x.guardianPhone && <Button asChild variant="outline" size="icon-sm" title={s.today.message}><a target="_blank" rel="noopener" aria-label={s.today.message}
                  href={waLink(x.guardianPhone, fill(x.status === 'late' ? s.roll.lateMsg : absentText, { student: x.name, date: date(d.day), school: sys.business.name }))}><MessageCircle /></a></Button>}
              </Row>
            ))}
          </div>
        ) : <p className="text-muted-foreground px-5 pt-1 pb-5 text-[14px]">{s.today.noAbsent}</p>}
      </Card>
    </Page>
  );
}
