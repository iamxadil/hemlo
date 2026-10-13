// The public sample of Hemlo Website for a shop (business.hemlohq.com/s/sample-shop): Nafha, a small perfume house (the
// same catalogue as the Studio demo store), rendered by the very renderer and design a shop gets. Nothing is read from or
// written to the database: the bag is priced from this list, and an order placed here shows a sample order page.
import type { WebShop } from '@hemlo/db/schema';
import type { WebsiteListingFilter } from './adapters';
import type { ShopItem, ShopOrderView, ShopProductPage } from './shop-data';
import type { Lang } from './theme';

export const SAMPLE_SHOP_SUB = 'sample-shop';
export const SAMPLE_ORDER = 'sampleorder';
type T = { ar: string; en: string };
const t = (ar: string, en: string): T => ({ ar, en });

const CATS: Record<string, T> = { perfumes: t('العطور', 'Perfumes'), oud: t('العود والبخور', 'Oud & Bakhoor'), gifts: t('الهدايا', 'Gifts'), care: t('العناية بالجسم', 'Body Care') };
type P = [cat: string, slug: string, name: T, short: T, notes: [T, T, T], price: number, was: number | null, size: string, pics: string[], stock: number, days: number];
const PRODUCTS: P[] = [
  ['perfumes', 'nafha-noir', t('نفحة نوار', 'Nafha Noir'), t('زعفران وورد دمشقي وعود معتّق. عطر الليالي الطويلة.', 'Saffron, damask rose and aged oud. The scent of long nights.'), [t('زعفران', 'Saffron'), t('ورد دمشقي', 'Damask rose'), t('عود وعنبر', 'Oud & amber')], 85000, null, '100 ml', ['noir', 'shadow', 'note-saffron', 'note-rose'], 24, 2],
  ['perfumes', 'amber-dusk', t('غسق العنبر', 'Amber Dusk'), t('عنبر دافئ وفانيلا وخشب الصندل، كضوء آخر النهار.', 'Warm amber, vanilla and sandalwood, like the last light of the day.'), [t('برغموت', 'Bergamot'), t('فانيلا', 'Vanilla'), t('صندل', 'Sandalwood')], 72000, 85000, '100 ml', ['amber', 'ember'], 31, 3],
  ['perfumes', 'white-musk', t('مسك أبيض', 'White Musk'), t('نظيف وناعم وقريب من البشرة. يناسب كل يوم.', 'Clean, soft and close to the skin. For every day.'), [t('ليمون', 'Lemon'), t('زهر القطن', 'Cotton flower'), t('مسك أبيض', 'White musk')], 55000, null, '100 ml', ['musk', 'musk-flat'], 48, 5],
  ['perfumes', 'saffron-silk', t('حرير الزعفران', 'Saffron Silk'), t('زعفران وجلد ناعم. فخامة هادئة لا تحتاج أن ترفع صوتها.', 'Saffron and soft leather. Quiet luxury that never raises its voice.'), [t('زعفران', 'Saffron'), t('ياسمين', 'Jasmine'), t('جلد', 'Leather')], 92000, null, '100 ml', ['saffron', 'note-saffron'], 9, 6],
  ['perfumes', 'iris-glass', t('زجاج السوسن', 'Iris Glass'), t('سوسن بودري ومسك بارد، شفاف كالزجاج.', 'Powdery iris and cool musk, as clear as glass.'), [t('كمثرى', 'Pear'), t('سوسن', 'Iris'), t('مسك', 'Musk')], 78000, null, '100 ml', ['iris'], 14, 8],
  ['perfumes', 'rose-taifi', t('ورد طائفي', 'Rose Taifi'), t('ورد طائف حقيقي بلمسة مسك، صافٍ كالزجاج.', 'True Taif rose with a touch of musk, clear as glass.'), [t('ليتشي', 'Lychee'), t('ورد طائفي', 'Taif rose'), t('مسك', 'Musk')], 68000, null, '75 ml', ['rose', 'note-rose'], 4, 10],
  ['perfumes', 'cedar-rain', t('مطر الأرز', 'Cedar Rain'), t('أرز وفيتيفر بعد المطر، في هواء الصباح.', 'Cedar and vetiver after the rain, in the morning air.'), [t('جريب فروت', 'Grapefruit'), t('أرز', 'Cedar'), t('فيتيفر', 'Vetiver')], 64000, null, '100 ml', ['cedar'], 22, 18],
  ['perfumes', 'red-ember', t('جمرة حمراء', 'Red Ember'), t('فلفل وردي وأخشاب مدخّنة تتوهّج بدفء.', 'Pink pepper and smoked woods, glowing warm.'), [t('فلفل وردي', 'Pink pepper'), t('قرفة', 'Cinnamon'), t('أخشاب مدخّنة', 'Smoked woods')], 88000, null, '50 ml', ['ember', 'amber'], 0, 21],
  ['oud', 'cambodian-oud', t('دهن عود كمبودي', 'Cambodian Oud Oil'), t('دهن عود معتّق بعمق العسل. قطرة واحدة تكفي.', 'Aged oud oil with the depth of honey. One drop is enough.'), [t('عود', 'Oud'), t('عسل', 'Honey'), t('أخشاب', 'Woods')], 145000, null, '12 ml', ['oud-oil', 'note-oud'], 6, 4],
  ['oud', 'royal-bakhoor', t('بخور ملكي', 'Royal Bakhoor'), t('بخور بالعود والورد يملأ البيت ويستقبل الضيوف.', 'Oud and rose bakhoor that fills the house and greets your guests.'), [t('عود', 'Oud'), t('ورد', 'Rose'), t('عنبر', 'Amber')], 38000, null, '50 g', ['bakhoor'], 40, 12],
  ['oud', 'attar-al-layl', t('عطر الليل', 'Attar Al Layl'), t('عطر زيتي مركّز بلا كحول، يدوم على البشرة حتى الصباح.', 'An alcohol-free perfume oil that lasts on the skin until morning.'), [t('ورد', 'Rose'), t('عود', 'Oud'), t('مسك', 'Musk')], 48000, null, '6 ml', ['attar'], 20, 15],
  ['oud', 'reserve-oud', t('دهن العود المعتّق', 'Reserve Oud Oil'), t('أندر ما لدينا: عود عُتّق عشر سنوات.', 'Our rarest: oud aged for ten years.'), [t('عود', 'Oud'), t('جلد', 'Leather'), t('عسل', 'Honey')], 260000, null, '30 ml', ['reserve'], 3, 30],
  ['gifts', 'discovery-set', t('مجموعة اكتشاف نفحة', 'Nafha Discovery Set'), t('خمسة عطور بحجم السفر في علبة هدية. أفضل طريقة للبداية.', 'Five travel-size perfumes in a gift box. The best way to begin.'), [t('٥ × ١٠ مل', '5 × 10 ml'), t('علبة هدية', 'Gift box'), t('بطاقة إهداء', 'Gift card')], 75000, 95000, '5 × 10 ml', ['discovery', 'gift-box'], 15, 1],
  ['gifts', 'signature-gift-box', t('صندوق نفحة للهدايا', 'The Signature Gift Box'), t('نفحة نوار وكريم الجسم بالعود، مغلّفان باليد مع بطاقة.', 'Nafha Noir and the Oud Body Cream, hand-wrapped with a card.'), [t('نفحة نوار', 'Nafha Noir'), t('كريم بالعود', 'Oud cream'), t('تغليف يدوي', 'Hand-wrapped')], 110000, 117000, '2 pieces', ['gift-box', 'care-ritual'], 12, 9],
  ['care', 'golden-body-oil', t('زيت الجسم الذهبي', 'Golden Body Oil'), t('زيت جاف بلمعة ناعمة ودفء العنبر.', 'A dry oil with a soft shimmer and the warmth of amber.'), [t('أرغان', 'Argan'), t('عنبر', 'Amber'), t('لمعة ذهبية', 'Gold shimmer')], 42000, null, '100 ml', ['body-oil'], 19, 7],
  ['care', 'oud-body-cream', t('كريم الجسم بالعود', 'Oud Body Cream'), t('ترطيب عميق برائحة نفحة نوار، يثبّت العطر على بشرتك.', 'Deep moisture in Nafha Noir’s scent that helps perfume hold on your skin.'), [t('زبدة الشيا', 'Shea butter'), t('عود', 'Oud'), t('فيتامين E', 'Vitamin E')], 32000, null, '200 ml', ['cream', 'care-ritual'], 35, 11],
  ['care', 'musk-hand-cream', t('كريم اليدين بالمسك', 'Musk Hand Cream'), t('خفيف وسريع الامتصاص، برائحة المسك الأبيض.', 'Light and quick to absorb, in White Musk.'), [t('مسك', 'Musk'), t('ألوفيرا', 'Aloe'), t('جلسرين', 'Glycerin')], 18000, null, '75 ml', ['hand-cream', 'hand-cream-2'], 64, 13],
  ['care', 'rose-body-lotion', t('لوشن الجسم بالورد', 'Rose Body Lotion'), t('لوشن خفيف بماء الورد، يترك البشرة ناعمة ومعطّرة.', 'A light rose-water lotion that leaves skin soft and scented.'), [t('ماء الورد', 'Rose water'), t('زبدة الشيا', 'Shea'), t('مسك', 'Musk')], 26000, null, '250 ml', ['lotion'], 28, 16],
];
const SHOP: WebShop = { delivery: true, pickup: true, fee: 5000, freeOver: 100000, minOrder: 10000, cities: ['بغداد', 'أربيل', 'البصرة'], note: { ar: 'نوصّل خلال يوم داخل بغداد، ويومين لبقية المدن.', en: 'We deliver within a day in Baghdad, two days elsewhere.' } };

