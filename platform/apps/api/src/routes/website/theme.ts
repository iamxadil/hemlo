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
  },
} as const;

const SECTION_LABEL: Record<string, keyof (typeof W)['ar']> = {
  about: 'about', services: 'services', products: 'products', listings: 'listings',
  gallery: 'gallery', team: 'team', faq: 'faq', hours: 'hours', testimonials: 'testimonials', contact: 'contact',
};

export const PRESET_ACCENT: Record<string, string> = { classic: '#1F5F4A', modern: '#0EA5E9', minimal: '#111827', bold: '#E11D48' };
const FONTS: Record<string, string> = {
  system: 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif',
  sans: '"Segoe UI",system-ui,-apple-system,"Noto Sans Arabic",sans-serif',
  serif: 'Georgia,"Times New Roman","Noto Naskh Arabic",serif',
};

export const accentOf = (theme: WebTheme) => theme.accent || PRESET_ACCENT[theme.preset ?? 'classic'] || PRESET_ACCENT.classic;

/** The whole stylesheet, parameterised by the business's few allowed choices. */
export function themeCss(theme: WebTheme): string {
  const accent = accentOf(theme);
  const r = theme.radius === 'sm' ? '10px' : theme.radius === 'lg' ? '24px' : '16px';
  const font = FONTS[theme.font ?? 'system'] ?? FONTS.system;
  return `:root{--bg:#ffffff;--surface:#f7f7f5;--ink:#14181f;--ink2:#4a5160;--muted:#7a808c;--line:#e6e4de;--accent:${accent};--wa:#1fa855;--r:${r};--font:${font};color-scheme:light}
html[data-dark]{--bg:#0e1116;--surface:#161a21;--ink:#f1eee8;--ink2:#c3c7cf;--muted:#8d94a0;--line:#262c36;color-scheme:dark}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}img{display:block;max-width:100%}button{font:inherit;color:inherit;cursor:pointer}
.wwrap{width:100%;max-width:1080px;margin:0 auto;padding:0 20px}
.ic{width:20px;height:20px;flex:none}.num{font-variant-numeric:tabular-nums}
header.wtop{position:sticky;top:0;z-index:20;background:color-mix(in oklab,var(--bg) 88%,transparent);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border-bottom:1px solid var(--line)}
header.wtop .wwrap{display:flex;align-items:center;gap:14px;height:62px}
.wbrand{display:flex;align-items:center;gap:10px;font-weight:700;min-width:0}
.wbrand img{width:36px;height:36px;border-radius:10px;object-fit:cover}.wbrand .mono{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--accent);color:#fff;font-size:15px}
.wbrand span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wnav{margin-inline-start:auto;display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none}.wnav::-webkit-scrollbar{display:none}
.wnav a{padding:8px 12px;border-radius:999px;font-size:15px;white-space:nowrap;color:var(--ink2)}.wnav a:hover{background:var(--surface);color:var(--ink)}
.wchip{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);font-size:14px;white-space:nowrap}
.hero{padding:64px 0 40px;text-align:center}.hero h1{margin:0 0 14px;font-size:clamp(30px,6vw,52px);line-height:1.15;font-weight:700;letter-spacing:-.02em}html[lang=ar] .hero h1{letter-spacing:0;line-height:1.3}
.hero p{margin:0 auto;max-width:640px;color:var(--ink2);font-size:clamp(16px,2.4vw,20px)}
.wcta{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:26px}
section.wsec{padding:48px 0;border-top:1px solid var(--line)}section.wsec:first-of-type{border-top:0}
.wsec h2{margin:0 0 22px;font-size:clamp(22px,3.6vw,30px);font-weight:700;letter-spacing:-.01em}
.wmuted{color:var(--ink2);max-width:720px}.wmuted p{margin:0 0 12px}
.wgrid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.wcard{display:flex;flex-direction:column;border-radius:var(--r);overflow:hidden;background:var(--bg);border:1px solid var(--line);transition:transform .25s cubic-bezier(.2,0,0,1),box-shadow .25s}
.wcard:hover{transform:translateY(-2px);box-shadow:0 24px 50px -38px rgba(20,24,31,.5)}
.wcard .ph{aspect-ratio:4/3;background:var(--surface);overflow:hidden}.wcard .ph img{width:100%;height:100%;object-fit:cover}
.wcard .bd{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
.wcard .tt{font-weight:600}.wcard .pr{font-size:19px;font-weight:700}.wcard .pr small{font-size:.6em;color:var(--ink2);font-weight:500}
.wcard .mt{color:var(--muted);font-size:14px;display:flex;gap:12px;flex-wrap:wrap}
.wcard .bd .btn{margin-top:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 22px;border-radius:14px;border:1px solid var(--line);background:var(--bg);font-weight:600;font-size:16px;transition:transform .15s,filter .2s}
.btn:active{transform:scale(.98)}.btn.wa{background:var(--wa);border-color:var(--wa);color:#fff}.btn.wa:hover{filter:brightness(1.05)}
.btn.dark{background:var(--ink);border-color:var(--ink);color:var(--bg)}.btn.accent{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.sm{height:40px;padding:0 16px;font-size:14px;border-radius:12px}
.wteam{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.wmember{text-align:center}.wmember .av{display:grid;place-items:center;width:84px;height:84px;margin:0 auto 12px;border-radius:50%;background:var(--surface);font-size:26px;font-weight:700;color:var(--ink2);overflow:hidden}.wmember .av img{width:100%;height:100%;object-fit:cover}.wmember b{display:block}.wmember small{color:var(--muted)}
.wfaq{border:1px solid var(--line);border-radius:var(--r);overflow:hidden}.wfaq details{border-bottom:1px solid var(--line)}.wfaq details:last-child{border-bottom:0}.wfaq summary{padding:16px 18px;font-weight:600;cursor:pointer}.wfaq p{margin:0;padding:0 18px 16px;color:var(--ink2)}
.whours{list-style:none;margin:0;padding:0;max-width:420px}.whours li{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line)}.whours span:last-child{color:var(--ink2)}
.wquote{padding:22px;border-radius:var(--r);background:var(--surface)}.wquote p{margin:0 0 10px;font-size:17px}.wquote small{color:var(--muted)}
.wgal{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}.wgal img{border-radius:12px;aspect-ratio:1;object-fit:cover}
.wcontact{display:flex;flex-wrap:wrap;gap:12px}.wcontact a{display:inline-flex;align-items:center;gap:8px;color:var(--ink2)}
footer.wfoot{padding:36px 0 48px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
footer.wfoot .wwrap{display:flex;flex-wrap:wrap;gap:10px 20px;justify-content:space-between;align-items:center}
footer.wfoot a{text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}
dialog#inq{width:min(460px,calc(100vw - 32px));border:0;border-radius:22px;padding:0;background:var(--bg);color:var(--ink);box-shadow:0 40px 80px -30px rgba(0,0,0,.5)}dialog#inq::backdrop{background:rgba(10,12,16,.5)}
dialog#inq .body{padding:24px}dialog#inq h3{margin:0 0 4px;font-size:21px}dialog#inq p{margin:0 0 6px;color:var(--ink2)}
.wfield{display:grid;gap:6px;margin-top:14px;font-size:14px;color:var(--ink2)}
.win{width:100%;height:48px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:16px}
textarea.win{height:90px;padding:12px 14px;resize:vertical}.win:focus{outline:2px solid var(--accent);outline-offset:1px}
.werr{margin-top:10px;color:#c2334a;font-size:14px;min-height:1em}.wrow{display:flex;gap:10px;margin-top:18px}.wrow .btn{flex:1}
.wdone{text-align:center;padding:10px 0}.wdone .ok{display:grid;place-items:center;width:60px;height:60px;margin:0 auto 12px;border-radius:50%;background:color-mix(in oklab,var(--wa) 16%,transparent);color:var(--wa)}
.wnot{min-height:70dvh;display:grid;place-items:center;text-align:center;padding:40px 20px}.wnot h1{font-size:28px}.wnot p{color:var(--ink2);max-width:440px;margin:8px auto 20px}
.wsearch{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 22px;padding:16px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}.wsearch label{display:grid;gap:5px;color:var(--ink2);font-size:13px}.wsearch .win{background:var(--bg)}.wsearch-actions{display:flex;align-items:end;gap:8px;grid-column:1/-1}.wsearch-actions .btn{height:44px}.wempty{padding:24px;border-radius:var(--r);background:var(--surface);color:var(--ink2);text-align:center}
.wdetail{padding:32px 0 52px}.wdetail h1{font-size:clamp(25px,5vw,42px);line-height:1.2;margin:10px 0}.wphotos{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin:22px 0}.wphotos img{width:100%;height:100%;max-height:520px;object-fit:cover;border-radius:var(--r);background:var(--surface)}.wphotos img:not(:first-child){max-height:255px}.wfacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:22px 0}.wfacts div{padding:14px;border:1px solid var(--line);border-radius:14px}.wfacts small{display:block;color:var(--muted)}.wfacts b{display:block;margin-top:3px}.wstatus{display:inline-flex;border-radius:999px;padding:5px 11px;background:var(--surface);font-size:13px;color:var(--ink2)}.wfeatures{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}.wfeatures li{padding:7px 11px;border:1px solid var(--line);border-radius:999px;color:var(--ink2);font-size:14px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;
}

/** The page frame: head (title, description, canonical, alternates, Open Graph, JSON-LD), the stylesheet, the body. */
export function webFrame(o: { lang: Lang; title: string; description: string; canonical?: string; alt?: string; image?: string | null; robots: 'index' | 'noindex'; theme: WebTheme; body: string; script?: string; jsonld?: unknown }) {
  const dir = o.lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${o.lang}" dir="${dir}"${o.theme.dark ? ' data-dark' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)}</title><meta name="description" content="${attr(o.description)}"><meta name="robots" content="${o.robots === 'index' ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}">
${o.canonical ? `<link rel="canonical" href="${attr(o.canonical)}">` : ''}${o.alt ? `<link rel="alternate" hreflang="${o.lang === 'ar' ? 'en' : 'ar'}" href="${attr(o.alt)}">` : ''}
<meta name="theme-color" content="${attr(accentOf(o.theme))}">
<meta property="og:type" content="website"><meta property="og:title" content="${attr(o.title)}"><meta property="og:description" content="${attr(o.description)}">
${o.canonical ? `<meta property="og:url" content="${attr(o.canonical)}">` : ''}${o.image ? `<meta property="og:image" content="${attr(o.image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta property="og:locale" content="${o.lang === 'ar' ? 'ar_IQ' : 'en_US'}">
<style>${themeCss(o.theme)}</style>${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, '\\u003c')}</script>` : ''}</head>
<body>${o.body}${o.script ? `<script>${o.script}</script>` : ''}</body></html>`;
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
<div class="werr" role="alert"></div><div class="wrow"><button class="btn accent" type="submit">${t.send}</button><button class="btn" type="button" data-close>${t.close}</button></div></form></div>
<div class="wdone" hidden><div class="ok">${icon('check', 'ic')}</div><h3>${t.sent}</h3><p>${t.sentSub}</p><div class="wrow"><button class="btn" type="button" data-close>${t.close}</button></div></div>
</div></dialog>`;
}
