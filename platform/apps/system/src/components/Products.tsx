// Hemlo's own products (Connect, AI Studio, Website) apart from the business's daily pages: their own colour, a line on
// what they do, and where the business stands with each. Shared by every frame and sidebar that shows them.
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp } from '../lib/app';
import type { Page } from '../pages';
import { Icon } from './ui';
import '../styles/products.css';

export const PRODUCTS = ['connect', 'marketing', 'website'];
const W = {
  ar: { group: 'منتجات Hemlo', connect: ['Connect', 'واتساب ومساعد ذكي'], marketing: ['AI Studio', 'تسويق بالذكاء الاصطناعي'], website: ['Website', 'عملك على الإنترنت'], on: 'مفعّل', new: 'جديد', add: 'أضِف' },
  en: { group: 'Hemlo products', connect: ['Connect', 'WhatsApp and an AI assistant'], marketing: ['AI Studio', 'Marketing by AI'], website: ['Website', 'Your business online'], on: 'On', new: 'New', add: 'Add' },
  ckb: { group: 'بەرهەمەکانی Hemlo', connect: ['Connect', 'واتساپ و یاریدەدەری زیرەک'], marketing: ['AI Studio', 'بازاڕکردن بە زیرەکی دەستکرد'], website: ['Website', 'کارەکەت لەسەر ئینتەرنێت'], on: 'چالاکە', new: 'نوێ', add: 'زیادکردن' },
} as const;

/** Where the business stands with each product, from the add-ons it has (no answer yet: no badge). */
export function useProducts() {
  const { lang } = useApp();
  const q = useQuery<{ addons: any[] }>({ queryKey: ['billing-addons'], queryFn: () => api('/v1/billing/addons'), staleTime: 60_000, retry: false });
  const w = W[lang] ?? W.ar;
  const on = (code: string) => !!q.data?.addons.some((x) => x.code === code && (x.entitlement?.active || x.included));
  const badge: Record<string, [string, boolean]> = {};
  if (q.data) {
    const tier = on('ai-studio') ? 'Studio' : on('connect-pro') ? 'Pro' : 'Basic';
    badge.connect = [tier, tier !== 'Basic'];
    badge.marketing = on('ai-studio') ? [w.on, true] : [w.new, false];
    badge.website = on('website') ? [w.on, true] : [w.add, false];
  }
  const words = (path: string) => (w as any)[path] as [string, string];
  return { group: w.group, words, badge };
}

/** Three tiles side by side, always in sight (the Hemlo sidebar pins them above the plan). */
export function ProductTiles({ pages, onPage }: { pages: Page[]; onPage(p: Page): boolean }) {
  const { group, words, badge } = useProducts();
  const list = PRODUCTS.map((path) => pages.find((p) => p.path === path)).filter(Boolean) as Page[];
  if (!list.length) return null;
  return (
    <div className="hp">
      <p className="hp-h"><img src="/brand/hemlo-mark.svg" alt="" />{group}</p>
      <div className="hp-row">
        {list.map((p) => { const [name, sub] = words(p.path); const b = badge[p.path]; return (
          <a key={p.path} className={`hp-tile re-pro-i ${p.path}`} href={`#/${p.path}`} aria-current={onPage(p) ? 'page' : undefined} data-tip={name} title={sub}>
            <span className="re-pro-t"><Icon n={p.icon} /></span>
            <b>{name}</b>
            {b && <small className={b[1] ? 'on' : ''}>{b[0]}</small>}
          </a>
        ); })}
      </div>
    </div>
  );
}

/** The card. `paper`: on paper (a menu) instead of the dark rail. */
export function Products({ pages, onPage, paper, onPick }: { pages: Page[]; onPage(p: Page): boolean; paper?: boolean; onPick?(): void }) {
  const { group, words, badge } = useProducts();
  const list = PRODUCTS.map((path) => pages.find((p) => p.path === path)).filter(Boolean) as Page[];
  if (!list.length) return null;
  return (
    <div className={`re-pro${paper ? ' phone' : ''}`}>
      <p className="re-pro-h"><img src="/brand/hemlo-mark.svg" alt="" className="re-pro-m" />{group}</p>
      {list.map((p) => { const [name, sub] = words(p.path); const b = badge[p.path]; return (
        <a key={p.path} className={`re-pro-i ${p.path}`} href={`#/${p.path}`} onClick={onPick} data-tip={name} aria-current={onPage(p) ? 'page' : undefined}>
          <span className="re-pro-t"><Icon n={p.icon} /></span>
          <span className="re-pro-x"><b>{name}</b><small>{sub}</small></span>
          {b && <span className={`re-pro-b${b[1] ? ' on' : ''}`}>{b[0]}</span>}
        </a>
      ); })}
    </div>
  );
}
