// The demo shop: a believable Iraqi market with a week of history. Deterministic (same shop every time),
// written straight into one business inside withOrg(), so row-level security still applies.
import { sql, getTableColumns, getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import {
  sysProduct, sysCustomer, sysSale, sysSaleLine, sysLedger, sysStockMove, sysSequence, sysShift, sysSupplier, sysPurchase, sysPurchaseLine,
  sysSupplierLedger, sysExpense, sysSettings,
} from '@hemlo/db/schema';
import { shopAddOns, type ShopGrants } from './demo-shop';

type Lang = 'ar' | 'en';
// [ar name, en name, category(ar|en), unit, price, cost, stock on the shelf now, lowStock, packSize?, packPrice?, scaleCode?, trackStock?]
type Row = [string, string, [string, string], string, number, number, number, number | null, number?, number?, string?, boolean?];
const DRINKS: [string, string] = ['مشروبات', 'Drinks'], DAIRY: [string, string] = ['ألبان وأجبان', 'Dairy'], STAPLES: [string, string] = ['مواد غذائية', 'Groceries'];
const SNACKS: [string, string] = ['حلويات وسناكات', 'Snacks'], CLEAN: [string, string] = ['منظفات', 'Cleaning'], BAKERY: [string, string] = ['مخبوزات', 'Bakery'];
const PRODUCE: [string, string] = ['خضار وفواكه', 'Fruit & veg'], HOME: [string, string] = ['منزلية', 'Household'];
const PRODUCTS: Row[] = [
  ['بيبسي 330 مل', 'Pepsi 330ml', DRINKS, 'piece', 500, 375, 140, 24, 24, 11000],
  ['سفن أب 330 مل', '7Up 330ml', DRINKS, 'piece', 500, 375, 96, 24, 24, 11000],
  ['ميرندا 330 مل', 'Mirinda 330ml', DRINKS, 'piece', 500, 375, 60, 24, 24, 11000],
  ['بيبسي 1 لتر', 'Pepsi 1L', DRINKS, 'piece', 1000, 800, 36, 12],
  ['ماء 500 مل', 'Water 500ml', DRINKS, 'piece', 250, 170, 180, 48, 12, 2750],
  ['عصير راني', 'Rani juice', DRINKS, 'piece', 750, 560, 48, 12, 24, 16500],
  ['ريد بُل', 'Red Bull', DRINKS, 'piece', 2000, 1600, 30, 10],
  ['شاي الغزالين 500غ', 'Al-Ghazaleen tea 500g', DRINKS, 'piece', 4250, 3500, 22, 6],
  ['نسكافيه 3 في 1', 'Nescafé 3-in-1', DRINKS, 'piece', 250, 190, 150, 30, 30, 7000],
  ['نيدو 900غ', 'Nido 900g', DAIRY, 'piece', 9500, 8200, 14, 5],
  ['لبن المراعي 1 لتر', 'Almarai laban 1L', DAIRY, 'piece', 1500, 1200, 30, 10],
  ['قيمر', 'Geymar (clotted cream)', DAIRY, 'piece', 1500, 1100, 18, 6],
  ['جبن أبيض', 'White cheese', DAIRY, 'kg', 12000, 9000, 9, 3, undefined, undefined, '42'],
  ['بيض 30 حبة', 'Eggs (30)', DAIRY, 'piece', 6000, 5200, 16, 5],
  ['لبن رائب 500غ', 'Yogurt 500g', DAIRY, 'piece', 1000, 750, 25, 8],
  ['رز سايب', 'Rice (loose)', STAPLES, 'kg', 2000, 1600, 120, 20],
  ['سكر 1 كغ', 'Sugar 1kg', STAPLES, 'piece', 1500, 1150, 45, 10],
  ['طحين 1 كغ', 'Flour 1kg', STAPLES, 'piece', 1000, 760, 40, 10],
  ['زيت زهرة الشمس 1.8 لتر', 'Sunflower oil 1.8L', STAPLES, 'piece', 4500, 3900, 26, 6, 6, 26000],
  ['معجون طماطم', 'Tomato paste', STAPLES, 'piece', 1000, 700, 4, 8],
  ['معكرونة', 'Pasta', STAPLES, 'piece', 1000, 750, 42, 10],
  ['عدس أحمر 1 كغ', 'Red lentils 1kg', STAPLES, 'piece', 2000, 1600, 20, 5],
  ['ملح', 'Salt', STAPLES, 'piece', 500, 300, 30, 6],
  ['شاي ليبتون 100 كيس', 'Lipton tea 100 bags', STAPLES, 'piece', 3500, 2900, 3, 5],
  ['تونة', 'Tuna can', STAPLES, 'piece', 1500, 1150, 48, 12],
  ['شيبس ليز', 'Lay’s chips', SNACKS, 'piece', 500, 360, 90, 20, 24, 10500],
  ['بسكويت تيفاني', 'Tiffany biscuits', SNACKS, 'piece', 250, 185, 144, 24, 24, 5500],
  ['شوكولاتة جالكسي', 'Galaxy chocolate', SNACKS, 'piece', 1000, 780, 60, 12],
  ['علكة', 'Chewing gum', SNACKS, 'piece', 250, 150, 100, 20],
  ['تايد 1 كغ', 'Tide 1kg', CLEAN, 'piece', 3000, 2400, 20, 5],
  ['فيري 750 مل', 'Fairy 750ml', CLEAN, 'piece', 2500, 2000, 18, 5],
  ['مناديل كلينكس', 'Kleenex tissues', CLEAN, 'piece', 1250, 950, 40, 10],
  ['شامبو هيد آند شولدرز', 'Head & Shoulders shampoo', CLEAN, 'piece', 3500, 2800, 15, 4],
  ['صابون', 'Soap bar', CLEAN, 'piece', 750, 520, 50, 10],
  ['صمون', 'Samoon bread', BAKERY, 'piece', 250, 150, 0, null, undefined, undefined, undefined, false],
  ['خبز عربي', 'Flatbread (pack)', BAKERY, 'piece', 1000, 700, 0, null, undefined, undefined, undefined, false],
  ['طماطم', 'Tomatoes', PRODUCE, 'kg', 1000, 700, 40, 8],
  ['بطاطا', 'Potatoes', PRODUCE, 'kg', 1000, 700, 50, 10],
  ['بصل', 'Onions', PRODUCE, 'kg', 1000, 700, 45, 10],
  ['موز', 'Bananas', PRODUCE, 'kg', 2000, 1500, 25, 6],
  ['بطاريات AA', 'AA batteries', HOME, 'piece', 1500, 1000, 30, 6],
  ['كبريت', 'Matches', HOME, 'piece', 250, 125, 60, 10],
  ['أكياس نفايات', 'Bin bags', HOME, 'piece', 1500, 1100, 25, 5],
];

/** A valid EAN-13 from 12 digits. */
function ean13(twelve: string) {
  const sum = [...twelve].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return twelve + ((10 - (sum % 10)) % 10);
}
/** Small deterministic random numbers, so every demo shop looks the same. */
export function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DAY = 86400_000, HOUR = 3600_000;
/** Midnight in Baghdad (UTC+3), n days ago, as a UTC timestamp. */
const baghdadMidnight = (daysAgo: number) => { const now = new Date(Date.now() + 3 * HOUR); return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * HOUR - daysAgo * DAY; };

/** A demo product's name in both languages (the AI invoice sample matches its lines to the demo shop this way). */
export const demoProductNames = (i: number): [string, string] => [PRODUCTS[i][0], PRODUCTS[i][1]];

export const DEMO_BARCODES = { can: '6281036001017', carton: '6281036101014', scale: '2100042012503' };

export type Batch = [PgTable, Record<string, any>[]];
/** Many tables' rows in ONE statement (a CTE per table, all read from one JSON parameter), so it costs one round trip,
 *  not one per insert. Foreign keys are checked at the end of the statement; row-level security still applies.
 *  Columns a batch doesn't mention keep their defaults. */
export async function insertAll(tx: Database, batches: Batch[]) {
  const live = batches.filter(([, rows]) => rows.length);
  const data: unknown[] = [];
  const parts = live.map(([table, rows], i) => {
    // plain loops: this runs over thousands of rows, inside the Worker's CPU budget
    const present = new Set<string>();
    for (const r of rows) for (const k in r) if (r[k] !== undefined) present.add(k);
    const cols = Object.entries(getTableColumns(table)).filter(([k]) => present.has(k));
    const keys = cols.map(([k]) => k), names = cols.map(([, c]) => c.name), out = new Array(rows.length);
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j], o: Record<string, unknown> = {};
      for (let x = 0; x < keys.length; x++) o[names[x]] = r[keys[x]] ?? null;
      out[j] = o;
    }
    data.push(out);
    const name = sql.raw(`"${getTableName(table)}"`), list = sql.raw(cols.map(([, c]) => `"${c.name}"`).join(', '));
    return sql`${sql.raw(`i${i}`)} as (insert into ${name} (${list}) select ${list} from d, json_populate_recordset(null::${name}, d.j -> ${sql.raw(String(i))}))`;
  });
  await tx.execute(sql`with d as (select ${JSON.stringify(data)}::json as j), ${sql.join(parts, sql`, `)} select 1`);
}

