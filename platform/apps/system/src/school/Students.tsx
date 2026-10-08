// Students: one search (name, number, a parent's phone), the classes as chips, "late on fees" as a switch, and the money
// on every row. Admitting a student is one sheet: name, class, the parent's phone (a brother or sister's parent is found
// by it), health notes; the year's tuition is applied by the server.
import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { go } from '../lib/app';
import { rtl } from '../lib/i18n';
import { useS } from './i18n';
import { SIcon, Avatar, Page, Skel, Empty, Sheet, Select, Segmented, useStagger } from './ui';
import { classLabel, classOptions, clearParam, fill, useHashQuery, useSetup } from './data';

type Row = { id: string; number: number; name: string; classId: string | null; className: string | null; gradeName: string | null; balance: number; overdue: number; guardianName: string | null; guardianPhone: string | null };

export function Students() {
  const { s, num, money, can } = useS();
  const setup = useSetup();
  const hq = useHashQuery();
  const [q, setQ] = useState(''), [debounced, setDebounced] = useState('');
  const [klass, setKlass] = useState(hq.get('class') ?? ''), [owing, setOwing] = useState(hq.get('owing') === '1');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  const adding = hq.get('add') === '1';
  const list = useInfiniteQuery<{ total: number; students: Row[] }>({
    queryKey: ['sch-students', debounced, klass, owing],
    queryFn: ({ pageParam }) => api(`/v1/sch/students?limit=60&offset=${pageParam}&q=${encodeURIComponent(debounced)}&classId=${klass}${owing ? '&owing=1' : ''}`),
    initialPageParam: 0, getNextPageParam: (last, all) => { const n = all.reduce((t, p) => t + p.students.length, 0); return n < last.total ? n : undefined; },
    placeholderData: (prev) => prev,
  });
  const rows = list.data?.pages.flatMap((p) => p.students) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const stagger = useStagger();
  const filtered = !!(debounced || klass || owing);

  return (
    <Page>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <label className="relative block">
          <SIcon n="search" className="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--s-muted)] start-4" />
          <input className="sc-input ps-11" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.students.search} aria-label={s.students.search} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="sc-chips min-w-0 flex-[1_1_16rem]">
            <button className="sc-chip" data-on={!klass} onClick={() => setKlass('')}>{s.students.all}</button>
            {(setup.data?.classes ?? []).map((c) => <button key={c.id} className="sc-chip" data-on={klass === c.id} onClick={() => setKlass(klass === c.id ? '' : c.id)}>{classLabel(setup.data, c.id)}</button>)}
          </div>
          {can('fees.read') && <Segmented label={s.students.owing} value={owing ? 'owing' : 'all'} onChange={(v) => setOwing(v === 'owing')} options={[{ value: 'all', label: s.students.all }, { value: 'owing', label: s.students.owing }]} />}
        </div>
      </div>

      <section className="sc-card overflow-hidden">
        <div className="sc-card-h"><h2 className="sc-num">{fill(s.students.count, { n: num(total) })}</h2>
          {can('students.create') && <a className="sc-btn sc-btn-soft sc-btn-sm" href="#/students?add=1"><SIcon n="plus" />{s.students.add}</a>}</div>
        {list.isLoading ? <div className="grid gap-2 p-4">{[0, 1, 2, 3].map((i) => <Skel key={i} h={52} />)}</div>
          : rows.length ? (
            <div className="sc-list">
              {rows.map((x, i) => (
                <motion.a key={x.id} href={`#/student?id=${x.id}`} className="sc-row" {...stagger(i)}>
                  <Avatar name={x.name} />
                  <span className="min-w-0 flex-1"><b className="block truncate">{x.name}</b>
                    <span className="sc-sub">#{x.number} · {x.gradeName ? `${x.gradeName} · ${x.className}` : s.students.noClass}</span></span>
                  {can('fees.read') && (x.overdue > 0 ? <span className="sc-pill bad sc-num">{fill(s.students.overdue, { v: money(x.overdue) })}</span>
                    : x.balance > 0 ? <span className="sc-pill sc-num hidden sm:inline-flex">{fill(s.students.balance, { v: money(x.balance) })}</span> : <span className="sc-pill ok">{s.students.paid}</span>)}
                  <SIcon n={document.documentElement.dir === 'rtl' ? 'prev' : 'next'} className="h-4 w-4 text-[var(--s-muted)]" />
                </motion.a>
              ))}
              {list.hasNextPage && <button className="sc-row justify-center text-[14px] font-medium text-[var(--s-accent)]" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{s.students.more}</button>}
            </div>
          ) : filtered ? <Empty icon="search" title={s.students.noMatch} />
            : <Empty title={s.students.empty} body={s.students.emptyBody} action={can('students.create') ? <a className="sc-btn sc-btn-primary" href="#/students?add=1"><SIcon n="plus" />{s.students.add}</a> : undefined} />}
      </section>
      <AddStudent open={adding} onClose={() => clearParam('add')} defaultClass={klass} />
    </Page>
  );
}

