// The public pages' look: one stylesheet and a few small scripts, written straight into the HTML (no framework, no
// extra requests besides the photos and one font), so a listing opens instantly on a weak phone signal and in WhatsApp's
// own browser. Calm and photographic: big pictures, a clear price, obvious ways to get in touch.

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const attr = esc;

export type Lang = 'ar' | 'en';
export const T = {
  ar: {
    sale: 'للبيع', rent: 'للإيجار', reserved: 'محجوز', sold: 'تم البيع', rented: 'تم التأجير', negotiable: 'قابل للتفاوض', ref: 'رقم العقار', photos: 'صورة', all: 'كل الصور',
    size: 'المساحة', land: 'الأرض', bedrooms: 'غرف النوم', bathrooms: 'الحمّامات', floors: 'الطوابق', parking: 'المواقف', year: 'سنة البناء', m2: 'م²',
    about: 'عن العقار', features: 'المميزات', details: 'التفاصيل', location: 'الموقع', type: 'النوع', purpose: 'الغرض', furnished: 'الأثاث', condition: 'الحالة',
    furn: { none: 'غير مؤثث', semi: 'مؤثث جزئياً', full: 'مؤثث بالكامل' } as Record<string, string>,
    cond: { new: 'جديد', excellent: 'ممتاز', good: 'جيد', needs_work: 'يحتاج ترميم', shell: 'هيكل' } as Record<string, string>,
    whatsapp: 'واتساب', call: 'اتصال', request: 'اطلب معاينة', share: 'مشاركة', copied: 'تم نسخ الرابط', listedBy: 'معروض لدى', agent: 'الوكيل', openMap: 'افتح في الخرائط',
    nearArea: 'الموقع التقريبي: {area}', waHello: 'مرحباً، أنا مهتم بهذا العقار: {title} (رقم #{ref})\n{url}', similar: 'عقارات أخرى قد تعجبك',
    formTitle: 'اطلب معاينة', formSub: 'اترك اسمك ورقمك، وسيتواصل معك {who} على واتساب لتحديد الموعد.', name: 'الاسم', phone: 'رقم الهاتف (واتساب)', when: 'متى يناسبك؟',
    whens: ['اليوم مساءً', 'غداً', 'نهاية الأسبوع', 'وقت آخر'], message: 'ملاحظة (اختياري)', send: 'أرسل الطلب', sending: 'جارٍ الإرسال…', sent: 'تم إرسال طلبك', sentSub: 'سيتواصل معك {who} قريباً لتحديد موعد المعاينة.',
    badPhone: 'تأكد من رقم الهاتف.', failed: 'لم يُرسل الطلب. حاول مرة أخرى، أو راسلنا على واتساب.', close: 'إغلاق', soldNote: 'هذا العقار لم يعد متاحاً، لكن لدينا عقارات مشابهة.', reservedNote: 'هذا العقار محجوز حالياً. يمكنك الاستفسار عن عقارات مشابهة.',
    gone: 'هذا العقار لم يعد معروضاً', goneSub: 'ربما بيع أو أُزيل. تواصل مع المكتب ليقترح عليك عقارات مشابهة.', powered: 'صفحة من هيملو', perMonth: 'شهرياً', perYear: 'سنوياً', onRequest: 'السعر عند الطلب',
    selectedFor: 'مختارة لـ {name}', selection: 'مجموعة مختارة', homes: '{n} عقارات', saved: 'محفوظ', save: 'احفظ', open: 'التفاصيل', fromAgent: 'من {who}', switchLang: 'English',
    types: { apartment: 'شقة', house: 'بيت', villa: 'فيلا', land: 'أرض', office: 'مكتب', shop: 'محل', commercial: 'عقار تجاري', building: 'بناية', warehouse: 'مخزن', farm: 'مزرعة' } as Record<string, string>,
  },
  en: {
    sale: 'For sale', rent: 'For rent', reserved: 'Reserved', sold: 'Sold', rented: 'Rented', negotiable: 'Negotiable', ref: 'Property no.', photos: 'photos', all: 'All photos',
    size: 'Size', land: 'Plot', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', floors: 'Floors', parking: 'Parking', year: 'Built', m2: 'm²',
    about: 'About this home', features: 'Features', details: 'Details', location: 'Location', type: 'Type', purpose: 'For', furnished: 'Furnishing', condition: 'Condition',
    furn: { none: 'Unfurnished', semi: 'Part furnished', full: 'Fully furnished' } as Record<string, string>,
    cond: { new: 'New', excellent: 'Excellent', good: 'Good', needs_work: 'Needs work', shell: 'Shell' } as Record<string, string>,
    whatsapp: 'WhatsApp', call: 'Call', request: 'Request a viewing', share: 'Share', copied: 'Link copied', listedBy: 'Listed by', agent: 'Agent', openMap: 'Open in Maps',
    nearArea: 'Approximate location: {area}', waHello: 'Hello, I’m interested in this property: {title} (no. #{ref})\n{url}', similar: 'You may also like',
    formTitle: 'Request a viewing', formSub: 'Leave your name and number, and {who} will message you on WhatsApp to set a time.', name: 'Your name', phone: 'Phone (WhatsApp)', when: 'When suits you?',
    whens: ['This evening', 'Tomorrow', 'This weekend', 'Another time'], message: 'Note (optional)', send: 'Send request', sending: 'Sending…', sent: 'Request sent', sentSub: '{who} will be in touch soon to arrange your viewing.',
    badPhone: 'Please check the phone number.', failed: 'That didn’t go through. Try again, or message us on WhatsApp.', close: 'Close', soldNote: 'This home is no longer available, but we have similar ones.', reservedNote: 'This home is reserved for now. Ask us about similar homes.',
    gone: 'This property is no longer listed', goneSub: 'It may have been sold or removed. Contact the agency and they’ll suggest similar homes.', powered: 'A Hemlo page', perMonth: 'per month', perYear: 'per year', onRequest: 'Price on request',
    selectedFor: 'Selected for {name}', selection: 'A selection of homes', homes: '{n} homes', saved: 'Saved', save: 'Save', open: 'Details', fromAgent: 'From {who}', switchLang: 'العربية',
    types: { apartment: 'Apartment', house: 'House', villa: 'Villa', land: 'Land', office: 'Office', shop: 'Shop', commercial: 'Commercial', building: 'Building', warehouse: 'Warehouse', farm: 'Farm' } as Record<string, string>,
  },
};
export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

