// Lab work: every open order (late ones in red), one tap to move it along, and a new order in a few taps.
// The same list shows inside a patient's file, for that patient.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DinarInput, Empty, Icon, Money, Sheet } from '../components/ui';
import { useD } from './i18n';
import { useSetup, type PatientCard } from './data';
import { PatientPicker } from './Patients';

const NEXT: Record<string, string> = { sent: 'received', in_progress: 'received', remake: 'received', received: 'fitted' };

export function Lab() {
  return <LabOrders />;
}

export function LabOrders({ patient }: { patient?: any }) {
  const { d, can, toast, err, date } = useD();
  const qc = useQueryClient();
  const [which, setWhich] = useState<'open' | 'all'>('open');
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['dent-lab', which, patient?.id ?? ''], queryFn: async () => (await api(`/v1/dent/lab?status=${patient ? 'all' : which}${patient ? `&patientId=${patient.id}` : ''}`)).orders as any[] });
  const step = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/v1/dent/lab/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dent-lab'] }); qc.invalidateQueries({ queryKey: ['dent-dashboard'] }); },
    onError: (e) => toast(err(e), 'bad'),
  });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!patient && <div className="chips">{(['open', 'all'] as const).map((w) => <button key={w} className="chip" aria-pressed={which === w} onClick={() => setWhich(w)}>{d.lab[w]}</button>)}</div>}
        <span className="flex-1" />
        {can('lab.manage') && <button className="btn btn-accent btn-sm" onClick={() => setAdding(true)}><Icon n="plus" className="h-4 w-4" />{d.lab.new}</button>}
      </div>
      <div className="panel rows overflow-clip">
        {q.isLoading ? <div className="skeleton m-4 h-32" /> : !q.data?.length ? <Empty icon="flask" text={d.lab.empty} /> : q.data.map((o) => (
          <div key={o.id} className={`row${o.overdue ? ' late' : ''}`}>
            <span className="thumb"><Icon n="flask" className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <b className="block truncate font-medium">{o.work}{o.teeth ? <span className="sub" dir="ltr"> · {o.teeth}</span> : ''}{o.shade ? <span className="sub"> · {o.shade}</span> : ''}</b>
              <span className="sub truncate">{!patient && <a href={`#/patient?id=${o.patientId}&tab=lab`} className="underline-offset-2 hover:underline">{o.patientName}</a>}{o.labName ? ` · ${o.labName}` : ''}{o.dueAt ? ` · ${d.lab.due}: ${date(o.dueAt)}` : ''}</span>
            </span>
            {o.overdue && <span className="pill bad">{d.lab.overdue}</span>}
            <span className={`pill lab-${o.status}`}>{d.lab.status[o.status]}</span>
            {o.cost > 0 && <Money v={o.cost} className="hidden text-sm sm:inline" />}
            {can('lab.manage') && NEXT[o.status] && <button className="btn btn-secondary btn-sm" disabled={step.isPending} onClick={() => step.mutate({ id: o.id, status: NEXT[o.status] })}>{d.lab.next[o.status]}</button>}
          </div>
        ))}
      </div>
      {adding && <LabOrderSheet patient={patient} onClose={() => setAdding(false)} />}
    </div>
  );
}

export function LabOrderSheet({ patient, onClose }: { patient?: any; onClose(): void }) {
  const { d, toast, err } = useD();
  const qc = useQueryClient();
  const setup = useSetup();
  const labs = useQuery({ queryKey: ['dent-labs'], queryFn: async () => (await api('/v1/dent/labs')).labs as any[] });
  const [who, setWho] = useState<PatientCard | null>(patient ?? null);
  const [f, setF] = useState({ work: '', teeth: '', shade: '', material: '', labId: '', dentistId: '', due: '', note: '' });
  const [cost, setCost] = useState<number | null>(null);
  const [newLab, setNewLab] = useState('');
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: async () => {
      let labId = f.labId;
      if (labId === 'new' && newLab.trim()) labId = (await api('/v1/dent/labs', { body: { name: newLab.trim() } })).lab.id;
      return api('/v1/dent/lab', { body: { patientId: who!.id, labId: labId && labId !== 'new' ? labId : null, dentistId: f.dentistId || null, work: f.work, teeth: f.teeth || null, shade: f.shade || null,
        material: f.material || null, note: f.note || null, cost: cost ?? 0, dueAt: f.due ? `${f.due}T12:00:00+03:00` : null } });
    },
    onSuccess: () => { ['dent-lab', 'dent-labs', 'dent-dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  return (
    <Sheet title={d.lab.new} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!who || !f.work.trim() || save.isPending} onClick={() => save.mutate()}>{d.lab.save}</button>}>
      {!patient && <PatientPicker value={who} onPick={setWho} />}
      <div className="chips">{d.lab.works.map((w) => <button key={w} type="button" className="chip" aria-pressed={f.work === w} onClick={() => set('work', w)}>{w}</button>)}</div>
      <label className="field">{d.lab.work}<input className="input" value={f.work} onChange={(e) => set('work', e.target.value)} /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="field">{d.lab.teeth}<input className="input" dir="ltr" value={f.teeth} onChange={(e) => set('teeth', e.target.value)} placeholder="36" /></label>
        <label className="field">{d.lab.shade}<input className="input" dir="ltr" list="dent-shades" value={f.shade} onChange={(e) => set('shade', e.target.value)} placeholder="A2" />
          <datalist id="dent-shades">{['A1', 'A2', 'A3', 'A3.5', 'B1', 'B2', 'C1', 'BL1', 'BL2'].map((s) => <option key={s} value={s} />)}</datalist></label>
        <label className="field">{d.lab.due}<input className="input" type="date" dir="ltr" value={f.due} onChange={(e) => set('due', e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.lab.lab}<select className="input" value={f.labId} onChange={(e) => set('labId', e.target.value)}><option value="">—</option>{labs.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}<option value="new">+ {d.lab.newLab}</option></select></label>
        <label className="field">{d.lab.cost}<DinarInput value={cost} onChange={setCost} /></label>
      </div>
      {f.labId === 'new' && <label className="field">{d.lab.labName}<input className="input" autoFocus value={newLab} onChange={(e) => setNewLab(e.target.value)} /></label>}
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{d.visit.dentist}<select className="input" value={f.dentistId} onChange={(e) => set('dentistId', e.target.value)}><option value="">—</option>{setup.data?.dentists.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="field">{d.lab.material}<input className="input" value={f.material} onChange={(e) => set('material', e.target.value)} /></label>
      </div>
      <label className="field">{d.visit.notes}<input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></label>
    </Sheet>
  );
}
