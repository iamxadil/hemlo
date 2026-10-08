// Students: one search (name, number, a parent's phone), the classes as chips, "late on fees" as a switch, and the money
// on every row. Admitting a student is one sheet: name, class, the parent's phone (a brother or sister's parent is found
// by it), health notes; the year's tuition is applied by the server.
import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { go } from '../lib/app';
import { useS } from './i18n';
import { Avatar, Badge, Button, Card, CardAction, CardHeader, CardTitle, Empty, Field, Input, Page, Row, Sheet, SimpleSelect, Skeleton, ToggleGroup, ToggleGroupItem, cn, useStagger } from './ui';
import { classLabel, classOptions, clearParam, fill, useHashQuery, useSetup } from './data';

type StudentRow = { id: string; number: number; name: string; classId: string | null; className: string | null; gradeName: string | null; balance: number; overdue: number; guardianName: string | null; guardianPhone: string | null };

export function Students() {
  const { s, num, money, can } = useS();
  const setup = useSetup();
  const hq = useHashQuery();
  const [q, setQ] = useState(''), [debounced, setDebounced] = useState('');
  const [klass, setKlass] = useState(hq.get('class') ?? ''), [owing, setOwing] = useState(hq.get('owing') === '1');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  const adding = hq.get('add') === '1';
  const list = useInfiniteQuery<{ total: number; students: StudentRow[] }>({
    queryKey: ['sch-students', debounced, klass, owing],
    queryFn: ({ pageParam }) => api(`/v1/sch/students?limit=60&offset=${pageParam}&q=${encodeURIComponent(debounced)}&classId=${klass}${owing ? '&owing=1' : ''}`),
    initialPageParam: 0, getNextPageParam: (last, all) => { const n = all.reduce((t, p) => t + p.students.length, 0); return n < last.total ? n : undefined; },
    placeholderData: (prev) => prev,
  });
  const rows = list.data?.pages.flatMap((p) => p.students) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const stagger = useStagger();
  const filtered = !!(debounced || klass || owing);
  const Chevron = document.documentElement.dir === 'rtl' ? ChevronLeft : ChevronRight;
  const chip = (on: boolean) => cn('h-8.5 shrink-0 rounded-full border px-3.5 text-[13.5px] transition-colors', on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground/80 hover:bg-accent');

  return (
    <Page>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.students.search} aria-label={s.students.search} className="ps-10" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-[1_1_16rem] gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button className={chip(!klass)} onClick={() => setKlass('')}>{s.students.all}</button>
            {(setup.data?.classes ?? []).map((c) => <button key={c.id} className={chip(klass === c.id)} onClick={() => setKlass(klass === c.id ? '' : c.id)}>{classLabel(setup.data, c.id)}</button>)}
          </div>
          {can('fees.read') && <ToggleGroup value={owing ? 'owing' : 'all'} onValueChange={(v) => setOwing(v === 'owing')} aria-label={s.students.owing}>
            <ToggleGroupItem value="all">{s.students.all}</ToggleGroupItem><ToggleGroupItem value="owing">{s.students.owing}</ToggleGroupItem></ToggleGroup>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="tabular-nums">{fill(s.students.count, { n: num(total) })}</CardTitle>
          {can('students.create') && <CardAction><Button asChild variant="secondary" size="sm"><a href="#/students?add=1"><Plus />{s.students.add}</a></Button></CardAction>}</CardHeader>
        {list.isLoading ? <div className="grid gap-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-13" />)}</div>
          : rows.length ? (
            <div>
              {rows.map((x, i) => (
                <Row key={x.id} href={`#/student?id=${x.id}`} {...stagger(i)}>
                  <Avatar name={x.name} />
                  <span className="min-w-0 flex-1"><b className="block truncate font-medium">{x.name}</b>
                    <span className="text-muted-foreground text-[13px]">#{x.number} · {x.gradeName ? `${x.gradeName} · ${x.className}` : s.students.noClass}</span></span>
                  {can('fees.read') && (x.overdue > 0 ? <Badge variant="destructive" className="tabular-nums">{fill(s.students.overdue, { v: money(x.overdue) })}</Badge>
                    : x.balance > 0 ? <Badge variant="secondary" className="tabular-nums max-sm:hidden">{fill(s.students.balance, { v: money(x.balance) })}</Badge> : <Badge variant="success">{s.students.paid}</Badge>)}
                  <Chevron className="text-muted-foreground size-4 shrink-0" />
                </Row>
              ))}
              {list.hasNextPage && <Row onClick={() => list.fetchNextPage()} className="text-primary justify-center text-[14px] font-medium">{s.students.more}</Row>}
            </div>
          ) : filtered ? <Empty icon={Search} title={s.students.noMatch} />
            : <Empty icon={Users} title={s.students.empty} body={s.students.emptyBody} action={can('students.create') ? <Button asChild><a href="#/students?add=1"><Plus />{s.students.add}</a></Button> : undefined} />}
      </Card>
      <AddStudent open={adding} onClose={() => clearParam('add')} defaultClass={klass} />
    </Page>
  );
}

