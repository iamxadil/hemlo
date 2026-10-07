// Read a supplier's invoice from a photo, and turn it into a draft purchase: each line matched to one of the shop's own
// products (the model is shown the shop's product list and picks from it; we double-check the pick), cartons spotted,
// the supplier matched. Nothing is saved here: the owner checks the draft and saves it as a normal purchase.
import type { Engine, JsonSchema } from './engine';
import { demoProductNames } from '../demo-data';

export type ReadLine = { name: string; unit: string; qty: number; unitPrice: number; total: number; productIndex: number; carton: boolean };
export type ReadInvoice = { supplier: string; supplierIndex?: number; invoiceNo: string; date: string; currency: 'IQD' | 'USD'; lines: ReadLine[]; total: number; paid: number };
export type Catalogue = { id: string; name: string; barcode: string | null; packSize: number | null; cost: number | null; unit: string }[];
export type DraftLine = { name: string; qty: number; unitPrice: number; lineTotal: number; pack: boolean; productId: string | null; productName: string | null; confidence: 'sure' | 'check' | 'none' };
export type Draft = { supplier: { name: string; id: string | null }; reference: string; date: string; currency: 'IQD' | 'USD'; total: number; paid: number; lines: DraftLine[]; sumMatches: boolean };

export const INVOICE_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['supplier', 'supplierIndex', 'invoiceNo', 'date', 'currency', 'lines', 'total', 'paid'],
  properties: {
    supplier: { type: 'string' }, supplierIndex: { type: 'integer' }, invoiceNo: { type: 'string' }, date: { type: 'string' }, currency: { type: 'string', enum: ['IQD', 'USD'] },
    total: { type: 'number' }, paid: { type: 'number' },
    lines: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['name', 'unit', 'qty', 'unitPrice', 'total', 'productIndex', 'carton'],
      properties: { name: { type: 'string' }, unit: { type: 'string' }, qty: { type: 'number' }, unitPrice: { type: 'number' }, total: { type: 'number' }, productIndex: { type: 'integer' }, carton: { type: 'boolean' } },
    } },
  },
};

const SYSTEM = `You read supplier invoices for small shops in Iraq. Invoices are usually in Arabic, sometimes English or Kurdish, printed or handwritten.
Rules:
- "supplier" is the SELLER (the company at the top). The buyer ("السيد", "المحترم", "إلى") is NOT the supplier.
- Copy each product name exactly as written. Numbers: plain digits, no thousands separators; convert Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to 0-9.
- Amounts are Iraqi dinars (IQD) unless the invoice shows $ or USD.
- "carton" is true when the line is sold by the carton/box/case (كارتون، صندوق، كرتونة، قوطية كبيرة) rather than by the piece.
- "productIndex": the number of the matching product from the shop's list, or -1 if none matches. The list may be in another language than the invoice (an Arabic invoice, English product names): match by meaning, size and brand ("ماء 500 مل" is "Water 500ml"). Never guess: if unsure, -1.
- "supplierIndex": the number of the matching supplier from the shop's suppliers list (by meaning, in any language), or -1.
- "paid": the amount paid now (الواصل / المدفوع), 0 if not shown. "date" as YYYY-MM-DD, "" if not shown.
Return only the JSON.`;

/** Arabic text made comparable: no diacritics or tatweel, one form of alef/yeh/teh marbuta, Latin digits, lower case. */
export function norm(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const words = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 1 || /\d/.test(w)));
/** How alike two names are, 0..1 (shared words, numbers count double: "330" tells Pepsi cans from bottles). */
export function likeness(a: string, b: string) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  const k = (w: string) => (/\d/.test(w) ? 2 : 1);
  let shared = 0, wa = 0, wb = 0;
  for (const w of A) { wa += k(w); if (B.has(w)) shared += k(w); }
  for (const w of B) wb += k(w);
  return (2 * shared) / (wa + wb); // Dice overlap, weighted
}

const CATALOGUE_MAX = 400;
export function prompt(catalogue: Catalogue, suppliers: { name: string }[] = []) {
  const list = catalogue.slice(0, CATALOGUE_MAX).map((p, i) => `${i}: ${p.name}${p.packSize ? ` (carton of ${p.packSize})` : ''}`).join('\n');
  const sup = suppliers.slice(0, 100).map((x, i) => `${i}: ${x.name}`).join('\n');
  return `The shop's products:\n${list || '(none yet)'}\n\nThe shop's suppliers:\n${sup || '(none yet)'}\n\nRead this invoice.`;
}

