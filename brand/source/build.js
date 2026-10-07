// Builds the Hemlo identity assets: logo SVGs + mockup HTML pages.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['logo/svg', 'logo/png', 'mockups/source', 'mockups/png'];
DIRS.forEach(d => fs.mkdirSync(path.join(ROOT, d), { recursive: true }));

const C = {
  ink: '#0E1420', ink700: '#2B3445', slate: '#5E6776', slate300: '#A3ABB8',
  stone50: '#F7F7F4', stone100: '#EFEFEA', stone200: '#E2E2DB',
  brass: '#B38B3A', brass700: '#8A6A22', brass300: '#D7B46A',
  white: '#FFFFFF', paper: '#F4F4F0', night: '#0C111A', night700: '#1A2230', night600: '#283243',
};

// ---------- The logo (from the founder's master drawing, see mark.js) ----------
const f = n => +n.toFixed(4);
const MARK = require("./mark.js");
function pieces(w = 1.6) { return w > 2 ? MARK.SMALL : { A: MARK.A, B: MARK.B }; } // the H mark (piece B is empty)
const MASTER = pieces(1.6);
const SMALL = pieces(2.2);

function markInner(a, b, cut = MASTER, extra = '') {
  return `<path d="${cut.A}" fill="${a}"${extra}/><path d="${cut.B}" fill="${b}"${extra}/>`;
}
function markSVG(a, b, cut = MASTER, attrs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${attrs}>${markInner(a, b, cut)}</svg>`;
}

// The primary lockup: the H mark (colour `a`) to the left of the name (colour `text`).
function lockup(a, b, text) {
  const W = MARK.WORD, y0 = -W.top, H = W.bottom - W.top;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W.w)} ${f(H)}">${MARK.wordmarkG(1, 0, y0, text, a, b)}</svg>`;
  return { svg, W: W.w, H };
}
// the name on its own (Readex Pro 600, outlined)
function wordmarkSVG(color) { const T = MARK.TEXT, H = T.bottom - T.top; return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(T.w)} ${f(H)}"><path d="${MARK.nameOnly(1, 0, -T.top)}" fill="${color}"/></svg>`, W: T.w, H }; }

// ---------- Write logo SVGs ----------
const out = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const logos = {
  'hemlo-mark.svg': markSVG(C.ink, C.brass),
  'hemlo-mark-ink.svg': markSVG(C.ink, C.ink),
  'hemlo-mark-white.svg': markSVG(C.white, C.white),
  'hemlo-mark-on-dark.svg': markSVG(C.white, C.brass300),
  'hemlo-mark-small.svg': markSVG(C.ink, C.brass, SMALL),
  'hemlo-mark-small-ink.svg': markSVG(C.ink, C.ink, SMALL),
  'hemlo-lockup.svg': lockup(C.ink, C.brass, C.ink).svg,
  'hemlo-lockup-ink.svg': lockup(C.ink, C.ink, C.ink).svg,
  'hemlo-lockup-on-dark.svg': lockup(C.white, C.brass300, C.white).svg,
  'hemlo-lockup-white.svg': lockup(C.white, C.white, C.white).svg,
  'hemlo-wordmark.svg': wordmarkSVG(C.ink).svg,
  'hemlo-wordmark-white.svg': wordmarkSVG(C.white).svg,
  'hemlo-app-icon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${C.ink}"/><g transform="translate(200 200) scale(26)">${markInner(C.white, C.brass300)}</g></svg>`,
  'hemlo-app-icon-light.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${C.stone100}"/><g transform="translate(200 200) scale(26)">${markInner(C.ink, C.brass)}</g></svg>`,
  'favicon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.a{fill:${C.ink}}.b{fill:${C.brass}}@media (prefers-color-scheme:dark){.a{fill:${C.white}}.b{fill:${C.brass300}}}</style><path class="a" d="${SMALL.A}"/><path class="b" d="${SMALL.B}"/></svg>`,
};
Object.entries(logos).forEach(([n, s]) => out('logo/svg/' + n, s));

