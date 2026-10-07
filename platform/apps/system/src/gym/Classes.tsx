// Classes: the week as columns of sessions (time, coach, places taken), and each session's list: book a member in,
// mark who came. Full is full; a ladies' class only takes ladies.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Empty, Icon, Sheet } from '../components/ui';
import { useG } from './i18n';
import { Face, MemberPicker, SlideSeg } from './ui';
import { useSetup, todayISO, addDays, fmt } from './data';

type Session = { classId: string; date: string; name: string; trainerId: string | null; startsAt: string; minutes: number; capacity: number | null; gender: string; color: string | null; booked: number; came: number };

export function Classes() {
  const { g, can, num, lang } = useG();
  const setup = useSetup();
  const [week, setWeek] = useState<'0' | '1'>('0');
  const from = addDays(todayISO(), week === '1' ? 7 : 0);
  const q = useQuery({ queryKey: ['gym-sessions', from], queryFn: async () => (await api(`/v1/gym/sessions?from=${from}`)).sessions as Session[], placeholderData: (x) => x });
  const [open, setOpen] = useState<Session | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const coach = (id: string | null) => setup.data?.trainers.find((t) => t.id === id)?.name;
  const dayName = (d: string) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-IQ-u-nu-latn', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const today = todayISO();
  if (setup.data && !setup.data.classes.length) return <Empty icon="calendar" text={g.classes.empty} action={can('gym.configure') && <a className="btn btn-accent btn-sm" href="#/gym?tab=timetable">{g.classes.setup}</a>} />;
  return (
    <div className="grid gap-4">
      <SlideSeg value={week} onChange={(v) => setWeek(v as '0' | '1')} options={[['0', g.classes.week], ['1', g.classes.next]]} className="justify-self-start" />
      <div className="gy-week">
        {days.map((d) => {
          const list = (q.data ?? []).filter((s) => s.date === d);
          return (
            <section key={d} className={`gy-wday${d === today ? ' today' : ''}`}>
              <header><b>{dayName(d)}</b><span dir="ltr">{d.slice(8)}/{d.slice(5, 7)}</span></header>
              {!list.length ? <p className="gy-wday-none">—</p> : list.map((s) => {
                const full = s.capacity != null && s.booked >= s.capacity;
                return (
                  <button key={s.classId} className={`gy-session${full ? ' full' : ''}`} style={{ ['--k' as any]: s.color ?? 'var(--gy-ember)' }} onClick={() => setOpen(s)}>
                    <span className="gy-session-t" dir="ltr">{s.startsAt}</span>
                    <b>{s.name}</b>
                    <span className="sub">{[coach(s.trainerId), s.gender !== 'all' ? g.classes.who[s.gender] : null].filter(Boolean).join(' · ')}</span>
                    <span className="gy-session-cap">
                      {s.capacity != null && <i style={{ width: `${Math.min(100, (s.booked / s.capacity) * 100)}%` }} />}
                      <em>{full ? g.classes.full : s.capacity != null ? fmt(g.classes.spots, { n: num(s.booked), c: num(s.capacity) }) : num(s.booked)}</em>
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
      {open && <SessionSheet s={open} coach={coach(open.trainerId)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SessionSheet({ s, coach, onClose }: { s: Session; coach?: string; onClose(): void }) {
  const { g, can, num, date, toast, err } = useG();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const list = useQuery({ queryKey: ['gym-session', s.classId, s.date], queryFn: async () => (await api(`/v1/gym/sessions/${s.classId}/${s.date}`)).bookings as any[] });
  const done = () => { qc.invalidateQueries({ queryKey: ['gym-session', s.classId, s.date] }); qc.invalidateQueries({ queryKey: ['gym-sessions'] }); };
  const book = useMutation({ mutationFn: (memberId: string) => api('/v1/gym/bookings', { body: { classId: s.classId, date: s.date, memberId } }), onSuccess: () => { done(); setAdding(false); toast(g.classes.booked); }, onError: (e) => toast(err(e), 'bad') });
  const mark = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api(`/v1/gym/bookings/${id}`, { method: 'PATCH', body: { status } }), onSuccess: done, onError: (e) => toast(err(e), 'bad') });
  const past = s.date <= todayISO();
  return (
    <Sheet title={s.name} sub={<span dir="auto">{date(s.date)} · {s.startsAt} · {fmt(g.classes.min, { n: num(s.minutes) })}{coach ? ` · ${fmt(g.classes.with, { coach })}` : ''}</span>} onClose={onClose}>
      {can('checkin.create') && (adding ? <MemberPicker onPick={(m) => book.mutate(m.id)} /> : <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{g.classes.book}</button>)}
      <div className="gy-card rows overflow-clip">
        {!list.data ? <div className="skeleton m-4 h-24" /> : !list.data.length ? <p className="sub p-5">{g.classes.nobody}</p> : list.data.map((b) => (
          <div key={b.id} className="row">
            <Face name={b.name} url={b.photoUrl} size="sm" />
            <a className="min-w-0 flex-1" href={`#/member?id=${b.memberId}`}><b className="block truncate font-medium">{b.name}</b><span className="sub">{b.status === 'attended' ? g.classes.came : b.status === 'no_show' ? g.classes.noShow : g.classes.booked}</span></a>
            {can('checkin.create') && <div className="flex gap-1">
              {past && <button className={`icon-btn${b.status === 'attended' ? ' gy-on-ok' : ''}`} title={g.classes.came} onClick={() => mark.mutate({ id: b.id, status: b.status === 'attended' ? 'booked' : 'attended' })}><Icon n="check" /></button>}
              {past && <button className={`icon-btn${b.status === 'no_show' ? ' gy-on-bad' : ''}`} title={g.classes.noShow} onClick={() => mark.mutate({ id: b.id, status: b.status === 'no_show' ? 'booked' : 'no_show' })}><Icon n="minus" /></button>}
              <button className="icon-btn" title={g.classes.cancel} onClick={() => mark.mutate({ id: b.id, status: 'canceled' })}><Icon n="close" /></button>
            </div>}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
