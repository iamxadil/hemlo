// The school's set-up: its details and the messages parents receive, the grades with their sections this year (and each
// section's homeroom teacher), and the school year (start the next one: sections and teachers carry over).
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api';
import { rtl } from '../lib/i18n';
import { useS } from './i18n';
import { SIcon, Page, Skel, Sheet, Select, Segmented } from './ui';
import { fill, useSetup } from './data';

export function Setup() {
  const { s, can, num, date, lang } = useS();
  const setup = useSetup();
  const qc = useQueryClient();
  const S = setup.data;
  const [f, setF] = useState({ kind: 'school', city: '', phone: '', whatsapp: '', absent: '', fee: '' });
  const [adding, setAdding] = useState<'grade' | 'year' | null>(null);
  useEffect(() => { if (S) setF({ kind: S.school.kind, city: S.school.city ?? '', phone: S.school.phone ?? '', whatsapp: S.school.whatsapp ?? '', absent: (S.school.absentText as any)?.[lang] ?? '', fee: (S.school.feeText as any)?.[lang] ?? '' }); }, [S, lang]);
  if (!S) return <div className="grid gap-4"><Skel h={220} /><Skel h={320} /></div>;
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
      <section className="sc-card">
        <div className="sc-card-h"><h2>{s.setup.year}</h2>{manage && <button className="sc-btn sc-btn-soft sc-btn-sm" onClick={() => setAdding('year')}><SIcon n="plus" />{s.setup.newYear}</button>}</div>
        <div className="flex flex-wrap gap-2 px-5 pb-5 pt-1">{S.years.map((y) => <span key={y.id} className={`sc-pill ${y.id === S.school.year?.id ? 'accent' : ''}`}>{y.name}{y.id === S.school.year?.id ? ` · ${s.setup.current}` : ''} · {date(y.startsOn)} – {date(y.endsOn)}</span>)}</div>
      </section>

      <section className="sc-card">
        <div className="sc-card-h"><div><h2>{s.setup.grades}</h2><p className="sc-sub mt-0.5">{s.setup.gradesHint}</p></div>{manage && <button className="sc-btn sc-btn-soft sc-btn-sm" onClick={() => setAdding('grade')}><SIcon n="plus" />{s.setup.addGrade}</button>}</div>
        <div className="sc-list">
          {S.grades.filter((g) => g.active).map((g) => {
            const cls = S.classes.filter((c) => c.gradeId === g.id);
            return (
              <div key={g.id} className="sc-row flex-col items-stretch gap-3">
                <div className="flex items-center justify-between gap-3"><span><b>{g.name}</b> <span className="sc-sub">· {s.setup.stages[g.stage] ?? g.stage}</span></span>
                  {manage && <button className="sc-btn sc-btn-ghost sc-btn-sm" onClick={() => addSection(g.id, cls.length)}><SIcon n="plus" />{s.setup.addSection}</button>}</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {cls.map((c) => (
                    <div key={c.id} className="grid gap-2 rounded-2xl border border-[var(--s-line)] bg-[var(--s-bg)] p-3">
                      <div className="flex items-center justify-between"><b className="text-[15px]">{g.name} · {c.name}</b><span className="sc-pill sc-num">{fill(s.setup.students, { n: num(c.students) })}</span></div>
                      {manage ? <Select id={`t-${c.id}`} value={c.teacherMemberId ?? 'none'} onChange={(v) => setTeacher(c.id, v)} label={s.setup.teacher}
                        options={[{ value: 'none', label: s.setup.noTeacher }, ...S.staff.map((m) => ({ value: m.id, label: m.name }))]} />
                        : <span className="sc-sub">{S.staff.find((m) => m.id === c.teacherMemberId)?.name ?? s.setup.noTeacher}</span>}
                      {manage && c.students === 0 && cls.length > 1 && <button className="sc-btn sc-btn-ghost sc-btn-sm justify-self-start text-[var(--s-absent)]" onClick={() => removeSection(c.id)}><SIcon n="trash" />{s.setup.remove}</button>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sc-card grid gap-4 p-5">
        <h2 className="sc-h2">{s.setup.details}</h2>
        <div className="sc-field"><span>{s.setup.kind}</span><Segmented label={s.setup.kind} value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={['school', 'institute', 'kindergarten'].map((v) => ({ value: v, label: s.kinds[v] }))} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="sc-field"><span>{s.setup.city}</span><input id="set-city" className="sc-input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} disabled={!manage} /></label>
          <label className="sc-field"><span>{s.setup.phone}</span><input id="set-phone" className="sc-input" dir="ltr" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} disabled={!manage} /></label>
          <label className="sc-field"><span>{s.setup.whatsapp}</span><input id="set-wa" className="sc-input" dir="ltr" type="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} disabled={!manage} /></label>
        </div>
        <h3 className="sc-h2 mt-2">{s.setup.messages}</h3>
        <label className="sc-field"><span>{s.setup.absentText}</span><textarea id="set-absent" className="sc-input" value={f.absent} placeholder={s.roll.absentMsg} onChange={(e) => setF({ ...f, absent: e.target.value })} disabled={!manage} /></label>
        <label className="sc-field"><span>{s.setup.feeText}</span><textarea id="set-fee" className="sc-input" value={f.fee} placeholder={s.fees.remindMsg} onChange={(e) => setF({ ...f, fee: e.target.value })} disabled={!manage} /><small>{s.setup.placeholders}</small></label>
        {manage && <button className="sc-btn sc-btn-primary justify-self-start" onClick={saveDetails}>{s.setup.save}</button>}
      </section>

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
    <Sheet open={open} onClose={onClose} title={s.setup.addGrade} rtl={rtl(lang)} footer={<button className="sc-btn sc-btn-primary sc-btn-block" onClick={save} disabled={!name.trim()}>{s.setup.addGrade}</button>}>
      <label className="sc-field"><span>{s.setup.gradeName}</span><input id="gr-name" className="sc-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <div className="sc-field"><span>{s.setup.kind}</span><Select id="gr-stage" value={stage} onChange={setStage} options={Object.entries(s.setup.stages).map(([value, label]) => ({ value, label }))} /></div>
    </Sheet>
  );
}

function YearSheet({ open, onClose, onDone }: { open: boolean; onClose(): void; onDone(): void }) {
  const { s, lang } = useS();
  const setup = useSetup();
  const next = Number(setup.data?.school.year?.endsOn.slice(0, 4) ?? new Date().getFullYear());
  const [starts, setStarts] = useState(`${next}-09-21`), [ends, setEnds] = useState(`${next + 1}-06-30`);
  const save = async () => {
    try { await api('/v1/sch/years', { body: { startsOn: starts, endsOn: ends } }); onDone(); onClose(); }
    catch (e) { toast.error(e instanceof ApiError ? s.errors[e.code] ?? e.code : String(e)); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={s.setup.newYear} sub={s.setup.newYearHint} rtl={rtl(lang)} footer={<button className="sc-btn sc-btn-primary sc-btn-block" onClick={save}>{s.setup.startYear}</button>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="sc-field"><span>{s.setup.starts}</span><input id="yr-start" className="sc-input" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></label>
        <label className="sc-field"><span>{s.setup.ends}</span><input id="yr-end" className="sc-input" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></label>
      </div>
    </Sheet>
  );
}