// ---------- Mockups ----------
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Vazirmatn:wght@400;500;600;700;800&display=swap">';
const BASE = `*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%}body{font-family:"IBM Plex Sans",sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
.disp{font-family:"Readex Pro",sans-serif}.mono{font-family:"IBM Plex Mono",monospace}.ar{font-family:"Vazirmatn",sans-serif;direction:rtl}
.lbl{font-family:"IBM Plex Mono",monospace;letter-spacing:.22em;text-transform:uppercase}`;
const page = (title, w, h, css, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${FONTS}<style>${BASE}body{width:${w}px;height:${h}px}${css}</style></head><body>${body}</body></html>`;
const inline = (svg, style) => svg.replace('<svg ', `<svg style="${style}" `);
const L_dark = lockup(C.white, C.brass300, C.white);
const L_light = lockup(C.ink, C.brass, C.ink);
const grid = (color) => `<g stroke="${color}" stroke-width=".04" fill="none"><path d="${MARK.GUIDES}"/></g>`;

const mockups = {};

// 01 Portfolio cover — 1920x1080
mockups['01-portfolio-cover'] = page('Hemlo — cover', 1920, 1080, `
body{background:radial-gradient(1200px 900px at 72% 50%, #141C2B 0%, ${C.ink} 60%);color:${C.paper};position:relative}
.wrap{position:absolute;inset:0;padding:96px 120px;display:grid;grid-template-columns:1fr 760px;align-items:center}
.top{position:absolute;left:120px;top:88px}
.bottom{position:absolute;left:120px;right:120px;bottom:80px;display:flex;justify-content:space-between;color:${C.slate300};font-size:15px}
.lbl{color:${C.brass300};font-size:17px}
h1{font-family:"Readex Pro";font-weight:600;font-size:104px;line-height:1.02;letter-spacing:-0.03em;margin-top:30px;max-width:900px}
.sub{font-size:28px;color:${C.slate300};margin-top:30px;max-width:760px;line-height:1.45}
.ar{font-size:40px;font-weight:600;margin-top:44px;color:${C.paper};text-align:left}
.art{position:relative;width:760px;height:760px}
.art svg{position:absolute;inset:0;width:100%;height:100%}
`, `
<div class="top">${inline(L_dark.svg, 'height:56px;width:auto')}</div>
<div class="wrap">
  <div>
    <div class="lbl">Coming soon · قريباً</div>
    <h1>Elegantly solved.</h1>
    <p class="sub">Software that earns its place, built for the everyday work of Iraqi businesses.</p>
    <p class="ar" dir="rtl">حلولٌ بإتقان.</p>
  </div>
  <div class="art">
    <svg viewBox="-3 -3 30 30">${grid('#243044')}</svg>
    <svg viewBox="-3 -3 30 30">${markInner(C.paper, C.brass300)}</svg>
  </div>
</div>
<div class="bottom"><span class="mono">HEMLO · IRAQ · 2026</span><span class="mono">Small products. Real problems.</span></div>
`);

// 02 Social square — 1080x1080
mockups['02-social-square'] = page('Hemlo — square', 1080, 1080, `
body{background:${C.stone50};color:${C.ink};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative}
.lbl{color:${C.brass700};font-size:18px;margin-top:64px}
.tag{font-family:"Readex Pro";font-weight:600;font-size:54px;letter-spacing:-0.025em;margin-top:22px;line-height:1.1}
.ar{font-size:32px;font-weight:600;margin-top:22px;color:${C.ink700}}
.foot{position:absolute;bottom:56px;left:0;right:0;color:${C.slate};font-size:15px}
`, `
${inline(L_light.svg, 'height:150px;width:auto')}
<div class="lbl">Coming soon · قريباً</div>
<div class="tag">Elegantly solved.</div>
<div class="ar" dir="rtl">حلولٌ بإتقان.</div>
<div class="foot mono">Focused software for Iraqi businesses</div>
`);

// 03 Social story — 1080x1920 (the mark arriving)
mockups['03-social-story'] = page('Hemlo — story', 1080, 1920, `
body{background:${C.ink};color:${C.paper};position:relative}
.art{position:absolute;left:140px;top:360px;width:800px;height:800px}
.art svg{width:100%;height:100%;overflow:visible}
.cap{position:absolute;left:0;right:0;top:1260px;text-align:center}
.cap .t{font-family:"Readex Pro";font-weight:600;font-size:64px;letter-spacing:-0.025em}
.cap .s{font-size:28px;color:${C.slate300};margin-top:18px}
.lbl{position:absolute;left:0;right:0;top:220px;text-align:center;color:${C.brass300};font-size:22px}
.bot{position:absolute;left:0;right:0;bottom:150px;display:flex;justify-content:center}
.ar{position:absolute;left:0;right:0;top:1470px;text-align:center;font-size:40px;font-weight:600}
`, `
<div class="lbl">Coming soon · قريباً</div>
<div class="art"><svg viewBox="0 0 24 24"><g transform="translate(${f(-MARK.SEP.x * 1.3)} ${f(-MARK.SEP.y * 1.3)})"><path d="${MASTER.A}" fill="${C.paper}"/></g><g transform="translate(${f(MARK.SEP.x * 1.3)} ${f(MARK.SEP.y * 1.3)})"><path d="${MASTER.B}" fill="${C.brass300}"/></g></svg></div>
<div class="cap"><div class="t">No loose threads.</div><div class="s">Software, finished properly.</div></div>
<div class="ar" dir="rtl">حلولٌ بإتقان.</div>
<div class="bot">${inline(L_dark.svg, 'height:64px;width:auto')}</div>
`);

// 04 Business cards — 1600x1100
const cardShadow = '0 2px 4px rgba(14,20,32,.10), 0 18px 40px rgba(14,20,32,.18), 0 40px 80px rgba(14,20,32,.10)';
mockups['04-business-cards'] = page('Hemlo — cards', 1600, 1100, `
body{background:radial-gradient(1100px 800px at 50% 40%, #F3F3EF 0%, #DEDED6 100%);position:relative}
.card{position:absolute;width:680px;height:440px;border-radius:14px;box-shadow:${cardShadow};padding:52px 56px;display:flex;flex-direction:column;justify-content:space-between}
.front{background:#FFFFFF;color:${C.ink};left:170px;top:430px;transform:rotate(-5deg)}
.back{background:${C.ink};color:${C.paper};left:760px;top:170px;transform:rotate(4deg);align-items:center;justify-content:center;gap:26px}
.name{font-family:"Readex Pro";font-weight:600;font-size:30px;letter-spacing:-0.01em}
.role{font-size:19px;color:${C.slate};margin-top:4px}
.contact{font-size:16px;color:${C.slate};margin-top:18px;line-height:1.7}
.ar{font-size:30px;font-weight:700;color:${C.paper}}
.tag{font-size:15px;color:${C.slate300}}
`, `
<div class="card back">${inline(markSVG(C.paper, C.brass300), 'width:150px;height:150px')}<div class="ar" dir="rtl">هيملو</div><div class="tag ar" dir="rtl" style="font-size:18px;font-weight:500;color:${C.slate300}">حلولٌ بإتقان.</div></div>
<div class="card front">${inline(L_light.svg, 'height:52px;width:auto;align-self:flex-start')}<div><div class="name">Your Name</div><div class="role">Founder</div><div class="contact mono">+964 7XX XXX XXXX<br>hello@hemlohq.com</div></div></div>
`);

// 05 App icon + splash — 1600x1100
mockups['05-app-icon'] = page('Hemlo — app', 1600, 1100, `
body{background:${C.stone100};position:relative;color:${C.ink}}
.phone{position:absolute;left:170px;top:90px;width:430px;height:920px;border-radius:64px;background:#0A0D13;padding:14px;box-shadow:0 30px 80px rgba(14,20,32,.25)}
.screen{width:100%;height:100%;border-radius:52px;background:${C.ink};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;position:relative;overflow:hidden}
.notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000}
.splash-foot{position:absolute;bottom:48px;color:${C.slate300};font-size:14px}
.icons{position:absolute;left:720px;top:170px;display:grid;gap:56px}
.row{display:flex;align-items:flex-end;gap:44px}
.ic{border-radius:23%;overflow:hidden;box-shadow:0 10px 30px rgba(14,20,32,.18)}
.ic svg{display:block;width:100%;height:100%}
.cap{font-size:14px;color:${C.slate};margin-top:14px;text-align:center}
.tab{display:flex;align-items:center;gap:12px;background:#FFFFFF;border-radius:12px 12px 0 0;padding:14px 22px;width:420px;box-shadow:0 6px 20px rgba(14,20,32,.08);font-size:17px}
.tab .x{margin-left:auto;color:${C.slate};font-size:15px}
.bar{background:#FFFFFF;border-top:1px solid ${C.stone200};width:720px;padding:14px 22px;border-radius:0 12px 12px 12px;color:${C.slate};font-size:16px;box-shadow:0 6px 20px rgba(14,20,32,.08)}
`, `
<div class="phone"><div class="screen"><div class="notch"></div>${inline(markSVG(C.paper, C.brass300), 'width:150px;height:150px')}${inline(wordmarkSVG(C.paper).svg, 'height:40px;width:auto')}<div class="splash-foot mono">COMING SOON</div></div></div>
<div class="icons">
  <div class="row">
    <div><div class="ic" style="width:220px;height:220px">${logos['hemlo-app-icon.svg']}</div><div class="cap mono">App icon</div></div>
    <div><div class="ic" style="width:140px;height:140px">${logos['hemlo-app-icon-light.svg']}</div><div class="cap mono">Light</div></div>
    <div><div class="ic" style="width:84px;height:84px">${logos['hemlo-app-icon.svg']}</div><div class="cap mono">Small</div></div>
  </div>
  <div>
    <div class="tab">${inline(markSVG(C.ink, C.brass, SMALL), 'width:20px;height:20px')}<span>Hemlo · Coming soon</span><span class="x">✕</span></div>
    <div class="bar mono">hemlohq.com</div>
  </div>
  <div class="row" style="gap:28px;align-items:center">
    ${inline(markSVG(C.ink, C.brass, SMALL), 'width:32px;height:32px')}${inline(markSVG(C.ink, C.brass, SMALL), 'width:24px;height:24px')}${inline(markSVG(C.ink, C.ink, SMALL), 'width:16px;height:16px')}
    <span class="mono" style="font-size:14px;color:${C.slate}">Small cut: 32 · 24 · 16 px</span>
  </div>
</div>
`);

// 06 Website coming soon — 1920x1200
mockups['06-website'] = page('Hemlo — website', 1920, 1200, `
body{background:#D9D9D2;position:relative}
.win{position:absolute;left:110px;top:80px;right:110px;bottom:80px;border-radius:16px;overflow:hidden;background:${C.stone50};box-shadow:0 30px 90px rgba(14,20,32,.22)}
.chrome{height:56px;background:#ECECE6;display:flex;align-items:center;gap:10px;padding:0 20px;border-bottom:1px solid ${C.stone200}}
.dot{width:13px;height:13px;border-radius:50%;background:#CBCBC2}
.url{margin-left:30px;background:#FFFFFF;border-radius:8px;padding:8px 16px;font-size:14px;color:${C.slate};width:520px;display:flex;align-items:center;gap:10px}
nav{display:flex;align-items:center;padding:34px 72px}
nav .links{display:flex;gap:40px;margin-left:80px;font-size:17px;color:${C.ink700}}
nav .right{margin-left:auto;display:flex;align-items:center;gap:28px;font-size:17px}
.btn{background:${C.ink};color:#fff;border-radius:10px;padding:13px 22px;font-size:16px;font-weight:500}
.hero{display:grid;grid-template-columns:1fr 520px;gap:40px;padding:60px 72px 0;align-items:center}
.lbl{color:${C.brass700};font-size:15px}
h1{font-family:"Readex Pro";font-weight:600;font-size:88px;line-height:1.02;letter-spacing:-0.03em;margin-top:22px;color:${C.ink};max-width:820px}
.sub{font-size:23px;color:${C.slate};margin-top:24px;max-width:720px;line-height:1.5}
.notify{display:flex;gap:12px;margin-top:40px}
.input{background:#fff;border:1px solid ${C.stone200};border-radius:10px;padding:16px 18px;width:360px;color:${C.slate};font-size:17px}
.ar{font-size:26px;font-weight:600;color:${C.ink700};margin-top:30px;text-align:left}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;padding:70px 72px 0}
.card{background:#fff;border:1px solid ${C.stone200};border-radius:14px;padding:26px}
.card h3{font-family:"Readex Pro";font-weight:600;font-size:22px;color:${C.ink}}
.card p{font-size:16px;color:${C.slate};margin-top:8px;line-height:1.55}
.art svg{width:520px;height:520px}
`, `
<div class="win">
  <div class="chrome"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="url">${inline(markSVG(C.ink, C.brass, SMALL), 'width:16px;height:16px')}hemlohq.com</div></div>
  <nav>${inline(L_light.svg, 'height:40px;width:auto')}<div class="links"><span>Products</span><span>How we build</span><span>Field notes</span><span>About</span></div><div class="right"><span class="ar" style="margin:0;font-size:17px;font-weight:500">العربية</span><span class="btn">Talk to us</span></div></nav>
  <div class="hero">
    <div>
      <div class="lbl lbl">Coming soon</div>
      <h1>Elegantly solved.</h1>
      <p class="sub">Software that earns its place. Hemlo builds focused software for the everyday work of Iraqi businesses. Each product starts with time spent inside real shops, offices and workshops, and does one job properly.</p>
      <div class="notify"><div class="input">Your WhatsApp number</div><div class="btn" style="padding:16px 24px">Notify me</div></div>
      <p class="ar" dir="rtl">حلولٌ بإتقان.</p>
    </div>
    <div class="art"><svg viewBox="-1 -1 26 26">${grid(C.stone200)}${markInner(C.ink, C.brass)}</svg></div>
  </div>
  <div class="cards">
    <div class="card"><h3>We study the work first</h3><p>No feature ships without a real example from a real workplace behind it.</p></div>
    <div class="card"><h3>One job, done properly</h3><p>Small products that finish the job, instead of big systems that half-do ten.</p></div>
    <div class="card"><h3>Built for real conditions</h3><p>Arabic and Kurdish, dinars, WhatsApp, weak signal. The hardest case sets the standard.</p></div>
  </div>
</div>
`);

// 07 Identity sheet — 1920x1350
const sw = (hex, name, dark) => `<div class="sw"><div class="chip" style="background:${hex}${hex === '#FFFFFF' || hex === C.stone50 ? ';border:1px solid ' + C.stone200 : ''}"></div><div class="nm">${name}</div><div class="hx mono">${hex}</div></div>`;
mockups['07-identity-sheet'] = page('Hemlo — identity sheet', 1920, 1350, `
body{background:${C.stone50};color:${C.ink};padding:80px 96px;display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:auto 1fr auto;gap:28px}
.hd{grid-column:1/-1;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid ${C.stone200};padding-bottom:26px}
.hd h1{font-family:"Readex Pro";font-weight:600;font-size:44px;letter-spacing:-0.02em}
.hd .lbl{font-size:13px;color:${C.slate}}
.p{background:#fff;border:1px solid ${C.stone200};border-radius:16px;padding:32px;position:relative}
.p .lbl{font-size:12px;color:${C.slate};position:absolute;left:32px;top:26px}
.hero{grid-column:1/6;display:flex;align-items:center;justify-content:center}
.cons{grid-column:6/9;display:flex;align-items:center;justify-content:center}
.dark{grid-column:9/13;background:${C.ink};border-color:${C.ink};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}
.dark .lbl{color:${C.slate300}}
.colors{grid-column:1/7;display:grid;grid-template-columns:repeat(6,1fr);gap:16px;padding-top:64px}
.sw .chip{height:120px;border-radius:12px}
.sw .nm{font-family:"Readex Pro";font-weight:600;font-size:16px;margin-top:12px}
.sw .hx{font-size:13px;color:${C.slate};margin-top:2px}
.type{grid-column:7/13;padding-top:64px;display:grid;gap:18px}
.type .l{font-family:"Readex Pro";font-weight:600;font-size:52px;letter-spacing:-0.025em;line-height:1.05}
.type .b{font-size:19px;color:${C.slate}}
.type .a{font-family:"Vazirmatn";font-weight:700;font-size:44px;direction:rtl;text-align:right}
.type .m{font-size:15px;color:${C.slate}}
.foot{grid-column:1/-1;display:flex;justify-content:space-between;color:${C.slate};font-size:14px}
`, `
<div class="hd"><h1>Hemlo visual identity</h1><span class="lbl">Logo · v1 · 2026</span></div>
<div class="p hero"><span class="lbl">Primary lockup</span>${inline(L_light.svg, 'width:560px;height:auto;margin-top:20px')}</div>
<div class="p cons"><span class="lbl">Construction</span><svg viewBox="-1.5 -1.5 27 27" style="width:320px;height:320px;margin-top:24px">${grid(C.stone200)}${markInner(C.ink, C.brass)}<g stroke="${C.brass700}" stroke-width=".06" fill="none" stroke-dasharray=".35 .25"><path d="${MARK.FOLD}"/></g></svg></div>
<div class="p dark"><span class="lbl">On ink</span>${inline(markSVG(C.paper, C.brass300), 'width:170px;height:170px;margin-top:24px')}<div style="display:flex;gap:26px;align-items:center">${inline(wordmarkSVG(C.paper).svg, 'height:40px;width:auto')}<span style="font-family:'Vazirmatn';font-weight:700;font-size:36px;color:${C.paper}" dir="rtl">هيملو</span></div></div>
<div class="p colors"><span class="lbl">Colour</span>${sw(C.ink, 'Kohl Ink')}${sw(C.brass, 'Safafeer Brass')}${sw(C.brass300, 'Brass 300')}${sw(C.slate, 'Slate')}${sw(C.stone200, 'Stone 200')}${sw(C.stone50, 'Stone 50')}</div>
<div class="p type"><span class="lbl">Type</span><div class="l">Readex Pro</div><div class="b">IBM Plex Sans for text and interfaces, with tabular figures: 1,250,000 IQD.</div><div class="a">فزيرمتن — هيملو</div><div class="m mono">IBM Plex Mono · SHP-2026-0142 · Kurdish ready: <span style="font-family:'Vazirmatn';font-weight:600">هێملۆ</span></div></div>
<div class="foot mono"><span>Elegantly solved.</span><span dir="rtl" style="font-family:'Vazirmatn'">حلولٌ بإتقان.</span></div>
`);

Object.entries(mockups).forEach(([n, html]) => out('mockups/source/' + n + '.html', html));

// PNG render list for the logo files (rendered by PowerShell + Edge)
const renders = [
  ['hemlo-mark', 1024, 1024, markSVG(C.ink, C.brass), 'transparent'],
  ['hemlo-mark-on-dark', 1024, 1024, markSVG(C.white, C.brass300), 'transparent'],
  ['hemlo-mark-ink', 1024, 1024, markSVG(C.ink, C.ink), 'transparent'],
  ['hemlo-mark-white', 1024, 1024, markSVG(C.white, C.white), 'transparent'],
  ['hemlo-lockup', 2000, Math.round(2000 * L_light.H / L_light.W), L_light.svg, 'transparent'],
  ['hemlo-lockup-on-dark', 2000, Math.round(2000 * L_dark.H / L_dark.W), L_dark.svg, 'transparent'],
  ['hemlo-app-icon-1024', 1024, 1024, logos['hemlo-app-icon.svg'], 'transparent'],
  ['hemlo-avatar-1080', 1080, 1080, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="${C.ink}"/><g transform="translate(210 210) scale(27.5)">${markInner(C.paper, C.brass300)}</g></svg>`, 'transparent'],
];
renders.forEach(([n, w, h, svg]) => {
  out('logo/png/_render_' + n + '.html', `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;width:${w}px;height:${h}px;overflow:hidden}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${svg}</body></html>`);
});
fs.writeFileSync(path.join(__dirname, 'renders.json'), JSON.stringify(renders.map(r => ({ name: r[0], w: r[1], h: r[2] }))));
fs.writeFileSync(path.join(__dirname, 'mockups.json'), JSON.stringify({
  '01-portfolio-cover': [1920, 1080], '02-social-square': [1080, 1080], '03-social-story': [1080, 1920],
  '04-business-cards': [1600, 1100], '05-app-icon': [1600, 1100], '06-website': [1920, 1200], '07-identity-sheet': [1920, 1350],
}));
console.log('lockup', f(L_light.W), 'x', f(L_light.H));
console.log('A master:', MASTER.A);
console.log('B master:', MASTER.B);
