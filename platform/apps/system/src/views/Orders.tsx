// The online shop's orders (Website add-on): what's waiting first, each one moved along in a tap (confirm, out for
// delivery or ready to collect, delivered), the customer told on WhatsApp at every step (Connect), and a delivered
// order becomes a sale. The checkout's rules (delivery fees, pickup, the smallest order) are set here too.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, useRoute, go } from '../lib/app';
import { DinarInput, Empty, Icon, Money, Sheet } from '../components/ui';

const W = {
  ar: { open: 'المفتوحة', done: 'المنتهية', empty: 'لا طلبات بعد. حين يطلب زبون من متجرك على الإنترنت يظهر طلبه هنا.', emptyDone: 'لا طلبات منتهية بعد.',
    status: { new: 'جديد', confirmed: 'مؤكَّد', ready: 'جاهز للاستلام', out: 'في الطريق', delivered: 'سُلِّم', canceled: 'ملغى' } as Record<string, string>,
    next: { confirmed: 'أكّد الطلب', ready: 'جاهز للاستلام', out: 'خرج للتوصيل', delivered: 'تم التسليم والدفع', canceled: 'ألغِ الطلب' } as Record<string, string>,
    delivery: 'توصيل', pickup: 'استلام', fee: 'التوصيل', subtotal: 'المجموع', total: 'الإجمالي', cod: 'الدفع عند الاستلام', call: 'اتصال', wa: 'واتساب', link: 'رابط الطلب', copied: 'نُسخ الرابط',
    note: 'ملاحظة الزبون', sale: 'صار بيعاً', moved: 'تم. وصل الزبون تحديث على واتساب إن كان Connect مفعّلاً.', reason: 'سبب الإلغاء (اختياري)', sure: 'تأكيد الإلغاء', items: '{n} منتج',
    settings: 'التوصيل والدفع', sDelivery: 'نوصّل الطلبات', sPickup: 'يمكن الاستلام من المتجر', sFee: 'رسوم التوصيل', sFees: 'رسوم لمدن معيّنة', sCity: 'المدينة', sAdd: 'أضف مدينة',
    sFree: 'توصيل مجاني فوق', sMin: 'أقل قيمة للطلب', sCities: 'المدن التي نوصّل إليها (فارغ: أي مكان)', sCitiesPh: 'بغداد، أربيل، البصرة', save: 'احفظ', saved: 'حُفظ', none: 'لا شيء', needSite: 'فعّل موقعك أولاً من صفحة الموقع.' },
  en: { open: 'Open', done: 'Done', empty: 'No orders yet. When a customer orders from your online shop, it shows here.', emptyDone: 'No finished orders yet.',
    status: { new: 'New', confirmed: 'Confirmed', ready: 'Ready to collect', out: 'On the way', delivered: 'Delivered', canceled: 'Canceled' },
    next: { confirmed: 'Confirm order', ready: 'Ready to collect', out: 'Out for delivery', delivered: 'Delivered and paid', canceled: 'Cancel order' },
    delivery: 'Delivery', pickup: 'Pickup', fee: 'Delivery', subtotal: 'Subtotal', total: 'Total', cod: 'Cash on delivery', call: 'Call', wa: 'WhatsApp', link: 'Order link', copied: 'Link copied',
    note: 'Customer’s note', sale: 'Became a sale', moved: 'Done. The customer got a WhatsApp update if Connect is on.', reason: 'Why it’s canceled (optional)', sure: 'Cancel the order', items: '{n} items',
    settings: 'Delivery & payment', sDelivery: 'We deliver orders', sPickup: 'Customers can pick up from the shop', sFee: 'Delivery fee', sFees: 'A different fee for some cities', sCity: 'City', sAdd: 'Add a city',
    sFree: 'Free delivery over', sMin: 'Smallest order', sCities: 'Cities we deliver to (empty: anywhere)', sCitiesPh: 'Baghdad, Erbil, Basra', save: 'Save', saved: 'Saved', none: 'None', needSite: 'Turn your website on first, from the Website page.' },
  ckb: { open: 'کراوە', done: 'تەواوبوو', empty: 'هێشتا هیچ داواکارییەک نییە. کاتێک کڕیارێک لە دوکانە ئۆنلاینەکەت داوا دەکات، لێرە دەردەکەوێت.', emptyDone: 'هێشتا هیچ داواکارییەکی تەواوبوو نییە.',
    status: { new: 'نوێ', confirmed: 'پشتڕاستکراوە', ready: 'ئامادەی وەرگرتنە', out: 'لە ڕێگادایە', delivered: 'گەیەندرا', canceled: 'هەڵوەشاوە' },
    next: { confirmed: 'داواکاری پشتڕاست بکەرەوە', ready: 'ئامادەی وەرگرتنە', out: 'نێردرا بۆ گەیاندن', delivered: 'گەیەندرا و پارەدرا', canceled: 'داواکاری هەڵبوەشێنەوە' },
    delivery: 'گەیاندن', pickup: 'وەرگرتن', fee: 'گەیاندن', subtotal: 'کۆی گشتی', total: 'کۆی کۆتایی', cod: 'پارەدان لە کاتی وەرگرتن', call: 'پەیوەندی', wa: 'واتسئاپ', link: 'لینکی داواکاری', copied: 'لینکەکە کۆپی کرا',
    note: 'تێبینیی کڕیار', sale: 'بوو بە فرۆشتن', moved: 'تەواو. ئەگەر Connect چالاک بێت، کڕیار نوێکارییەکی لە واتسئاپ وەرگرت.', reason: 'هۆی هەڵوەشاندنەوە (ئارەزوومەندانە)', sure: 'هەڵوەشاندنەوەی داواکاری', items: '{n} بەرهەم',
    settings: 'گەیاندن و پارەدان', sDelivery: 'داواکارییەکان دەگەیەنین', sPickup: 'دەتوانرێت لە دوکان وەربگیرێت', sFee: 'کرێی گەیاندن', sFees: 'کرێی جیاواز بۆ هەندێک شار', sCity: 'شار', sAdd: 'شارێک زیاد بکە',
    sFree: 'گەیاندنی بەخۆڕایی سەرووی', sMin: 'کەمترین داواکاری', sCities: 'ئەو شارانەی دەیگەیەنینێ (بەتاڵ: هەموو شوێنێک)', sCitiesPh: 'بەغدا، هەولێر، بەسرە', save: 'پاشەکەوت', saved: 'پاشەکەوت کرا', none: 'هیچ', needSite: 'سەرەتا ماڵپەڕەکەت لە پەڕەی ماڵپەڕ چالاک بکە.' },
} as const;
type Words = Omit<(typeof W)['en'], 'status' | 'next'> & { status: Record<string, string>; next: Record<string, string> };
const NEXT: Record<string, string[]> = { new: ['confirmed'], confirmed: ['out', 'ready', 'delivered'], ready: ['delivered'], out: ['delivered'] };
const TONE: Record<string, string> = { new: 'warn', confirmed: 'info', ready: 'info', out: 'info', delivered: 'ok', canceled: 'muted' };

