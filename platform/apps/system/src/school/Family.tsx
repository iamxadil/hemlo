// The parent's page (system.hemlohq.com/#/family/<link>): no sign-in, no app. Each child at the school: their class,
// the last 30 days of attendance as a strip, what is owed and the next instalment, the last receipt. Then one tap to
// call or message the school. Read-only; the school can replace the link at any time.
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Phone } from 'lucide-react';
import { api } from '../lib/api';
import { readLang } from '../lib/i18n';
import { sOf } from './i18n';
import { Avatar, Badge, Button, Card, Skeleton } from './ui';
import { fill, waLink } from './data';
import './school.css';

type Fam = { guardian: string; school: { name: string; phone: string | null; whatsapp: string | null }; children: { name: string; className: string | null; gradeName: string | null;
  attendance: { days: { day: string; status: string }[]; absent: number; late: number; present: number };
  money: { balance: number; overdue: number; next: { dueOn: string; amount: number } | null; last: { number: number; amount: number; at: string } | null } }[] };

export function Family() {
  const lang = readLang(), s = sOf(lang), en = lang === 'en';
  const token = location.hash.split('/')[2] ?? '';
  const [data, setData] = useState<Fam | null>(null), [gone, setGone] = useState(false);
  useEffect(() => {
    document.documentElement.classList.add('sc'); document.documentElement.lang = en ? 'en' : 'ar'; document.documentElement.dir = en ? 'ltr' : 'rtl';
    api<Fam>(`/v1/sch/pub/family/${encodeURIComponent(token)}`).then(setData).catch(() => setGone(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const iqd = (n: number) => `${new Intl.NumberFormat(en ? 'en-US' : 'ar-IQ-u-nu-latn').format(n)} ${en ? 'IQD' : 'د.ع'}`;
  const day = (d: string) => new Intl.DateTimeFormat(en ? 'en-GB' : 'ar-IQ-u-nu-latn', { day: 'numeric', month: 'long' }).format(new Date(`${d}T12:00:00Z`));
  if (gone) return <main className="sc-family"><Card className="grid gap-2 p-6 text-center"><h1 className="text-[20px] font-semibold">{s.family.notFound}</h1><p className="text-muted-foreground">{s.family.notFoundBody}</p></Card></main>;
  if (!data) return <main className="sc-family"><Skeleton className="h-22" /><Skeleton className="h-65" /></main>;
  const contact = data.school.whatsapp ?? data.school.phone;
  return (
    <main className="sc-family">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-1 pt-2">
        <span className="text-muted-foreground text-[13px] font-medium">{data.school.name}</span>
        <h1 className="text-[26px] font-semibold tracking-tight">{fill(s.family.hello, { name: data.guardian.split(/\s+/)[0] })}</h1>
        <p className="text-muted-foreground text-[14px]">{fill(s.family.sub, { school: data.school.name })}</p>
      </motion.header>
      {data.children.map((c, i) => (
        <motion.div key={c.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * (i + 1) }}>
          <Card className="grid gap-4 p-5">
            <div className="flex items-center gap-3"><Avatar name={c.name} /><div className="min-w-0"><b className="block truncate text-[17px]">{c.name}</b><span className="text-muted-foreground text-[13px]">{c.gradeName} · {c.className}</span></div></div>
            <div className="grid gap-2">
              <span className="text-muted-foreground text-[13px] font-medium">{s.family.attendance}</span>
              <div className="flex gap-2"><Badge variant="success">{s.family.present} {c.attendance.present}</Badge>{c.attendance.absent > 0 && <Badge variant="destructive">{s.family.absent} {c.attendance.absent}</Badge>}{c.attendance.late > 0 && <Badge variant="warning">{s.family.late} {c.attendance.late}</Badge>}</div>
              <div className="flex flex-wrap gap-1" dir="ltr">{[...c.attendance.days].reverse().map((d) => <i key={d.day} title={day(d.day)} className="size-3.5 rounded" style={{ background: `var(--s-${d.status === 'present' ? 'present-soft' : d.status})` }} />)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary rounded-2xl p-3"><span className="text-muted-foreground text-[13px]">{s.family.owed}</span><b className="block text-[18px] tabular-nums">{iqd(c.money.balance)}</b>
                {c.money.overdue > 0 ? <Badge variant="destructive" className="mt-1">{s.family.overdue} {iqd(c.money.overdue)}</Badge> : <Badge variant="success" className="mt-1">{s.family.allPaid}</Badge>}</div>
              <div className="bg-secondary rounded-2xl p-3"><span className="text-muted-foreground text-[13px]">{s.family.next}</span>
                {c.money.next ? <><b className="block text-[18px] tabular-nums">{iqd(c.money.next.amount)}</b><span className="text-muted-foreground text-[13px]">{day(c.money.next.dueOn)}</span></> : <b className="block">—</b>}</div>
            </div>
            {c.money.last && <p className="text-muted-foreground text-[13px]">{s.family.last}: {iqd(c.money.last.amount)} · {fill(s.family.receipt, { n: c.money.last.number })} · {day(c.money.last.at.slice(0, 10))}</p>}
          </Card>
        </motion.div>
      ))}
      {contact && <div className="grid grid-cols-2 gap-2">
        {data.school.phone && <Button asChild variant="outline"><a href={`tel:${data.school.phone}`}><Phone />{s.family.call}</a></Button>}
        <Button asChild variant="whatsapp"><a href={waLink(contact, '')} target="_blank" rel="noopener"><MessageCircle />{s.family.message}</a></Button>
      </div>}
      <p className="text-muted-foreground text-center text-[13px]">{s.family.powered}</p>
    </main>
  );
}
