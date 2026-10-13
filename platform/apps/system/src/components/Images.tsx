// Pictures in the app: one image (a logo, a product photo), a strip of photos on a record (invoice, receipt),
// and a full-screen view. Photos are shrunk on the device, then uploaded; the record is saved with their ids.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, upload, ApiError, type UploadedFile } from '../lib/api';
import { prepareImage } from '../lib/images';
import { useApp } from '../lib/app';
import { Icon } from './ui';

type Purpose = 'logo' | 'product' | 'purchase' | 'expense';
const SIZE: Record<Purpose, { max: number; alpha: boolean }> = {
  logo: { max: 600, alpha: true }, product: { max: 800, alpha: false }, purchase: { max: 1800, alpha: false }, expense: { max: 1800, alpha: false },
};

function useUpload(purpose: Purpose) {
  const { t, toast } = useApp();
  const [busy, setBusy] = useState(0);
  const send = async (file: File, ref?: string) => {
    setBusy((n) => n + 1);
    try { return await upload(purpose, await prepareImage(file, SIZE[purpose]), ref); }
    catch (e) {
      const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : '';
      toast((t.images.errors as Record<string, string>)[code] ?? (code === 'NETWORK' ? t.errors.network : t.images.errors.generic), 'bad');
      return null;
    } finally { setBusy((n) => n - 1); }
  };
  return { send, busy: busy > 0 };
}

const picker = (onPick: (files: File[]) => void, multiple = false) => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.multiple = multiple;
  input.onchange = () => onPick([...(input.files ?? [])]);
  input.click();
};

/** One picture: shows it, and lets you add, change or remove it. `onChange(null)` = removed. */
export function ImagePick({ purpose, url, onChange, label, hint, shape = 'square' }: {
  purpose: Purpose; url: string | null | undefined; onChange(f: UploadedFile | null): void; label: string; hint?: string; shape?: 'square' | 'wide';
}) {
  const { t } = useApp();
  const { send, busy } = useUpload(purpose);
  const pick = () => picker(async ([f]) => { if (f) { const up = await send(f); if (up) onChange(up); } });
  return (
    <div className="img-pick">
      <button type="button" className={`img-box ${shape}`} onClick={pick} aria-label={url ? t.images.change : t.images.add} disabled={busy}>
        {url ? <img src={url} alt="" /> : <span className="img-empty"><Icon n="image" /><small>{t.images.add}</small></span>}
        {busy && <span className="img-busy"><span className="spinner" /></span>}
      </button>
      <div className="grid gap-1.5">
        <b className="text-sm font-medium">{label}</b>
        {hint && <p className="sub leading-snug">{hint}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn btn-secondary btn-sm" onClick={pick} disabled={busy}><Icon n="camera" className="h-4 w-4" />{url ? t.images.change : t.images.add}</button>
          {url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)} disabled={busy}><Icon n="trash" className="h-4 w-4" />{t.images.remove}</button>}
        </div>
      </div>
    </div>
  );
}

/**
 * Photos on a purchase or expense. Before the record is saved (no refId), new photos are just collected and sent with it;
 * on a saved record they're attached (and removed) straight away.
 */
