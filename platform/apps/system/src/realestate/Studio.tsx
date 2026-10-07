// The Property Studio: "prepare this property for sale", step by step instead of one giant form. The first step saves a
// draft (and says if it looks like a listing we already have); after that every change saves itself. Photos upload as
// they're chosen (shrunk on the phone first), drag to reorder, the first is the cover. The description can be written by
// AI from the agent's rough notes (and any number it invents is flagged). The last step shows the page as a customer
// will see it, then publishes it: "Your property is live", and who may want it.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, postBlob } from '../lib/api';
import { go, useRoute } from '../lib/app';
import { prepareImage } from '../lib/images';
import { Icon, Sheet, toLatin } from '../components/ui';
import { useR } from './i18n';
import { Avatar, Pill, RIcon, Score, TypeIcon, Why } from './ui';
import { fmt, price, titleOf, useSetup, type Property, type Photo, type Owner } from './data';

type Form = Partial<Property> & { ownerName?: string; ownerPhone?: string };
const NUM = (v: string) => { const d = toLatin(v).replace(/[^\d]/g, ''); return d ? Number(d) : null; };

export function Studio() {
  const { r, lang, can, toast, err } = useR();
  const { params } = useRoute();
  const setup = useSetup();
  const qc = useQueryClient();
  const [id, setId] = useState<string | null>(params.get('id'));
  const [step, setStep] = useState(Number(params.get('step') ?? 0));
  const [f, setF] = useState<Form>({ type: 'villa', purpose: 'sale', negotiable: true, features: [], description: {} });
  const [photos, setPhotos] = useState<(Photo & { up?: boolean })[]>([]);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [similar, setSimilar] = useState<any[] | null>(null);
  const [live, setLive] = useState<any>(null);
  const loaded = useRef(false);
  const existing = useQuery<any>({ queryKey: ['re-property', id], queryFn: () => api(`/v1/re/properties/${id}`), enabled: !!id && !loaded.current });
  useEffect(() => {
    if (existing.data && !loaded.current) { loaded.current = true; setF({ ...existing.data.property, ownerName: existing.data.owner?.name }); setPhotos(existing.data.photos); }
  }, [existing.data]);
  useEffect(() => { if (!id && setup.data && f.currency == null) setF((x) => ({ ...x, currency: setup.data!.settings.currency, city: setup.data!.settings.city })); }, [setup.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));

  // every change saves itself (after the draft exists), a moment after the agent stops typing
  const body = (x: Form) => ({ title: x.title, titleEn: x.titleEn ?? null, type: x.type, purpose: x.purpose, price: x.price ?? null, currency: x.currency, rentPeriod: x.purpose === 'rent' ? x.rentPeriod ?? 'month' : null, negotiable: x.negotiable,
    city: x.city ?? null, area: x.area ?? null, address: x.address ?? null, lat: x.lat ?? null, lng: x.lng ?? null, showExact: !!x.showExact, size: x.size ?? null, land: x.land ?? null, bedrooms: x.bedrooms ?? null, bathrooms: x.bathrooms ?? null,
    floors: x.floors ?? null, parking: x.parking ?? null, yearBuilt: x.yearBuilt ?? null, furnished: x.furnished ?? null, condition: x.condition ?? null, features: x.features ?? [], description: x.description ?? {}, notes: x.notes ?? null,
    video: x.video ?? null, ownerId: x.ownerId ?? null, agentId: x.agentId ?? undefined, ...(can('commission.read') ? { ownerMin: x.ownerMin ?? null } : {}) });
  const first = useRef(true);
  useEffect(() => {
    if (!id || !loaded.current && params.get('id')) return;
    if (first.current) { first.current = false; return; }
    setSaving('saving');
    const t = setTimeout(async () => {
      try { await api(`/v1/re/properties/${id}`, { method: 'PATCH', body: body(f) }); setSaving('saved'); qc.invalidateQueries({ queryKey: ['re-props'] }); }
      catch (e) { setSaving('idle'); toast(err(e), 'bad'); }
    }, 900);
    return () => clearTimeout(t);
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!f.title?.trim()) { toast(r.studio.needsTitle, 'bad'); return false; }
    try {
      const x = await api<{ property: Property; similar: any[] }>('/v1/re/properties', { body: body(f) });
      setId(x.property.id); loaded.current = true; first.current = true;
      setF((y) => ({ ...y, ...x.property }));
      history.replaceState(null, '', `#/studio?id=${x.property.id}&step=1`);
      toast(r.studio.draftSaved);
      if (x.similar.length) setSimilar(x.similar);
      qc.invalidateQueries({ queryKey: ['re-props'] });
      return true;
    } catch (e) { toast(err(e), 'bad'); return false; }
  };
  const goStep = async (n: number) => {
    if (!id && n > 0 && !(await create())) return;
    setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id) history.replaceState(null, '', `#/studio?id=${id}&step=${n}`);
  };
  const publish = async () => {
    try {
      await api(`/v1/re/properties/${id}`, { method: 'PATCH', body: body(f) });
      const x = await api<any>(`/v1/re/properties/${id}/publish`, { body: { on: true } });
      qc.invalidateQueries({ queryKey: ['re-props'] }); qc.invalidateQueries({ queryKey: ['re-property', id] }); qc.invalidateQueries({ queryKey: ['re-today'] });
      setLive(x);
    } catch (e) { toast(err(e), 'bad'); }
  };

  const types = setup.data?.types ?? {}, features = setup.data?.features ?? {};
  const steps = r.studio.steps;
  const missing = [!f.title && r.studio.title, f.price == null && r.studio.price, !f.area && r.studio.area, !photos.length && r.studio.photos].filter(Boolean) as string[];
  if (params.get('id') && existing.isLoading) return <div className="skeleton h-96" />;
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <a href={id ? `#/property?id=${id}` : '#/properties'} className="sub inline-flex items-center gap-1"><Icon n="back" className="h-4 w-4 rtl:-scale-x-100" />{id ? titleOf(f as any, lang) : r.shell.properties}</a>
        <span className="flex-1" />
        {id && <span className="sub">{saving === 'saving' ? r.studio.saving : saving === 'saved' ? `✓ ${r.studio.saved}` : ''}</span>}
      </div>
      <div className="re-studio">
        <nav className="re-steps" aria-label={id ? r.studio.titleEdit : r.studio.titleNew}>
          {steps.map((s, i) => <button key={s} className={`re-step${i < step ? ' done' : ''}`} aria-current={i === step ? 'step' : undefined} onClick={() => goStep(i)}><span className="n">{i < step ? '✓' : i + 1}</span>{s}</button>)}
        </nav>

        <div className="panel">
          <div className="re-form">
            <h3>{steps[step]}</h3>
            {step === 0 && <>
              <label className="field">{r.studio.title}<input className="input" autoFocus value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder={r.studio.titlePh} maxLength={140} /></label>
              <div className="field">{r.studio.type}<div className="re-types">{Object.entries(types).map(([k, v]) => <button key={k} type="button" aria-pressed={f.type === k} onClick={() => set({ type: k })}><TypeIcon type={k} />{v[lang === 'en' ? 'en' : 'ar']}</button>)}</div></div>
              <div className="field">{r.studio.purpose}<div className="seg">{(['sale', 'rent'] as const).map((k) => <button key={k} aria-pressed={f.purpose === k} onClick={() => set({ purpose: k })}>{r.purpose[k]}</button>)}</div></div>
              <label className="field">{r.studio.titleEn} <small>({r.common.optional})</small><input className="input" dir="ltr" value={f.titleEn ?? ''} onChange={(e) => set({ titleEn: e.target.value })} maxLength={140} /></label>
            </>}
            {step === 1 && <>
              <div className="row2">
                <label className="field">{r.studio.city}<input className="input" value={f.city ?? ''} onChange={(e) => set({ city: e.target.value })} /></label>
                <label className="field">{r.studio.area}<input className="input" value={f.area ?? ''} onChange={(e) => set({ area: e.target.value })} placeholder={r.studio.areaPh} list="re-areas" /></label>
              </div>
              <label className="field">{r.studio.address}<input className="input" value={f.address ?? ''} onChange={(e) => set({ address: e.target.value })} /><small>{r.studio.addressHint}</small></label>
              <div className="field">{r.studio.pin}<PinMap lat={f.lat ?? null} lng={f.lng ?? null} onPick={(lat, lng) => set({ lat, lng })} /><small>{r.studio.pinHint}</small></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.showExact} onChange={(e) => set({ showExact: e.target.checked })} />{r.studio.exact}</label>
            </>}
            {step === 2 && <>
              <div className="row2">
                <label className="field">{r.studio.price}<input className="input money" inputMode="numeric" dir="ltr" value={f.price == null ? '' : new Intl.NumberFormat('en-US').format(f.price)} onChange={(e) => set({ price: NUM(e.target.value) })} placeholder={r.studio.onRequest} /></label>
                <div className="field">{r.studio.currency}<div className="seg">{(['USD', 'IQD'] as const).map((c) => <button key={c} aria-pressed={f.currency === c} onClick={() => set({ currency: c })}>{c === 'USD' ? r.common.usd : r.common.iqd}</button>)}</div></div>
              </div>
              {f.purpose === 'rent' && <div className="field">{r.studio.rentPeriod}<div className="seg">{(['month', 'year'] as const).map((k) => <button key={k} aria-pressed={(f.rentPeriod ?? 'month') === k} onClick={() => set({ rentPeriod: k })}>{r.period[k]}</button>)}</div></div>}
              <p className="re-price-big" style={{ textAlign: 'start' }}>{price(f.price ?? null, f.currency ?? 'USD', lang, f.purpose === 'rent' ? f.rentPeriod ?? 'month' : null)}</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.negotiable} onChange={(e) => set({ negotiable: e.target.checked })} />{r.studio.negotiable}</label>
              {can('commission.read') && <label className="field">{r.studio.ownerMin}<input className="input money" inputMode="numeric" dir="ltr" value={f.ownerMin == null ? '' : new Intl.NumberFormat('en-US').format(f.ownerMin)} onChange={(e) => set({ ownerMin: NUM(e.target.value) })} /><small>{r.prop.private}</small></label>}
            </>}
            {step === 3 && <>
              <div className="row3">
                {(['bedrooms', 'bathrooms', 'floors', 'parking'] as const).map((k) => <div key={k} className="field">{r.studio[k]}<Counter value={f[k] ?? null} onChange={(v) => set({ [k]: v } as any)} /></div>)}
              </div>
              <div className="row3">
                <label className="field">{r.studio.size}<input className="input" inputMode="numeric" value={f.size ?? ''} onChange={(e) => set({ size: NUM(e.target.value) })} /></label>
                <label className="field">{r.studio.land}<input className="input" inputMode="numeric" value={f.land ?? ''} onChange={(e) => set({ land: NUM(e.target.value) })} /></label>
                <label className="field">{r.studio.year}<input className="input" inputMode="numeric" value={f.yearBuilt ?? ''} onChange={(e) => set({ yearBuilt: NUM(e.target.value) })} /></label>
              </div>
              <div className="field">{r.studio.furnished}<div className="chips">{Object.entries(r.furnished).map(([k, t]) => <button key={k} className="chip" aria-pressed={f.furnished === k} onClick={() => set({ furnished: f.furnished === k ? null : k })}>{t}</button>)}</div></div>
              <div className="field">{r.studio.condition}<div className="chips">{Object.entries(r.condition).map(([k, t]) => <button key={k} className="chip" aria-pressed={f.condition === k} onClick={() => set({ condition: f.condition === k ? null : k })}>{t}</button>)}</div></div>
              <div className="field">{r.studio.features}<div className="chips">
                {[...Object.keys(features), ...(f.features ?? []).filter((x) => !features[x])].map((k) => { const on = f.features?.includes(k); return (
                  <button key={k} className="chip" aria-pressed={on} onClick={() => set({ features: on ? f.features!.filter((x) => x !== k) : [...(f.features ?? []), k] })}>{features[k]?.[lang === 'en' ? 'en' : 'ar'] ?? k}</button>); })}
                <input className="chip" style={{ minWidth: '9rem' }} placeholder={r.studio.addFeature} onKeyDown={(e) => { const v = (e.target as HTMLInputElement).value.trim(); if (e.key === 'Enter' && v) { set({ features: [...new Set([...(f.features ?? []), v])] }); (e.target as HTMLInputElement).value = ''; } }} />
              </div></div>
            </>}
            {step === 4 && id && <Photos id={id} photos={photos} setPhotos={setPhotos} coverId={(f as any).coverId ?? null} setCover={(coverId) => set({ coverId } as any)} />}
            {step === 5 && <>
              <Describe id={id} f={f} set={set} />
              <label className="field">{r.studio.video} <small>({r.common.optional})</small><input className="input" dir="ltr" value={f.video ?? ''} onChange={(e) => set({ video: e.target.value })} placeholder="https://" /></label>
            </>}
            {step === 6 && <>
              <OwnerPick ownerId={f.ownerId ?? null} ownerName={f.ownerName} onPick={(o) => set({ ownerId: o?.id ?? null, ownerName: o?.name })} />
              <div className="field">{r.studio.agent}<div className="chips">{(setup.data?.team ?? []).map((m) => <button key={m.id} className="chip" aria-pressed={f.agentId === m.id} onClick={() => set({ agentId: m.id })}>{m.name}</button>)}</div></div>
              <label className="field">{r.studio.notes}<textarea className="input" rows={3} value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></label>
            </>}
            {step === 7 && <>
              <p className="sub">{r.studio.preview}</p>
              {missing.length > 0 && <p className="note"><Icon n="info" />{fmt(r.studio.missing, { what: missing.join('، ') })}</p>}
              <div className="max-w-xs"><PhonePreview f={f} photo={photos[0]?.url ?? null} /></div>
            </>}
          </div>
          <div className="re-nav-btns">
            {step > 0 ? <button className="btn btn-secondary" onClick={() => goStep(step - 1)}><Icon n="back" className="h-4 w-4 rtl:-scale-x-100" />{r.studio.back}</button> : <span />}
            {step < steps.length - 1 ? <button className="btn btn-accent" onClick={() => goStep(step + 1)}>{r.studio.next}<Icon n="arrow" className="h-4 w-4 rtl:-scale-x-100" /></button>
              : <div className="flex gap-2"><button className="btn btn-secondary" onClick={() => { toast(r.studio.draftSaved); go(`#/property?id=${id}`); }}>{r.studio.saveDraft}</button>
                {can('listings.publish') && <button className="btn btn-accent" disabled={!photos.length} onClick={publish}><Icon n="globe" />{r.studio.publishNow}</button>}</div>}
          </div>
        </div>

        <aside className="re-studio-preview"><p className="sec-t">{r.studio.preview}</p><PhonePreview f={f} photo={photos[0]?.url ?? null} /></aside>
      </div>
      {similar && <Sheet title={r.prop.openIt} onClose={() => setSimilar(null)} center footer={<button className="btn btn-accent justify-center" onClick={() => setSimilar(null)}>{r.prop.keepBoth}</button>}>
        <p>{fmt(r.prop.similarWarn, { list: similar.map((x) => `#${x.ref}`).join('، ') })}</p>
        <div className="panel">{similar.map((x) => <a key={x.id} className="re-item" href={`#/property?id=${x.id}`}><Pill>#{x.ref}</Pill><span className="min-w-0 flex-1 truncate">{x.title}</span><span className="sub">{x.area}</span></a>)}</div>
      </Sheet>}
      {live && <LiveSheet res={live} onClose={() => { setLive(null); go(`#/property?id=${id}`); }} />}
    </div>
  );
}

