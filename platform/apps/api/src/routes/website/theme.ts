// The public website's look: one small stylesheet, one page frame and the words every site shares. A business picks a
// theme (a preset plus accent, radius, font and dark) — it can't produce an ugly page, because it never touches CSS.
// Written straight into the HTML: no framework, no extra requests, so a page opens instantly on a weak phone signal.
import { esc, attr, icon, fill } from '../realestate/page';
import type { WebTheme } from '@hemlo/db/schema';

export type Lang = 'ar' | 'en';
type Two = { ar?: string; en?: string };
export const pick = (v: Two | undefined | null, lang: Lang) => (v ? v[lang] || v[lang === 'ar' ? 'en' : 'ar'] || '' : '');

export const W = {
  ar: {
    menu: 'القائمة', whatsapp: 'واتساب', call: 'اتصال', inquire: 'أرسل استفساراً', ask: 'استفسر',
    viewAll: 'عرض الكل', onRequest: 'السعر عند الطلب',
    hero: 'الرئيسية', about: 'من نحن', contact: 'تواصل معنا', services: 'خدماتنا', products: 'منتجاتنا', listings: 'عقاراتنا',
    gallery: 'الصور', team: 'فريقنا', faq: 'الأسئلة الشائعة', hours: 'أوقات العمل', testimonials: 'آراء العملاء',
    name: 'الاسم', phone: 'رقم الهاتف', email: 'البريد الإلكتروني (اختياري)', message: 'رسالتك',
    send: 'إرسال', sending: 'جارٍ الإرسال…', sent: 'تم إرسال رسالتك', sentSub: 'سنتواصل معك في أقرب وقت.',
    badPhone: 'تأكد من رقم الهاتف.', failed: 'لم يتم الإرسال. حاول مرة أخرى أو راسلنا على واتساب.', close: 'إغلاق',
    waHello: 'مرحباً، أنا مهتم بـ {what}\n{url}',
    notFound: 'الصفحة غير موجودة', notFoundSub: 'الرابط الذي فتحته غير متاح.',
    notReady: 'الموقع قيد الإعداد', notReadySub: 'نعمل عليه وسيعود قريباً. تواصل معنا عبر واتساب.',
    powered: 'موقع من هيملو', from: 'من {who}', allPhotos: 'كل الصور', emailAddress: 'العنوان',
    browse: 'تصفّح العقارات', allProperties: 'كل العقارات', available: '{n} عقاراً متاحاً الآن', availableOne: 'عقار واحد متاح الآن', beds: '{n} غرف', baths: '{n} حمّام', sqm: '{n} م²',
    filter: 'تصفية', results: '{n} عقاراً', forSale: 'للبيع', forRent: 'للإيجار', letsTalk: 'لنتحدث عن بيتك القادم.', phoneLabel: 'الهاتف', emailLabel: 'البريد', whereLabel: 'العنوان',
    aboutProperty: 'عن العقار', features: 'المميزات', facts: 'التفاصيل', map: 'عرض الموقع على الخريطة', video: 'شاهد الفيديو', unavailable: 'هذا العقار غير متاح حالياً.', negotiable: 'قابل للتفاوض',
    prev: 'السابقة', next: 'التالية', viewProperty: 'عرض العقار', replyNote: 'نردّ عادةً خلال ساعات العمل.',
  },
  en: {
    menu: 'Menu', whatsapp: 'WhatsApp', call: 'Call', inquire: 'Send an inquiry', ask: 'Enquire',
    viewAll: 'View all', onRequest: 'Price on request',
    hero: 'Home', about: 'About', contact: 'Contact', services: 'Services', products: 'Products', listings: 'Properties',
    gallery: 'Gallery', team: 'Our team', faq: 'Questions', hours: 'Opening hours', testimonials: 'What people say',
    name: 'Your name', phone: 'Phone', email: 'Email (optional)', message: 'Your message',
    send: 'Send', sending: 'Sending…', sent: 'Your message was sent', sentSub: 'We’ll be in touch soon.',
    badPhone: 'Please check the phone number.', failed: 'That didn’t go through. Try again or message us on WhatsApp.', close: 'Close',
    waHello: 'Hello, I’m interested in {what}\n{url}',
    notFound: 'Page not found', notFoundSub: 'The link you opened isn’t available.',
    notReady: 'This site is being prepared', notReadySub: 'It will be back soon. Reach us on WhatsApp.',
    powered: 'A Hemlo site', from: 'From {who}', allPhotos: 'All photos', emailAddress: 'Address',
    browse: 'Browse properties', allProperties: 'All properties', available: '{n} homes available now', availableOne: 'One home available now', beds: '{n} bed', baths: '{n} bath', sqm: '{n} m²',
    filter: 'Filter', results: '{n} properties', forSale: 'For sale', forRent: 'For rent', letsTalk: 'Let’s talk about your next home.', phoneLabel: 'Phone', emailLabel: 'Email', whereLabel: 'Visit',
    aboutProperty: 'About this property', features: 'Features', facts: 'The details', map: 'View location on map', video: 'Watch the video', unavailable: 'This property is no longer available.', negotiable: 'Negotiable',
    prev: 'Previous', next: 'Next', viewProperty: 'View property', replyNote: 'We usually reply within working hours.',
  },
} as const;