export function Attachments({ purpose, files, onChange, refId, readOnly = false }: {
  purpose: 'purchase' | 'expense'; files: UploadedFile[]; onChange?(f: UploadedFile[]): void; refId?: string; readOnly?: boolean;
}) {
  const { t, toast, errorText } = useApp();
  const { send, busy } = useUpload(purpose);
  const [view, setView] = useState<string | null>(null);
  const latest = useRef(files); latest.current = files;
  const add = () => picker(async (list) => {
    for (const f of list.slice(0, Math.max(0, 10 - latest.current.length))) {
      const up = await send(f, refId);
      if (up) onChange?.([...latest.current, up]);
    }
  }, true);
  const remove = async (id: string) => {
    if (refId) { try { await api(`/v1/sys/files/${id}`, { method: 'DELETE' }); } catch (e) { toast(errorText(e), 'bad'); return; } }
    onChange?.(latest.current.filter((f) => f.id !== id));
  };
  if (readOnly && !files.length) return null;
  return (
    <div className="attach">
      {files.map((f) => (
        <span key={f.id} className="attach-item">
          <button type="button" className="attach-thumb" onClick={() => setView(f.url)} aria-label={t.images.view}>{f.url && <img src={f.url} alt="" loading="lazy" />}</button>
          {!readOnly && <button type="button" className="attach-x" onClick={() => remove(f.id)} aria-label={t.images.remove}><Icon n="close" /></button>}
        </span>
      ))}
      {!readOnly && files.length < 10 && (
        <button type="button" className="attach-add" onClick={add} disabled={busy}>
          {busy ? <span className="spinner" /> : <><Icon n="camera" /><small>{t.images.addPhoto}</small></>}
        </button>
      )}
      {view && <Lightbox url={view} onClose={() => setView(null)} />}
    </div>
  );
}

/** A picture, full screen. */
export function Lightbox({ url, onClose }: { url: string; onClose(): void }) {
  const { t } = useApp();
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <img src={url} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="lightbox-x" onClick={onClose} aria-label={t.close}><Icon n="close" /></button>
      <a className="lightbox-open" href={url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>{t.images.open}</a>
    </div>,
    document.body,
  );
}

/**
 * A product's photos, like an online shop's: the first is the cover (on the till, the lists and the shop's cards), the
 * rest show on its page. Add several at once, drag to reorder, make any one the cover, remove. Saved with the product.
 */
export function PhotoGallery({ files, onChange, max = 8, words }: {
  files: UploadedFile[]; onChange(f: UploadedFile[]): void; max?: number;
  words: { title: string; hint: string; cover: string; makeCover: string; add: string; count: string };
}) {
  const { t } = useApp();
  const { send, busy } = useUpload('product');
  const [view, setView] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const latest = useRef(files); latest.current = files;
  const add = () => picker(async (list) => {
    for (const f of list.slice(0, Math.max(0, max - latest.current.length))) {
      const up = await send(f);
      if (up) onChange([...latest.current, up]);
    }
  }, true);
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...latest.current]; const [x] = next.splice(from, 1); next.splice(to, 0, x); onChange(next);
  };
  return (
    <section className="pgal">
      <div className="pgal-head"><b>{words.title}</b><small>{words.count.replace('{n}', String(files.length)).replace('{max}', String(max))}</small></div>
      <p className="sub">{words.hint}</p>
      <div className="pgal-grid">
        {files.map((f, i) => (
          <span key={f.id} className={`pgal-item${i === 0 ? ' cover' : ''}${drag === i ? ' dragging' : ''}`} draggable
            onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDrag(null)}
            onDragOver={(e) => { e.preventDefault(); if (drag != null && drag !== i) { move(drag, i); setDrag(i); } }}>
            <button type="button" className="pgal-img" onClick={() => setView(f.url)} aria-label={t.images.view}>{f.url && <img src={f.url} alt="" loading="lazy" draggable={false} />}</button>
            {i === 0 ? <span className="pgal-badge">{words.cover}</span>
              : <button type="button" className="pgal-cover" onClick={() => move(i, 0)}>{words.makeCover}</button>}
            <button type="button" className="pgal-x" onClick={() => onChange(latest.current.filter((x) => x.id !== f.id))} aria-label={t.images.remove}><Icon n="close" /></button>
          </span>
        ))}
        {files.length < max && (
          <button type="button" className={`pgal-add${files.length ? '' : ' first'}`} onClick={add} disabled={busy}>
            {busy ? <span className="spinner" /> : <><Icon n="camera" /><small>{words.add}</small></>}
          </button>
        )}
      </div>
      {view && <Lightbox url={view} onClose={() => setView(null)} />}
    </section>
  );
}
