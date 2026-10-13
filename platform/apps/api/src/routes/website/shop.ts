// The shop website ("shop"): a real online store for a shop's own products. Built on the estate design's foundation
// (its type, buttons, sheets, header and footer: one Hemlo family), with what a shop needs on top: shelves and
// categories, a product page with a quantity and "add to bag", the bag as a sheet, a checkout with delivery or pickup
// and cash on delivery, and a page that follows the order. Prices are the shop's live ones; the bag is only a list of
// products and amounts in the browser, priced by the server every time (cart.ts), so nobody can change a price.
import type { WebSection, WebShop, WebTheme } from '@hemlo/db/schema';
import type { ShopItem, ShopProductPage, ShopOrderView } from './shop-data';
import { W, pick, esc, attr, icon, fill, waHref, telHref, type Lang } from './theme';
import { initials, paras, field, pageHref, type Ctx, type Two } from './context';
import { estateCss } from './estate';
import { hwBadge } from './badge';

// ---------- words ----------
const S = {
  ar: {
    products: 'المنتجات', all: 'الكل', search: 'ابحث عن منتج', searchBtn: 'بحث', add: 'أضف إلى السلة', addShort: 'أضف', added: 'أُضيف إلى السلة', bag: 'السلة', bagEmpty: 'سلتك فارغة.',
    keep: 'تابع التسوق', checkout: 'إتمام الطلب', subtotal: 'المجموع', delivery: 'التوصيل', free: 'مجاناً', total: 'الإجمالي', out: 'نفد', low: 'كمية محدودة', isNew: 'جديد',
    qty: 'الكمية', remove: 'إزالة', menu: 'القائمة', home: 'الرئيسية', viewAll: 'عرض الكل', productsN: '{n} منتج', productsOne: 'منتج واحد', sort: 'الترتيب', sortNew: 'الأحدث',
    sortAsc: 'السعر: من الأقل', sortDesc: 'السعر: من الأعلى', none: 'لا توجد منتجات تطابق بحثك.', noneSub: 'جرّب كلمة أخرى، أو اسألنا على واتساب.', shopNow: 'تسوّق الآن',
    heroEyebrow: 'تسوّق أونلاين', cats: 'الأقسام', newest: 'وصل حديثاً', similar: 'قد يعجبك أيضاً', orderWa: 'اطلب عبر واتساب', waAsk: 'مرحباً، أريد أن أطلب {what}.',
    cod: 'الدفع عند الاستلام', codSub: 'ادفع نقداً حين يصلك طلبك', deliver: 'توصيل إلى بابك', deliverFee: 'التوصيل {fee}', freeOver: 'توصيل مجاني فوق {n}', waTitle: 'نجيبك على واتساب', waSub: 'اسأل عن أي منتج',
    yourName: 'الاسم', phone: 'رقم الهاتف (واتساب)', how: 'طريقة الاستلام', toDoor: 'توصيل', pickup: 'استلام من المتجر', city: 'المدينة', area: 'المنطقة', address: 'العنوان بالتفصيل',
    addressPh: 'الشارع، أقرب نقطة دالة', note: 'ملاحظة (اختياري)', place: 'أرسل الطلب', placing: 'يُرسل…', yourOrder: 'طلبك', details: 'معلوماتك', each: 'للقطعة',
    problems: { OUT_OF_STOCK: 'بعض المنتجات لم تعد متوفرة بالكمية المطلوبة.', BELOW_MINIMUM: 'أقل قيمة للطلب {n}.', NO_DELIVERY_THERE: 'لا نوصل إلى هذه المدينة حالياً.', SHOP_CLOSED: 'المتجر لا يستقبل طلبات الآن.',
      EMPTY_CART: 'سلتك فارغة.', BAD_PHONE: 'أدخل رقم هاتف عراقي صحيح.', BAD_NAME: 'أدخل اسمك.', BAD_ADDRESS: 'أدخل المدينة والعنوان.', BAD_CART: 'تعذّر قراءة السلة.', TOO_MANY: 'طلبات كثيرة. حاول بعد قليل.', generic: 'تعذّر إرسال الطلب. حاول مرة أخرى.' },
    thanks: 'شكراً {name}، وصلنا طلبك.', orderNo: 'طلب رقم {n}', updates: 'سنرسل لك كل تحديث على واتساب.', placed: 'وصل الطلب', confirmed: 'تم التأكيد', ready: 'جاهز للاستلام', out2: 'في الطريق إليك',
    delivered: 'تم التسليم', canceled: 'أُلغي الطلب', canceledSub: 'إن كان هناك خطأ، تواصل معنا.', contactUs: 'تواصل معنا', toAddress: 'التوصيل إلى', collect: 'الاستلام من المتجر', payOnDelivery: 'الدفع عند الاستلام',
    closing: 'كل ما تحتاجه، يصلك إلى الباب.', explore: 'تصفّح', contact: 'تواصل', help: 'تحتاج مساعدة؟', helpSub: 'اسألنا عن أي منتج، ونرد عليك بسرعة.', aboutEyebrow: 'عن المتجر', contactEyebrow: 'تواصل',
  },
  en: {
    products: 'Products', all: 'All', search: 'Search products', searchBtn: 'Search', add: 'Add to bag', addShort: 'Add', added: 'Added to your bag', bag: 'Bag', bagEmpty: 'Your bag is empty.',
    keep: 'Keep shopping', checkout: 'Checkout', subtotal: 'Subtotal', delivery: 'Delivery', free: 'Free', total: 'Total', out: 'Sold out', low: 'Few left', isNew: 'New',
    qty: 'Quantity', remove: 'Remove', menu: 'Menu', home: 'Home', viewAll: 'View all', productsN: '{n} products', productsOne: 'One product', sort: 'Sort', sortNew: 'Newest',
    sortAsc: 'Price: low to high', sortDesc: 'Price: high to low', none: 'No products match your search.', noneSub: 'Try another word, or ask us on WhatsApp.', shopNow: 'Shop now',
    heroEyebrow: 'Shop online', cats: 'Categories', newest: 'New in', similar: 'You may also like', orderWa: 'Order on WhatsApp', waAsk: 'Hello, I would like to order {what}.',
    cod: 'Cash on delivery', codSub: 'Pay when your order arrives', deliver: 'Delivered to your door', deliverFee: 'Delivery {fee}', freeOver: 'Free delivery over {n}', waTitle: 'We answer on WhatsApp', waSub: 'Ask about any product',
    yourName: 'Name', phone: 'Phone (WhatsApp)', how: 'How you get it', toDoor: 'Delivery', pickup: 'Pick up from the shop', city: 'City', area: 'Area', address: 'Full address',
    addressPh: 'Street, nearest landmark', note: 'Note (optional)', place: 'Place order', placing: 'Sending…', yourOrder: 'Your order', details: 'Your details', each: 'each',
    problems: { OUT_OF_STOCK: 'Some items are no longer available in that amount.', BELOW_MINIMUM: 'The smallest order is {n}.', NO_DELIVERY_THERE: 'We don’t deliver to that city yet.', SHOP_CLOSED: 'The shop isn’t taking orders right now.',
      EMPTY_CART: 'Your bag is empty.', BAD_PHONE: 'Enter a valid Iraqi phone number.', BAD_NAME: 'Enter your name.', BAD_ADDRESS: 'Enter your city and address.', BAD_CART: 'Your bag couldn’t be read.', TOO_MANY: 'Too many orders. Try again shortly.', generic: 'The order couldn’t be sent. Please try again.' },
    thanks: 'Thank you {name}, we got your order.', orderNo: 'Order number {n}', updates: 'We’ll send you every update on WhatsApp.', placed: 'Order received', confirmed: 'Confirmed', ready: 'Ready to collect', out2: 'On its way',
    delivered: 'Delivered', canceled: 'Order canceled', canceledSub: 'If this is a mistake, please contact us.', contactUs: 'Contact us', toAddress: 'Delivering to', collect: 'Pick up from the shop', payOnDelivery: 'Cash on delivery',
    closing: 'Everything you need, to your door.', explore: 'Explore', contact: 'Contact', help: 'Need help?', helpSub: 'Ask us about any product and we’ll answer quickly.', aboutEyebrow: 'About us', contactEyebrow: 'Contact',
  },
} as const;
type Words = (typeof S)['ar'] | (typeof S)['en'];