/** `first`: rows to write ahead of the shop's own (the business and its owner), in the same statement. */
export async function seedDemoShop(tx: Database, org: string, userId: string, lang: Lang, first: Batch[] = [], addons?: ShopGrants) {
  const r = rng(20260930);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  // ---- products ----
  const products = PRODUCTS.map((p, i) => {
    const [ar, en, cat, unit, price, cost, stock, low, packSize, packPrice, scaleCode, track] = p;
    const barcode = i === 0 ? DEMO_BARCODES.can : unit === 'kg' || track === false ? null : ean13(`6281036${String(10 + i).padStart(5, '0')}`);
    return { id: newId(), organizationId: org, name: L(ar, en), barcode, category: L(cat[0], cat[1]), unit, price, cost, stock, lowStock: low, trackStock: track !== false,
      packSize: packSize ?? null, packPrice: packPrice ?? null, packBarcode: packSize ? (i === 0 ? DEMO_BARCODES.carton : ean13(`6281036${String(100 + i).padStart(5, '0')}`)) : null, scaleCode: scaleCode ?? null };
  });
  const opening = baghdadMidnight(8) + 9 * HOUR;

  // ---- customers & suppliers ----
  const customers = [['أم علي', 'Umm Ali'], ['أبو زينب', 'Abu Zainab'], ['حسين الجار', 'Hussein (neighbour)'], ['سارة', 'Sara'], ['كريم', 'Karim'], ['أم مصطفى', 'Umm Mustafa'], ['أحمد سائق التاكسي', 'Ahmed the taxi driver'], ['نور', 'Noor']]
    .map(([ar, en], i) => ({ id: newId(), organizationId: org, name: L(ar, en), phone: `+96477012300${String(i).padStart(2, '0')}`, balance: 0 }));
  const suppliers = [['جملة بغداد', 'Baghdad Wholesale'], ['ألبان الرافدين', 'Al-Rafidain Dairy'], ['أغذية كربلاء', 'Karbala Foods']]
    .map(([ar, en], i) => ({ id: newId(), organizationId: org, name: L(ar, en), phone: `+96478011100${i}`, balance: 0 }));

  // ---- a week of trading: a drawer per day, 25–45 sales a day ----
  const sales: (typeof sysSale.$inferInsert)[] = [], lines: (typeof sysSaleLine.$inferInsert)[] = [], moves: (typeof sysStockMove.$inferInsert)[] = [];
  const ledger: (typeof sysLedger.$inferInsert)[] = [], shifts: (typeof sysShift.$inferInsert)[] = [];
  // stock: the list above is what's on the shelf NOW; the week's sales and deliveries are replayed on top of an opening count
  const events: { at: number; productId: string; qty: number; kind: 'sale' | 'receive'; saleId?: string; cost?: number; note?: string }[] = [];
  const popular = products.filter((p) => p.price <= 2000);
  let number = 0;
  const now = Date.now();
  for (let day = 6; day >= 0; day--) {
    const start = baghdadMidnight(day);
    // today: the shop opened at 8, or (for a visitor in the small hours) a few hours ago, and has traded up to now
    const open = day > 0 ? start + 8 * HOUR : Math.max(start, Math.min(start + 8 * HOUR, now - 3 * HOUR)), close = start + 23 * HOUR + 10 * 60_000;
    const until = day > 0 ? start + 23 * HOUR : now - 5 * 60_000;
    const shiftId = newId();
    let cashIn = 0;
    const full = 25 + Math.floor(r() * 20);
    const count = day > 0 ? full : Math.max(8, Math.round(full * Math.min(1, (until - open) / (15 * HOUR))));
    const times = Array.from({ length: count }, () => open + Math.floor(Math.pow(r(), day > 0 ? 0.8 : 1) * Math.max(0, until - open))).sort((a, b) => a - b);
    for (const at of times) {
      const saleId = newId();
      const n = 1 + Math.floor(r() * 4);
      let subtotal = 0, cost = 0;
      for (let j = 0; j < n; j++) {
        const p = r() < 0.75 ? pick(popular) : pick(products);
        const qty = p.unit === 'kg' ? Math.round((0.5 + r() * 2) * 4) / 4 : 1 + Math.floor(r() * (p.price <= 500 ? 4 : 2));
        const total = Math.round(qty * p.price), c = Math.round(qty * p.cost);
        subtotal += total; cost += c;
        lines.push({ id: newId(), organizationId: org, saleId, productId: p.id, name: p.name, qty, baseQty: qty, price: p.price, cost: c, total });
        if (p.trackStock) events.push({ at, productId: p.id, qty: -qty, kind: 'sale', saleId });
      }
      const roll = r();
      const customer = roll > 0.86 ? pick(customers.slice(0, 7)) : null;
      const method = customer ? 'credit' : roll > 0.74 ? 'card' : 'cash';
      const paid = customer ? (r() < 0.5 ? 0 : Math.round(subtotal / 2 / 250) * 250) : subtotal;
      const due = subtotal - paid;
      if (method !== 'card') cashIn += paid;
      sales.push({ id: saleId, organizationId: org, number: ++number, createdAt: new Date(at), userId, customerId: customer?.id ?? null, subtotal, discount: 0, total: subtotal,
        paid, due, method: due === 0 ? method : paid > 0 ? 'mixed' : 'credit', cost, shiftId });
      if (customer && due > 0) {
        customer.balance += due;
        ledger.push({ id: newId(), organizationId: org, customerId: customer.id, at: new Date(at), kind: 'sale', amount: due, balance: customer.balance, saleId, userId });
      }
    }
    // a payment or two against the debt book most days
    if (day > 0 && r() < 0.7) {
      const cu = pick(customers.filter((c) => c.balance > 3000));
      if (cu) {
        const amount = Math.min(cu.balance, Math.round((cu.balance * (0.3 + r() * 0.5)) / 250) * 250);
        cu.balance -= amount; cashIn += amount;
        ledger.push({ id: newId(), organizationId: org, customerId: cu.id, at: new Date(start + 18 * HOUR), kind: 'payment', amount: -amount, balance: cu.balance, method: 'cash', shiftId, userId });
      }
    }
    const expected = 50000 + cashIn;
    shifts.push(day === 0
      ? { id: shiftId, organizationId: org, openedAt: new Date(open), openedBy: userId, openingCash: 50000 }
      : { id: shiftId, organizationId: org, openedAt: new Date(open), openedBy: userId, openingCash: 50000, closedAt: new Date(close), closedBy: userId, expectedCash: expected,
          countedCash: expected + (day === 2 ? -250 : day === 4 ? 500 : 0), note: day === 2 ? L('ناقص فكة', 'short on change') : null });
  }

  // ---- deliveries and what the shop owes ----
  const purchases: (typeof sysPurchase.$inferInsert)[] = [], pLines: (typeof sysPurchaseLine.$inferInsert)[] = [], sLedger: (typeof sysSupplierLedger.$inferInsert)[] = [];
  const deliveries: [number, number, [number, number, number][], number][] = [ // supplier, days ago, [product index, cartons/qty, unit cost], paid
    [0, 5, [[0, 3, 10000], [4, 5, 2400], [16, 20, 1150], [25, 2, 9600]], 50000],
    [1, 3, [[9, 6, 8200], [10, 12, 1200], [13, 8, 5200]], 30000],
    [2, 2, [[18, 2, 24000], [19, 12, 700], [20, 12, 750]], 60000],
  ];
  deliveries.forEach(([si, ago, items, paid], i) => {
    const pid = newId(), s = suppliers[si], at = new Date(baghdadMidnight(ago) + 11 * HOUR);
    let total = 0;
    for (const [pi, q, c] of items) {
      const p = products[pi], pack = p.packSize && c > p.cost * 2 ? p.packSize : null, base = q * (pack ?? 1);
      total += q * c;
      pLines.push({ id: newId(), organizationId: org, purchaseId: pid, productId: p.id, name: p.name, qty: q, packSize: pack, baseQty: base, cost: c, total: q * c });
      events.push({ at: at.getTime(), productId: p.id, qty: base, kind: 'receive', cost: Math.round(c / (pack ?? 1)), note: `#${i + 1} · INV-${4200 + i * 37}` });
    }
    const due = total - paid;
    purchases.push({ id: pid, organizationId: org, number: i + 1, supplierId: s.id, createdAt: at, userId, reference: `INV-${4200 + i * 37}`, total, paid, due });
    s.balance += due;
    sLedger.push({ id: newId(), organizationId: org, supplierId: s.id, at, kind: 'purchase', amount: due, balance: s.balance, purchaseId: pid, userId });
  });

  // ---- expenses ----
  const shiftOn = (ago: number) => shifts[6 - ago]?.id ?? null;
  const expenses = [
    ['generator', 25000, 5, true, L('اشتراك المولدة', 'Generator subscription')], ['electricity', 15000, 3, false, null],
    ['salaries', 75000, 1, false, L('أجرة حسن الأسبوعية', 'Hassan’s weekly wage')], ['transport', 10000, 1, true, L('توصيل البضاعة', 'Delivery of stock')],
  ].map(([category, amount, ago, fromDrawer, note]) => ({ id: newId(), organizationId: org, at: new Date(baghdadMidnight(ago as number) + 13 * HOUR), category: category as string,
    amount: amount as number, note: note as string | null, fromDrawer: fromDrawer as boolean, shiftId: fromDrawer ? shiftOn(ago as number) : null, userId }));

  // ---- stock: replay the week in time order from the opening count ----
  events.sort((a, b) => a.at - b.at);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const net = new Map<string, number>();
  for (const e of events) net.set(e.productId, (net.get(e.productId) ?? 0) + e.qty);
  const openingStock = new Map(products.map((p) => [p.id, round(p.stock - (net.get(p.id) ?? 0))]));
  for (const p of products) if ((openingStock.get(p.id) ?? 0) < 0) { p.stock = round(p.stock - openingStock.get(p.id)!); openingStock.set(p.id, 0); } // never below zero
  const running = new Map(openingStock);
  for (const e of events) {
    const left = round((running.get(e.productId) ?? 0) + e.qty); running.set(e.productId, left);
    moves.push({ id: newId(), organizationId: org, productId: e.productId, at: new Date(e.at), kind: e.kind, qty: e.qty, stock: left, saleId: e.saleId ?? null, cost: e.cost ?? null, note: e.note ?? null, userId });
  }

  // the add-ons a demo has on (online store, Connect): they set the products' online fields before they're written
  const extra = addons?.grants.length ? shopAddOns(org, userId, lang, products, customers, addons) : [];

  // ---- write it all, in one statement ----
  await insertAll(tx, [
    ...first,
    [sysSettings, [{ organizationId: org, scale: { enabled: true, prefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'], mode: 'weight' } }]],
    [sysProduct, products.map((p) => ({ ...p, stock: p.trackStock ? p.stock : 0, createdAt: new Date(opening), updatedAt: new Date() }))],
    [sysStockMove, [...products.filter((p) => p.trackStock).map((p) => ({ id: newId(), organizationId: org, productId: p.id, at: new Date(opening), kind: 'count', qty: openingStock.get(p.id)!, stock: openingStock.get(p.id)!, userId, note: L('جرد الافتتاح', 'opening count') })), ...moves]],
    [sysCustomer, customers], [sysSupplier, suppliers], [sysShift, shifts],
    [sysSale, sales], [sysSaleLine, lines], [sysLedger, ledger],
    [sysPurchase, purchases], [sysPurchaseLine, pLines], [sysSupplierLedger, sLedger], [sysExpense, expenses],
    [sysSequence, [{ organizationId: org, name: 'sale', value: number }, { organizationId: org, name: 'purchase', value: purchases.length }, ...(extra.length ? [{ organizationId: org, name: 'order', value: 3 }] : [])]],
    ...extra,
  ]);
  return { products: products.length, sales: sales.length };
}
