// What every website page is rendered from: the request's site, language and addresses, the business's face and
// contact, and the live data its sections show. Shared by the frame (public.ts) and every system's design (designs.ts),
// so a design never reaches into the database itself.
import type { WebSection } from '@hemlo/db/schema';
import type { WebsiteListing, WebsiteListingFilter } from './adapters';
import type { ShopItem, ShopOrderView } from './shop-data';
import { W, pick, esc, fill, type Lang } from './theme';
import type { Deps } from '../../types';
import type { Design } from './designs';

export type Two = { ar?: string; en?: string };
export type Ctx = {
  d: Deps; org: string; site: any; lang: Lang; origin: string; t: (typeof W)[Lang];
  basePath: string;
  pageSlug: string; filters: WebsiteListingFilter;
  logo: string | null; name: string; tagline: string;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null; mapUrl: string | null };
  products: ShopItem[];
  /** a shop's order page: the order its code names */
  order?: ShopOrderView | null;
  listings: WebsiteListing[];
  /** the running section number (01, 02…) and whether the page opens on a photograph */
  n: number; onPhoto: boolean;
  /** the system's own design (designs.ts): which moments this trade's site stages */
  design: Design;
  /** the site's pages, for headers and footers */
  pages: { slug: string; title: any }[];
  /** a sample site (the public showcase): inquiries are not sent anywhere */
  sample?: boolean;
};

export const initials = (n: string) => { const w = (n || '·').trim().split(/\s+/); return /[؀-ۿ]/.test(w[0]) ? (w[0].startsWith('ال') && w[0].length > 2 ? w[0][2] : w[0][0]) : w.slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
export const paras = (s: string) => s.split(/\n{2,}|\r\n\r\n/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
export const strOf = (v: any, lang: Lang): string => { if (v == null) return ''; if (typeof v === 'string') return v; return pick(v as Two, lang); };
export const itemsOf = (sec: WebSection): any[] => (Array.isArray((sec as any).items) ? (sec as any).items : []);
export const field = (sec: WebSection, key: string, lang: Lang) => strOf((sec as any)[key], lang);

export const STATUS: Record<Lang, Record<string, string>> = {
  ar: { available: 'متاح', reserved: 'محجوز', negotiating: 'قيد التفاوض', sold: 'مباع', rented: 'مؤجّر' },
  en: { available: 'Available', reserved: 'Reserved', negotiating: 'Negotiating', sold: 'Sold', rented: 'Rented' },
};
/** An editorial line for a section that has no title of its own. */
export const LINE: Record<Lang, Record<string, string>> = {
  ar: { listings: 'بيوت اخترناها بعناية.', about: 'مكتب يعرف مدينته.', contact: W.ar.letsTalk },
  en: { listings: 'Homes we chose with care.', about: 'An office that knows its city.', contact: W.en.letsTalk },
};

/** "?lang=en" only when the visitor reads the site in its second language, so links keep them there. */
export const langQ = (ctx: Ctx) => (ctx.lang === (ctx.site.lang === 'en' ? 'en' : 'ar') ? '' : `?lang=${ctx.lang}`);
export const pageHref = (ctx: Ctx, slug: string) => `${ctx.basePath}/${slug}${langQ(ctx)}`;
export const propHref = (ctx: Ctx, slug: string) => `${ctx.basePath}/properties/${encodeURIComponent(slug)}${langQ(ctx)}`;
export const listQ = (ctx: Ctx, extra: Record<string, string> = {}) => {
  const q = new URLSearchParams(extra);
  if (ctx.lang !== (ctx.site.lang === 'en' ? 'en' : 'ar')) q.set('lang', ctx.lang);
  const s = q.toString();
  return `${ctx.basePath}/properties${s ? `?${s}` : ''}`;
};
export const factsOf = (ctx: Ctx, l: { bedrooms: number | null; bathrooms: number | null; size: number | null }) => [
  l.bedrooms ? fill(ctx.t.beds, { n: l.bedrooms }) : '', l.bathrooms ? fill(ctx.t.baths, { n: l.bathrooms }) : '', l.size ? fill(ctx.t.sqm, { n: l.size }) : '',
].filter(Boolean).join(' · ');
