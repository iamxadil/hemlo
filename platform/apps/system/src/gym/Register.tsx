// Photograph the register: the notebook at the desk goes into Hemlo a page at a time, with no typing. Hemlo AI reads the
// photo (one action a page); the desk checks every row (anything doubtful is marked); then the rows go through the ordinary
// member import, which finds people already in the gym and never adds a membership twice.
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { prepareImage } from '../lib/images';
import { Icon, Sheet, toLatin } from '../components/ui';
import { useAi } from '../components/Ai';
import { useG } from './i18n';
import { useSetup, fmt } from './data';

type Check = 'name' | 'phone' | 'plan' | 'date';
type Row = { key: number; name: string; phone: string; plan: string; planId: string | null; startsOn: string; endsOn: string; balance: number; notes: string; check: Check[] };
type Read = { rows: Omit<Row, 'key'>[]; page?: any[]; used: number; allowance: number };
const toDataUrl = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextKey = 1;

/** Is the register reader available here? (AI on, and a way to read: a real engine, or the demo's sample) */
export function useCanReadRegister() {
  const { can } = useG();
  const ai = useAi();
  return can('members.create') && !!ai.data && !ai.data.off && (!!ai.data.available || ai.data.demo);
}

export function RegisterScan({ onClose }: { onClose(): void }) {
  const { g, t, num } = useG();
  const R = g.register;
  const qc = useQueryClient();
  const ai = useAi();
  const setup = useSetup();
  const plans = (setup.data?.plans ?? []).filter((p: any) => p.active !== false);
  const [stage, setStage] = useState<'start' | 'reading' | 'review' | 'saving' | 'done'>('start');
  const [rows, setRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; memberships: number; why: string } | null>(null);
  const camera = useRef<HTMLInputElement>(null), gallery = useRef<HTMLInputElement>(null);
  const s = ai.data;

  const errText = (e: unknown) => (e instanceof ApiError ? t.ai.errors[e.code] ?? g.errors[e.code] ?? t.errors.generic : t.errors.generic);
  const take = (read: Read) => {
    const got = read.rows.map((r) => ({ ...r, key: nextKey++ }));
    setRows((x) => [...x, ...got]);
    qc.invalidateQueries({ queryKey: ['ai'] });
    if (!got.length) { setError(R.none); setStage(rows.length ? 'review' : 'start'); } else setStage('review');
  };
  const fromPhoto = async (file: File) => {
    setError(''); setSample(false);
    try {
      const img = await prepareImage(file, { max: 2000, quality: 0.85 }); // handwriting needs the detail
      const url = await toDataUrl(img.blob);
      setPreview(url); setStage('reading');
      take(await api<Read>('/v1/sys/ai/members', { body: { image: url } }));
    } catch (e) { setError(errText(e)); setStage(rows.length ? 'review' : 'start'); }
  };
  const trySample = async () => {
    setError(''); setSample(true); setStage('reading'); setPreview(null);
    try {
      const [{ drawSamplePage }, read] = await Promise.all([import('./sample-page'), api<Read>('/v1/sys/ai/members', { body: { sample: true } })]);
      setPreview(await drawSamplePage(read.page ?? [], R.pageTitle, R.cols));
      await wait(1800);
      take(read);
    } catch (e) { setError(errText(e)); setStage('start'); }
  };
  const edit = (key: number, patch: Partial<Row>, clears?: Check) => setRows((xs) => xs.map((r) => (r.key === key ? { ...r, ...patch, check: clears ? r.check.filter((c) => c !== clears) : r.check } : r)));
  const save = async () => {
    setStage('saving'); setError('');
    try {
      const keep = rows.filter((r) => r.name.trim());
      const body = keep.map((r) => ({ name: r.name.trim(), phone: r.phone || undefined, plan: r.plan || undefined, startsOn: r.endsOn ? r.startsOn || undefined : undefined,
        endsOn: r.endsOn || undefined, balance: r.balance || undefined, notes: r.notes || undefined }));
      const out = await api<{ created: number; updated: number; memberships: number; errors: { row: number; code: string }[] }>('/v1/gym/members/import', { body: { rows: body, planName: g.importPlan } });
      for (const k of ['gym-members', 'gym-today', 'gym-renewals', 'customers']) qc.invalidateQueries({ queryKey: [k] });
      // rows the import couldn't take stay here, marked, to be fixed and added (never dropped without a word)
      const CHECK: Record<string, Check> = { BAD_PHONE: 'phone', BAD_DATE: 'date', NO_END_DATE: 'date', BAD_NAME: 'name', BAD_PLAN: 'plan' };
      const failed = out.errors.map((e) => { const r = keep[e.row]; return r && { ...r, check: [...new Set([...r.check, CHECK[e.code] ?? 'name'])] as Check[] }; }).filter(Boolean) as Row[];
      const why = [...new Set(out.errors.map((e) => t.importer.codes[e.code] ?? g.errors[e.code] ?? e.code))].slice(0, 2).join(' · ');
      setResult({ created: out.created, updated: out.updated, memberships: out.memberships, why });
      setRows(failed); setStage('done');
    } catch (e) { setError(errText(e)); setStage('review'); }
  };

  const inputs = <>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fromPhoto(f); }} />
    <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fromPhoto(f); }} />
  </>;
  const flagged = rows.filter((r) => r.check.length).length;

  // ---- what each stage shows ----
  if (stage === 'done' && result) return (
    <Sheet title={R.title} onClose={onClose} center footer={<div className="grid grid-cols-2 gap-2">
      <button className="btn btn-secondary justify-center" onClick={() => { setResult(null); setRows([]); setStage('start'); }}><Icon n="camera" className="h-4 w-4" />{R.another}</button>
      <a className="btn btn-accent justify-center" href="#/members" onClick={onClose}>{R.view}</a></div>}>
      <div className="gy-reg-done">
        <span className="gy-reg-done-ic"><Icon n="check" /></span>
        <b>{fmt(R.done, { n: num(result.created + result.updated) })}</b>
        <p className="sub">{fmt(R.doneSub, { m: num(result.memberships) })}</p>
        {rows.length > 0 && <div className="gy-reg-left"><Icon n="alert" className="h-4 w-4" /><span className="min-w-0 flex-1">{fmt(R.skipped, { n: num(rows.length), why: result.why })}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setStage('review')}>{R.fix}</button></div>}
      </div>
    </Sheet>
  );

  if (stage === 'review' || stage === 'saving') return (
    <Sheet title={R.title} sub={<span className="inline-flex flex-wrap items-center gap-2"><b>{fmt(R.found, { n: num(rows.length) })}</b>
      {flagged ? <span className="gy-reg-chip warn">{fmt(R.check, { n: num(flagged) })}</span> : <span className="gy-reg-chip ok"><Icon n="check" className="h-3.5 w-3.5" />{R.allGood}</span>}</span>}
      onClose={onClose}
      footer={<div className="grid grid-cols-[auto_1fr] gap-2">
        <button className="btn btn-secondary" onClick={() => camera.current?.click()} disabled={stage === 'saving'} title={R.another}><Icon n="camera" className="h-4 w-4" /><span className="hidden sm:inline">{R.another}</span></button>
        <button className="btn btn-accent justify-center" onClick={save} disabled={stage === 'saving' || !rows.some((r) => r.name.trim())}>
          {stage === 'saving' ? <><span className="spinner" />{R.adding}</> : fmt(R.add, { n: num(rows.filter((r) => r.name.trim()).length) })}</button>
      </div>}>
      {inputs}
      {sample && <p className="note"><Icon n="sparkle" className="h-4 w-4" /><span>{R.sampleNote}</span></p>}
      <p className="sub">{R.hint}</p>
      {error && <p className="ai-err">{error}</p>}
      <div className="gy-reg-list">
        {rows.map((r) => {
          const need = (c: Check) => (r.check.includes(c) ? ' need' : '');
          const known = !!r.planId && plans.some((p: any) => p.id === r.planId);
          return (
            <div key={r.key} className={`gy-reg-row${r.check.length ? ' flagged' : ''}`}>
              <div className="gy-reg-top">
                <span className="gy-reg-av" aria-hidden="true">{r.name.trim().slice(0, 1) || '?'}</span>
                <input className={`input gy-reg-name${need('name')}`} dir="auto" value={r.name} aria-label={R.name} onChange={(e) => edit(r.key, { name: e.target.value }, 'name')} />
                <button className="gy-reg-x" onClick={() => setRows((xs) => xs.filter((x) => x.key !== r.key))} aria-label={R.remove} title={R.remove}><Icon n="close" /></button>
              </div>
              <div className="gy-reg-grid">
                <label className={`gy-reg-f${need('phone')}`}><span>{R.phone}</span>
                  <input className="input" dir="ltr" inputMode="tel" value={r.phone} onChange={(e) => edit(r.key, { phone: toLatin(e.target.value).replace(/[^\d+]/g, '') }, 'phone')} /></label>
                <label className={`gy-reg-f${need('plan')}`}><span>{R.plan}</span>
                  <select className="input" value={known ? r.planId! : r.plan ? '__w' : ''} onChange={(e) => {
                    const p = plans.find((x: any) => x.id === e.target.value);
                    if (p) edit(r.key, { planId: p.id, plan: p.name }, 'plan'); else if (!e.target.value) edit(r.key, { planId: null, plan: '', endsOn: '' }, 'plan');
                  }}>
                    {!known && r.plan && <option value="__w">{fmt(R.asWritten, { p: r.plan })}</option>}
                    <option value="">{R.noPlan}</option>
                    {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></label>
                <label className={`gy-reg-f${need('date')}`}><span>{R.ends}</span>
                  <input className="input" type="date" value={r.endsOn} onChange={(e) => edit(r.key, { endsOn: e.target.value }, 'date')} /></label>
                <label className="gy-reg-f"><span>{R.owes}</span>
                  <input className="input money" dir="ltr" inputMode="numeric" value={r.balance ? new Intl.NumberFormat('en-US').format(r.balance) : ''} placeholder="0"
                    onChange={(e) => edit(r.key, { balance: Number(toLatin(e.target.value).replace(/\D/g, '')) || 0 })} /></label>
              </div>
              {r.notes && <p className="gy-reg-note" dir="auto">{r.notes}</p>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );

  return (
    <Sheet title={R.title} onClose={onClose}>
      {inputs}
      {stage === 'reading' ? (
        <div className="gy-reg-reading" aria-live="polite">
          <span className="gy-reg-shot">{preview ? <img src={preview} alt="" /> : <span className="skeleton h-full w-full" />}<i className="gy-reg-beam" aria-hidden="true" /></span>
          <b>{R.reading}</b><span className="sub">{R.readingSub}</span>
        </div>
      ) : <>
        <div className="gy-reg-hero" aria-hidden="true">
          <span className="gy-reg-paper"><i /><i /><i /><i /><i /><em className="gy-reg-beam" /></span>
          <span className="gy-reg-arrow"><Icon n="arrow" className="rtl:-scale-x-100" /></span>
          <span className="gy-reg-cards"><i /><i /><i /></span>
        </div>
        <p className="gy-reg-lead">{R.lead}</p>
        <ol className="gy-reg-steps">{R.steps.map((x: string, i: number) => <li key={x}><span>{num(i + 1)}</span>{x}</li>)}</ol>
        {error && <p className="ai-err">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn btn-accent justify-center" onClick={() => camera.current?.click()} disabled={!s?.available}><Icon n="camera" className="h-4 w-4" />{R.camera}</button>
          <button className="btn btn-secondary justify-center" onClick={() => gallery.current?.click()} disabled={!s?.available}><Icon n="image" className="h-4 w-4" />{R.gallery}</button>
          {s?.demo && <button className="btn btn-ghost justify-center sm:col-span-2" onClick={trySample}><Icon n="sparkle" className="h-4 w-4" />{R.sample}</button>}
        </div>
        {s && <p className="ai-meter">{t.ai.badge} · {fmt(t.ai.used, { n: num(s.used), m: num(s.allowance) })}</p>}
      </>}
    </Sheet>
  );
}
