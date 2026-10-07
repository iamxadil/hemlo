// Sample supplier invoices for the AI invoice scan: an Iraqi wholesaler's printed invoice, photographed on a shop counter.
// Its lines are the demo shop's first delivery (apps/api/src/demo-data.ts), so the demo's ready-made result matches it.
// Run: npx tsx scripts/ai-samples/make-invoice.ts → scripts/ai-samples/invoice-*.jpg
import { chromium } from 'playwright-core';
const lines = [
  ['بيبسي 330 مل (كارتون 24)', 'كارتون', 3, 10000],
  ['ماء 500 مل (كارتون 12)', 'كارتون', 5, 2400],
  ['سكر 1 كغ', 'كيس', 20, 1150],
  ['شيبس ليز (كارتون 24)', 'كارتون', 2, 9600],
] as const;
const total = lines.reduce((s, l) => s + l[2] * l[3], 0);
const n = (v: number) => v.toLocaleString('en-US');
const html = (photo: boolean) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  body { margin: 0; background: ${photo ? 'radial-gradient(120% 90% at 30% 20%, #8a6b4e, #4b3626)' : '#fff'}; font-family: 'Segoe UI', Tahoma, sans-serif; }
  .stage { width: 1100px; height: ${photo ? 1450 : 1300}px; display: grid; place-items: center; }
  .paper { width: 820px; padding: 46px 52px; background: #fbf8f1; color: #1d1a16; box-shadow: ${photo ? '0 30px 60px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.3)' : 'none'};
    transform: ${photo ? 'rotate(-2.4deg) perspective(1400px) rotateX(4deg)' : 'none'}; background-image: ${photo ? 'linear-gradient(115deg, rgba(0,0,0,.05), transparent 40%, rgba(255,255,255,.35) 60%, rgba(0,0,0,.06))' : 'none'}; }
  h1 { margin: 0; font-size: 34px; } .sub { color: #5c554b; font-size: 17px; margin-top: 4px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #333; padding-bottom: 16px; }
  .meta { text-align: left; font-size: 17px; line-height: 1.7; } .meta b { font-family: Consolas, monospace; }
  .to { margin: 18px 0; font-size: 19px; }
  table { width: 100%; border-collapse: collapse; font-size: 19px; } th, td { border: 1px solid #555; padding: 10px 12px; } th { background: #e9e2d3; }
  td.num { text-align: center; font-family: Consolas, monospace; }
  .sum { margin-top: 18px; font-size: 21px; display: grid; grid-template-columns: 1fr auto; gap: 6px 30px; width: 60%; margin-inline-start: auto; }
  .sum b { font-family: Consolas, monospace; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; font-size: 17px; color: #444; }
  .scrawl { font-family: 'Segoe Script', cursive; font-size: 30px; color: #1f3c8a; transform: rotate(-6deg); display: inline-block; }
  .stamp { width: 130px; height: 130px; border: 4px double rgba(160,30,40,.75); border-radius: 50%; color: rgba(160,30,40,.8); display: grid; place-items: center; text-align: center; font-weight: 700; transform: rotate(14deg); font-size: 16px; }
</style></head><body><div class="stage"><div class="paper">
  <div class="head"><div><h1>جملة بغداد للمواد الغذائية</h1><div class="sub">الشورجة · بغداد · 0790 123 4567</div></div>
    <div class="meta">فاتورة رقم: <b>INV-4200</b><br>التاريخ: <b>26/09/2026</b></div></div>
  <div class="to">السيد: <b>ماركت النور</b> — المحترم</div>
  <table><thead><tr><th>ت</th><th>المادة</th><th>الوحدة</th><th>العدد</th><th>السعر</th><th>المبلغ</th></tr></thead><tbody>
    ${lines.map((l, i) => `<tr><td class="num">${i + 1}</td><td>${l[0]}</td><td>${l[1]}</td><td class="num">${l[2]}</td><td class="num">${n(l[3])}</td><td class="num">${n(l[2] * l[3])}</td></tr>`).join('')}
  </tbody></table>
  <div class="sum"><span>المجموع</span><b>${n(total)}</b><span>الواصل</span><b>50,000</b><span>الباقي</span><b>${n(total - 50000)}</b></div>
  <div class="sign"><div>توقيع المستلم<br><span class="scrawl">أبو علي</span></div><div class="stamp">جملة بغداد<br>للمواد الغذائية</div></div>
</div></div></body></html>`;
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
for (const photo of [false, true]) {
  const p = await (await b.newContext({ viewport: { width: 1100, height: photo ? 1450 : 1300 } })).newPage();
  await p.setContent(html(photo)); await p.waitForTimeout(300);
  await p.screenshot({ path: `scripts/ai-samples/invoice-${photo ? 'photo' : 'clean'}.jpg`, type: 'jpeg', quality: photo ? 72 : 85 });
}
await b.close(); console.log('total', total);
