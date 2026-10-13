// The shop website ("shop"): a shop's own online store, with a character of its own (not the estate design recoloured).
// A boutique on warm ivory: a running announcement, a centred wordmark, a hero that turns the shop's products on a
// carousel, category tiles, a "new in" rail, an editorial band for the shop's story, and a dark footer that signs off with
// its name. The product page is a gallery and a buy panel; the bag is a drawer with a free-delivery meter; the checkout is
// three short steps with cash on delivery. Prices are the shop's live ones: the bag is only ids and amounts in the
// browser, priced by the server every time (cart.ts), so nobody can change a price.
import type { WebSection, WebShop, WebTheme } from '@hemlo/db/schema';
import type { ShopItem, ShopProductPage, ShopOrderView } from './shop-data';
import { pick, esc, attr, icon, fill, waHref, telHref, type Lang } from './theme';
import { initials, paras, field, pageHref, type Ctx, type Two } from './context';
import { hwBadge, hwPill, HW_BADGE_CSS } from './badge';

// ---------- words ----------
const S = {
  ar: {
    products: 'المنتجات', all: 'الكل', search: 'ابحث عن منتج', searchBtn: 'بحث', add: 'أضف إلى السلة', addShort: 'أضف', added: 'أُضيف', addedTo: 'أُضيف إلى سلتك', bag: 'السلة', bagEmpty: 'سلتك فارغة',
    bagEmptySub: 'ابدأ بما يعجبك، وسنحفظه لك هنا.', keep: 'تابع التسوق', checkout: 'إتمام الطلب', viewBag: 'عرض السلة', subtotal: 'المجموع', delivery: 'التوصيل', free: 'مجاناً', total: 'الإجمالي',
    out: 'نفد', low: 'كمية محدودة', isNew: 'جديد', save: 'وفّر {n}%', qty: 'الكمية', remove: 'إزالة', menu: 'القائمة', close: 'إغلاق', home: 'الرئيسية', viewAll: 'عرض الكل',
    productsN: '{n} منتج', productsOne: 'منتج واحد', sort: 'الترتيب', sortNew: 'الأحدث', sortAsc: 'السعر: من الأقل', sortDesc: 'السعر: من الأعلى',
    none: 'لا توجد منتجات تطابق بحثك.', noneSub: 'جرّب كلمة أخرى، أو اسألنا على واتساب.', shopNow: 'تسوّق الآن', heroEyebrow: 'متجرنا على الإنترنت', shopBy: 'تسوّق حسب القسم',
    newIn: 'وصل حديثاً', shopAll: 'كل المنتجات', similar: 'قد يعجبك أيضاً', orderWa: 'اطلب عبر واتساب', waAsk: 'مرحباً، أريد أن أطلب {what}.', items: '{n} منتجات',
    cod: 'الدفع عند الاستلام', codSub: 'ادفع نقداً حين يصلك طلبك', deliver: 'توصيل إلى بابك', deliverFee: 'التوصيل {fee}', freeOver: 'توصيل مجاني فوق {n}', waTitle: 'نجيبك على واتساب', waSub: 'اسأل عن أي منتج',
    freeLeft: 'أضف {n} لتحصل على توصيل مجاني', freeDone: 'طلبك يصلك بتوصيل مجاني', inStock: 'متوفر · يصلك قريباً', lowStock: 'بقيت قطع قليلة', outStock: 'نفد حالياً',
    details: 'التفاصيل', notes: 'المكوّنات', shipping: 'التوصيل والدفع', shippingText: 'نوصّل إلى بابك، وتدفع نقداً عند الاستلام.', help: 'تحتاج مساعدة؟', helpSub: 'اسألنا عن أي منتج، ونرد عليك بسرعة.',
    yourName: 'الاسم', phone: 'رقم الهاتف (واتساب)', how: 'طريقة الاستلام', toDoor: 'توصيل', pickup: 'استلام من المتجر', city: 'المدينة', area: 'المنطقة', address: 'العنوان بالتفصيل',
    addressPh: 'الشارع، أقرب نقطة دالة', note: 'ملاحظة (اختياري)', place: 'أرسل الطلب', placing: 'يُرسل…', yourOrder: 'طلبك', stepContact: 'معلوماتك', stepDelivery: 'التوصيل', stepPay: 'الدفع', each: 'للقطعة',
    problems: { OUT_OF_STOCK: 'بعض المنتجات لم تعد متوفرة بالكمية المطلوبة.', BELOW_MINIMUM: 'أقل قيمة للطلب {n}.', NO_DELIVERY_THERE: 'لا نوصل إلى هذه المدينة حالياً.', SHOP_CLOSED: 'المتجر لا يستقبل طلبات الآن.',
      EMPTY_CART: 'سلتك فارغة.', BAD_PHONE: 'أدخل رقم هاتف عراقي صحيح.', BAD_NAME: 'أدخل اسمك.', BAD_ADDRESS: 'أدخل المدينة والعنوان.', BAD_CART: 'تعذّر قراءة السلة.', TOO_MANY: 'طلبات كثيرة. حاول بعد قليل.', generic: 'تعذّر إرسال الطلب. حاول مرة أخرى.' },
    thanks: 'شكراً {name}، وصلنا طلبك.', orderNo: 'طلب رقم {n}', updates: 'سنرسل لك كل تحديث على واتساب.', placed: 'وصل الطلب', confirmed: 'تم التأكيد', ready: 'جاهز للاستلام', out2: 'في الطريق إليك',
    delivered: 'تم التسليم', canceled: 'أُلغي الطلب', canceledSub: 'إن كان هناك خطأ، تواصل معنا.', contactUs: 'تواصل معنا', toAddress: 'التوصيل إلى', collect: 'الاستلام من المتجر', payOnDelivery: 'الدفع عند الاستلام',
    closing: 'شكراً لأنك تتسوّق من متجر محلي.', explore: 'تصفّح', contact: 'تواصل', story: 'قصتنا', readStory: 'تعرّف علينا', contactEyebrow: 'نحن هنا', secure: 'طلبك يصلنا مباشرة، ولا تدفع شيئاً قبل أن يصلك.',
    sample: 'متجر نموذجي', sampleLine: 'هكذا يبدو Hemlo Website لمتجر. المنتجات والأسعار تجريبية، والطلبات لا تُرسل.', sampleGet: 'احصل عليه لمتجرك', prev: 'السابق', next: 'التالي', photo: 'صورة {n}',
  },
  en: {
    products: 'Products', all: 'All', search: 'Search products', searchBtn: 'Search', add: 'Add to bag', addShort: 'Add', added: 'Added', addedTo: 'Added to your bag', bag: 'Bag', bagEmpty: 'Your bag is empty',
    bagEmptySub: 'Start with something you like; we’ll keep it here.', keep: 'Keep shopping', checkout: 'Checkout', viewBag: 'View bag', subtotal: 'Subtotal', delivery: 'Delivery', free: 'Free', total: 'Total',
    out: 'Sold out', low: 'Few left', isNew: 'New', save: '−{n}%', qty: 'Quantity', remove: 'Remove', menu: 'Menu', close: 'Close', home: 'Home', viewAll: 'View all',
    productsN: '{n} products', productsOne: 'One product', sort: 'Sort', sortNew: 'Newest', sortAsc: 'Price: low to high', sortDesc: 'Price: high to low',
    none: 'No products match your search.', noneSub: 'Try another word, or ask us on WhatsApp.', shopNow: 'Shop now', heroEyebrow: 'Our online shop', shopBy: 'Shop by category',
    newIn: 'New in', shopAll: 'Shop everything', similar: 'You may also like', orderWa: 'Order on WhatsApp', waAsk: 'Hello, I would like to order {what}.', items: '{n} items',
    cod: 'Cash on delivery', codSub: 'Pay when your order arrives', deliver: 'Delivered to your door', deliverFee: 'Delivery {fee}', freeOver: 'Free delivery over {n}', waTitle: 'We answer on WhatsApp', waSub: 'Ask about any product',
    freeLeft: 'Add {n} for free delivery', freeDone: 'Your order ships free', inStock: 'In stock · arrives soon', lowStock: 'Only a few left', outStock: 'Sold out for now',
    details: 'Details', notes: 'Notes', shipping: 'Delivery & payment', shippingText: 'Delivered to your door, and you pay in cash when it arrives.', help: 'Need help?', helpSub: 'Ask us about any product and we’ll answer quickly.',
    yourName: 'Name', phone: 'Phone (WhatsApp)', how: 'How you get it', toDoor: 'Delivery', pickup: 'Pick up from the shop', city: 'City', area: 'Area', address: 'Full address',
    addressPh: 'Street, nearest landmark', note: 'Note (optional)', place: 'Place order', placing: 'Sending…', yourOrder: 'Your order', stepContact: 'Your details', stepDelivery: 'Delivery', stepPay: 'Payment', each: 'each',
    problems: { OUT_OF_STOCK: 'Some items are no longer available in that amount.', BELOW_MINIMUM: 'The smallest order is {n}.', NO_DELIVERY_THERE: 'We don’t deliver to that city yet.', SHOP_CLOSED: 'The shop isn’t taking orders right now.',
      EMPTY_CART: 'Your bag is empty.', BAD_PHONE: 'Enter a valid Iraqi phone number.', BAD_NAME: 'Enter your name.', BAD_ADDRESS: 'Enter your city and address.', BAD_CART: 'Your bag couldn’t be read.', TOO_MANY: 'Too many orders. Try again shortly.', generic: 'The order couldn’t be sent. Please try again.' },
    thanks: 'Thank you {name}, we got your order.', orderNo: 'Order number {n}', updates: 'We’ll send you every update on WhatsApp.', placed: 'Order received', confirmed: 'Confirmed', ready: 'Ready to collect', out2: 'On its way',
    delivered: 'Delivered', canceled: 'Order canceled', canceledSub: 'If this is a mistake, please contact us.', contactUs: 'Contact us', toAddress: 'Delivering to', collect: 'Pick up from the shop', payOnDelivery: 'Cash on delivery',
    closing: 'Thank you for shopping local.', explore: 'Explore', contact: 'Contact', story: 'Our story', readStory: 'About us', contactEyebrow: 'We’re here', secure: 'Your order comes straight to us, and you pay nothing until it arrives.',
    sample: 'Sample shop', sampleLine: 'This is how Hemlo Website looks for a shop. Products and prices are made up, and orders go nowhere.', sampleGet: 'Get it for your shop', prev: 'Previous', next: 'Next', photo: 'Photo {n}',
  },
} as const;
type Words = (typeof S)['ar'] | (typeof S)['en'];

const P: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', menu: '<path d="M4 8h16M4 16h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', chev: '<path d="m9 6 6 6-6 6"/>', chevl: '<path d="m15 6-6 6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  bag: '<path d="M5.5 8h13l-1.1 11.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8L5.5 8Z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>', cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>', gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>', store: '<path d="M3 9 5 4h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>', x2: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>', phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
};
const ic = (n: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] ?? ''}</svg>`;
const w = (ctx: Ctx): Words => S[ctx.lang];
const nf = new Intl.NumberFormat('en-US');
const cur = (lang: Lang) => (lang === 'ar' ? 'د.ع' : 'IQD');
const money = (n: number, lang: Lang) => `<bdi class="num">${nf.format(n)}</bdi> <small>${cur(lang)}</small>`;
const moneyText = (n: number, lang: Lang) => `${nf.format(n)} ${cur(lang)}`;
const brandMark = (ctx: Ctx) => (ctx.logo ? `<img src="${attr(ctx.logo)}" alt="" width="34" height="34">` : `<span class="sh-mono">${esc(initials(ctx.name))}</span>`);
const href = (ctx: Ctx, path: string) => `${ctx.basePath}/${path}${ctx.lang === (ctx.site.lang === 'en' ? 'en' : 'ar') ? '' : `${path.includes('?') ? '&' : '?'}lang=${ctx.lang}`}`;
const productHref = (ctx: Ctx, slug: string) => href(ctx, `products/${encodeURIComponent(slug)}`);
const catHref = (ctx: Ctx, c: string) => href(ctx, `products?c=${encodeURIComponent(c)}`);
const waFor = (ctx: Ctx, text: string) => (ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, text) : null);
const rules = (ctx: Ctx): WebShop => ctx.site.settings?.shop ?? {};
const itemJson = (p: ShopItem) => JSON.stringify({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image, unit: p.unit });
const savePct = (p: ShopItem) => (p.was && p.was > p.price ? Math.round((1 - p.price / p.was) * 100) : 0);
const priceHtml = (p: ShopItem, lang: Lang) => `${money(p.price, lang)}${p.was && p.was > p.price ? ` <s class="num">${nf.format(p.was)}</s>` : ''}`;

// ---------- the product card ----------
export function shopCard(ctx: Ctx, p: ShopItem, i: number, cls = '') {
  const t = w(ctx), out = p.stock === 'out', off = savePct(p);
  const badge = out ? `<span class="sh-badge mute">${esc(t.out)}</span>` : off ? `<span class="sh-badge acc">${esc(fill(t.save, { n: off }))}</span>` : p.stock === 'low' ? `<span class="sh-badge warn">${esc(t.low)}</span>` : p.fresh ? `<span class="sh-badge">${esc(t.isNew)}</span>` : '';
  const meta = [p.category, p.size].filter(Boolean).join(' · ');
  return `<article class="sh-card sh-rv${out ? ' is-out' : ''}${cls ? ` ${cls}` : ''}" style="--i:${i % 4}" data-cat="${attr(p.category ?? '')}">
