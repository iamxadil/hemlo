// The school's set-up: the school year (start the next one: sections and teachers carry over), the grades with their
// sections this year (and each section's homeroom teacher), the school's details and the messages parents receive.
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useS } from './i18n';
import { Badge, Button, Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Page, Row, Sheet, SimpleSelect, Skeleton, Textarea, ToggleGroup, ToggleGroupItem } from './ui';
import { fill, useSetup } from './data';

export function Setup() {
  const { s, can, num, date, lang } = useS();
  const setup = useSetup();
  const qc = useQueryClient();
  const S = setup.data;
  const [f, setF] = useState({ kind: 'school', city: '', phone: '', whatsapp: '', absent: '', fee: '' });
  const [adding, setAdding] = useState<'grade' | 'year' | null>(null);
  useEffect(() => { if (S) setF({ kind: S.school.kind, city: S.school.city ?? '', phone: S.school.phone ?? '', whatsapp: S.school.whatsapp ?? '', absent: (S.school.absentText as any)?.[lang] ?? '', fee: (S.school.feeText as any)?.[lang] ?? '' }); }, [S, lang]);
  if (!S) return <div className="grid gap-4"><Skeleton className="h-55" /><Skeleton className="h-80" /></div>;
  const err = (e: unknown) => toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e));
  const refresh = () => qc.invalidateQueries({ queryKey: ['sch-setup'] });
  const saveDetails = async () => {
    try {
      await api('/v1/sch/settings', { method: 'PUT', body: { kind: f.kind, city: f.city, phone: f.phone || null, whatsapp: f.whatsapp || null,
        absentText: { ...(S.school.absentText ?? {}), [lang]: f.absent || undefined }, feeText: { ...(S.school.feeText ?? {}), [lang]: f.fee || undefined } } });
      toast.success(s.setup.saved); refresh();
    } catch (e) { err(e); }
  };
  const addSection = async (gradeId: string, count: number) => {
    const letters = lang === 'en' ? 'ABCDEFGH' : 'أبجدهوزح';
    try { await api('/v1/sch/classes', { body: { gradeId, name: letters[count] ?? String(count + 1) } }); refresh(); } catch (e) { err(e); }
  };
  const removeSection = async (id: string) => { try { await api(`/v1/sch/classes/${id}`, { method: 'DELETE' }); refresh(); } catch (e) { err(e); } };
  const setTeacher = async (id: string, teacherMemberId: string) => { try { await api(`/v1/sch/classes/${id}`, { method: 'PATCH', body: { teacherMemberId: teacherMemberId === 'none' ? null : teacherMemberId } }); refresh(); } catch (e) { err(e); } };
  const manage = can('school.configure');
  return (
    <Page>
      <Card>
        <CardHeader><CardTitle>{s.setup.year}</CardTitle>{manage && <CardAction><Button variant="secondary" size="sm" onClick={() => setAdding('year')}><Plus />{s.setup.newYear}</Button></CardAction>}</CardHeader>
        <CardContent className="flex flex-wrap gap-2">{S.years.map((y) => <Badge key={y.id} variant={y.id === S.school.year?.id ? 'default' : 'secondary'} className="h-7"><bdi>{y.name}</bdi>{y.id === S.school.year?.id ? ` · ${s.setup.current}` : ''} · {date(y.startsOn)} – {date(y.endsOn)}</Badge>)}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{s.setup.grades}</CardTitle><CardDescription>{s.setup.gradesHint}</CardDescription>{manage && <CardAction><Button variant="secondary" size="sm" onClick={() => setAdding('grade')}><Plus />{s.setup.addGrade}</Button></CardAction>}</CardHeader>
        <div className="pb-1">
          {S.grades.filter((g) => g.active).map((g) => {
            const cls = S.classes.filter((c) => c.gradeId === g.id);
            return (
              <Row key={g.id} className="flex-col items-stretch gap-3">
                <div className="flex items-center justify-between gap-3"><span><b className="font-medium">{g.name}</b> <span className="text-muted-foreground text-[13px]">· {s.setup.stages[g.stage] ?? g.stage}</span></span>
                  {manage && <Button variant="ghost" size="sm" onClick={() => addSection(g.id, cls.length)}><Plus />{s.setup.addSection}</Button>}</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {cls.map((c) => (
                    <div key={c.id} className="bg-background grid gap-2 rounded-2xl border border-border p-3">
                      <div className="flex items-center justify-between"><b className="text-[15px]">{g.name} · {c.name}</b><Badge variant="secondary" className="tabular-nums">{fill(s.setup.students, { n: num(c.students) })}</Badge></div>
                      {manage ? <SimpleSelect id={`t-${c.id}`} value={c.teacherMemberId ?? 'none'} onChange={(v) => setTeacher(c.id, v)} label={s.setup.teacher}
                        options={[{ value: 'none', label: s.setup.noTeacher }, ...S.staff.map((m) => ({ value: m.id, label: m.name }))]} />
                        : <span className="text-muted-foreground text-[13px]">{S.staff.find((m) => m.id === c.teacherMemberId)?.name ?? s.setup.noTeacher}</span>}
                      {manage && c.students === 0 && cls.length > 1 && <Button variant="ghost" size="sm" className="text-destructive justify-self-start" onClick={() => removeSection(c.id)}><Trash2 />{s.setup.remove}</Button>}
                    </div>
                  ))}
                </div>
              </Row>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>{s.setup.details}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label={s.setup.kind}><ToggleGroup value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })} aria-label={s.setup.kind} className="w-fit" disabled={!manage}>{['school', 'institute', 'kindergarten'].map((v) => <ToggleGroupItem key={v} value={v}>{s.kinds[v]}</ToggleGroupItem>)}</ToggleGroup></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={s.setup.city} htmlFor="set-city"><Input id="set-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} disabled={!manage} /></Field>
            <Field label={s.setup.phone} htmlFor="set-phone"><Input id="set-phone" dir="ltr" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} disabled={!manage} /></Field>
            <Field label={s.setup.whatsapp} htmlFor="set-wa"><Input id="set-wa" dir="ltr" type="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} disabled={!manage} /></Field>
          </div>
          <h3 className="mt-2 text-[15.5px] font-semibold">{s.setup.messages}</h3>
          <Field label={s.setup.absentText} htmlFor="set-absent"><Textarea id="set-absent" value={f.absent} placeholder={s.roll.absentMsg} onChange={(e) => setF({ ...f, absent: e.target.value })} disabled={!manage} /></Field>
          <Field label={s.setup.feeText} htmlFor="set-fee" hint={s.setup.placeholders}><Textarea id="set-fee" value={f.fee} placeholder={s.fees.remindMsg} onChange={(e) => setF({ ...f, fee: e.target.value })} disabled={!manage} /></Field>
          {manage && <Button className="justify-self-start" onClick={saveDetails}>{s.setup.save}</Button>}
        </CardContent>
      </Card>

      <GradeSheet open={adding === 'grade'} onClose={() => setAdding(null)} onDone={refresh} />
      <YearSheet open={adding === 'year'} onClose={() => setAdding(null)} onDone={refresh} />
    </Page>
  );
}

