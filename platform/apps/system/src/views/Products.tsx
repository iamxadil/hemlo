// Products: the list, add/edit, and stock (deliveries, shelf counts, damage) with a history.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Product } from '../lib/api';
import { useApp, useRoute, go, fill } from '../lib/app';
import { DinarInput, Empty, Icon, Money, Sheet, toLatin } from '../components/ui';
import { useProducts } from './Sell';
import { Importer } from '../components/Importer';
import { ImagePick } from '../components/Images';
import type { UploadedFile } from '../lib/api';

const Thumb = ({ p }: { p: Product }) => <span className={`thumb${p.imageUrl ? ' img' : ''}`}>{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : p.name.slice(0, 1)}</span>;

const UNITS = ['piece', 'kg', 'g', 'l', 'box', 'pack'];
const isLow = (p: Product) => p.trackStock && p.stock <= (p.lowStock ?? 0);

export function Products() {
  const { t, can, num, qty } = useApp();
  const { params } = useRoute();
  const products = useProducts();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const list = products.data ?? [];
  const needle = toLatin(q.trim().toLowerCase());
  const rows = useMemo(() => list.filter((p) => (filter === 'all' || isLow(p)) && (!needle || p.name.toLowerCase().includes(needle) || p.barcode?.includes(needle) || p.packBarcode?.includes(needle) || p.category?.toLowerCase().includes(needle))), [list, filter, needle]);
  const lowCount = list.filter(isLow).length;
  const open = params.get('id');
  const close = () => go('#/products');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="search min-w-0 flex-1"><Icon n="search" /><input className="input" placeholder={t.products.search} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">
          <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t.products.all} · {num(list.length)}</button>
          <button className="chip" aria-pressed={filter === 'low'} onClick={() => setFilter('low')}>{t.products.low} · {num(lowCount)}</button>
        </div>
        {can('products.manage') && <a className="btn btn-secondary btn-sm" href="#/products?id=import"><Icon n="upload" className="h-4 w-4" />{t.importer.choice}</a>}
        {can('products.manage') && <a className="btn btn-accent btn-sm" href="#/products?id=new"><Icon n="plus" className="h-4 w-4" />{t.products.add}</a>}
      </div>
      <div className="panel rows overflow-clip">
        {products.isLoading && !list.length ? <div className="skeleton m-4 h-40" />
          : !rows.length ? <Empty text={t.products.empty} />
          : rows.map((p) => (
            <a key={p.id} className="row" href={`#/products?id=${p.id}`}>
              <Thumb p={p} />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-medium">{p.name}</b>
                <span className="sub" dir="auto">{[p.category, p.barcode].filter(Boolean).join(' · ') || ' '}</span>
              </span>
              <span className="hidden text-end sm:block">
                {p.trackStock ? <span className={`pill ${p.stock <= 0 ? 'bad' : isLow(p) ? 'warn' : ''}`}>{qty(p.stock, p.unit)}</span> : <span className="sub">{t.products.notTracked}</span>}
              </span>
              <span className="w-28 text-end font-semibold"><Money v={p.price} /></span>
            </a>
          ))}
      </div>
      {open === 'new' && can('products.manage') && <ProductForm onClose={close} />}
      {open === 'import' && can('products.manage') && <Importer onClose={close} />}
      {open && open !== 'new' && list.find((p) => p.id === open) && <ProductSheet product={list.find((p) => p.id === open)!} onClose={close} />}
    </div>
  );
}