const Counter = ({ value, onChange }: { value: number | null; onChange(v: number | null): void }) => (
  <span className="re-counter"><button type="button" onClick={() => onChange(Math.max(0, (value ?? 0) - 1) || null)} aria-label="−"><Icon n="minus" /></button>
    <input inputMode="numeric" value={value ?? ''} onChange={(e) => onChange(NUM(e.target.value))} /><button type="button" onClick={() => onChange((value ?? 0) + 1)} aria-label="+"><Icon n="plus" /></button></span>
);

/** Photos: chosen (several at once) → shrunk on the phone → uploaded with a spinner each; drag to reorder; the first is the cover. */
function Photos({ id, photos, setPhotos, coverId, setCover }: { id: string; photos: (Photo & { up?: boolean })[]; setPhotos(f: (p: (Photo & { up?: boolean })[]) => (Photo & { up?: boolean })[]): void; coverId: string | null; setCover(id: string): void }) {
  const { r, toast, err } = useR();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false), [drag, setDrag] = useState<string | null>(null);
  const save = async (list: Photo[], cover?: string) => { try { await api(`/v1/re/properties/${id}/photos`, { method: 'PUT', body: { order: list.map((p) => p.id), ...(cover ? { coverId: cover } : {}) } }); qc.invalidateQueries({ queryKey: ['re-props'] }); } catch (e) { toast(err(e), 'bad'); } };
  const add = async (files: FileList | File[]) => {
    for (const file of [...files].slice(0, 30)) {
      const tmp = `tmp-${Math.random()}`;
      const local = URL.createObjectURL(file);
      setPhotos((p) => [...p, { id: tmp, url: local, width: null, height: null, caption: null, up: true }]);
      try {
        const img = await prepareImage(file, { max: 1800, quality: 0.8 });
        const x = await postBlob<{ photo: Photo; cover: boolean }>(`/v1/re/properties/${id}/photos?w=${img.width}&h=${img.height}`, img.blob);
        setPhotos((p) => p.map((y) => (y.id === tmp ? x.photo : y)));
        if (x.cover) setCover(x.photo.id);
      } catch (e) { setPhotos((p) => p.filter((y) => y.id !== tmp)); toast(err(e instanceof ApiError ? e : new ApiError(400, 'NOT_AN_IMAGE')), 'bad'); }
      finally { URL.revokeObjectURL(local); }
    }
    qc.invalidateQueries({ queryKey: ['re-props'] });
  };
  const move = (from: number, to: number) => { if (to < 0 || to >= photos.length) return; const list = [...photos]; const [x] = list.splice(from, 1); list.splice(to, 0, x); setPhotos(() => list); save(list); };
  const remove = async (p: Photo) => { try { await api(`/v1/re/properties/${id}/photos/${p.id}`, { method: 'DELETE' }); setPhotos((l) => l.filter((x) => x.id !== p.id)); } catch (e) { toast(err(e), 'bad'); } };
  const ordered = coverId ? [...photos].sort((a, b) => (a.id === coverId ? -1 : b.id === coverId ? 1 : 0)) : photos;
  return (
    <>
      <div className={`re-drop${over ? ' over' : ''}`} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); }} role="button" tabIndex={0}>
        <Icon n="upload" /><b>{r.studio.addPhotos}</b><span>{r.studio.dropHint}</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      </div>
      <div className="re-photos">
        {ordered.map((p, i) => (
          <div key={p.id} className={`re-photo${p.up ? ' up' : ''}${drag === p.id ? ' dragging' : ''}`} draggable={!p.up} onDragStart={() => setDrag(p.id)} onDragEnd={() => setDrag(null)}
            onDragOver={(e) => { e.preventDefault(); if (drag && drag !== p.id) { const from = photos.findIndex((x) => x.id === drag), to = photos.findIndex((x) => x.id === p.id); const list = [...photos]; const [x] = list.splice(from, 1); list.splice(to, 0, x); setPhotos(() => list); } }}
            onDrop={(e) => { e.preventDefault(); save(photos); }}>
            <img src={p.url} alt="" />
            {p.up && <span className="spinner" />}
            {(coverId ? p.id === coverId : i === 0) && <span className="tag re-pill solid">{r.studio.cover}</span>}
            {!p.up && <span className="tools">
              <button onClick={() => move(i, i - 1)} aria-label="←"><Icon n="back" /></button>
              {!(coverId ? p.id === coverId : i === 0) && <button onClick={() => { setCover(p.id); save(photos, p.id); }} aria-label={r.studio.makeCover}><RIcon n="star" /></button>}
              <button onClick={() => remove(p)} aria-label={r.common.remove}><Icon n="trash" /></button>
            </span>}
          </div>
        ))}
      </div>
    </>
  );
}