function GradeSheet({ open, onClose, onDone }: { open: boolean; onClose(): void; onDone(): void }) {
  const { s, lang } = useS();
  const [name, setName] = useState(''), [stage, setStage] = useState('primary');
  const save = async () => {
    try { await api('/v1/sch/grades', { body: { name, stage, lang } }); setName(''); onDone(); onClose(); }
    catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.setup.addGrade} footer={<Button size="lg" onClick={save} disabled={!name.trim()}>{s.setup.addGrade}</Button>}>
      <Field label={s.setup.gradeName} htmlFor="gr-name"><Input id="gr-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label={s.setup.kind} htmlFor="gr-stage"><SimpleSelect id="gr-stage" value={stage} onChange={setStage} options={Object.entries(s.setup.stages).map(([value, label]) => ({ value, label }))} /></Field>
    </Sheet>
  );
}

function YearSheet({ open, onClose, onDone }: { open: boolean; onClose(): void; onDone(): void }) {
  const { s } = useS();
  const setup = useSetup();
  const next = Number(setup.data?.school.year?.endsOn.slice(0, 4) ?? new Date().getFullYear());
  const [starts, setStarts] = useState(`${next}-09-21`), [ends, setEnds] = useState(`${next + 1}-06-30`);
  const save = async () => {
    try { await api('/v1/sch/years', { body: { startsOn: starts, endsOn: ends } }); onDone(); onClose(); }
    catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.setup.newYear} description={s.setup.newYearHint} footer={<Button size="lg" onClick={save}>{s.setup.startYear}</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={s.setup.starts} htmlFor="yr-start"><Input id="yr-start" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></Field>
        <Field label={s.setup.ends} htmlFor="yr-end"><Input id="yr-end" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}