/** Admit a student: one sheet, the essentials only. */
export function AddStudent({ open, onClose, defaultClass }: { open: boolean; onClose(): void; defaultClass?: string }) {
  const { s, lang, num } = useS();
  const setup = useSetup();
  const qc = useQueryClient();
  const blank = { name: '', gender: 'm', classId: defaultClass ?? '', birthDate: '', gName: '', relation: 'father', phone: '', health: '' };
  const [f, setF] = useState(blank), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { if (open) { setF({ ...blank, classId: defaultClass || setup.data?.classes[0]?.id || '' }); setErr(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!f.name.trim()) return setErr(s.errors.BAD_NAME);
    if (!f.classId) return setErr(s.errors.BAD_CLASS);
    setBusy(true); setErr('');
    try {
      const r = await api<{ id: string }>('/v1/sch/students', { body: { name: f.name, gender: f.gender, classId: f.classId, birthDate: f.birthDate || null, health: f.health || null,
        guardian: f.gName || f.phone ? { name: f.gName || null, relation: f.relation, phone: f.phone || null } : null } });
      qc.invalidateQueries({ queryKey: ['sch-students'] }); qc.invalidateQueries({ queryKey: ['sch-setup'] }); qc.invalidateQueries({ queryKey: ['sch-today'] });
      const file = await api<any>(`/v1/sch/students/${r.id}`);
      toast.success(fill(s.students.added, { name: f.name.trim(), n: num(file.student.number) }));
      onClose(); go(`#/student?id=${r.id}`);
    } catch (x) { setErr(x instanceof ApiError ? s.errors[x.code] ?? x.code : String(x)); }
    finally { setBusy(false); }
  };
  const rels = Object.entries(s.relations).map(([value, label]) => ({ value, label }));
  return (
    <Sheet open={open} onClose={onClose} title={s.students.addTitle} sub={s.students.addSub} rtl={rtl(lang)}
      footer={<><button className="sc-btn sc-btn-primary sc-btn-block" onClick={() => save()} disabled={busy}>{s.students.save}</button>{err && <p className="text-center text-[13.5px] text-[var(--s-absent)]" role="alert">{err}</p>}</>}>
      <form onSubmit={save} className="grid gap-4">
        <label className="sc-field"><span>{s.students.name}</span><input id="st-name" className="sc-input" value={f.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" autoFocus /></label>
        <div className="grid grid-cols-[auto_1fr] items-end gap-3">
          <div className="sc-field"><span>{s.students.gender}</span><Segmented label={s.students.gender} value={f.gender} onChange={set('gender')} options={[{ value: 'm', label: s.gender.m }, { value: 'f', label: s.gender.f }]} /></div>
          <div className="sc-field"><span>{s.students.klass}</span><Select id="st-class" value={f.classId} onChange={set('classId')} options={classOptions(setup.data)} label={s.students.klass} /></div>
        </div>
        <label className="sc-field"><span>{s.students.birth}</span><input id="st-birth" className="sc-input" type="date" value={f.birthDate} onChange={(e) => set('birthDate')(e.target.value)} /></label>
        <fieldset className="grid gap-3 rounded-2xl border border-[var(--s-line)] p-4">
          <legend className="px-1 text-[13px] font-medium text-[var(--s-ink-2)]">{s.students.guardian}</legend>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="sc-field"><span>{s.students.guardianName}</span><input id="st-gname" className="sc-input" value={f.gName} onChange={(e) => set('gName')(e.target.value)} autoComplete="off" /></label>
            <div className="sc-field w-36"><span>{s.students.relation}</span><Select id="st-rel" value={f.relation} onChange={set('relation')} options={rels} label={s.students.relation} /></div>
          </div>
          <label className="sc-field"><span>{s.students.phone}</span><input id="st-phone" className="sc-input" type="tel" inputMode="tel" dir="ltr" placeholder="07XX XXX XXXX" value={f.phone} onChange={(e) => set('phone')(e.target.value)} /><small>{s.students.phoneHint}</small></label>
        </fieldset>
        <label className="sc-field"><span>{s.students.health}</span><input id="st-health" className="sc-input" value={f.health} onChange={(e) => set('health')(e.target.value)} /><small>{s.students.healthHint}</small></label>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
