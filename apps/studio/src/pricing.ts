// Hemlo Studio pricing: the single source of truth for every price on studio.hemlohq.com.
// Change a number here and the price tables, the plan cards and the quote builder all update.
// Amounts are in Iraqi dinars (IQD). USD is shown for reference at RATE.

export const RATE = 1500; // IQD per USD, for the USD display only

export type ProjectType = 'website' | 'store' | 'webapp' | 'mobile' | 'system';
export type Care = 'none' | 'basic' | 'business' | 'priority';
export type Complexity = 'simple' | 'moderate' | 'complex';

export const PRICES = {
  website: { firstPage: 200_000, perPage: 40_000, minPages: 1, maxPages: 30 },
  store: {
    base: 600_000, // up to 50 products, cart, orders, admin, cash on delivery
    catalogue: [
      { id: 's', upTo: 50, add: 0 },
      { id: 'm', upTo: 500, add: 150_000 },
      { id: 'l', upTo: 2000, add: 300_000 },
    ],
  },
  webapp: { from: 900_000 },
  mobile: { from: 1_500_000 },
  system: { from: 1_200_000 },
  complexity: { simple: 1, moderate: 1.3, complex: 1.6 } as Record<Complexity, number>,
  addons: {
    cms: 150_000,            // edit texts, images and pages yourself (websites; stores include an admin)
    languagePct: 0.2,        // each extra language, as a share of the build
    blog: 100_000,
    booking: 200_000,
    payments: 250_000,       // FIB / ZainCash / cards
    copyPerPage: 20_000,     // we write the content
    seo: 75_000,
    brand: 200_000,          // logo and brand basics
    rushPct: 0.2,
  },
  modules: {                 // web apps, mobile apps and systems
    accounts: 200_000,       // user accounts and roles
    reports: 250_000,        // dashboards and reports
    workflows: 250_000,      // approvals and workflows
    notify: 150_000,         // WhatsApp / SMS notifications
    integrations: 200_000,   // each integration
  },
  care: { none: 0, basic: 25_000, business: 60_000, priority: 150_000 } as Record<Care, number>,
  carePrepaidMonths: 10,     // pay 10 months, get 12
};

export const CARE_HOURS: Record<Care, number> = { none: 0, basic: 0, business: 2, priority: 6 };

export interface Quote {
  type: ProjectType;
  pages: number;            // websites
  catalogue: 's' | 'm' | 'l'; // stores
  complexity: Complexity;   // apps and systems
  languages: number;        // extra languages beyond the first (0–2)
  cms: boolean; blog: boolean; booking: boolean; payments: boolean; copy: boolean; seo: boolean; brand: boolean;
  modules: { accounts: boolean; reports: boolean; workflows: boolean; notify: boolean };
  integrations: number;
  rush: boolean;
  care: Care;
}

export const DEFAULT_QUOTE: Quote = {
  type: 'website', pages: 5, catalogue: 's', complexity: 'simple', languages: 1,
  cms: true, blog: false, booking: false, payments: false, copy: false, seo: false, brand: false,
  modules: { accounts: false, reports: false, workflows: false, notify: false }, integrations: 0,
  rush: false, care: 'basic',
};

export interface Line { key: string; amount: number; qty?: number }
export interface Result { lines: Line[]; build: number; total: number; high: number; monthly: number; days: [number, number]; exact: boolean }

const round = (n: number) => Math.round(n / 5_000) * 5_000; // clean dinar amounts

export function priceWebsite(pages: number) {
  const p = Math.max(PRICES.website.minPages, Math.min(PRICES.website.maxPages, Math.round(pages)));
  return PRICES.website.firstPage + (p - 1) * PRICES.website.perPage;
}