/** The online shop's words for a product (a store with Hemlo Website). */
const SHOP_W = {
  ar: { online: 'اعرضه في متجرك على الإنترنت', onlineHint: 'يظهر في موقعك بصورته وسعره، ويطلبه الزبون بالدفع عند الاستلام.', desc: 'وصف قصير', descHint: 'الحجم، المكونات، لمن يناسب…' },
  en: { online: 'Show it in your online shop', onlineHint: 'It appears on your website with its photo and price, and customers order it with cash on delivery.', desc: 'A short description', descHint: 'Size, ingredients, who it suits…' },
  ckb: { online: 'لە دوکانە ئۆنلاینەکەتدا پیشانی بدە', onlineHint: 'بە وێنە و نرخەکەیەوە لە ماڵپەڕەکەتدا دەردەکەوێت، و کڕیار بە پارەدان لە کاتی وەرگرتن داوای دەکات.', desc: 'وەسفێکی کورت', descHint: 'قەبارە، پێکهاتە، بۆ کێ دەگونجێت…' },
};

function ProductForm({ product, onClose }: { product?: Product; onClose(): void }) {
  const { t, toast, errorText, lang, sys } = useApp();
  const shopW = SHOP_W[lang] ?? SHOP_W.ar, isShop = !sys.business.kind || sys.business.kind === 'store';
  const qc = useQueryClient();
  const [f, setF] = useState({ name: product?.name ?? '', barcode: product?.barcode ?? '', category: product?.category ?? '', unit: product?.unit ?? 'piece',
    price: product?.price ?? null as number | null, cost: product?.cost ?? null as number | null, stock: '', lowStock: product?.lowStock != null ? String(product.lowStock) : '', trackStock: product?.trackStock ?? true,
    packSize: product?.packSize ? String(product.packSize) : '', packBarcode: product?.packBarcode ?? '', packPrice: product?.packPrice ?? null as number | null, scaleCode: product?.scaleCode ?? '', online: !!(product as any)?.online, description: (product as any)?.description ?? '' });
  const [showPack, setShowPack] = useState(!!product?.packSize);
  const [image, setImage] = useState<{ id: string | null; url: string | null; changed: boolean }>({ id: product?.imageId ?? null, url: product?.imageUrl ?? null, changed: false });
  const [error, setError] = useState('');
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = { name: f.name, barcode: toLatin(f.barcode) || null, category: f.category || null, unit: f.unit, price: f.price, cost: f.cost, lowStock: f.lowStock ? Number(toLatin(f.lowStock)) : null, trackStock: f.trackStock,
        packSize: f.packSize ? Number(toLatin(f.packSize)) : null, packBarcode: f.packSize ? toLatin(f.packBarcode) || null : null, packPrice: f.packSize ? f.packPrice : null,
        scaleCode: toLatin(f.scaleCode).replace(/\D/g, '') || null, ...(image.changed ? { imageId: image.id } : {}), ...(isShop ? { online: f.online, description: f.description.trim() || null } : {}) };
      return product ? api(`/v1/sys/products/${product.id}`, { method: 'PATCH', body }) : api('/v1/sys/products', { body: { ...body, stock: f.stock ? Number(toLatin(f.stock)) : 0 } });
    },
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['products'] }); toast(t.products.saved); product ? onClose() : go(`#/products?id=${r.product.id}`); },
    onError: (e) => setError(errorText(e)),
  });
  const opt = <small> · {t.products.optional}</small>;
  return (
    <Sheet title={product ? t.products.edit : t.products.add} onClose={onClose}
      footer={<button className="btn btn-accent justify-center" disabled={!f.name.trim() || f.price == null || save.isPending} onClick={() => save.mutate()}>{t.products.save}</button>}>
      <ImagePick purpose="product" url={image.url} label={t.images.product} hint={t.images.productHint}
        onChange={(up: UploadedFile | null) => setImage({ id: up?.id ?? null, url: up?.url ?? null, changed: true })} />
      <label className="field">{t.products.name}<input className="input" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label className="field">{t.products.barcode}{opt}<div className="search"><Icon n="scan" /><input className="input" dir="ltr" inputMode="numeric" placeholder={t.products.barcodeHint} value={f.barcode}
        onChange={(e) => set('barcode', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} /></div></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{t.products.price}<DinarInput value={f.price} onChange={(v) => set('price', v)} /></label>
        <label className="field">{t.products.cost}{opt}<DinarInput value={f.cost} onChange={(v) => set('cost', v)} /></label>
      </div>
      {f.price != null && f.cost != null && f.price > 0 && <p className="sub -mt-2">{fill(t.products.margin, { p: Math.round(((f.price - f.cost) / f.price) * 100) })}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{t.products.unit}<select className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)}>{UNITS.map((u) => <option key={u} value={u}>{t.products.units[u]}</option>)}</select></label>
        <label className="field">{t.products.category}{opt}<input className="input" value={f.category} onChange={(e) => set('category', e.target.value)} /></label>
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] p-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={f.trackStock} onChange={(e) => set('trackStock', e.target.checked)} />
        <span><b className="block font-medium">{t.products.trackStock}</b><span className="sub">{t.products.trackHint}</span></span>
      </label>
      {f.trackStock && <div className="grid grid-cols-2 gap-3">
        {!product && <label className="field">{t.products.stock}<input className="input" dir="ltr" inputMode="decimal" value={f.stock} onChange={(e) => set('stock', e.target.value)} placeholder="0" /></label>}
        <label className="field">{t.products.lowStock}{opt}<input className="input" dir="ltr" inputMode="decimal" value={f.lowStock} onChange={(e) => set('lowStock', e.target.value)} placeholder="0" /></label>
      </div>}
      {isShop && <section className="grid gap-3 rounded-2xl border border-[var(--line)] p-3">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={f.online} onChange={(e) => set('online', e.target.checked)} />
          <span><b className="block font-medium">{shopW.online}</b><span className="sub">{shopW.onlineHint}</span></span></label>
        {f.online && <label className="field">{shopW.desc}{opt}<textarea className="input" rows={3} maxLength={2000} placeholder={shopW.descHint} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>}
      </section>}
      {(f.unit === 'kg' || f.unit === 'g') && <label className="field">{t.tillSettings.scaleCode}{opt}<input className="input" dir="ltr" inputMode="numeric" placeholder="00042" value={f.scaleCode} onChange={(e) => set('scaleCode', e.target.value)} /><small>{t.tillSettings.scaleHint}</small></label>}
      {!showPack ? <button className="link-arrow justify-self-start text-sm" onClick={() => setShowPack(true)}>+ {t.pack.section}</button> : (
        <section className="grid gap-3 rounded-2xl border border-[var(--line)] p-3">
          <p className="sec-t !mb-0">{t.pack.section}</p><p className="sub -mt-2">{t.pack.hint}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">{t.pack.packSize}<input className="input" dir="ltr" inputMode="numeric" placeholder="24" value={f.packSize} onChange={(e) => set('packSize', e.target.value.replace(/[^\d٠-٩]/g, ''))} /></label>
            <label className="field">{t.pack.packPrice}{opt}<DinarInput value={f.packPrice} onChange={(v) => set('packPrice', v)} placeholder={f.price && f.packSize ? String(f.price * Number(toLatin(f.packSize))) : ''} /></label>
          </div>
          <label className="field">{t.pack.packBarcode}{opt}<div className="search"><Icon n="scan" /><input className="input" dir="ltr" inputMode="numeric" value={f.packBarcode} onChange={(e) => set('packBarcode', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} /></div></label>
        </section>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </Sheet>
  );
}

function ProductSheet({ product: p, onClose }: { product: Product; onClose(): void }) {
  const { t, can, qty, dateTime, toast, errorText } = useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<'receive' | 'count' | 'damage'>('receive');
  const [n, setN] = useState(''); const [cost, setCost] = useState<number | null>(null);
  const [byPack, setByPack] = useState(false);
  const factor = byPack && p.packSize ? p.packSize : 1;
  const [confirm, setConfirm] = useState(false);
  const moves = useQuery({ queryKey: ['moves', p.id], queryFn: async () => (await api(`/v1/sys/products/${p.id}/moves`)).moves as any[] });
  const move = useMutation({
    mutationFn: () => api(`/v1/sys/products/${p.id}/stock`, { body: { kind, qty: Number(toLatin(n)) * (kind === 'count' ? 1 : factor), cost: kind === 'receive' && cost != null ? Math.round(cost / factor) : undefined } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['moves', p.id] }); setN(''); setCost(null); toast(t.products.saved); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const archive = useMutation({
    mutationFn: () => api(`/v1/sys/products/${p.id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast(t.products.archived); onClose(); },
  });
  if (editing) return <ProductForm product={p} onClose={() => setEditing(false)} />;
  return (
    <Sheet title={p.name} sub={[p.category, p.barcode, p.packSize ? `${fill(t.pack.of, { n: p.packSize })}${p.packBarcode ? ' · ' + p.packBarcode : ''}` : null].filter(Boolean).join(' · ')} onClose={onClose} icon={<Thumb p={p} />}
      footer={can('products.manage') && <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-secondary justify-center" onClick={() => setEditing(true)}><Icon n="edit" className="h-4 w-4" />{t.products.edit}</button>
        <button className="btn btn-danger justify-center" onClick={() => (confirm ? archive.mutate() : (setConfirm(true), setTimeout(() => setConfirm(false), 3000)))}>{confirm ? t.products.archiveConfirm : t.products.archive}</button>
      </div>}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="panel p-3"><p className="sub">{t.products.price}</p><b className="text-lg"><Money v={p.price} /></b></div>
        <div className="panel p-3"><p className="sub">{t.products.cost}</p><b className="text-lg"><Money v={p.cost} /></b></div>
        <div className="panel p-3"><p className="sub">{t.products.stock}</p><b className={`text-lg ${isLow(p) ? 'text-[var(--warn)]' : ''}`}>{p.trackStock ? qty(p.stock, p.unit) : '—'}</b></div>
      </div>
      {p.trackStock && can('stock.adjust') && <section>
        <p className="sec-t">{t.products.stockTitle}</p>
        <div className="seg mb-3">{(['receive', 'count', 'damage'] as const).map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{t.products[k]}</button>)}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">{t.products.qty}<input className="input" dir="ltr" inputMode="decimal" value={n} onChange={(e) => setN(e.target.value)} placeholder={kind === 'count' ? qty(p.stock, p.unit) : '0'} /></label>
          {kind === 'receive' && <label className="field">{t.products.newCost}<DinarInput value={cost} onChange={setCost} placeholder={p.cost ? String(p.cost) : ''} /></label>}
        </div>
        {kind !== 'count' && p.packSize && <div className="seg mt-3 max-w-xs text-sm"><button aria-pressed={!byPack} onClick={() => setByPack(false)}>{t.pack.piece}</button><button aria-pressed={byPack} onClick={() => setByPack(true)}>{fill(t.pack.of, { n: p.packSize })}</button></div>}
        {byPack && kind !== 'count' && n && <p className="sub mt-2">= {qty(Number(toLatin(n)) * factor, p.unit)}</p>}
        {kind === 'count' && <p className="sub mt-2">{t.products.countHint}</p>}
        <button className="btn btn-accent btn-sm mt-3" disabled={!n || move.isPending} onClick={() => move.mutate()}><Icon n="check" className="h-4 w-4" />{t.products.save}</button>
      </section>}
      <section>
        <p className="sec-t">{t.products.moves}</p>
        <ul className="ledger">
          {(moves.data ?? []).map((m) => (
            <li key={m.id}><span>{t.products.moveKinds[m.kind] ?? m.kind}<span className="sub block">{dateTime(m.at)}{m.note ? ` · ${m.note}` : ''}</span></span>
              <span className="text-end"><b className={m.qty > 0 ? 'minus' : 'plus'} dir="ltr">{m.qty > 0 ? '+' : ''}{qty(m.qty, p.unit)}</b><span className="sub block">→ {qty(m.stock, p.unit)}</span></span></li>
          ))}
        </ul>
      </section>
    </Sheet>
  );
}
