// The demo shop as it opens: Nafha (نفحة), a small perfume and care house, photographed for real (data/photos.ts).
// Prices are written in Iraqi dinars and moved to the market's currency when the demo opens for Jordan (?market=jo).
// Bump SEED_VERSION (data/version.ts) whenever this file changes shape, so every visitor gets the new shop.
import { convert } from '../lib/money';
import type { Category, Currency, Doc, Order, OrderStatus, Product, T } from '../lib/types';
import { SEED_VERSION } from './version';

export type Market = 'iq' | 'jo';

const t = (ar: string, en: string): T => ({ ar, en });
const ph = (key: string) => `photo:${key}`;

const CATS: [string, T, T, string][] = [
  ['perfumes', t('العطور', 'Perfumes'), t('عطور بتركيز عالٍ، تُمزج وتُعبّأ يدوياً، وتبقى معك يومك كله.', 'Rich concentrations, blended and bottled by hand, made to stay with you all day.'), ph('cat-perfumes')],
  ['oud', t('العود والبخور', 'Oud & Bakhoor'), t('دهن العود المعتّق والبخور لبيتك ولمناسباتك.', 'Aged oud oils and bakhoor for your home and your occasions.'), ph('cat-oud')],
  ['gifts', t('الهدايا', 'Gifts'), t('هدايا جاهزة، تُغلّف باليد وتصل مع بطاقة باسمك.', 'Ready gifts, wrapped by hand and delivered with a card in your name.'), ph('cat-gifts')],
  ['care', t('العناية بالجسم', 'Body Care'), t('كريمات وزيوت ولوشن بروائح نفحة، لبشرة تحتفظ بالعطر أطول.', 'Creams, oils and lotions in Nafha’s scents, so skin holds perfume longer.'), ph('cat-care')],
];

