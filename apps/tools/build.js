// Hemlo Tools build: node build.js
//   dist/          the site for tools.hemlohq.com (each tool = one inlined, minified index.html, plus shared fonts/icons,
//                  a service worker for offline use, a web-app manifest, a hub page, robots.txt and sitemap.xml)
//   dist-offline/  one self-contained .html per tool (fonts and images embedded) to share on WhatsApp or a USB stick
// Needs Node 18+ and uses esbuild through npx for minifying (no project dependencies).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = __dirname, DIST = path.join(ROOT, 'dist'), OFF = path.join(ROOT, 'dist-offline'), SHARED = path.join(ROOT, 'shared');
const ORIGIN = 'https://tools.hemlohq.com';
const TOOLS = fs.readdirSync(ROOT).filter(d => !/^(dist|dist-offline|shared|node_modules)$/.test(d) && fs.existsSync(path.join(ROOT, d, 'index.html')) && fs.existsSync(path.join(ROOT, d, 'app.js')));
const TOOL_INFO = {
  'invoice-maker': { ar: 'صانع الفواتير وعروض الأسعار', en: 'Invoice & quotation maker', arDesc: 'فاتورة أو عرض سعر احترافي بالدينار أو الدولار، مع التفقيط، PDF وواتساب.', enDesc: 'Professional invoices and quotes in IQD or USD, with the amount in words.' },
  'repair-receipt': { ar: 'وصل التصليح وكارت الضمان', en: 'Repair receipt & warranty card', arDesc: 'وصل استلام تصليح وكارت ضمان، على ورق A5 أو طابعة 80 مم حرارية، مع تفقيط المبلغ وواتساب.', enDesc: 'A repair receipt and warranty card, on A5 or an 80 mm thermal printer, with the amount in words.' },
};
const COMING = [
  { ar: 'حاسبة الراتب والضمان', en: 'Salary & social-security calculator' },
  { ar: 'حاسبة كلفة الاستيراد', en: 'Import landed-cost estimator' },
];

// ---------- starter kits: a shop's first rows, ready to import into Hemlo Systems ----------
// Column order must match the importer's FIELDS exactly (Importer.tsx): name, barcode, price, cost, stock,
// category, unit, lowStock, packSize, packBarcode, packPrice. Arabic headers and a BOM are recognised, and
// `unit` is mapped through its UNIT_WORDS table (كغ -> kg, قطعة -> piece). Prices are plain example figures in IQD,
// not quoted market prices: the point is a correct shape the shopkeeper edits, never a claim about the real market.
// Barcodes are left empty on purpose. Inventing valid EANs would either collide with a real product or need a made-up
// company prefix, and a wrong barcode on a shelf is worse than none.
const STARTER_PRODUCTS = [
  ['مواد غذائية', [['أرز سايب', 1750, 1400, 50, 'كغ', 10], ['سكر ناعم', 1250, 950, 40, 'كغ', 10], ['زيت طعام 1.8 لتر', 3250, 2750, 24, 'قطعة', 6],
    ['معجون أسنان', 1750, 1150, 36, 'قطعة', 12], ['شاي 250 غ', 2250, 1650, 30, 'قطعة', 8], ['ملح طعام', 500, 300, 60, 'كغ', 15],
    ['أرز بسمتي 5 كغ', 6500, 5250, 12, 'كيس', 4], ['عدس', 1400, 1000, 45, 'كغ', 10], ['فول مجروش', 1200, 850, 40, 'كغ', 10]]],
  ['مشروبات', [['بيبسي 330 مل', 500, 375, 48, 'قطعة', 12], ['كوكا كولا 330 مل', 500, 375, 48, 'قطعة', 12],
    ['عصير برتقال 1 لتر', 1000, 700, 24, 'قطعة', 6], ['ماء 1.5 لتر', 500, 350, 36, 'قطعة', 12]]],
  ['منظفات', [['مسحوق غسيل 3 كغ', 6750, 5200, 18, 'كيس', 4], ['سائل جلي 1 لتر', 1750, 1150, 30, 'قطعة', 8],
    ['منظف أرضيات 1 لتر', 2250, 1550, 24, 'قطعة', 6], ['معقم أطباق 900 مل', 1250, 800, 30, 'قطعة', 8]]],
  ['حلويات', [['شوكولاتة', 1000, 700, 60, 'قطعة', 15], ['بسكويت', 500, 300, 80, 'قطعة', 20], ['علكة', 250, 150, 100, 'قطعة', 25]]],
];
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const STARTER_HEAD = ['الاسم', 'الباركود', 'سعر البيع', 'سعر الشراء', 'الكمية', 'القسم', 'الوحدة', 'حد التنبيه', 'عدد القطع بالكرتونة', 'باركود الكرتونة', 'سعر الكرتونة'];
const starterRows = [
  STARTER_HEAD,
  ...STARTER_PRODUCTS.flatMap(([cat, items]) => items.map(([name, price, cost, stock, unit, low]) => [name, '', price, cost, stock, cat, unit, low, '', '', ''])),
];