<a class="sh-card-media${p.image && p.image2 ? ' has-2' : ''}" href="${attr(productHref(ctx, p.slug))}" tabindex="-1" aria-hidden="true">${p.image ? `<img src="${attr(p.image)}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async">${p.image2 ? `<img class="alt" src="${attr(p.image2)}" alt="" loading="lazy" decoding="async">` : ''}` : `<span class="sh-ph">${ic('box')}</span>`}${badge ? `<span class="sh-tags">${badge}</span>` : ''}</a>
${out ? '' : `<button class="sh-quick" type="button" data-add="${attr(itemJson(p))}" aria-label="${attr(`${t.add}: ${p.name}`)}"><span class="q-ic">${ic('plus')}${ic('check', 'i ok')}</span><span class="q-l">${esc(t.addShort)}</span></button>`}
<div class="sh-card-b"><h3 class="sh-card-t"><a href="${attr(productHref(ctx, p.slug))}">${esc(p.name)}</a></h3>${meta ? `<p class="sh-card-m">${esc(meta)}</p>` : ''}<p class="sh-price">${priceHtml(p, ctx.lang)}</p></div></article>`;
}

// ---------- sections ----------
const cats = (ctx: Ctx) => [...new Set(ctx.products.map((p) => p.category).filter(Boolean) as string[])];
function promise(ctx: Ctx) {
  const t = w(ctx), s = rules(ctx);
  const items = [
    s.delivery !== false ? [ic('truck'), t.deliver, s.freeOver ? fill(t.freeOver, { n: moneyText(s.freeOver, ctx.lang) }) : s.fee ? fill(t.deliverFee, { fee: moneyText(s.fee, ctx.lang) }) : ''] : null,
    [ic('cash'), t.cod, t.codSub],
    ctx.contact.whatsapp ? [ic('chat'), t.waTitle, t.waSub] : null,
    [ic('shield'), ctx.lang === 'ar' ? 'أسعار واضحة' : 'Clear prices', ctx.lang === 'ar' ? 'السعر الذي تراه هو ما تدفعه' : 'The price you see is what you pay'],
  ].filter(Boolean) as string[][];
  return `<ul class="sh-promise">${items.map(([i, b, s2]) => `<li>${i}<span><b>${esc(b)}</b>${s2 ? `<small>${esc(s2)}</small>` : ''}</span></li>`).join('')}</ul>`;
}
/** The hero: the shop's name and line, then its products turning on a carousel (the one in front can go in the bag). */
function hero(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), title = pick((sec as any).title as Two, ctx.lang) || ctx.name, text = field(sec, 'text', ctx.lang) || ctx.tagline;
  const wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' }));
  const list = ctx.products.filter((p) => p.image && p.stock !== 'out').slice(0, 7);
  const n = list.length, rtl = ctx.lang === 'ar';
  const pose = (i: number) => {
    let d = ((i % n) + n) % n; if (d > n / 2) d -= n;
    const a = Math.abs(d), x = d * 64 * (rtl ? -1 : 1), r = -d * 9 * (rtl ? -1 : 1);
    return `transform:translateX(${x}%) scale(${(1 - Math.min(a, 3) * 0.12).toFixed(2)}) rotateY(${r}deg);z-index:${10 - Math.round(a)};opacity:${a > 2.5 ? 0 : 1}`;
  };
  const flow = n >= 3 ? `<div class="sh-flow" data-flow>