/** The description: by hand, or written by AI from rough notes; shorten, expand, polish, translate. Always editable. */
function Describe({ id, f, set }: { id: string | null; f: Form; set(p: Partial<Form>): void }) {
  const { r, lang, toast, err } = useR();
  const [notes, setNotes] = useState(''), [busy, setBusy] = useState<string | null>(null), [stray, setStray] = useState<string[]>([]);
  const [tab, setTab] = useState<'ar' | 'en'>(lang === 'en' ? 'en' : 'ar');
  const text = f.description?.[tab] ?? '';
  const run = async (mode: string, target: 'ar' | 'en' = tab) => {
    setBusy(mode);
    try {
      const src = mode === 'translate' ? f.description?.[target === 'ar' ? 'en' : 'ar'] ?? '' : text;
      const x = await api<{ text: string; stray: string[] }>('/v1/re/ai/describe', { body: { propertyId: id, mode, lang: target, notes, text: mode === 'write' ? undefined : src } });
      set({ description: { ...(f.description ?? {}), [target]: x.text } }); setTab(target); setStray(x.stray);
    } catch (e) { toast(err(e), 'bad'); } finally { setBusy(null); }
  };
  const other = tab === 'ar' ? 'en' : 'ar';
  return (
    <>
      <div className="re-ai">
        <b className="inline-flex items-center gap-2"><RIcon n="sparkle" className="h-4 w-4 text-[var(--accent)]" />{r.studio.ai.write}</b>
        <span className="sub">{r.studio.ai.rough}</span>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={r.studio.ai.roughPh} />
        <div className="re-ai-row">
          <button disabled={!!busy} onClick={() => run('write')}>{busy === 'write' ? <span className="spinner" /> : <RIcon n="sparkle" />}{text ? r.studio.ai.regenerate : r.studio.ai.write}</button>
          {text && (['shorten', 'expand', 'polish'] as const).map((m) => <button key={m} disabled={!!busy} onClick={() => run(m)}>{busy === m ? <span className="spinner" /> : null}{r.studio.ai[m]}</button>)}
          {(f.description?.[other] ?? '') && !text && <button disabled={!!busy} onClick={() => run('translate', tab)}>{busy === 'translate' ? <span className="spinner" /> : null}{r.studio.ai.translate}</button>}
          {text && <button disabled={!!busy} onClick={() => run('translate', other)}>{busy === 'translate' ? <span className="spinner" /> : null}{r.studio.ai.translate} → {other === 'ar' ? 'العربية' : 'English'}</button>}
        </div>
      </div>
      <div className="re-tabs">{(['ar', 'en'] as const).map((l) => <button key={l} aria-pressed={tab === l} onClick={() => setTab(l)}>{l === 'ar' ? r.studio.descAr : r.studio.descEn}{f.description?.[l] ? ' ✓' : ''}</button>)}</div>
      {stray.length > 0 && <p className="note" style={{ background: 'color-mix(in oklab, var(--warn) 12%, var(--surface))' }}><Icon n="alert" />{fmt(r.studio.ai.stray, { n: stray.join(', ') })}</p>}
      <textarea className="input" rows={8} dir={tab === 'ar' ? 'rtl' : 'ltr'} value={text} onChange={(e) => { setStray([]); set({ description: { ...(f.description ?? {}), [tab]: e.target.value } }); }} />
    </>
  );
}