const pic = (at: string, key: string, size = 960) => `${at.replace(/\/$/, '')}/demo/shop/${key}-${size}.webp`;

/** The site as the database would hold it, published. Arabic first; English is ?lang=en, as on any site. */
export const sampleShopSite = (lang: Lang, photosAt: string) => {
  const cfg = {
    lang: 'ar' as Lang, name: t('نفحة', 'Nafha'),
    tagline: t('عطور تُمزج باليد في بغداد، وتصلك مغلّفة كهدية.', 'Perfumes blended by hand in Baghdad, delivered wrapped like a gift.'),
    about: t('بدأت نفحة في مشغل صغير في الكرادة عام 2012. نمزج كل عطر ونعبّئه بأيدينا، ونختار العود والزعفران بأنفسنا، ونغلّف كل طلب كأنه هدية.\n\nحين تطلب من موقعنا، يصلك الطلب خلال يوم في بغداد، وتدفع عند الاستلام.',
      'Nafha began in a small atelier in Karrada in 2012. We blend and bottle every perfume by hand, choose our oud and saffron ourselves, and wrap every order like a gift.\n\nOrder on our site and it reaches you within a day in Baghdad, and you pay when it arrives.'),
    theme: { accent: '#8A6642' },
    settings: { contact: { phone: '+9647701234567', whatsapp: '+9647701234567', email: 'hello@nafha.example', address: lang === 'ar' ? 'الكرادة، شارع 62، بغداد' : 'Karrada, 62nd Street, Baghdad' }, cta: { whatsapp: true, phone: true },
      shop: { ...SHOP, cities: lang === 'ar' ? SHOP.cities : ['Baghdad', 'Erbil', 'Basra'] } },
    logoId: null, faviconId: null,
    pages: [
      { id: 'n-home', slug: '', kind: 'home', sort: 0, title: t('الرئيسية', 'Home'), seo: {}, sections: [
        { id: 'h', type: 'hero', title: t('عطرٌ يُروى ليلاً.', 'Perfume for the night.') },
        { id: 'p', type: 'products', title: t('وصل حديثاً', 'New in') },
        { id: 'a', type: 'about', title: t('قطرة بعد قطرة.', 'Drop by drop.'), image: pic(photosAt, 'atelier', 1400) },
        { id: 'c', type: 'contact' }] },
      { id: 'n-about', slug: 'about', kind: 'about', sort: 1, title: t('قصتنا', 'Our story'), seo: {}, sections: [{ id: 'a2', type: 'about', title: t('قطرة بعد قطرة.', 'Drop by drop.'), image: pic(photosAt, 'atelier', 1400) }, { id: 'c2', type: 'contact' }] },
      { id: 'n-contact', slug: 'contact', kind: 'contact', sort: 2, title: t('تواصل معنا', 'Contact'), seo: {}, sections: [{ id: 'c3', type: 'contact' }] },
    ],
  };
  return { id: 'sample-shop', organizationId: 'sample-shop', vertical: 'store', status: 'published', subdomain: SAMPLE_SHOP_SUB, ...cfg, publishedSnapshot: cfg };
};