const P: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', menu: '<path d="M4 9h16M4 15h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', chev: '<path d="m9 6 6 6-6 6"/>',
  bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>', cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>', store: '<path d="M3 9 5 4h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>', x2: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
};
const ic = (n: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] ?? ''}</svg>`;
const w = (ctx: Ctx): Words => S[ctx.lang];
const money = (n: number, lang: Lang) => `<bdi class="num">${new Intl.NumberFormat('en-US').format(n)}</bdi> <small>${lang === 'ar' ? 'د.ع' : 'IQD'}</small>`;
const moneyText = (n: number, lang: Lang) => `${new Intl.NumberFormat('en-US').format(n)} ${lang === 'ar' ? 'د.ع' : 'IQD'}`;
const brandMark = (ctx: Ctx) => (ctx.logo ? `<img src="${attr(ctx.logo)}" alt="" width="32" height="32">` : `<span class="mono">${esc(initials(ctx.name))}</span>`);
const href = (ctx: Ctx, path: string) => `${ctx.basePath}/${path}${ctx.lang === (ctx.site.lang === 'en' ? 'en' : 'ar') ? '' : `${path.includes('?') ? '&' : '?'}lang=${ctx.lang}`}`;
const productHref = (ctx: Ctx, slug: string) => href(ctx, `products/${encodeURIComponent(slug)}`);
const waFor = (ctx: Ctx, text: string) => (ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, text) : null);
const shopRules = (ctx: Ctx): WebShop => ctx.site.settings?.shop ?? {};

// ---------- the product card ----------
export function shopCard(ctx: Ctx, p: ShopItem, i: number) {
  const t = w(ctx), out = p.stock === 'out';
  const item = JSON.stringify({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image, unit: p.unit });
  const badge = out ? `<span class="ebadge soft">${esc(t.out)}</span>` : p.stock === 'low' ? `<span class="ebadge warn">${esc(t.low)}</span>` : p.fresh ? `<span class="ebadge new">${esc(t.isNew)}</span>` : '';
  return `<article class="scard erv${out ? ' is-out' : ''}" style="--i:${i % 4}" data-cat="${attr(p.category ?? '')}">
<div class="scard-media">${p.image ? `<img src="${attr(p.image)}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async">` : `<span class="scard-ph">${ic('box')}</span>`}${badge ? `<div class="scard-tags">${badge}</div>` : ''}</div>
<div class="scard-body">${p.category ? `<small class="scard-cat">${esc(p.category)}</small>` : ''}<h3 class="scard-title"><a class="ecard-link" href="${attr(productHref(ctx, p.slug))}">${esc(p.name)}</a></h3>
<div class="scard-foot"><p class="scard-price">${money(p.price, ctx.lang)}</p><button class="sadd" type="button" data-add="${attr(item)}"${out ? ' disabled' : ''} aria-label="${attr(`${t.add}: ${p.name}`)}">${ic('plus')}</button></div></div></article>`;
}

// ---------- sections ----------
const cats = (ctx: Ctx) => [...new Set(ctx.products.map((p) => p.category).filter(Boolean) as string[])];
function chips(ctx: Ctx, current: string | undefined, onPage: boolean) {
  const t = w(ctx), list = cats(ctx);
  if (!list.length) return '';
  const link = (c: string | null) => (onPage ? href(ctx, `products${c ? `?c=${encodeURIComponent(c)}` : ''}`) : href(ctx, `products?c=${encodeURIComponent(c ?? '')}`));
  return `<nav class="schips" aria-label="${attr(t.cats)}"><a href="${attr(onPage ? href(ctx, 'products') : href(ctx, 'products'))}"${!current ? ' aria-current="page"' : ''}>${esc(t.all)}</a>${list.map((c) => `<a href="${attr(link(c))}"${current === c ? ' aria-current="page"' : ''}>${esc(c)}</a>`).join('')}</nav>`;
}
function trust(ctx: Ctx) {
  const t = w(ctx), s = shopRules(ctx);
  const del = s.delivery !== false ? `<li>${ic('truck')}<span><b>${esc(t.deliver)}</b><small>${s.freeOver ? esc(fill(t.freeOver, { n: moneyText(s.freeOver, ctx.lang) })) : s.fee ? esc(fill(t.deliverFee, { fee: moneyText(s.fee, ctx.lang) })) : ''}</small></span></li>` : '';
  return `<ul class="strust">${del}<li>${ic('cash')}<span><b>${esc(t.cod)}</b><small>${esc(t.codSub)}</small></span></li>${ctx.contact.whatsapp ? `<li>${ic('chat')}<span><b>${esc(t.waTitle)}</b><small>${esc(t.waSub)}</small></span></li>` : ''}</ul>`;
}
function hero(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), title = pick((sec as any).title as Two, ctx.lang) || ctx.name, text = field(sec, 'text', ctx.lang) || ctx.tagline;
  const pics = ctx.products.filter((p) => p.image).slice(0, 4);
  const wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' }));
  return `<section class="shero"><div class="ewrap shero-in"><div class="shero-b"><p class="eeyebrow">${esc(t.heroEyebrow)}</p><h1 class="display">${esc(title)}</h1>${text ? `<p class="lead">${esc(text)}</p>` : ''}
