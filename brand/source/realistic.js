// Realistic Hemlo mockups: stationery, company stamp, reception sign, phone, embossed paper, website display.
// Run: node source/realistic.js  (the logo comes from source/mark.js and hemlo-logo-master.svg)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_SRC = path.join(ROOT, 'mockups/realistic/source');
fs.mkdirSync(OUT_SRC, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'mockups/realistic/png'), { recursive: true });

const C = { ink: '#0E1420', brass: '#B38B3A', brass300: '#D7B46A', brass700: '#8A6A22', slate: '#5E6776', stone: '#F7F7F4', paper: '#F4F4F0' };

// ---------- the logo (the founder's master drawing, see mark.js) ----------
const f = n => +n.toFixed(4);
const MARK = require("./mark.js");
function pieces(w = 1.6) { return w > 2 ? MARK.SMALL : { A: MARK.A, B: MARK.B }; } // the H mark
const M = pieces(1.6);
const WD = MARK.WORD, WH = WD.bottom - WD.top;   // wordmark bbox height in cap units (cap = 100)

// ---------- SVG builders (pixel space so filters use pixel units) ----------
function mark(size, a, b, { filter = '', style = '' } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;${style}"><g${filter ? ` filter="url(#${filter})"` : ''}><g transform="scale(${f(size / 24)})"><path d="${M.A}" fill="${a}"/><path d="${M.B}" fill="${b}"/></g></g></svg>`;
}
// the primary lockup (H mark + name); h = box height, name in t, mark in a
function lockup(h, a, b, t, { filter = '', style = '' } = {}) {
  const s = h / WH, w = Math.ceil(WD.w * s);
  return `<svg width="${w}" height="${Math.ceil(h)}" viewBox="0 0 ${w} ${Math.ceil(h)}" style="overflow:visible;${style}"><g${filter ? ` filter="url(#${filter})"` : ''}>${MARK.wordmarkG(s, 0, -WD.top * s, t, a, b)}</g></svg>`;
}
// the name on its own; h = box height
function wordmark(h, color, { filter = '', style = '' } = {}) {
  const T = MARK.TEXT, s = h / (T.bottom - T.top), w = Math.ceil(T.w * s);
  return `<svg width="${w}" height="${Math.ceil(h)}" viewBox="0 0 ${w} ${Math.ceil(h)}" style="overflow:visible;${style}"><g${filter ? ` filter="url(#${filter})"` : ''}><path d="${MARK.nameOnly(s, 0, -T.top * s)}" fill="${color}"/></g></svg>`;
}

// ---------- shared defs: foil gradient, brushed brass, foil sheen, ink stamp ----------
const DEFS = `<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="foil" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#7C5E1E"/><stop offset=".2" stop-color="#C39A45"/><stop offset=".36" stop-color="#F2DEA0"/><stop offset=".5" stop-color="#B38B3A"/><stop offset=".68" stop-color="#E3C77F"/><stop offset=".84" stop-color="#8F6E27"/><stop offset="1" stop-color="#D2B062"/>
</linearGradient>
<linearGradient id="brassH" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#E9D08E"/><stop offset=".35" stop-color="#C9A24E"/><stop offset=".6" stop-color="#9E7B2E"/><stop offset="1" stop-color="#D9B869"/>
</linearGradient>
<filter id="brushed" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.003 0.55" numOctaves="2" seed="9" result="t"/>
  <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 .96  0 0 0 0 .86  1.1 0 0 0 -.45" result="streak"/>
  <feComposite in="streak" in2="SourceAlpha" operator="in" result="lines"/>
  <feBlend in="lines" in2="SourceGraphic" mode="soft-light" result="brushedFace"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="bl"/>
  <feSpecularLighting in="bl" surfaceScale="4" specularConstant="1.2" specularExponent="22" lighting-color="#FFF4D6" result="sp"><feDistantLight azimuth="235" elevation="38"/></feSpecularLighting>
  <feComposite in="sp" in2="SourceAlpha" operator="in" result="sp2"/>
  <feComposite in="brushedFace" in2="sp2" operator="arithmetic" k1="0" k2="1" k3=".6" k4="0"/>
</filter>
<filter id="foilSheen" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 .95  0 0 0 0 .8  .9 0 0 0 -.5" result="gr"/>
  <feComposite in="gr" in2="SourceAlpha" operator="in" result="grain"/>
  <feBlend in="grain" in2="SourceGraphic" mode="soft-light" result="face"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="bl"/>
  <feSpecularLighting in="bl" surfaceScale="1.6" specularConstant="1" specularExponent="30" lighting-color="#FFF6DE" result="sp"><feDistantLight azimuth="235" elevation="45"/></feSpecularLighting>
  <feComposite in="sp" in2="SourceAlpha" operator="in" result="sp2"/>
  <feComposite in="face" in2="sp2" operator="arithmetic" k1="0" k2="1" k3=".45" k4="0" result="lit"/>
  <feDropShadow dx="0.6" dy="0.8" stdDeviation="0.5" flood-color="#000" flood-opacity=".35"/>
</filter>
<filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="11" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.3 0 0 0 1.6" result="m1"/>
  <feComposite in="SourceGraphic" in2="m1" operator="in" result="patchy"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" result="fn"/>
  <feColorMatrix in="fn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.0 0 0 0 1.38" result="m2"/>
  <feComposite in="patchy" in2="m2" operator="in" result="speck"/>
  <feGaussianBlur in="speck" stdDeviation="0.35"/>
</filter>
</defs></svg>`;

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Vazirmatn:wght@400;500;600;700;800&display=swap">';
const GRAIN = `<script>(function(){function n(a,s){var c=document.createElement('canvas');c.width=c.height=s;var x=c.getContext('2d'),d=x.createImageData(s,s);for(var i=0;i<d.data.length;i+=4){var v=Math.random()*255|0;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=a*255}x.putImageData(d,0,0);return c.toDataURL()}
document.querySelectorAll('[data-grain]').forEach(function(el){var p=el.getAttribute('data-grain').split(',').map(Number);el.style.backgroundImage='url('+n(p[0],p[1]||180)+')';el.style.backgroundSize=(p[2]||p[1]||180)+'px'})})();</script>`;
const BASE = `*{box-sizing:border-box;margin:0;padding:0}html,body{width:1600px;height:1000px;overflow:hidden}
body{position:relative;font-family:"IBM Plex Sans",sans-serif;-webkit-font-smoothing:antialiased}
.abs{position:absolute}.grain{position:absolute;inset:0;pointer-events:none;border-radius:inherit}
.disp{font-family:"Readex Pro",sans-serif}.mono{font-family:"IBM Plex Mono",monospace}.ar{font-family:"Vazirmatn",sans-serif;direction:rtl}
.light{position:absolute;inset:0;pointer-events:none}
.sh-paper{box-shadow:1px 2px 2px rgba(20,18,12,.10),6px 12px 18px rgba(20,18,12,.12),18px 34px 60px rgba(20,18,12,.16)}
.sh-obj{box-shadow:2px 3px 3px rgba(0,0,0,.22),8px 14px 22px rgba(0,0,0,.20),22px 40px 70px rgba(0,0,0,.18)}`;
const page = (title, css, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${FONTS}<style>${BASE}${css}</style></head><body>${DEFS}${body}${GRAIN}</body></html>`;

// ---------- reusable objects ----------
const businessCardInk = (x, y, rot, w = 350) => `<div class="abs sh-obj" style="left:${x}px;top:${y}px;width:${w}px;height:${Math.round(w * 55 / 85)}px;transform:rotate(${rot}deg);border-radius:6px;background:linear-gradient(135deg,#182030,#0E1420 55%,#0B1019);display:flex;align-items:center;justify-content:center">
  <div class="grain" data-grain=".05,160" style="mix-blend-mode:overlay"></div>
  ${mark(Math.round(w * 0.3), 'url(#foil)', 'url(#foil)', { filter: 'foilSheen' })}
</div>`;
const businessCardWhite = (x, y, rot, w = 350) => `<div class="abs sh-obj" style="left:${x}px;top:${y}px;width:${w}px;height:${Math.round(w * 55 / 85)}px;transform:rotate(${rot}deg);border-radius:6px;background:linear-gradient(135deg,#FFFFFF,#F4F3EE);padding:${Math.round(w * .085)}px;display:flex;flex-direction:column;justify-content:space-between">
  <div class="grain" data-grain=".045,160" style="mix-blend-mode:multiply"></div>
  ${lockup(Math.round(w * 0.09), C.ink, 'url(#foil)', C.ink)}
  <div style="position:relative"><div class="disp" style="font-weight:600;font-size:${(w * .045).toFixed(1)}px;color:${C.ink}">Your Name</div><div style="font-size:${(w * .032).toFixed(1)}px;color:${C.slate};margin-top:2px">Founder</div><div class="mono" style="font-size:${(w * .028).toFixed(1)}px;color:${C.slate};margin-top:${Math.round(w * .03)}px;line-height:1.6">hello@hemlohq.com<br>hemlohq.com</div></div>
</div>`;
const brassStamp = (x, y, d = 180) => `<div class="abs" style="left:${x}px;top:${y}px;width:${d}px;height:${d}px;border-radius:50%;
  background:radial-gradient(circle at 34% 30%,#F6E6B4 0%,#D9B869 18%,#B38B3A 46%,#7E5F1F 78%,#5C4414 100%);
  box-shadow:inset -6px -8px 14px rgba(60,40,5,.45),inset 5px 6px 10px rgba(255,245,210,.55),3px 5px 4px rgba(0,0,0,.28),14px 22px 34px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center">
  <div style="width:${Math.round(d * .74)}px;height:${Math.round(d * .74)}px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#6A4A2A,#3E2716 70%,#2A190D);box-shadow:inset 3px 4px 8px rgba(255,220,170,.25),inset -4px -6px 10px rgba(0,0,0,.5),0 2px 3px rgba(0,0,0,.4)">
    <div class="grain" data-grain=".12,120" style="mix-blend-mode:overlay;border-radius:50%;position:relative;width:100%;height:100%"></div>
  </div>
</div>`;
const pen = (x, y, rot, len = 430) => `<div class="abs" style="left:${x}px;top:${y}px;width:20px;height:${len}px;transform:rotate(${rot}deg);transform-origin:center">
  <div style="position:absolute;inset:0;border-radius:10px 10px 6px 6px;background:linear-gradient(90deg,#05070B 0%,#2A3140 30%,#141A24 55%,#05070B 100%);box-shadow:4px 8px 10px rgba(0,0,0,.28),14px 26px 30px rgba(0,0,0,.18)"></div>
  <div style="position:absolute;left:0;right:0;top:${Math.round(len * .22)}px;height:10px;background:linear-gradient(90deg,#7C5E1E,#F2DEA0 40%,#B38B3A 70%,#6C4F17)"></div>
  <div style="position:absolute;left:7px;top:14px;width:7px;height:${Math.round(len * .3)}px;border-radius:3px;background:linear-gradient(90deg,#8F6E27,#F4E2A8 50%,#9C7A2C);box-shadow:1px 2px 2px rgba(0,0,0,.35)"></div>
  <div style="position:absolute;left:5px;bottom:-16px;width:10px;height:22px;clip-path:polygon(0 0,100% 0,60% 100%,40% 100%);background:linear-gradient(90deg,#9C7A2C,#F2DEA0,#8F6E27)"></div>
</div>`;
// Iraqi tea: istikan on saucer, top-down
const istikan = (x, y, d = 190) => `<div class="abs" style="left:${x}px;top:${y}px;width:${d}px;height:${d}px">
  <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 40% 35%,#FFFFFF,#F1EFE9 60%,#E2DFD6);box-shadow:3px 5px 5px rgba(0,0,0,.18),12px 20px 30px rgba(0,0,0,.20)"></div>
  <div style="position:absolute;inset:${Math.round(d * .07)}px;border-radius:50%;border:2px solid #C9A24E;opacity:.85"></div>
  <div style="position:absolute;inset:${Math.round(d * .1)}px;border-radius:50%;border:1px solid #D9B869;opacity:.6"></div>
  <div style="position:absolute;left:${Math.round(d * .22)}px;top:${Math.round(d * .22)}px;width:${Math.round(d * .56)}px;height:${Math.round(d * .56)}px;border-radius:50%;
    background:radial-gradient(circle at 50% 50%,#4A1603 0%,#6E2508 45%,#9A3C12 75%,#C06A2E 88%,rgba(255,255,255,.55) 91%,rgba(255,255,255,.2) 100%);
    box-shadow:4px 7px 9px rgba(60,20,0,.25),inset -4px -5px 10px rgba(0,0,0,.25)"></div>
  <div style="position:absolute;left:${Math.round(d * .33)}px;top:${Math.round(d * .29)}px;width:${Math.round(d * .16)}px;height:${Math.round(d * .08)}px;border-radius:50%;background:rgba(255,255,255,.35);filter:blur(3px);transform:rotate(-25deg)"></div>
  <div style="position:absolute;left:${Math.round(d * .62)}px;top:${Math.round(d * .55)}px;width:7px;height:${Math.round(d * .5)}px;border-radius:4px;transform:rotate(-38deg);transform-origin:top;background:linear-gradient(90deg,#9A9DA3,#F2F3F5 50%,#8B8E94);box-shadow:3px 4px 4px rgba(0,0,0,.22)"></div>
</div>`;
const signature = (w, color) => `<svg width="${w}" height="${Math.round(w * .32)}" viewBox="0 0 200 64" style="overflow:visible"><path d="M6 44C18 40 24 18 34 14c9-4 6 30-2 38-6 6-4-10 6-16 12-7 16 6 24 3 7-3 8-14 15-13 8 1 3 19 11 19 6 0 9-11 16-11 6 0 5 9 11 9 8 0 14-12 24-14 8-2 12 4 20 1 9-3 14-10 24-12" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/></svg>`;

const scenes = {};

// ===== 01 · Stationery flat lay =====
scenes['01-stationery'] = page('Hemlo stationery', `
body{background:#C9C8C1}
.surf{position:absolute;inset:0;background:radial-gradient(1400px 1000px at 18% 8%,#E1E0DA 0%,#CBCAC3 45%,#B3B2AB 100%)}
.sheet{position:absolute;left:150px;top:70px;width:600px;height:848px;transform:rotate(-5deg);background:linear-gradient(160deg,#FFFFFF,#F6F5F0);padding:52px 54px;color:${C.ink}}
.sheet p{font-size:10.8px;line-height:1.72;color:#2B3445;margin-top:12px;max-width:470px}
.env{position:absolute;left:830px;top:58px;width:520px;height:262px;transform:rotate(6deg);border-radius:4px;background:linear-gradient(160deg,#1A2231,#111823);overflow:hidden}
.flap{position:absolute;left:0;top:0;right:0;height:62%;clip-path:polygon(0 0,100% 0,50% 100%);background:linear-gradient(180deg,#1E2737,#151C29);filter:drop-shadow(0 3px 3px rgba(0,0,0,.4))}
`, `
<div class="surf"></div><div class="grain" data-grain=".07,200" style="mix-blend-mode:multiply"></div>
<div class="sheet sh-paper">
  <div class="grain" data-grain=".04,160" style="mix-blend-mode:multiply"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative">${lockup(34, C.ink, 'url(#foil)', C.ink)}<div class="mono" style="font-size:9.5px;color:${C.slate};text-align:right;line-height:1.7">hemlohq.com<br>hello@hemlohq.com</div></div>
  <div class="mono" style="font-size:9.5px;color:${C.slate};margin-top:64px;position:relative">27 September 2026</div>
  <div class="disp" style="font-size:15px;font-weight:600;margin-top:18px;position:relative">Hemlo is coming soon</div>
  <div style="position:relative">
  <p>Dear partner,</p>
  <p>Over the past months we have studied how Iraqi businesses run their daily work: the notebooks, the WhatsApp groups, the stamped receipts and the people who remember everything. Hemlo is what came out of that work: a family of small, focused software products, each built to do one job properly.</p>
  <p>Our first products are in development and will be introduced in the coming months. We would value the chance to show you what we are building, and to learn how your work runs today.</p>
  <p>With respect,</p>
  <div style="margin-top:6px">${signature(150, '#1D2B5E')}</div>
  <p style="margin-top:0">Founder, Hemlo</p>
  </div>
  <div style="position:absolute;left:54px;right:54px;bottom:44px;border-top:1px solid #D7B46A;padding-top:12px;display:flex;justify-content:space-between;font-size:9.5px;color:${C.slate}"><span class="mono">Elegantly solved.</span><span class="ar" style="font-size:10px">حلولٌ بإتقان</span></div>
</div>
<div class="env sh-obj"><div class="grain" data-grain=".05,160" style="mix-blend-mode:overlay"></div><div class="flap"></div>
  <div style="position:absolute;left:50%;top:48%;transform:translate(-50%,-50%)">${mark(56, 'url(#foil)', 'url(#foil)', { filter: 'foilSheen' })}</div>
</div>
${pen(800, 330, 24, 400)}
${businessCardWhite(905, 470, -13)}
${businessCardInk(1130, 700, -4)}
${brassStamp(1360, 385, 176)}
<div class="light" style="background:radial-gradient(1200px 900px at 20% 5%,rgba(255,255,255,.16),transparent 60%)"></div>
<div class="light" style="background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(20,18,12,.22) 100%)"></div>
`);

// ===== 02 · The company stamp =====
const ringText = 'HEMLO · ELEGANTLY SOLVED · IRAQ · 2026 · ';
const stampImpression = (d) => `<svg width="${d}" height="${d}" viewBox="0 0 300 300" style="overflow:visible">
<defs><path id="ringp" d="M150 150m-124 0a124 124 0 1 1 248 0a124 124 0 1 1 -248 0"/></defs>
<g filter="url(#ink)" fill="#2B3A86" stroke="#2B3A86">
  <circle cx="150" cy="150" r="143" fill="none" stroke-width="5"/>
  <circle cx="150" cy="150" r="108" fill="none" stroke-width="2"/>
  <text font-family="Readex Pro" font-weight="600" font-size="19" letter-spacing="4.2" stroke="none"><textPath href="#ringp" startOffset="0">${ringText}</textPath></text>
  <g transform="translate(96 72) scale(4.5)" stroke="none"><path d="${M.A}"/><path d="${M.B}"/></g>
  <text x="150" y="222" text-anchor="middle" font-family="Vazirmatn" font-weight="700" font-size="22" stroke="none">هيملو</text>
</g></svg>`;
scenes['02-company-stamp'] = page('Hemlo company stamp', `
body{background:#BDB9AF}
.surf{position:absolute;inset:0;background:radial-gradient(1400px 1000px at 22% 10%,#D8D4CA,#BDB9AF 50%,#A29E94)}
.doc{position:absolute;left:170px;top:60px;width:980px;height:1260px;transform:rotate(-3deg);background:linear-gradient(170deg,#FFFFFF,#F7F6F1);padding:64px 70px;color:${C.ink}}
.row{display:grid;grid-template-columns:60px 1fr 140px 160px;padding:13px 0;border-bottom:1px solid #E2E2DB;font-size:15px;align-items:center}
.row.h{font-family:"IBM Plex Mono";font-size:11.5px;letter-spacing:.08em;color:${C.slate};border-bottom:1.5px solid ${C.ink}}
.num{font-family:"IBM Plex Mono";text-align:right}
.pad{position:absolute;left:1290px;top:110px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#E9EAEE,#AEB1B8 45%,#6E727A 80%,#50545B);box-shadow:3px 5px 5px rgba(0,0,0,.25),14px 24px 36px rgba(0,0,0,.25)}
.pad .in{position:absolute;inset:16px;border-radius:50%;background:radial-gradient(circle at 45% 40%,#34448F,#1E2A66 60%,#141C47);box-shadow:inset 3px 5px 10px rgba(0,0,0,.55)}
`, `
<div class="surf"></div><div class="grain" data-grain=".08,220" style="mix-blend-mode:multiply"></div>
<div class="doc sh-paper">
  <div class="grain" data-grain=".04,160" style="mix-blend-mode:multiply"></div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;position:relative">${lockup(46, C.ink, C.brass, C.ink)}
    <div style="text-align:right"><div class="disp" style="font-size:26px;font-weight:600">Delivery note</div><div class="ar" style="font-size:20px;font-weight:600;color:${C.slate};margin-top:2px">وصل تسليم</div></div></div>
  <div class="mono" style="display:flex;gap:40px;margin-top:40px;font-size:13px;color:${C.slate};position:relative"><span>No. HML-DN-2026-0142</span><span>27 Sep 2026</span><span>Client: Nahr Trading (sample)</span></div>
  <div style="margin-top:34px;position:relative">
    <div class="row h"><span>#</span><span>ITEM</span><span style="text-align:right">QTY</span><span style="text-align:right">AMOUNT (IQD)</span></div>
    <div class="row"><span class="mono">01</span><span>Shipment file setup · <span class="ar" style="font-size:14px">إعداد ملف الشحنة</span></span><span class="num">1</span><span class="num">250,000</span></div>
    <div class="row"><span class="mono">02</span><span>Deposit schedule 2026 · <span class="ar" style="font-size:14px">جدول الأمانات</span></span><span class="num">1</span><span class="num">150,000</span></div>
    <div class="row"><span class="mono">03</span><span>Supplier document review · <span class="ar" style="font-size:14px">مراجعة مستندات المورّد</span></span><span class="num">6</span><span class="num">180,000</span></div>
    <div class="row" style="border-bottom:none;font-weight:600"><span></span><span>Total · <span class="ar" style="font-size:14px">المجموع</span></span><span></span><span class="num">580,000</span></div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:70px;position:relative">
    <div><div class="mono" style="font-size:12px;color:${C.slate}">Received by · <span class="ar">المستلم</span></div><div style="margin-top:14px">${signature(210, '#1D2B5E')}</div><div style="border-top:1px solid #CBCBC2;width:260px;margin-top:4px"></div></div>
    <div style="position:relative;width:300px;height:300px;margin-top:-40px;margin-right:30px"><div style="position:absolute;inset:0;transform:rotate(11deg);mix-blend-mode:multiply;opacity:.92">${stampImpression(300)}</div></div>
  </div>
  <div style="position:absolute;left:70px;right:70px;bottom:40px;border-top:1px solid #D7B46A;padding-top:12px;display:flex;justify-content:space-between;font-size:12px;color:${C.slate}"><span class="mono">Elegantly solved.</span><span class="ar">حلولٌ بإتقان</span></div>
</div>
<div class="pad"><div class="in"><div class="grain" data-grain=".18,120" style="mix-blend-mode:overlay;border-radius:50%"></div></div></div>
${brassStamp(1280, 560, 230)}
<div class="light" style="background:radial-gradient(1200px 900px at 22% 6%,rgba(255,255,255,.14),transparent 60%)"></div>
<div class="light" style="background:radial-gradient(ellipse at 45% 45%,transparent 55%,rgba(20,18,12,.26) 100%)"></div>
`);

// ===== 03 · Reception sign, brushed brass on dark plaster =====
scenes['03-reception-sign'] = page('Hemlo reception sign', `
body{background:#1B212B}
.wall{position:absolute;left:0;right:0;top:0;height:820px;background:radial-gradient(900px 620px at 50% 22%,#3A4250 0%,#262D38 45%,#181D25 100%)}
.counter{position:absolute;left:0;right:0;top:820px;bottom:0;background:linear-gradient(180deg,#3A3F47 0%,#23272E 12%,#16191E 100%)}
.counter:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:rgba(255,255,255,.18)}
.sign{position:absolute;left:50%;top:320px;transform:translateX(-50%);filter:drop-shadow(10px 16px 9px rgba(0,0,0,.55)) drop-shadow(3px 4px 2px rgba(0,0,0,.4))}
.sub{position:absolute;left:0;right:0;top:560px;display:flex;justify-content:center;gap:34px;align-items:center}
.brasstext{background:linear-gradient(180deg,#F2DEA0,#C9A24E 45%,#8F6E27 70%,#D9B869);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(3px 5px 3px rgba(0,0,0,.5))}
`, `
<div class="wall"></div><div class="grain" data-grain=".11,200,420" style="mix-blend-mode:overlay;bottom:180px"></div><div class="grain" data-grain=".06,140" style="mix-blend-mode:soft-light;bottom:180px"></div>
<div class="sign">${lockup(150, 'url(#brassH)', 'url(#brassH)', 'url(#brassH)', { filter: 'brushed' })}</div>
<div class="sub"><span class="ar brasstext" style="font-size:44px;font-weight:700">هيملو</span><span style="width:2px;height:40px;background:linear-gradient(#C9A24E,#8F6E27);opacity:.7"></span><span class="disp brasstext" style="font-size:30px;font-weight:500;letter-spacing:.01em">Elegantly solved.</span></div>
<div class="counter"><div class="grain" data-grain=".08,160" style="mix-blend-mode:overlay"></div></div>
<div class="light" style="background:radial-gradient(700px 360px at 50% 0%,rgba(255,236,200,.10),transparent 70%)"></div>
<div class="light" style="background:radial-gradient(ellipse at 50% 40%,transparent 50%,rgba(0,0,0,.35) 100%)"></div>
`);

// ===== 04 · Phone on dark desk with cards and Iraqi tea =====
scenes['04-phone-desk'] = page('Hemlo phone', `
body{background:#11161E}
.surf{position:absolute;inset:0;background:radial-gradient(1300px 950px at 25% 12%,#232B37,#141A23 55%,#0C1016)}
.phone{position:absolute;left:470px;top:70px;width:420px;height:862px;transform:rotate(-14deg);border-radius:70px;padding:7px;
  background:linear-gradient(135deg,#9FA4AC,#5B616B 18%,#2A2F37 40%,#6E747D 62%,#30353D 85%,#8C929A);
  box-shadow:4px 8px 6px rgba(0,0,0,.45),18px 34px 40px rgba(0,0,0,.45),40px 70px 110px rgba(0,0,0,.35)}
.bezel{width:100%;height:100%;border-radius:63px;background:#050608;padding:13px}
.screen{position:relative;width:100%;height:100%;border-radius:52px;overflow:hidden;background:${C.stone};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}
.island{position:absolute;top:16px;left:50%;transform:translateX(-50%);width:118px;height:34px;border-radius:20px;background:#000}
.glare{position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,.06) 30%,transparent 46%);pointer-events:none}
`, `
<div class="surf"></div><div class="grain" data-grain=".06,200" style="mix-blend-mode:overlay"></div>
<div class="phone"><div class="bezel"><div class="screen">
  <div class="island"></div>
  ${mark(160, C.ink, C.brass)}
  ${wordmark(44, C.ink)}
  <div class="ar" style="font-size:22px;font-weight:600;color:#2B3445">حلولٌ بإتقان.</div>
  <div class="mono" style="position:absolute;bottom:56px;font-size:12px;letter-spacing:.22em;color:${C.brass700}">COMING SOON</div>
  <div class="glare"></div>
</div></div></div>
${businessCardWhite(1010, 560, 9, 360)}
${businessCardInk(1080, 300, -7, 360)}
${istikan(1250, 690, 200)}
<div class="light" style="background:radial-gradient(1100px 800px at 24% 6%,rgba(255,255,255,.08),transparent 60%)"></div>
<div class="light" style="background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(0,0,0,.35) 100%)"></div>
`);

// ===== 05 · Blind-embossed cotton paper =====
scenes['05-embossed'] = page('Hemlo embossed', `
body{background:#10151D}
.desk{position:absolute;inset:0;background:radial-gradient(900px 900px at 90% 30%,#1C2330,#0E1219)}
.paper{position:absolute;left:-40px;top:-40px;width:1460px;height:1080px;background:linear-gradient(100deg,#F6F4EE 0%,#EFEDE6 45%,#E4E1D8 100%);box-shadow:8px 0 16px rgba(0,0,0,.35),30px 10px 60px rgba(0,0,0,.35)}
.emb{filter:drop-shadow(-2.5px -2.5px 1.6px rgba(255,255,255,.95)) drop-shadow(3.5px 4.5px 3.5px rgba(80,70,50,.32)) drop-shadow(1px 1px .6px rgba(80,70,50,.25))}
`, `
<div class="desk"></div><div class="grain" data-grain=".07,180" style="mix-blend-mode:overlay"></div>
<div class="paper">
  <div style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:54px;padding-top:30px">
    <div class="emb">${mark(400, '#EFEDE6', '#EFEDE6')}</div>
    ${wordmark(62, 'url(#foil)', { filter: 'foilSheen' })}
  </div>
  <div class="grain" data-grain=".09,220" style="mix-blend-mode:multiply"></div>
  <div class="grain" data-grain=".05,120,360" style="mix-blend-mode:multiply"></div>
</div>
<div class="light" style="background:linear-gradient(100deg,rgba(255,255,255,.18) 0%,transparent 35%,rgba(0,0,0,.10) 78%)"></div>
<div class="light" style="background:radial-gradient(ellipse at 45% 50%,transparent 58%,rgba(0,0,0,.28) 100%)"></div>
`);

// ===== 06 · Website on a display =====
const SITE = `<div style="width:1920px;height:1080px;background:${C.stone};position:relative;font-family:'IBM Plex Sans'">
  <div style="display:flex;align-items:center;padding:40px 96px">${lockup(44, C.ink, C.brass, C.ink)}
    <div style="display:flex;gap:44px;margin-left:90px;font-size:19px;color:#2B3445"><span>Products</span><span>How we build</span><span>Field notes</span><span>About</span></div>
    <div style="margin-left:auto;display:flex;gap:30px;align-items:center;font-size:19px"><span class="ar">العربية</span><span style="background:${C.ink};color:#fff;border-radius:10px;padding:14px 24px">Talk to us</span></div></div>
  <div style="display:grid;grid-template-columns:1fr 600px;gap:40px;padding:80px 96px 0;align-items:center">
    <div><div class="mono" style="font-size:16px;letter-spacing:.22em;color:${C.brass700}">COMING SOON</div>
      <div class="disp" style="font-size:118px;font-weight:600;letter-spacing:-0.03em;line-height:1;margin-top:26px;color:${C.ink}">Elegantly solved.</div>
      <div style="font-size:26px;color:${C.slate};margin-top:30px;max-width:820px;line-height:1.5">Software that earns its place. Focused software for the everyday work of Iraqi businesses.</div>
      <div style="display:flex;gap:14px;margin-top:46px"><div style="background:#fff;border:1px solid #E2E2DB;border-radius:10px;padding:18px 20px;width:380px;color:${C.slate};font-size:19px">Your WhatsApp number</div><div style="background:${C.ink};color:#fff;border-radius:10px;padding:18px 26px;font-size:19px">Notify me</div></div>
      <div class="ar" style="font-size:30px;font-weight:600;color:#2B3445;margin-top:36px;text-align:left">حلولٌ بإتقان.</div></div>
    <div>${mark(600, C.ink, C.brass)}</div>
  </div></div>`;
const istikanSide = (x, y, s = 1) => `<svg class="abs" style="left:${x}px;top:${y}px;overflow:visible" width="${120 * s}" height="${150 * s}" viewBox="0 0 120 150">
  <defs><linearGradient id="teaSide" x1="0" x2="1"><stop offset="0" stop-color="#5A1B05"/><stop offset=".5" stop-color="#A8461A"/><stop offset="1" stop-color="#4E1604"/></linearGradient>
  <linearGradient id="glassSide" x1="0" x2="1"><stop offset="0" stop-color="rgba(255,255,255,.55)"/><stop offset=".2" stop-color="rgba(255,255,255,.05)"/><stop offset=".8" stop-color="rgba(255,255,255,.05)"/><stop offset="1" stop-color="rgba(255,255,255,.4)"/></linearGradient></defs>
  <ellipse cx="60" cy="138" rx="58" ry="10" fill="rgba(0,0,0,.35)"/>
  <ellipse cx="60" cy="133" rx="56" ry="10" fill="#F2F0EA"/><ellipse cx="60" cy="131" rx="44" ry="6.5" fill="none" stroke="#C9A24E" stroke-width="1.6"/>
  <path d="M32 22 C30 50 46 62 44 84 C42 104 34 112 38 128 L82 128 C86 112 78 104 76 84 C74 62 90 50 88 22 Z" fill="url(#teaSide)"/>
  <path d="M30 12 C28 48 44 60 42 84 C40 104 32 112 36 130 L84 130 C88 112 80 104 78 84 C76 60 92 48 90 12 Z" fill="url(#glassSide)" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
  <ellipse cx="60" cy="12" rx="30" ry="4" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.2"/>
  <ellipse cx="60" cy="22" rx="28" ry="3.4" fill="#C06A2E" opacity=".75"/>
  <path d="M38 30 C36 52 48 62 47 84" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
scenes['06-website-display'] = page('Hemlo website display', `
body{background:#DEDCD5}
.wall{position:absolute;left:0;right:0;top:0;height:735px;background:radial-gradient(1200px 700px at 50% 30%,#EDECE7,#DCDAD3 60%,#C9C7C0)}
.desk{position:absolute;left:0;right:0;top:735px;bottom:0;background:linear-gradient(180deg,#2E333B 0%,#1E2228 30%,#15181D 100%)}
.desk:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,.3),rgba(255,255,255,.08))}
.mon{position:absolute;left:260px;top:70px;width:1080px;height:626px;border-radius:18px;background:#0A0C0F;padding:14px;box-shadow:0 2px 0 #1A1D22,0 30px 60px rgba(20,18,12,.25),0 60px 120px rgba(20,18,12,.18)}
.scr{width:100%;height:100%;border-radius:6px;overflow:hidden;position:relative;background:${C.stone}}
.scr .inner{transform:scale(${(1052 / 1920).toFixed(5)});transform-origin:0 0}
.glare{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,.03) 38%,transparent 50%);pointer-events:none}
.neck{position:absolute;left:748px;top:696px;width:104px;height:66px;background:linear-gradient(90deg,#8C9097,#D9DCE0 45%,#A5A9AF 70%,#7C8087)}
.base{position:absolute;left:640px;top:752px;width:320px;height:22px;border-radius:6px 6px 10px 10px;background:linear-gradient(180deg,#E3E5E8,#A9ADB3 55%,#6F737A);box-shadow:0 10px 18px rgba(0,0,0,.5)}
`, `
<div class="wall"></div><div class="grain" data-grain=".05,200" style="mix-blend-mode:multiply;bottom:265px"></div>
<div class="desk"><div class="grain" data-grain=".07,180" style="mix-blend-mode:overlay"></div></div>
<div class="neck"></div><div class="base"></div>
<div class="mon"><div class="scr"><div class="inner">${SITE}</div><div class="glare"></div></div></div>
${istikanSide(1350, 640, 1.1)}
<div class="abs" style="left:330px;top:770px;transform:perspective(900px) rotateX(62deg) rotateZ(-10deg);transform-origin:center">${businessCardInk(0, 0, 0, 260)}</div>
<div class="light" style="background:radial-gradient(ellipse at 50% 40%,transparent 60%,rgba(0,0,0,.22) 100%)"></div>
`);

Object.entries(scenes).forEach(([n, html]) => fs.writeFileSync(path.join(OUT_SRC, n + '.html'), html));
console.log(Object.keys(scenes).join('\n'));