type Order = { id: string; number: number; code: string; status: string; name: string; phone: string; delivery: string; city: string | null; area: string | null; address: string | null; note: string | null;
  subtotal: number; deliveryFee: number; total: number; createdAt: string; saleId: string | null; items?: { name: string; qty: number }[] };

export function Orders() {
  const { lang, can, dateTime } = useApp();
  const w = (W as any)[lang] as Words ?? W.ar;
  const { params } = useRoute();
  const [view, setView] = useState<'open' | 'done'>('open');
  const [settings, setSettings] = useState(false);
  const q = useQuery<{ orders: Order[] }>({ queryKey: ['shop-orders', view], queryFn: () => api(`/v1/shop/orders?view=${view}`), refetchInterval: view === 'open' ? 30_000 : false });
  const open = params.get('id');
  const rows = q.data?.orders ?? [];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg w-auto">{(['open', 'done'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{w[v]}</button>)}</div>
        {can('website.manage') && <button className="btn btn-secondary btn-sm" onClick={() => setSettings(true)}><Icon n="truck" className="h-4 w-4" />{w.settings}</button>}
      </div>
      <div className="panel rows overflow-clip">
        {q.isLoading ? <div className="skeleton m-4 h-40" /> : !rows.length ? <Empty icon="truck" text={view === 'open' ? w.empty : w.emptyDone} /> : rows.map((o) => (
          <button key={o.id} className="row text-start" onClick={() => go(`#/orders?id=${o.id}`)}>
            <span className="thumb"><Icon n={o.delivery === 'pickup' ? 'store' : 'truck'} className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <b className="block font-medium"><bdi>#{o.number}</bdi> · {o.name}</b>
              <span className="sub block truncate">{(o.items ?? []).map((x) => `${x.name} ×${Number(x.qty)}`).join('، ')}</span>
              <span className="sub block">{dateTime(o.createdAt)}{o.city ? ` · ${o.city}` : ''}</span>
            </span>
            <span className="grid justify-items-end gap-1"><Money v={o.total} className="font-semibold" /><span className={`pill ${TONE[o.status] ?? ''}`}>{w.status[o.status]}</span></span>
          </button>
        ))}
      </div>
      {open && <OrderSheet id={open} w={w} onClose={() => go('#/orders')} />}
      {settings && <ShopSettings w={w} onClose={() => setSettings(false)} />}
    </div>
  );
}