const read = p => fs.readFileSync(p, 'utf8');
const rmrf = p => fs.rmSync(p, { recursive: true, force: true });
const mkdir = p => fs.mkdirSync(p, { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function minify(code, loader) {
  return execFileSync(npx, ['--yes', 'esbuild@0.28', `--loader=${loader}`, '--minify', '--target=es2020'], { input: code, encoding: 'utf8', shell: process.platform === 'win32', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const dataURI = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

rmrf(DIST); rmrf(OFF); mkdir(DIST); mkdir(OFF);

// ---------- shared assets ----------
mkdir(path.join(DIST, 'shared/fonts'));
for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'hemlo-mark.svg', 'hemlo-tools.svg']) fs.copyFileSync(path.join(SHARED, f), path.join(DIST, 'shared', f));
for (const f of fs.readdirSync(path.join(SHARED, 'fonts'))) fs.copyFileSync(path.join(SHARED, 'fonts', f), path.join(DIST, 'shared/fonts', f));
for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  const src = path.join(ROOT, '../../brand/icons', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, 'shared', f));
}
const fontsCSS = read(path.join(SHARED, 'fonts.css'));
const tafqit = minify(read(path.join(SHARED, 'tafqit.js')), 'js');

// the starter kit: a plain file the importer reads directly, served next to the tools it belongs to
fs.writeFileSync(path.join(DIST, 'products-starter.csv'), csv(starterRows));

// ---------- each tool ----------
const sizes = [];
for (const tool of TOOLS) {
  const dir = path.join(ROOT, tool);
  let html = read(path.join(dir, 'index.html'));
  const css = minify(fontsCSS.replace(/url\(fonts\//g, 'url(/shared/fonts/') + '\n' + read(path.join(dir, 'styles.css')), 'css');
  const app = minify(read(path.join(dir, 'app.js')), 'js').replace(/\.\.\/shared\//g, '/shared/');

  html = html
    .replace(/<link rel="stylesheet" href="\.\.\/shared\/fonts\.css">\s*<link rel="stylesheet" href="styles\.css">/, `<style>${css}</style>`)
    .replace(/<script src="\.\.\/shared\/tafqit\.js"><\/script>\s*<script src="app\.js"><\/script>/, `<script>${tafqit}\n${app}</script>`)
    .replace(/\.\.\/shared\//g, '/shared/')
    .replace('../manifest.webmanifest', '/manifest.webmanifest')
    .replace(/^\s+/gm, '').replace(/<!--(?!\[)[\s\S]*?-->/g, '');
  if (/href="styles\.css"|src="app\.js"/.test(html)) throw new Error(`${tool}: inlining failed`);
  mkdir(path.join(DIST, tool));
  fs.writeFileSync(path.join(DIST, tool, 'index.html'), html);
  for (const extra of ['og.png']) if (fs.existsSync(path.join(dir, extra))) fs.copyFileSync(path.join(dir, extra), path.join(DIST, tool, extra));
  sizes.push([`${tool}/index.html`, Buffer.byteLength(html)]);

  // offline copy: fonts and images embedded, no service worker, no external links
  const offCSS = minify(fontsCSS
    .replace('url(fonts/vazirmatn-arabic.woff2)', `url(${dataURI(path.join(SHARED, 'fonts/vazirmatn-arabic.woff2'), 'font/woff2')})`)
    .replace('url(fonts/readex-pro-latin.woff2)', `url(${dataURI(path.join(SHARED, 'fonts/readex-pro-latin.woff2'), 'font/woff2')})`) + '\n' + read(path.join(dir, 'styles.css')), 'css');
  const mark = dataURI(path.join(SHARED, 'hemlo-mark.svg'), 'image/svg+xml'), toolsLogo = dataURI(path.join(SHARED, 'hemlo-tools.svg'), 'image/svg+xml'), fav = dataURI(path.join(SHARED, 'favicon.svg'), 'image/svg+xml');
  let off = read(path.join(dir, 'index.html'))
    .replace(/<link rel="preload"[^>]*>\s*/g, '').replace(/<link rel="manifest"[^>]*>\s*/, '').replace(/<link rel="(apple-touch-icon|icon)"[^>]*>\s*/g, '')
    .replace('<meta name="theme-color"', `<link rel="icon" href="${fav}" type="image/svg+xml">\n<meta name="theme-color"`)
    .replace(/<link rel="stylesheet" href="\.\.\/shared\/fonts\.css">\s*<link rel="stylesheet" href="styles\.css">/, `<style>${offCSS}</style>`)
    .replace(/<script src="\.\.\/shared\/tafqit\.js"><\/script>\s*<script src="app\.js"><\/script>/, `<script>${tafqit}\n${minify(read(path.join(dir, 'app.js')), 'js').replace(/\.\.\/shared\/hemlo-mark\.svg/g, mark)}</script>`)
    .replace(/src="\.\.\/shared\/hemlo-tools\.svg"/, `src="${toolsLogo}"`)
    .replace(/^\s+/gm, '');
  fs.writeFileSync(path.join(OFF, `hemlo-${tool}.html`), off);
  sizes.push([`dist-offline/hemlo-${tool}.html`, Buffer.byteLength(off)]);
}

// ---------- hub page (tools.hemlohq.com) ----------
const hubCSS = minify(fontsCSS.replace(/url\(fonts\//g, 'url(/shared/fonts/') + `
:root{--bg:#FAFAF7;--tile:#F1F0EB;--ink:#0E1420;--ink2:#3A4252;--muted:#6B7280;--rule:#E3E1DA;--accent:#3B5BC4}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:"Vazirmatn","Readex Pro",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.w{max-width:960px;margin:0 auto;padding-inline:max(20px,env(safe-area-inset-left))}
header{padding:18px 0;border-bottom:1px solid var(--rule)}
header img{height:34px;display:block}
.hdr{display:flex;align-items:center;justify-content:space-between;gap:16px}
.lang{border:1px solid var(--rule);background:#fff;color:var(--ink2);border-radius:999px;padding:8px 16px;font:600 13px/1 "Readex Pro",sans-serif;cursor:pointer;transition:border-color .18s,color .18s}
.lang:hover{border-color:var(--accent);color:var(--accent)}
.hero{padding:clamp(48px,9vw,96px) 0 clamp(32px,6vw,56px);text-align:center}
h1{font-weight:700;font-size:clamp(34px,6vw,58px);letter-spacing:-.02em;line-height:1.15}
.hero p{font-size:clamp(17px,2vw,21px);color:var(--ink2);margin-top:12px}
html[lang="en"] body{font-family:"Readex Pro","Vazirmatn",system-ui,sans-serif}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding-bottom:80px}
a.card,.card{display:block;border-radius:22px;padding:26px;background:var(--tile);text-decoration:none;color:inherit;min-height:170px;position:relative;transition:transform .2s cubic-bezier(.2,0,0,1)}
a.card{background:#EEF1FB}
a.card:hover{transform:translateY(-2px)}
.card h2{font-size:22px;font-weight:600;line-height:1.3}
.card p{font-size:15px;color:var(--ink2);margin-top:12px;line-height:1.6}
.tag{display:inline-block;margin-bottom:12px;font-size:12px;font-weight:600;border-radius:999px;padding:4px 10px;background:#fff;color:var(--accent)}
.card.soon{opacity:.7}.card.soon .tag{color:var(--muted)}
footer{border-top:1px solid var(--rule);padding:22px 0 36px;font-size:13px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
footer a{color:inherit}
.fit{display:grid;gap:26px;margin:0 0 34px;padding:28px;border-radius:22px;background:#EEF1FB}
.fit .l{font-size:14px;font-weight:600;color:var(--accent)}
.fit .b{font-size:19px;font-weight:500;line-height:1.5;margin-top:8px}
.fit ul{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}
.fit li{display:flex;gap:10px;align-items:flex-start;line-height:1.55}
.fit li i{flex:none;display:grid;place-items:center;width:22px;height:22px;margin-top:2px;border-radius:999px;background:var(--accent);color:#fff;font-style:normal;font-size:11px;font-weight:700}
.fit p.n{margin-top:8px;color:var(--ink2);line-height:1.6}
.fit a{color:var(--accent);font-weight:600}
.kit{margin:0 0 34px;padding:26px;border-radius:22px;background:var(--tile);display:flex;gap:22px;align-items:center;flex-wrap:wrap}
.kit .k{flex:1 1 320px}
.kit h2{font-size:20px;font-weight:600;line-height:1.35}
.kit p{font-size:15px;color:var(--ink2);margin-top:8px;line-height:1.6}
.btn{display:inline-block;flex:none;border-radius:999px;padding:13px 26px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;font-size:15px;transition:filter .18s,transform .18s}
.btn:hover{filter:brightness(1.08)}
.btn:active{transform:translateY(1px)}
@media (min-width:900px){.fit{grid-template-columns:1.1fr 1.2fr 1fr;gap:34px;padding:34px}.fit>div:last-child{padding-right:30px;border-right:1px solid rgba(59,91,196,.2)}}
html[lang="en"] .fit>div:last-child{padding-right:0;padding-left:30px;border-right:0;border-left:1px solid rgba(59,91,196,.2)}
@media (max-width:640px){.grid{grid-template-columns:1fr}}`, 'css');
const hub = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>أدوات هيملو المجانية · Hemlo Tools</title>
<meta name="description" id="desc" content="أدوات مجانية لعمل الشركات والمحلات في العراق: فواتير وعروض أسعار بالدينار، والمزيد قريباً. بدون تسجيل. Free tools for Iraqi businesses.">
<link rel="canonical" href="${ORIGIN}/"><meta name="theme-color" content="#FAFAF7">
<link rel="icon" href="/shared/favicon.ico" sizes="32x32"><link rel="icon" href="/shared/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/shared/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<meta property="og:title" content="أدوات هيملو المجانية · Hemlo Tools"><meta property="og:image" content="${ORIGIN}/invoice-maker/og.png">
<link rel="preload" href="/shared/fonts/vazirmatn-arabic.woff2" as="font" type="font/woff2" crossorigin>
<style>${hubCSS}</style>
<script>try{var l=localStorage.getItem('hemlo.uiLang');if(new URLSearchParams(location.search).get('lang')==='en'||l==='en')document.documentElement.lang='en',document.documentElement.dir='ltr'}catch(e){}</script>
</head><body>
<header><div class="w hdr"><a href="https://hemlohq.com" aria-label="Hemlo"><img src="/shared/hemlo-tools.svg" alt="Hemlo Tools" height="34"></a><button class="lang" id="lang" type="button">EN</button></div></header>
<main class="w"><section class="hero"><h1 data-ar="أدوات مجانية لعملك" data-en="Free tools for your business">أدوات مجانية لعملك</h1><p data-ar="بدون تسجيل، وبياناتك تبقى على جهازك." data-en="No sign-up. Your data stays on your device.">بدون تسجيل، وبياناتك تبقى على جهازك.</p></section>
<section class="fit">
<div><div class="l" data-ar="ما هي؟" data-en="What it is">ما هي؟</div><p class="b" data-ar="أدوات صغيرة مجانية تعمل في المتصفح. صانع الفواتير، ووصل التصليح وكارت الضمان، والمزيد قادم." data-en="Small free tools that work in your browser. The invoice maker, the repair receipt with warranty card, and more to come.">أدوات صغيرة مجانية تعمل في المتصفح. صانع الفواتير، ووصل التصليح وكارت الضمان، والمزيد قادم.</p></div>
<div><div class="l" data-ar="تحتاجها عندما" data-en="You need it when">تحتاجها عندما</div><ul>
<li><i>✓</i><span data-ar="تحتاج فاتورة أو عرض سعر مرتّباً الآن، بدون تثبيت أي برنامج" data-en="You need a neat invoice or quote now, without installing anything">تحتاج فاتورة أو عرض سعر مرتّباً الآن، بدون تثبيت أي برنامج</span></li>
<li><i>✓</i><span data-ar="تريد المبلغ مكتوباً بالحروف، بالدينار أو الدولار" data-en="You want the amount written in words, in dinars or dollars">تريد المبلغ مكتوباً بالحروف، بالدينار أو الدولار</span></li>
<li><i>✓</i><span data-ar="تصليح هاتف أو مكيف أو سيارة، وتريد وصل استلام وكارت ضمان" data-en="You fix a phone, an AC or a car, and want a receipt and a warranty card">تصليح هاتف أو مكيف أو سيارة، وتريد وصل استلام وكارت ضمان</span></li>
<li><i>✓</i><span data-ar="عملك صغير، أو تعمل وحدك" data-en="Your business is small, or you work alone">عملك صغير، أو تعمل وحدك</span></li>
</ul></div>
<div><div class="l" data-ar="ليست لك إذا" data-en="Not for you if">ليست لك إذا</div><p class="n" data-ar='تريد برنامجاً يتذكر كل مبيعاتك وبضاعتك وديونك؟ هذا <a href="https://hemlohq.com/systems/">هيملو للأنظمة</a>. تريد موقعاً أو تطبيقاً؟ هذا <a href="https://studio.hemlohq.com/">هيملو ستوديو</a>.' data-en='Want software that remembers every sale, your stock and your debts? That’s <a href="https://hemlohq.com/en/systems/">Hemlo Systems</a>. A website or an app? That’s <a href="https://studio.hemlohq.com/en/">Hemlo Studio</a>.'>تريد برنامجاً يتذكر كل مبيعاتك وبضاعتك وديونك؟ هذا <a href="https://hemlohq.com/systems/">هيملو للأنظمة</a>. تريد موقعاً أو تطبيقاً؟ هذا <a href="https://studio.hemlohq.com/">هيملو ستوديو</a>.</p></div>
</section>
<section class="kit">
<div class="k"><h2 data-ar="ابدأ ببضعة أصناف جاهزة" data-en="Start with a few ready-made items">ابدأ ببضعة أصناف جاهزة</h2><p data-ar="ملف فيه أصناف جاهزة من المواد الغذائية والمشروبات والمنظفات والحلويات، يستورد مباشرة إلى هيملو للأنظمة. عدّل الأسعار والأسماء كما تريد." data-en="A sheet of common grocery, drinks, cleaning and sweets items, ready to import straight into Hemlo Systems. Change the prices and names as you like.">ملف فيه أصناف جاهزة، يستورد مباشرة إلى هيملو للأنظمة.</p></div>
<a class="btn" href="/products-starter.csv" download data-ar="نزّل الملف" data-en="Download the sheet">نزّل الملف</a>
</section>
<div class="grid">
${TOOLS.map(t => { const i = TOOL_INFO[t] || { ar: t, en: t, arDesc: '', enDesc: '' }; return `<a class="card" href="/${t}/"><span class="tag" data-ar="مجاني" data-en="Free">مجاني</span><h2 data-ar="${i.ar}" data-en="${i.en}">${i.ar}</h2><p data-ar="${i.arDesc}" data-en="${i.enDesc}">${i.arDesc}</p></a>`; }).join('')}
${COMING.map(c => `<div class="card soon"><span class="tag" data-ar="قريباً" data-en="Coming soon">قريباً</span><h2 data-ar="${c.ar}" data-en="${c.en}">${c.ar}</h2></div>`).join('')}
</div></main>
<footer class="w"><span>© ${new Date().getFullYear()} Hemlo · <a href="https://hemlohq.com">hemlohq.com</a></span><span data-ar="حلولٌ بإتقان" data-en="Crafted with care">حلولٌ بإتقان</span></footer>
<script>!function(){var K='hemlo.uiLang',D=document.documentElement,L=document.getElementById('lang'),T={ar:'أدوات هيملو المجانية · Hemlo Tools',en:'Hemlo Tools · Free tools for your business'},M={ar:'أدوات مجانية لعمل الشركات والمحلات في العراق: فواتير وعروض أسعار بالدينار، ووصل التصليح. بدون تسجيل.',en:'Free tools for Iraqi businesses: invoices and quotes in dinars, and a repair receipt with warranty card. No sign-up.'};function g(k){return document.querySelectorAll('[data-'+k+']')}function s(l){document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';L.textContent=l==='ar'?'EN':'عربي';document.title=T[l];document.getElementById('desc').content=M[l];for(var i=0,a=g('ar'),b=g('en');i<a.length;i++)a[i].innerHTML=l==='ar'?a[i].getAttribute('data-ar'):a[i].getAttribute('data-en');try{localStorage.setItem(K,l)}catch(e){}}L.addEventListener('click',function(){s(document.documentElement.lang==='ar'?'en':'ar')});s(document.documentElement.lang)}();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(function(){})</script>
</body></html>`;
fs.writeFileSync(path.join(DIST, 'index.html'), hub.replace(/^\s+/gm, ''));

// ---------- manifest, robots, sitemap ----------
fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), JSON.stringify({
  name: 'Hemlo Tools · أدوات هيملو', short_name: 'Hemlo Tools', lang: 'ar', dir: 'rtl',
  start_url: '/invoice-maker/', scope: '/', display: 'standalone', background_color: '#FAFAF7', theme_color: '#FAFAF7',
  icons: [
    { src: '/shared/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/shared/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/shared/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'فاتورة جديدة · New invoice', url: '/invoice-maker/' },
    { name: 'وصل تصليح · Repair receipt', url: '/repair-receipt/' },
  ],
}, null, 1));
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', ...TOOLS.map(t => t + '/')].map(u => `<url><loc>${ORIGIN}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);

// ---------- caching and security headers (Cloudflare static assets read _headers) ----------
fs.writeFileSync(path.join(DIST, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/shared/*
  Cache-Control: public, max-age=604800
/shared/fonts/*
  ! Cache-Control
  Cache-Control: public, max-age=2592000
/sw.js
  Cache-Control: no-cache
`);

// ---------- service worker: works offline after the first visit ----------
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(DIST).map(f => '/' + path.relative(DIST, f).split(path.sep).join('/')).filter(f => f !== '/_headers');
const precache = ['/', ...TOOLS.map(t => `/${t}/`), ...files.filter(f => /^\/shared\/(fonts\/|hemlo-|favicon)/.test(f))];
const version = hash(files.map(f => f + fs.statSync(path.join(DIST, f)).size + hash(fs.readFileSync(path.join(DIST, f)))).join('|'));
const sw = `const V='hemlo-tools-${version}',P=${JSON.stringify(precache)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(P)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('/'))));return}
e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(V).then(x=>x.put(r,c))}return res})))});`;
fs.writeFileSync(path.join(DIST, 'sw.js'), minify(sw, 'js'));

// ---------- report ----------
const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`built ${TOOLS.length} tool(s) · version ${version}`);
for (const [f, n] of sizes) console.log('  ' + f.padEnd(40) + kb(n));
console.log('  shared/fonts'.padEnd(42) + kb(fs.readdirSync(path.join(DIST, 'shared/fonts')).reduce((a, f) => a + fs.statSync(path.join(DIST, 'shared/fonts', f)).size, 0)));
