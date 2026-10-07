// The checkout. A barcode scanner types the code and presses Enter, so the scan box keeps focus and adds on Enter.
// Enter on an empty box opens payment. Works offline: the sale waits on the device and is sent when the internet returns.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, newClientId, outbox, remembered, type Customer, type Product, type Sale, type SaleLine } from '../lib/api';
import { useApp, fill, localPhone, go } from '../lib/app';
import { DinarInput, Empty, Icon, Money, Sheet, toLatin } from '../components/ui';
import { Receipt, receiptText, receiptData, printSale } from '../components/Receipt';
import { toDisplay, onDisplay, openDisplay } from '../lib/display';
import { printerPrefs } from '../lib/escpos';

export interface CartLine { product: Product; qty: number; price: number; pack: boolean }
const key = (l: { product: Product; pack: boolean }) => l.product.id + (l.pack ? ':pack' : '');
const packPrice = (p: Product) => p.packPrice ?? p.price * (p.packSize ?? 1);

/** Products for this business, kept on the device too so scanning works without internet. */
export function useProducts() {
  const { sys } = useApp();
  const key = `hemlo.products.${sys.business.id}`;
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => { const { products } = await api('/v1/sys/products'); try { localStorage.setItem(key, JSON.stringify(products)); } catch {} return products; },
    initialData: () => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? undefined; } catch { return undefined; } },
    initialDataUpdatedAt: 0,
  });
}

/** Scale format and FIB status for this shop, kept on the device too. */
export function useTillSettings() {
  const { sys } = useApp();
  return useQuery<any>({ queryKey: ['settings'], queryFn: () => remembered(`settings.${sys.business.id}`, () => api('/v1/sys/settings')) });
}

/** A label-scale barcode (EAN-13: prefix, item code, weight or price, check digit) → product and quantity. */
export function readScaleCode(code: string, scale: { enabled: boolean; prefixes: string[]; mode: 'weight' | 'price' } | undefined, list: Product[]) {
  if (!scale?.enabled || !/^\d{13}$/.test(code)) return null;
  const prefix = scale.prefixes.find((p) => code.startsWith(p));
  if (!prefix) return null;
  const item = String(Number(code.slice(prefix.length, 7))), value = Number(code.slice(7, 12));
  const p = list.find((x) => x.scaleCode === item);
  if (!p || !value) return null;
  const qty = scale.mode === 'weight' ? value / 1000 : Math.round((value / p.price) * 1000) / 1000;
  return qty > 0 ? { product: p, qty } : null;
}