const SECTION_LABEL: Record<string, keyof (typeof W)['ar']> = {
  about: 'about', services: 'services', products: 'products', listings: 'listings',
  gallery: 'gallery', team: 'team', faq: 'faq', hours: 'hours', testimonials: 'testimonials', contact: 'contact',
};

export const PRESET_ACCENT: Record<string, string> = { classic: '#2F4A3A', modern: '#24507A', minimal: '#1B1A17', bold: '#9A3B26' };
// No web fonts: a page must open on a weak phone signal. The display face is the best serif the phone already has
// (Naskh for Arabic, an old-style serif for Latin); the text face is the phone's own sans.
const SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic","Noto Sans",sans-serif';
const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua","Noto Naskh Arabic","Amiri","Traditional Arabic",Georgia,serif';

export const accentOf = (theme: WebTheme) => theme.accent || PRESET_ACCENT[theme.preset ?? 'classic'] || PRESET_ACCENT.classic;

/** The whole stylesheet, parameterised by the business's few allowed choices. Quiet by design: warm paper, one serif
 *  for headings, hairlines instead of boxes, and motion that settles rather than bounces. */
export function themeCss(theme: WebTheme): string {
  const accent = accentOf(theme);
  const r = theme.radius === 'sm' ? '4px' : theme.radius === 'lg' ? '18px' : '10px';
  const text = theme.font === 'serif' ? SERIF : SANS, display = theme.font === 'sans' ? SANS : SERIF;
  return `:root{--bg:#F6F4EF;--surface:#EEEBE4;--card:#FBFAF7;--ink:#1B1A17;--ink2:#57534B;--muted:#8A857B;--line:#E2DDD2;--accent:${accent};--ring:color-mix(in oklab,var(--accent) 55%,transparent);--wa:#1E8E50;--r:${r};--text:${text};--display:${display};--ease:cubic-bezier(.22,.7,.18,1);color-scheme:light}
html[data-dark]{--bg:#12110F;--surface:#1B1A17;--card:#1F1D1A;--ink:#F1EDE5;--ink2:#BDB6A9;--muted:#8C857A;--line:#2E2B26;color-scheme:dark}
@view-transition{navigation:auto}
::view-transition-old(root),::view-transition-new(root){animation-duration:.38s;animation-timing-function:var(--ease)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--text);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit;text-decoration:none}img{display:block;max-width:100%}button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2px solid var(--ring);outline-offset:3px;border-radius:4px}
::selection{background:color-mix(in oklab,var(--accent) 22%,transparent)}
.wwrap{width:100%;max-width:1200px;margin:0 auto;padding:0 20px}@media (min-width:768px){.wwrap{padding:0 40px}}
.ic{width:18px;height:18px;flex:none}.num{font-variant-numeric:tabular-nums}
.eyebrow{display:flex;align-items:center;gap:10px;margin:0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
html[lang=ar] .eyebrow{font-size:13px;letter-spacing:0;text-transform:none}
.eyebrow .idx{font-variant-numeric:tabular-nums;color:var(--ink2)}.eyebrow .idx::after{content:"";display:inline-block;width:28px;height:1px;margin-inline-start:10px;vertical-align:middle;background:currentColor;opacity:.5}
.display{font-family:var(--display);font-weight:400;letter-spacing:-.015em;line-height:1.08;margin:0}html[lang=ar] .display{letter-spacing:0;line-height:1.35}
/* header: sits on the photo, turns to paper once the page moves */
header.wtop{position:sticky;top:0;z-index:30;transition:background-color .45s var(--ease),border-color .45s var(--ease),color .45s var(--ease);background:color-mix(in oklab,var(--bg) 86%,transparent);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);border-bottom:1px solid var(--line)}
body.on-photo header.wtop{position:fixed;inset-inline:0;background:transparent;border-color:transparent;color:#fff;backdrop-filter:none;-webkit-backdrop-filter:none}
body.on-photo header.wtop.is-stuck{background:color-mix(in oklab,var(--bg) 86%,transparent);border-color:var(--line);color:var(--ink);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3)}
header.wtop .wwrap{display:flex;align-items:center;gap:20px;height:68px}
.wbrand{display:flex;align-items:center;gap:12px;min-width:0}
.wbrand img{width:34px;height:34px;border-radius:calc(var(--r) - 2px);object-fit:cover}
.wbrand .mono{display:grid;place-items:center;width:34px;height:34px;border-radius:999px;border:1px solid currentColor;font-family:var(--display);font-size:16px;opacity:.9}
.wbrand span:last-child{font-family:var(--display);font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wnav{margin-inline-start:auto;display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none}.wnav::-webkit-scrollbar{display:none}
.wnav a{position:relative;padding:8px 12px;font-size:14.5px;white-space:nowrap;opacity:.78;transition:opacity .2s}
.wnav a::after{content:"";position:absolute;inset-inline:12px;bottom:4px;height:1px;background:currentColor;transform:scaleX(0);transform-origin:var(--from,left);transition:transform .45s var(--ease)}
html[dir=rtl] .wnav a{--from:right}.wnav a:hover,.wnav a[aria-current]{opacity:1}.wnav a:hover::after,.wnav a[aria-current]::after{transform:scaleX(1)}
.wlang{font-size:13px;padding:6px 12px;border-radius:999px;border:1px solid color-mix(in oklab,currentColor 30%,transparent);white-space:nowrap;transition:background-color .2s}.wlang:hover{background:color-mix(in oklab,currentColor 8%,transparent)}
@media (max-width:640px){.wnav{display:none}.wlang{margin-inline-start:auto}}
/* buttons and fields: shadcn's shape, Hemlo's paper */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:var(--r);border:1px solid var(--line);background:transparent;font-size:15px;font-weight:500;white-space:nowrap;transition:background-color .2s,border-color .2s,color .2s,transform .2s var(--ease)}
.btn:hover{background:var(--surface)}.btn:active{transform:scale(.98)}.btn[disabled]{opacity:.55;pointer-events:none}
.btn.primary{background:var(--ink);border-color:var(--ink);color:var(--bg)}.btn.primary:hover{background:color-mix(in oklab,var(--ink) 86%,var(--bg))}
.btn.accent{background:var(--accent);border-color:var(--accent);color:#fff}.btn.accent:hover{background:color-mix(in oklab,var(--accent) 88%,#000)}
.btn.wa{background:var(--wa);border-color:var(--wa);color:#fff}.btn.wa:hover{background:color-mix(in oklab,var(--wa) 88%,#000)}
.btn.light{background:#F6F4EF;border-color:#F6F4EF;color:#1B1A17}.btn.light:hover{background:#fff}
.btn.ghost-light{border-color:rgba(255,255,255,.4);color:#fff}.btn.ghost-light:hover{background:rgba(255,255,255,.12)}
.btn.sm{height:36px;padding:0 14px;font-size:14px}.btn.block{width:100%}
.arrow{display:inline-block;transition:transform .45s var(--ease)}a:hover .arrow,button:hover .arrow{transform:translateX(4px)}html[dir=rtl] .arrow{transform:scaleX(-1)}html[dir=rtl] a:hover .arrow{transform:scaleX(-1) translateX(4px)}
.link{display:inline-flex;align-items:center;gap:8px;font-size:15px;border-bottom:1px solid var(--line);padding-bottom:3px;transition:border-color .3s}.link:hover{border-color:var(--ink)}
.badge{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:500;background:color-mix(in oklab,var(--card) 92%,transparent);color:var(--ink);border:1px solid var(--line)}
.badge .dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}.badge.warn .dot{background:#B7791F}
.win{width:100%;height:40px;padding:0 12px;border-radius:calc(var(--r) - 2px);border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:15px;transition:border-color .2s,box-shadow .2s}
.win:focus{outline:none;border-color:color-mix(in oklab,var(--accent) 60%,var(--line));box-shadow:0 0 0 3px color-mix(in oklab,var(--accent) 18%,transparent)}
select.win{appearance:none;-webkit-appearance:none;padding-inline-end:34px;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-size:5px 5px;background-repeat:no-repeat;background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%}
html[dir=rtl] select.win{background-position:18px 50%,13px 50%}
textarea.win{height:96px;padding:10px 12px;resize:vertical}
/* the hero: a photograph that settles, words that rise */
.hero{position:relative;padding:72px 0 56px}
.hero .lead{max-width:560px;margin:22px 0 0;color:var(--ink2);font-size:clamp(17px,2vw,20px);line-height:1.6}
.hero h1{font-size:clamp(42px,7.2vw,96px);max-width:14ch}
.hero .acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:34px}
.hero.photo{display:flex;align-items:flex-end;min-height:min(94svh,880px);padding:140px 0 48px;color:#fff;overflow:hidden;isolation:isolate}
.hero.photo .bgimg{position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:cover;animation:settle 2.8s var(--ease) both}
.hero.photo::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(14,13,11,.45) 0%,rgba(14,13,11,0) 24%,rgba(14,13,11,.18) 50%,rgba(14,13,11,.78) 100%),linear-gradient(var(--side,90deg),rgba(14,13,11,.5) 0%,rgba(14,13,11,0) 62%)}
html[dir=rtl] .hero.photo{--side:270deg}.hero.photo h1,.hero.photo .lead{text-shadow:0 1px 28px rgba(0,0,0,.28)}
.hero.photo .lead{color:rgba(255,255,255,.86)}.hero.photo .eyebrow{color:rgba(255,255,255,.78)}
.hero .foot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:24px;margin-top:56px;padding-top:20px;border-top:1px solid color-mix(in oklab,currentColor 22%,transparent);font-size:14px;opacity:.85}
.hero .rise{animation:rise 1.1s var(--ease) both;animation-delay:calc(.25s + var(--i,0) * .12s)}
@keyframes settle{from{transform:scale(1.08);filter:saturate(.85)}to{transform:none;filter:none}}
@keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
/* sections */
section.wsec{padding:88px 0;border-top:1px solid var(--line)}@media (max-width:640px){section.wsec{padding:64px 0}}
main > section.wsec:first-child{border-top:0}
.sh{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:16px 32px;margin-bottom:44px}
.sh h2{font-size:clamp(30px,4.4vw,52px);margin-top:14px}
.wmuted{color:var(--ink2);max-width:680px}.wmuted p{margin:0 0 14px}
.about{display:grid;gap:28px 64px}@media (min-width:900px){.about{grid-template-columns:5fr 7fr}}
.about .body{font-family:var(--display);font-size:clamp(21px,2.4vw,28px);line-height:1.5;color:var(--ink)}.about .body p{margin:0 0 18px}html[lang=ar] .about .body{line-height:1.8}
/* property cards */
.lgrid{display:grid;gap:44px 28px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))}
.lc{display:flex;flex-direction:column;gap:16px}
.lc figure{position:relative;margin:0;aspect-ratio:4/5;border-radius:var(--r);overflow:hidden;background:var(--surface)}
.lc figure img{width:100%;height:100%;object-fit:cover;transition:transform 1.4s var(--ease)}
.lc:hover figure img{transform:scale(1.045)}
.lc figure .badge{position:absolute;top:14px;inset-inline-start:14px}
.lc .meta{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted)}
.lc h3{font-family:var(--display);font-weight:400;font-size:23px;line-height:1.25;margin:4px 0 0}html[lang=ar] .lc h3{line-height:1.5}
.lc h3 span{background:linear-gradient(currentColor,currentColor) no-repeat var(--from,0) 100%/0 1px;transition:background-size .5s var(--ease)}html[dir=rtl] .lc h3 span{--from:100%}.lc:hover h3 span{background-size:100% 1px}
.lc .row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-top:12px;border-top:1px solid var(--line)}
.lc .facts{font-size:14px;color:var(--ink2)}.lc .pr{font-size:17px;font-weight:600}.lc .pr small,.pr small{font-size:.72em;font-weight:500;color:var(--ink2)}
.more{display:flex;justify-content:center;margin-top:56px}
.wsearch{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 40px;padding:18px;border:1px solid var(--line);border-radius:var(--r);background:var(--card)}
.wsearch label{display:grid;gap:6px;color:var(--ink2);font-size:13px}.wsearch-actions{display:flex;align-items:end;gap:8px;grid-column:1/-1}.wsearch-actions .btn{height:40px}
.filters summary{list-style:none;cursor:pointer}.filters summary::-webkit-details-marker{display:none}
@media (min-width:768px){.filters summary{display:none}.filters:not([open]) > .wsearch{display:grid}}
@media (max-width:767px){.filters summary{display:inline-flex;margin-bottom:16px}}
.count{margin:0 0 28px;color:var(--muted);font-size:14px}
.wempty{padding:40px 24px;border:1px dashed var(--line);border-radius:var(--r);color:var(--ink2);text-align:center}
/* contact: the one dark band on the page */
.band{background:#1B1A17;color:#F1EDE5;border-top:0!important}html[data-dark] .band{background:var(--surface)}
.band .eyebrow{color:rgba(241,237,229,.6)}.band .eyebrow .idx{color:rgba(241,237,229,.85)}
.band h2{font-size:clamp(34px,5.6vw,72px);max-width:16ch}
.band .acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:36px}
.band .btn:not(.wa):not(.light){border-color:rgba(241,237,229,.28);color:#F1EDE5}.band .btn:not(.wa):not(.light):hover{background:rgba(241,237,229,.08)}
.band dl{display:grid;gap:24px;margin:64px 0 0;padding-top:28px;border-top:1px solid rgba(241,237,229,.16);grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.band dt{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(241,237,229,.55)}html[lang=ar] .band dt{letter-spacing:0;font-size:13px}
.band dd{margin:6px 0 0;font-size:17px}
/* other blocks */
.wgrid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))}
.wcard{display:flex;flex-direction:column;border-radius:var(--r);overflow:hidden;background:var(--card);border:1px solid var(--line)}
.wcard .bd{padding:20px;display:flex;flex-direction:column;gap:6px;flex:1}.wcard .tt{font-family:var(--display);font-size:20px}.wcard .mt{color:var(--ink2);font-size:15px}
.wcard .ph{aspect-ratio:4/3;background:var(--surface);overflow:hidden}.wcard .ph img{width:100%;height:100%;object-fit:cover}.wcard .pr{font-weight:600}
.wteam{display:grid;gap:28px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.wmember .av{display:grid;place-items:center;aspect-ratio:1;margin:0 0 14px;border-radius:var(--r);background:var(--surface);font-family:var(--display);font-size:34px;color:var(--ink2);overflow:hidden}.wmember .av img{width:100%;height:100%;object-fit:cover}.wmember b{display:block;font-weight:500}.wmember small{color:var(--muted)}
.wfaq{border-top:1px solid var(--line);max-width:820px}.wfaq details{border-bottom:1px solid var(--line)}.wfaq summary{display:flex;justify-content:space-between;gap:16px;padding:22px 0;font-family:var(--display);font-size:20px;cursor:pointer;list-style:none}.wfaq summary::-webkit-details-marker{display:none}
.wfaq summary::after{content:"+";color:var(--muted);transition:transform .35s var(--ease)}.wfaq details[open] summary::after{transform:rotate(45deg)}.wfaq p{margin:0;padding:0 0 22px;color:var(--ink2);max-width:680px}
.whours{list-style:none;margin:0;padding:0;max-width:480px}.whours li{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.whours span:last-child{color:var(--ink2)}
.wquote{margin:0;padding:28px;border-radius:var(--r);background:var(--card);border:1px solid var(--line)}.wquote p{margin:0 0 14px;font-family:var(--display);font-size:20px;line-height:1.5}.wquote small{color:var(--muted)}
.wgal{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}.wgal img{border-radius:var(--r);aspect-ratio:4/5;object-fit:cover;width:100%}
.wcontact{display:flex;flex-wrap:wrap;gap:10px}
/* a property */
.wdetail{padding:28px 0 96px}body.has-bar .wdetail{padding-bottom:140px}
.crumb{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--muted)}.crumb:hover{color:var(--ink)}html[dir=ltr] .crumb .arrow{transform:scaleX(-1)}html[dir=rtl] .crumb .arrow{transform:none}
.dhead{display:grid;gap:20px 48px;margin:28px 0 32px}@media (min-width:900px){.dhead{grid-template-columns:1fr auto;align-items:end}}
.dhead h1{font-size:clamp(34px,5.4vw,64px);margin-top:14px;max-width:18ch}
.dhead .where{margin:12px 0 0;color:var(--ink2);font-size:17px}
.dprice{text-align:start}@media (min-width:900px){.dprice{text-align:end}}.dprice .v{font-size:clamp(26px,3vw,36px);font-family:var(--display)}.dprice .badges{display:flex;gap:8px;margin-top:10px}@media (min-width:900px){.dprice .badges{justify-content:flex-end}}
.wphotos{display:grid;gap:10px;grid-template-columns:2fr 1fr 1fr;grid-template-rows:repeat(2,minmax(0,260px));margin:0 0 56px}
.wphotos button{padding:0;border:0;background:var(--surface);border-radius:var(--r);overflow:hidden;position:relative}
.wphotos button:first-child{grid-row:span 2}.wphotos img{width:100%;height:100%;object-fit:cover;transition:transform 1.4s var(--ease)}.wphotos button:hover img{transform:scale(1.03)}
.wphotos .all{position:absolute;bottom:14px;inset-inline-end:14px}
.wphotos.n1{grid-template-columns:1fr;grid-template-rows:minmax(0,560px)}.wphotos.n2,.wphotos.n3{grid-template-columns:2fr 1fr}.wphotos.n2 button:first-child{grid-row:span 2}
@media (max-width:767px){.wphotos,.wphotos.n1,.wphotos.n2,.wphotos.n3{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;margin-inline:-20px;padding-inline:20px;scrollbar-width:none}.wphotos::-webkit-scrollbar{display:none}.wphotos button{flex:0 0 86%;aspect-ratio:4/3;scroll-snap-align:center}.wphotos .all{display:none}}
.dgrid{display:grid;gap:56px}@media (min-width:1000px){.dgrid{grid-template-columns:minmax(0,1fr) 340px;gap:80px}}
.dfacts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin:0;border-top:1px solid var(--line)}
.dfacts div{padding:18px 0;border-bottom:1px solid var(--line)}.dfacts dt{font-size:13px;color:var(--muted)}.dfacts dd{margin:4px 0 0;font-size:18px;font-family:var(--display)}
.dblock{margin-top:56px}.dblock h2{font-size:clamp(24px,2.6vw,32px);margin:0 0 18px}
.wfeatures{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0;list-style:none}.wfeatures li{padding:6px 14px;border:1px solid var(--line);border-radius:999px;color:var(--ink2);font-size:14px}
.aside{position:sticky;top:96px;align-self:start;padding:28px;border:1px solid var(--line);border-radius:var(--r);background:var(--card);display:grid;gap:10px}
.aside .who{display:flex;align-items:center;gap:12px;padding-bottom:16px;margin-bottom:6px;border-bottom:1px solid var(--line)}.aside .who b{display:block;font-family:var(--display);font-size:19px;font-weight:400}.aside .who small{color:var(--muted)}
.aside .note{margin:6px 0 0;font-size:13px;color:var(--muted);text-align:center}
.mbar{display:none}@media (max-width:999px){.aside{display:none}body.has-bar .mbar{display:flex;position:fixed;inset-inline:0;bottom:0;z-index:25;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:color-mix(in oklab,var(--bg) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line)}.mbar .btn{flex:1}}
/* footer */
footer.wfoot{padding:64px 0 40px;border-top:1px solid var(--line);color:var(--ink2);font-size:14px}
footer.wfoot .top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px;align-items:end;padding-bottom:40px}
footer.wfoot .name{font-family:var(--display);font-size:clamp(28px,4vw,44px);color:var(--ink);line-height:1.2}
footer.wfoot .bot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px 24px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
footer.wfoot a:hover{color:var(--ink)}
/* dialogs: the inquiry and the photographs */
dialog{border:0;padding:0;color:var(--ink);background:var(--card);opacity:1;transform:none;transition:opacity .3s var(--ease),transform .3s var(--ease),overlay .3s allow-discrete,display .3s allow-discrete}
dialog::backdrop{background:rgba(14,13,11,.55);backdrop-filter:blur(4px);opacity:1;transition:opacity .3s,overlay .3s allow-discrete,display .3s allow-discrete}
@starting-style{dialog[open]{opacity:0;transform:translateY(12px) scale(.985)}dialog[open]::backdrop{opacity:0}}
dialog#inq{width:min(480px,calc(100vw - 32px));border-radius:calc(var(--r) + 6px);box-shadow:0 40px 90px -40px rgba(0,0,0,.55)}
dialog#inq .body{padding:28px}dialog#inq h3{margin:0 0 6px;font-family:var(--display);font-weight:400;font-size:28px}dialog#inq p{margin:0 0 6px;color:var(--ink2)}
.wfield{display:grid;gap:6px;margin-top:16px;font-size:14px;color:var(--ink2)}
.werr{margin-top:12px;color:#B42318;font-size:14px;min-height:1em}.wrow{display:flex;gap:10px;margin-top:20px}.wrow .btn{flex:1}
.wdone{text-align:center;padding:12px 0}.wdone .ok{display:grid;place-items:center;width:56px;height:56px;margin:0 auto 16px;border-radius:50%;border:1px solid var(--line);color:var(--wa)}
dialog#lb{width:100vw;height:100dvh;max-width:none;max-height:none;background:rgba(14,13,11,.96);color:#fff}
#lb .stage{display:grid;place-items:center;height:100%;padding:64px 16px}#lb img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px}
#lb .ctl{position:absolute;display:grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:#fff}
html[dir=rtl] #lb .pv svg,html[dir=rtl] #lb .nx svg{transform:scaleX(-1)}
#lb .x{top:16px;inset-inline-end:16px}#lb .pv{top:50%;inset-inline-start:16px}#lb .nx{top:50%;inset-inline-end:16px}#lb .n{position:absolute;top:26px;inset-inline-start:24px;font-size:13px;opacity:.75}
.wnot{min-height:80dvh;display:grid;place-items:center;text-align:center;padding:40px 20px}.wnot h1{font-size:clamp(32px,5vw,52px)}.wnot p{color:var(--ink2);max-width:440px;margin:14px auto 28px}
/* reveal as it scrolls in (only when the script runs: without it, everything is simply there) */
html.js .rv{opacity:0;transform:translateY(18px);transition:opacity 1s var(--ease),transform 1s var(--ease);transition-delay:calc(var(--i,0) * 80ms)}
html.js .rv.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}html.js .rv{opacity:1;transform:none}@view-transition{navigation:none}}`;
}