<div class="sh-flow-stage" data-flow-stage>${list.map((p, i) => `<a class="sh-flow-card${i ? '' : ' on'}" href="${attr(productHref(ctx, p.slug))}" data-fi="${i}" style="${pose(i)}" draggable="false"><img src="${attr(p.image!)}" alt="${attr(p.name)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" draggable="false"></a>`).join('')}</div>
<div class="sh-flow-cap">${list.map((p, i) => `<div class="sh-flow-c${i ? '' : ' on'}" data-fc="${i}"${i ? ' aria-hidden="true"' : ''}><span class="k">${esc(p.category ?? '')}</span><b>${esc(p.name)}</b><span class="sh-price">${priceHtml(p, ctx.lang)}</span></div>`).join('')}</div>
<div class="sh-flow-ctl"><button class="sh-ib" type="button" data-flow-go="-1" aria-label="${attr(t.prev)}">${ic(rtl ? 'chev' : 'chevl')}</button><div class="sh-dots">${list.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>
<button class="sh-btn sh-btn-ink sh-flow-add" type="button" data-flow-add data-add="${attr(itemJson(list[0]))}">${ic('bag')}<span>${esc(t.add)}</span></button><button class="sh-ib" type="button" data-flow-go="1" aria-label="${attr(t.next)}">${ic(rtl ? 'chevl' : 'chev')}</button></div>
<script type="application/json" data-flow-items>${JSON.stringify(list.map((p) => JSON.parse(itemJson(p)))).replace(/</g, '\\u003c')}</script></div>`
    : `<div class="sh-hero-mono">${n ? `<img src="${attr(list[0].image!)}" alt="" fetchpriority="high">` : brandMark(ctx)}</div>`;
  return `<section class="sh-hero"><div class="sh-hero-glow" aria-hidden="true"></div><div class="sh-wrap sh-hero-copy">
<p class="sh-eyebrow"><span class="dot"></span>${esc(t.heroEyebrow)}</p><h1 class="sh-display">${esc(title)}</h1>${text ? `<p class="sh-lead">${esc(text)}</p>` : ''}
<div class="sh-ctas"><a class="sh-btn sh-btn-ink sh-btn-lg" href="${attr(href(ctx, 'products'))}">${esc(t.shopNow)}${ic('arrow', 'i dir')}</a>${wa ? `<a class="sh-btn sh-btn-line sh-btn-lg" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}</div></div>
${flow}<div class="sh-wrap">${promise(ctx)}</div></section>`;
}
/** The home page's shop: category tiles, a rail of what's new, then everything with category tabs. */
function shelf(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), list = ctx.products, cs = cats(ctx);
  if (!list.length) return '';
  const tiles = cs.length >= 2 ? `<section class="sh-sec"><div class="sh-wrap"><div class="sh-head sh-rv"><div><p class="sh-eyebrow">${esc(t.products)}</p><h2 class="sh-h2">${esc(t.shopBy)}</h2></div></div>
<div class="sh-cats" style="--cols:${cs.length <= 5 ? Math.min(cs.length, 8) : cs.length === 6 ? 3 : 4}">${cs.slice(0, 8).map((c, i) => { const ps = list.filter((p) => p.category === c), pic = ps.find((p) => p.image)?.image;
    return `<a class="sh-tile sh-rv" style="--i:${i % 4}" href="${attr(catHref(ctx, c))}">${pic ? `<img src="${attr(pic)}" alt="" loading="lazy" decoding="async">` : ''}<span class="sh-tile-b"><b>${esc(c)}</b><small>${esc(ps.length === 1 ? t.productsOne : fill(t.items, { n: ps.length }))}</small></span><span class="sh-tile-go">${ic('arrow', 'i dir')}</span></a>`; }).join('')}</div></div></section>` : '';
  const railList = list.slice(0, 10);
  const rail = list.length >= 6 ? `<section class="sh-sec"><div class="sh-wrap"><div class="sh-head sh-rv"><div><p class="sh-eyebrow">${esc(t.isNew)}</p><h2 class="sh-h2">${esc(pick((sec as any).title as Two, ctx.lang) || t.newIn)}</h2></div>
<div class="sh-rail-ctl"><button class="sh-ib" type="button" data-rail-go="-1" aria-label="${attr(t.prev)}">${ic('chevl', 'i dir')}</button><button class="sh-ib" type="button" data-rail-go="1" aria-label="${attr(t.next)}">${ic('chev', 'i dir')}</button></div></div></div>
<div class="sh-rail" data-rail>${railList.map((p, i) => shopCard(ctx, p, i, 'in-rail')).join('')}</div></section>` : '';
  const grid = list.slice(0, 12);
  const tabs = cs.length >= 2 ? `<div class="sh-tabs" role="tablist" data-tabs><button type="button" role="tab" aria-selected="true" data-tab="">${esc(t.all)}</button>${cs.map((c) => `<button type="button" role="tab" aria-selected="false" data-tab="${attr(c)}">${esc(c)}</button>`).join('')}</div>` : '';
  const all = `<section class="sh-sec"><div class="sh-wrap"><div class="sh-head sh-rv"><div><p class="sh-eyebrow">${esc(fill(t.productsN, { n: list.length }))}</p><h2 class="sh-h2">${esc(rail ? t.shopAll : pick((sec as any).title as Two, ctx.lang) || t.shopAll)}</h2></div><a class="sh-link" href="${attr(href(ctx, 'products'))}">${esc(t.viewAll)}${ic('arrow', 'i dir')}</a></div>
${tabs}<div class="sh-grid" data-tab-grid>${grid.map((p, i) => shopCard(ctx, p, i)).join('')}</div><p class="sh-more"><a class="sh-btn sh-btn-line sh-btn-lg" href="${attr(href(ctx, 'products'))}">${esc(t.viewAll)}${ic('arrow', 'i dir')}</a></p></div></section>`;
  return tiles + rail + all;
}
function catalogue(ctx: Ctx) {
  const t = w(ctx), f = ctx.filters as any, n = ctx.products.length, cs = (ctx as any).allCats as string[] | undefined ?? cats(ctx);
  const keep = ctx.lang !== (ctx.site.lang === 'en' ? 'en' : 'ar') ? `<input type="hidden" name="lang" value="${ctx.lang}">` : '';
  const sorts = ([['', t.sortNew], ['price-asc', t.sortAsc], ['price-desc', t.sortDesc]] as const).map(([k, l]) => `<option value="${k}"${(f.sort ?? '') === k ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const grid = n ? `<div class="sh-grid">${ctx.products.map((p, i) => shopCard(ctx, p, i)).join('')}</div>`
    : `<div class="sh-empty">${ic('search', 'i lg')}<h2>${esc(t.none)}</h2><p>${esc(t.noneSub)}</p><a class="sh-btn sh-btn-line" href="${attr(href(ctx, 'products'))}">${esc(t.all)}</a></div>`;
  const links = cs.length ? `<nav class="sh-tabs links" aria-label="${attr(t.products)}"><a href="${attr(href(ctx, 'products'))}"${!f.category ? ' aria-current="page"' : ''}>${esc(t.all)}</a>${cs.map((c) => `<a href="${attr(catHref(ctx, c))}"${f.category === c ? ' aria-current="page"' : ''}>${esc(c)}</a>`).join('')}</nav>` : '';
  return `<section class="sh-page"><div class="sh-wrap"><nav class="sh-crumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(t.home)}</a>${ic('chev', 'i dir')}<span>${esc(t.products)}</span></nav>
<div class="sh-page-head"><h1 class="sh-h1">${esc(f.category || (f.q ? `“${f.q}”` : t.products))}</h1><span class="num">${esc(n === 1 ? t.productsOne : fill(t.productsN, { n }))}</span></div>
<div class="sh-toolbar">${links}<form class="sh-find" method="get" action="${attr(ctx.basePath)}/products" role="search">${keep}${f.category ? `<input type="hidden" name="c" value="${attr(f.category)}">` : ''}<label class="sh-find-q">${ic('search')}<input name="q" value="${attr(f.q ?? '')}" placeholder="${attr(t.search)}" maxlength="80" enterkeyhint="search"></label>
<label class="sh-sort"><span class="sr">${esc(t.sort)}</span><select name="sort" data-autosubmit>${sorts}</select>${ic('down')}</label></form></div>${grid}</div></section>`;
}
function about(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), title = pick((sec as any).title as Two, ctx.lang), text = field(sec, 'text', ctx.lang) || pick(ctx.site.about, ctx.lang);
  if (!text && !title) return '';
  const pic = (sec as any).image || ctx.products.find((p) => p.image2)?.image2 || ctx.products.find((p) => p.image)?.image;
  return `<section class="sh-story"><div class="sh-wrap sh-story-in">${pic ? `<figure class="sh-rv"><img src="${attr(pic)}" alt="" loading="lazy" decoding="async"></figure>` : ''}<div class="sh-story-b sh-rv"><p class="sh-eyebrow">${esc(t.story)}</p><h2 class="sh-display sm">${esc(title || ctx.name)}</h2>${text ? `<div class="sh-prose">${paras(text)}</div>` : ''}
${ctx.pageSlug === '' ? `<a class="sh-btn sh-btn-paper sh-btn-lg" href="${attr(href(ctx, 'products'))}">${esc(t.shopNow)}${ic('arrow', 'i dir')}</a>` : ''}</div></div></section>`;
}
function contact(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), c = ctx.contact, title = pick((sec as any).title as Two, ctx.lang) || t.help;
  const wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' })), tel = telHref(c.phone);
  const dl = [c.phone ? `<div><dt>${ic('phone')}${esc(ctx.t.call)}</dt><dd><bdi class="num">${esc(c.phone)}</bdi></dd></div>` : '', c.address ? `<div><dt>${ic('pin')}${esc(t.contact)}</dt><dd>${esc(c.address)}</dd></div>` : ''].join('');
  return `<section class="sh-sec"><div class="sh-wrap"><div class="sh-help sh-rv"><div><p class="sh-eyebrow">${esc(t.contactEyebrow)}</p><h2 class="sh-display sm">${esc(title)}</h2><p class="sh-lead">${esc(t.helpSub)}</p>
<div class="sh-ctas">${wa ? `<a class="sh-btn sh-btn-wa sh-btn-lg" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}${tel ? `<a class="sh-btn sh-btn-line sh-btn-lg" href="${attr(tel)}">${ic('phone')}${ctx.t.call}</a>` : ''}</div></div>${dl ? `<dl>${dl}</dl>` : ''}</div></div></section>`;
}

// ---------- the bag's two pages: checkout, and the order afterwards ----------
function checkoutPage(ctx: Ctx) {
  const t = w(ctx), s = rules(ctx);
  const canDeliver = s.delivery !== false, canPickup = !!s.pickup;
  const how = canDeliver && canPickup ? `<div class="sh-seg" role="radiogroup" aria-label="${attr(t.how)}"><label><input type="radio" name="delivery" value="delivery" checked><span>${ic('truck')}${esc(t.toDoor)}</span></label><label><input type="radio" name="delivery" value="pickup"><span>${ic('store')}${esc(t.pickup)}</span></label></div>`
    : `<input type="hidden" name="delivery" value="${canDeliver ? 'delivery' : 'pickup'}">`;
  const cities = s.cities?.length ? `<select name="city" required>${s.cities.map((c) => `<option>${esc(c)}</option>`).join('')}</select>` : `<input name="city" maxlength="60" autocomplete="address-level2" required>`;
  const note = pick(s.note as Two, ctx.lang);
  return `<section class="sh-page"><div class="sh-wrap"><nav class="sh-crumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(t.home)}</a>${ic('chev', 'i dir')}<span>${esc(t.checkout)}</span></nav>
<h1 class="sh-h1 sh-co-h">${esc(t.checkout)}</h1>
<form class="sh-co" data-checkout novalidate><div class="sh-co-form">
<fieldset class="sh-step"><legend><i>1</i>${esc(t.stepContact)}</legend><div class="sh-2"><label class="sh-field"><span>${esc(t.yourName)}</span><input name="name" maxlength="80" autocomplete="name" required></label>
<label class="sh-field"><span>${esc(t.phone)}</span><input name="phone" type="tel" inputmode="tel" dir="ltr" maxlength="20" autocomplete="tel" placeholder="07XX XXX XXXX" required></label></div></fieldset>
<fieldset class="sh-step"><legend><i>2</i>${esc(t.stepDelivery)}</legend>${how}<div class="sh-addr" data-addr><div class="sh-2"><label class="sh-field"><span>${esc(t.city)}</span>${cities}</label><label class="sh-field"><span>${esc(t.area)}</span><input name="area" maxlength="80"></label></div>
<label class="sh-field"><span>${esc(t.address)}</span><input name="address" maxlength="240" autocomplete="street-address" placeholder="${attr(t.addressPh)}"></label></div>
<label class="sh-field"><span>${esc(t.note)}</span><textarea name="note" maxlength="400" rows="2"></textarea></label>${note ? `<p class="sh-co-note">${ic('truck')}${esc(note)}</p>` : ''}</fieldset>
<fieldset class="sh-step"><legend><i>3</i>${esc(t.stepPay)}</legend><p class="sh-cod is-on">${ic('cash')}<span><b>${esc(t.cod)}</b><small>${esc(t.codSub)}</small></span><i class="tick">${ic('check')}</i></p></fieldset>
<input type="text" name="hp" tabindex="-1" autocomplete="off" class="sh-hp" aria-hidden="true"></div>
<aside class="sh-co-sum"><h2 class="sh-co-t">${esc(t.yourOrder)}</h2><ul data-sum-lines class="sh-lines"></ul>
<dl class="sh-tot"><div><dt>${esc(t.subtotal)}</dt><dd data-sum="subtotal">—</dd></div><div><dt>${esc(t.delivery)}</dt><dd data-sum="fee">—</dd></div><div class="big"><dt>${esc(t.total)}</dt><dd data-sum="total">—</dd></div></dl>
<p class="sh-err" data-err role="alert" hidden></p><button class="sh-btn sh-btn-ink sh-btn-lg sh-block" type="submit" data-place>${esc(t.place)}</button><p class="sh-secure">${ic('shield')}${esc(t.secure)}</p></aside></form></div></section>`;
}
function orderPage(ctx: Ctx, o: ShopOrderView) {
  const t = w(ctx), lang = ctx.lang;
  const steps = o.status === 'canceled' ? [] : [['new', t.placed], ['confirmed', t.confirmed], [o.delivery === 'pickup' ? 'ready' : 'out', o.delivery === 'pickup' ? t.ready : t.out2], ['delivered', t.delivered]];
  const at = steps.findIndex(([k]) => k === o.status);
  const wa = waFor(ctx, fill(t.waAsk, { what: `#${o.number}` }));
  const line = (l: ShopOrderView['lines'][number]) => `<li><span class="sh-line-img">${l.image ? `<img src="${attr(l.image)}" alt="" loading="lazy">` : ic('box')}</span><span class="sh-line-t"><b>${esc(l.name)}</b><small><bdi class="num">${l.qty}</bdi> × ${money(l.price, lang)}</small></span><span class="sh-line-p">${money(l.total, lang)}</span></li>`;
  return `<section class="sh-page"><div class="sh-wrap sh-order"><div class="sh-order-h"><span class="sh-order-ic${o.status === 'canceled' ? ' bad' : ''}">${ic(o.status === 'canceled' ? 'x2' : 'check')}</span>
<p class="sh-eyebrow">${esc(fill(t.orderNo, { n: o.number }))}</p><h1 class="sh-h1">${esc(o.status === 'canceled' ? t.canceled : fill(t.thanks, { name: o.name.split(/\s+/)[0] }))}</h1><p class="sh-lead">${esc(o.status === 'canceled' ? t.canceledSub : t.updates)}</p></div>
${steps.length ? `<ol class="sh-steps">${steps.map(([k, label], i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i <= at ? ic('check') : ''}</i><span>${esc(label)}</span></li>`).join('')}</ol>` : ''}
<div class="sh-order-g"><div class="sh-box"><h2 class="sh-co-t">${esc(t.yourOrder)}</h2><ul class="sh-lines">${o.lines.map(line).join('')}</ul>
<dl class="sh-tot"><div><dt>${esc(t.subtotal)}</dt><dd>${money(o.subtotal, lang)}</dd></div>${o.delivery === 'delivery' ? `<div><dt>${esc(t.delivery)}</dt><dd>${o.deliveryFee ? money(o.deliveryFee, lang) : esc(t.free)}</dd></div>` : ''}<div class="big"><dt>${esc(t.total)}</dt><dd>${money(o.total, lang)}</dd></div></dl></div>
<div class="sh-box"><h2 class="sh-co-t">${esc(o.delivery === 'pickup' ? t.collect : t.toAddress)}</h2>${o.delivery === 'delivery' ? `<p class="sh-addr-l">${ic('pin')}<span>${esc([o.city, o.area, o.address].filter(Boolean).join(lang === 'ar' ? '، ' : ', '))}</span></p>` : ctx.contact.address ? `<p class="sh-addr-l">${ic('store')}<span>${esc(ctx.contact.address)}</span></p>` : ''}
<p class="sh-cod">${ic('cash')}<span><b>${esc(t.payOnDelivery)}</b><small>${money(o.total, lang)}</small></span></p>${wa ? `<a class="sh-btn sh-btn-wa sh-btn-lg sh-block" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${esc(t.contactUs)}</a>` : ''}
<a class="sh-btn sh-btn-line sh-btn-lg sh-block" href="${attr(href(ctx, 'products'))}">${esc(t.keep)}</a></div></div></div></section>`;
}

export function shopSection(ctx: Ctx, sec: WebSection, _first: boolean): string | null {
  switch (sec.type) {
    case 'hero': return hero(ctx, sec);
    case 'products': return ctx.pageSlug === 'products' ? catalogue(ctx) : shelf(ctx, sec);
    case 'about': return about(ctx, sec);
    case 'contact': return contact(ctx, sec);
    case 'checkout' as any: return checkoutPage(ctx);
    case 'order' as any: return ctx.order ? orderPage(ctx, ctx.order) : '';
    default: return null;
  }
}

// ---------- the header, the drawers, the footer, the phone bar ----------
function navItems(ctx: Ctx) {
  const items = ctx.pages.slice(0, 5).map((p) => ({ slug: p.slug, label: pick(p.title, ctx.lang) || p.slug || ctx.t.hero }));
  if (!items.some((p) => p.slug === 'products')) items.splice(1, 0, { slug: 'products', label: w(ctx).products });
  return items;
}
function langSwitch(ctx: Ctx, altHref: string) {
  const other: Lang = ctx.lang === 'ar' ? 'en' : 'ar';
  return `<a class="sh-lang" href="${attr(altHref)}" hreflang="${other}" lang="${other}" dir="ltr" aria-label="${other === 'en' ? 'English' : 'العربية'}"><span${ctx.lang === 'en' ? ' class="on"' : ''}>EN</span><span${ctx.lang === 'ar' ? ' class="on"' : ''}>ع</span><i aria-hidden="true"></i></a>`;
}
function announce(ctx: Ctx) {
  const t = w(ctx), s = rules(ctx);
  const items = [s.freeOver ? fill(t.freeOver, { n: moneyText(s.freeOver, ctx.lang) }) : s.delivery !== false ? t.deliver : '', t.cod, ctx.contact.whatsapp ? t.waTitle : '', pick(s.note as Two, ctx.lang)].filter(Boolean);
  const run = items.map((x) => `<span>${esc(x)}</span><i aria-hidden="true">✦</i>`).join('');
  return `<div class="sh-ann" role="note"><div class="sh-ann-t">${run}${run.replace(/<span>/g, '<span aria-hidden="true">')}</div></div>`;
}
export function shopHeader(ctx: Ctx, current: string, altHref: string) {
  const t = w(ctx), s = rules(ctx);
  const links = navItems(ctx).map((p) => `<a href="${attr(pageHref(ctx, p.slug))}"${p.slug === current ? ' aria-current="page"' : ''}>${esc(p.label)}</a>`).join('');
  const sample = ctx.sample ? `<div class="sh-sample">${hwPill('ink')}<span><b>${esc(t.sample)}</b> · ${esc(t.sampleLine)}</span><a href="https://hemlohq.com/${ctx.lang === 'en' ? 'en/' : ''}store/">${esc(t.sampleGet)}${ic('arrow', 'i dir')}</a></div>` : '';
  return `${sample}${announce(ctx)}<div id="sh-top" aria-hidden="true" data-shop-base="${attr(ctx.basePath)}" data-free-over="${s.freeOver ?? 0}"></div><header class="sh-head" data-head><div class="sh-head-in">
<div class="sh-head-s"><button class="sh-ib sh-only-phone" type="button" data-open="sh-menu" aria-label="${attr(t.menu)}">${ic('menu')}</button><nav class="sh-nav" aria-label="${attr(t.menu)}">${links}</nav></div>
<a class="sh-logo" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a>
<div class="sh-head-e">${langSwitch(ctx, altHref)}<button class="sh-ib" type="button" data-open="sh-search" aria-label="${attr(t.search)}">${ic('search')}</button>
<button class="sh-bagb" type="button" data-open="sh-bag" aria-label="${attr(t.bag)}" data-bagb>${ic('bag')}<span class="l">${esc(t.bag)}</span><span class="n num" data-bag-count>0</span></button></div></div></header>`;
}
export function shopChrome(ctx: Ctx, altHref: string) {
  const t = w(ctx), wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' })), tel = telHref(ctx.contact.phone);
  const links = navItems(ctx).map((p, i) => `<a href="${attr(pageHref(ctx, p.slug))}" style="--i:${i}">${esc(p.label)}${ic('chev', 'i dir')}</a>`).join('');
  const cs = cats(ctx);
  const catLinks = cs.length ? `<div class="sh-menu-cats">${cs.slice(0, 6).map((c) => { const pic = ctx.products.find((p) => p.category === c && p.image)?.image; return `<a href="${attr(catHref(ctx, c))}">${pic ? `<img src="${attr(pic)}" alt="" loading="lazy">` : ''}<span>${esc(c)}</span></a>`; }).join('')}</div>` : '';
  return `<dialog id="sh-bag" class="sh-drawer" aria-label="${attr(t.bag)}"><div class="sh-drawer-p">
<div class="sh-drawer-h"><b>${esc(t.bag)} <span class="num" data-bag-count>0</span></b><button class="sh-ib" type="button" data-close aria-label="${attr(t.close)}">${ic('x')}</button></div>
<div class="sh-free" data-free hidden><p data-free-t></p><span class="bar"><i data-free-bar></i></span></div>
<div class="sh-drawer-b"><ul class="sh-lines" data-bag-list></ul><div class="sh-bag-empty" data-bag-empty><span>${ic('bag', 'i lg')}</span><b>${esc(t.bagEmpty)}</b><p>${esc(t.bagEmptySub)}</p><a class="sh-btn sh-btn-ink" href="${attr(href(ctx, 'products'))}">${esc(t.shopNow)}</a></div></div>
<div class="sh-drawer-f" data-bag-foot hidden><div class="sh-bag-sub"><span>${esc(t.subtotal)}</span><b data-bag-total></b></div><p class="sh-bag-note">${ic('cash')}${esc(t.cod)}</p>
<a class="sh-btn sh-btn-ink sh-btn-lg sh-block" href="${attr(href(ctx, 'checkout'))}">${esc(t.checkout)}${ic('arrow', 'i dir')}</a><button class="sh-btn sh-btn-ghost sh-block" type="button" data-close>${esc(t.keep)}</button></div></div></dialog>
<dialog id="sh-menu" class="sh-drawer start" aria-label="${attr(t.menu)}"><div class="sh-drawer-p"><div class="sh-drawer-h"><a class="sh-logo" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a><button class="sh-ib" type="button" data-close aria-label="${attr(t.close)}">${ic('x')}</button></div>
<div class="sh-drawer-b"><nav class="sh-menu-links">${links}</nav>${catLinks}</div><div class="sh-drawer-f">${langSwitch(ctx, altHref)}${wa ? `<a class="sh-btn sh-btn-wa sh-btn-lg sh-block" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}${tel ? `<a class="sh-btn sh-btn-line sh-btn-lg sh-block" href="${attr(tel)}">${ic('phone')}${ctx.t.call}</a>` : ''}</div></div></dialog>
<dialog id="sh-search" class="sh-searchd" aria-label="${attr(t.search)}"><form method="get" action="${attr(ctx.basePath)}/products" role="search">${ctx.lang !== (ctx.site.lang === 'en' ? 'en' : 'ar') ? `<input type="hidden" name="lang" value="${ctx.lang}">` : ''}<label>${ic('search')}<input name="q" placeholder="${attr(t.search)}" maxlength="80" enterkeyhint="search" autocomplete="off"></label><button class="sh-ib" type="button" data-close aria-label="${attr(t.close)}">${ic('x')}</button></form>
${cs.length ? `<div class="sh-search-cats">${cs.map((c) => `<a href="${attr(catHref(ctx, c))}">${esc(c)}</a>`).join('')}</div>` : ''}</dialog>
<div class="sh-pop" data-pop role="status" aria-live="polite" hidden><span class="sh-pop-img" data-pop-img></span><div class="sh-pop-t"><small>${ic('check')}${esc(t.addedTo)}</small><b data-pop-name></b><span data-pop-price class="num"></span></div>
<div class="sh-pop-a"><button class="sh-btn sh-btn-line" type="button" data-open="sh-bag">${esc(t.viewBag)}</button><a class="sh-btn sh-btn-ink" href="${attr(href(ctx, 'checkout'))}">${esc(t.checkout)}</a></div></div>`;
}
export function shopFooter(ctx: Ctx) {
  const t = w(ctx), c = ctx.contact, wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' }));
  const links = navItems(ctx).map((p) => `<li><a href="${attr(pageHref(ctx, p.slug))}">${esc(p.label)}</a></li>`).join('');
  const cs = cats(ctx).slice(0, 6).map((x) => `<li><a href="${attr(catHref(ctx, x))}">${esc(x)}</a></li>`).join('');
  const contact = [c.phone ? `<li><a href="${attr(telHref(c.phone)!)}"><bdi class="num">${esc(c.phone)}</bdi></a></li>` : '', c.email ? `<li><a href="mailto:${attr(c.email)}">${esc(c.email)}</a></li>` : '', c.address ? `<li>${esc(c.address)}</li>` : ''].join('');
  return `<footer class="sh-foot"><div class="sh-wrap"><div class="sh-foot-top"><div class="sh-foot-brand"><a class="sh-logo" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}${wa ? `<a class="sh-btn sh-btn-wa" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}</div>
<div><h4>${esc(t.explore)}</h4><ul>${links}</ul></div>${cs ? `<div><h4>${esc(t.products)}</h4><ul>${cs}</ul></div>` : ''}${contact ? `<div><h4>${esc(t.contact)}</h4><ul>${contact}</ul></div>` : ''}</div>
<p class="sh-foot-word" aria-hidden="true">${esc(ctx.name)}</p>
<div class="sh-foot-bot"><span>© ${new Date().getFullYear()} ${esc(ctx.name)} · ${esc(t.closing)}</span><span class="sh-pay">${ic('cash')}${esc(t.cod)}</span>${hwBadge(ctx.lang, `https://hemlohq.com/${ctx.lang === 'en' ? 'en/' : ''}store/`)}</div></div></footer>`;
}
/** On a phone, the bag stays under the thumb once something is in it. */
export function shopBar(ctx: Ctx) {
  const t = w(ctx);
  if (ctx.pageSlug === 'checkout' || ctx.pageSlug === 'order') return '';
  return `<div class="sh-bar" data-bar hidden><button class="sh-btn sh-btn-ink sh-btn-lg" type="button" data-open="sh-bag">${ic('bag')}<span>${esc(t.bag)}</span><span class="sh-bar-n num" data-bag-count>0</span><b class="sh-bar-t" data-bag-total></b></button></div>`;
}

// ---------- the product page ----------
export function shopProduct(ctx: Ctx, p: ShopProductPage, similar: ShopItem[], canonical: string) {
  const t = w(ctx), lang = ctx.lang, out = p.stock === 'out', s = rules(ctx), off = savePct(p);
  const step = p.unit === 'piece' || p.unit === 'box' || p.unit === 'pack' ? 1 : 0.25;
  const wa = waFor(ctx, `${fill(t.waAsk, { what: p.name })}\n${canonical}`);
  const photos = p.photos.length ? p.photos : p.image ? [p.image] : [];
  const many = photos.length > 1;
  const gal = photos.length ? `<div class="sh-gal${many ? ' many' : ''}">${many ? `<div class="sh-gal-thumbs">${photos.map((u, i) => `<button type="button" data-thumb="${i}"${i ? '' : ' aria-current="true"'} aria-label="${attr(fill(t.photo, { n: i + 1 }))}"><img src="${attr(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
<div class="sh-gal-main"><div class="sh-gal-track" data-ptrack>${photos.map((u, i) => `<img src="${attr(u)}" alt="${attr(i ? `${p.name} ${i + 1}` : p.name)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`).join('')}</div>
${many ? `<button class="sh-gal-nav prev" type="button" data-pnav="-1" aria-label="${attr(t.prev)}">${ic('chevl', 'i dir')}</button><button class="sh-gal-nav next" type="button" data-pnav="1" aria-label="${attr(t.next)}">${ic('chev', 'i dir')}</button><span class="sh-gal-dots">${photos.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</span>` : ''}${off ? `<span class="sh-tags"><span class="sh-badge acc">${esc(fill(t.save, { n: off }))}</span></span>` : ''}</div></div>`
    : `<div class="sh-gal"><div class="sh-gal-main ph">${ic('box', 'i lg')}</div></div>`;
  const stock = out ? `<p class="sh-stock out"><i></i>${esc(t.outStock)}</p>` : p.stock === 'low' ? `<p class="sh-stock low"><i></i>${esc(t.lowStock)}</p>` : `<p class="sh-stock"><i></i>${esc(t.inStock)}</p>`;
  const short = p.description ? p.description.split(/\n{2,}/)[0] : '';
  const ship = [s.freeOver ? fill(t.freeOver, { n: moneyText(s.freeOver, lang) }) : s.fee ? fill(t.deliverFee, { fee: moneyText(s.fee, lang) }) : '', t.shippingText, pick(s.note as Two, lang)].filter(Boolean);
  const buy = `<aside class="sh-buy">${p.category ? `<a class="sh-eyebrow sh-buy-cat" href="${attr(catHref(ctx, p.category))}">${esc(p.category)}</a>` : ''}<h1 class="sh-h1">${esc(p.name)}</h1>
<p class="sh-buy-price sh-price">${priceHtml(p, lang)}${p.size ? `<span class="sh-size"><bdi>${esc(p.size)}</bdi></span>` : ''}</p>${short ? `<p class="sh-buy-short">${esc(short)}</p>` : ''}${stock}
${out ? '' : `<div class="sh-buy-row"><div class="sh-qty" data-qty data-step="${step}"><button type="button" data-dec aria-label="−">${ic('minus')}</button><input value="1" inputmode="decimal" aria-label="${attr(t.qty)}" data-qty-in><button type="button" data-inc aria-label="+">${ic('plus')}</button></div>
<button class="sh-btn sh-btn-ink sh-btn-lg sh-add" type="button" data-add="${attr(itemJson(p))}" data-with-qty><span class="a-l">${ic('bag')}${esc(t.add)}</span><span class="a-ok">${ic('check')}${esc(t.added)}</span></button></div>`}
${wa ? `<a class="sh-btn sh-btn-line sh-btn-lg sh-block" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${esc(t.orderWa)}</a>` : ''}
<div class="sh-acc">${p.description ? `<details open><summary>${esc(t.details)}${ic('plus')}</summary><div class="sh-prose">${paras(p.description)}</div></details>` : ''}${p.notes?.length ? `<details><summary>${esc(t.notes)}${ic('plus')}</summary><ul class="sh-notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
<details><summary>${esc(t.shipping)}${ic('plus')}</summary><ul class="sh-notes">${ship.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details></div></aside>`;
  const more = similar.length ? `<section class="sh-sec"><div class="sh-head"><div><h2 class="sh-h2">${esc(t.similar)}</h2></div><a class="sh-link" href="${attr(href(ctx, 'products'))}">${esc(t.viewAll)}${ic('arrow', 'i dir')}</a></div><div class="sh-grid">${similar.map((x, i) => shopCard(ctx, x, i + 4)).join('')}</div></section>` : '';
  const main = `<main class="sh-pdp"><div class="sh-wrap"><nav class="sh-crumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(t.home)}</a>${ic('chev', 'i dir')}<a href="${attr(href(ctx, 'products'))}">${esc(t.products)}</a>${ic('chev', 'i dir')}<span>${esc(p.name)}</span></nav>
<div class="sh-pdp-g">${gal}${buy}</div>${more}</div></main>`;
  const bar = out ? '' : `<div class="sh-bar pdp"><span class="sh-bar-p sh-price">${money(p.price, lang)}</span><button class="sh-btn sh-btn-ink sh-btn-lg sh-add" type="button" data-add="${attr(itemJson(p))}" data-with-qty><span class="a-l">${ic('bag')}${esc(t.addShort)}</span><span class="a-ok">${ic('check')}${esc(t.added)}</span></button></div>`;
  return { main, bar };
}

// ---------- behaviour: the bag, the carousel, the drawers, the checkout ----------
export const shopScript = (lang: Lang) => {
  const t = S[lang];
  const J = { remove: t.remove, free: t.free, freeLeft: t.freeLeft, freeDone: t.freeDone, problems: t.problems, placing: t.placing, place: t.place, cur: cur(lang), minus: ic('minus'), plus: ic('plus'), trash: ic('trash'), box: ic('box') };
  return `(function(){var J=${JSON.stringify(J).replace(/</g, '\\u003c')},d=document,root=d.documentElement,top=d.getElementById('sh-top');var BASE=top?top.getAttribute('data-shop-base'):'',FREE=top?+top.getAttribute('data-free-over'):0;
var RM=matchMedia('(prefers-reduced-motion: reduce)').matches,RTL=d.dir==='rtl';
function $(s,c){return (c||d).querySelector(s)}function $$(s,c){return [].slice.call((c||d).querySelectorAll(s))}
function el(tag,cls,txt){var e=d.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function fmt(n){return new Intl.NumberFormat('en-US').format(Math.round(n))+' '+J.cur}function r3(n){return Math.round(n*1000)/1000}
var head=$('[data-head]');if(head&&top&&'IntersectionObserver' in window)new IntersectionObserver(function(x){head.classList.toggle('is-stuck',!x[0].isIntersecting)}).observe(top);
/* drawers and dialogs: slide in, slide out, then close */
function openD(dl){if(!dl||dl.open)return;closePop();dl.showModal();d.body.classList.add('sh-lock');requestAnimationFrame(function(){requestAnimationFrame(function(){dl.classList.add('is-open')})});var f=$('input[name=q]',dl);if(f)setTimeout(function(){f.focus()},60)}
function closeD(dl){if(!dl||!dl.open)return;dl.classList.remove('is-open');var done=function(){if(dl.open)dl.close()};if(RM)done();else setTimeout(done,320)}
$$('dialog.sh-drawer,dialog.sh-searchd').forEach(function(x){x.addEventListener('close',function(){x.classList.remove('is-open');if(!$$('dialog[open]').length)d.body.classList.remove('sh-lock')});x.addEventListener('cancel',function(e){e.preventDefault();closeD(x)});x.addEventListener('click',function(e){if(e.target===x)closeD(x)})});
/* the bag: a list in this browser, priced by the shop at checkout */
var KEY='hemlo-bag:'+location.host+BASE;function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}}var bag=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(bag))}catch(_){}sync()}
function total(){return bag.reduce(function(s,x){return s+x.price*x.qty},0)}
function count(){return bag.reduce(function(s,x){return s+(x.unit==='piece'||x.unit==='box'||x.unit==='pack'?x.qty:1)},0)}
function stepOf(x){return x.unit==='piece'||x.unit==='box'||x.unit==='pack'?1:.25}
function add(it,q){var f=bag.filter(function(x){return x.id===it.id})[0];if(f)f.qty=r3(f.qty+q);else bag.unshift({id:it.id,slug:it.slug,name:it.name,price:it.price,image:it.image,unit:it.unit,qty:q});bag=bag.slice(0,40);save()}
function setQty(id,q){bag=bag.map(function(x){if(x.id===id)x.qty=r3(q);return x}).filter(function(x){return x.qty>0});save()}
function lineEl(x,editable){var li=el('li');var im=el('span','sh-line-img');if(x.image){var i=el('img');i.src=x.image;i.alt='';im.append(i)}else im.innerHTML=J.box;var tt=el('span','sh-line-t');var a=el('a',null,x.name);a.href=BASE+'/products/'+encodeURIComponent(x.slug||'')+location.search.replace(/^\\?(?!.*lang=).*$/,'');var b=el('b');b.append(a);tt.append(b,el('small','num',fmt(x.price)));li.append(im,tt);
if(editable){var q=el('span','sh-qty sm');var m=el('button');m.type='button';m.innerHTML=x.qty<=stepOf(x)?J.trash:J.minus;m.setAttribute('aria-label',J.remove);m.onclick=function(){setQty(x.id,x.qty-stepOf(x))};var v=el('span','num',String(x.qty));var p=el('button');p.type='button';p.innerHTML=J.plus;p.setAttribute('aria-label','+');p.onclick=function(){setQty(x.id,x.qty+stepOf(x))};q.append(m,v,p);tt.append(q)}
li.append(el('span','sh-line-p num',fmt(x.price*x.qty)));return li}
var last=-1;function sync(){var n=count();$$('[data-bag-count]').forEach(function(c){c.textContent=String(n)});$$('[data-bag-total]').forEach(function(c){c.textContent=fmt(total())});
var bb=$('[data-bagb]');if(bb){bb.classList.toggle('has',n>0);if(last>=0&&n>last&&!RM){bb.classList.remove('bump');void bb.offsetWidth;bb.classList.add('bump')}}last=n;
var bar=$('[data-bar]');if(bar)bar.hidden=!bag.length;d.body.classList.toggle('has-bar',!!bag.length&&!!bar||!!$('.sh-bar.pdp'));
var list=$('[data-bag-list]');if(list){list.textContent='';bag.forEach(function(x){list.append(lineEl(x,true))});$('[data-bag-empty]').hidden=!!bag.length;$('[data-bag-foot]').hidden=!bag.length}
var fr=$('[data-free]');if(fr){fr.hidden=!FREE||!bag.length;if(FREE){var s=total(),left=FREE-s;$('[data-free-t]').textContent=left>0?J.freeLeft.replace('{n}',fmt(left)):J.freeDone;$('[data-free-bar]').style.transform='scaleX('+Math.min(1,s/FREE)+')';fr.classList.toggle('done',left<=0)}}
if(co)quote()}
/* the small bag that drops from the bag after an add */
var pop=$('[data-pop]'),popT=0;function closePop(){if(!pop||pop.hidden)return;pop.classList.remove('in');clearTimeout(popT);setTimeout(function(){pop.hidden=true},RM?0:250)}
function showPop(it){if(!pop)return;var im=$('[data-pop-img]',pop);im.textContent='';if(it.image){var i=el('img');i.src=it.image;i.alt='';im.append(i)}$('[data-pop-name]',pop).textContent=it.name;$('[data-pop-price]',pop).textContent=fmt(it.price);pop.hidden=false;requestAnimationFrame(function(){pop.classList.add('in')});clearTimeout(popT);popT=setTimeout(closePop,4200)}
if(pop){pop.addEventListener('pointerenter',function(){clearTimeout(popT)});pop.addEventListener('pointerleave',function(){popT=setTimeout(closePop,1800)})}
/* the hero's carousel: the shop's products turning; the one in front can go in the bag */
var flow=$('[data-flow]');if(flow){var cards=$$('.sh-flow-card',flow),caps=$$('[data-fc]',flow),dots=$$('.sh-dots i',flow),items=JSON.parse($('[data-flow-items]',flow).textContent),N=cards.length,act=0,timer=0,addB=$('[data-flow-add]',flow);
var pose=function(){cards.forEach(function(c,i){var dd=((i-act)%N+N)%N;if(dd>N/2)dd-=N;var a=Math.abs(dd),sg=RTL?-1:1;c.style.transform='translateX('+(dd*64*sg)+'%) scale('+(1-Math.min(a,3)*.12)+') rotateY('+(-dd*9*sg)+'deg)';c.style.zIndex=String(10-Math.round(a));c.style.opacity=a>2.5?'0':'1';c.classList.toggle('on',dd===0);c.setAttribute('tabindex',dd===0?'0':'-1')});
caps.forEach(function(c,i){c.classList.toggle('on',i===act);c.setAttribute('aria-hidden',i===act?'false':'true')});dots.forEach(function(x,i){x.classList.toggle('on',i===act)});if(addB)addB.setAttribute('data-add',JSON.stringify(items[act]))};
var go=function(k){act=((k%N)+N)%N;pose()};var play=function(){clearInterval(timer);if(!RM)timer=setInterval(function(){if(!d.hidden)go(act+1)},4200)};
cards.forEach(function(c,i){c.addEventListener('click',function(e){if(moved){e.preventDefault();return}if(i!==act){e.preventDefault();go(i);play()}})});
$$('[data-flow-go]',flow).forEach(function(b){b.addEventListener('click',function(){go(act+(+b.getAttribute('data-flow-go')));play()})});
var sx=0,moved=false,st=$('[data-flow-stage]',flow);st.addEventListener('pointerdown',function(e){sx=e.clientX;moved=false});st.addEventListener('pointermove',function(e){if(Math.abs(e.clientX-sx)>8)moved=true});st.addEventListener('pointerup',function(e){var dx=e.clientX-sx;if(Math.abs(dx)>40){go(act+((dx<0)!==RTL?1:-1));play()}setTimeout(function(){moved=false},0)});
flow.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')clearInterval(timer)});flow.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse')play()});play()}
/* rails and tabs */
$$('[data-rail-go]').forEach(function(b){b.addEventListener('click',function(){var r=b.closest('.sh-sec').querySelector('[data-rail]');if(!r)return;var k=+b.getAttribute('data-rail-go')*(RTL?-1:1);r.scrollBy({left:k*r.clientWidth*.8,behavior:RM?'auto':'smooth'})})});
var tabs=$('[data-tabs]');if(tabs){var grid=$('[data-tab-grid]');$$('[data-tab]',tabs).forEach(function(b){b.addEventListener('click',function(){var c=b.getAttribute('data-tab');$$('[data-tab]',tabs).forEach(function(x){x.setAttribute('aria-selected',String(x===b))});$$('.sh-card',grid).forEach(function(card){card.hidden=!!c&&card.getAttribute('data-cat')!==c})})})}
/* the product's photos */
var tr=$('[data-ptrack]');function curPhoto(){return tr?Math.round(Math.abs(tr.scrollLeft)/(tr.clientWidth||1)):0}
function goPhoto(i){if(!tr)return;var n=tr.children.length;i=(i+n)%n;tr.scrollTo({left:(RTL?-1:1)*i*tr.clientWidth,behavior:RM?'auto':'smooth'})}
if(tr){var gd=$$('.sh-gal-dots i'),rt=0,ps=function(){var i=curPhoto();gd.forEach(function(x,k){x.classList.toggle('on',k===i)});$$('[data-thumb]').forEach(function(x){if(+x.getAttribute('data-thumb')===i)x.setAttribute('aria-current','true');else x.removeAttribute('aria-current')})};tr.addEventListener('scroll',function(){cancelAnimationFrame(rt);rt=requestAnimationFrame(ps)},{passive:true})}
var qty=$('[data-qty]'),qi=qty&&$('[data-qty-in]',qty);if(qty){var stp=+qty.getAttribute('data-step');var val=function(){var n=parseFloat(String(qi.value).replace(',','.'));return n>0?n:stp};$('[data-dec]',qty).onclick=function(){qi.value=String(Math.max(stp,r3(val()-stp)))};$('[data-inc]',qty).onclick=function(){qi.value=String(r3(val()+stp))}}
/* every tap */
d.addEventListener('click',function(ev){var t=ev.target;if(!(t instanceof Element))return;var b=t.closest('[data-add]');
if(b&&!b.disabled){ev.preventDefault();if(b.classList.contains('is-added'))return;var it=JSON.parse(b.getAttribute('data-add'));var q=b.hasAttribute('data-with-qty')&&qi?(parseFloat(String(qi.value).replace(',','.'))||1):1;add(it,q);
b.classList.add('is-added');setTimeout(function(){b.classList.remove('is-added')},1600);if(navigator.vibrate)navigator.vibrate(8);showPop(it);return}
var o=t.closest('[data-open]');if(o){ev.preventDefault();var id=o.getAttribute('data-open');$$('dialog[open]').forEach(function(x){if(x.id!==id)closeD(x)});openD(d.getElementById(id));return}
var c=t.closest('[data-close]');if(c){var p=c.closest('dialog');if(p)closeD(p);return}
var th=t.closest('[data-thumb]');if(th){goPhoto(+th.getAttribute('data-thumb'));return}
var pn=t.closest('[data-pnav]');if(pn){goPhoto(curPhoto()+(+pn.getAttribute('data-pnav')));return}
if(pop&&!pop.hidden&&!t.closest('[data-pop]'))closePop()});
d.addEventListener('keydown',function(e){if(tr&&!/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||'')){if(e.key==='ArrowRight')goPhoto(curPhoto()+(RTL?-1:1));if(e.key==='ArrowLeft')goPhoto(curPhoto()+(RTL?1:-1))}});
$$('[data-autosubmit]').forEach(function(s){s.addEventListener('change',function(){var f=s.form;if(f){if(f.requestSubmit)f.requestSubmit();else f.submit()}})});
var rv=$$('.sh-rv');if('IntersectionObserver' in window&&!RM){var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -6% 0px'});rv.forEach(function(x){io.observe(x)})}else rv.forEach(function(x){x.classList.add('in')});
/* the checkout */
var co=$('[data-checkout]'),qt=0,busy=false;
function f(n){return co.elements[n]}
function how(){var r=co.querySelector('[name=delivery]:checked')||f('delivery');return r?r.value:'delivery'}
function err(code,extra){var e=$('[data-err]',co);if(!code){e.hidden=true;return}var m=J.problems[code]||J.problems.generic;e.textContent=extra?m.replace('{n}',extra):m;e.hidden=false}
function quote(){if(!co)return;var lines=bag.map(function(x){return{id:x.id,qty:x.qty}});var sum=$('[data-sum-lines]',co);if(!lines.length){sum.textContent='';err('EMPTY_CART');$('[data-place]',co).disabled=true;return}
var n=++qt;fetch(BASE+'/cart/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lines:lines,city:f('city')?f('city').value:'',delivery:how(),lang:root.lang})}).then(function(r){return r.json()}).then(function(q){if(n!==qt||!q.lines)return;sum.textContent='';
q.lines.forEach(function(l){var li=lineEl({id:l.id,slug:l.slug,name:l.name,price:l.price,image:l.image,unit:l.unit,qty:l.qty},false);var b=el('span','sh-line-q num','×'+l.qty);li.querySelector('.sh-line-img').append(b);if(l.short)li.classList.add('short');sum.append(li)});
bag=bag.filter(function(x){return q.lines.some(function(l){return l.id===x.id})}).map(function(x){var l=q.lines.filter(function(y){return y.id===x.id})[0];x.price=l.price;x.name=l.name;return x});try{localStorage.setItem(KEY,JSON.stringify(bag))}catch(_){}
$('[data-sum=subtotal]',co).textContent=fmt(q.subtotal);$('[data-sum=fee]',co).textContent=q.delivery==='pickup'?'—':q.fee?fmt(q.fee):J.free;$('[data-sum=total]',co).textContent=fmt(q.total);
err(q.problem,q.minOrder?fmt(q.minOrder):null);$('[data-place]',co).disabled=!q.ok||busy}).catch(function(){})}
if(co){var addr=$('[data-addr]',co);var sw=function(){addr.hidden=how()==='pickup';quote()};$$('[name=delivery]',co).forEach(function(r){r.addEventListener('change',sw)});if(f('city'))f('city').addEventListener('change',quote);sw();
co.addEventListener('submit',function(ev){ev.preventDefault();if(busy)return;var btn=$('[data-place]',co);busy=true;btn.disabled=true;btn.textContent=J.placing;err(null);
fetch(BASE+'/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lines:bag.map(function(x){return{id:x.id,qty:x.qty}}),name:f('name').value,phone:f('phone').value,delivery:how(),city:f('city')?f('city').value:'',area:f('area')?f('area').value:'',address:f('address')?f('address').value:'',note:f('note').value,hp:f('hp').value,lang:root.lang})})
.then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok&&x.j.code){bag=[];try{localStorage.setItem(KEY,'[]')}catch(_){}location.href=BASE+'/order/'+x.j.code+(location.search.indexOf('lang=')>-1?location.search:'');return}busy=false;btn.textContent=J.place;btn.disabled=false;err(x.j.error||'generic');if(x.j.error==='OUT_OF_STOCK')quote()})
.catch(function(){busy=false;btn.textContent=J.place;btn.disabled=false;err('generic')})})}
sync()})();`;
};

// ---------- the look: the shop's own ----------
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const ARABIC = 'U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFF';
export function shopCss(_theme: WebTheme, fontBase: string) {
  const f = (wt: number) => `@font-face{font-family:"Poppins";font-style:normal;font-weight:${wt};font-display:swap;src:url(${fontBase}/poppins-${wt}.woff2) format("woff2");unicode-range:${LATIN}}`;
  return `${f(400)}${f(500)}${f(600)}@font-face{font-family:"Vazirmatn";font-weight:300 700;font-display:swap;src:url(${fontBase}/vazirmatn.woff2) format("woff2");unicode-range:${ARABIC}}
${HW_BADGE_CSS}
:root{--bg:#F3EFE8;--paper:#FAF8F4;--card:#FFFFFF;--tile:#E8E2D8;--ink:#15120E;--ink2:#4A443B;--muted:#8A8276;--line:rgba(21,18,14,.1);--line2:rgba(21,18,14,.18);--acc:var(--accent);
--text:"Poppins","Vazirmatn",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--wrap:min(1320px,100% - 32px);--gut:16px;--e:cubic-bezier(.23,1,.32,1);--e2:cubic-bezier(.32,.72,0,1);
--sh:0 1px 2px rgba(21,18,14,.05),0 14px 36px -18px rgba(21,18,14,.28);--sh-lg:0 50px 90px -40px rgba(21,18,14,.5);--r:22px}
html[lang=ar]{--text:"Vazirmatn","Poppins",ui-sans-serif,system-ui,sans-serif}
html[data-dark]{--bg:#110F0C;--paper:#18150F;--card:#1D1A15;--tile:#26221B;--ink:#F4EFE6;--ink2:#C9C1B3;--muted:#958C7E;--line:rgba(244,239,230,.1);--line2:rgba(244,239,230,.18)}
@media (min-width:768px){:root{--wrap:min(1320px,100% - 72px);--gut:max(36px,calc((100vw - 1320px) / 2))}}
body{background:var(--bg);color:var(--ink);font-family:var(--text);font-size:15.5px;line-height:1.6;letter-spacing:-.006em;-webkit-tap-highlight-color:transparent}html[lang=ar] body{letter-spacing:0;line-height:1.75}
html,body{overflow-x:clip}body.sh-lock{overflow:hidden}:where(button){margin:0;padding:0;border:0;background:none;font:inherit;color:inherit;letter-spacing:inherit;cursor:pointer}[hidden]{display:none!important}
.sh-wrap{width:var(--wrap);margin-inline:auto}.i{width:20px;height:20px;flex:none}.i.lg{width:30px;height:30px}html[dir=rtl] .i.dir{transform:scaleX(-1)}.num{font-variant-numeric:tabular-nums}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* type */
.sh-eyebrow{display:inline-flex;align-items:center;gap:8px;margin:0;font-size:11.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}html[lang=ar] .sh-eyebrow{font-size:13.5px;letter-spacing:0}
.sh-eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 4px color-mix(in oklab,var(--acc) 18%,transparent)}
.sh-display{margin:0;font-size:clamp(2.7rem,7.4vw,6.4rem);font-weight:600;letter-spacing:-.045em;line-height:.98;text-wrap:balance}.sh-display.sm{font-size:clamp(2.1rem,4.6vw,3.8rem);letter-spacing:-.04em;line-height:1.02}
html[lang=ar] .sh-display{font-weight:700;letter-spacing:0;line-height:1.25}
.sh-h1{margin:0;font-size:clamp(1.9rem,3.6vw,2.9rem);font-weight:600;letter-spacing:-.035em;line-height:1.08}.sh-h2{margin:6px 0 0;font-size:clamp(1.6rem,2.8vw,2.3rem);font-weight:600;letter-spacing:-.035em;line-height:1.1}
html[lang=ar] :is(.sh-h1,.sh-h2){font-weight:700;letter-spacing:0;line-height:1.35}
.sh-lead{margin:0;font-size:clamp(15.5px,1.4vw,18px);color:var(--ink2);line-height:1.6}
.sh-prose p{margin:0 0 12px;color:var(--ink2)}.sh-prose p:last-child{margin:0}
.sh-price{margin:0;display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;font-weight:600;letter-spacing:-.01em}.sh-price small{font-size:.72em;font-weight:500;color:var(--muted)}.sh-price s{font-size:.82em;font-weight:400;color:var(--muted)}
/* buttons */
.sh-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:44px;padding:0 20px;border-radius:999px;font-size:14.5px;font-weight:500;white-space:nowrap;transition:transform .16s var(--e),background-color .2s,color .2s,box-shadow .2s,opacity .2s}
.sh-btn:active{transform:scale(.97)}.sh-btn .i{width:18px;height:18px}.sh-btn-lg{height:52px;padding:0 26px;font-size:15.5px}.sh-block{display:flex;width:100%}
.sh-btn-ink{background:var(--ink);color:var(--bg);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 10px 24px -12px rgba(21,18,14,.6)}.sh-btn-ink:hover{background:color-mix(in oklab,var(--ink) 86%,var(--acc))}.sh-btn-ink:disabled{opacity:.4;cursor:not-allowed}
.sh-btn-line{box-shadow:inset 0 0 0 1px var(--line2);color:var(--ink)}.sh-btn-line:hover{box-shadow:inset 0 0 0 1px var(--ink)}
.sh-btn-ghost{color:var(--ink2)}.sh-btn-ghost:hover{color:var(--ink)}
.sh-btn-paper{background:var(--bg);color:var(--ink)}.sh-btn-paper:hover{background:#fff}
.sh-btn-wa{background:#1F9D55;color:#fff}.sh-btn-wa:hover{background:#198548}
.sh-ib{display:grid;place-items:center;width:42px;height:42px;border-radius:999px;color:var(--ink);transition:background-color .2s,transform .16s var(--e)}.sh-ib:hover{background:color-mix(in oklab,var(--ink) 6%,transparent)}.sh-ib:active{transform:scale(.92)}.sh-ib.sh-only-phone{display:none}@media (max-width:899px){.sh-ib.sh-only-phone{display:grid}}
.sh-link{display:inline-flex;align-items:center;gap:6px;font-size:14.5px;font-weight:500;color:var(--ink)}.sh-link .i{width:17px;height:17px;transition:transform .3s var(--e)}.sh-link:hover .i{transform:translateX(3px)}html[dir=rtl] .sh-link:hover .i{transform:scaleX(-1) translateX(3px)}
/* the sample's note, and the running announcement */
.sh-sample{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 12px;padding:9px 16px;background:#0E1420;color:#E9E2D1;font-size:13px;text-align:center}.sh-sample b{color:#fff;font-weight:600}.sh-sample .hw.ink{height:26px;padding:0 11px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}.sh-sample .hw .hw-lock{height:10px}.sh-sample .hw i{height:12px}.sh-sample .hw{font-size:11.5px;gap:8px}.sh-sample a{display:inline-flex;align-items:center;gap:4px;color:#fff;font-weight:600;text-decoration:underline;text-underline-offset:3px}.sh-sample .i{width:14px;height:14px}
.sh-ann{overflow:hidden;background:var(--ink);color:color-mix(in oklab,var(--bg) 88%,transparent);font-size:12.5px;font-weight:500;letter-spacing:.02em}html[lang=ar] .sh-ann{font-size:13px;letter-spacing:0}
.sh-ann-t{display:flex;width:max-content;align-items:center;gap:22px;padding:9px 0;animation:sh-marq 38s linear infinite}.sh-ann-t i{font-style:normal;color:var(--acc);font-size:10px}.sh-ann:hover .sh-ann-t{animation-play-state:paused}
@keyframes sh-marq{to{transform:translateX(-50%)}}html[dir=rtl] .sh-ann-t{animation-name:sh-marq-r}@keyframes sh-marq-r{to{transform:translateX(50%)}}
/* the header: the shop's name in the middle, links at the start, the bag at the end */
.sh-head{position:sticky;top:0;z-index:40;background:color-mix(in oklab,var(--bg) 78%,transparent);backdrop-filter:blur(20px) saturate(170%);-webkit-backdrop-filter:blur(20px) saturate(170%);border-bottom:1px solid transparent;transition:border-color .3s,box-shadow .3s,background-color .3s}
.sh-head.is-stuck{border-color:var(--line);box-shadow:0 10px 30px -24px rgba(21,18,14,.45);background:color-mix(in oklab,var(--paper) 82%,transparent)}
.sh-head-in{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;width:var(--wrap);height:72px;margin-inline:auto;transition:height .3s var(--e)}.is-stuck .sh-head-in{height:62px}
.sh-head-s{display:flex;align-items:center;gap:4px;min-width:0}.sh-head-e{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.sh-nav{display:flex;align-items:center;gap:2px}.sh-nav a{position:relative;padding:8px 13px;border-radius:999px;font-size:14px;font-weight:500;color:var(--ink2);transition:color .2s,background-color .2s}.sh-nav a:hover{color:var(--ink);background:color-mix(in oklab,var(--ink) 5%,transparent)}
.sh-nav a[aria-current]{color:var(--ink)}.sh-nav a[aria-current]::after{content:"";position:absolute;inset-inline:13px;bottom:3px;height:1.5px;border-radius:2px;background:var(--ink)}
@media (max-width:899px){.sh-nav{display:none}}
.sh-logo{display:inline-flex;align-items:center;gap:10px;font-size:19px;font-weight:600;letter-spacing:-.03em;color:var(--ink)}html[lang=ar] .sh-logo{letter-spacing:0;font-weight:700}
.sh-logo img{width:34px;height:34px;border-radius:10px;object-fit:cover}.sh-mono{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--ink);color:var(--bg);font-size:15px;font-weight:600}
.sh-lang{position:relative;display:inline-grid;grid-template-columns:1fr 1fr;align-items:center;height:34px;padding:3px;border-radius:999px;background:color-mix(in oklab,var(--ink) 7%,transparent);font-size:12px;font-weight:600}
.sh-lang span{position:relative;z-index:1;display:grid;place-items:center;min-width:32px;height:28px;color:var(--muted);transition:color .25s}.sh-lang span.on{color:var(--ink)}
.sh-lang i{position:absolute;top:3px;left:3px;width:calc(50% - 3px);height:28px;border-radius:999px;background:var(--card);box-shadow:0 1px 3px rgba(21,18,14,.14);transition:transform .35s var(--e)}.sh-lang span:first-child:not(.on)~i{transform:translateX(100%)}
@media (max-width:899px){.sh-head-e .sh-lang{display:none}}
.sh-bagb{position:relative;display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 6px 0 14px;border-radius:999px;background:var(--ink);color:var(--bg);font-size:14px;font-weight:500;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 8px 18px -10px rgba(21,18,14,.6);transition:transform .16s var(--e)}
html[dir=rtl] .sh-bagb{padding:0 14px 0 6px}.sh-bagb:active{transform:scale(.95)}.sh-bagb .i{width:18px;height:18px}
.sh-bagb .n{display:grid;place-items:center;min-width:30px;height:30px;padding:0 8px;border-radius:999px;background:color-mix(in oklab,var(--bg) 16%,transparent);font-size:12.5px;font-weight:600;transition:background-color .25s}.sh-bagb.has .n{background:var(--acc);color:#fff}
.sh-bagb.bump .i{animation:sh-dip .5s var(--e)}.sh-bagb.bump .n{animation:sh-pop .45s var(--e)}@keyframes sh-dip{35%{transform:translateY(3px) rotate(-10deg)}}@keyframes sh-pop{40%{transform:scale(1.25)}}
@media (max-width:899px){.sh-bagb{padding:0;width:42px;justify-content:center}.sh-bagb .l{display:none}.sh-bagb .n{position:absolute;top:-4px;inset-inline-end:-4px;min-width:20px;height:20px;padding:0 5px;font-size:11px;box-shadow:0 0 0 2px var(--bg)}.sh-bagb:not(.has) .n{display:none}.sh-logo{font-size:17px}.sh-logo span{max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
/* the hero */
.sh-hero{position:relative;padding:clamp(40px,7vw,88px) 0 0;overflow:hidden}
.sh-hero-glow{position:absolute;inset:auto 0 0;height:78%;background:radial-gradient(60% 55% at 50% 62%,color-mix(in oklab,var(--acc) 26%,transparent),transparent 70%),radial-gradient(40% 40% at 20% 80%,color-mix(in oklab,var(--acc) 12%,transparent),transparent 70%);pointer-events:none}
.sh-hero-copy{position:relative;display:grid;justify-items:center;gap:20px;text-align:center}.sh-hero-copy .sh-display{max-width:14ch}.sh-hero-copy .sh-lead{max-width:560px}
.sh-hero-copy>*{animation:sh-rise .9s var(--e) both}.sh-hero-copy>:nth-child(2){animation-delay:.06s}.sh-hero-copy>:nth-child(3){animation-delay:.12s}.sh-hero-copy>:nth-child(4){animation-delay:.18s}
@keyframes sh-rise{from{opacity:0;transform:translateY(18px)}}
.sh-ctas{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:6px}
.sh-flow{position:relative;margin-top:clamp(28px,5vw,56px);animation:sh-rise 1.1s var(--e) both .2s}
.sh-flow-stage{position:relative;height:calc(clamp(230px,27vw,400px) * 1.25);perspective:1600px;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.sh-flow-card{position:absolute;top:0;left:50%;width:clamp(230px,27vw,400px);aspect-ratio:4/5;margin-left:calc(clamp(230px,27vw,400px) / -2);border-radius:30px;overflow:hidden;background:var(--tile);box-shadow:var(--sh-lg);transition:transform .9s var(--e2),opacity .6s var(--e),filter .6s;transform-origin:50% 60%;will-change:transform}
.sh-flow-card img{width:100%;height:100%;object-fit:cover;pointer-events:none}.sh-flow-card:not(.on){filter:saturate(.85) brightness(.92);cursor:pointer}
.sh-flow-card::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);pointer-events:none}
.sh-flow-cap{position:relative;display:grid;justify-items:center;height:78px;margin-top:22px;text-align:center}
.sh-flow-c{grid-area:1/1;display:grid;justify-items:center;gap:2px;opacity:0;transform:translateY(8px);transition:opacity .45s var(--e),transform .45s var(--e);pointer-events:none}.sh-flow-c.on{opacity:1;transform:none;pointer-events:auto}
.sh-flow-c .k{font-size:12px;font-weight:500;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}html[lang=ar] .sh-flow-c .k{letter-spacing:0;font-size:13px}.sh-flow-c b{font-size:20px;font-weight:600;letter-spacing:-.02em}.sh-flow-c .sh-price{font-size:16px}
.sh-flow-ctl{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:6px}.sh-flow-ctl .sh-ib{box-shadow:inset 0 0 0 1px var(--line2)}
.sh-dots{display:flex;gap:6px}.sh-dots i{width:6px;height:6px;border-radius:999px;background:var(--line2);transition:width .4s var(--e),background-color .3s}.sh-dots i.on{width:22px;background:var(--ink)}
@media (max-width:640px){.sh-dots{display:none}}
.sh-flow-add.is-added,.sh-add.is-added{background:var(--acc)}
.sh-hero-mono{display:grid;place-items:center;width:min(520px,86%);aspect-ratio:4/3;margin:40px auto 0;border-radius:32px;overflow:hidden;background:var(--tile);box-shadow:var(--sh-lg)}.sh-hero-mono img{width:100%;height:100%;object-fit:cover}.sh-hero-mono .sh-mono{width:96px;height:96px;border-radius:28px;font-size:36px}
.sh-promise{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:clamp(40px,6vw,72px) 0 0;padding:0;list-style:none;border-block:1px solid var(--line)}
.sh-promise li{display:flex;align-items:center;gap:14px;padding:22px 18px}.sh-promise li+li{border-inline-start:1px solid var(--line)}.sh-promise .i{width:24px;height:24px;color:var(--acc)}.sh-promise span{display:grid;line-height:1.35}.sh-promise b{font-size:14px;font-weight:600}.sh-promise small{font-size:12.5px;color:var(--muted)}
@media (max-width:760px){.sh-promise{grid-template-columns:1fr 1fr}.sh-promise li{padding:16px 10px;gap:10px}.sh-promise li+li{border:0}.sh-promise li:nth-child(n+3){border-top:1px solid var(--line)}.sh-promise li:nth-child(even){border-inline-start:1px solid var(--line)}}
/* sections */
.sh-sec{padding:clamp(56px,8vw,104px) 0 0}.sh-sec:last-of-type{padding-bottom:clamp(56px,8vw,104px)}
.sh-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:26px}.sh-rail-ctl{display:flex;gap:8px}.sh-rail-ctl .sh-ib{box-shadow:inset 0 0 0 1px var(--line2)}@media (max-width:640px){.sh-rail-ctl{display:none}}
.sh-rv{opacity:0;transform:translateY(22px);transition:opacity .9s var(--e),transform .9s var(--e);transition-delay:calc(var(--i,0) * 70ms)}.sh-rv.in,html:not(.js) .sh-rv{opacity:1;transform:none}
/* category tiles */
.sh-cats{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:14px}@media (max-width:900px){.sh-cats{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;margin-inline:calc(-1 * var(--gut));padding-inline:var(--gut);scrollbar-width:none}.sh-cats::-webkit-scrollbar{display:none}.sh-tile{flex:0 0 68%;scroll-snap-align:center}}
.sh-tile{position:relative;display:block;aspect-ratio:3/4;border-radius:var(--r);overflow:hidden;background:var(--tile);color:#fff;isolation:isolate}
.sh-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform 1.2s var(--e)}.sh-tile::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(to top,rgba(10,8,6,.62),rgba(10,8,6,0) 55%)}
.sh-tile-b{position:absolute;inset-inline:20px;bottom:18px;display:grid;line-height:1.3}.sh-tile-b b{font-size:clamp(18px,1.7vw,23px);font-weight:600;letter-spacing:-.02em}html[lang=ar] .sh-tile-b b{letter-spacing:0}.sh-tile-b small{font-size:13px;opacity:.82}
.sh-tile-go{position:absolute;top:16px;inset-inline-end:16px;display:grid;place-items:center;width:38px;height:38px;border-radius:999px;background:rgba(255,255,255,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:background-color .3s,color .3s,transform .4s var(--e)}.sh-tile-go .i{width:17px;height:17px}
@media (hover:hover) and (pointer:fine){.sh-tile:hover img{transform:scale(1.06)}.sh-tile:hover .sh-tile-go{background:#fff;color:var(--ink);transform:rotate(-45deg)}html[dir=rtl] .sh-tile:hover .sh-tile-go{transform:rotate(45deg)}}
/* the rail */
.sh-rail{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px var(--gut) 8px;scroll-padding-inline:var(--gut);scrollbar-width:none}.sh-rail::-webkit-scrollbar{display:none}
.sh-rail .sh-card{flex:0 0 clamp(210px,22vw,300px);scroll-snap-align:start}
/* product cards */
.sh-grid{display:grid;gap:28px 16px;grid-template-columns:repeat(auto-fill,minmax(min(44%,232px),1fr))}@media (min-width:1000px){.sh-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:40px 22px}}
.sh-card{position:relative;display:flex;flex-direction:column;min-width:0}
.sh-card-media{position:relative;display:block;aspect-ratio:4/5;border-radius:var(--r);overflow:hidden;background:var(--tile)}.sh-card-media img{width:100%;height:100%;object-fit:cover;transition:transform 1.1s var(--e),opacity .5s var(--e)}
.sh-card-media img.alt{position:absolute;inset:0;opacity:0}.sh-ph{display:grid;place-items:center;height:100%;color:var(--muted)}.sh-ph .i{width:34px;height:34px}
@media (hover:hover) and (pointer:fine){.sh-card:hover .sh-card-media img{transform:scale(1.04)}.sh-card:hover .sh-card-media.has-2 img.alt{opacity:1}}
.sh-card.is-out .sh-card-media img{filter:grayscale(.7);opacity:.6}
.sh-tags{position:absolute;top:12px;inset-inline-start:12px;display:flex;gap:6px;pointer-events:none}
.sh-badge{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:color-mix(in oklab,var(--card) 88%,transparent);backdrop-filter:blur(8px);color:var(--ink);font-size:11.5px;font-weight:600;letter-spacing:.01em}.sh-badge.acc{background:var(--acc);color:#fff}.sh-badge.warn{background:#FFF4DE;color:#8A5A00}.sh-badge.mute{background:var(--ink);color:var(--bg)}
.sh-card{container-type:inline-size}.sh-quick{position:absolute;z-index:2;inset-inline-end:12px;top:calc(125cqw - 52px);display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px 0 10px;border-radius:999px;background:var(--card);color:var(--ink);font-size:13.5px;font-weight:600;box-shadow:0 10px 24px -12px rgba(21,18,14,.5);transition:transform .35s var(--e),opacity .3s,background-color .25s,color .25s}
html[dir=rtl] .sh-quick{padding:0 10px 0 14px}
.q-ic{position:relative;display:grid;place-items:center;width:20px;height:20px}.q-ic .i{position:absolute;width:18px;height:18px;transition:transform .35s var(--e),opacity .25s}.q-ic .ok{opacity:0;transform:rotate(-90deg) scale(.5)}
.sh-quick.is-added{background:var(--ink);color:var(--bg)}.sh-quick.is-added .q-ic .i:not(.ok){opacity:0;transform:rotate(90deg) scale(.5)}.sh-quick.is-added .q-ic .ok{opacity:1;transform:none}
@media (hover:hover) and (pointer:fine){.sh-quick{opacity:0;transform:translateY(8px)}.sh-card:hover .sh-quick,.sh-quick:focus-visible,.sh-quick.is-added{opacity:1;transform:none}}
@media (hover:none),(pointer:coarse){.sh-quick{width:40px;padding:0;justify-content:center}.sh-quick .q-l{display:none}}
.sh-card-b{display:grid;gap:3px;padding:14px 2px 0}.sh-card-t{margin:0;font-size:15px;font-weight:500;line-height:1.4;letter-spacing:-.01em}html[lang=ar] .sh-card-t{letter-spacing:0}.sh-card-t a::after{content:"";position:absolute;inset:0;z-index:1}
.sh-card-m{margin:0;font-size:12.5px;color:var(--muted)}.sh-card .sh-price{margin-top:4px;font-size:15.5px}
.sh-more{display:flex;justify-content:center;margin:40px 0 0}
.sh-tabs{display:flex;gap:6px;margin:0 0 26px;overflow-x:auto;scrollbar-width:none;padding:2px}.sh-tabs::-webkit-scrollbar{display:none}
.sh-tabs :is(button,a){flex:none;height:40px;padding:0 18px;border-radius:999px;font-size:14px;font-weight:500;color:var(--ink2);box-shadow:inset 0 0 0 1px var(--line);transition:background-color .25s,color .25s,box-shadow .25s}.sh-tabs :is(button,a):hover{box-shadow:inset 0 0 0 1px var(--line2);color:var(--ink)}
.sh-tabs [aria-selected=true],.sh-tabs [aria-current]{background:var(--ink);color:var(--bg);box-shadow:none}.sh-tabs a{display:inline-flex;align-items:center}
/* the story band */
.sh-story{margin-top:clamp(56px,8vw,104px);background:var(--ink);color:var(--bg)}.sh-story-in{display:grid;gap:clamp(28px,5vw,72px);align-items:center;padding:clamp(48px,7vw,96px) 0}@media (min-width:900px){.sh-story-in{grid-template-columns:1.05fr 1fr}}
.sh-story figure{margin:0;aspect-ratio:4/5;max-height:640px;border-radius:28px;overflow:hidden;background:#000}.sh-story figure img{width:100%;height:100%;object-fit:cover}
.sh-story-b{display:grid;gap:20px;justify-items:start}.sh-story .sh-eyebrow{color:color-mix(in oklab,var(--bg) 60%,transparent)}.sh-story .sh-prose p{color:color-mix(in oklab,var(--bg) 78%,transparent);font-size:16.5px;line-height:1.75}.sh-story .sh-btn{margin-top:8px}
/* help */
.sh-help{display:grid;gap:28px;padding:clamp(28px,5vw,56px);border-radius:32px;background:var(--paper);box-shadow:inset 0 0 0 1px var(--line)}@media (min-width:900px){.sh-help{grid-template-columns:1.4fr 1fr;align-items:end}}
.sh-help>div{display:grid;gap:16px;justify-items:start}.sh-help .sh-ctas{justify-content:flex-start}
.sh-help dl{display:grid;gap:14px;margin:0}.sh-help dt{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted)}.sh-help dt .i{width:16px;height:16px}.sh-help dd{margin:2px 0 0;font-size:16px;font-weight:500}
/* the footer */
.sh-foot{padding:clamp(48px,6vw,80px) 0 28px;background:#0F0D0A;color:#D9D2C5;overflow:hidden}
.sh-foot .sh-logo{color:#fff}.sh-foot .sh-mono{background:#fff;color:#0F0D0A}
.sh-foot-top{display:grid;gap:36px}@media (min-width:900px){.sh-foot-top{grid-template-columns:1.6fr 1fr 1fr 1.2fr}}
.sh-foot-brand{display:grid;gap:16px;justify-items:start}.sh-foot-brand p{margin:0;max-width:340px;color:#A39B8D;font-size:14.5px}
.sh-foot h4{margin:0 0 14px;font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#8A8275}html[lang=ar] .sh-foot h4{letter-spacing:0;font-size:13px}
.sh-foot ul{display:grid;gap:10px;margin:0;padding:0;list-style:none;font-size:14.5px}.sh-foot ul a{color:#D9D2C5;transition:color .2s}.sh-foot ul a:hover{color:#fff}
.sh-foot-word{margin:clamp(40px,6vw,72px) 0 0;font-size:clamp(4.5rem,17vw,15rem);font-weight:600;letter-spacing:-.06em;line-height:.8;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,0));-webkit-background-clip:text;background-clip:text;white-space:nowrap;overflow:hidden;text-overflow:clip}html[lang=ar] .sh-foot-word{letter-spacing:0;line-height:1.1}
.sh-foot-bot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin-top:22px;padding-top:22px;border-top:1px solid rgba(255,255,255,.1);font-size:12.5px;color:#8A8275}
.sh-pay{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 12px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);color:#D9D2C5}.sh-pay .i{width:16px;height:16px}.sh-foot .hw-made{color:#8A8275}
/* pages: the catalogue, the product, the checkout */
.sh-page,.sh-pdp{padding:22px 0 clamp(56px,8vw,96px)}
.sh-crumb{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 18px;font-size:13px;color:var(--muted)}.sh-crumb a:hover{color:var(--ink)}.sh-crumb .i{width:14px;height:14px}.sh-crumb span{color:var(--ink2)}
.sh-page-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 16px;margin:0 0 22px}.sh-page-head span{font-size:14px;color:var(--muted)}
.sh-toolbar{position:sticky;top:62px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin:0 calc(-1 * var(--gut)) 28px;padding:12px var(--gut);background:color-mix(in oklab,var(--bg) 88%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.sh-toolbar .sh-tabs{margin:0;flex:1;min-width:0}.sh-find{display:flex;gap:8px;flex:0 1 460px}@media (max-width:760px){.sh-find{flex:1 1 100%}}
.sh-find-q{flex:1;min-width:0;display:flex;align-items:center;gap:10px;height:42px;padding:0 16px;border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}.sh-find-q:focus-within{box-shadow:inset 0 0 0 1.5px var(--ink)}.sh-find-q .i{width:18px;height:18px;color:var(--muted)}
.sh-find-q input{flex:1;min-width:0;width:100%;border:0;background:transparent;font:inherit;font-size:14.5px;color:var(--ink);outline:none}
.sh-sort{position:relative;display:flex;align-items:center;flex:none}.sh-sort select{appearance:none;height:42px;padding:0 38px 0 16px;border-radius:999px;border:0;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);font:inherit;font-size:14px;color:var(--ink);cursor:pointer}html[dir=rtl] .sh-sort select{padding:0 16px 0 38px}
.sh-sort .i{position:absolute;inset-inline-end:14px;width:16px;height:16px;pointer-events:none;color:var(--muted)}
.sh-empty{display:grid;justify-items:center;gap:10px;padding:64px 16px;text-align:center;color:var(--muted)}.sh-empty h2{margin:6px 0 0;font-size:20px;font-weight:600;color:var(--ink)}.sh-empty p{margin:0 0 8px}
/* product page */
.sh-pdp-g{display:grid;gap:28px}@media (min-width:980px){.sh-pdp-g{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:56px;align-items:start}}
.sh-gal{display:grid;gap:12px}@media (min-width:980px){.sh-gal.many{grid-template-columns:76px minmax(0,1fr)}.sh-gal-thumbs{display:grid;align-content:start;gap:10px}}
.sh-gal-main{position:relative;aspect-ratio:4/5;border-radius:28px;overflow:hidden;background:var(--tile)}.sh-gal-main.ph{display:grid;place-items:center;color:var(--muted)}
.sh-gal-track{display:flex;height:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}.sh-gal-track::-webkit-scrollbar{display:none}.sh-gal-track img{flex:0 0 100%;width:100%;height:100%;object-fit:cover;scroll-snap-align:start;scroll-snap-stop:always}
.sh-gal-thumbs button{display:block;width:76px;aspect-ratio:4/5;border-radius:14px;overflow:hidden;opacity:.55;box-shadow:0 0 0 1.5px transparent;transition:opacity .25s,box-shadow .25s}.sh-gal-thumbs button[aria-current]{opacity:1;box-shadow:0 0 0 1.5px var(--ink)}.sh-gal-thumbs img{width:100%;height:100%;object-fit:cover}
@media (max-width:979px){.sh-gal-thumbs{display:none}.sh-gal-main{margin-inline:calc(-1 * var(--gut));border-radius:0}}
.sh-gal-nav{position:absolute;top:50%;translate:0 -50%;display:grid;place-items:center;width:46px;height:46px;border-radius:999px;background:color-mix(in oklab,#fff 86%,transparent);color:#111;box-shadow:0 8px 20px -10px rgba(0,0,0,.4);backdrop-filter:blur(8px);opacity:0;transition:opacity .25s}.sh-gal-nav.prev{inset-inline-start:16px}.sh-gal-nav.next{inset-inline-end:16px}.sh-gal-main:hover .sh-gal-nav,.sh-gal-nav:focus-visible{opacity:1}@media (hover:none){.sh-gal-nav{display:none}}
.sh-gal-dots{position:absolute;bottom:16px;left:50%;translate:-50% 0;display:flex;gap:6px;padding:7px 10px;border-radius:999px;background:rgba(0,0,0,.28);backdrop-filter:blur(8px)}.sh-gal-dots i{width:6px;height:6px;border-radius:999px;background:rgba(255,255,255,.55);transition:width .35s var(--e),background-color .3s}.sh-gal-dots i.on{width:18px;background:#fff}
.sh-buy{display:grid;gap:16px;align-content:start}@media (min-width:980px){.sh-buy{position:sticky;top:90px;padding-top:12px}}
.sh-buy-cat{width:max-content}.sh-buy-price{font-size:clamp(22px,2.2vw,28px)}.sh-size{display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line2);font-size:13px;font-weight:500;color:var(--ink2);align-self:center}
.sh-buy-short{margin:0;font-size:16px;color:var(--ink2);line-height:1.65}
.sh-stock{display:inline-flex;align-items:center;gap:8px;margin:0;font-size:13.5px;font-weight:500;color:#1D7A45}.sh-stock i{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px color-mix(in oklab,currentColor 18%,transparent)}.sh-stock.low{color:#A2650A}.sh-stock.out{color:var(--muted)}
.sh-buy-row{display:flex;gap:10px}.sh-buy-row .sh-add{flex:1}
.sh-qty{display:inline-flex;align-items:center;gap:2px;padding:4px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line2)}.sh-qty button{display:grid;place-items:center;width:42px;height:42px;border-radius:999px;transition:background-color .2s,transform .16s var(--e)}.sh-qty button:hover{background:color-mix(in oklab,var(--ink) 6%,transparent)}.sh-qty button:active{transform:scale(.88)}
.sh-qty input,.sh-qty>span{width:40px;text-align:center;border:0;background:transparent;font:inherit;font-size:16px;font-weight:600;color:var(--ink);outline:none}
.sh-qty.sm{padding:2px;margin-top:8px;width:max-content}.sh-qty.sm button{width:30px;height:30px}.sh-qty.sm .i{width:15px;height:15px}.sh-qty.sm>span{width:28px;font-size:14px}
.sh-add{position:relative;overflow:hidden}.sh-add .a-l,.sh-add .a-ok{display:inline-flex;align-items:center;gap:9px;transition:opacity .3s,transform .4s var(--e),filter .3s}.sh-add .a-ok{position:absolute;inset:0;justify-content:center;opacity:0;transform:translateY(60%);filter:blur(2px)}
.sh-add.is-added .a-l{opacity:0;transform:translateY(-60%);filter:blur(2px)}.sh-add.is-added .a-ok{opacity:1;transform:none;filter:none}
.sh-acc{margin-top:8px;border-top:1px solid var(--line)}.sh-acc details{border-bottom:1px solid var(--line)}.sh-acc summary{display:flex;align-items:center;justify-content:space-between;padding:18px 0;font-size:15px;font-weight:600;cursor:pointer;list-style:none}.sh-acc summary::-webkit-details-marker{display:none}
.sh-acc summary .i{width:18px;height:18px;transition:transform .35s var(--e)}.sh-acc details[open] summary .i{transform:rotate(45deg)}.sh-acc details>:not(summary){padding:0 0 18px}
.sh-notes{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}.sh-notes li{padding:7px 14px;border-radius:999px;background:var(--paper);box-shadow:inset 0 0 0 1px var(--line);font-size:13.5px;color:var(--ink2)}
/* the bag, the menu, search */
dialog.sh-drawer{position:fixed;inset:0;width:100%;max-width:none;height:100%;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:hidden}
dialog.sh-drawer::backdrop{background:rgba(15,13,10,0);transition:background-color .32s}dialog.sh-drawer.is-open::backdrop{background:rgba(15,13,10,.42);backdrop-filter:blur(2px)}
.sh-drawer-p{position:absolute;top:0;bottom:0;inset-inline-end:0;display:flex;flex-direction:column;width:min(440px,100%);background:var(--paper);box-shadow:-30px 0 80px -40px rgba(0,0,0,.5);transform:translateX(100%);transition:transform .38s var(--e2)}
html[dir=rtl] .sh-drawer-p{transform:translateX(-100%)}.sh-drawer.start .sh-drawer-p{inset-inline-end:auto;inset-inline-start:0;transform:translateX(-100%)}html[dir=rtl] .sh-drawer.start .sh-drawer-p{transform:translateX(100%)}
.sh-drawer.is-open .sh-drawer-p{transform:none!important}
@media (max-width:640px){.sh-drawer:not(.start) .sh-drawer-p{top:auto;inset-inline:0;width:100%;height:min(88svh,760px);border-radius:28px 28px 0 0;transform:translateY(100%)!important}.sh-drawer.is-open:not(.start) .sh-drawer-p{transform:none!important}.sh-drawer:not(.start) .sh-drawer-p::before{content:"";align-self:center;width:40px;height:5px;margin-top:8px;border-radius:999px;background:var(--line2)}}
.sh-drawer-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--line)}.sh-drawer-h b{font-size:18px;font-weight:600;letter-spacing:-.02em}.sh-drawer-h b span{display:inline-grid;place-items:center;min-width:24px;height:24px;margin-inline-start:6px;padding:0 7px;border-radius:999px;background:var(--ink);color:var(--bg);font-size:12px;vertical-align:2px}
.sh-drawer-b{flex:1;overflow:auto;padding:4px 20px;overscroll-behavior:contain}.sh-drawer-f{display:grid;gap:10px;padding:16px 20px calc(18px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--paper)}
.sh-free{padding:14px 20px;border-bottom:1px solid var(--line);background:color-mix(in oklab,var(--acc) 7%,var(--paper))}.sh-free p{margin:0 0 9px;font-size:13.5px;font-weight:500}.sh-free .bar{display:block;height:6px;border-radius:999px;background:var(--line);overflow:hidden}
.sh-free .bar i{display:block;height:100%;border-radius:inherit;background:var(--acc);transform-origin:left;transition:transform .6s var(--e)}html[dir=rtl] .sh-free .bar i{transform-origin:right}.sh-free.done p{color:#1D7A45}.sh-free.done .bar i{background:#1D7A45}
.sh-bag-empty{display:grid;justify-items:center;gap:8px;padding:56px 12px;text-align:center}.sh-bag-empty>span{display:grid;place-items:center;width:72px;height:72px;margin-bottom:6px;border-radius:999px;background:var(--tile);color:var(--ink2)}.sh-bag-empty b{font-size:17px;font-weight:600}.sh-bag-empty p{margin:0 0 10px;font-size:14px;color:var(--muted)}
.sh-bag-sub{display:flex;justify-content:space-between;align-items:baseline;font-size:15px}.sh-bag-sub b{font-size:21px;font-weight:600;letter-spacing:-.01em}.sh-bag-note{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:13px;color:var(--muted)}.sh-bag-note .i{width:16px;height:16px}
.sh-lines{display:grid;margin:0;padding:0;list-style:none}.sh-lines li{display:flex;align-items:flex-start;gap:14px;padding:16px 0;border-bottom:1px solid var(--line)}.sh-lines li:last-child{border-bottom:0}.sh-lines li.short{opacity:.5}
.sh-line-img{position:relative;display:grid;place-items:center;flex:none;width:76px;aspect-ratio:4/5;border-radius:14px;overflow:visible;background:var(--tile);color:var(--muted)}.sh-line-img img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
.sh-line-q{position:absolute;top:-7px;inset-inline-end:-7px;display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--ink);color:var(--bg);font-size:11.5px;font-weight:600}
.sh-line-t{display:grid;flex:1;min-width:0;line-height:1.4;align-content:start}.sh-line-t b{font-size:14.5px;font-weight:500}.sh-line-t small{font-size:13px;color:var(--muted)}.sh-line-p{flex:none;font-size:14.5px;font-weight:600}
.sh-menu-links{display:grid;padding:10px 0}.sh-menu-links a{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--line);font-size:24px;font-weight:600;letter-spacing:-.03em}html[lang=ar] .sh-menu-links a{letter-spacing:0}.sh-menu-links .i{color:var(--muted)}
.sh-drawer.is-open .sh-menu-links a{animation:sh-rise .5s var(--e) both;animation-delay:calc(80ms + var(--i) * 35ms)}
.sh-menu-cats{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 0 20px}.sh-menu-cats a{position:relative;display:block;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:var(--tile);color:#fff}.sh-menu-cats img{width:100%;height:100%;object-fit:cover}.sh-menu-cats a::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.55),transparent 60%)}.sh-menu-cats span{position:absolute;z-index:1;inset-inline-start:12px;bottom:10px;font-size:14px;font-weight:600}
dialog.sh-searchd{position:fixed;inset:0 0 auto 0;width:100%;max-width:none;height:auto;max-height:none;margin:0;padding:18px var(--gut) 22px;border:0;background:var(--paper);color:var(--ink);box-shadow:0 30px 60px -30px rgba(0,0,0,.35);transform:translateY(-100%);transition:transform .35s var(--e2)}dialog.sh-searchd.is-open{transform:none}
dialog.sh-searchd::backdrop{background:rgba(15,13,10,0);transition:background-color .3s}dialog.sh-searchd.is-open::backdrop{background:rgba(15,13,10,.35)}
.sh-searchd form{display:flex;align-items:center;gap:12px}.sh-searchd label{flex:1;display:flex;align-items:center;gap:12px;height:58px;padding:0 20px;border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}.sh-searchd input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:18px;color:var(--ink);outline:none}
.sh-search-cats{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.sh-search-cats a{height:36px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;box-shadow:inset 0 0 0 1px var(--line);font-size:14px}
/* the small bag after an add */
.sh-pop{position:fixed;z-index:60;top:84px;inset-inline-end:max(16px,var(--gut));display:grid;grid-template-columns:64px 1fr;gap:12px 14px;width:min(360px,calc(100vw - 32px));padding:14px;border-radius:22px;background:var(--paper);box-shadow:0 0 0 1px var(--line),0 30px 60px -24px rgba(21,18,14,.5);opacity:0;transform:translateY(-8px) scale(.97);transform-origin:top right;transition:opacity .25s var(--e),transform .4s var(--e)}
html[dir=rtl] .sh-pop{transform-origin:top left}.sh-pop.in{opacity:1;transform:none}
.sh-pop-img{width:64px;aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:var(--tile)}.sh-pop-img img{width:100%;height:100%;object-fit:cover}
.sh-pop-t{display:grid;align-content:center;gap:2px;min-width:0}.sh-pop-t small{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#1D7A45}.sh-pop-t small .i{width:15px;height:15px}.sh-pop-t b{font-size:14.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sh-pop-t span{font-size:13.5px;color:var(--ink2)}
.sh-pop-a{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:8px}.sh-pop-a .sh-btn{height:42px}
@media (max-width:640px){.sh-pop{top:auto;bottom:calc(14px + env(safe-area-inset-bottom));transform-origin:bottom center;transform:translateY(12px) scale(.97)}}
/* the phone bar */
.sh-bar{position:fixed;z-index:30;inset-inline:0;bottom:0;display:flex;align-items:center;gap:12px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:color-mix(in oklab,var(--paper) 90%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid var(--line)}
.sh-bar>.sh-btn{flex:1}.sh-bar-n{display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:rgba(255,255,255,.2);font-size:12px}.sh-bar-t{margin-inline-start:auto;font-weight:600}.sh-bar:not(.pdp)>.sh-btn{justify-content:flex-start}.sh-bar-p{font-size:18px}
@media (min-width:900px){.sh-bar{display:none!important}}@media (max-width:899px){body.has-bar{padding-bottom:84px}}
/* checkout */
.sh-co-h{margin:4px 0 28px}.sh-co{display:grid;gap:24px}@media (min-width:980px){.sh-co{grid-template-columns:minmax(0,1fr) 420px;gap:44px;align-items:start}}
.sh-co-form{display:grid;gap:16px}.sh-step{display:grid;gap:14px;margin:0;padding:22px;border:0;border-radius:24px;background:var(--paper);box-shadow:inset 0 0 0 1px var(--line)}
.sh-step legend{float:left;display:flex;align-items:center;gap:10px;width:100%;margin:0 0 4px;padding:0;font-size:17px;font-weight:600;letter-spacing:-.02em}html[dir=rtl] .sh-step legend{float:right}.sh-step legend i{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:var(--ink);color:var(--bg);font-style:normal;font-size:13px}
.sh-2{display:grid;gap:14px}@media (min-width:560px){.sh-2{grid-template-columns:1fr 1fr}}.sh-addr{display:grid;gap:14px}
.sh-field{display:grid;gap:6px}.sh-field>span{font-size:13px;font-weight:500;color:var(--ink2)}
.sh-field :is(input,select,textarea){width:100%;height:50px;padding:0 16px;border-radius:14px;border:0;background:var(--card);box-shadow:inset 0 0 0 1px var(--line2);font:inherit;font-size:15.5px;color:var(--ink);outline:none;transition:box-shadow .2s}
.sh-field textarea{height:auto;padding:13px 16px;resize:vertical}.sh-field :is(input,select,textarea):focus{box-shadow:inset 0 0 0 1.5px var(--ink),0 0 0 4px color-mix(in oklab,var(--ink) 8%,transparent)}
.sh-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:16px;background:var(--tile)}.sh-seg input{position:absolute;opacity:0;pointer-events:none}
.sh-seg span{display:flex;align-items:center;justify-content:center;gap:8px;height:46px;border-radius:12px;font-size:14px;font-weight:500;color:var(--ink2);cursor:pointer;transition:background-color .25s,color .25s,box-shadow .25s}.sh-seg .i{width:18px;height:18px}.sh-seg input:checked+span{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(21,18,14,.12)}.sh-seg input:focus-visible+span{outline:2px solid var(--ring)}
.sh-co-note{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;color:var(--muted)}.sh-co-note .i{width:16px;height:16px}
.sh-cod{display:flex;align-items:center;gap:12px;margin:0;padding:14px 16px;border-radius:16px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line2)}.sh-cod.is-on{box-shadow:inset 0 0 0 1.5px var(--ink)}.sh-cod>.i{width:24px;height:24px;color:var(--acc)}.sh-cod span{display:grid;flex:1;line-height:1.35}.sh-cod b{font-size:14.5px}.sh-cod small{font-size:12.5px;color:var(--muted)}
.sh-cod .tick{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:var(--ink);color:var(--bg)}.sh-cod .tick .i{width:14px;height:14px;stroke-width:2.4}
.sh-hp{position:absolute;inset-inline-start:-9999px;width:1px;height:1px;opacity:0}
.sh-co-sum{display:grid;gap:14px;padding:24px;border-radius:26px;background:var(--card);box-shadow:var(--sh),inset 0 0 0 1px var(--line)}@media (min-width:980px){.sh-co-sum{position:sticky;top:90px}}
.sh-co-t{margin:0;font-size:18px;font-weight:600;letter-spacing:-.02em}html[lang=ar] .sh-co-t{letter-spacing:0}.sh-co-sum .sh-lines{max-height:360px;overflow:auto;padding-top:8px}.sh-co-sum .sh-line-img{width:60px}
.sh-tot{display:grid;gap:9px;margin:0;padding-top:14px;border-top:1px solid var(--line)}.sh-tot>div{display:flex;justify-content:space-between;align-items:baseline;font-size:14.5px;color:var(--ink2)}.sh-tot dd{margin:0;font-weight:500;color:var(--ink)}
.sh-tot .big{padding-top:12px;border-top:1px solid var(--line);font-size:16px;color:var(--ink)}.sh-tot .big dd{font-size:24px;font-weight:600;letter-spacing:-.02em}
.sh-err{margin:0;padding:11px 14px;border-radius:14px;background:#FEF2F2;color:#B91C1C;font-size:14px}.sh-secure{display:flex;gap:8px;margin:0;font-size:12.5px;color:var(--muted);line-height:1.5}.sh-secure .i{width:16px;height:16px;margin-top:2px}
/* the order afterwards */
.sh-order{max-width:940px}.sh-order-h{display:grid;justify-items:center;gap:10px;padding:16px 0 8px;text-align:center}
.sh-order-ic{display:grid;place-items:center;width:76px;height:76px;margin-bottom:6px;border-radius:999px;background:var(--ink);color:var(--bg);animation:sh-pop .7s var(--e) both .1s}.sh-order-ic .i{width:34px;height:34px;stroke-width:2.2}.sh-order-ic.bad{background:#FEF2F2;color:#B91C1C}
.sh-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:34px 0;padding:0;list-style:none}
.sh-steps li{position:relative;display:grid;justify-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--muted);text-align:center}
.sh-steps li::before{content:"";position:absolute;top:16px;inset-inline-start:calc(-50% + 20px);inset-inline-end:calc(50% + 20px);height:2px;border-radius:2px;background:var(--line2)}.sh-steps li:first-child::before{display:none}.sh-steps li.done::before,.sh-steps li.now::before{background:var(--ink)}
.sh-steps i{display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:var(--paper);box-shadow:inset 0 0 0 2px var(--line2)}.sh-steps i .i{width:16px;height:16px;stroke-width:2.4}
.sh-steps .done i,.sh-steps .now i{background:var(--ink);box-shadow:none;color:var(--bg)}.sh-steps .now{color:var(--ink)}.sh-steps .now i{box-shadow:0 0 0 6px color-mix(in oklab,var(--ink) 12%,transparent)}
.sh-order-g{display:grid;gap:16px}@media (min-width:860px){.sh-order-g{grid-template-columns:1.3fr 1fr;align-items:start}}
.sh-box{display:grid;gap:14px;padding:24px;border-radius:26px;background:var(--paper);box-shadow:inset 0 0 0 1px var(--line)}.sh-box .sh-line-img{width:60px}
.sh-addr-l{display:flex;gap:10px;margin:0;font-size:14.5px;color:var(--ink2)}.sh-addr-l .i{flex:none;margin-top:3px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.sh-ann-t{animation:none;width:auto;justify-content:center;flex-wrap:wrap}.sh-ann-t [aria-hidden]{display:none}.sh-hero-copy>*,.sh-flow,.sh-order-ic{animation:none}.sh-flow-card,.sh-drawer-p,.sh-searchd{transition:none}.sh-rv{opacity:1;transform:none;transition:none}}`;
}