type P = [cat: string, slug: string, name: T, short: T, notes: [T, T, T], price: number, was: number | null, size: string, pics: string[], stock: number, featured?: boolean, notePics?: string[]];
const PRODUCTS: P[] = [
  ['perfumes', 'nafha-noir', t('نفحة نوار', 'Nafha Noir'), t('زعفران وورد دمشقي وعود معتّق. عطر الليالي الطويلة.', 'Saffron, damask rose and aged oud. The scent of long nights.'), [t('زعفران', 'Saffron'), t('ورد دمشقي', 'Damask rose'), t('عود وعنبر', 'Oud & amber')], 85000, null, '100 ml', [ph('noir'), ph('shadow')], 24, true, [ph('note-saffron'), ph('note-rose'), ph('note-oud')]],
  ['perfumes', 'amber-dusk', t('غسق العنبر', 'Amber Dusk'), t('عنبر دافئ وفانيلا وخشب الصندل، كضوء آخر النهار.', 'Warm amber, vanilla and sandalwood, like the last light of the day.'), [t('برغموت', 'Bergamot'), t('فانيلا', 'Vanilla'), t('صندل', 'Sandalwood')], 72000, 85000, '100 ml', [ph('amber')], 31, true],
  ['perfumes', 'white-musk', t('مسك أبيض', 'White Musk'), t('نظيف وناعم وقريب من البشرة. يناسب كل يوم.', 'Clean, soft and close to the skin. For every day.'), [t('ليمون', 'Lemon'), t('زهر القطن', 'Cotton flower'), t('مسك أبيض', 'White musk')], 55000, null, '100 ml', [ph('musk'), ph('musk-flat')], 48, true],
  ['perfumes', 'rose-taifi', t('ورد طائفي', 'Rose Taifi'), t('ورد طائف حقيقي بلمسة مسك، صافٍ كالزجاج.', 'True Taif rose with a touch of musk, clear as glass.'), [t('ليتشي', 'Lychee'), t('ورد طائفي', 'Taif rose'), t('مسك', 'Musk')], 68000, null, '75 ml', [ph('rose')], 17],
  ['perfumes', 'saffron-silk', t('حرير الزعفران', 'Saffron Silk'), t('زعفران وجلد ناعم. فخامة هادئة لا تحتاج أن ترفع صوتها.', 'Saffron and soft leather. Quiet luxury that never raises its voice.'), [t('زعفران', 'Saffron'), t('ياسمين', 'Jasmine'), t('جلد', 'Leather')], 92000, null, '100 ml', [ph('saffron')], 9, true],
  ['perfumes', 'cedar-rain', t('مطر الأرز', 'Cedar Rain'), t('أرز وفيتيفر بعد المطر، في هواء الصباح.', 'Cedar and vetiver after the rain, in the morning air.'), [t('جريب فروت', 'Grapefruit'), t('أرز', 'Cedar'), t('فيتيفر', 'Vetiver')], 64000, null, '100 ml', [ph('cedar')], 22],
  ['perfumes', 'iris-glass', t('زجاج السوسن', 'Iris Glass'), t('سوسن بودري ومسك بارد، شفاف كالزجاج.', 'Powdery iris and cool musk, as clear as glass.'), [t('كمثرى', 'Pear'), t('سوسن', 'Iris'), t('مسك', 'Musk')], 78000, null, '100 ml', [ph('iris')], 14, true],
  ['perfumes', 'red-ember', t('جمرة حمراء', 'Red Ember'), t('فلفل وردي وأخشاب مدخّنة تتوهّج بدفء.', 'Pink pepper and smoked woods, glowing warm.'), [t('فلفل وردي', 'Pink pepper'), t('قرفة', 'Cinnamon'), t('أخشاب مدخّنة', 'Smoked woods')], 88000, null, '50 ml', [ph('ember')], 11],
  ['oud', 'cambodian-oud', t('دهن عود كمبودي', 'Cambodian Oud Oil'), t('دهن عود معتّق بعمق العسل. قطرة واحدة تكفي.', 'Aged oud oil with the depth of honey. One drop is enough.'), [t('عود', 'Oud'), t('عسل', 'Honey'), t('أخشاب', 'Woods')], 145000, null, '12 ml', [ph('oud-oil')], 6, true],
  ['oud', 'royal-bakhoor', t('بخور ملكي', 'Royal Bakhoor'), t('بخور بالعود والورد يملأ البيت ويستقبل الضيوف.', 'Oud and rose bakhoor that fills the house and greets your guests.'), [t('عود', 'Oud'), t('ورد', 'Rose'), t('عنبر', 'Amber')], 38000, null, '50 g', [ph('bakhoor')], 40],
  ['oud', 'attar-al-layl', t('عطر الليل', 'Attar Al Layl'), t('عطر زيتي مركّز بلا كحول، يدوم على البشرة حتى الصباح.', 'An alcohol-free perfume oil that lasts on the skin until morning.'), [t('ورد', 'Rose'), t('عود', 'Oud'), t('مسك', 'Musk')], 48000, null, '6 ml', [ph('attar')], 20],
  ['oud', 'reserve-oud', t('دهن العود المعتّق', 'Reserve Oud Oil'), t('أندر ما لدينا: عود عُتّق عشر سنوات.', 'Our rarest: oud aged for ten years.'), [t('عود', 'Oud'), t('جلد', 'Leather'), t('عسل', 'Honey')], 260000, null, '30 ml', [ph('reserve')], 3],
  ['care', 'oud-body-cream', t('كريم الجسم بالعود', 'Oud Body Cream'), t('ترطيب عميق برائحة نفحة نوار، يثبّت العطر على بشرتك.', 'Deep moisture in Nafha Noir’s scent that helps perfume hold on your skin.'), [t('زبدة الشيا', 'Shea butter'), t('عود', 'Oud'), t('فيتامين E', 'Vitamin E')], 32000, null, '200 ml', [ph('cream')], 35],
  ['care', 'musk-hand-cream', t('كريم اليدين بالمسك', 'Musk Hand Cream'), t('خفيف وسريع الامتصاص، برائحة المسك الأبيض.', 'Light and quick to absorb, in White Musk.'), [t('مسك', 'Musk'), t('ألوفيرا', 'Aloe'), t('جلسرين', 'Glycerin')], 18000, null, '75 ml', [ph('hand-cream'), ph('hand-cream-2')], 64],
  ['care', 'rose-body-lotion', t('لوشن الجسم بالورد', 'Rose Body Lotion'), t('لوشن خفيف بماء الورد، يترك البشرة ناعمة ومعطّرة.', 'A light rose-water lotion that leaves skin soft and scented.'), [t('ماء الورد', 'Rose water'), t('زبدة الشيا', 'Shea'), t('مسك', 'Musk')], 26000, null, '250 ml', [ph('lotion')], 28],
  ['care', 'golden-body-oil', t('زيت الجسم الذهبي', 'Golden Body Oil'), t('زيت جاف بلمعة ناعمة ودفء العنبر.', 'A dry oil with a soft shimmer and the warmth of amber.'), [t('أرغان', 'Argan'), t('عنبر', 'Amber'), t('لمعة ذهبية', 'Gold shimmer')], 42000, null, '100 ml', [ph('body-oil')], 19, true],
  ['gifts', 'discovery-set', t('مجموعة اكتشاف نفحة', 'Nafha Discovery Set'), t('خمسة عطور بحجم السفر في علبة هدية. أفضل طريقة للبداية.', 'Five travel-size perfumes in a gift box. The best way to begin.'), [t('٥ × ١٠ مل', '5 × 10 ml'), t('علبة هدية', 'Gift box'), t('بطاقة إهداء', 'Gift card')], 75000, 95000, '5 × 10 ml', [ph('discovery')], 15, true],
  ['gifts', 'signature-gift-box', t('صندوق نفحة للهدايا', 'The Signature Gift Box'), t('نفحة نوار وكريم الجسم بالعود، مغلّفان باليد مع بطاقة.', 'Nafha Noir and the Oud Body Cream, hand-wrapped with a card.'), [t('نفحة نوار', 'Nafha Noir'), t('كريم بالعود', 'Oud cream'), t('تغليف يدوي', 'Hand-wrapped')], 110000, 117000, '2 pieces', [ph('gift-box')], 12],
];