/** Header, reveal-on-scroll and the photo viewer: one small script, no library. */
export const SITE_SCRIPT = `(function(){var h=document.querySelector('header.wtop');
if(h){var f=function(){h.classList.toggle('is-stuck',scrollY>24)};f();addEventListener('scroll',f,{passive:true})}
var els=document.querySelectorAll('.rv');if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(e){io.observe(e)})}else els.forEach(function(e){e.classList.add('in')});
var lb=document.getElementById('lb');if(!lb)return;var urls=[].map.call(document.querySelectorAll('[data-photo]'),function(b){return b.getAttribute('data-photo')}),i=0,img=lb.querySelector('img'),n=lb.querySelector('.n');
function show(k){i=(k+urls.length)%urls.length;img.src=urls[i];n.textContent=(i+1)+' / '+urls.length}
[].forEach.call(document.querySelectorAll('[data-photo]'),function(b,k){b.addEventListener('click',function(){show(k);lb.showModal()})});
lb.querySelector('.x').addEventListener('click',function(){lb.close()});var rtl=document.dir==='rtl';
lb.querySelector('.pv').addEventListener('click',function(){show(i-1)});lb.querySelector('.nx').addEventListener('click',function(){show(i+1)});
lb.addEventListener('keydown',function(e){if(e.key==='ArrowRight')show(rtl?i-1:i+1);if(e.key==='ArrowLeft')show(rtl?i+1:i-1)})})();`;

