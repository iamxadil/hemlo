// The roll call: pick the class (a teacher starts on their own), everyone starts "present", tap a name to mark them
// absent (tap again: late, again: back), or use the four-way switch. One save writes the whole class. After saving,
// the absent students' parents are one tap away on WhatsApp.
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { useS } from './i18n';
import { SIcon, Avatar, Page, Skel, Empty, Select } from './ui';
import { addDays, classLabel, classOptions, fill, todayIso, useHashQuery, useSetup, waLink } from './data';

type Student = { id: string; name: string; number: number; health: string | null; status: string | null; note: string | null; at: string | null };
const MARKS = ['present', 'absent', 'late', 'excused'] as const;
const NEXT: Record<string, string> = { present: 'absent', absent: 'late', late: 'present', excused: 'present' };

export function Attendance() {
  const { s, sys, can, num, date, time, lang } = useS();
  const setup = useSetup();
  const hq = useHashQuery();
  const qc = useQueryClient();
  const mine = setup.data?.classes.find((c) => c.teacherMemberId && c.teacherMemberId === sys.memberId)?.id;
  const [klass, setKlass] = useState(hq.get('class') ?? '');
  const [day, setDay] = useState(todayIso());
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
  const canTake = can('attendance.take');
  const today = todayIso();
  const absentees = (roll.data?.students ?? []).filter((x) => marks[x.id] === 'absent' || marks[x.id] === 'late');
  const absentText = (setup.data?.school.absentText as any)?.[lang] || s.roll.absentMsg;
  const takenAt = roll.data?.students.find((x) => x.at)?.at;

  return (
    <Page>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Select id="roll-class" value={klass} onChange={(v) => setKlass(v)} options={classOptions(setup.data)} label={s.roll.klass} />
        <div className="flex items-center gap-1 rounded-xl border border-[var(--s-line)] bg-[var(--s-surface)] p-1">
          <button className="sc-btn sc-btn-ghost sc-btn-sm sc-btn-icon" onClick={() => setDay(addDays(day, -1))} aria-label={s.roll.prev}><SIcon n={document.documentElement.dir === 'rtl' ? 'next' : 'prev'} /></button>
          <span className="min-w-[9rem] text-center text-[14.5px] font-medium">{day === today ? s.nav.today : date(day)}</span>
          <button className="sc-btn sc-btn-ghost sc-btn-sm sc-btn-icon" onClick={() => setDay(addDays(day, 1))} disabled={day >= today} aria-label={s.roll.next}><SIcon n={document.documentElement.dir === 'rtl' ? 'prev' : 'next'} /></button>
        </div>
      </div>

      <section className="sc-card overflow-hidden">
        <div className="sc-card-h">
          <div><h2>{classLabel(setup.data, klass)}</h2><p className="sc-sub mt-0.5">{roll.data?.taken ? fill(s.roll.taken, { time: takenAt ? time(takenAt) : '' }) : s.roll.notTaken} · {s.roll.tapHint}</p></div>
          {canTake && <button className="sc-btn sc-btn-soft sc-btn-sm" onClick={() => { setMarks((m) => Object.fromEntries(Object.keys(m).map((k) => [k, 'present']))); setDirty(true); }}><SIcon n="check" />{s.roll.allPresent}</button>}
        </div>
        {roll.isLoading || !roll.data ? <div className="grid gap-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skel key={i} h={52} />)}</div>
          : roll.data.students.length ? (
            <div className="sc-roll">
              {roll.data.students.map((x) => {
                const v = marks[x.id] ?? 'present';
                return (
                  <div key={x.id} className="sc-mark-row" data-mark={v}>
                    <button className="sc-mark-who" onClick={() => canTake && set(x.id, NEXT[v])} disabled={!canTake}>
                      <Avatar name={x.name} />
                      <span className="min-w-0"><b className="block truncate text-[15px] font-medium">{x.name}</b>
                        <span className="sc-sub flex items-center gap-1.5">#{x.number}{x.health && <><span>·</span><SIcon n="heart" className="h-3.5 w-3.5 text-[var(--s-absent)]" /></>}</span></span>
                    </button>
                    <div className="sc-marks" role="radiogroup" aria-label={x.name}>
                      {MARKS.map((k) => (
                        <button key={k} role="radio" aria-checked={v === k} data-v={k} data-state={v === k ? 'on' : 'off'} onClick={() => canTake && set(x.id, k)} disabled={!canTake} title={s.marks[k]}>
                          {v === k && <motion.span layoutId={`mk-${x.id}`} className="sc-mark-pill" transition={{ type: 'spring', stiffness: 600, damping: 38 }} />}
                          <span><span className="sm:hidden">{s.marksShort[k]}</span><span className="hidden sm:inline">{s.marks[k]}</span></span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty icon="users" title={s.roll.empty} />}
      </section>

      <AnimatePresence>
        {canTake && !!roll.data?.students.length && (dirty || saved) && (
          <motion.div className="sc-savebar" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
            <span className="min-w-0 flex-1 text-[14px]"><b className="block">{saved ? fill(s.roll.saved, { klass: classLabel(setup.data, klass) }) : s.roll.unsaved}</b>
              <span className="opacity-75 sc-num">{fill(s.roll.summary, { p: num(counts.present + counts.excused), a: num(counts.absent), l: num(counts.late) })}</span></span>
            {saved ? null : <button className="sc-btn sc-btn-primary" onClick={save} disabled={busy}>{s.roll.save}</button>}
          </motion.div>
        )}
      </AnimatePresence>

      {saved && absentees.length > 0 && (
        <motion.section className="sc-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="sc-card-h"><h2>{s.roll.notify}</h2></div>
          <div className="sc-list">
            {absentees.map((x) => <AbsentRow key={x.id} id={x.id} name={x.name} late={marks[x.id] === 'late'} text={marks[x.id] === 'late' ? s.roll.lateMsg : absentText} day={date(day)} school={sys.business.name} />)}
          </div>
        </motion.section>
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
    <div className="sc-row">
      <Avatar name={name} /><span className="min-w-0 flex-1"><b className="block truncate">{name}</b><span className={`sc-pill ${late ? 'warn' : 'bad'}`}>{late ? s.marks.late : s.marks.absent}</span></span>
      <a className={`sc-btn sc-btn-wa sc-btn-sm${phone ? '' : ' opacity-50 pointer-events-none'}`} target="_blank" rel="noopener" href={waLink(phone, fill(text, { student: name, date: day, school }))}><SIcon n="wa" />WhatsApp</a>
    </div>
  );
}
