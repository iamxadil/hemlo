// The chart: the mouth drawn as it is, and a tooth inspector beside it. Tap a tooth (or drag across several) and
// the inspector shows it large, with its story; tap what you found, tap the surfaces on the big tooth, record it.
// On phones the inspector rises from the bottom.
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Icon, Sheet } from '../components/ui';
import { useD } from './i18n';
import { isChild, type Finding } from './data';
import { Odontogram, ToothPortrait, KindGlyph, CHART_COLORS, toothNameParts } from './Odontogram';
import { PlanBuilder } from './PlansTab';
import { SlideSeg } from './ui';

const KINDS = ['caries', 'filling', 'crown', 'rct', 'extraction', 'missing', 'implant', 'bridge', 'veneer', 'post', 'sealant', 'pulpotomy', 'fracture', 'impacted', 'mobility', 'watch'];
const SURFACE_KINDS = ['caries', 'filling', 'sealant', 'fracture'];

export function useToothName() {
  const { d } = useD();
  return (t: number) => {
    const p = toothNameParts(t);
    const name = (p.primary ? d.chart.primaryNames : d.chart.names)[p.pos - 1] ?? '';
    return d.chart.nameFmt.replace('{name}', name).replace('{jaw}', p.upper ? d.chart.upper : d.chart.lower).replace('{side}', p.right ? d.chart.right : d.chart.left);
  };
}
function useWide() {
  const q = '(min-width: 1100px)';
  const [wide, setWide] = useState(() => matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q); const on = () => setWide(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return wide;
}

export function ChartTab({ patient }: { patient: any }) {
  const { d, can, toast, err, num } = useD();
  const qc = useQueryClient();
  const name = useToothName();
  const wide = useWide();
  const q = useQuery({ queryKey: ['dent-chart', patient.id], queryFn: () => api(`/v1/dent/patients/${patient.id}/chart`) });
  const [child, setChild] = useState(isChild(patient.birthDate));
  const [sel, setSel] = useState<number[]>([]);
  const [surf, setSurf] = useState('');
  const [kind, setKind] = useState('caries');
  const [status, setStatus] = useState<'existing' | 'planned'>('existing');
  const [planning, setPlanning] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const write = can('clinical.write');
  const findings: Finding[] = q.data?.findings ?? [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ['dent-chart', patient.id] }); qc.invalidateQueries({ queryKey: ['dent-plans', patient.id] }); };
  const add = useMutation({
    mutationFn: () => api(`/v1/dent/patients/${patient.id}/findings`, { body: { teeth: sel, kind, status, surfaces: SURFACE_KINDS.includes(kind) ? surf || null : null } }),
    onSuccess: () => { refresh(); setSurf(''); toast(`${d.chart.kinds[kind]} · ${sel.join(', ')}`); if (!wide) setSheet(false); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/v1/dent/findings/${id}`, { method: 'DELETE' }), onSuccess: refresh, onError: (e) => toast(err(e), 'bad') });
  const toggleTooth = (t: number) => { setSel((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t])); };
  const toggleSurface = (s: string) => setSurf((x) => (x.includes(s) ? x.replace(s, '') : x + s));
  const clear = () => { setSel([]); setSurf(''); setSheet(false); };
  useEffect(() => { if (sel.length !== 1) setSurf((s) => (sel.length ? s : '')); }, [sel.length]);
  const counts = useMemo(() => ({ e: findings.filter((f) => f.status === 'existing').length, p: findings.filter((f) => f.status === 'planned').length, dn: findings.filter((f) => f.status === 'done').length }), [findings]);
  const readout = hover ?? (sel.length === 1 ? sel[0] : null);

  const inspector = sel.length > 0 && (
    <Inspector patientFindings={findings} sel={sel} surf={surf} onSurface={write ? toggleSurface : undefined} kind={kind} setKind={setKind} status={status} setStatus={setStatus}
      write={write} adding={add.isPending} onAdd={() => add.mutate()} onPlan={() => setPlanning(true)} onRemove={(id) => remove.mutate(id)} onDrop={(t) => toggleTooth(t)} onClear={clear} />
  );

  return (
    <div className="studio">
      <section className="studio-stage">
        <header className="studio-bar">
          <SlideSeg value={child ? 'child' : 'adult'} options={[['adult', d.chart.adult], ['child', d.chart.child]]} onChange={(v) => { setChild(v === 'child'); clear(); }} />
          <p className="studio-readout" aria-live="polite">{readout ? <><b dir="ltr">{readout}</b>{name(readout)}</> : <span className="muted">{d.chart.dragHint}</span>}</p>
          <span className="legend">
            {(['existing', 'planned', 'done'] as const).map((k) => <span key={k}><i style={{ background: CHART_COLORS[k] }} />{d.chart[k]}</span>)}
            <span><i style={{ background: CHART_COLORS.caries }} />{d.chart.kinds.caries}</span>
          </span>
        </header>
        {q.isLoading ? <div className="skeleton h-80" /> : (
          <Odontogram findings={findings} child={child} selected={sel} surfaces={surf} onTooth={toggleTooth} onSurface={write ? toggleSurface : undefined} onHover={setHover} />
        )}
        <footer className="studio-foot"><span>← {d.chart.patientRight}</span><span className="sub">{d.chart.summary.replace('{e}', num(counts.e)).replace('{p}', num(counts.p)).replace('{d}', num(counts.dn))}</span><span>{d.chart.patientLeft} →</span></footer>
      </section>

      <aside className="studio-side">
        {wide && inspector}
        {(!wide || !sel.length) && <History findings={findings} onPick={(t) => { setSel([t]); if (!wide) setSheet(true); }} name={name} />}
      </aside>

      {!wide && sel.length > 0 && (
        <div className="studio-dock">
          <span className="min-w-0 flex-1 truncate"><b dir="ltr">{sel.join(', ')}</b> {sel.length === 1 ? name(sel[0]) : d.chart.teethN.replace('{n}', num(sel.length))}</span>
          <button className="icon-btn" onClick={clear} aria-label={d.chart.clear}><Icon n="close" /></button>
          <button className="btn btn-accent btn-sm" onClick={() => setSheet(true)}>{write ? d.chart.add : d.chart.onTooth}</button>
        </div>
      )}
      {!wide && sheet && sel.length > 0 && <Sheet title={sel.length === 1 ? d.chart.tooth.replace('{n}', String(sel[0])) : d.chart.teethN.replace('{n}', num(sel.length))} sub={sel.length === 1 ? name(sel[0]) : sel.join(', ')} onClose={() => setSheet(false)}>{inspector}</Sheet>}
      {planning && <PlanBuilder patient={patient} teeth={sel} surfaces={surf} onClose={() => { setPlanning(false); clear(); refresh(); }} />}
    </div>
  );
}

function Inspector({ patientFindings, sel, surf, onSurface, kind, setKind, status, setStatus, write, adding, onAdd, onPlan, onRemove, onDrop, onClear }: {
  patientFindings: Finding[]; sel: number[]; surf: string; onSurface?: (s: string) => void; kind: string; setKind(k: string): void; status: 'existing' | 'planned'; setStatus(s: 'existing' | 'planned'): void;
  write: boolean; adding: boolean; onAdd(): void; onPlan(): void; onRemove(id: string): void; onDrop(t: number): void; onClear(): void;
}) {
  const { d, date } = useD();
  const name = useToothName();
  const one = sel.length === 1 ? sel[0] : null;
  const mine = patientFindings.filter((f) => sel.includes(f.tooth)).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const surfKind = SURFACE_KINDS.includes(kind);
  return (
    <div className="inspector">
      <div className="insp-head">
        {one ? <span className="insp-num" dir="ltr">{one}</span> : <span className="insp-num many">{sel.length}</span>}
        <div className="min-w-0 flex-1">
          <b className="block truncate">{one ? name(one) : d.chart.teethN.replace('{n}', String(sel.length))}</b>
          {!one && <span className="insp-chips">{sel.map((t) => <button key={t} className="chip" onClick={() => onDrop(t)} dir="ltr">{t} ×</button>)}</span>}
        </div>
        <button className="icon-btn" onClick={onClear} aria-label={d.chart.clear}><Icon n="close" /></button>
      </div>
      {one && (
        <div className="insp-figure">
          <ToothPortrait t={one} findings={patientFindings.filter((f) => f.tooth === one)} surfaces={surf} onSurface={write && surfKind ? onSurface : undefined} />
          {write && surfKind && <p className="insp-tip"><Icon n="sparkle" className="h-4 w-4" />{d.chart.pickSurfaces}{surf && <b dir="ltr"> · {surf}</b>}</p>}
        </div>
      )}
      {write && (
        <>
          <p className="sec-t !mb-0">{one ? d.chart.record : d.chart.recordMany.replace('{n}', String(sel.length))}</p>
          <div className="insp-kinds">
            {KINDS.map((k) => (
              <button key={k} className="insp-kind" aria-pressed={kind === k} onClick={() => setKind(k)}>
                <KindGlyph kind={k} status={status === 'planned' ? 'planned' : 'existing'} /><span>{d.chart.kinds[k]}</span>
              </button>
            ))}
          </div>
          <div className="insp-row">
            <div className="seg">{(['existing', 'planned'] as const).map((s) => <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}><i className="insp-dot" style={{ background: CHART_COLORS[s] }} />{d.chart[s]}</button>)}</div>
          </div>
          <div className="insp-actions">
            <button className="btn btn-accent justify-center" disabled={adding} onClick={onAdd}>{adding ? <span className="spinner" /> : <Icon n="plus" className="h-4 w-4" />}{d.chart.add}: {d.chart.kinds[kind]}{surfKind && surf ? ` · ${surf}` : ''}</button>
            <button className="btn btn-secondary justify-center" onClick={onPlan}><Icon n="clip" className="h-4 w-4" />{d.chart.addPlan}</button>
          </div>
        </>
      )}
      <div>
        <p className="sec-t">{d.chart.onTooth}</p>
        {!mine.length ? <p className="sub">{d.chart.nothing}</p> : (
          <ul className="insp-list">
            {mine.map((f) => (
              <li key={f.id}>
                <span className="insp-mini"><KindGlyph kind={f.kind} status={f.status} /></span>
                <span className="min-w-0 flex-1"><b>{d.chart.kinds[f.kind] ?? f.kind}</b>{f.surfaces ? <span className="sub" dir="ltr"> · {f.surfaces}</span> : null}{!one && <span className="sub" dir="ltr"> · {f.tooth}</span>}<span className="sub block">{date(f.createdAt)}</span></span>
                <span className="pill" style={{ color: CHART_COLORS[f.status], background: `color-mix(in oklab, ${CHART_COLORS[f.status]} 12%, transparent)` }}>{d.chart[f.status]}</span>
                {write && !f.planItemId && <button className="icon-btn" aria-label={d.chart.remove} onClick={() => onRemove(f.id)}><Icon n="trash" /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Everything on the chart, tooth by tooth; tap a tooth to open it. */
function History({ findings, onPick, name }: { findings: Finding[]; onPick(t: number): void; name(t: number): string }) {
  const { d } = useD();
  const teeth = [...new Set(findings.map((f) => f.tooth))].sort((a, b) => a - b);
  return (
    <section className="panel">
      <div className="panel-h"><h2>{d.chart.history}</h2></div>
      {!teeth.length ? <p className="sub px-5 pb-5">{d.chart.none}</p> : (
        <ul className="rows">
          {teeth.map((t) => (
            <li key={t}>
              <button className="row w-full text-start" onClick={() => onPick(t)}>
                <span className="insp-num sm" dir="ltr">{t}</span>
                <span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{name(t)}</b>
                  <span className="hist-kinds">{findings.filter((f) => f.tooth === t).map((f) => <span key={f.id} className="hist-k" style={{ ['--k' as any]: CHART_COLORS[f.status] }}>{d.chart.kinds[f.kind] ?? f.kind}{f.surfaces ? ` ${f.surfaces}` : ''}</span>)}</span>
                </span>
                <Icon n="arrow" className="h-4 w-4 muted rtl:-scale-x-100" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
