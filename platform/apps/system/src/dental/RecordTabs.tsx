// Prescriptions (with an allergy guard and a printed prescription), the gum chart, signed consents (signed with a finger
// on the clinic's tablet), and the patient's lab work.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, upload } from '../lib/api';
import { Empty, Icon, Sheet } from '../components/ui';
import { useD } from './i18n';
import { useSetup, ARCHES, waLink, ageOf } from './data';
import { printDoc, esc } from './print';
import { LabOrders } from './Lab';

// ---------------- prescriptions ----------------
export function RxTab({ patient }: { patient: any }) {
  const { d, can, date } = useD();
  const q = useQuery({ queryKey: ['dent-rx', patient.id], queryFn: async () => (await api(`/v1/dent/patients/${patient.id}/rx`)).rx as any[] });
  const [open, setOpen] = useState(false);
  const print = usePrintRx(patient);
  return (
    <div className="grid gap-4">
      {can('clinical.write') && <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setOpen(true)}><Icon n="pill" className="h-4 w-4" />{d.rx.new}</button>}
      {!q.data?.length ? <div className="panel"><Empty icon="pill" text={d.rx.empty} /></div> : q.data.map((r) => (
        <section key={r.id} className="panel p-5">
          <div className="flex items-center justify-between"><b>{date(r.createdAt)}</b><button className="btn btn-secondary btn-sm" onClick={() => print(r)}><Icon n="print" className="h-4 w-4" />{d.rx.print}</button></div>
          <ul className="mt-2 grid gap-1 text-sm">{r.items.map((i: any, k: number) => <li key={k}><b dir="ltr">{i.drug}</b>{i.dose ? ` · ${i.dose}` : ''}{i.how ? ` · ${i.how}` : ''}{i.days ? ` · ${i.days} ${d.rx.days}` : ''}</li>)}</ul>
          {r.note && <p className="sub mt-1">{r.note}</p>}
        </section>
      ))}
      {open && <RxSheet patient={patient} onClose={() => setOpen(false)} />}
    </div>
  );
}

function usePrintRx(patient: any) {
  const { d, sys, lang, date } = useD();
  const setup = useSetup();
  return (r: any) => {
    const dn = setup.data?.dentists.find((x) => x.id === r.dentistId);
    printDoc({ lang, clinic: sys.business.name, logo: sys.business.logoUrl, header: [dn?.name, setup.data?.settings.rxHeader].filter(Boolean).join('\n'), title: `℞ ${patient.name}`, body: `
      <div class="meta"><span>${esc(d.rx.patient)}: <b>${esc(patient.name)}</b>${patient.birthDate ? ` · ${esc(ageOf(patient.birthDate, d))}` : ''}</span><span>${esc(d.rx.date)}: ${esc(date(r.createdAt))}</span></div>
      <h2>℞</h2><ol class="rx">${r.items.map((i: any) => `<li><b dir="ltr">${esc(i.drug)}</b>${i.dose ? ` — ${esc(i.dose)}` : ''}<br>${esc(i.how ?? '')}${i.days ? ` · ${esc(i.days)} ${esc(d.rx.days)}` : ''}${i.note ? `<br><span class="muted">${esc(i.note)}</span>` : ''}</li>`).join('')}</ol>
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}<div class="sign"><div>${esc(d.rx.signature)}</div></div>` });
  };
}

