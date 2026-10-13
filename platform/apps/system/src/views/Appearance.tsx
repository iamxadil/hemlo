// Settings → Appearance: how Hemlo looks on this device. Today the sidebar (Hemlo or the system's classic one) and
// icons only; the place a theme or another layout joins later (see lib/interface.ts).
import { useApp } from '../lib/app';
import { setInterface, useInterface, type Interface } from '../lib/interface';

const W = {
  ar: { title: 'المظهر', note: 'يُحفظ على هذا الجهاز فقط.', sidebar: 'الشريط الجانبي', rail: ['Hemlo', 'الجديد: بطاقة عائمة، منتجات Hemlo في مكانها، ويتّسع لكل شيء.'], classic: ['الكلاسيكي', 'شريط نظامك الأصلي كما كان.'], icons: 'أيقونات فقط', iconsNote: 'شريط ضيّق يترك مساحة أكبر للعمل.' },
  en: { title: 'Appearance', note: 'Saved on this device only.', sidebar: 'Sidebar', rail: ['Hemlo', 'The new one: a floating card, Hemlo products in their place, and room for everything.'], classic: ['Classic', 'Your system’s original sidebar, as it was.'], icons: 'Icons only', iconsNote: 'A slim sidebar that leaves more room for work.' },
  ckb: { title: 'ڕووکار', note: 'تەنها لەسەر ئەم ئامێرە پاشەکەوت دەکرێت.', sidebar: 'شریتی لاتەنیشت', rail: ['Hemlo', 'نوێ: کارتێکی بەرز، بەرهەمەکانی Hemlo لە شوێنی خۆیان، و جێگە بۆ هەموو شت.'], classic: ['کلاسیک', 'شریتی ڕەسەنی سیستەمەکەت وەک خۆی.'], icons: 'تەنها ئایکۆن', iconsNote: 'شریتێکی باریک کە جێگەی زیاتر بۆ کار دەهێڵێتەوە.' },
} as const;

export function Appearance() {
  const { lang, sys } = useApp();
  const ui = useInterface();
  const w = W[lang] ?? W.ar;
  if (sys.business.kind === 'school') return null; // the school has its own bar, no sidebar to choose
  const opt = (k: Interface['sidebar']) => (
    <button key={k} className="ap-opt" role="radio" aria-checked={ui.sidebar === k} onClick={() => setInterface({ sidebar: k })}>
      <span className={`ap-mock ${k}`} aria-hidden><i /><span><b /><b /><b /><b /></span><em /></span>
      <span className="ap-t"><b>{w[k][0]}</b><small>{w[k][1]}</small></span>
    </button>
  );
  return (
    <section className="panel grid gap-3 p-5">
      <div><p className="sec-t">{w.title}</p><p className="muted text-sm">{w.note}</p></div>
      <p className="text-sm font-medium">{w.sidebar}</p>
      <div className="ap-opts" role="radiogroup" aria-label={w.sidebar}>{opt('rail')}{opt('classic')}</div>
      {ui.sidebar === 'rail' && (
        <label className="ap-row"><span className="flex-1"><b className="block text-sm font-medium">{w.icons}</b><small className="muted text-xs">{w.iconsNote}</small></span>
          <input type="checkbox" className="ap-switch" checked={ui.compact} onChange={(e) => setInterface({ compact: e.target.checked })} /></label>
      )}
    </section>
  );
}
