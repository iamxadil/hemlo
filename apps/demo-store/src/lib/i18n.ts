// The visitor's language (Arabic or English), the page direction that follows it, and the shop's own words.
// The control panel's words live with the panel (admin/strings.ts), so shoppers never download them.
import { computed, effect, signal } from '@preact/signals';
import type { Lang, T } from './types';

const KEY = 'hemlo-demo-lang';
const first = (): Lang => {
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'ar' || asked === 'en') return asked;
  try { const v = localStorage.getItem(KEY); if (v === 'ar' || v === 'en') return v; } catch { /* blocked storage */ }
  return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
};
export const lang = signal<Lang>(first());
effect(() => {
  const l = lang.value, el = document.documentElement;
  el.lang = l; el.dir = l === 'ar' ? 'rtl' : 'ltr';
  try { localStorage.setItem(KEY, l); } catch { /* blocked storage */ }
});

/** The owner's text in the visitor's language, falling back to the other language when one side is empty. */
export const tx = (t: T | undefined) => (t ? t[lang.value] || t[lang.value === 'ar' ? 'en' : 'ar'] : '');
/** Fills {name} placeholders. */
export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

const STRINGS = {
  ar: {
    shop: 'المتجر', all: 'كل المنتجات', search: 'ابحث عن عطر…', searchNone: 'لا نتائج لـ «{q}»', emptyList: 'لا منتجات هنا بعد.', cart: 'السلة', menu: 'القائمة', close: 'إغلاق',
    add: 'أضف إلى السلة', added: 'أُضيف إلى السلة', addedShort: 'تمت الإضافة', viewBag: 'عرض السلة', soldOut: 'نفدت الكمية', left: 'بقي {n} فقط', notes: 'مكوّنات العطر', top: 'البداية', heart: 'القلب', base: 'القاعدة',
    featured: 'الأكثر طلباً', shopBy: 'تسوّق حسب القسم', viewAll: 'عرض الكل', new: 'جديد', sale: 'تخفيض', products: '{n} منتجات',
    cartEmpty: 'سلتك فارغة.', keepShopping: 'تابع التسوق', subtotal: 'المجموع', discount: 'الخصم', delivery: 'التوصيل', free: 'مجاني', total: 'الإجمالي',
    toFree: 'أضف {v} للتوصيل المجاني', freeYes: 'التوصيل مجاني لطلبك', checkout: 'إتمام الطلب', code: 'كود الخصم', apply: 'تطبيق', remove: 'إزالة',
    codeErr: { unknown: 'هذا الكود غير موجود', inactive: 'هذا الكود متوقف حالياً', min: 'الكود يحتاج طلباً بقيمة {v} على الأقل' },
    you: 'معلوماتك', name: 'الاسم', phone: 'رقم الهاتف', city: 'المدينة والمنطقة', address: 'العنوان بالتفصيل', note: 'ملاحظة (اختياري)',
    pay: 'طريقة الدفع', cod: 'الدفع عند الاستلام', card: 'بطاقة', wallet: 'محفظة إلكترونية', place: 'تأكيد الطلب', placing: 'نؤكّد طلبك…',
    stockErr: 'تغيّرت الكمية المتوفرة لأحد المنتجات. راجع سلتك.', required: 'مطلوب', phoneErr: 'رقم غير صحيح',
    thanks: 'شكراً، وصلنا طلبك', orderNo: 'طلب رقم {n}', track: 'حالة الطلب', whatsapp: 'تابع طلبك على واتساب',
    status: { new: 'استلمنا الطلب', preparing: 'نجهّزه', shipped: 'مع المندوب', delivered: 'وصل', canceled: 'أُلغي' },
    notFound: 'هذه الصفحة غير موجودة.', home: 'الرئيسية', qty: 'الكمية',
    demo: 'متجر تجريبي من هيملو ستوديو', demoOpen: 'افتح لوحة التحكم', demoHow: 'كيف يعمل متجرك؟',
    footer: { help: 'المساعدة', about: 'عن المتجر', follow: 'تابعنا', rights: 'جميع الحقوق محفوظة.', built: 'صُمم وبُني بواسطة هيملو ستوديو', credits: 'صور حقيقية من Unsplash · الشكر للمصوّرين' },
    learnMore: 'اعرف المزيد', buy: 'اشترِ', shopAll: 'تسوّق الكل', worlds: 'عوالم نفحة', worldsSub: 'من العطر إلى البخور إلى العناية بعد الاستحمام.', mostLoved: 'الأكثر حبّاً', mostLovedSub: 'ما يعود إليه زبائننا مرة بعد مرة.',
    story: 'ثلاث نوتات. ليلة واحدة.', storySub: 'كيف يتغيّر عطر نفحة نوار على بشرتك، من أول رشّة حتى الصباح.', noteDesc: ['النفَس الأول: مشرق وجريء، يملأ اللحظة.', 'القلب، بعد ساعة: دافئ وقريب.', 'ما يبقى على بشرتك حتى الصباح.'], noteTimes: ['أول ١٥ دقيقة', 'بعد ساعة', 'حتى الصباح'],
    atelier: 'المشغل', atelierTitle: 'قطرة بعد قطرة.', atelierText: 'نمزج كل عطر في دفعات صغيرة، ونتركه يرتاح أسابيع قبل أن نعبّئه باليد. لهذا يدوم أطول، ولهذا لا يتشابه عطران من نفحة.',
    care: 'الطقوس', careTitle: 'العطر يدوم أطول على بشرة مرطّبة.', careText: 'كريماتنا وزيوتنا تحمل روائح نفحة نفسها، لتثبّت العطر وتمنحه عمقاً.',
    promise: [['truck', 'توصيل لكل المحافظات', 'خلال ٢-٣ أيام، ومجاناً فوق الحد'], ['shield', 'الدفع عند الاستلام', 'افحص طلبك ثم ادفع'], ['gift', 'تغليف هدايا باليد', 'مع بطاقة باسمك'], ['drop', 'عيّنة مع كل طلب', 'جرّب عطراً جديداً']] as [string, string, string][],
    description: 'الوصف', deliveryReturns: 'التوصيل والاستبدال', deliveryText: 'نوصل لكل المحافظات خلال ٢-٣ أيام. يمكنك استبدال أي منتج غير مفتوح خلال ١٤ يوماً.', howToWear: 'طريقة الاستخدام', wearText: 'رشّ على نقاط النبض: المعصم وخلف الأذن وأسفل الرقبة، ولا تفرك. للثبات الأطول ضع الكريم أولاً.', notesTitle: 'النوتات', youMayLike: 'قد يعجبك أيضاً', in: 'في {c}',
    photography: 'التصوير', credits: 'كل الصور في هذا المتجر التجريبي صور حقيقية من Unsplash، بعدسة:', tryPanel: 'جرّب لوحة التحكم', scroll: 'مرّر', pause: 'إيقاف', play: 'تشغيل', slide: 'الشريحة {n}',
    results: 'نتائج', quick: 'روابط سريعة', seeAll: 'كل النتائج لـ «{q}»',
  },
  en: {
    shop: 'Shop', all: 'All products', search: 'Search for a scent…', searchNone: 'Nothing found for “{q}”', emptyList: 'No products here yet.', cart: 'Bag', menu: 'Menu', close: 'Close',
    add: 'Add to bag', added: 'Added to your bag', addedShort: 'Added', viewBag: 'View bag', soldOut: 'Sold out', left: 'Only {n} left', notes: 'Scent notes', top: 'Top', heart: 'Heart', base: 'Base',
    featured: 'Most loved', shopBy: 'Shop by category', viewAll: 'View all', new: 'New', sale: 'Sale', products: '{n} products',
    cartEmpty: 'Your bag is empty.', keepShopping: 'Keep shopping', subtotal: 'Subtotal', discount: 'Discount', delivery: 'Delivery', free: 'Free', total: 'Total',
    toFree: 'Add {v} for free delivery', freeYes: 'Your delivery is free', checkout: 'Checkout', code: 'Discount code', apply: 'Apply', remove: 'Remove',
    codeErr: { unknown: 'That code doesn’t exist', inactive: 'That code is paused right now', min: 'This code needs an order of at least {v}' },
    you: 'Your details', name: 'Name', phone: 'Phone number', city: 'City and area', address: 'Full address', note: 'Note (optional)',
    pay: 'Payment', cod: 'Cash on delivery', card: 'Card', wallet: 'E-wallet', place: 'Place order', placing: 'Placing your order…',
    stockErr: 'Stock changed for one of the products. Please check your bag.', required: 'Required', phoneErr: 'Check the number',
    thanks: 'Thank you, we have your order', orderNo: 'Order {n}', track: 'Order status', whatsapp: 'Follow your order on WhatsApp',
    status: { new: 'Received', preparing: 'Preparing', shipped: 'On its way', delivered: 'Delivered', canceled: 'Canceled' },
    notFound: 'This page doesn’t exist.', home: 'Home', qty: 'Quantity',
    demo: 'A demo store by Hemlo Studio', demoOpen: 'Open the control panel', demoHow: 'How does your store work?',
    footer: { help: 'Help', about: 'About', follow: 'Follow us', rights: 'All rights reserved.', built: 'Designed and built by Hemlo Studio', credits: 'Real photographs from Unsplash · thanks to the photographers' },
    learnMore: 'Learn more', buy: 'Buy', shopAll: 'Shop all', worlds: 'The worlds of Nafha', worldsSub: 'From perfume to bakhoor to what comes after the shower.', mostLoved: 'Most loved', mostLovedSub: 'What our customers come back for, again and again.',
    story: 'Three notes. One night.', storySub: 'How Nafha Noir changes on your skin, from the first spray until morning.', noteDesc: ['The first breath: bright and bold, filling the moment.', 'The heart, an hour in: warm and close.', 'What stays on your skin until morning.'], noteTimes: ['First 15 minutes', 'After an hour', 'Until morning'],
    atelier: 'The atelier', atelierTitle: 'Drop by drop.', atelierText: 'We blend every perfume in small batches and let it rest for weeks before bottling it by hand. That is why it lasts, and why no two Nafha perfumes are alike.',
    care: 'The ritual', careTitle: 'Perfume lasts longer on cared-for skin.', careText: 'Our creams and oils carry the same Nafha scents, to anchor your perfume and give it depth.',
    promise: [['truck', 'Delivery everywhere', 'In 2–3 days, free over the threshold'], ['shield', 'Cash on delivery', 'Check your order, then pay'], ['gift', 'Gifts wrapped by hand', 'With a card in your name'], ['drop', 'A sample with every order', 'Try something new']] as [string, string, string][],
    description: 'Description', deliveryReturns: 'Delivery & exchanges', deliveryText: 'We deliver everywhere in 2–3 days. Exchange any unopened product within 14 days.', howToWear: 'How to wear it', wearText: 'Spray on pulse points: wrists, behind the ears, the base of the neck, and don’t rub. For longer wear, put the cream on first.', notesTitle: 'The notes', youMayLike: 'You may also like', in: 'In {c}',
    photography: 'Photography', credits: 'Every picture in this demo store is a real photograph from Unsplash, by:', tryPanel: 'Try the control panel', scroll: 'Scroll', pause: 'Pause', play: 'Play', slide: 'Slide {n}',
    results: 'Results', quick: 'Quick links', seeAll: 'All results for “{q}”',
  },
} satisfies Record<Lang, unknown>;
export type Strings = (typeof STRINGS)['en'];
export const s = computed<Strings>(() => STRINGS[lang.value]);