export function RxSheet({ patient, visitId, onClose }: { patient: any; visitId?: string; onClose(): void }) {
  const { d, toast, err } = useD();
  const qc = useQueryClient();
  const print = usePrintRx(patient);
  const [items, setItems] = useState<{ drug: string; how: string; days: string }[]>([]);
  const [note, setNote] = useState('');
  const penicillin = patient.alerts?.includes('allergy_penicillin');
  const risky = penicillin && items.some((i) => /amoxi|penicil|augmentin|clavul/i.test(i.drug));
  const save = useMutation({
    mutationFn: () => api('/v1/dent/rx', { body: { patientId: patient.id, visitId: visitId ?? null, note: note || null, items: items.map((i) => ({ drug: i.drug, how: i.how || null, days: i.days ? Number(i.days) : null })) } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['dent-rx', patient.id] }); qc.invalidateQueries({ queryKey: ['dent-visits', patient.id] }); print(r.rx); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const text = items.map((i) => `• ${i.drug}${i.how ? ` — ${i.how}` : ''}${i.days ? ` (${i.days} ${d.rx.days})` : ''}`).join('\n');
  return (
    <Sheet title={d.rx.new} sub={patient.name} onClose={onClose}
      footer={<>{risky && <div className="note bad"><Icon n="alert" /><span>{d.rx.allergyWarn}</span></div>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-accent justify-center" disabled={!items.length || save.isPending} onClick={() => save.mutate()}><Icon n="print" className="h-4 w-4" />{d.rx.save}</button>
          {patient.phone && <a className={`btn btn-wa justify-center${!items.length ? ' pointer-events-none opacity-50' : ''}`} href={waLink(patient.phone, `℞\n${text}`)!} target="_blank" rel="noopener"><Icon n="wa" className="h-4 w-4" />{d.rx.whatsapp}</a>}
        </div></>}>
      {penicillin && <div className="note bad"><Icon n="alert" /><span>{d.medical.alerts.allergy_penicillin}</span></div>}
      <p className="sec-t !mb-0">{d.rx.common}</p>
      <div className="chips">{d.rx.drugs.map(([drug, how, days]) => <button key={drug} type="button" className={`chip${penicillin && /amoxi/i.test(drug) ? ' danger' : ''}`} onClick={() => setItems((x) => [...x, { drug, how, days: String(days) }])} dir="ltr">{drug}</button>)}</div>
      {items.map((i, k) => {
        const set = (v: Partial<typeof i>) => setItems((x) => x.map((y, j) => (j === k ? { ...y, ...v } : y)));
        return (
          <div key={k} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-[var(--line)] p-2.5">
            <input className="input font-medium" dir="ltr" value={i.drug} onChange={(e) => set({ drug: e.target.value })} placeholder={d.rx.drug} />
            <button type="button" className="icon-btn" onClick={() => setItems((x) => x.filter((_, j) => j !== k))} aria-label={d.common.delete}><Icon n="trash" /></button>
            <input className="input" value={i.how} onChange={(e) => set({ how: e.target.value })} placeholder={d.rx.how} />
            <input className="input !w-20" dir="ltr" inputMode="numeric" value={i.days} onChange={(e) => set({ days: e.target.value.replace(/\D/g, '') })} placeholder={d.rx.days} />
          </div>
        );
      })}
      <button type="button" className="link-arrow justify-self-start" onClick={() => setItems((x) => [...x, { drug: '', how: '', days: '' }])}>+ {d.rx.add}</button>
      <label className="field">{d.visit.notes}<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
    </Sheet>
  );
}

// ---------------- the gum chart ----------------
export function PerioTab({ patient }: { patient: any }) {
  const { d, can, toast, err, date } = useD();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['dent-perio', patient.id], queryFn: async () => (await api(`/v1/dent/patients/${patient.id}/perio`)).charts as any[] });
  const last = q.data?.[0];
  const [data, setData] = useState<Record<string, { pd: (number | null)[]; bop: boolean[]; mob: number }>>({});
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (last && !editing) setData(last.data); }, [last]); // eslint-disable-line react-hooks/exhaustive-deps
  const teeth = [...ARCHES.adult.upper, ...ARCHES.adult.lower];
  const cell = (t: number) => data[t] ?? { pd: [null, null, null, null, null, null], bop: [false, false, false, false, false, false], mob: 0 };
  const setCell = (t: number, v: Partial<ReturnType<typeof cell>>) => setData((x) => ({ ...x, [t]: { ...cell(t), ...v } }));
  const stats = useMemo(() => {
    const sites = Object.values(data).flatMap((x) => x.pd ?? []).filter((n) => n != null) as number[];
    const bops = Object.values(data).flatMap((x) => x.bop ?? []);
    return { deep: sites.filter((n) => n >= 4).length, bop: bops.length ? Math.round((bops.filter(Boolean).length / bops.length) * 100) : 0 };
  }, [data]);
  const save = useMutation({
    mutationFn: () => api('/v1/dent/perio', { body: { patientId: patient.id, data: Object.fromEntries(Object.entries(data).filter(([, v]) => v.pd?.some((n) => n != null) || v.mob).map(([k, v]) => [k, { pd: v.pd.map((n) => (n == null ? null : n)), bop: v.bop, mob: v.mob }])) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dent-perio', patient.id] }); setEditing(false); },
    onError: (e) => toast(err(e), 'bad'),
  });
  const write = editing && can('clinical.write');
  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <b>{last ? date(last.at) : d.perio.empty}</b>
        <span className="pill">{d.perio.deep.replace('{n}', String(stats.deep))}</span><span className="pill">{d.perio.bleeding.replace('{p}', String(stats.bop))}</span>
        <span className="flex-1" />
        {can('clinical.write') && (editing ? <button className="btn btn-accent btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>{d.perio.save}</button>
          : <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(true); setData({}); }}><Icon n="plus" className="h-4 w-4" />{d.perio.new}</button>)}
      </div>
      <div className="perio-grid" dir="ltr">
        {teeth.map((t) => {
          const x = cell(t);
          return (
            <div key={t} className="perio-tooth">
              <b>{t}</b>
              <div className="perio-pd">{x.pd.map((n, i) => (
                <input key={i} disabled={!write} inputMode="numeric" className={n != null && n >= 4 ? (n >= 6 ? 'deep6' : 'deep4') : ''} value={n ?? ''}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); const pd = [...x.pd]; pd[i] = v === '' ? null : Math.min(15, Number(v)); setCell(t, { pd }); }} />
              ))}</div>
              <div className="perio-bop">{x.bop.map((on, i) => <button key={i} type="button" disabled={!write} className={on ? 'on' : ''} onClick={() => { const bop = [...x.bop]; bop[i] = !on; setCell(t, { bop }); }} aria-label={d.perio.bop} />)}</div>
              <select disabled={!write} value={x.mob} onChange={(e) => setCell(t, { mob: Number(e.target.value) })} aria-label={d.perio.mob}>{[0, 1, 2, 3].map((m) => <option key={m} value={m}>{m ? `M${m}` : '–'}</option>)}</select>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- consents ----------------
export function ConsentsTab({ patient }: { patient: any }) {
  const { d, can, date, lang, sys } = useD();
  const q = useQuery({ queryKey: ['dent-consents', patient.id], queryFn: async () => (await api(`/v1/dent/patients/${patient.id}/consents`)).consents as any[] });
  const [open, setOpen] = useState(false);
  const print = (c: any) => printDoc({ lang, clinic: sys.business.name, logo: sys.business.logoUrl, title: `${d.consents.kinds[c.kind] ?? c.kind} · ${patient.name}`, size: 'A4', body: `
    <h2>${esc(d.consents.kinds[c.kind] ?? c.kind)}</h2><div class="meta"><span>${esc(patient.name)} · ${esc(d.patients.file)} ${esc(patient.fileNo)}</span><span>${esc(date(c.signedAt))}</span></div>
    <p class="consent">${esc(c.text)}</p><div class="sign"><div>${esc(d.consents.name)}: ${esc(c.signedName)}${c.signatureUrl ? `<br><img class="signature" src="${esc(c.signatureUrl)}">` : ''}</div></div>` });
  return (
    <div className="grid gap-4">
      {can('patients.update') && <button className="btn btn-accent btn-sm justify-self-start" onClick={() => setOpen(true)}><Icon n="pen" className="h-4 w-4" />{d.consents.new}</button>}
      {!q.data?.length ? <div className="panel"><Empty icon="pen" text={d.consents.empty} /></div> : (
        <div className="panel rows">{q.data.map((c) => (
          <div key={c.id} className="row"><span className="min-w-0 flex-1"><b>{d.consents.kinds[c.kind] ?? c.kind}</b><span className="sub block">{date(c.signedAt)} · {c.signedName}</span></span>
            {c.signatureUrl && <img src={c.signatureUrl} alt="" className="h-10 rounded bg-white" />}
            <button className="btn btn-secondary btn-sm" onClick={() => print(c)}><Icon n="print" className="h-4 w-4" />{d.rx.print}</button></div>
        ))}</div>
      )}
      {open && <ConsentSheet patient={patient} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ConsentSheet({ patient, onClose }: { patient: any; onClose(): void }) {
  const { d, toast, err } = useD();
  const qc = useQueryClient();
  const [kind, setKind] = useState('general');
  const [text, setText] = useState(d.consents.text.general);
  const [name, setName] = useState(patient.name);
  const [signed, setSigned] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { setText(d.consents.text[kind] ?? ''); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = canvas.current!; const ctx = c.getContext('2d')!;
    const r = c.getBoundingClientRect(); c.width = r.width * 2; c.height = r.height * 2; ctx.scale(2, 2);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    let drawing = false;
    const at = (e: PointerEvent) => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] as const; };
    const down = (e: PointerEvent) => { drawing = true; c.setPointerCapture(e.pointerId); const [x, y] = at(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e: PointerEvent) => { if (!drawing) return; const [x, y] = at(e); ctx.lineTo(x, y); ctx.stroke(); setSigned(true); };
    const up = () => { drawing = false; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up);
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); };
  }, []);
  const clear = () => { const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setSigned(false); };
  const save = useMutation({
    mutationFn: async () => {
      const blob: Blob = await new Promise((ok) => canvas.current!.toBlob((b) => ok(b!), 'image/png'));
      const f = await upload('consent', { blob, width: canvas.current!.width, height: canvas.current!.height }, patient.id);
      return api('/v1/dent/consents', { body: { patientId: patient.id, kind, text, signedName: name, signatureFileId: f.id } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dent-consents', patient.id] }); toast(d.consents.saved); onClose(); },
    onError: (e) => toast(err(e), 'bad'),
  });
  return (
    <Sheet title={d.consents.new} sub={patient.name} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!signed || !name.trim() || save.isPending} onClick={() => save.mutate()}>{d.consents.save}</button>}>
      <div className="chips">{Object.entries(d.consents.kinds).map(([k, v]) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{v}</button>)}</div>
      <textarea className="input min-h-32 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
      <label className="field">{d.consents.name}<input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid gap-1"><div className="flex justify-between"><span className="text-sm font-medium">{d.consents.signHere}</span><button type="button" className="link-arrow text-sm" onClick={clear}>{d.consents.clear}</button></div>
        <canvas ref={canvas} className="sign-pad" /></div>
    </Sheet>
  );
}

// ---------------- the patient's lab work ----------------
export function LabTab({ patient }: { patient: any }) {
  return <LabOrders patient={patient} />;
}
