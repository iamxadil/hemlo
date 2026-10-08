// The roll call: pick the class (a teacher starts on their own), everyone starts "present", tap a name to mark them
// absent (tap again: late, again: back), or use the four-way switch. One save writes the whole class. After saving,
// the absent students' parents are one tap away on WhatsApp.
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, HeartPulse, MessageCircle, Users } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useS } from './i18n';
import { Avatar, Badge, Button, Card, CardAction, CardDescription, CardHeader, CardTitle, Empty, Page, Row, SimpleSelect, Skeleton, ToggleGroup, ToggleGroupItem } from './ui';
import { addDays, classLabel, classOptions, fill, todayIso, useHashQuery, useSetup, waLink } from './data';

type Student = { id: string; name: string; number: number; health: string | null; status: string | null; note: string | null; at: string | null };
const MARKS = ['present', 'absent', 'late', 'excused'] as const;
const NEXT: Record<string, string> = { present: 'absent', absent: 'late', late: 'present', excused: 'present' };
const PILL: Record<string, string> = { present: '!bg-success', absent: '!bg-destructive', late: '!bg-warning', excused: '!bg-info' };

export function Attendance() {
  const { s, sys, can, num, date, time, lang } = useS();
  const setup = useSetup();
  const hq = useHashQuery();
  const qc = useQueryClient();
  const rtl = document.documentElement.dir === 'rtl';
  const mine = setup.data?.classes.find((c) => c.teacherMemberId && c.teacherMemberId === sys.memberId)?.id;
  const [klass, setKlass] = useState(hq.get('class') ?? ''), [day, setDay] = useState(todayIso());
  useEffect(() => { if (!klass && setup.data?.classes.length) setKlass(mine ?? setup.data.classes[0].id); }, [setup.data, mine, klass]);
  useEffect(() => { const c = hq.get('class'); if (c) setKlass(c); }, [hq]);
  const roll = useQuery<{ taken: boolean; students: Student[] }>({ queryKey: ['sch-roll', klass, day], queryFn: () => api(`/v1/sch/attendance?classId=${klass}&day=${day}`), enabled: !!klass });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!roll.data) return;
    setMarks(Object.fromEntries(roll.data.students.map((x) => [x.id, x.status ?? 'present']))); setDirty(!roll.data.taken && roll.data.students.length > 0); setSaved(false);
  }, [roll.data]);
  const counts = useMemo(() => { const c: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0 }; for (const v of Object.values(marks)) c[v] = (c[v] ?? 0) + 1; return c; }, [marks]);
  const set = (id: string, v: string) => { setMarks((m) => ({ ...m, [id]: v })); setDirty(true); setSaved(false); };
  const save = async () => {
    setBusy(true);
    try {
      await api('/v1/sch/attendance', { method: 'PUT', body: { classId: klass, day, marks: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) } });
      setDirty(false); setSaved(true);
      toast.success(fill(s.roll.saved, { klass: classLabel(setup.data, klass) }));
      qc.invalidateQueries({ queryKey: ['sch-today'] }); roll.refetch();
    } catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
    finally { setBusy(false); }
  };
  const canTake = can('attendance.take'), today = todayIso();
  const absentees = (roll.data?.students ?? []).filter((x) => marks[x.id] === 'absent' || marks[x.id] === 'late');
  const absentText = (setup.data?.school.absentText as any)?.[lang] || s.roll.absentMsg;
  const takenAt = roll.data?.students.find((x) => x.at)?.at;
  const Prev = rtl ? ChevronRight : ChevronLeft, Next = rtl ? ChevronLeft : ChevronRight;

  return (
    <Page>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <SimpleSelect id="roll-class" value={klass} onChange={setKlass} options={classOptions(setup.data)} label={s.roll.klass} />
        <div className="bg-card flex items-center gap-1 rounded-xl border border-border p-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setDay(addDays(day, -1))} aria-label={s.roll.prev}><Prev /></Button>
          <span className="min-w-[9rem] text-center text-[14.5px] font-medium">{day === today ? s.nav.today : date(day)}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setDay(addDays(day, 1))} disabled={day >= today} aria-label={s.roll.next}><Next /></Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{classLabel(setup.data, klass)}</CardTitle>
          <CardDescription>{roll.data?.taken ? fill(s.roll.taken, { time: takenAt ? time(takenAt) : '' }) : s.roll.notTaken} · {s.roll.tapHint}</CardDescription>
          {canTake && <CardAction><Button variant="secondary" size="sm" onClick={() => { setMarks((m) => Object.fromEntries(Object.keys(m).map((k) => [k, 'present']))); setDirty(true); }}><Check />{s.roll.allPresent}</Button></CardAction>}
        </CardHeader>
        {roll.isLoading || !roll.data ? <div className="grid gap-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-13" />)}</div>
          : roll.data.students.length ? (
            <div className="sc-roll">
              {roll.data.students.map((x) => {
                const v = marks[x.id] ?? 'present';
                return (
                  <div key={x.id} className="sc-mark-row" data-mark={v}>
                    <button className="sc-mark-who" onClick={() => canTake && set(x.id, NEXT[v])} disabled={!canTake}>
                      <Avatar name={x.name} />
                      <span className="min-w-0"><b className="block truncate text-[15px] font-medium">{x.name}</b>
                        <span className="text-muted-foreground flex items-center gap-1.5 text-[13px]">#{x.number}{x.health && <><span>·</span><HeartPulse className="text-destructive size-3.5" /></>}</span></span>
                    </button>
                    <ToggleGroup value={v} onValueChange={(k) => canTake && set(x.id, k)} disabled={!canTake} aria-label={x.name} pill={(k) => PILL[k]} className="shrink-0">
                      {MARKS.map((k) => (
                        <ToggleGroupItem key={k} value={k} title={s.marks[k]} className="w-9 px-0 data-[state=on]:!text-white sm:w-auto sm:px-2.5">
                          <span className="sm:hidden">{s.marksShort[k]}</span><span className="max-sm:hidden">{s.marks[k]}</span>
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                );
              })}
            </div>
          ) : <Empty icon={Users} title={s.roll.empty} />}
      </Card>

      <AnimatePresence>
        {canTake && !!roll.data?.students.length && (dirty || saved) && (
          <motion.div className="sc-savebar" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
            <span className="min-w-0 flex-1 text-[14px]"><b className="block">{saved ? fill(s.roll.saved, { klass: classLabel(setup.data, klass) }) : s.roll.unsaved}</b>
              <span className="tabular-nums opacity-75">{fill(s.roll.summary, { p: num(counts.present + counts.excused), a: num(counts.absent), l: num(counts.late) })}</span></span>
            {!saved && <Button onClick={save} disabled={busy} className="bg-background text-foreground hover:bg-background/90">{s.roll.save}</Button>}
          </motion.div>
        )}
      </AnimatePresence>

      {saved && absentees.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader><CardTitle>{s.roll.notify}</CardTitle></CardHeader>
            <div className="pb-1">{absentees.map((x) => <AbsentRow key={x.id} id={x.id} name={x.name} late={marks[x.id] === 'late'} text={marks[x.id] === 'late' ? s.roll.lateMsg : absentText} day={date(day)} school={sys.business.name} />)}</div>
          </Card>
        </motion.div>
      )}
    </Page>
  );
}

/** One absent student: their parent's WhatsApp, with the message already written. */
function AbsentRow({ id, name, late, text, day, school }: { id: string; name: string; late: boolean; text: string; day: string; school: string }) {
  const { s } = useS();
  const f = useQuery<any>({ queryKey: ['sch-student', id], queryFn: () => api(`/v1/sch/students/${id}`), staleTime: 60_000 });
  const phone = f.data?.guardians?.[0]?.phone ?? null;
  return (
    <Row>
      <Avatar name={name} /><span className="min-w-0 flex-1"><b className="block truncate font-medium">{name}</b><Badge variant={late ? 'warning' : 'destructive'}>{late ? s.marks.late : s.marks.absent}</Badge></span>
      <Button asChild variant="whatsapp" size="sm" className={phone ? '' : 'pointer-events-none opacity-50'}><a target="_blank" rel="noopener" href={waLink(phone, fill(text, { student: name, date: day, school }))}><MessageCircle />WhatsApp</a></Button>
    </Row>
  );
}