const MARKET = {
  iq: { currency: 'IQD' as Currency, phone: '+964 770 123 4567', city: t('بغداد', 'Baghdad'), cities: [t('بغداد، الكرادة', 'Baghdad, Karrada'), t('أربيل', 'Erbil'), t('البصرة', 'Basra'), t('بغداد، المنصور', 'Baghdad, Mansour')], tel: (i: number) => `+96477012345${i}0` },
  jo: { currency: 'JOD' as Currency, phone: '+962 79 123 4567', city: t('عمّان', 'Amman'), cities: [t('عمّان، عبدون', 'Amman, Abdoun'), t('إربد', 'Irbid'), t('الزرقاء', 'Zarqa'), t('عمّان، جبل عمّان', 'Amman, Jabal Amman')], tel: (i: number) => `+96279123450${i}` },
};

export function seed(market: Market = 'iq', now = Date.now()): Doc {
  const m = MARKET[market], cur = m.currency, price = (iqd: number) => convert(iqd, 'IQD', cur);
  const categories: Category[] = CATS.map(([slug, name, blurb, pic], i) => ({ id: `c-${slug}`, slug, name, blurb, pic, order: i }));
  const products: Product[] = PRODUCTS.map(([cat, slug, name, short, notes, p, was, size, pics, stock, featured, notePics], i) => ({
    id: `p-${slug}`, slug, categoryId: `c-${cat}`, name, short,
    body: t(`${short.ar} يُمزج ويُعبّأ يدوياً في مشغل نفحة، ويصلك في علبة جاهزة للإهداء.`, `${short.en} Blended and bottled by hand in the Nafha atelier, and boxed ready to give.`),
    notes, ...(notePics ? { notePics } : {}), price: price(p), compareAt: was ? price(was) : null, stock, sku: `LY-${String(101 + i)}`, pics, size,
    featured: !!featured, active: true, createdAt: now - (PRODUCTS.length - i) * 86400000,
  }));
  const byId = new Map(products.map((p) => [p.id, p]));
  const sample: [string, string, [string, number][], OrderStatus, number][] = [
    ['نور الهدى', 'Noor Alhuda', [['p-nafha-noir', 1], ['p-musk-hand-cream', 2]], 'new', 0.4],
    ['أحمد كريم', 'Ahmed Kareem', [['p-cambodian-oud', 1]], 'preparing', 5],
    ['سارة محمود', 'Sara Mahmoud', [['p-discovery-set', 1], ['p-rose-body-lotion', 1]], 'shipped', 26],
    ['يوسف علي', 'Yousif Ali', [['p-amber-dusk', 2]], 'delivered', 74],
  ];
  const flow: OrderStatus[] = ['new', 'preparing', 'shipped', 'delivered'];
  const fee = price(5000), freeOver = price(100000);
  const orders: Order[] = sample.map(([ar, en, items, status, hoursAgo], i) => {
    const createdAt = now - hoursAgo * 3600000;
    const lines = items.map(([id, qty]) => { const p = byId.get(id)!; return { productId: id, name: p.name, price: p.price, qty, pic: p.pics[0] }; });
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0), delivery = subtotal >= freeOver ? 0 : fee;
    return {
      id: `o-${1001 + i}`, no: 1001 + i, createdAt, status,
      customer: { name: market === 'jo' || i % 2 ? en : ar, phone: m.tel(i), city: m.cities[i].en, address: '', note: '' },
      lines, subtotal, discount: 0, code: null, delivery, total: subtotal + delivery, pay: i === 1 ? ('card' as const) : ('cod' as const),
      history: flow.slice(0, flow.indexOf(status) + 1).map((s, j) => ({ status: s, at: createdAt + j * 3 * 3600000 })),
    };
  }).reverse();

  return {
    v: SEED_VERSION, rev: 1, nextOrderNo: 1001 + sample.length,
    settings: {
      name: t('نفحة', 'Nafha'), tagline: t('عطور تُروى ليلاً', 'Perfume for the night'),
      currency: cur, phone: m.phone, whatsapp: m.phone, email: 'hello@nafha.example', city: m.city,
      delivery: { fee, freeOver },
      theme: { accent: '#8A6642', ink: '#1D1B18', paper: '#F6F3EE', radius: 18 },
      announcement: { ...t(`توصيل مجاني للطلبات فوق ${market === 'jo' ? '٧٠ دينار' : '١٠٠ ألف دينار'} · تغليف هدايا باليد`, `Free delivery over ${market === 'jo' ? '70 JOD' : '100,000 IQD'} · Gifts wrapped by hand`), on: true },
      instagram: 'nafha.example',
    },
    categories, products,
    banners: [
      { id: 'b-ritual', title: t('اللمسة الأخيرة.', 'The last touch.'), sub: t('العطر آخر ما تضعه، وأول ما يتذكّرونه.', 'Perfume is the last thing you put on, and the first thing they remember.'), cta: t('اكتشف نفحة نوار', 'Discover Nafha Noir'), href: '/p/nafha-noir', pic: ph('ritual'), picTall: ph('ritual-tall'), tone: 'dark', active: true },
      { id: 'b-atelier', title: t('قطرة بعد قطرة.', 'Drop by drop.'), sub: t('كل عطر من نفحة يُمزج ويُعبّأ يدوياً في مشغلنا.', 'Every Nafha perfume is blended and bottled by hand in our atelier.'), cta: t('تسوّق العطور', 'Shop perfumes'), href: '/c/perfumes', pic: ph('atelier'), tone: 'dark', active: true },
    ],
    discounts: [
      { id: 'd-welcome', code: 'WELCOME10', kind: 'percent', value: 10, minTotal: price(50000), active: true, uses: 12 },
      { id: 'd-eid', code: 'EID', kind: 'fixed', value: price(10000), minTotal: price(80000), active: false, uses: 0 },
    ],
    orders,
  };
}