export function calculate(q: Quote): Result {
  const A = PRICES.addons, lines: Line[] = [];
  let core = 0, exact = true, days: [number, number];
  if (q.type === 'website') {
    core = priceWebsite(q.pages);
    lines.push({ key: 'website', amount: core, qty: q.pages });
    days = [7 + Math.ceil(q.pages * 1.2), 10 + Math.ceil(q.pages * 1.6)];
  } else if (q.type === 'store') {
    const tier = PRICES.store.catalogue.find((c) => c.id === q.catalogue)!;
    core = PRICES.store.base + tier.add;
    lines.push({ key: 'store', amount: PRICES.store.base });
    if (tier.add) lines.push({ key: 'catalogue_' + tier.id, amount: tier.add });
    days = [21, 35];
  } else {
    exact = false;
    const from = PRICES[q.type].from, mult = PRICES.complexity[q.complexity];
    core = round(from * mult);
    lines.push({ key: q.type, amount: core });
    if (mult !== 1) lines.push({ key: 'complexity_' + q.complexity, amount: 0 });
    for (const m of ['accounts', 'reports', 'workflows', 'notify'] as const) if (q.modules[m]) { lines.push({ key: 'm_' + m, amount: PRICES.modules[m] }); core += PRICES.modules[m]; }
    if (q.integrations > 0) { const a = q.integrations * PRICES.modules.integrations; lines.push({ key: 'integrations', amount: a, qty: q.integrations }); core += a; }
    const base = { webapp: [35, 60], mobile: [45, 80], system: [50, 90] }[q.type] as [number, number];
    days = [Math.round(base[0] * mult), Math.round(base[1] * mult)];
  }
  let build = core;
  const add = (on: boolean, key: string, amount: number, d = 0, qty?: number) => { if (!on) return; lines.push({ key, amount, qty }); build += amount; days = [days[0] + d, days[1] + d]; };
  if (q.type === 'website') {
    add(q.cms, 'cms', A.cms, 5);
    add(q.blog, 'blog', A.blog, 3);
    add(q.copy, 'copy', A.copyPerPage * q.pages, 0, q.pages);
  }
  if (q.type === 'website' || q.type === 'store') {
    add(q.booking, 'booking', A.booking, 5);
    add(q.payments && q.type === 'website', 'payments', A.payments, 7);
    add(q.payments && q.type === 'store', 'payments', A.payments, 5);
  }
  add(q.seo, 'seo', A.seo, 1);
  add(q.brand, 'brand', A.brand, 7);
  if (q.languages > 0) add(true, 'languages', round(core * A.languagePct * q.languages), 3 * q.languages, q.languages);
  if (q.rush) { const r = round(build * A.rushPct); lines.push({ key: 'rush', amount: r }); build += r; days = [Math.max(5, Math.round(days[0] * 0.7)), Math.max(7, Math.round(days[1] * 0.7))]; }
  const total = round(build);
  return { lines, build: total, total, high: exact ? total : round(total * 1.2), monthly: PRICES.care[q.care], days, exact };
}

export const schedule = (total: number) => [round(total * 0.5), round(total * 0.3), total - round(total * 0.5) - round(total * 0.3)];

export function money(iqd: number, cur: 'IQD' | 'USD', lang: 'ar' | 'en') {
  if (cur === 'USD') { const v = Math.round(iqd / RATE / 5) * 5; return lang === 'ar' ? `${v.toLocaleString('en-US')} دولار` : `$${v.toLocaleString('en-US')}`; }
  return lang === 'ar' ? `${iqd.toLocaleString('en-US')} دينار` : `${iqd.toLocaleString('en-US')} IQD`;
}

// share links: the quote fits in a short query string
export function encode(q: Quote) {
  const b = (x: boolean) => (x ? 1 : 0);
  return [q.type, q.pages, q.catalogue, q.complexity, q.languages, b(q.cms), b(q.blog), b(q.booking), b(q.payments), b(q.copy), b(q.seo), b(q.brand),
    b(q.modules.accounts), b(q.modules.reports), b(q.modules.workflows), b(q.modules.notify), q.integrations, b(q.rush), q.care].join('.');
}
export function decode(s: string | null): Quote | null {
  if (!s) return null;
  const p = s.split('.'); if (p.length !== 19) return null;
  const n = (i: number) => +p[i] === 1;
  const types: ProjectType[] = ['website', 'store', 'webapp', 'mobile', 'system'];
  if (!types.includes(p[0] as ProjectType)) return null;
  return {
    type: p[0] as ProjectType, pages: Math.max(1, Math.min(30, +p[1] || 1)), catalogue: (['s', 'm', 'l'].includes(p[2]) ? p[2] : 's') as Quote['catalogue'],
    complexity: (['simple', 'moderate', 'complex'].includes(p[3]) ? p[3] : 'simple') as Complexity, languages: Math.max(0, Math.min(2, +p[4] || 0)),
    cms: n(5), blog: n(6), booking: n(7), payments: n(8), copy: n(9), seo: n(10), brand: n(11),
    modules: { accounts: n(12), reports: n(13), workflows: n(14), notify: n(15) }, integrations: Math.max(0, Math.min(10, +p[16] || 0)), rush: n(17),
    care: (['none', 'basic', 'business', 'priority'].includes(p[18]) ? p[18] : 'none') as Care,
  };
}