/** The owner: choose from the agency's owners, or add one in place (name + phone). */
function OwnerPick({ ownerId, ownerName, onPick }: { ownerId: string | null; ownerName?: string; onPick(o: Owner | null): void }) {
  const { r, toast, err } = useR();
  const [q, setQ] = useState(''), [adding, setAdding] = useState(false), [name, setName] = useState(''), [phone, setPhone] = useState('');
  const list = useQuery<{ owners: Owner[] }>({ queryKey: ['re-owners', q], queryFn: () => api(`/v1/re/owners?limit=8${q ? `&q=${encodeURIComponent(q)}` : ''}`) });
  const make = async () => {
    try { const x = await api<any>('/v1/re/owners', { body: { name, phone } }); onPick(x.owner); setAdding(false); }
    catch (e: any) { if (e instanceof ApiError && e.code === 'OWNER_EXISTS') toast(fmt(r.owners.exists, { name }), 'bad'); else toast(err(e), 'bad'); }
  };
  if (ownerId) return <div className="field">{r.studio.owner}<button className="re-item panel" onClick={() => onPick(null)}><Avatar name={ownerName ?? '?'} /><span className="flex-1 truncate">{ownerName}</span><Icon n="close" /></button></div>;
  return (
    <div className="field">{r.studio.owner}
      {adding ? <div className="grid gap-2"><input className="input" autoFocus placeholder={r.studio.ownerName} value={name} onChange={(e) => setName(e.target.value)} /><input className="input" dir="ltr" inputMode="tel" placeholder={r.studio.ownerPhone} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="flex gap-2"><button className="btn btn-accent btn-sm" disabled={!name.trim()} onClick={make}>{r.common.add}</button><button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>{r.common.cancel}</button></div></div>
        : <>
          <div className="search"><Icon n="search" /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={r.owners.search} /></div>
          <div className="panel max-h-60 overflow-y-auto">{(list.data?.owners ?? []).map((o) => <button key={o.id} className="re-item" onClick={() => onPick(o)}><Avatar name={o.name} /><span className="flex-1 truncate">{o.name}</span></button>)}
            <button className="re-item" onClick={() => setAdding(true)}><span className="re-av"><Icon n="plus" className="h-4 w-4" /></span>{r.studio.newOwner}</button></div>
        </>}
    </div>
  );
}

