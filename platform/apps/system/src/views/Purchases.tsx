// Purchases: suppliers (what the shop owes each wholesaler) and delivery invoices (stock in, costs updated).
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Product } from '../lib/api';
import { useApp, useRoute, go, fill, localPhone, initials } from '../lib/app';
import { DinarInput, Empty, Icon, Money, Sheet, toLatin } from '../components/ui';
import { useProducts } from './Sell';
import { Attachments } from '../components/Images';
import type { UploadedFile } from '../lib/api';
import { ScanInvoice, type Draft, type DraftLine } from '../components/Ai';

export function Purchases() {
  const { t, can, num } = useApp();
  const { params } = useRoute();
  const tab = params.get('tab') === 'invoices' ? 'invoices' : 'suppliers';
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: async () => (await api('/v1/sys/suppliers')).suppliers as any[] });
  const invoices = useQuery({ queryKey: ['purchases'], queryFn: async () => (await api('/v1/sys/purchases')).purchases as any[], enabled: tab === 'invoices' });
  const owed = (suppliers.data ?? []).filter((s) => s.balance > 0).reduce((a, s) => a + s.balance, 0);
  const open = params.get('id'), inv = params.get('invoice');
  const back = `#/purchases${tab === 'invoices' ? '?tab=invoices' : ''}`;
  return (
    <div className="grid gap-4">
      <div className="kpis !grid-cols-1 sm:!grid-cols-2">
        <div className="panel kpi"><p>{t.purchases.totalOwed}</p><p className="v text-[var(--warn)]"><Money v={owed} /></p><p className="d">{t.purchases.suppliers}: {num((suppliers.data ?? []).length)}</p></div>
        <div className="flex flex-col justify-center gap-3">
          {can('purchases.create') && <a className="btn btn-accent self-start" href="#/purchases?invoice=new"><Icon n="truck" className="h-5 w-5" />{t.purchases.newInvoice}</a>}
          {can('purchases.create') && <a className="btn btn-secondary btn-sm self-start" href="#/purchases?id=new"><Icon n="plus" className="h-4 w-4" />{t.purchases.newSupplier}</a>}
        </div>
      </div>
      <div className="seg max-w-md">
        <button aria-pressed={tab === 'suppliers'} onClick={() => go('#/purchases')}>{t.purchases.suppliers}</button>
        <button aria-pressed={tab === 'invoices'} onClick={() => go('#/purchases?tab=invoices')}>{t.purchases.invoices}</button>
      </div>
      {tab === 'suppliers' ? (
        <div className="panel rows overflow-clip">
          {suppliers.isLoading ? <div className="skeleton m-4 h-32" /> : !(suppliers.data ?? []).length ? <Empty icon="truck" text={t.purchases.noSuppliers} /> : suppliers.data!.map((s) => (
            <a key={s.id} className="row" href={`#/purchases?id=${s.id}`}>
              <span className="avatar">{initials(s.name)}</span>
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{s.name}</b><span className="sub" dir="ltr">{localPhone(s.phone) || ' '}</span></span>
              {s.balance > 0 ? <span className="text-end"><span className="sub block">{t.purchases.owe}</span><Money v={s.balance} className="font-semibold text-[var(--warn)]" /></span> : <span className="pill ok">{t.purchases.clear}</span>}
            </a>
          ))}
        </div>
      ) : (
        <div className="panel rows overflow-clip">
          {invoices.isLoading ? <div className="skeleton m-4 h-32" /> : !(invoices.data ?? []).length ? <Empty icon="truck" text={t.purchases.empty} /> : invoices.data!.map((p) => (
            <a key={p.id} className="row" href={`#/purchases?tab=invoices&invoice=${p.id}`}>
              <span className="thumb text-sm">#{p.number}</span>
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{p.supplierName ?? t.purchases.noSupplier}</b><span className="sub">{new Date(p.createdAt).toLocaleDateString()}{p.reference ? ` · ${p.reference}` : ''}</span></span>
              {p.due > 0 && <span className="pill warn">{t.purchases.due} <Money v={p.due} /></span>}
              <Money v={p.total} className="w-28 text-end font-semibold" />
            </a>
          ))}
        </div>
      )}
      {open === 'new' && <NewSupplier onClose={() => go(back)} />}
      {open && open !== 'new' && <SupplierSheet id={open} onClose={() => go(back)} />}
      {inv === 'new' && <NewInvoice suppliers={suppliers.data ?? []} onClose={() => go(back)} />}
      {inv && inv !== 'new' && <InvoiceSheet id={inv} onClose={() => go(back)} />}
    </div>
  );
}

