// The control panel's words. They live here so shoppers never download them.
import { computed } from '@preact/signals';
import { lang } from '../lib/i18n';

const A = {
  ar: {
    panel: 'لوحة التحكم', viewStore: 'عرض المتجر', saved: 'حُفظ', saving: 'يُحفظ…', preview: 'المعاينة المباشرة', hidePreview: 'إخفاء المعاينة',
    nav: { home: 'الرئيسية', orders: 'الطلبات', products: 'المنتجات', categories: 'الأقسام', storefront: 'واجهة المتجر', discounts: 'الخصومات', settings: 'الإعدادات' },
    demoNote: 'هذه لوحة تجريبية: كل ما تغيّره يُحفظ في متصفحك فقط، ويمكنك البدء من جديد متى شئت.',
    dash: { today: 'مبيعات اليوم', week: 'آخر ٧ أيام', newOrders: 'طلبات جديدة', low: 'كميات قليلة', latest: 'آخر الطلبات', lowList: 'منتجات توشك على النفاد', none: 'لا شيء هنا الآن', try: 'جرّب الآن', tries: ['غيّر سعر «نفحة نوار» وشاهده في المتجر', 'أضف منتجاً جديداً بصورة من هاتفك', 'غيّر لون المتجر من الإعدادات', 'اطلب من المتجر ثم غيّر حالة الطلب هنا'] },
    p: { new: 'منتج جديد', search: 'ابحث بالاسم أو الرمز…', all: 'كل الأقسام', name: 'الاسم', price: 'السعر', stock: 'الكمية', status: 'الحالة', on: 'معروض', off: 'مخفي', featured: 'مميّز', edit: 'تعديل', none: 'لا منتجات تطابق بحثك.' },
    f: { back: 'المنتجات', titleNew: 'منتج جديد', titleEdit: 'تعديل المنتج', nameAr: 'الاسم بالعربية', nameEn: 'الاسم بالإنجليزية', shortAr: 'وصف قصير بالعربية', shortEn: 'وصف قصير بالإنجليزية', bodyAr: 'الوصف الكامل بالعربية', bodyEn: 'الوصف الكامل بالإنجليزية',
      category: 'القسم', price: 'السعر', compareAt: 'السعر قبل الخصم (اختياري)', stock: 'الكمية المتوفرة', sku: 'رمز المنتج', size: 'الحجم', slug: 'رابط المنتج', notes: 'المكوّنات (البداية، القلب، القاعدة)', noteAr: 'بالعربية', noteEn: 'بالإنجليزية',
      pics: 'الصور', addPic: 'أضف صورة', picHint: 'تُصغَّر الصور تلقائياً لتبقى سريعة.', active: 'معروض في المتجر', featured: 'يظهر في «الأكثر طلباً»', save: 'حفظ', saved: 'حُفظ المنتج', delete: 'حذف المنتج', deleteSure: 'حذف هذا المنتج نهائياً؟', deleted: 'حُذف المنتج', required: 'مطلوب', preview: 'عرض في المتجر', cover: 'الصورة الرئيسية' },
    c: { new: 'قسم جديد', nameAr: 'الاسم بالعربية', nameEn: 'الاسم بالإنجليزية', blurbAr: 'سطر تعريفي بالعربية', blurbEn: 'سطر تعريفي بالإنجليزية', pic: 'الصورة', save: 'حفظ', delete: 'حذف', notEmpty: 'انقل منتجات هذا القسم أولاً', count: '{n} منتجات' },
    b: { title: 'صور الواجهة', add: 'صورة جديدة', titleAr: 'العنوان بالعربية', titleEn: 'العنوان بالإنجليزية', subAr: 'النص بالعربية', subEn: 'النص بالإنجليزية', ctaAr: 'الزر بالعربية', ctaEn: 'الزر بالإنجليزية', href: 'يفتح', tone: 'لون النص', dark: 'فاتح على صورة داكنة', light: 'داكن على صورة فاتحة', active: 'معروضة', pic: 'الصورة', picTall: 'صورة الهاتف (اختياري، طولية)', save: 'حفظ', delete: 'حذف',
      ann: 'شريط الإعلان', annAr: 'النص بالعربية', annEn: 'النص بالإنجليزية', annOn: 'ظاهر أعلى المتجر' },
    d: { new: 'كود جديد', code: 'الكود', kind: 'النوع', percent: 'نسبة ٪', fixed: 'مبلغ ثابت', value: 'القيمة', min: 'أقل قيمة للطلب', active: 'فعّال', uses: 'استُخدم {n} مرة', save: 'حفظ', delete: 'حذف', taken: 'هذا الكود موجود' },
    o: { all: 'الكل', none: 'لا طلبات هنا.', customer: 'الزبون', items: 'المنتجات', move: 'نقل إلى', pay: { cod: 'عند الاستلام', card: 'بطاقة', wallet: 'محفظة' }, history: 'السجل', whatsapp: 'راسل الزبون', back: 'الطلبات', note: 'ملاحظة' },
    s: { store: 'المتجر', nameAr: 'اسم المتجر بالعربية', nameEn: 'اسم المتجر بالإنجليزية', tagAr: 'الشعار بالعربية', tagEn: 'الشعار بالإنجليزية', contact: 'التواصل', phone: 'الهاتف', whatsapp: 'واتساب', email: 'البريد', instagram: 'إنستغرام',
      money: 'العملة والتوصيل', currency: 'العملة', currencyHint: 'تتحوّل كل الأسعار تلقائياً.', fee: 'رسوم التوصيل', freeOver: 'التوصيل مجاني فوق', look: 'الشكل', accent: 'اللون الأساسي', radius: 'استدارة الزوايا', save: 'حفظ', saved: 'حُفظت الإعدادات',
      demo: 'العرض التجريبي', reset: 'ابدأ من جديد', resetSure: 'إعادة المتجر كما كان؟ ستُحذف كل تغييراتك.', market: 'افتح كمتجر', iq: 'في العراق (دينار عراقي)', jo: 'في الأردن (دينار أردني)', done: 'عاد المتجر كما كان' },
    status: { new: 'جديد', preparing: 'قيد التجهيز', shipped: 'مع المندوب', delivered: 'وصل', canceled: 'ملغى' },
  },
  en: {
    panel: 'Control panel', viewStore: 'View store', saved: 'Saved', saving: 'Saving…', preview: 'Live preview', hidePreview: 'Hide preview',
    nav: { home: 'Home', orders: 'Orders', products: 'Products', categories: 'Categories', storefront: 'Storefront', discounts: 'Discounts', settings: 'Settings' },
    demoNote: 'This is a demo panel: everything you change is saved in your browser only, and you can start over any time.',
    dash: { today: 'Sales today', week: 'Last 7 days', newOrders: 'New orders', low: 'Low stock', latest: 'Latest orders', lowList: 'Running low', none: 'Nothing here right now', try: 'Try it now', tries: ['Change Nafha Noir’s price and watch the store', 'Add a new product with a photo from your phone', 'Change the store’s colour in Settings', 'Order from the store, then move the order here'] },
    p: { new: 'New product', search: 'Search by name or code…', all: 'All categories', name: 'Name', price: 'Price', stock: 'Stock', status: 'Status', on: 'Live', off: 'Hidden', featured: 'Featured', edit: 'Edit', none: 'No products match.' },
    f: { back: 'Products', titleNew: 'New product', titleEdit: 'Edit product', nameAr: 'Name in Arabic', nameEn: 'Name in English', shortAr: 'Short description in Arabic', shortEn: 'Short description in English', bodyAr: 'Full description in Arabic', bodyEn: 'Full description in English',
      category: 'Category', price: 'Price', compareAt: 'Price before discount (optional)', stock: 'In stock', sku: 'Code', size: 'Size', slug: 'Product link', notes: 'Notes (top, heart, base)', noteAr: 'Arabic', noteEn: 'English',
      pics: 'Photos', addPic: 'Add photo', picHint: 'Photos are shrunk automatically so the store stays fast.', active: 'Shown in the store', featured: 'Shown in “Most loved”', save: 'Save', saved: 'Product saved', delete: 'Delete product', deleteSure: 'Delete this product for good?', deleted: 'Product deleted', required: 'Required', preview: 'View in store', cover: 'Main photo' },
    c: { new: 'New category', nameAr: 'Name in Arabic', nameEn: 'Name in English', blurbAr: 'Intro line in Arabic', blurbEn: 'Intro line in English', pic: 'Picture', save: 'Save', delete: 'Delete', notEmpty: 'Move this category’s products first', count: '{n} products' },
    b: { title: 'Home banners', add: 'New banner', titleAr: 'Title in Arabic', titleEn: 'Title in English', subAr: 'Text in Arabic', subEn: 'Text in English', ctaAr: 'Button in Arabic', ctaEn: 'Button in English', href: 'Opens', tone: 'Text colour', dark: 'Light on a dark picture', light: 'Dark on a light picture', active: 'Shown', pic: 'Picture', picTall: 'Phone picture (optional, portrait)', save: 'Save', delete: 'Delete',
      ann: 'Announcement bar', annAr: 'Text in Arabic', annEn: 'Text in English', annOn: 'Shown at the top of the store' },
    d: { new: 'New code', code: 'Code', kind: 'Type', percent: 'Percent %', fixed: 'Fixed amount', value: 'Value', min: 'Minimum order', active: 'Active', uses: 'Used {n} times', save: 'Save', delete: 'Delete', taken: 'That code already exists' },
    o: { all: 'All', none: 'No orders here.', customer: 'Customer', items: 'Items', move: 'Move to', pay: { cod: 'Cash on delivery', card: 'Card', wallet: 'E-wallet' }, history: 'History', whatsapp: 'Message the customer', back: 'Orders', note: 'Note' },
    s: { store: 'Store', nameAr: 'Store name in Arabic', nameEn: 'Store name in English', tagAr: 'Tagline in Arabic', tagEn: 'Tagline in English', contact: 'Contact', phone: 'Phone', whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram',
      money: 'Currency and delivery', currency: 'Currency', currencyHint: 'Every price converts automatically.', fee: 'Delivery fee', freeOver: 'Free delivery over', look: 'Look', accent: 'Main colour', radius: 'Corner roundness', save: 'Save', saved: 'Settings saved',
      demo: 'The demo', reset: 'Start over', resetSure: 'Put the store back as it was? All your changes will go.', market: 'Open as a store', iq: 'in Iraq (Iraqi dinar)', jo: 'in Jordan (Jordanian dinar)', done: 'The store is back as it was' },
    status: { new: 'New', preparing: 'Preparing', shipped: 'With courier', delivered: 'Delivered', canceled: 'Canceled' },
  },
};
export type AStrings = (typeof A)['en'];
export const a = computed<AStrings>(() => A[lang.value]);