/** A small map to drop the pin (OpenStreetMap; loaded only on this step). */
function PinMap({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick(lat: number, lng: number): void }) {
  const box = useRef<HTMLDivElement>(null), map = useRef<any>(null), pin = useRef<any>(null);
  useEffect(() => {
    let on = true;
    (async () => {
      const L = (await import('leaflet')).default; await import('leaflet/dist/leaflet.css');
      if (!on || !box.current || map.current) return;
      map.current = L.map(box.current).setView(lat != null && lng != null ? [lat, lng] : [36.19, 44.01], lat != null ? 16 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
      const icon = L.divIcon({ className: '', html: '<span class="re-marker on">●</span>', iconSize: [0, 0] });
      if (lat != null && lng != null) pin.current = L.marker([lat, lng], { icon }).addTo(map.current);
      map.current.on('click', (e: any) => { const { lat: a, lng: b } = e.latlng; if (pin.current) pin.current.setLatLng(e.latlng); else pin.current = L.marker(e.latlng, { icon }).addTo(map.current); onPick(Math.round(a * 1e6) / 1e6, Math.round(b * 1e6) / 1e6); });
    })();
    return () => { on = false; map.current?.remove(); map.current = null; pin.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={box} style={{ height: '16rem', borderRadius: '1rem', overflow: 'hidden', background: 'var(--sunken)' }} />;
}

/** How the public page will look on a phone. */
function PhonePreview({ f, photo }: { f: Form; photo: string | null }) {
  const { r, lang } = useR();
  return (
    <div className="re-phone"><div className="re-phone-in">
      {photo ? <img src={photo} alt="" /> : <div style={{ aspectRatio: '4 / 3', background: '#EEE' }} />}
      <div className="b">
        <span style={{ fontSize: '.75rem', color: '#7A808C' }}>{r.purpose[f.purpose ?? 'sale']}</span>
        <b style={{ fontSize: '1.05rem', lineHeight: 1.3 }}>{titleOf({ title: f.title || r.studio.titlePh, titleEn: f.titleEn }, lang)}</b>
        {f.area && <span style={{ fontSize: '.85rem', color: '#4A5160' }}>{[f.area, f.city].filter(Boolean).join('، ')}</span>}
        <span className="pr">{price(f.price ?? null, f.currency ?? 'USD', lang, f.purpose === 'rent' ? f.rentPeriod ?? 'month' : null)}</span>
        <span style={{ fontSize: '.8rem', color: '#4A5160' }}>{[f.size && `${f.size} m²`, f.bedrooms && `${f.bedrooms} 🛏`, f.bathrooms && `${f.bathrooms} 🛁`].filter(Boolean).join(' · ')}</span>
        {(f.description?.[lang === 'en' ? 'en' : 'ar']) && <p style={{ fontSize: '.8rem', color: '#4A5160', marginTop: '.4rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.description[lang === 'en' ? 'en' : 'ar']}</p>}
        <span className="wa">WhatsApp</span>
      </div>
    </div></div>
  );
}

/** "Your property is live." The page, WhatsApp, and the leads who may want it (send to each in one tap). */
export function LiveSheet({ res, onClose }: { res: { property: Property; matches: any[]; matchCount: number; share?: { url: string; text: { ar: string; en: string } } }; onClose(): void }) {
  const { r, lang, toast, err } = useR();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const send = async (leadId: string) => {
    try { const x = await api<{ wa: string }>(`/v1/re/leads/${leadId}/send`, { body: { propertyIds: [res.property.id] } }); window.open(x.wa, '_blank', 'noopener'); setSent((s) => new Set(s).add(leadId)); }
    catch (e) { toast(err(e), 'bad'); }
  };
  const text = res.share?.text[lang === 'en' ? 'en' : 'ar'] ?? '';
  return (
    <Sheet title={r.studio.live} onClose={onClose} center footer={<div className="grid gap-2">
      <a className="btn btn-wa justify-center" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener"><Icon n="wa" />{r.studio.shareWa}</a>
      <div className="grid grid-cols-2 gap-2">{res.share && <a className="btn btn-secondary justify-center" href={res.share.url} target="_blank" rel="noopener">{r.studio.viewPage}</a>}<button className="btn btn-secondary justify-center" onClick={onClose}>{r.studio.openProperty}</button></div></div>}>
      <div className="re-live"><span className="ok"><Icon n="check" /></span><h3>{r.studio.live}</h3><p className="sub">{r.studio.liveSub}</p></div>
      {res.matchCount > 0 && <>
        <p className="font-medium">{fmt(r.studio.matched, { n: res.matchCount })}</p>
        <div className="panel">{res.matches.slice(0, 6).map((m) => (
          <div key={m.lead.id} className="re-match"><Score s={m.score} /><span className="min-w-0 flex-1"><b className="block truncate">{m.lead.name}</b><Why reasons={m.reasons} /></span>
            {sent.has(m.lead.id) ? <Pill tone="ok">✓</Pill> : (m.lead.whatsapp || m.lead.phone) && <button className="btn btn-wa btn-sm" onClick={() => send(m.lead.id)}><Icon n="wa" />{r.prop.sendTo}</button>}</div>
        ))}</div>
      </>}
    </Sheet>
  );
}