/** The model's reading → a draft the owner can check: matches verified, cartons settled, sums checked. */
export function toDraft(read: ReadInvoice, catalogue: Catalogue, suppliers: { id: string; name: string }[]): Draft {
  const lines: DraftLine[] = (read.lines ?? []).filter((l) => l && l.name && Number(l.qty) > 0).map((l) => {
    const qty = Number(l.qty), unitPrice = Math.round(Number(l.unitPrice) || 0), lineTotal = Math.round(Number(l.total) || qty * unitPrice);
    let p = Number.isInteger(l.productIndex) && l.productIndex >= 0 ? catalogue[l.productIndex] : undefined;
    let confidence: DraftLine['confidence'] = 'none';
    if (p) confidence = likeness(l.name, p.name) >= 0.45 ? 'sure' : 'check'; // a pick in another script (Arabic invoice, English names) is checked by eye
    else {
      // the model passed: our own best match, offered to check
      let best = 0;
      for (const c of catalogue) { const s = likeness(l.name, c.name); if (s > best) { best = s; p = c; } }
      if (best >= 0.6) confidence = 'check'; else p = undefined;
    }
    // by the carton? the invoice says so, or the price only makes sense for a whole carton
    let pack = !!(p?.packSize && l.carton);
    if (p?.packSize && !pack && p.cost && unitPrice > p.cost * p.packSize * 0.5) pack = true;
    if (Math.abs(qty * unitPrice - lineTotal) > Math.max(5, lineTotal * 0.01)) confidence = confidence === 'sure' ? 'check' : confidence;
    return { name: String(l.name).slice(0, 120), qty, unitPrice, lineTotal, pack, productId: p?.id ?? null, productName: p?.name ?? null, confidence };
  });
  const sum = lines.reduce((s, l) => s + l.lineTotal, 0);
  let supplier: { id: string; name: string } | undefined, best = 0;
  for (const s of suppliers) { const k = likeness(read.supplier ?? '', s.name); if (k > best) { best = k; supplier = s; } }
  const picked = Number.isInteger(read.supplierIndex) && read.supplierIndex! >= 0 ? suppliers[read.supplierIndex!] : undefined;
  if (picked && best < 0.5) { supplier = picked; best = 0.5; } // the model matched it by meaning (another language)
  return {
    supplier: { name: String(read.supplier ?? '').slice(0, 120), id: best >= 0.5 ? supplier!.id : null },
    reference: String(read.invoiceNo ?? '').slice(0, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(read.date ?? '') ? read.date : '',
    currency: read.currency === 'USD' ? 'USD' : 'IQD',
    total: Math.round(Number(read.total) || sum), paid: Math.max(0, Math.round(Number(read.paid) || 0)), lines,
    sumMatches: !read.total || Math.abs(sum - Number(read.total)) <= Math.max(5, sum * 0.01),
  };
}

export async function readInvoice(engine: Engine, image: string, catalogue: Catalogue, suppliers: { name: string }[] = []) {
  return engine.json<ReadInvoice>({ system: SYSTEM, text: prompt(catalogue, suppliers), image, schema: INVOICE_SCHEMA, maxTokens: 2500 });
}

// ---------- the ready-made sample (the demo's "try a sample invoice"): the same photo as /samples/invoice.jpg ----------
// Its lines are the demo shop's first delivery; the result is prepared, so trying it costs nothing and is instant.
const SAMPLE: { lines: [number, string, number, number][] } & Omit<ReadInvoice, 'lines'> = {
  supplier: 'جملة بغداد للمواد الغذائية', supplierIndex: -1, invoiceNo: 'INV-4200', date: '2026-09-26', currency: 'IQD', total: 84200, paid: 50000,
  lines: [[0, 'بيبسي 330 مل (كارتون 24)', 3, 10000], [4, 'ماء 500 مل (كارتون 12)', 5, 2400], [16, 'سكر 1 كغ', 20, 1150], [25, 'شيبس ليز (كارتون 24)', 2, 9600]],
};
export function sampleRead(catalogue: Catalogue): ReadInvoice {
  return {
    ...SAMPLE,
    lines: SAMPLE.lines.map(([demoIndex, name, qty, unitPrice]) => {
      const names = demoProductNames(demoIndex);
      return { name, unit: name.includes('كارتون') ? 'كارتون' : 'قطعة', qty, unitPrice, total: qty * unitPrice, carton: name.includes('كارتون'), productIndex: catalogue.findIndex((p) => names.includes(p.name)) };
    }),
  };
}