function NewSupplier({ onClose }: { onClose(): void }) {
  const { t, errorText } = useApp();
  const qc = useQueryClient();
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => api('/v1/sys/suppliers', { body: { name, phone: phone || null } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['suppliers'] }); go(`#/purchases?id=${r.supplier.id}`); },
    onError: (e) => setError(errorText(e)),
  });
  return (
    <Sheet title={t.purchases.newSupplier} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{t.customers.save}</button>}>
      <label className="field">{t.purchases.name}<input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">{t.purchases.phone}<input className="input" dir="ltr" inputMode="tel" placeholder="07xx xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      {error && <p className="error">{error}</p>}
    </Sheet>
  );
}

function SupplierSheet({ id, onClose }: { id: string; onClose(): void }) {
  const { t, can, num, dateTime, toast, errorText } = useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['supplier', id], queryFn: () => api(`/v1/sys/suppliers/${id}`) });
  const [amount, setAmount] = useState<number | null>(null);
  const [fromDrawer, setFromDrawer] = useState(false);
  const pay = useMutation({
    mutationFn: () => api(`/v1/sys/suppliers/${id}/payments`, { body: { amount, fromDrawer } }),
    onSuccess: () => { ['suppliers', 'supplier', 'shift', 'report'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); setAmount(null); toast(t.purchases.paidToast); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const s = q.data?.supplier;
  if (!s) return <Sheet title="…" onClose={onClose}><div className="skeleton h-40" /></Sheet>;
  return (
    <Sheet title={s.name} sub={<span dir="ltr">{localPhone(s.phone)}</span>} onClose={onClose} icon={<span className="avatar !h-11 !w-11">{initials(s.name)}</span>}>
      <div className="flex items-center justify-between rounded-2xl bg-[var(--sunken)] p-4"><span className="muted">{t.purchases.owe}</span><Money v={s.balance} className="text-2xl font-bold text-[var(--warn)]" /></div>
      {s.phone && <a className="btn btn-secondary justify-center" href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"><Icon n="wa" className="h-5 w-5" />WhatsApp</a>}
      {can('purchases.create') && <section>
        <p className="sec-t">{t.purchases.pay}</p>
        <div className="flex gap-2"><DinarInput value={amount} onChange={setAmount} placeholder={s.balance > 0 ? num(s.balance) : '0'} /><button className="btn btn-accent shrink-0" disabled={!amount || pay.isPending} onClick={() => pay.mutate()}>{t.customers.record}</button></div>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={fromDrawer} onChange={(e) => setFromDrawer(e.target.checked)} />{t.purchases.fromDrawer}</label>
      </section>}
      <section>
        <p className="sec-t">{t.customers.history}</p>
        <ul className="ledger">{(q.data.ledger ?? []).map((l: any) => (
          <li key={l.id}><span>{t.purchases.kinds[l.kind] ?? l.kind}{l.purchaseNumber ? ` · ${fill(t.purchases.invoiceN, { n: l.purchaseNumber })}` : ''}{l.reference ? ` · ${l.reference}` : ''}<span className="sub block">{dateTime(l.at)}{l.fromDrawer ? ` · ${t.purchases.fromDrawer}` : ''}</span></span>
            <span className="text-end"><b className={l.amount > 0 ? 'plus' : 'minus'} dir="ltr">{l.amount > 0 ? '+' : '−'}{num(Math.abs(l.amount))}</b><span className="sub block"><Money v={l.balance} /></span></span></li>
        ))}</ul>
      </section>
    </Sheet>
  );
}

type Line = { product: Product; pack: boolean; qty: number; cost: number | null; ai?: 'sure' | 'check' };

function NewInvoice({ suppliers, onClose }: { suppliers: any[]; onClose(): void }) {
  const { t, num, toast, errorText } = useApp();
  const qc = useQueryClient();
  const products = useProducts();
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? '');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState('');
  const [paid, setPaid] = useState<number | null>(null);
  const [fromDrawer, setFromDrawer] = useState(false);
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [unmatched, setUnmatched] = useState<DraftLine[]>([]);
  const [pending, setPending] = useState<DraftLine | null>(null);
  const [named, setNamed] = useState<{ name: string; total: number; sumOff: boolean; usd: boolean } | null>(null);
  const list = products.data ?? [];
  const needle = toLatin(q.trim().toLowerCase());
  const found = useMemo(() => (needle ? list.filter((p) => p.name.toLowerCase().includes(needle) || p.barcode === needle || p.packBarcode === needle).slice(0, 8) : []), [list, needle]);
  const total = lines.reduce((s, l) => s + Math.round(l.qty * (l.cost ?? 0)), 0);
  const add = (p: Product, pack = false) => {
    if (pending) {
      const asPack = pack || (!!p.packSize && /كارتون|كرتون|صندوق|carton|box|case/i.test(pending.name));
      setLines((x) => [...x, { product: p, pack: asPack, qty: pending.qty, cost: pending.unitPrice, ai: 'check' }]);
      setUnmatched((u) => u.filter((l) => l !== pending)); setPending(null); setQ(''); return;
    }
    setLines((x) => [...x, { product: p, pack, qty: 1, cost: pack && p.cost != null && p.packSize ? p.cost * p.packSize : p.cost }]); setQ('');
  };
  /** A draft from the photographed invoice: the lines it matched go in (marked), the rest wait to be matched by hand. */
  const applyDraft = (d: Draft) => {
    const byId = new Map(list.map((p) => [p.id, p]));
    const matched = d.lines.filter((l) => l.productId && byId.has(l.productId));
    setLines(matched.map((l) => ({ product: byId.get(l.productId!)!, pack: l.pack && !!byId.get(l.productId!)!.packSize, qty: l.qty, cost: d.currency === 'USD' ? null : l.unitPrice, ai: l.confidence === 'sure' ? 'sure' : 'check' })));
    setUnmatched(d.lines.filter((l) => !matched.includes(l) && l.qty > 0));
    setSupplierId(d.supplier.id ?? ''); // never leave another supplier picked by default
    if (d.reference) setReference(d.reference);
    setPaid(d.paid || null);
    setNamed({ name: d.supplier.id ? '' : d.supplier.name, total: d.total, sumOff: !d.sumMatches, usd: d.currency === 'USD' });
  };
  const addNamedSupplier = async () => {
    if (!named?.name) return;
    try { const r = await api('/v1/sys/suppliers', { body: { name: named.name } }); qc.invalidateQueries({ queryKey: ['suppliers'] }); suppliers.push(r.supplier); setSupplierId(r.supplier.id); setNamed({ ...named, name: '' }); }
    catch (e) { toast(errorText(e), 'bad'); }
  };
  const scan = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const p = list.find((x) => x.barcode === needle), pk = list.find((x) => x.packBarcode === needle);
    if (p) add(p); else if (pk) add(pk, true); else if (found.length === 1) add(found[0]);
  };
  const set = (i: number, v: Partial<Line>) => setLines((x) => x.map((l, j) => (j === i ? { ...l, ...v } : l)));
  const save = useMutation({
    mutationFn: () => api('/v1/sys/purchases', { body: { supplierId: supplierId || null, reference: reference || null, paid: paid ?? (supplierId ? 0 : total), fromDrawer, attachmentIds: photos.map((p) => p.id),
      lines: lines.map((l) => ({ productId: l.product.id, qty: l.qty, cost: l.cost ?? 0, pack: l.pack })) } }),
    onSuccess: () => { ['products', 'purchases', 'suppliers', 'shift', 'report'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(t.purchases.saved); onClose(); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const due = total - (paid ?? (supplierId ? 0 : total));
  return (
    <Sheet title={t.purchases.newInvoice} onClose={onClose} icon={<span className="thumb"><Icon n="truck" className="h-5 w-5" /></span>}
      footer={<><div className="flex justify-between text-lg font-bold"><span>{t.purchases.total}</span><Money v={total} /></div>
        <button className="btn btn-accent justify-center" disabled={!lines.length || lines.some((l) => l.cost == null || !l.qty) || save.isPending} onClick={() => save.mutate()}>{t.purchases.save}</button></>}>
      <ScanInvoice onDraft={applyDraft} onPhoto={(f) => setPhotos((x) => [...x, f])} />
      {named?.name && <div className="note"><Icon n="truck" /><span className="flex-1">{fill(t.ai.newSupplier, { name: named.name })}</span><button type="button" className="btn btn-secondary btn-sm" onClick={addNamedSupplier}>{t.ai.addSupplier}</button></div>}
      {named?.sumOff && <div className="note warn"><Icon n="info" /><span>{fill(t.ai.sumOff, { total: num(named.total) })}</span></div>}
      {named?.usd && <div className="note warn"><Icon n="info" /><span>{t.ai.usd}</span></div>}
      {unmatched.length > 0 && <section className="ai-unmatched">
        <p className="sec-t !mb-1">{t.ai.unmatched}</p>
        {unmatched.map((l, i) => (
          <div key={i} className={`row${pending === l ? ' is-pending' : ''}`}>
            <span className="min-w-0 flex-1"><b className="block truncate font-medium" dir="auto">{l.name}</b><span className="sub" dir="ltr">{num(l.qty)} × {num(l.unitPrice)}</span></span>
            <button type="button" className="chip" onClick={() => { setPending(l); setQ(''); document.querySelector<HTMLInputElement>('.purchase-search input')?.focus(); }}>{t.ai.choose}</button>
            <button type="button" className="icon-btn" aria-label={t.ai.skip} onClick={() => { setUnmatched((u) => u.filter((x) => x !== l)); if (pending === l) setPending(null); }}><Icon n="close" /></button>
          </div>
        ))}
        {pending && <p className="sub">{fill(t.ai.choosing, { name: pending.name })}</p>}
      </section>}
      <div className="grid grid-cols-2 gap-3">
        <label className="field">{t.purchases.supplier}<select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">{t.purchases.noSupplier}</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field">{t.purchases.reference}<input className="input" dir="auto" value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      </div>
      <div className="search purchase-search"><Icon n="scan" /><input className="input" autoFocus placeholder={t.purchases.addProduct} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={scan} /></div>
      {found.length > 0 && <div className="panel rows -mt-2 max-h-56 overflow-y-auto">{found.map((p) => (
        <div key={p.id} className="row"><span className="min-w-0 flex-1 truncate">{p.name}</span>
          <button className="chip" onClick={() => add(p)}>{t.pack.piece}</button>{p.packSize && <button className="chip" onClick={() => add(p, true)}>{fill(t.pack.of, { n: p.packSize })}</button>}</div>
      ))}</div>}
      {lines.map((l, i) => (
        <div key={i} className="grid gap-2 rounded-2xl border border-[var(--line)] p-3">
          <div className="flex items-center gap-2"><b className="flex-1 truncate font-medium">{l.product.name}</b>{l.ai && <span className={`ai-tag${l.ai === 'check' ? ' check' : ''}`}><Icon n="sparkle" />{l.ai === 'check' ? t.ai.check : 'AI'}</span>}
            {l.product.packSize && <div className="seg !p-0.5 text-xs"><button aria-pressed={!l.pack} onClick={() => set(i, { pack: false, cost: l.product.cost })}>{t.pack.piece}</button><button aria-pressed={l.pack} onClick={() => set(i, { pack: true, cost: l.product.cost != null ? l.product.cost * l.product.packSize! : null })}>{fill(t.pack.of, { n: l.product.packSize })}</button></div>}
            <button className="icon-btn" onClick={() => setLines((x) => x.filter((_, j) => j !== i))} aria-label={t.cancel}><Icon n="trash" /></button></div>
          <div className="grid grid-cols-[6rem_1fr_auto] items-end gap-2">
            <label className="field">{t.products.qty}<input className="input" dir="ltr" inputMode="decimal" value={l.qty || ''} onChange={(e) => set(i, { qty: Number(toLatin(e.target.value).replace(/[^\d.]/g, '')) || 0 })} /></label>
            <label className="field">{t.purchases.cost} <small>{l.pack ? t.purchases.perCarton : t.purchases.perPiece}</small><DinarInput value={l.cost} onChange={(v) => set(i, { cost: v })} /></label>
            <Money v={Math.round(l.qty * (l.cost ?? 0))} className="pb-3 font-semibold" />
          </div>
          {l.pack && l.product.packSize && <p className="sub">= {num(l.qty * l.product.packSize)} {t.products.units[l.product.unit]}</p>}
        </div>
      ))}
      {lines.length > 0 && <section className="grid gap-2">
        <label className="field">{t.purchases.paid}<DinarInput value={paid ?? (supplierId ? 0 : total)} onChange={setPaid} /></label>
        {due > 0 && <div className="note"><Icon n="truck" /><span>{t.purchases.due}: <b><Money v={due} /></b></span></div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={fromDrawer} onChange={(e) => setFromDrawer(e.target.checked)} />{t.purchases.fromDrawer}</label>
      </section>}
      <section className="grid gap-2"><p className="sec-t !mb-0">{t.images.purchase}</p><p className="sub">{t.images.purchaseHint}</p><Attachments purpose="purchase" files={photos} onChange={setPhotos} /></section>
    </Sheet>
  );
}

function InvoiceSheet({ id, onClose }: { id: string; onClose(): void }) {
  const { t, num, dateTime, can } = useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['purchase', id], queryFn: () => api(`/v1/sys/purchases/${id}`) });
  const p = q.data?.purchase;
  if (!p) return <Sheet title="…" onClose={onClose}><div className="skeleton h-40" /></Sheet>;
  return (
    <Sheet title={fill(t.purchases.invoiceN, { n: p.number })} sub={`${dateTime(p.createdAt)}${p.reference ? ` · ${p.reference}` : ''}`} onClose={onClose} icon={<span className="thumb"><Icon n="truck" className="h-5 w-5" /></span>}>
      <div className="big-total"><span className="sub">{q.data.supplier?.name ?? t.purchases.noSupplier}</span><b><Money v={p.total} /></b></div>
      <ul className="ledger">{q.data.lines.map((l: any) => <li key={l.id}><span>{l.name}<span className="sub block" dir="ltr">{num(l.qty)}{l.packSize ? ` × ${l.packSize}` : ''} × {num(l.cost)}</span></span><Money v={l.total} className="font-semibold" /></li>)}</ul>
      <dl className="kv"><dt>{t.purchases.paid}</dt><dd><Money v={p.paid} /></dd>{p.due > 0 && <><dt>{t.purchases.due}</dt><dd><Money v={p.due} /></dd></>}</dl>
      {(can('purchases.create') || q.data.attachments?.length > 0) && <section className="grid gap-2"><p className="sec-t !mb-0">{t.images.purchase}</p>
        <Attachments purpose="purchase" refId={p.id} files={q.data.attachments ?? []} readOnly={!can('purchases.create')}
          onChange={(files) => qc.setQueryData(['purchase', id], (old: any) => ({ ...old, attachments: files }))} /></section>}
    </Sheet>
  );
}
