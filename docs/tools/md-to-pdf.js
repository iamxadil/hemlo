// Renders a Markdown doc into a Hemlo-branded print HTML (A4). Then print it to PDF with headless Edge/Chrome.
// Usage: node docs/tools/md-to-pdf.js docs/architecture/tech-stack-plan.md  -> docs/architecture/tech-stack-plan.print.html
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const src = path.resolve(process.argv[2]);
const md = fs.readFileSync(src, 'utf8');
const kit = path.resolve(__dirname, '../../brand/logo/svg');
const mark = fs.readFileSync(path.join(kit, 'hemlo-mark-on-dark.svg'), 'utf8');
const lockupDark = fs.readFileSync(path.join(kit, 'hemlo-lockup-on-dark.svg'), 'utf8');

// Split title block (H1 + first two paragraphs) from the body for the cover page
const lines = md.split('\n');
const title = lines.find(l => l.startsWith('# ')).slice(2);
const bodyStart = lines.findIndex(l => l.trim() === '---');
const intro = lines.slice(1, bodyStart).join('\n').trim().split('\n\n').map(p => p.replace(/\*\*/g, ''));
// Sections listed here start on a fresh page (matched against the start of the H2 text, after its number)
const NEW_PAGE = ['Every technology', 'Engineering best practices', 'The five stages',
  'Hemlo Tools', 'Hemlo Studio', 'Hemlo Systems', 'Hemlo School', 'The shared platform', 'System architecture', 'Money', 'Build order',
  'How people sign in', 'Authorization', 'Architecture', 'Data model'];
const body = marked.parse(lines.slice(bodyStart + 1).join('\n'), { gfm: true })
  .replace(/<h2>(\d+\. )([^<]*)/g, (m, num, text) => NEW_PAGE.some(p => text.startsWith(p)) ? `<h2 class="newpage">${num}${text}` : m);
const eyebrow = (process.argv[3] || 'Hemlo · Document').replace(/</g, '&lt;');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&family=Vazirmatn:wght@400;500;600;700;800&display=swap">
<style>
@page{size:A4;margin:18mm 17mm 18mm 17mm}
@page:first{margin:0}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"IBM Plex Sans",sans-serif;font-size:9.6pt;line-height:1.55;color:#0E1420}
.cover{width:210mm;height:297mm;background:#0E1420;color:#F4F3EF;position:relative;overflow:hidden;break-after:page}
.cover .lock{position:absolute;left:20mm;top:20mm;height:11mm}
.cover .lock svg{height:11mm;width:auto}
.cover .seal{position:absolute;right:-50mm;bottom:-60mm;width:160mm;height:160mm}
.cover .seal svg{width:100%;height:100%}
.cover .tx{position:absolute;left:20mm;top:62mm;right:20mm}
.cover .eyebrow{font-family:"IBM Plex Mono";font-size:9pt;letter-spacing:.22em;color:#D7B46A;text-transform:uppercase}
.cover h1{font-family:"Readex Pro";font-weight:600;font-size:40pt;line-height:1.02;letter-spacing:-0.025em;margin:6mm 0 0;max-width:150mm}
.cover .sub{font-size:13pt;line-height:1.45;color:#C9CED6;margin-top:7mm;max-width:130mm}
.cover .meta{position:absolute;left:20mm;bottom:20mm;max-width:62mm;font-family:"IBM Plex Mono";font-size:8.5pt;color:#A3ABB8;letter-spacing:.06em;max-width:82mm;line-height:1.7}
.cover .ar{font-family:"Vazirmatn";font-weight:600;direction:rtl;font-size:15pt;color:#F4F3EF;margin-top:8mm;text-align:left}
h2{font-family:"Readex Pro";font-weight:600;font-size:19pt;letter-spacing:-0.015em;margin:12mm 0 4mm;padding-top:2mm;break-after:avoid}
main > h2:first-child{margin-top:0}
h2.newpage{break-before:page;margin-top:0}
h2::before{content:"";display:block;width:14mm;height:1.2mm;background:#B38B3A;margin-bottom:5mm}
h3{font-family:"Readex Pro";font-weight:600;font-size:12.5pt;margin:7mm 0 2.5mm;break-after:avoid;border-bottom:.3mm solid #E2E2DB;padding-bottom:1.5mm}
h4{font-family:"Readex Pro";font-weight:600;font-size:10.8pt;margin:5mm 0 1.5mm;break-after:avoid;color:#0E1420}
p{margin:0 0 2.6mm}
ul,ol{margin:0 0 3mm;padding-left:5.5mm}
li{margin:0 0 1.1mm}
h4 + ul{break-inside:avoid;background:#F7F7F4;border-left:.8mm solid #D7B46A;padding:2.6mm 4mm 2mm 7mm;border-radius:0 2mm 2mm 0}
h4 + ul li{margin-bottom:.8mm}
strong{font-weight:600}
code{font-family:"IBM Plex Mono",Consolas,monospace;font-size:8.4pt;background:#EFEFEA;padding:.2mm 1.2mm;border-radius:1mm}
pre{background:#F4F3EF;border:.3mm solid #E2E2DB;border-radius:2mm;padding:4mm;overflow:hidden;break-inside:avoid;margin:3mm 0 4mm}
pre code{background:none;padding:0;font-size:7.6pt;line-height:1.35;white-space:pre}
table{width:100%;border-collapse:collapse;margin:3mm 0 5mm;font-size:8.6pt;break-inside:auto}
tr{break-inside:avoid}
th{font-family:"IBM Plex Mono";font-weight:500;font-size:7.4pt;letter-spacing:.06em;text-transform:uppercase;color:#5E6776;background:#EFEFEA;text-align:left;padding:2mm 2.5mm;border-bottom:.4mm solid #0E1420}
td{padding:2mm 2.5mm;border-bottom:.25mm solid #E2E2DB;vertical-align:top}
hr{border:none;height:0;margin:0}
a{color:#8A6A22;text-decoration:none;word-break:break-all}
input[type=checkbox]{margin:0 2mm 0 0;transform:translateY(.4mm)}
li:has(> input[type=checkbox]){list-style:none;margin-left:-5mm}
.end{margin-top:10mm;padding-top:4mm;border-top:.3mm solid #E2E2DB;display:flex;justify-content:space-between;align-items:center;color:#5E6776;font-size:8pt}
</style></head><body>
<section class="cover">
  <div class="lock">${lockupDark}</div>
  <div class="tx">
    <div class="eyebrow">${eyebrow}</div>
    <h1>${title.replace('Hemlo ', 'Hemlo<br>')}</h1>
    <div class="sub">${intro[0] || ''}</div>
    <div class="ar">حلولٌ بإتقان.</div>
  </div>
  <div class="seal">${mark}</div>
  <div class="meta">${(intro[1] || '').replace(/`/g, '')}</div>
</section>
<main>${body}
<div class="end"><span>Hemlo · Elegantly solved.</span><span>hemlohq.com</span></div>
</main>
</body></html>`;
const out = src.replace(/\.md$/, '.print.html');
fs.writeFileSync(out, html);
console.log(out);