/** Admit a student: one sheet, the essentials only. */
export function AddStudent({ open, onClose, defaultClass }: { open: boolean; onClose(): void; defaultClass?: string }) {
  const { s, num } = useS();
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
    <Sheet open={open} onClose={onClose} title={s.students.addTitle} description={s.students.addSub}
      footer={<><Button size="lg" onClick={() => save()} disabled={busy}>{s.students.save}</Button>{err && <p className="text-destructive text-center text-[13.5px]" role="alert">{err}</p>}</>}>
      <form onSubmit={save} className="grid gap-4">
        <Field label={s.students.name} htmlFor="st-name"><Input id="st-name" value={f.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" autoFocus /></Field>
        <div className="grid grid-cols-[auto_1fr] items-end gap-3">
          <Field label={s.students.gender}><ToggleGroup value={f.gender} onValueChange={set('gender')} aria-label={s.students.gender} className="h-11"><ToggleGroupItem value="m" className="h-9.5">{s.gender.m}</ToggleGroupItem><ToggleGroupItem value="f" className="h-9.5">{s.gender.f}</ToggleGroupItem></ToggleGroup></Field>
          <Field label={s.students.klass} htmlFor="st-class"><SimpleSelect id="st-class" value={f.classId} onChange={set('classId')} options={classOptions(setup.data)} label={s.students.klass} /></Field>
        </div>
        <Field label={s.students.birth} htmlFor="st-birth"><Input id="st-birth" type="date" value={f.birthDate} onChange={(e) => set('birthDate')(e.target.value)} /></Field>
        <fieldset className="grid gap-3 rounded-2xl border border-border p-4">
          <legend className="text-foreground/80 px-1 text-[13px] font-medium">{s.students.guardian}</legend>
          <div className="grid grid-cols-[1fr_9rem] gap-3">
            <Field label={s.students.guardianName} htmlFor="st-gname"><Input id="st-gname" value={f.gName} onChange={(e) => set('gName')(e.target.value)} autoComplete="off" /></Field>
            <Field label={s.students.relation} htmlFor="st-rel"><SimpleSelect id="st-rel" value={f.relation} onChange={set('relation')} options={rels} label={s.students.relation} /></Field>
          </div>
          <Field label={s.students.phone} htmlFor="st-phone" hint={s.students.phoneHint}><Input id="st-phone" type="tel" inputMode="tel" dir="ltr" placeholder="07XX XXX XXXX" value={f.phone} onChange={(e) => set('phone')(e.target.value)} /></Field>
        </fieldset>
        <Field label={s.students.health} htmlFor="st-health" hint={s.students.healthHint}><Input id="st-health" value={f.health} onChange={(e) => set('health')(e.target.value)} /></Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