export function priceHtml(price: number | null, currency: string, lang: Lang, rentPeriod?: string | null) {
  const t = T[lang];
  if (price == null) return `<span class="price-na">${t.onRequest}</span>`;
  const n = new Intl.NumberFormat('en-US').format(price);
  const main = currency === 'USD' ? `$${n}` : `${n} <small>${lang === 'ar' ? 'د.ع' : 'IQD'}</small>`;
  const per = rentPeriod === 'month' ? ` <small>${t.perMonth}</small>` : rentPeriod === 'year' ? ` <small>${t.perYear}</small>` : '';
  return `<span dir="ltr" class="num">${main}</span>${per}`;
}

const ICON: Record<string, string> = {
  size: '<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>', land: '<path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>',
  bedrooms: '<path d="M3 18V8M3 14h18v4M21 18v-6a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>', bathrooms: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z"/><path d="M6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/>',
  floors: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>', parking: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V7h3a3 3 0 0 1 0 6h-3"/>',
  year: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  wa: '<path d="M3 21l1.65-4.94A9 9 0 1 1 7.9 19.3L3 21Z"/><path d="M9 10c.5 2 2 3.5 4 4l1.2-1.2a1 1 0 0 1 1-.25l1.8.6"/>',
  call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>', check: '<path d="M20 6 9 17l-5-5"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>', prev: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
};
export const icon = (n: string, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] ?? ''}</svg>`;

/** The stylesheet every public page shares. Warm paper, ink, and the agency's own contact actions in WhatsApp green. */
export const CSS = `
@font-face{font-family:"Vazirmatn";font-style:normal;font-weight:300 700;font-display:swap;src:url(/fonts/vazirmatn-arabic.woff2) format("woff2");unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:"Readex Pro";font-style:normal;font-weight:300 600;font-display:swap;src:url(/fonts/readex-pro-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F,U+20AC}
:root{--bg:#FAF8F4;--surface:#fff;--ink:#14181F;--ink2:#4A5160;--muted:#7A808C;--line:#E7E3DA;--soft:#F2EEE6;--accent:#1F5F4A;--wa:#1FA855;--warn:#B4541F;--r:18px;
  --font:"Readex Pro","Vazirmatn",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0E1116;--surface:#161A21;--ink:#F1EEE8;--ink2:#C3C7CF;--muted:#8D94A0;--line:#262C36;--soft:#1C2129;--accent:#7FC8AE;color-scheme:dark}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);line-height:1.6;-webkit-font-smoothing:antialiased}
html[lang=ar] body{font-family:"Vazirmatn","Readex Pro",ui-sans-serif,system-ui,sans-serif}
a{color:inherit}img{display:block;max-width:100%}button{font:inherit;color:inherit;cursor:pointer}
.ic{width:20px;height:20px;flex:none}.num{font-variant-numeric:tabular-nums}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
.top{position:sticky;top:0;z-index:20;background:color-mix(in oklab,var(--bg) 88%,transparent);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border-bottom:1px solid transparent;transition:border-color .2s}
.top.scrolled{border-color:var(--line)}
.top .wrap{display:flex;align-items:center;gap:12px;height:60px}
.brand{display:flex;align-items:center;gap:10px;min-width:0;text-decoration:none;font-weight:600}
.brand img{width:34px;height:34px;border-radius:10px;object-fit:cover}.brand .mono{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--ink);color:var(--bg);font-size:14px}
.brand span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top .sp{flex:1}.chip-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);font-size:14px;text-decoration:none}
.gal{position:relative;margin:0 auto;max-width:1120px}
.strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}.strip::-webkit-scrollbar{display:none}
.strip figure{margin:0;flex:0 0 100%;scroll-snap-align:center;aspect-ratio:4/3;background:var(--soft)}
.strip img{width:100%;height:100%;object-fit:cover}
.count{position:absolute;inset-inline-end:14px;bottom:14px;padding:4px 10px;border-radius:999px;background:rgba(10,12,16,.62);color:#fff;font-size:13px;backdrop-filter:blur(6px)}
.mosaic{display:none}
@media (min-width:860px){
  .gal{padding:20px 20px 0}.strip{display:none}.count{display:none}
  .mosaic{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:220px 220px;gap:8px;border-radius:var(--r);overflow:hidden;position:relative}
  .mosaic button{padding:0;border:0;background:var(--soft);overflow:hidden}.mosaic button:first-child{grid-row:span 2}
  .mosaic img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,0,0,1)}.mosaic button:hover img{transform:scale(1.03)}
  .mosaic .allbtn{position:absolute;inset-inline-end:16px;bottom:16px;display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:999px;border:0;background:#fff;color:#14181F;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.18)}
  .mosaic.one{grid-template-columns:1fr}.mosaic.two{grid-template-columns:1fr 1fr;grid-template-rows:440px}.mosaic.two button:first-child{grid-row:auto}
}
.main{display:grid;gap:32px;padding-top:24px;padding-bottom:120px}
@media (min-width:860px){.main{grid-template-columns:minmax(0,1fr) 340px;gap:48px;padding-top:32px;padding-bottom:64px}}
.status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:var(--soft);font-size:13px;font-weight:500}
.status.sold,.status.rented{background:#14181F;color:#fff}.status.reserved{background:color-mix(in oklab,var(--warn) 16%,var(--surface));color:var(--warn)}
h1{margin:12px 0 6px;font-size:clamp(26px,4.4vw,36px);line-height:1.2;font-weight:600;letter-spacing:-.02em}html[lang=ar] h1{letter-spacing:0;line-height:1.35}
.place{display:flex;align-items:center;gap:6px;color:var(--ink2)}
.price{margin-top:18px;font-size:clamp(28px,5vw,38px);font-weight:600;letter-spacing:-.02em;line-height:1.1}.price small{font-size:.5em;font-weight:500;color:var(--ink2)}
.price .price-na{font-size:.7em}.neg{margin-top:6px;color:var(--muted);font-size:14px}
.facts{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.fact{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--line);min-width:120px}
.fact b{display:block;font-size:17px;font-weight:600;line-height:1.2}.fact small{display:block;color:var(--muted);font-size:12px}
section.blk{padding-top:28px;margin-top:28px;border-top:1px solid var(--line)}section.blk h2{margin:0 0 12px;font-size:20px;font-weight:600}
.desc p{margin:0 0 12px;color:var(--ink2)}
.feat{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0;list-style:none}.feat li{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:var(--soft);font-size:14px}
.feat li .ic{width:16px;height:16px;color:var(--accent)}
dl.tbl{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin:0}dl.tbl div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
dl.tbl dt{color:var(--muted)}dl.tbl dd{margin:0;font-weight:500;text-align:end}
@media (max-width:560px){dl.tbl{grid-template-columns:1fr}}
.map{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);aspect-ratio:16/9;background:var(--soft)}.map iframe{width:100%;height:100%;border:0}
.near{display:flex;align-items:center;gap:8px;color:var(--ink2)}
.side{position:relative}.card{position:sticky;top:84px;padding:22px;border-radius:var(--r);background:var(--surface);border:1px solid var(--line);box-shadow:0 30px 60px -40px rgba(20,24,31,.35)}
.agent{display:flex;align-items:center;gap:12px}.agent .av{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:var(--soft);font-weight:600;overflow:hidden}.agent .av img{width:100%;height:100%;object-fit:cover}
.agent b{display:block}.agent small{color:var(--muted)}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:50px;border-radius:14px;border:1px solid var(--line);background:var(--surface);font-weight:600;font-size:16px;text-decoration:none;transition:transform .15s,filter .2s}
.btn:active{transform:scale(.98)}.btn.wa{background:var(--wa);border-color:var(--wa);color:#fff}.btn.wa:hover{filter:brightness(1.05)}.btn.dark{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.stack{display:grid;gap:10px;margin-top:18px}
.bar{position:fixed;inset-inline:0;bottom:0;z-index:30;display:grid;grid-template-columns:1.2fr .9fr 1.3fr;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:color-mix(in oklab,var(--bg) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line)}
.bar .btn{height:48px;font-size:14px;white-space:nowrap;padding:0 8px}.bar .btn .ic{width:18px;height:18px}@media (min-width:860px){.bar{display:none}}
@media (max-width:859px){.card{display:none}}
.note{margin-top:16px;padding:12px 14px;border-radius:14px;background:var(--soft);color:var(--ink2);font-size:14px}
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.pc{position:relative;display:block;text-decoration:none;border-radius:var(--r);overflow:hidden;background:var(--surface);border:1px solid var(--line);transition:transform .25s cubic-bezier(.2,0,0,1),box-shadow .25s}
.pc:hover{transform:translateY(-2px);box-shadow:0 24px 50px -36px rgba(20,24,31,.45)}
.pc .ph{aspect-ratio:4/3;background:var(--soft)}.pc .ph img{width:100%;height:100%;object-fit:cover}
.pc .bd{padding:14px 16px 16px}.pc .pr{font-size:20px;font-weight:600}.pc .pr small{font-size:.6em;color:var(--ink2)}.pc .tt{margin-top:2px;font-weight:500}
.pc .mt{margin-top:6px;color:var(--muted);font-size:14px;display:flex;gap:12px;flex-wrap:wrap}
.pc .st{position:absolute;top:12px;inset-inline-start:12px}
.fav{position:absolute;top:12px;inset-inline-end:12px;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#14181F;box-shadow:0 4px 14px rgba(0,0,0,.15)}
.fav.on{color:#E0245E}.fav.on svg{fill:currentColor}
footer{padding:28px 0 40px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}footer .wrap{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:space-between}
footer a{text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}
.sheet{position:fixed;inset:0;z-index:50;display:none}.sheet.open{display:block}
.sheet .scrim{position:absolute;inset:0;background:rgba(10,12,16,.45);animation:fade .2s both}
.sheet .box{position:absolute;inset-inline:0;bottom:0;max-height:92dvh;overflow:auto;padding:22px 20px calc(22px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0;background:var(--surface);animation:up .32s cubic-bezier(.23,1,.32,1) both}
@media (min-width:640px){.sheet .box{inset:auto;left:50%;top:50%;bottom:auto;width:440px;border-radius:22px;transform:translate(-50%,-50%);animation:pop .28s cubic-bezier(.23,1,.32,1) both}}
@keyframes up{from{transform:translateY(40px);opacity:0}}@keyframes fade{from{opacity:0}}@keyframes pop{from{opacity:0;transform:translate(-50%,-46%)}}
.box h3{margin:0;font-size:20px}.box p{margin:6px 0 0;color:var(--ink2)}
label.f{display:grid;gap:6px;margin-top:14px;font-size:14px;color:var(--ink2)}
.in{width:100%;height:48px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;font-size:16px}
textarea.in{height:84px;padding:12px 14px;resize:vertical}.in:focus{outline:2px solid var(--accent);outline-offset:1px}
.whens{display:flex;flex-wrap:wrap;gap:8px}.whens button{height:38px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--bg);font-size:14px}
.whens button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.err{margin-top:10px;color:#C2334A;font-size:14px;min-height:1em}
.done{text-align:center;padding:18px 0}.done .ok{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 12px;border-radius:50%;background:color-mix(in oklab,var(--wa) 16%,transparent);color:var(--wa)}
.lb{position:fixed;inset:0;z-index:60;display:none;background:#0A0C10}.lb.open{display:flex;flex-direction:column}
.lb .lbt{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;color:#fff}.lb .lbt button{width:44px;height:44px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center}
.lb .strip{flex:1}.lb .strip figure{aspect-ratio:auto;background:none;display:grid;place-items:center}.lb .strip img{width:auto;height:auto;max-width:100%;max-height:calc(100dvh - 80px);object-fit:contain}
.lb .nav{position:absolute;top:50%;width:48px;height:48px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;display:none;place-items:center}
@media (min-width:860px){.lb .nav{display:grid}}.lb .nav.p{inset-inline-start:20px}.lb .nav.n{inset-inline-end:20px}html[dir=rtl] .lb .nav svg{transform:scaleX(-1)}
.toast{position:fixed;left:50%;bottom:90px;z-index:70;transform:translateX(-50%);padding:10px 16px;border-radius:999px;background:var(--ink);color:var(--bg);font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
.gone{min-height:70dvh;display:grid;place-items:center;text-align:center;padding:40px 20px}.gone h1{font-size:28px}.gone p{color:var(--ink2);max-width:440px;margin:8px auto 20px}
.hero{padding:40px 0 24px}.hero .kick{color:var(--muted)}.hero h1{font-size:clamp(28px,5vw,44px)}.hero p{color:var(--ink2);max-width:640px}
.big{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:20px}@media (min-width:720px){.big{grid-template-columns:repeat(4,1fr)}}
.big div{padding:18px;border-radius:var(--r);background:var(--surface);border:1px solid var(--line)}.big b{display:block;font-size:34px;font-weight:600;line-height:1.1}.big small{color:var(--muted)}
.bars{display:flex;align-items:flex-end;gap:4px;height:90px;margin-top:12px}.bars span{flex:1;min-height:2px;border-radius:4px 4px 0 0;background:var(--accent);opacity:.85}
.tl{list-style:none;margin:0;padding:0}.tl li{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.tl time{color:var(--muted);min-width:96px;font-size:14px}
@media print{.top,.bar,.noprint{display:none!important}body{background:#fff;color:#000}.big div,.card{box-shadow:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

/** The page frame: head (title, description, canonical, Open Graph, JSON-LD), the stylesheet, and the body. */
export function frame(o: { lang: Lang; title: string; description: string; canonical?: string; image?: string | null; robots: 'index' | 'noindex'; body: string; script?: string; jsonld?: unknown; alt?: string }) {
  const dir = o.lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${o.lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)}</title><meta name="description" content="${attr(o.description)}"><meta name="robots" content="${o.robots === 'index' ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}">
${o.canonical ? `<link rel="canonical" href="${attr(o.canonical)}">` : ''}${o.alt ? `<link rel="alternate" hreflang="${o.lang === 'ar' ? 'en' : 'ar'}" href="${attr(o.alt)}">` : ''}
<meta name="theme-color" content="#FAF8F4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0E1116" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website"><meta property="og:title" content="${attr(o.title)}"><meta property="og:description" content="${attr(o.description)}">
${o.canonical ? `<meta property="og:url" content="${attr(o.canonical)}">` : ''}${o.image ? `<meta property="og:image" content="${attr(o.image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta property="og:locale" content="${o.lang === 'ar' ? 'ar_IQ' : 'en_US'}"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${o.lang === 'ar' ? '/fonts/vazirmatn-arabic.woff2' : '/fonts/readex-pro-latin.woff2'}" as="font" type="font/woff2" crossorigin>
<style>${CSS}</style>${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, '\\u003c')}</script>` : ''}</head>
<body>${o.body}<div class="toast" id="toast" role="status"></div>${o.script ? `<script>${o.script}</script>` : ''}</body></html>`;
}

/** The small scripts: header shadow, gallery counter and lightbox, share, contact pings, the viewing request form, favourites. */
export const SCRIPT = (cfg: Record<string, unknown>) => `(function(){var C=${JSON.stringify(cfg).replace(/</g, '\\u003c')};
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var top=$('.top');addEventListener('scroll',function(){top&&top.classList.toggle('scrolled',scrollY>8)},{passive:true});
function toast(t){var x=$('#toast');x.textContent=t;x.classList.add('on');setTimeout(function(){x.classList.remove('on')},1800)}
function ping(k,extra){if(!C.api)return;try{var b=JSON.stringify(Object.assign({kind:k},C.ctx||{},extra||{}));navigator.sendBeacon?navigator.sendBeacon(C.api+'/event',new Blob([b],{type:'application/json'})):fetch(C.api+'/event',{method:'POST',body:b,headers:{'content-type':'application/json'},keepalive:true})}catch(e){}}
$$('[data-ping]').forEach(function(a){a.addEventListener('click',function(){ping(a.getAttribute('data-ping'))})});
var strip=$('.gal .strip'),cnt=$('.gal .count');if(strip&&cnt){strip.addEventListener('scroll',function(){var i=Math.round(Math.abs(strip.scrollLeft)/strip.clientWidth);cnt.textContent=(i+1)+' / '+strip.children.length},{passive:true})}
var lb=$('.lb');function openLb(i){if(!lb)return;lb.classList.add('open');document.body.style.overflow='hidden';var s=$('.strip',lb);requestAnimationFrame(function(){s.scrollLeft=(document.dir==='rtl'?-1:1)*i*s.clientWidth})}
function closeLb(){lb.classList.remove('open');document.body.style.overflow=''}
$$('[data-open]').forEach(function(b){b.addEventListener('click',function(){openLb(+b.getAttribute('data-open'))})});
if(lb){$('[data-close]',lb).addEventListener('click',closeLb);addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;var s=$('.strip',lb),d=document.dir==='rtl'?-1:1;if(e.key==='Escape')closeLb();if(e.key==='ArrowRight')s.scrollBy({left:s.clientWidth*(d>0?1:-1)});if(e.key==='ArrowLeft')s.scrollBy({left:-s.clientWidth*(d>0?1:-1)})});
$$('.nav',lb).forEach(function(b){b.addEventListener('click',function(){var s=$('.strip',lb),d=document.dir==='rtl'?-1:1;s.scrollBy({left:(b.classList.contains('n')?1:-1)*d*s.clientWidth,behavior:'smooth'})})})}
$$('[data-share]').forEach(function(b){b.addEventListener('click',function(){ping('share');if(navigator.share){navigator.share({title:C.title,text:C.shareText,url:C.url}).catch(function(){})}else{navigator.clipboard&&navigator.clipboard.writeText(C.url).then(function(){toast(C.t.copied)})}})});
var sh=$('#req');function openReq(){if(!sh)return;sh.classList.add('open');setTimeout(function(){var i=$('input[name=name]',sh);i&&i.focus()},250)}
$$('[data-req]').forEach(function(b){b.addEventListener('click',openReq)});
if(sh){$$('[data-x]',sh).forEach(function(b){b.addEventListener('click',function(){sh.classList.remove('open')})});
var when='';$$('.whens button',sh).forEach(function(b){b.addEventListener('click',function(){$$('.whens button',sh).forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');when=b.textContent})});
$('form',sh).addEventListener('submit',function(e){e.preventDefault();var f=e.target,err=$('.err',sh),btn=$('button[type=submit]',f);err.textContent='';
var ph=f.phone.value.replace(/[^0-9+٠-٩]/g,'');if(ph.replace(/\\D/g,'').length<7&&!/[٠-٩]{7,}/.test(ph)){err.textContent=C.t.badPhone;return}
btn.disabled=true;btn.textContent=C.t.sending;
fetch(C.api+'/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({name:f.name.value,phone:f.phone.value,preferred:when,message:f.message.value,hp:f.website.value},C.ctx||{}))})
.then(function(r){return r.json().then(function(j){if(!r.ok)throw j;return j})}).then(function(){$('.form',sh).hidden=true;$('.done',sh).hidden=false})
.catch(function(j){err.textContent=j&&j.error==='BAD_PHONE'?C.t.badPhone:C.t.failed;btn.disabled=false;btn.textContent=C.t.send})})}
$$('[data-fav]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var on=b.classList.toggle('on');b.setAttribute('aria-pressed',on);
fetch(C.api+'/fav',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({propertyId:b.getAttribute('data-fav'),on:on})}).catch(function(){});if(on)toast(C.t.saved)})});
})();`;