/** The page frame: head (title, description, canonical, alternates, Open Graph, JSON-LD), the stylesheet, the body. */
export function webFrame(o: { lang: Lang; title: string; description: string; canonical?: string; alt?: string; image?: string | null; robots: 'index' | 'noindex'; theme: WebTheme; body: string; bodyClass?: string; script?: string; jsonld?: unknown }) {
  const dir = o.lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${o.lang}" dir="${dir}"${o.theme.dark ? ' data-dark' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<script>document.documentElement.classList.add('js')</script>
<title>${esc(o.title)}</title><meta name="description" content="${attr(o.description)}"><meta name="robots" content="${o.robots === 'index' ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}">
${o.canonical ? `<link rel="canonical" href="${attr(o.canonical)}">` : ''}${o.alt ? `<link rel="alternate" hreflang="${o.lang === 'ar' ? 'en' : 'ar'}" href="${attr(o.alt)}">` : ''}
<meta name="theme-color" content="${o.theme.dark ? '#12110F' : '#F6F4EF'}">
<meta property="og:type" content="website"><meta property="og:title" content="${attr(o.title)}"><meta property="og:description" content="${attr(o.description)}">
${o.canonical ? `<meta property="og:url" content="${attr(o.canonical)}">` : ''}${o.image ? `<meta property="og:image" content="${attr(o.image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta property="og:locale" content="${o.lang === 'ar' ? 'ar_IQ' : 'en_US'}">
<style>${themeCss(o.theme)}</style>${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, '\\u003c')}</script>` : ''}</head>
<body${o.bodyClass ? ` class="${attr(o.bodyClass)}"` : ''}>${o.body}<script>${SITE_SCRIPT}</script>${o.script ? `<script>${o.script}</script>` : ''}</body></html>`;
}

export const waHref = (num: string | null | undefined, text: string) => (num ? `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : null);
export const telHref = (num: string | null | undefined) => (num ? `tel:${num.replace(/[^\d+]/g, '')}` : null);
export const moneyIqd = (n: number, lang: Lang) => `${new Intl.NumberFormat('en-US').format(n)} <small>${lang === 'ar' ? 'د.ع' : 'IQD'}</small>`;