const rows = (lang: Lang, at: string) => PRODUCTS.map(([cat, slug, name, short, notes, price, was, size, pics, stock, days]): ShopProductPage => ({
  id: `n-${slug}`, slug, name: name[lang], category: CATS[cat][lang], price, was, size, unit: 'piece', stock: stock <= 0 ? 'out' : stock <= 6 ? 'low' : 'in', fresh: days < 7,
  image: pic(at, pics[0]), image2: pics[1] ? pic(at, pics[1]) : null, photos: pics.map((k) => pic(at, k)), notes: notes.map((n) => n[lang]),
  description: lang === 'ar' ? `${short.ar}\n\nيُمزج ويُعبّأ يدوياً في مشغل نفحة، ويصلك في علبة جاهزة للإهداء.` : `${short.en}\n\nBlended and bottled by hand in the Nafha atelier, and boxed ready to give.`,
}));
const strip = ({ description: _d, photos: _p, notes: _n, ...item }: ShopProductPage): ShopItem => item;

/** The same search, category and order the real shop applies, over the sample's products (newest first). */
export function sampleShopItems(lang: Lang, at: string, f: WebsiteListingFilter = {}): ShopItem[] {
  const q = f.q?.toLowerCase();
  let out = rows(lang, at).filter((p) => (!f.category || p.category === f.category) && (!q || p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)));
  if (f.sort === 'price-asc') out = out.sort((a, b) => a.price - b.price); else if (f.sort === 'price-desc') out = out.sort((a, b) => b.price - a.price);
  else out = out.sort((a, b) => PRODUCTS.findIndex((x) => `n-${x[1]}` === a.id) - PRODUCTS.findIndex((x) => `n-${x[1]}` === b.id));
  return out.slice(0, f.limit ?? 240).map(strip);
}
export const sampleShopProduct = (lang: Lang, at: string, slug: string) => rows(lang, at).find((p) => p.slug === slug) ?? null;