<div class="shero-cta"><a class="ebtn ebtn-accent ebtn-lg" href="${attr(href(ctx, 'products'))}">${esc(t.shopNow)}${ic('arrow', 'i dir')}</a>${wa ? `<a class="ebtn ebtn-outline ebtn-lg" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}</div></div>
<div class="shero-art n${pics.length}" aria-hidden="true">${pics.length ? pics.map((p, i) => `<a href="${attr(productHref(ctx, p.slug))}" tabindex="-1" style="--k:${i}"><img src="${attr(p.image!)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"><span>${esc(p.name)}<b>${money(p.price, ctx.lang)}</b></span></a>`).join('') : `<span class="shero-mono">${brandMark(ctx)}</span>`}</div></div>
<div class="ewrap">${trust(ctx)}</div></section>`;
}
function shelf(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), title = pick((sec as any).title as Two, ctx.lang) || t.newest;
  const list = ctx.products.slice(0, 12);
  if (!list.length) return '';
  return `<section class="esec"><div class="ewrap"><div class="ehead"><div><p class="eeyebrow">${esc(t.cats)}</p><h2 class="eh2">${esc(title)}</h2></div><a class="elink" href="${attr(href(ctx, 'products'))}">${esc(t.viewAll)}${ic('arrow', 'i dir')}</a></div>
${chips(ctx, undefined, false)}<div class="sgrid">${list.map((p, i) => shopCard(ctx, p, i)).join('')}</div></div></section>`;
}
function catalogue(ctx: Ctx) {
  const t = w(ctx), f = ctx.filters as any, n = ctx.products.length;
  const keep = ctx.lang !== (ctx.site.lang === 'en' ? 'en' : 'ar') ? `<input type="hidden" name="lang" value="${ctx.lang}">` : '';
  const sorts = ([['', t.sortNew], ['price-asc', t.sortAsc], ['price-desc', t.sortDesc]] as const).map(([k, l]) => `<option value="${k}"${(f.sort ?? '') === k ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const grid = n ? `<div class="sgrid">${ctx.products.map((p, i) => shopCard(ctx, p, i)).join('')}</div>`
    : `<div class="eempty">${ic('search', 'i lg')}<h2>${esc(t.none)}</h2><p>${esc(t.noneSub)}</p></div>`;
  return `<section class="epage"><div class="ewrap"><nav class="ecrumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(t.home)}</a>${ic('chev', 'i dir')}<span>${esc(t.products)}</span></nav>
<div class="epage-head"><h1 class="eh1">${esc(f.category || t.products)}</h1><span class="emuted num">${esc(n === 1 ? t.productsOne : fill(t.productsN, { n }))}</span></div>
<form class="sfind" method="get" action="${attr(ctx.basePath)}/products" role="search">${keep}${f.category ? `<input type="hidden" name="c" value="${attr(f.category)}">` : ''}<label class="sfind-q">${ic('search')}<input name="q" value="${attr(f.q ?? '')}" placeholder="${attr(t.search)}" maxlength="80" enterkeyhint="search"></label>
<label class="esort"><span>${esc(t.sort)}</span><select name="sort" data-autosubmit>${sorts}</select></label></form>${chips(ctx, f.category, true)}${grid}</div></section>`;
}
function about(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), title = pick((sec as any).title as Two, ctx.lang), text = field(sec, 'text', ctx.lang) || pick(ctx.site.about, ctx.lang);
  if (!text && !title) return '';
  const pic = ctx.products.find((p) => p.image)?.image;
  return `<section class="esec"><div class="ewrap eabout"><div class="erv"><p class="eeyebrow">${esc(t.aboutEyebrow)}</p><h2 class="eh2">${esc(title || ctx.name)}</h2>${text ? `<div class="eprose">${paras(text)}</div>` : ''}</div>${pic ? `<figure class="erv"><img src="${attr(pic)}" alt="" loading="lazy" decoding="async"></figure>` : ''}</div></section>`;
}
function contact(ctx: Ctx, sec: WebSection) {
  const t = w(ctx), c = ctx.contact, title = pick((sec as any).title as Two, ctx.lang) || t.help;
  const wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' })), tel = telHref(c.phone);
  const dl = [c.phone ? `<div><dt>${esc(ctx.t.call)}</dt><dd><bdi class="num">${esc(c.phone)}</bdi></dd></div>` : '', c.address ? `<div><dt>${esc(t.contact)}</dt><dd>${esc(c.address)}</dd></div>` : ''].join('');
  return `<section class="esec"><div class="ewrap"><div class="econtact erv"><p class="eeyebrow">${esc(t.contactEyebrow)}</p><h2 class="display">${esc(title)}</h2><p class="lead">${esc(t.helpSub)}</p>
<div class="acts">${wa ? `<a class="ebtn ebtn-wa ebtn-lg" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}${tel ? `<a class="ebtn ebtn-outline ebtn-lg" href="${attr(tel)}">${icon('call', 'i')}${ctx.t.call}</a>` : ''}</div>${dl ? `<dl>${dl}</dl>` : ''}</div></div></section>`;
}

// ---------- the bag's two pages: checkout, and the order afterwards ----------
function checkoutPage(ctx: Ctx) {
  const t = w(ctx), s = shopRules(ctx);
  const canDeliver = s.delivery !== false, canPickup = !!s.pickup;
  const how = canDeliver && canPickup ? `<p class="slabel">${esc(t.how)}</p><fieldset class="etabs shows"><label><input type="radio" name="delivery" value="delivery" checked><span>${ic('truck')}${esc(t.toDoor)}</span></label><label><input type="radio" name="delivery" value="pickup"><span>${ic('store')}${esc(t.pickup)}</span></label></fieldset>`
    : `<input type="hidden" name="delivery" value="${canDeliver ? 'delivery' : 'pickup'}">`;
  const cities = s.cities?.length ? `<select name="city" required>${s.cities.map((c) => `<option>${esc(c)}</option>`).join('')}</select>` : `<input name="city" maxlength="60" autocomplete="address-level2" required>`;
  const note = pick(s.note as Two, ctx.lang);
  return `<section class="epage"><div class="ewrap"><nav class="ecrumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(t.home)}</a>${ic('chev', 'i dir')}<span>${esc(t.checkout)}</span></nav>
<h1 class="eh1 sco-h">${esc(t.checkout)}</h1>
<form class="sco" data-checkout novalidate><div class="sco-form"><h2 class="sco-t">${esc(t.details)}</h2>
<label class="sfield"><span>${esc(t.yourName)}</span><input name="name" maxlength="80" autocomplete="name" required></label>
<label class="sfield"><span>${esc(t.phone)}</span><input name="phone" type="tel" inputmode="tel" dir="ltr" maxlength="20" autocomplete="tel" placeholder="07XX XXX XXXX" required></label>
${how}<div class="sco-addr" data-addr><div class="sco-2"><label class="sfield"><span>${esc(t.city)}</span>${cities}</label><label class="sfield"><span>${esc(t.area)}</span><input name="area" maxlength="80"></label></div>
<label class="sfield"><span>${esc(t.address)}</span><input name="address" maxlength="240" autocomplete="street-address" placeholder="${attr(t.addressPh)}"></label></div>
<label class="sfield"><span>${esc(t.note)}</span><textarea name="note" maxlength="400" rows="2"></textarea></label><input type="text" name="hp" tabindex="-1" autocomplete="off" class="shp" aria-hidden="true"></div>
<aside class="sco-sum"><h2 class="sco-t">${esc(t.yourOrder)}</h2><ul data-sum-lines class="slines sco-lines"></ul>
<dl class="sco-tot"><div><dt>${esc(t.subtotal)}</dt><dd data-sum="subtotal">—</dd></div><div><dt>${esc(t.delivery)}</dt><dd data-sum="fee">—</dd></div><div class="big"><dt>${esc(t.total)}</dt><dd data-sum="total">—</dd></div></dl>
<p class="sco-cod">${ic('cash')}<span><b>${esc(t.cod)}</b><small>${esc(t.codSub)}</small></span></p>${note ? `<p class="sco-note">${esc(note)}</p>` : ''}
<p class="sco-err" data-err role="alert" hidden></p><button class="ebtn ebtn-accent ebtn-lg eblock" type="submit" data-place>${esc(t.place)}</button></aside></form></div></section>`;
}
function orderPage(ctx: Ctx, o: ShopOrderView) {
  const t = w(ctx), lang = ctx.lang;
  const steps = o.status === 'canceled' ? [] : [['new', t.placed], ['confirmed', t.confirmed], [o.delivery === 'pickup' ? 'ready' : 'out', o.delivery === 'pickup' ? t.ready : t.out2], ['delivered', t.delivered]];
  const at = steps.findIndex(([k]) => k === o.status);
  const wa = waFor(ctx, fill(t.waAsk, { what: `#${o.number}` }));
  const line = (l: ShopOrderView['lines'][number]) => `<li><span class="sline-img">${l.image ? `<img src="${attr(l.image)}" alt="" loading="lazy">` : ic('box')}</span><span class="sline-t"><b>${esc(l.name)}</b><small><bdi class="num">${l.qty}</bdi> × ${money(l.price, lang)}</small></span><span class="sline-p">${money(l.total, lang)}</span></li>`;
  return `<section class="epage"><div class="ewrap sorder"><div class="sorder-h erv"><span class="sorder-ic${o.status === 'canceled' ? ' bad' : ''}">${ic(o.status === 'canceled' ? 'x2' : 'check')}</span>
<p class="eeyebrow">${esc(fill(t.orderNo, { n: o.number }))}</p><h1 class="eh1">${esc(o.status === 'canceled' ? t.canceled : fill(t.thanks, { name: o.name.split(/\s+/)[0] }))}</h1><p class="emuted">${esc(o.status === 'canceled' ? t.canceledSub : t.updates)}</p></div>
${steps.length ? `<ol class="ssteps">${steps.map(([k, label], i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i <= at ? ic('check') : ''}</i><span>${esc(label)}</span></li>`).join('')}</ol>` : ''}
<div class="sorder-g"><div class="sorder-box"><h2 class="sco-t">${esc(t.yourOrder)}</h2><ul class="slines">${o.lines.map(line).join('')}</ul>
<dl class="sco-tot"><div><dt>${esc(t.subtotal)}</dt><dd>${money(o.subtotal, lang)}</dd></div>${o.delivery === 'delivery' ? `<div><dt>${esc(t.delivery)}</dt><dd>${o.deliveryFee ? money(o.deliveryFee, lang) : esc(t.free)}</dd></div>` : ''}<div class="big"><dt>${esc(t.total)}</dt><dd>${money(o.total, lang)}</dd></div></dl></div>
<div class="sorder-box"><h2 class="sco-t">${esc(o.delivery === 'pickup' ? t.collect : t.toAddress)}</h2>${o.delivery === 'delivery' ? `<p class="sorder-addr">${ic('pin')}<span>${esc([o.city, o.area, o.address].filter(Boolean).join('، '))}</span></p>` : ctx.contact.address ? `<p class="sorder-addr">${ic('store')}<span>${esc(ctx.contact.address)}</span></p>` : ''}
<p class="sco-cod">${ic('cash')}<span><b>${esc(t.payOnDelivery)}</b><small>${money(o.total, lang)}</small></span></p>${wa ? `<a class="ebtn ebtn-wa ebtn-lg eblock" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${esc(t.contactUs)}</a>` : ''}</div></div></div></section>`;
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

// ---------- the header, the bag, the footer, the phone bar ----------
function navItems(ctx: Ctx) {
  const items = ctx.pages.slice(0, 5).map((p) => ({ slug: p.slug, label: pick(p.title, ctx.lang) || p.slug || ctx.t.hero }));
  if (!items.some((p) => p.slug === 'products')) items.splice(1, 0, { slug: 'products', label: w(ctx).products });
  return items;
}
function langSwitch(ctx: Ctx, altHref: string) {
  const other: Lang = ctx.lang === 'ar' ? 'en' : 'ar';
  return `<a class="elang" href="${attr(altHref)}" hreflang="${other}" lang="${other}" aria-label="${other === 'en' ? 'English' : 'العربية'}"><span${ctx.lang === 'en' ? ' class="on"' : ''}>EN</span><span${ctx.lang === 'ar' ? ' class="on"' : ''}>ع</span></a>`;
}
export function shopHeader(ctx: Ctx, current: string, altHref: string) {
  const t = w(ctx);
  const links = navItems(ctx).map((p) => `<a href="${attr(pageHref(ctx, p.slug))}"${p.slug === current ? ' aria-current="page"' : ''}>${esc(p.label)}</a>`).join('');
  return `<div id="etop" aria-hidden="true" data-shop-base="${attr(ctx.basePath)}"></div><header class="enav" data-enav><div class="enav-in">
<a class="ebrand" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a>
<nav class="elinks" aria-label="${attr(t.menu)}"><span class="epill" aria-hidden="true"></span>${links}</nav>
<div class="eacts">${langSwitch(ctx, altHref)}<a class="eicon" href="${attr(href(ctx, 'products'))}" aria-label="${attr(t.search)}">${ic('search')}</a>
<button class="eicon" type="button" data-open="sbag" aria-label="${attr(t.bag)}">${ic('bag')}<span class="ecount num" data-bag-count hidden>0</span></button>
<button class="eicon emenu" type="button" data-open="emenu" aria-label="${attr(t.menu)}">${ic('menu')}</button></div></div></header>`;
}
export function shopChrome(ctx: Ctx, altHref: string) {
  const t = w(ctx), wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' })), tel = telHref(ctx.contact.phone);
  const links = navItems(ctx).map((p) => `<a href="${attr(pageHref(ctx, p.slug))}">${esc(p.label)}${ic('chev', 'i dir')}</a>`).join('');
  return `<dialog id="sbag" class="esheet" aria-label="${attr(t.bag)}"><div class="esheet-h"><b>${esc(t.bag)}</b><button class="eicon" type="button" data-close aria-label="${attr(ctx.t.close)}">${ic('x')}</button></div>
<div class="esheet-b"><ul class="slines" data-bag-list></ul><p class="esheet-empty" data-bag-empty>${ic('bag', 'i lg')}<span>${esc(t.bagEmpty)}</span><a class="ebtn ebtn-outline" href="${attr(href(ctx, 'products'))}">${esc(t.keep)}</a></p></div>
<div class="sbag-f" data-bag-foot hidden><div class="sbag-sub"><span>${esc(t.subtotal)}</span><b data-bag-total></b></div><a class="ebtn ebtn-accent ebtn-lg eblock" href="${attr(href(ctx, 'checkout'))}">${esc(t.checkout)}${ic('arrow', 'i dir')}</a></div></dialog>
<dialog id="emenu" class="esheet" aria-label="${attr(t.menu)}"><div class="esheet-h"><a class="ebrand" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a><button class="eicon" type="button" data-close aria-label="${attr(ctx.t.close)}">${ic('x')}</button></div>
<div class="esheet-b"><nav class="emenu-links">${links}</nav><div class="emenu-foot">${langSwitch(ctx, altHref)}${wa ? `<a class="ebtn ebtn-wa ebtn-lg eblock" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}${tel ? `<a class="ebtn ebtn-outline ebtn-lg eblock" href="${attr(tel)}">${icon('call', 'i')}${ctx.t.call}</a>` : ''}</div></div></dialog>`;
}
export function shopFooter(ctx: Ctx) {
  const t = w(ctx), c = ctx.contact, wa = waFor(ctx, fill(ctx.t.waHello, { what: ctx.name, url: ctx.origin + '/' }));
  const links = navItems(ctx).map((p) => `<li><a href="${attr(pageHref(ctx, p.slug))}">${esc(p.label)}</a></li>`).join('');
  const contact = [c.phone ? `<li><a href="${attr(telHref(c.phone)!)}"><bdi class="num">${esc(c.phone)}</bdi></a></li>` : '', c.email ? `<li><a href="mailto:${attr(c.email)}">${esc(c.email)}</a></li>` : '', c.address ? `<li>${esc(c.address)}</li>` : ''].join('');
  return `<footer class="efoot"><div class="ewrap"><p class="efoot-line erv">${esc(t.closing)}</p><div class="efoot-top"><div class="efoot-brand"><a class="ebrand" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}</div>
<div><h4>${esc(t.explore)}</h4><ul>${links}</ul></div>${contact ? `<div><h4>${esc(t.contact)}</h4><ul>${contact}</ul></div>` : ''}
<div class="efoot-cta"><h4>${esc(t.help)}</h4><p>${esc(t.helpSub)}</p>${wa ? `<a class="ebtn ebtn-wa" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}</div></div>
<div class="efoot-bot"><span>© ${new Date().getFullYear()} ${esc(ctx.name)}</span>${hwBadge(ctx.lang, `https://hemlohq.com/${ctx.lang === 'en' ? 'en/' : ''}systems/#addons`)}</div></div></footer>`;
}
/** On a phone, the bag stays under the thumb (it shows its total once something is in it). */
export function shopBar(ctx: Ctx) {
  const t = w(ctx);
  if (ctx.pageSlug === 'checkout' || ctx.pageSlug === 'order') return '';
  return `<div class="ebar sbar" data-bar hidden><button class="ebtn ebtn-accent ebtn-lg" type="button" data-open="sbag">${ic('bag')}<span>${esc(t.bag)}</span><span class="sbar-n num" data-bag-count>0</span><b class="sbar-t" data-bag-total></b></button></div>`;
}

// ---------- the product page ----------
export function shopProduct(ctx: Ctx, p: ShopProductPage, similar: ShopItem[], canonical: string) {
  const t = w(ctx), lang = ctx.lang, out = p.stock === 'out';
  const item = JSON.stringify({ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image, unit: p.unit });
  const step = p.unit === 'piece' || p.unit === 'box' || p.unit === 'pack' ? 1 : 0.25;
  const wa = waFor(ctx, `${fill(t.waAsk, { what: p.name })}\n${canonical}`);
  const photos = p.photos.length ? p.photos : p.image ? [p.image] : [];
  const gal = photos.length ? `<div class="spdp-gal"><div class="spdp-main"><img src="${attr(photos[0])}" alt="${attr(p.name)}" fetchpriority="high" decoding="async" data-main></div>${photos.length > 1 ? `<div class="spdp-thumbs">${photos.map((u, i) => `<button type="button" data-thumb="${attr(u)}"${i ? '' : ' aria-current="true"'}><img src="${attr(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>`
    : `<div class="spdp-gal"><div class="spdp-main ph">${ic('box', 'i lg')}</div></div>`;
  const state = out ? `<span class="ebadge soft">${esc(t.out)}</span>` : p.stock === 'low' ? `<span class="ebadge warn">${esc(t.low)}</span>` : '';
  const buy = `<aside class="ebuy spdp-buy">${p.category ? `<a class="scard-cat" href="${attr(href(ctx, `products?c=${encodeURIComponent(p.category)}`))}">${esc(p.category)}</a>` : ''}<h1 class="eh1">${esc(p.name)}</h1>
<div class="ebuy-price"><span class="v">${money(p.price, lang)}</span>${state}</div>
${out ? '' : `<div class="sqty" data-qty data-step="${step}"><span>${esc(t.qty)}</span><div class="sqty-c"><button type="button" data-dec aria-label="−">${ic('minus')}</button><input value="1" inputmode="decimal" aria-label="${attr(t.qty)}" data-qty-in><button type="button" data-inc aria-label="+">${ic('plus')}</button></div></div>
<button class="ebtn ebtn-accent ebtn-lg eblock" type="button" data-add="${attr(item)}" data-with-qty>${ic('bag')}${esc(t.add)}</button>`}
${wa ? `<a class="ebtn ebtn-wa ebtn-lg eblock" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${esc(t.orderWa)}</a>` : ''}${trust(ctx)}</aside>`;
  const desc = p.description ? `<section class="eblock"><div class="eprose">${paras(p.description)}</div></section>` : '';
  const more = similar.length ? `<section class="esimilar"><div class="ehead"><div><h2 class="eh2">${esc(t.similar)}</h2></div><a class="elink" href="${attr(href(ctx, 'products'))}">${esc(t.viewAll)}${ic('arrow', 'i dir')}</a></div><div class="sgrid">${similar.map((x, i) => shopCard(ctx, x, i + 4)).join('')}</div></section>` : '';
  const main = `<main class="epdp"><div class="ewrap"><nav class="ecrumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(t.home)}</a>${ic('chev', 'i dir')}<a href="${attr(href(ctx, 'products'))}">${esc(t.products)}</a>${ic('chev', 'i dir')}<span>${esc(p.name)}</span></nav>
<div class="spdp">${gal}${buy}<div class="spdp-body">${desc}</div></div>${more}</div></main>`;
  const bar = out ? '' : `<div class="ebar pdp"><span class="ebar-p">${money(p.price, lang)}</span><button class="ebtn ebtn-accent ebtn-lg" type="button" data-add="${attr(item)}" data-with-qty>${ic('bag')}${esc(t.addShort)}</button></div>`;
  return { main, bar };
}

// ---------- behaviour: the bag, the checkout, the small things ----------
export const shopScript = (lang: Lang) => {
  const t = S[lang];
  const J = { added: t.added, remove: t.remove, free: t.free, problems: t.problems, placing: t.placing, place: t.place, cur: lang === 'ar' ? 'د.ع' : 'IQD', base: '', minus: ic('minus'), plus: ic('plus'), trash: ic('trash'), box: ic('box') };
  return `(function(){var J=${JSON.stringify(J).replace(/</g, '\\u003c')},d=document,sb=d.querySelector('[data-shop-base]');J.base=sb?sb.getAttribute('data-shop-base'):'';
var nav=d.querySelector('[data-enav]'),top=d.getElementById('etop');if(nav&&top&&'IntersectionObserver' in window)new IntersectionObserver(function(x){nav.classList.toggle('is-stuck',!x[0].isIntersecting)}).observe(top);
var links=d.querySelector('.elinks'),pill=links&&links.querySelector('.epill');if(pill){var cur=links.querySelector('[aria-current]');var place=function(a){if(!a){pill.style.opacity='0';return}pill.style.opacity='1';pill.style.width=a.offsetWidth+'px';pill.style.transform='translateX('+a.offsetLeft+'px)'};[].forEach.call(links.querySelectorAll('a'),function(a){a.addEventListener('pointerenter',function(){place(a)})});links.addEventListener('pointerleave',function(){place(cur)});requestAnimationFrame(function(){pill.style.transition='none';place(cur);requestAnimationFrame(function(){pill.style.transition=''})})}
var KEY='hemlo-bag:'+location.host+J.base;function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}}var bag=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(bag))}catch(_){}sync()}
function fmt(n){return new Intl.NumberFormat('en-US').format(Math.round(n))+' '+J.cur}
function r3(n){return Math.round(n*1000)/1000}
function total(){return bag.reduce(function(s,x){return s+x.price*x.qty},0)}
function count(){return bag.reduce(function(s,x){return s+(x.unit==='piece'||x.unit==='box'||x.unit==='pack'?x.qty:1)},0)}
function add(it,q){var f=bag.filter(function(x){return x.id===it.id})[0];if(f)f.qty=r3(f.qty+q);else bag.unshift({id:it.id,slug:it.slug,name:it.name,price:it.price,image:it.image,unit:it.unit,qty:q});bag=bag.slice(0,40);save()}
function setQty(id,q){bag=bag.map(function(x){if(x.id===id)x.qty=r3(q);return x}).filter(function(x){return x.qty>0});save()}
function stepOf(x){return x.unit==='piece'||x.unit==='box'||x.unit==='pack'?1:.25}
function el(tag,cls,txt){var e=d.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function lineEl(x,editable){var li=el('li');var im=el('span','sline-img');if(x.image){var i=el('img');i.src=x.image;i.alt='';im.append(i)}else im.innerHTML=J.box;var tt=el('span','sline-t');var a=el('a',null,x.name);a.href=J.base+'/products/'+encodeURIComponent(x.slug||'');var b=el('b');b.append(a);tt.append(b,el('small',null,fmt(x.price)));li.append(im,tt);
if(editable){var q=el('span','sqty-c sm');var m=el('button');m.type='button';m.innerHTML=x.qty<=stepOf(x)?J.trash:J.minus;m.setAttribute('aria-label',J.remove);m.onclick=function(){setQty(x.id,x.qty-stepOf(x))};var v=el('span','num',String(x.qty));var p=el('button');p.type='button';p.innerHTML=J.plus;p.setAttribute('aria-label','+');p.onclick=function(){setQty(x.id,x.qty+stepOf(x))};q.append(m,v,p);li.append(q)}
li.append(el('span','sline-p num',fmt(x.price*x.qty)));return li}
function sync(){[].forEach.call(d.querySelectorAll('[data-bag-count]'),function(c){c.textContent=String(count());if(c.classList.contains('ecount'))c.hidden=!bag.length});[].forEach.call(d.querySelectorAll('[data-bag-total]'),function(c){c.textContent=fmt(total())});
var bar=d.querySelector('[data-bar]');if(bar)bar.hidden=!bag.length;d.body.classList.toggle('has-bar',!!bag.length||!!d.querySelector('.ebar.pdp'));
var list=d.querySelector('[data-bag-list]');if(list){list.textContent='';bag.forEach(function(x){list.append(lineEl(x,true))});d.querySelector('[data-bag-empty]').hidden=!!bag.length;d.querySelector('[data-bag-foot]').hidden=!bag.length}
if(co)quote()}
function toast(m){var x=el('div','etoast',m);x.setAttribute('role','status');d.body.append(x);setTimeout(function(){x.classList.add('out');setTimeout(function(){x.remove()},400)},1600)}
var qty=d.querySelector('[data-qty]');if(qty){var st=+qty.getAttribute('data-step'),qi=qty.querySelector('[data-qty-in]');var val=function(){var n=parseFloat(String(qi.value).replace(',','.'));return n>0?n:st};qty.querySelector('[data-dec]').onclick=function(){qi.value=String(Math.max(st,r3(val()-st)))};qty.querySelector('[data-inc]').onclick=function(){qi.value=String(r3(val()+st))}}
d.addEventListener('click',function(ev){var t=ev.target;if(!(t instanceof Element))return;var b=t.closest('[data-add]');if(b&&!b.disabled){ev.preventDefault();var it=JSON.parse(b.getAttribute('data-add'));var q=b.hasAttribute('data-with-qty')&&qi?(parseFloat(String(qi.value).replace(',','.'))||1):1;add(it,q);b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');if(navigator.vibrate)navigator.vibrate(8);toast(J.added);return}
var o=t.closest('[data-open]');if(o){var dl=d.getElementById(o.getAttribute('data-open'));if(dl&&dl.showModal){dl.showModal();d.body.classList.add('e-lock')}return}
var c=t.closest('[data-close]');if(c){var p=c.closest('dialog');if(p)p.close();return}
var th=t.closest('[data-thumb]');if(th){var mi=d.querySelector('[data-main]');if(mi)mi.src=th.getAttribute('data-thumb');[].forEach.call(d.querySelectorAll('[data-thumb]'),function(x){x.removeAttribute('aria-current')});th.setAttribute('aria-current','true');return}
if(t.tagName==='DIALOG'&&t.classList.contains('esheet'))t.close()});
[].forEach.call(d.querySelectorAll('dialog.esheet'),function(x){x.addEventListener('close',function(){d.body.classList.remove('e-lock')})});
[].forEach.call(d.querySelectorAll('[data-autosubmit]'),function(s){s.addEventListener('change',function(){var f=s.form;if(f){if(f.requestSubmit)f.requestSubmit();else f.submit()}})});
var rv=d.querySelectorAll('.erv');if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -6% 0px'});[].forEach.call(rv,function(x){io.observe(x)})}else [].forEach.call(rv,function(x){x.classList.add('in')});
var co=d.querySelector('[data-checkout]'),qt=0,busy=false;
function f(n){return co.elements[n]}
function how(){var r=co.querySelector('[name=delivery]:checked')||f('delivery');return r?r.value:'delivery'}
function err(code,extra){var e=co.querySelector('[data-err]');if(!code){e.hidden=true;return}var m=J.problems[code]||J.problems.generic;e.textContent=extra?m.replace('{n}',extra):m;e.hidden=false}
function quote(){if(!co)return;var lines=bag.map(function(x){return{id:x.id,qty:x.qty}});var sum=co.querySelector('[data-sum-lines]');if(!lines.length){sum.textContent='';err('EMPTY_CART');co.querySelector('[data-place]').disabled=true;return}
var n=++qt;fetch(J.base+'/cart/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lines:lines,city:f('city')?f('city').value:'',delivery:how()})}).then(function(r){return r.json()}).then(function(q){if(n!==qt)return;sum.textContent='';
q.lines.forEach(function(l){var x={id:l.id,slug:l.slug,name:l.name,price:l.price,image:l.image,unit:l.unit,qty:l.qty};var li=lineEl(x,false);if(l.short)li.classList.add('short');sum.append(li)});
bag=bag.filter(function(x){return q.lines.some(function(l){return l.id===x.id})}).map(function(x){var l=q.lines.filter(function(y){return y.id===x.id})[0];x.price=l.price;x.name=l.name;return x});try{localStorage.setItem(KEY,JSON.stringify(bag))}catch(_){}
co.querySelector('[data-sum=subtotal]').textContent=fmt(q.subtotal);co.querySelector('[data-sum=fee]').textContent=q.delivery==='pickup'?'—':q.fee?fmt(q.fee):J.free;co.querySelector('[data-sum=total]').textContent=fmt(q.total);
err(q.problem,q.minOrder?fmt(q.minOrder):null);co.querySelector('[data-place]').disabled=!q.ok||busy}).catch(function(){})}
if(co){var addr=co.querySelector('[data-addr]');var sw=function(){addr.hidden=how()==='pickup';quote()};[].forEach.call(co.querySelectorAll('[name=delivery]'),function(r){r.addEventListener('change',sw)});if(f('city'))f('city').addEventListener('change',quote);sw();
co.addEventListener('submit',function(ev){ev.preventDefault();if(busy)return;var btn=co.querySelector('[data-place]');busy=true;btn.disabled=true;btn.textContent=J.placing;err(null);
fetch(J.base+'/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lines:bag.map(function(x){return{id:x.id,qty:x.qty}}),name:f('name').value,phone:f('phone').value,delivery:how(),city:f('city')?f('city').value:'',area:f('area')?f('area').value:'',address:f('address')?f('address').value:'',note:f('note').value,hp:f('hp').value,lang:d.documentElement.lang})})
.then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok&&x.j.code){bag=[];try{localStorage.setItem(KEY,'[]')}catch(_){}location.href=J.base+'/order/'+x.j.code+(location.search.indexOf('lang=')>-1?location.search:'');return}busy=false;btn.textContent=J.place;btn.disabled=false;err(x.j.error||'generic');if(x.j.error==='OUT_OF_STOCK')quote()})
.catch(function(){busy=false;btn.textContent=J.place;btn.disabled=false;err('generic')})})}
sync()})();`;
};

// ---------- the look: the estate foundation, and the shop's own parts ----------
export function shopCss(theme: WebTheme, fontBase: string) {
  return `${estateCss(theme, fontBase)}
/* the shop's hero: the name and a line beside a small still life of its products */
.shero{padding:28px 0 8px}.shero-in{display:grid;gap:28px;align-items:center}@media (min-width:960px){.shero-in{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;min-height:min(620px,74svh)}}
.shero h1{margin:14px 0 0;font-size:clamp(2.6rem,6.2vw,5.4rem);text-wrap:balance;animation:erise 1s var(--e) both .1s}html[lang=ar] .shero h1{font-size:clamp(2.2rem,5vw,4.2rem)}
.shero .lead{max-width:520px;margin:18px 0 0;font-size:clamp(15.5px,1.5vw,18px);color:var(--ink2);animation:erise 1s var(--e) both .2s}
.shero-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px;animation:erise 1s var(--e) both .28s}
.shero-art{position:relative;display:grid;gap:12px;grid-template-columns:1fr 1fr;animation:erise 1.1s var(--e) both .2s}
.shero-art a{position:relative;overflow:hidden;border-radius:24px;background:var(--surface);aspect-ratio:1;box-shadow:var(--sh)}
.shero-art.n1 a{grid-column:span 2;aspect-ratio:4/3}.shero-art.n3 a:first-child{grid-row:span 2;aspect-ratio:auto}.shero-art.n4 a:nth-child(2){transform:translateY(28px)}.shero-art.n4 a:nth-child(4){transform:translateY(28px)}
.shero-art img{width:100%;height:100%;object-fit:cover;transition:transform 1s var(--e)}
.shero-art span{position:absolute;inset-inline:10px;bottom:10px;display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border-radius:14px;background:color-mix(in oklab,var(--bg) 82%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-size:12.5px;font-weight:500;color:var(--ink)}
.shero-art span b{flex:none;font-weight:600}.shero-art span b small{font-size:.8em;color:var(--muted)}
@media (hover:hover) and (pointer:fine){.shero-art a:hover img{transform:scale(1.05)}}
.shero-mono{display:grid;place-items:center;grid-column:span 2;aspect-ratio:4/3;border-radius:28px;background:radial-gradient(110% 120% at 0% 0%,color-mix(in oklab,var(--primary) 30%,var(--surface)),var(--surface) 70%)}.shero-mono .mono,.shero-mono img{display:grid;place-items:center;width:112px;height:112px;border-radius:30px;background:var(--ink);color:var(--bg);font-size:40px;font-weight:600;object-fit:cover;box-shadow:var(--sh-lg)}
@media (max-width:959px){.shero-art{max-width:520px}.shero-art.n4 a:nth-child(2),.shero-art.n4 a:nth-child(4){transform:none}}
.strust{display:grid;gap:10px;margin:36px 0 0;padding:0;list-style:none}@media (min-width:760px){.strust{grid-template-columns:repeat(3,minmax(0,1fr))}}
.strust li{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;background:var(--surface)}.strust .i{width:22px;height:22px;color:var(--primary)}.strust span{display:grid;line-height:1.35}.strust b{font-size:14px;font-weight:600}.strust small{font-size:12.5px;color:var(--muted)}
.ebuy .strust{grid-template-columns:1fr;margin:6px 0 0}.ebuy .strust li{padding:10px 12px}
/* categories as chips */
.schips{display:flex;gap:8px;margin:0 0 22px;overflow-x:auto;scrollbar-width:none;padding:2px}.schips::-webkit-scrollbar{display:none}
.schips a{flex:none;display:inline-flex;align-items:center;height:38px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);font-size:14px;font-weight:500;color:var(--ink2);transition:background-color .2s,color .2s,border-color .2s}
.schips a:hover{border-color:var(--line2);color:var(--ink)}.schips a[aria-current]{background:var(--ink);border-color:var(--ink);color:var(--bg)}
/* product cards */
.sgrid{display:grid;gap:18px 14px;grid-template-columns:repeat(auto-fill,minmax(min(46%,220px),1fr))}@media (min-width:900px){.sgrid{gap:26px 20px}}
.scard{position:relative;display:flex;flex-direction:column;min-width:0}
.scard-media{position:relative;aspect-ratio:1;overflow:hidden;border-radius:18px;background:var(--surface)}.scard-media img{width:100%;height:100%;object-fit:cover;transition:transform 1s var(--e)}
.scard-ph{display:grid;place-items:center;height:100%;color:var(--muted)}.scard-ph .i{width:34px;height:34px}
.scard-tags{position:absolute;top:10px;inset-inline-start:10px;display:flex;gap:6px;pointer-events:none}
.scard.is-out .scard-media img{filter:grayscale(.6);opacity:.7}
@media (hover:hover) and (pointer:fine){.scard:hover .scard-media img{transform:scale(1.05)}}
.scard-body{display:grid;gap:2px;padding:12px 2px 0}
.scard-cat{font-size:12px;font-weight:500;color:var(--muted)}a.scard-cat:hover{color:var(--ink)}
.scard-title{margin:0;font-size:14.5px;font-weight:500;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.scard-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px}
.scard-price{margin:0;font-size:16.5px;font-weight:600;letter-spacing:-.01em}.scard-price small,.ebuy-price small,.ebar-p small,.slines small small,.sco-tot small,.shero-art small{font-size:.72em;font-weight:500;color:var(--muted)}
.sadd{position:relative;z-index:2;display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:999px;background:var(--ink);color:var(--bg);transition:transform .16s var(--e),opacity .2s,background-color .2s}
.sadd:hover{background:var(--primary)}.sadd:active{transform:scale(.88)}.sadd:disabled{opacity:.3;cursor:not-allowed}.sadd .i{width:18px;height:18px}
.pop{animation:spop .45s var(--e)}@keyframes spop{40%{transform:scale(1.18)}}
/* the catalogue's search */
.sfind{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px}
.sfind-q{flex:1;min-width:220px;display:flex;align-items:center;gap:10px;height:46px;padding:0 16px;border-radius:14px;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh-sm)}.sfind-q:focus-within{border-color:var(--ink)}
.sfind-q .i{color:var(--muted)}.sfind-q input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:15px;color:var(--ink);outline:none}
/* the product page */
.spdp{display:grid;gap:26px;margin-top:16px}@media (min-width:960px){.spdp{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);grid-template-areas:"gal buy" "body buy";gap:0 44px;align-items:start}.spdp-gal{grid-area:gal}.spdp-buy{grid-area:buy}.spdp-body{grid-area:body;margin-top:24px}}
.spdp-main{aspect-ratio:1;overflow:hidden;border-radius:24px;background:var(--surface)}.spdp-main img{width:100%;height:100%;object-fit:cover}.spdp-main.ph{display:grid;place-items:center;color:var(--muted)}
@media (max-width:640px){.spdp-main{margin-inline:-16px;border-radius:0}}
.spdp-thumbs{display:flex;gap:8px;margin-top:10px}.spdp-thumbs button{width:76px;aspect-ratio:1;overflow:hidden;border-radius:12px;opacity:.6;box-shadow:0 0 0 2px transparent;transition:opacity .2s,box-shadow .2s}.spdp-thumbs button[aria-current]{opacity:1;box-shadow:0 0 0 2px var(--primary)}.spdp-thumbs img{width:100%;height:100%;object-fit:cover}
.spdp-buy .eh1{font-size:clamp(26px,2.6vw,34px)}
.sqty{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;font-weight:500;color:var(--ink2)}
.sqty-c{display:inline-flex;align-items:center;gap:2px;padding:4px;border-radius:14px;background:var(--surface)}.sqty-c button{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;color:var(--ink);transition:background-color .2s,transform .16s var(--e)}
.sqty-c button:hover{background:var(--card)}.sqty-c button:active{transform:scale(.9)}.sqty-c input,.sqty-c>span{width:52px;text-align:center;border:0;background:transparent;font:inherit;font-size:16px;font-weight:600;color:var(--ink);outline:none}
.sqty-c.sm{padding:2px;border-radius:11px}.sqty-c.sm button{width:30px;height:30px;border-radius:8px}.sqty-c.sm .i{width:15px;height:15px}.sqty-c.sm>span{width:34px;font-size:14px}
/* the bag and the order's lines */
.slines{display:grid;margin:0;padding:0;list-style:none}
.slines li{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.slines li.short{opacity:.55}
.sline-img{display:grid;place-items:center;flex:none;width:60px;height:60px;overflow:hidden;border-radius:12px;background:var(--surface);color:var(--muted)}.sline-img img{width:100%;height:100%;object-fit:cover}
.sline-t{display:grid;flex:1;min-width:0;line-height:1.4}.sline-t b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sline-t small{font-size:12.5px;color:var(--muted)}
.sline-p{flex:none;font-size:14px;font-weight:600}
.sbag-f{display:grid;gap:12px;padding:16px 20px calc(18px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--card)}
.sbag-sub{display:flex;justify-content:space-between;align-items:baseline;font-size:15px}.sbag-sub b{font-size:20px;font-weight:600}
.sbar>.ebtn{justify-content:flex-start}.sbar-n{display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:rgba(255,255,255,.22);font-size:12px}.sbar-t{margin-inline-start:auto;font-weight:600}
/* checkout */
.sco-h{margin:14px 0 24px}
.sco{display:grid;gap:22px}@media (min-width:960px){.sco{grid-template-columns:minmax(0,1fr) 400px;gap:40px;align-items:start}}
.sco-form{display:grid;gap:14px}.sco-t{margin:0 0 4px;font-size:18px;font-weight:600;letter-spacing:-.01em}html[lang=ar] .sco-t{letter-spacing:0}
.sco-2{display:grid;gap:14px}@media (min-width:560px){.sco-2{grid-template-columns:1fr 1fr}}.sco-addr{display:grid;gap:14px}
.sfield{display:grid;gap:6px}.sfield>span,.slabel{font-size:13px;font-weight:500;color:var(--ink2)}
.sfield input,.sfield select,.sfield textarea{width:100%;height:48px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:15.5px;color:var(--ink);outline:none;transition:border-color .2s,box-shadow .2s}
.sfield textarea{height:auto;padding:12px 14px;resize:vertical}.sfield :is(input,select,textarea):focus{border-color:var(--ink);box-shadow:0 0 0 3px color-mix(in oklab,var(--ink) 10%,transparent)}
.slabel{margin:0 0 -6px}.etabs.shows{display:grid;grid-template-columns:1fr 1fr;padding:4px}.etabs.shows span{display:flex;align-items:center;justify-content:center;gap:8px;height:46px}.etabs.shows .i{width:18px;height:18px}
.shp{position:absolute;inset-inline-start:-9999px;width:1px;height:1px;opacity:0}
.sco-sum{display:grid;gap:12px;padding:22px;border-radius:22px;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh)}@media (min-width:960px){.sco-sum{position:sticky;top:90px}}
.sco-lines{max-height:340px;overflow:auto}.sco-lines li:last-child{border-bottom:0}
.sco-tot{display:grid;gap:8px;margin:0;padding-top:12px;border-top:1px solid var(--line)}.sco-tot>div{display:flex;justify-content:space-between;align-items:baseline;font-size:14.5px;color:var(--ink2)}.sco-tot dd{margin:0;font-weight:500;color:var(--ink)}
.sco-tot .big{padding-top:10px;border-top:1px solid var(--line);font-size:16px;color:var(--ink)}.sco-tot .big dd{font-size:22px;font-weight:600}
.sco-cod{display:flex;align-items:center;gap:12px;margin:0;padding:12px 14px;border-radius:14px;background:var(--surface)}.sco-cod .i{width:22px;height:22px;color:var(--primary)}.sco-cod span{display:grid;line-height:1.35}.sco-cod b{font-size:14px}.sco-cod small{font-size:12.5px;color:var(--muted)}
.sco-note{margin:0;font-size:13px;color:var(--muted)}.sco-err{margin:0;padding:10px 12px;border-radius:12px;background:#FEF2F2;color:#B91C1C;font-size:14px}
/* the order, afterwards */
.sorder{max-width:900px}.sorder-h{display:grid;justify-items:center;gap:8px;padding:12px 0 8px;text-align:center}
.sorder-ic{display:grid;place-items:center;width:64px;height:64px;margin-bottom:6px;border-radius:999px;background:color-mix(in oklab,var(--primary) 14%,var(--bg));color:var(--primary)}.sorder-ic .i{width:30px;height:30px;stroke-width:2.2}.sorder-ic.bad{background:#FEF2F2;color:#B91C1C}
.ssteps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:28px 0;padding:0;list-style:none;counter-reset:s}
.ssteps li{position:relative;display:grid;justify-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--muted);text-align:center}
.ssteps li::before{content:"";position:absolute;top:15px;inset-inline-start:calc(-50% + 18px);inset-inline-end:calc(50% + 18px);height:2px;border-radius:2px;background:var(--line)}.ssteps li:first-child::before{display:none}
.ssteps li.done::before,.ssteps li.now::before{background:var(--primary)}
.ssteps i{display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:var(--surface);border:2px solid var(--line)}.ssteps i .i{width:16px;height:16px;stroke-width:2.4}
.ssteps .done i,.ssteps .now i{background:var(--primary);border-color:var(--primary);color:#fff}.ssteps .now{color:var(--ink)}.ssteps .now i{box-shadow:0 0 0 6px color-mix(in oklab,var(--primary) 18%,transparent)}
.sorder-g{display:grid;gap:16px}@media (min-width:860px){.sorder-g{grid-template-columns:1.3fr 1fr;align-items:start}}
.sorder-box{display:grid;gap:12px;padding:22px;border-radius:22px;border:1px solid var(--line);background:var(--card)}
.sorder-addr{display:flex;gap:10px;margin:0;font-size:14.5px;color:var(--ink2)}.sorder-addr .i{flex:none;margin-top:3px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.shero h1,.shero .lead,.shero-cta,.shero-art{animation:none!important}.pop{animation:none}}`;
}