export { esc, attr, icon, fill };

/** Only the sections that carry words render a heading; the label falls back to the section's own title. */
export function sectionHeading(type: string, title: Two | undefined, lang: Lang) {
  return pick(title, lang) || pick({ ar: W.ar[SECTION_LABEL[type] ?? 'about'], en: W.en[SECTION_LABEL[type] ?? 'about'] }, lang);
}

export const INQUIRY_SCRIPT = (S: Record<string, unknown>) => `(function(){var S=${JSON.stringify(S).replace(/</g, '\\u003c')};
var d=document.getElementById('inq');if(!d)return;
function open(e){if(e)e.preventDefault();if(d.showModal)d.showModal();else d.setAttribute('open','')}
[].forEach.call(document.querySelectorAll('[data-inquire]'),function(b){b.addEventListener('click',open)});
[].forEach.call(document.querySelectorAll('[data-close]',d),function(b){b.addEventListener('click',function(){d.close()})});
var f=d.querySelector('form');if(!f)return;
f.addEventListener('submit',function(e){e.preventDefault();var err=d.querySelector('.werr'),btn=f.querySelector('button[type=submit]');
err.textContent='';var el=function(n){var x=f.querySelector('[name='+n+']');return x?x.value:''};
var ph=el('phone').replace(/[^0-9+]/g,'');if(ph.replace(/\\D/g,'').length<7){err.textContent=S.badPhone;return}
btn.disabled=true;btn.textContent=S.sending;
fetch(S.endpoint||'inquiry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:el('name'),phone:el('phone'),email:el('email'),message:el('message'),page:S.page,propertySlug:S.propertySlug||undefined,hp:el('website')})})
.then(function(r){return r.json().then(function(j){if(!r.ok)throw j;return j})})
.then(function(){d.querySelector('.wform').hidden=true;d.querySelector('.wdone').hidden=false})
.catch(function(j){err.textContent=(j&&j.error==='BAD_PHONE')?S.badPhone:S.failed;btn.disabled=false;btn.textContent=S.send})})})();`;

