// Builds public/index.html and the share image (og.html -> public/og.png) from the Hemlo brand kit.
// Run: node build.js   (reads the kit at ../../brand)
const fs = require('fs');
const path = require('path');

const KIT = path.resolve(__dirname, '../../brand');
const M = require(path.join(KIT, 'source/mark.js'));
const svgFile = n => fs.readFileSync(path.join(KIT, 'logo/svg', n + '.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').trim();

// the H cropped to its own bounds
const VB = `${(12 - M.GEO.w / 2).toFixed(3)} 1 ${M.GEO.w.toFixed(3)} 22`;
const H = (cls, extra = '') => `<svg class="${cls}" viewBox="${VB}"${extra}><path d="${M.A}"/></svg>`;
const LOCK = svgFile('hemlo-lockup').replace('<svg ', '<svg class="lockup" role="img" aria-label="Hemlo" ').replace(/fill="#0E1420"/g, 'fill="currentColor"');

const BRANCHES = [
  { id: 'tools', name: 'Tools', ar: 'الأدوات', c: '#3B5BC4', cd: '#8EA6F0', t: '#EEF1FB', td: '#161D33', en: 'Free tools for everyday work. Try the invoice maker ›', arT: 'أدوات مجانية للعمل اليومي. جرّب صانع الفواتير.' },
  { id: 'studio', name: 'Studio', ar: 'ستوديو', c: '#0F766E', cd: '#4FC1B3', t: '#E9F4F2', td: '#0F2224', en: 'Websites, apps and systems, made to order.', arT: 'مواقع وتطبيقات وأنظمة حسب الطلب.' },
  { id: 'workshops', name: 'Workshops', ar: 'الورش', c: '#A8532E', cd: '#E0896A', t: '#F8EDE7', td: '#27180F', en: 'Stock, job cards and warranty.', arT: 'المخزون وأوامر العمل والضمان.' },
  { id: 'school', name: 'School', ar: 'المدارس', c: '#6E4A86', cd: '#B08CC8', t: '#F2EDF6', td: '#1E1628', en: 'Everything a private school runs on.', arT: 'كل ما تحتاجه المدرسة الأهلية.' },
];
const FACTS = [
  ['Arabic, Kurdish, English.', 'بالعربية والكردية والإنجليزية.'],
  ['Priced and paid in dinars.', 'الأسعار والدفع بالدينار.'],
  ['Made for a weak signal.', 'يعمل حتى مع إنترنت ضعيف.'],
];

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600&family=Poppins:wght@300;600&family=Vazirmatn:wght@300;400;600;700&display=swap">';

const css = `
:root{
  --bg:#FAFAF7;--tile:#F1F0EB;--ink:#0E1420;--ink2:#3A4252;--muted:#6B7280;--rule:#E3E1DA;--brass:#8A6A22;--nav:rgba(250,250,247,.72);
  --f:"Readex Pro",system-ui,-apple-system,sans-serif;--f-ar:"Vazirmatn",Tahoma,sans-serif;--f-l:"Poppins",var(--f);
  --ease:cubic-bezier(.2,0,0,1);--pad:max(20px,env(safe-area-inset-left))
}
@media (prefers-color-scheme:dark){:root{--bg:#0B0F16;--tile:#141A24;--ink:#F2F1EC;--ink2:#C9CED6;--muted:#8E96A3;--rule:#222A36;--brass:#D7B46A;--nav:rgba(11,15,22,.72)}}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:64px}
body{background:var(--bg);color:var(--ink);font-family:var(--f);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
.ar{font-family:var(--f-ar);direction:rtl}
a{color:inherit;text-decoration:none}
.w{width:100%;max-width:1080px;margin:0 auto;padding-inline:var(--pad)}
.c{text-align:center}

/* nav */
nav{position:sticky;top:0;z-index:10;background:var(--nav);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid transparent;transition:border-color .3s}
nav.s{border-bottom-color:var(--rule)}
nav .w{height:52px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.lockup{height:22px;width:auto;display:block;color:var(--ink)}
nav ul{list-style:none;display:flex;gap:28px;font-size:13px;color:var(--ink2)}
nav ul a:hover{color:var(--ink)}
nav .cta{font-size:13px;font-weight:500;padding:6px 14px;border-radius:999px;background:var(--ink);color:var(--bg)}

/* hero */
.hero{padding-block:clamp(56px,10vw,120px) clamp(40px,8vw,96px);text-align:center}
.eyebrow{font-size:clamp(15px,1.6vw,19px);font-weight:500;color:var(--brass);letter-spacing:.01em}
h1{font-weight:600;font-size:clamp(46px,9vw,104px);line-height:1.02;letter-spacing:-.04em;margin-top:10px}
.tag-ar{font-family:var(--f-ar);font-weight:600;font-size:clamp(24px,3.6vw,40px);color:var(--muted);margin-top:8px;direction:rtl}
.sub{font-size:clamp(17px,2vw,22px);line-height:1.45;color:var(--ink2);max-width:30em;margin:22px auto 0;font-weight:400}
.links{display:flex;justify-content:center;flex-wrap:wrap;gap:12px 32px;margin-top:26px;font-size:clamp(16px,1.6vw,19px)}
.links a{color:var(--brass);font-weight:500}
.links a:hover{text-decoration:underline;text-underline-offset:4px}
.links a span{display:inline-block;transition:transform .2s var(--ease)}
.links a:hover span{transform:translateX(3px)}
.stage{position:relative;margin:clamp(48px,7vw,84px) auto 0;width:min(100%,560px);aspect-ratio:1/1;display:grid;place-items:center}
.stage::before{content:"";position:absolute;inset:8% 14%;border-radius:50%;background:radial-gradient(closest-side,rgba(179,139,58,.16),transparent 70%);filter:blur(8px)}
.hmark{position:relative;height:88%;width:auto;fill:var(--ink)}
.stage .sheen{position:absolute;inset:0;pointer-events:none}

/* sections */
section{padding-block:clamp(80px,12vw,150px)}
section+section{border-top:1px solid var(--rule)}
h2{font-weight:600;font-size:clamp(34px,6vw,64px);line-height:1.05;letter-spacing:-.035em}
.lead{font-size:clamp(17px,2vw,22px);color:var(--ink2);margin-top:14px;line-height:1.45}
.lead-ar{font-family:var(--f-ar);font-size:clamp(16px,1.8vw,20px);color:var(--muted);margin-top:6px;direction:rtl}

.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:clamp(40px,6vw,64px)}
.tile{position:relative;overflow:hidden;border-radius:28px;background:var(--t);padding:clamp(28px,4vw,44px) clamp(24px,3.6vw,40px) 0;min-height:clamp(340px,40vw,440px);display:flex;flex-direction:column;text-align:left}
.tile>*{position:relative;z-index:1}
.tile .nm{font-family:var(--f-l);font-weight:600;font-size:clamp(26px,3vw,34px);letter-spacing:-.01em;line-height:1}
.tile .nm i{display:block;font-style:normal;font-weight:300;font-size:.62em;color:var(--c);margin-top:6px;letter-spacing:.01em}
.tile .nm i span{font-family:var(--f-ar);font-weight:400;margin-inline-start:.5em;opacity:.85}
.tile p{font-size:clamp(16px,1.6vw,18px);color:var(--ink2);margin-top:14px;line-height:1.4;max-width:18em}
.tile p.ar{font-family:var(--f-ar);color:var(--muted);margin-top:4px;text-align:left;font-size:clamp(15px,1.5vw,17px)}
.tile .big{position:absolute;z-index:0;right:clamp(20px,4vw,40px);bottom:-18%;height:64%;width:auto;fill:var(--c);transition:transform .6s var(--ease)}
@media (hover:hover){.tile:hover .big{transform:translateY(-4%)}}
@media (prefers-color-scheme:dark){.tile{background:var(--td)}.tile .big{fill:var(--cd)}.tile .nm i{color:var(--cd)}}

.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(24px,4vw,48px);margin-top:clamp(40px,6vw,64px);text-align:left}
.fact{border-top:1px solid var(--rule);padding-top:20px}
.fact b{display:block;font-weight:500;font-size:clamp(20px,2.2vw,26px);letter-spacing:-.02em;line-height:1.2}
.fact span{display:block;font-family:var(--f-ar);direction:rtl;text-align:left;color:var(--muted);font-size:clamp(16px,1.7vw,19px);margin-top:8px}

.end{padding-bottom:clamp(110px,14vw,180px)}
.end .mark-s{height:44px;width:auto;fill:var(--ink);margin:0 auto 26px;display:block}
.mail{display:inline-block;margin-top:26px;font-weight:500;font-size:clamp(24px,4.4vw,48px);letter-spacing:-.03em;color:var(--ink);border-bottom:2px solid var(--brass);padding-bottom:4px;transition:opacity .2s}
.mail:hover{opacity:.7}
a:focus-visible{outline:2px solid var(--brass);outline-offset:4px;border-radius:4px}

footer{border-top:1px solid var(--rule);padding:22px 0 max(26px,env(safe-area-inset-bottom));font-size:12px;color:var(--muted)}
footer .w{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}

/* reveal on scroll (added by JS so the page still works without it) */
.js .rv{opacity:0;transform:translateY(24px);transition:opacity .9s var(--ease),transform .9s var(--ease)}
.js .rv.in{opacity:1;transform:none}
@media (prefers-reduced-motion:no-preference){
  .hmark{animation:wipe 1.4s var(--ease) .2s both}
  @keyframes wipe{from{clip-path:polygon(0 0,0 0,0 100%,0 100%);transform:scale(.96)}to{clip-path:polygon(0 0,140% 0,100% 100%,0 100%);transform:none}}
  .hero .rise{animation:rise 1s var(--ease) both}.hero .r2{animation-delay:.08s}.hero .r3{animation-delay:.16s}.hero .r4{animation-delay:.24s}.hero .r5{animation-delay:.32s}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
}
@media (prefers-reduced-motion:reduce){.js .rv{opacity:1;transform:none;transition:none}}

/* tablet */
@media (max-width:860px){nav ul{display:none}.facts{grid-template-columns:1fr}.tile{min-height:360px}}
/* phone */
@media (max-width:600px){.tiles{grid-template-columns:1fr}.tile{min-height:330px}.tile .big{height:50%;bottom:-14%}.stage{width:min(100%,380px)}}
`;

const tiles = BRANCHES.map(b => `      <a class="tile rv" href="${b.id === 'tools' ? 'https://tools.hemlohq.com/' : '#contact'}" style="--c:${b.c};--cd:${b.cd};--t:${b.t};--td:${b.td}" aria-label="Hemlo ${b.name}">
        <span class="nm">Hemlo<i>${b.name}<span lang="ar">${b.ar}</span></i></span>
        <p>${b.en}</p>
        <p class="ar" lang="ar">${b.arT}</p>
        ${H('big', ' aria-hidden="true"')}
      </a>`).join('\n');

const facts = FACTS.map(([en, ar]) => `      <div class="fact rv"><b>${en}</b><span lang="ar">${ar}</span></div>`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Hemlo · Elegantly solved.</title>
<meta name="description" content="Software for the way Iraq works. Coming soon. هيملو: برامج تناسب طريقة العمل في العراق. قريباً.">
<meta name="theme-color" content="#FAFAF7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0F16" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:url" content="https://hemlohq.com/">
<meta property="og:title" content="Hemlo · Elegantly solved.">
<meta property="og:description" content="Software for the way Iraq works. Coming soon.">
<meta property="og:image" content="https://hemlohq.com/og.png">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
<style>${css}</style>
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<nav id="nav" aria-label="Main">
  <div class="w">
    <a href="#top" aria-label="Hemlo, home">${LOCK}</a>
    <ul>${BRANCHES.map(b => `<li><a href="${b.id === 'tools' ? 'https://tools.hemlohq.com/' : '#branches'}">${b.name}</a></li>`).join('')}</ul>
    <a class="cta" href="#contact">Contact</a>
  </div>
</nav>

<main id="top">
  <header class="hero w">
    <p class="eyebrow rise">Coming soon · <span class="ar" lang="ar">قريباً</span></p>
    <h1 class="rise r2">Elegantly solved.</h1>
    <p class="tag-ar rise r3" lang="ar">حلولٌ بإتقان.</p>
    <p class="sub rise r4">Software for the way Iraq works.</p>
    <p class="links rise r5"><a href="#branches">See what's coming <span>›</span></a><a href="#contact">Get in touch <span>›</span></a></p>
    <div class="stage" aria-hidden="true">${H('hmark')}</div>
  </header>

  <section id="branches" class="w c">
    <h2 class="rv">Four branches.<br>One standard.</h2>
    <p class="lead rv">Each one does one job, properly.</p>
    <p class="lead-ar rv" lang="ar">أربعة فروع، ومعيار واحد.</p>
    <div class="tiles">
${tiles}
    </div>
  </section>

  <section class="w c">
    <h2 class="rv">Made for here.</h2>
    <p class="lead-ar rv" lang="ar" style="margin-top:10px">مصنوع لهنا.</p>
    <div class="facts">
${facts}
    </div>
  </section>

  <section id="contact" class="w c end">
    ${H('mark-s rv', ' aria-hidden="true"')}
    <h2 class="rv">Let's talk.</h2>
    <p class="lead rv">Tell us how your work runs today.</p>
    <p class="lead-ar rv" lang="ar">أخبرنا كيف يسير عملك اليوم.</p>
    <a class="mail rv" href="mailto:hello@hemlohq.com">hello@hemlohq.com</a>
  </section>
</main>

<footer>
  <div class="w"><span>© 2026 Hemlo. Baghdad, Iraq.</span><span class="ar" lang="ar">هيملو · حلولٌ بإتقان</span></div>
</footer>
<script>
(function(){
  var nav=document.getElementById('nav');
  function onScroll(){nav.classList.toggle('s',window.scrollY>8)}
  onScroll();window.addEventListener('scroll',onScroll,{passive:true});
  var els=document.querySelectorAll('.rv');
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(e){io.observe(e)});
})();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'public/index.html'), html);

// share image (1200 × 630), centred like the hero
const og = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1200px;height:630px;overflow:hidden}
body{background:#FAFAF7;color:#0E1420;font-family:"Readex Pro";display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.h{height:190px;width:auto;fill:#0E1420;margin-bottom:34px}
.t{font-weight:600;font-size:92px;letter-spacing:-.04em;line-height:1}
.a{font-family:"Vazirmatn";font-weight:600;font-size:40px;color:#6B7280;margin-top:10px;direction:rtl}
.m{font-size:22px;color:#8A6A22;margin-top:22px;font-weight:500}
</style></head><body>${H('h')}<div class="t">Elegantly solved.</div><div class="a">حلولٌ بإتقان.</div><div class="m">hemlohq.com · Coming soon</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'og.html'), og);
console.log('built public/index.html and og.html');
