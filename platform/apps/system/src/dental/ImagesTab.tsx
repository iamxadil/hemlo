// X-rays and photos on the file: uploaded from the phone or the X-ray computer, described (type, teeth), and read in a
// viewer with zoom, brightness, contrast and invert. Links last about an hour: they're medical.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, upload } from '../lib/api';
import { prepareImage } from '../lib/images';
import { Empty, Icon, Sheet } from '../components/ui';
import { useD } from './i18n';

const KINDS = ['periapical', 'bitewing', 'panoramic', 'cephalometric', 'cbct', 'photo', 'document'];
type Img = { id: string; url: string; width: number | null; height: number | null; kind: string; teeth: number[]; takenAt: string; note: string | null };

export function ImagesTab({ patient }: { patient: any }) {
  const { d, can, toast, err, date } = useD();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['dent-images', patient.id], queryFn: async () => (await api(`/v1/dent/patients/${patient.id}/images`)).images as Img[], staleTime: 30 * 60_000 });
  const [busy, setBusy] = useState(0);
  const [describe, setDescribe] = useState<Img | null>(null);
  const [view, setView] = useState<Img | null>(null);
  const [filter, setFilter] = useState('all');
  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.onchange = async () => {
      for (const file of [...(input.files ?? [])]) {
        setBusy((n) => n + 1);
        try {
          const img = await prepareImage(file, { max: 2400, quality: 0.9 });
          const f = await upload('clinical', img, patient.id);
          const kind = img.width / img.height > 1.8 ? 'panoramic' : /photo|img|dsc/i.test(file.name) ? 'photo' : 'periapical';
          await api(`/v1/dent/images/${f.id}`, { method: 'PUT', body: { kind, teeth: [] } });
        } catch (e) { toast(err(e), 'bad'); } finally { setBusy((n) => n - 1); }
      }
      qc.invalidateQueries({ queryKey: ['dent-images', patient.id] });
    };
    input.click();
  };
  const list = (q.data ?? []).filter((x) => filter === 'all' || x.kind === filter);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {can('clinical.write') && <button className="btn btn-accent btn-sm" onClick={pick} disabled={busy > 0}>{busy ? <span className="spinner" /> : <Icon n="upload" className="h-4 w-4" />}{d.images.upload}</button>}
        <div className="chips">{['all', ...KINDS.filter((k) => q.data?.some((x) => x.kind === k))].map((k) => <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{k === 'all' ? d.common.all : d.images.kinds[k]}</button>)}</div>
      </div>
      {q.isLoading ? <div className="skeleton h-40" /> : !list.length ? <div className="panel"><Empty icon="image" text={d.images.empty} /></div> : (
        <div className="xray-grid">
          {list.map((x) => (
            <figure key={x.id} className={`xray k-${x.kind}`}>
              <button className="xray-img" onClick={() => setView(x)}><img src={x.url} alt="" loading="lazy" /></button>
              <figcaption><b>{d.images.kinds[x.kind]}</b>{x.teeth.length > 0 && <span dir="ltr"> · {x.teeth.join(', ')}</span>}<span className="sub block">{date(x.takenAt)}</span></figcaption>
              {can('clinical.write') && <button className="icon-btn xray-edit" onClick={() => setDescribe(x)} aria-label={d.common.edit}><Icon n="edit" /></button>}
            </figure>
          ))}
        </div>
      )}
      {describe && <Describe img={describe} patient={patient} onClose={() => setDescribe(null)} />}
      {view && <Viewer img={view} onClose={() => setView(null)} />}
    </div>
  );
}

function Describe({ img, patient, onClose }: { img: Img; patient: any; onClose(): void }) {
  const { d, toast, err } = useD();
  const qc = useQueryClient();
  const [kind, setKind] = useState(img.kind);
  const [teeth, setTeeth] = useState(img.teeth.join(' '));
  const [note, setNote] = useState(img.note ?? '');
  const save = useMutation({
    mutationFn: () => api(`/v1/dent/images/${img.id}`, { method: 'PUT', body: { kind, note: note || null, teeth: teeth.split(/[\s,،]+/).filter(Boolean).map(Number) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dent-images', patient.id] }); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  return (
    <Sheet center title={d.images.kinds[img.kind]} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={save.isPending} onClick={() => save.mutate()}>{d.images.save}</button>}>
      <img src={img.url} alt="" className="max-h-56 w-full rounded-xl bg-black object-contain" />
      <div className="chips">{KINDS.map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{d.images.kinds[k]}</button>)}</div>
      <label className="field">{d.images.teeth}<input className="input" dir="ltr" placeholder="36 37" value={teeth} onChange={(e) => setTeeth(e.target.value)} /></label>
      <label className="field">{d.images.note}<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
    </Sheet>
  );
}

/** Read an X-ray: pinch or wheel to zoom, drag to move, brightness, contrast, invert. */
function Viewer({ img, onClose }: { img: Img; onClose(): void }) {
  const { d } = useD();
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [b, setB] = useState(100);
  const [c, setC] = useState(100);
  const [inv, setInv] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const reset = () => { setZ(1); setPos({ x: 0, y: 0 }); setB(100); setC(100); setInv(false); };
  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true">
      <div className="viewer-stage" onWheel={(e) => setZ((v) => Math.min(8, Math.max(1, v * (e.deltaY < 0 ? 1.15 : 0.87))))}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) setPos({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }} onDoubleClick={() => setZ((v) => (v > 1 ? 1 : 2.5))}>
        <img src={img.url} alt="" draggable={false} style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${z})`, filter: `brightness(${b}%) contrast(${c}%)${inv ? ' invert(1)' : ''}` }} />
      </div>
      <div className="viewer-bar">
        <label>{d.images.brightness}<input type="range" min={40} max={200} value={b} onChange={(e) => setB(Number(e.target.value))} /></label>
        <label>{d.images.contrast}<input type="range" min={40} max={250} value={c} onChange={(e) => setC(Number(e.target.value))} /></label>
        <label>{d.images.zoom}<input type="range" min={1} max={8} step={0.1} value={z} onChange={(e) => setZ(Number(e.target.value))} /></label>
        <button className="chip" aria-pressed={inv} onClick={() => setInv(!inv)}>{d.images.invert}</button>
        <button className="chip" onClick={reset}>{d.images.reset}</button>
        <span className="flex-1" />
        <b>{d.images.kinds[img.kind]}{img.teeth.length ? ` · ${img.teeth.join(', ')}` : ''}</b>
        <button className="icon-btn" onClick={onClose} aria-label={d.common.close}><Icon n="close" /></button>
      </div>
    </div>,
    document.body,
  );
}