/** The bag priced from the sample's list, in the shape the real quote has (cart.ts). */
export function sampleShopQuote(lang: Lang, at: string, cart: { id: string; qty: number }[], opts: { city?: string | null; delivery?: string | null }) {
  const all = rows(lang, at), s = SHOP;
  const delivery = opts.delivery === 'pickup' ? 'pickup' as const : 'delivery' as const;
  const lines = cart.map((x) => { const p = all.find((y) => y.id === x.id); if (!p) return null; const qty = Math.max(1, Math.round(x.qty));
    return { id: p.id, slug: p.slug, name: p.name, price: p.price, qty, total: qty * p.price, image: p.image, unit: p.unit, short: p.stock === 'out' }; }).filter(Boolean) as any[];
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  const fee = delivery === 'delivery' && subtotal < s.freeOver! ? s.fee! : 0;
  const problem = !lines.length ? 'EMPTY_CART' : lines.some((l) => l.short) ? 'OUT_OF_STOCK' : subtotal < s.minOrder! ? 'BELOW_MINIMUM' : null;
  return { lines, subtotal, fee, total: subtotal + fee, minOrder: s.minOrder, freeOver: s.freeOver, delivery, canDeliver: true, canPickup: true, ok: !problem, problem };
}

/** What an order placed on the sample looks like afterwards (nothing was stored, so it is always this one). */
export function sampleShopOrder(lang: Lang, at: string): ShopOrderView {
  const all = rows(lang, at), noir = all[0], cream = all.find((p) => p.slug === 'musk-hand-cream')!;
  const lines = [{ name: noir.name, qty: 1, price: noir.price, total: noir.price, image: noir.image }, { name: cream.name, qty: 2, price: cream.price, total: cream.price * 2, image: cream.image }];
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  return { number: 1024, code: SAMPLE_ORDER, status: 'confirmed', name: lang === 'ar' ? 'نور الهدى' : 'Noor', delivery: 'delivery', city: lang === 'ar' ? 'بغداد' : 'Baghdad',
    area: lang === 'ar' ? 'الكرادة' : 'Karrada', address: lang === 'ar' ? 'شارع 62، قرب جامع براثا' : '62nd Street, near Buratha mosque', subtotal, deliveryFee: 0, total: subtotal, createdAt: new Date(), lines };
}