export function inquiryDialog(lang: Lang, who: string) {
  const t = W[lang];
  return `<dialog id="inq"><div class="body"><div class="wform"><h3>${t.inquire}</h3><p>${esc(fill(lang === 'ar' ? 'اترك بياناتك وسيتواصل معك {who}.' : 'Leave your details and {who} will be in touch.', { who }))}</p>
<form novalidate><label class="wfield">${t.name}<input class="win" name="name" autocomplete="name" required maxlength="80"></label>
<label class="wfield">${t.phone}<input class="win" name="phone" type="tel" inputmode="tel" dir="ltr" required maxlength="20" placeholder="07xx xxx xxxx"></label>
<label class="wfield">${t.email}<input class="win" name="email" type="email" dir="ltr" maxlength="120"></label>
<label class="wfield">${t.message}<textarea class="win" name="message" maxlength="1000"></textarea></label>
<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="werr" role="alert"></div><div class="wrow"><button class="btn primary" type="submit">${t.send}</button><button class="btn" type="button" data-close>${t.close}</button></div></form></div>
<div class="wdone" hidden><div class="ok">${icon('check', 'ic')}</div><h3>${t.sent}</h3><p>${t.sentSub}</p><div class="wrow"><button class="btn" type="button" data-close>${t.close}</button></div></div>
</div></dialog>`;
}