function OrderSheet({ id, w, onClose }: { id: string; w: Words; onClose(): void }) {
  const { can, toast, errorText, dateTime } = useApp();
  const qc = useQueryClient();
  const [canceling, setCanceling] = useState(false), [reason, setReason] = useState('');
  const q = useQuery<{ order: Order; lines: { id: string; name: string; qty: number; price: number; total: number; image: string | null; stock: number | null; trackStock: boolean | null }[]; link: string | null }>({
    queryKey: ['shop-order', id], queryFn: () => api(`/v1/shop/orders/${id}`) });
  const move = useMutation({
    mutationFn: (status: string) => api(`/v1/shop/orders/${id}`, { method: 'PATCH', body: { status, reason: status === 'canceled' ? reason : undefined } }),
    onSuccess: () => { ['shop-orders', 'shop-order', 'shop-count', 'report', 'products'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(w.moved); setCanceling(false); },
    onError: (e) => toast(errorText(e), 'bad'),
  });
  const o = q.data?.order;
  const steps = o ? (NEXT[o.status] ?? []).filter((s) => (s === 'ready' ? o.delivery === 'pickup' : s === 'out' ? o.delivery === 'delivery' : true)) : [];
  const waNum = o?.phone.replace(/\D/g, '');
  return (
    <Sheet title={o ? `#${o.number} · ${o.name}` : '…'} sub={o ? `${w.status[o.status]} · ${dateTime(o.createdAt)}` : undefined} onClose={onClose}
      footer={o && can('orders.manage') && (steps.length || o.status !== 'delivered' && o.status !== 'canceled') ? (
        <div className="grid gap-2">
          {canceling ? <>
            <input className="input" value={reason} placeholder={w.reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            <button className="btn btn-danger justify-center" disabled={move.isPending} onClick={() => move.mutate('canceled')}>{w.sure}</button>
          </> : <>
            {steps.map((s, i) => <button key={s} className={`btn justify-center ${i === 0 ? 'btn-accent' : 'btn-secondary'}`} disabled={move.isPending} onClick={() => move.mutate(s)}>{w.next[s]}</button>)}
            {o.status !== 'delivered' && o.status !== 'canceled' && <button className="btn btn-ghost justify-center text-[var(--bad)]" onClick={() => setCanceling(true)}>{w.next.canceled}</button>}
          </>}
        </div>) : undefined}>
      {!o ? <div className="skeleton h-48" /> : <>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-secondary btn-sm" href={`tel:${o.phone}`}><Icon n="phone" className="h-4 w-4" />{w.call}</a>
          <a className="btn btn-secondary btn-sm" href={`https://wa.me/${waNum}`} target="_blank" rel="noopener"><Icon n="wa" className="h-4 w-4" />{w.wa}</a>
          {q.data?.link && <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(q.data!.link!).then(() => toast(w.copied))}><Icon n="clip" className="h-4 w-4" />{w.link}</button>}
        </div>
        <section className="panel p-4">
          <p className="sec-t">{o.delivery === 'pickup' ? w.pickup : w.delivery}</p>
          <p className="text-sm"><bdi dir="ltr">{o.phone}</bdi></p>
          {o.delivery === 'delivery' && <p className="text-sm">{[o.city, o.area, o.address].filter(Boolean).join('، ')}</p>}
          {o.note && <p className="sub mt-2">{w.note}: {o.note}</p>}
        </section>
        <div className="panel rows overflow-clip">
          {q.data!.lines.map((l) => (
            <div key={l.id} className="row">
              <span className="thumb overflow-hidden">{l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <Icon n="products" className="h-5 w-5" />}</span>
              <span className="min-w-0 flex-1"><b className="block font-medium">{l.name}</b><span className="sub"><bdi>{Number(l.qty)}</bdi> × <Money v={l.price} />{l.trackStock && l.stock != null && Number(l.stock) < Number(l.qty) && o.status !== 'delivered' ? <span className="pill bad ms-2">{Number(l.stock)}</span> : null}</span></span>
              <Money v={l.total} className="font-semibold" />
            </div>
          ))}
        </div>
        <div className="grid gap-1.5 text-sm">
          <div className="flex justify-between"><span className="muted">{w.subtotal}</span><Money v={o.subtotal} /></div>
          {o.delivery === 'delivery' && <div className="flex justify-between"><span className="muted">{w.fee}</span><Money v={o.deliveryFee} /></div>}
          <div className="flex justify-between text-base font-semibold"><span>{w.total}</span><Money v={o.total} /></div>
          <p className="sub">{w.cod}{o.saleId ? ` · ${w.sale}` : ''}</p>
        </div>
      </>}
    </Sheet>
  );
}

type Rules = { delivery?: boolean; pickup?: boolean; fee?: number; fees?: { city: string; fee: number }[]; freeOver?: number | null; minOrder?: number | null; cities?: string[] };
function ShopSettings({ w, onClose }: { w: Words; onClose(): void }) {
  const { toast, errorText } = useApp();
  const qc = useQueryClient();
  const q = useQuery<{ shop: Rules }>({ queryKey: ['shop-settings'], queryFn: () => api('/v1/shop/settings') });
  const [r, setR] = useState<Rules | null>(null);
  const [cities, setCities] = useState('');
  useEffect(() => { if (q.data && !r) { setR(q.data.shop); setCities((q.data.shop.cities ?? []).join('، ')); } }, [q.data, r]);
  const save = useMutation({
    mutationFn: () => api('/v1/shop/settings', { method: 'PUT', body: { ...r, cities: cities.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shop-settings'] }); toast(w.saved); onClose(); },
    onError: (e) => toast((e as any)?.code === 'SITE_NOT_FOUND' ? w.needSite : errorText(e), 'bad'),
  });
  const set = (patch: Partial<Rules>) => setR((x) => ({ ...(x ?? {}), ...patch }));
  return (
    <Sheet title={w.settings} onClose={onClose} footer={<button className="btn btn-accent justify-center" disabled={!r || save.isPending} onClick={() => save.mutate()}>{w.save}</button>}>
      {!r ? <div className="skeleton h-48" /> : <>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={r.delivery !== false} onChange={(e) => set({ delivery: e.target.checked })} />{w.sDelivery}</label>
        <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={!!r.pickup} onChange={(e) => set({ pickup: e.target.checked })} />{w.sPickup}</label>
        {r.delivery !== false && <>
          <label className="field">{w.sFee}<DinarInput value={r.fee ?? 0} onChange={(v) => set({ fee: v ?? 0 })} /></label>
          <section className="grid gap-2"><p className="sec-t !mb-0">{w.sFees}</p>
            {(r.fees ?? []).map((f, i) => (
              <div key={i} className="flex gap-2">
                <input className="input flex-1" value={f.city} placeholder={w.sCity} onChange={(e) => set({ fees: r.fees!.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)) })} />
                <div className="w-40"><DinarInput value={f.fee} onChange={(v) => set({ fees: r.fees!.map((x, j) => (j === i ? { ...x, fee: v ?? 0 } : x)) })} /></div>
                <button className="icon-btn" aria-label="−" onClick={() => set({ fees: r.fees!.filter((_, j) => j !== i) })}><Icon n="trash" /></button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm justify-self-start" onClick={() => set({ fees: [...(r.fees ?? []), { city: '', fee: r.fee ?? 0 }] })}><Icon n="plus" className="h-4 w-4" />{w.sAdd}</button>
          </section>
          <label className="field">{w.sFree}<DinarInput value={r.freeOver ?? null} onChange={(v) => set({ freeOver: v })} /></label>
          <label className="field">{w.sCities}<input className="input" value={cities} placeholder={w.sCitiesPh} onChange={(e) => setCities(e.target.value)} /></label>
        </>}
        <label className="field">{w.sMin}<DinarInput value={r.minOrder ?? null} onChange={(v) => set({ minOrder: v })} /></label>
      </>}
    </Sheet>
  );
}
