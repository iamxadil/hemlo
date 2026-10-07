// The bag, in a sheet (drag it down on a phone): lines with quantities, how far to free delivery, a discount code,
// the totals and checkout. Removed lines fold away instead of vanishing.
import { useSignal } from '@preact/signals';
import { cartOpen, cartTotals, code, lines, setQty } from '../lib/cart';
import { price } from '../lib/format';
import { fill, s, tx } from '../lib/i18n';
import { toFree, type Totals } from '../lib/pricing';
import { doc, live } from '../lib/store';
import { Icon, Img } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { SwipeRow } from '../ui/SwipeRow';

/** The money lines under a basket; the same block shows in the bag, at checkout and on the order. */
export function Sums({ t, codeName }: { t: Pick<Totals, 'subtotal' | 'discount' | 'delivery' | 'total'>; codeName?: string | null }) {
  return (
    <dl class="sums num">
      <div><dt>{s.value.subtotal}</dt><dd>{price(t.subtotal)}</dd></div>
      {t.discount > 0 && <div class="good"><dt>{s.value.discount}{codeName ? ` · ${codeName}` : ''}</dt><dd>−{price(t.discount)}</dd></div>}
      <div><dt>{s.value.delivery}</dt><dd>{t.delivery ? price(t.delivery) : s.value.free}</dd></div>
      <div class="sums-total"><dt>{s.value.total}</dt><dd>{price(t.total)}</dd></div>
    </dl>
  );
}

/** The discount-code box; shows why a code doesn't work. */
export function CodeBox() {
  const draft = useSignal(code.value ?? ''), t = cartTotals.value;
  const err = t.problem && (t.problem === 'min' ? fill(s.value.codeErr.min, { v: price(doc.value.discounts.find((d) => d.code === code.value?.toUpperCase())?.minTotal ?? 0) }) : s.value.codeErr[t.problem]);
  if (code.value && !err) return <p class="code-on"><Icon n="check" /><b>{code.value.toUpperCase()}</b><button class="btn btn-ghost btn-sm" onClick={() => { code.value = null; draft.value = ''; }}>{s.value.remove}</button></p>;
  return (
    <form class="code-box" onSubmit={(e) => { e.preventDefault(); code.value = draft.value.trim() || null; }}>
      <input class="input" value={draft.value} onInput={(e) => (draft.value = (e.target as HTMLInputElement).value)} placeholder={s.value.code} aria-label={s.value.code} aria-invalid={!!err} autoCapitalize="characters" dir="ltr" />
      <button class="btn btn-line" type="submit" disabled={!draft.value.trim()}>{s.value.apply}</button>
      {err && <span class="field-err">{err}</span>}
    </form>
  );
}

export function CartSheet() {
  const t = cartTotals.value, gap = toFree(doc.value, t), freeOver = doc.value.settings.delivery.freeOver;
  const leaving = useSignal<string | null>(null);
  const close = () => (cartOpen.value = false);
  const remove = (id: string) => { leaving.value = id; setTimeout(() => { setQty(id, 0); leaving.value = null; }, 260); };
  return (
    <Sheet open={cartOpen.value} onClose={close} label={s.value.cart} class="bag">
      <div class="sheet-head"><b>{s.value.cart}</b>{t.count > 0 && <span class="sheet-chip num">{t.count}</span>}<button class="icon-btn sheet-x" onClick={close} aria-label={s.value.close}><Icon n="close" /></button></div>
      {lines.value.length === 0 ? (
        <div class="bag-empty">
          <span class="bag-empty-ic"><Icon n="bag" /></span><p>{s.value.cartEmpty}</p>
          <div class="bag-suggest">{live.value.filter((p) => p.featured).slice(0, 3).map((p) => (
            <a href={`/p/${p.slug}`} onClick={close}><Img pic={p.pics[0]} ratio="4 / 5" sizes="120px" /><small>{tx(p.name)}</small></a>
          ))}</div>
          <a href="/shop" class="btn btn-solid" onClick={close}>{s.value.keepShopping}</a>
        </div>
      ) : (
        <>
          <div class="free-bar" role="status">
            <p><Icon n={gap > 0 ? 'truck' : 'check'} />{gap > 0 ? fill(s.value.toFree, { v: price(gap) }) : s.value.freeYes}</p>
            <span><i style={{ transform: `scaleX(${Math.min(1, (t.subtotal - t.discount) / Math.max(1, freeOver))})` }} /></span>
          </div>
          <ul class="lines" data-scroll>
            {lines.value.map(({ product: p, qty }) => (
              <li key={p.id} class={leaving.value === p.id ? 'leaving' : ''}>
                <SwipeRow onDelete={() => remove(p.id)} label={s.value.remove}>
                <div class="line-in">
                  <a href={`/p/${p.slug}`} onClick={close}><Img pic={p.pics[0]} ratio="4 / 5" class="line-pic" sizes="88px" /></a>
                  <div class="line-main">
                    <a href={`/p/${p.slug}`} onClick={close} class="line-name">{tx(p.name)}</a>
                    <span class="muted"><bdi>{p.size}</bdi></span>
                    <div class="qty qty-sm">
                      <button class="icon-btn" onClick={() => (qty > 1 ? setQty(p.id, qty - 1) : remove(p.id))} aria-label="−"><Icon n={qty > 1 ? 'minus' : 'trash'} /></button>
                      <span class="num">{qty}</span>
                      <button class="icon-btn" disabled={qty >= p.stock} onClick={() => setQty(p.id, qty + 1)} aria-label="+"><Icon n="plus" /></button>
                    </div>
                  </div>
                  <span class="num line-price">{price(p.price * qty)}</span>
                </div>
                </SwipeRow>
              </li>
            ))}
          </ul>
          <div class="sheet-foot">
            <CodeBox />
            <Sums t={t} codeName={t.code?.code} />
            <a href="/checkout" class="btn btn-solid btn-lg btn-block" onClick={close}>{s.value.checkout}</a>
          </div>
        </>
      )}
    </Sheet>
  );
}