export function Sell() {
  const { t, can, toast, money, qty: fq, num, sys, lang } = useApp();
  const products = useProducts();
  const settings = useTillSettings();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ sale: Sale | null; lines: SaleLine[]; customer: Customer | null; offline?: boolean; change?: number } | null>(null);
  const scan = useRef<HTMLInputElement>(null);
  const list = products.data ?? [];

  // back to the scan box, unless the cashier has already moved into another field (a quantity, a price)
  const refocus = () => setTimeout(() => { const el = document.activeElement; if (!el || el === document.body || el === scan.current || !(el as HTMLElement).matches('input,textarea,select')) scan.current?.focus(); }, 30);
  const add = (p: Product, n = 1, pack = false) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id && l.pack === pack);
      if (i < 0) return [...c, { product: p, qty: n, price: pack ? packPrice(p) : p.price, pack }];
      const next = [...c]; next[i] = { ...next[i], qty: Math.round((next[i].qty + n) * 1000) / 1000 }; return next;
    });
    setQ(''); refocus();
  };
  const setQty = (k: string, n: number) => setCart((c) => (n <= 0 ? c.filter((l) => key(l) !== k) : c.map((l) => (key(l) === k ? { ...l, qty: n } : l))));
  const setPack = (k: string, pack: boolean) => setCart((c) => c.map((l) => (key(l) === k ? { ...l, pack, qty: pack ? Math.max(1, Math.round(l.qty)) : l.qty, price: pack ? packPrice(l.product) : l.product.price } : l)));

  const needle = toLatin(q.trim().toLowerCase());
  const shown = useMemo(() => (needle ? list.filter((p) => p.name.toLowerCase().includes(needle) || p.barcode?.startsWith(needle) || p.packBarcode === needle) : list).slice(0, 60), [list, needle]);
  const subtotal = cart.reduce((s, l) => s + Math.round(l.qty * l.price), 0);
  const total = Math.max(0, subtotal - (discount ?? 0));
  const count = cart.reduce((s, l) => s + (l.pack ? l.qty * (l.product.packSize ?? 1) : l.product.unit === 'piece' || l.product.unit === 'box' || l.product.unit === 'pack' ? l.qty : 1), 0);

  /** A code from the scanner (or typed): a product, a carton, or a weighed label from the scale. */
  const handleCode = (code: string) => {
    const exact = list.find((p) => p.barcode === code);
    if (exact) { add(exact); return true; }
    const carton = list.find((p) => p.packBarcode === code);
    if (carton) { add(carton, 1, true); return true; }
    const weighed = readScaleCode(code, settings.data?.scale, list);
    if (weighed) { add(weighed.product, weighed.qty); return true; }
    return false;
  };
  // scans that arrive before the product list has loaded wait for it (never "not found" for a product that exists)
  const early = useRef<string[]>([]);
  useEffect(() => {
    if (!products.data || !early.current.length) return;
    for (const code of early.current.splice(0)) if (!handleCode(code)) toast(fill(t.sell.notFound, { code }), 'bad');
  }, [products.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setQ(''); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!needle) { if (cart.length) setPaying(true); return; }
    if (!products.data && /^\d{6,}$/.test(needle)) { early.current.push(needle); setQ(''); return; }
    if (handleCode(needle)) return;
    if (shown.length === 1) return add(shown[0]);
    if (/^\d{6,}$/.test(needle)) { toast(fill(t.sell.notFound, { code: needle }), 'bad'); setQ(''); }
  };

  // keep typing going to the scan box: a scanner fires keys wherever focus is
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (paying || done || el.matches('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1) scan.current?.focus();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [paying, done]);

  const newSale = () => { setCart([]); setDiscount(null); setDone(null); refocus(); };

  // the customer display follows the receipt as it's built
  const cartMsg = () => ({ type: 'cart' as const, shop: sys.business.name, logo: sys.business.logoUrl ?? null, lang, total, count, lines: cart.map((l) => ({ name: l.product.name + (l.pack ? ` · ${fill(t.pack.of, { n: l.product.packSize! })}` : ''), qty: `× ${num(l.qty)}`, total: Math.round(l.qty * l.price) })) });
  useEffect(() => { if (!done) toDisplay(cartMsg()); }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onDisplay((m) => { if (m.type === 'hello') toDisplay(cartMsg()); }));

  return (
    <div className="sell">
      <section className="grid gap-4">
        <div className="scan search">
          <Icon n="scan" />
          <input ref={scan} className="input" autoFocus placeholder={t.sell.scan} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onScan} inputMode="search" aria-label={t.sell.scan} />
        </div>
        {sys.business.demo && list.length > 0 && <TryCodes list={list} onCode={handleCode} />}
        {products.isLoading && !list.length ? <div className="grid-products">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-24" />)}</div>
          : !list.length ? <div className="panel"><Empty text={t.products.empty} action={can('products.manage') && <a className="btn btn-accent btn-sm" href="#/products?id=new">{t.products.add}</a>} /></div>
          : (
            <div className="grid-products">
              {shown.map((p) => {
                const low = p.trackStock && p.stock <= (p.lowStock ?? 0);
                return (
                  <button key={p.id} className={`tile${low ? ' low' : ''}${p.imageUrl ? ' has-img' : ''}`} onClick={() => add(p)}>
                    {p.imageUrl && <span className="tile-img"><img src={p.imageUrl} alt="" loading="lazy" /></span>}
                    <b>{p.name}</b>
                    <span className="flex items-end justify-between gap-2">
                      <span className="p"><Money v={p.price} />{p.unit === 'kg' && <span className="sub">{t.sell.perKg}</span>}</span>
                      {p.trackStock && <span className="s">{p.stock > 0 ? fill(t.sell.stockLeft, { n: num(p.stock) }) : t.sell.noStock}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
      </section>

      <aside className="panel cart">
        <div className="panel-h"><h2>{t.sell.cart}{cart.length > 0 && <span className="sub ms-2">{fill(t.sell.items, { n: num(count) })}</span>}</h2>
          <span className="flex gap-2"><button className="icon-btn" title={t.display.open} aria-label={t.display.open} onClick={openDisplay}><Icon n="display" /></button>
          {cart.length > 0 && <button className="btn btn-secondary btn-sm" onClick={newSale}>{t.sell.clear}</button>}</span></div>
        <div className="cart-lines">
          {!cart.length ? <p className="sub px-5 pb-6 pt-2">{t.sell.empty}</p> : cart.map((l) => (
            <div key={key(l)} className="line">
              <span className="n truncate">{l.product.name}{l.pack && <span className="pill accent ms-2">{fill(t.pack.of, { n: l.product.packSize! })}</span>}</span>
              <span className="t"><Money v={Math.round(l.qty * l.price)} /></span>
              <span className="flex items-center gap-2">
                <span className="stepper">
                  <button onClick={() => setQty(key(l), Math.round((l.qty - 1) * 1000) / 1000)} aria-label="−"><Icon n={l.qty <= 1 ? 'trash' : 'minus'} className="h-4 w-4" /></button>
                  <input inputMode="decimal" dir="ltr" value={num(l.qty)} onChange={(e) => { const n = Number(toLatin(e.target.value).replace(/[^\d.]/g, '')); if (Number.isFinite(n)) setQty(key(l), n); }} aria-label={t.products.qty} />
                  <button onClick={() => setQty(key(l), Math.round((l.qty + 1) * 1000) / 1000)} aria-label="+"><Icon n="plus" className="h-4 w-4" /></button>
                </span>
                {!l.pack && l.product.unit !== 'piece' && <span className="sub">{t.products.units[l.product.unit]}</span>}
                {l.product.packSize && <button className="chip !px-2 !py-1 text-xs" onClick={() => setPack(key(l), !l.pack)}>{l.pack ? t.pack.piece : t.pack.carton}</button>}
              </span>
              <span className="text-end">
                {can('products.manage')
                  ? <input className="price-edit money" inputMode="numeric" dir="ltr" value={num(l.price)} aria-label={t.products.price}
                      onChange={(e) => { const n = Number(toLatin(e.target.value).replace(/\D/g, '')); setCart((c) => c.map((x) => (key(x) === key(l) ? { ...x, price: n } : x))); }} />
                  : <span className="sub">× {money(l.price)}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="totals">
          {discount != null && discount > 0 && <>
            <div className="flex justify-between text-sm"><span className="muted">{t.sell.subtotal}</span><Money v={subtotal} /></div>
            <div className="flex justify-between text-sm"><span className="muted">{t.sell.discount}</span><span>− <Money v={discount} /></span></div>
          </>}
          <div className="grand"><span>{t.sell.total}</span><Money v={total} /></div>
          <button className="btn btn-accent pay-btn" disabled={!cart.length} onClick={() => setPaying(true)}>{t.sell.pay} <kbd>Enter</kbd></button>
        </div>
      </aside>

      {cart.length > 0 && !paying && !done && <div className="cart-bar" role="region" aria-label={t.sell.cart}>
        <button className="text-start" onClick={() => document.querySelector('.cart')?.scrollIntoView({ behavior: 'smooth' })}><span className="block text-xs opacity-75">{fill(t.sell.items, { n: num(count) })}</span><b><Money v={total} /></b></button>
        <button className="btn btn-accent btn-sm" onClick={() => setPaying(true)}>{t.sell.pay}</button>
      </div>}
      {paying && <Pay cart={cart} subtotal={subtotal} discount={discount} setDiscount={setDiscount} total={total} fibOn={!!settings.data?.fib?.connected}
        onClose={() => { setPaying(false); refocus(); }} onDone={(r) => { setPaying(false); setDone(r); }} />}
      {done && <Done result={done} onNew={newSale} />}
      {done && <Receipt sale={done.sale} lines={done.lines} customer={done.customer} change={done.change} />}
      {products.error && !list.length && <p className="error">{t.errors.network}</p>}
    </div>
  );
}

// ---------------- the demo shop: codes to tap, as if scanned (the same codes the demo was stocked with) ----------------
const DEMO_CODES = { can: '6281036001017', carton: '6281036101014', scale: '2100042012503' } as const;
function TryCodes({ list, onCode }: { list: Product[]; onCode(code: string): boolean }) {
  const { t } = useApp();
  const name = (k: keyof typeof DEMO_CODES) => (k === 'scale' ? list.find((p) => p.scaleCode === '42') : list.find((p) => p.barcode === DEMO_CODES[k] || p.packBarcode === DEMO_CODES[k]))?.name;
  return (
    <div className="try">
      <p className="text-sm"><b>{t.demo.tryTitle}</b> <span className="muted">{t.demo.tryBody}</span></p>
      <div className="try-codes">
        {(Object.keys(DEMO_CODES) as (keyof typeof DEMO_CODES)[]).map((k) => (
          <button key={k} className="try-code" onClick={() => onCode(DEMO_CODES[k])}>
            <span>{name(k)} · {t.demo[k]}</span><code>{DEMO_CODES[k]}</code>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- payment ----------------
function Pay({ cart, subtotal, discount, setDiscount, total, fibOn, onClose, onDone }: {
  cart: CartLine[]; subtotal: number; discount: number | null; setDiscount(v: number | null): void; total: number; fibOn: boolean; onClose(): void;
  onDone(r: { sale: Sale | null; lines: SaleLine[]; customer: Customer | null; offline?: boolean; change?: number }): void;
}) {
  const { t, errorText } = useApp();
  const qc = useQueryClient();
  const [method, setMethod] = useState<'cash' | 'card' | 'credit' | 'fib'>('cash');
  const [received, setReceived] = useState<number | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [paidNow, setPaidNow] = useState<number | null>(null);
  const [showDiscount, setShowDiscount] = useState(!!discount);
  const [error, setError] = useState('');
  const change = received != null ? received - total : null;
  const quick = [...new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 25000) * 25000, Math.ceil(total / 50000) * 50000])].filter((x) => x >= total).slice(0, 5);

  const sell = useMutation({
    mutationFn: async (fibPaymentId?: string) => {
      const body = { clientId: newClientId(), method: fibPaymentId ? 'fib' : method, fibPaymentId, customerId: customer?.id ?? null, discount: discount ?? 0, paid: method === 'credit' ? paidNow ?? 0 : undefined,
        lines: cart.map((l) => ({ productId: l.product.id, qty: l.qty, price: l.price, pack: l.pack })) };
      try { return await api('/v1/sys/sales', { body }); }
      catch (e) {
        if (e instanceof ApiError && e.status === 0 && !fibPaymentId) { outbox.add({ clientId: body.clientId, body, at: Date.now() }); return { offline: true, sale: null, lines: [], customer }; }
        throw e;
      }
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['customers'] }); qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['report'] }); qc.invalidateQueries({ queryKey: ['shift'] });
      onDone({ sale: r.sale, lines: r.lines, customer: r.customer, offline: r.offline, change: method === 'cash' && change && change > 0 ? change : undefined });
    },
    onError: (e) => setError(errorText(e)),
  });
  const ready = method === 'fib' ? false : method !== 'credit' || !!customer;

  return (
    <Sheet center title={t.sell.payTitle} onClose={onClose}
      footer={method !== 'fib' && <button className="btn btn-accent pay-btn" disabled={!ready || sell.isPending} onClick={() => sell.mutate(undefined)}><Icon n="check" className="h-5 w-5" />{t.sell.confirm}</button>}>
      <div className="big-total"><span className="sub">{t.sell.total}</span><b><Money v={total} /></b>
        {!showDiscount ? <button className="link-arrow mt-1 text-sm" onClick={() => setShowDiscount(true)}>+ {t.sell.discount}</button>
          : <div className="mx-auto mt-2 flex max-w-xs items-center gap-2"><span className="sub shrink-0">{t.sell.discount}</span><DinarInput value={discount} onChange={(v) => setDiscount(v && v > subtotal ? subtotal : v)} /></div>}
      </div>
      <div className="seg" role="group">
        {([...(['cash', 'card'] as const), ...(fibOn ? ['fib' as const] : []), 'credit' as const]).map((m) => <button key={m} aria-pressed={method === m} onClick={() => { setMethod(m); setError(''); }}>{t.sell.method[m]}</button>)}
      </div>
      {method === 'cash' && <div className="grid gap-3">
        <label className="field">{t.sell.received}<DinarInput value={received} onChange={setReceived} autoFocus /></label>
        <div className="chips">{quick.map((v) => <button key={v} className="chip" aria-pressed={received === v} onClick={() => setReceived(v)}>{v === total ? t.sell.exact : <Money v={v} />}</button>)}</div>
        {change != null && <div className={`change${change < 0 ? ' short' : ''}`}><span>{change < 0 ? t.sell.short : t.sell.change}</span><Money v={Math.abs(change)} /></div>}
      </div>}
      {method === 'credit' && <div className="grid gap-3">
        <CustomerPicker value={customer} onChange={setCustomer} />
        {customer && <>
          <label className="field">{t.sell.paidNow}<DinarInput value={paidNow} onChange={(v) => setPaidNow(v != null && v > total ? total : v)} placeholder="0" /></label>
          <div className="note"><Icon n="customers" /><span>{t.sell.onAccount}: <b><Money v={total - (paidNow ?? 0)} /></b></span></div>
        </>}
      </div>}
      {method === 'fib' && <FibBox amount={total} onPaid={(id) => sell.mutate(id)} busy={sell.isPending} />}
      {error && <p className="error" role="alert">{error}</p>}
    </Sheet>
  );
}

/** FIB at the till: a QR code for the customer's FIB app (also on the customer display). The sale goes through by itself once FIB confirms. */
function FibBox({ amount, onPaid, busy }: { amount: number; onPaid(id: string): void; busy: boolean }) {
  const { t, sys, lang, errorText } = useApp();
  const [p, setP] = useState<any>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const sent = useRef(false);
  const create = async () => {
    setError(''); setP(null); sent.current = false;
    if (!navigator.onLine) return setError(t.fib.offline);
    try { const r = await api('/v1/sys/fib/payments', { body: { amount, description: sys.business.name } }); setP(r.payment); toDisplay({ type: 'fib', shop: sys.business.name, lang, qr: r.payment.qrCode, code: r.payment.readableCode, amount }); }
    catch (e) { setError(errorText(e)); }
  };
  useEffect(() => { create(); }, [amount]); // eslint-disable-line react-hooks/exhaustive-deps
  // ask every 2 seconds; the server checks with FIB itself
  useEffect(() => {
    if (!p || p.status !== 'UNPAID') return;
    const timer = setInterval(async () => { setNow(Date.now()); try { const r = await api(`/v1/sys/fib/payments/${p.id}`); if (r.payment.status !== 'UNPAID') setP(r.payment); } catch {} }, 2000);
    return () => clearInterval(timer);
  }, [p]);
  useEffect(() => { if (p?.status === 'PAID' && !sent.current) { sent.current = true; onPaid(p.id); } }, [p, onPaid]);
  // leaving the payment screen cancels a code that wasn't paid
  const latest = useRef<any>(null);
  latest.current = p;
  useEffect(() => () => { const x = latest.current; if (x?.status === 'UNPAID') api(`/v1/sys/fib/payments/${x.id}/cancel`, { body: {} }).catch(() => {}); }, []);
  const left = p?.validUntil ? Math.max(0, Math.floor((new Date(p.validUntil).getTime() - now) / 1000)) : 0;
  if (error) return <div className="grid gap-3"><p className="error" role="alert">{error}</p><button className="btn btn-secondary justify-center" onClick={create}>{t.fib.again}</button></div>;
  if (!p) return <div className="fib-status py-10"><span className="spinner" />{t.fib.title}</div>;
  if (p.status === 'PAID') return <div className="change"><span>{t.fib.paid}{p.paidBy ? ` · ${fill(t.fib.paidBy, { name: p.paidBy })}` : ''}</span>{busy ? <span className="spinner" /> : <Icon n="check" className="h-5 w-5" />}</div>;
  if (p.status !== 'UNPAID' || left === 0) return <div className="grid gap-3"><p className="error">{p.status === 'DECLINED' ? t.fib.declined : t.fib.expired}</p><button className="btn btn-secondary justify-center" onClick={create}>{t.fib.again}</button></div>;
  return (
    <div className="grid gap-3">
      <p className="text-center font-medium">{t.fib.scan}</p>
      <img className="fib-qr" src={p.qrCode} alt="FIB" />
      <p className="sub -mb-2 text-center">{t.fib.code}</p>
      <p className="fib-code" dir="ltr">{p.readableCode}</p>
      <p className="fib-status"><span className="spinner" />{t.fib.waiting} · {fill(t.fib.left, { m: Math.floor(left / 60), s: String(left % 60).padStart(2, '0') })}</p>
    </div>
  );
}

/** Search the debt book, or add someone new on the spot. */
export function CustomerPicker({ value, onChange }: { value: Customer | null; onChange(c: Customer | null): void }) {
  const { t, errorText, toast, sys } = useApp();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const found = useQuery<Customer[]>({ queryKey: ['customers', q], queryFn: async () => (q ? (await api(`/v1/sys/customers?q=${encodeURIComponent(q)}`)).customers : remembered(`customers.${sys.business.id}`, async () => (await api('/v1/sys/customers')).customers)) });
  const create = useMutation({
    mutationFn: () => api('/v1/sys/customers', { body: { name, phone: phone || null } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['customers'] }); onChange(r.customer); setAdding(false); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  if (value) return (
    <div className="row panel"><span className="avatar">{value.name[0]}</span>
      <span className="min-w-0 flex-1"><b className="block truncate font-medium">{value.name}</b><span className="sub" dir="ltr">{localPhone(value.phone)}</span></span>
      <span className="text-end"><span className="sub block">{t.sell.balance}</span><Money v={value.balance} /></span>
      <button className="icon-btn" onClick={() => onChange(null)} aria-label={t.cancel}><Icon n="close" /></button></div>
  );
  if (adding) return (
    <div className="grid gap-2 rounded-2xl border border-[var(--line)] p-3">
      <input className="input" autoFocus placeholder={t.customers.name} value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" dir="ltr" inputMode="tel" placeholder="07xx xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="grid grid-cols-2 gap-2"><button className="btn btn-secondary btn-sm justify-center" onClick={() => setAdding(false)}>{t.cancel}</button>
        <button className="btn btn-accent btn-sm justify-center" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>{t.customers.save}</button></div>
    </div>
  );
  return (
    <div className="grid gap-2">
      <div className="search"><Icon n="search" /><input className="input" autoFocus placeholder={t.sell.searchCustomer} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="panel rows max-h-56 overflow-y-auto">
        {(found.data ?? []).slice(0, 30).map((c) => (
          <button key={c.id} className="row" onClick={() => onChange(c)}><span className="avatar">{c.name[0]}</span><span className="min-w-0 flex-1 truncate">{c.name}</span>{c.balance > 0 && <Money v={c.balance} className="sub" />}</button>
        ))}
        <button className="row text-[var(--accent)]" onClick={() => { setAdding(true); setName(q); }}><Icon n="plus" className="h-5 w-5" />{t.sell.newCustomer}</button>
      </div>
    </div>
  );
}

// ---------------- after the sale ----------------
function Done({ result, onNew }: { result: { sale: Sale | null; lines: SaleLine[]; customer: Customer | null; offline?: boolean; change?: number }; onNew(): void }) {
  const { t, sys, lang, me, dateTime, toast } = useApp();
  const btn = useRef<HTMLButtonElement>(null);
  const s = result.sale;
  const print = () => s && printSale(receiptData(lang, { shop: sys.business.name, logo: sys.business.logoUrl, city: sys.business.city, cashier: me.user.name, dateTime: dateTime(s.createdAt), sale: s, lines: result.lines, customer: result.customer, change: result.change }),
    s.method === 'cash' || s.method === 'mixed', () => toast(t.tillSettings.failed, 'bad'));
  useEffect(() => {
    btn.current?.focus();
    if (s) toDisplay({ type: 'done', shop: sys.business.name, lang, total: s.total, change: result.change });
    if (s && printerPrefs.get().auto) print();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const wa = s && result.customer?.phone ? `https://wa.me/${result.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(receiptText(lang, sys.business.name, s, result.lines, result.customer))}` : null;
  return (
    <Sheet center title={t.sell.done} sub={s ? fill(t.sell.receipt, { n: s.number }) : undefined} onClose={onNew} icon={<span className="thumb"><Icon n="check" className="h-5 w-5" /></span>}
      footer={<button ref={btn} className="btn btn-accent pay-btn" onClick={onNew}>{t.sell.newSale} <kbd>Enter</kbd></button>}>
      {result.offline ? <div className="note"><Icon n="wifi" /><span>{t.sell.offlineSaved}</span></div> : <>
        <div className="big-total"><span className="sub">{t.sell.total}</span><b><Money v={s!.total} /></b></div>
        {result.change != null && <div className="change"><span>{t.sell.change}</span><Money v={result.change} /></div>}
        {s!.due > 0 && <div className="note"><Icon n="customers" /><span>{t.sell.onAccount}: <b><Money v={s!.due} /></b> · {result.customer?.name}</span></div>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-secondary justify-center" onClick={print}><Icon n="print" className="h-5 w-5" />{t.sell.print}</button>
          {wa ? <a className="btn btn-secondary justify-center" href={wa} target="_blank" rel="noopener"><Icon n="wa" className="h-5 w-5" />{t.sell.whatsapp}</a>
            : <button className="btn btn-secondary justify-center" onClick={() => go('#/sales')}><Icon n="sales" className="h-5 w-5" />{t.nav.sales}</button>}
        </div>
      </>}
    </Sheet>
  );
}
