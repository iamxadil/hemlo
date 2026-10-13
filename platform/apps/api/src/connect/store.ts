// Hemlo Connect in a shop. The engine (WhatsApp, the outbox, the limits, the allowance) is core.ts; what's a shop's own
// lives here: a chat belongs to the customer in its book (by phone), the assistant answers from the shop's real
// products, prices and stock (and where an order stands), and the automations are the online order's updates and a
// gentle reminder of what a customer owes. Nothing here is a second customer list.
import { and, asc, desc, eq, gte, isNull, isNotNull, sql } from 'drizzle-orm';
import { withOrg, type Database } from '@hemlo/db';
import { connectConversation, connectMessage, shopOrder, sysCustomer, sysProduct, webSite } from '@hemlo/db/schema';
import { AiError, type JsonSchema } from '../ai/engine';
import { engineFor } from '../ai/router';
import { snapshot, overBudget, record, DEFAULT_BUDGET_USD } from '../ai/meter';
import type { Deps } from '../types';
import type { Channel } from './core';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const arabic = (s: string) => /[؀-ۿ]/.test(s);
export const iqd = (n: number, lang: 'ar' | 'en') => `${new Intl.NumberFormat('en-US').format(n)} ${lang === 'ar' ? 'د.ع' : 'IQD'}`;
const first = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || '';

/** The shop's live address (its published website), or null: links to a product or an order only when there is one. */
export async function shopOrigin(tx: Database, org: string) {
  const [s] = await tx.select({ sub: webSite.subdomain, status: webSite.status }).from(webSite).where(eq(webSite.organizationId, org));
  return s?.sub && s.status === 'published' ? `https://${s.sub}.hemlohq.com` : null;
}

/** The customer in the shop's book with this WhatsApp number (the newest, if two share it). */
export async function customerByPhone(tx: Database, org: string, phone: string) {
  const [c] = await tx.select({ id: sysCustomer.id, name: sysCustomer.name }).from(sysCustomer)
    .where(and(eq(sysCustomer.organizationId, org), isNull(sysCustomer.archivedAt), eq(sysCustomer.phone, phone))).orderBy(desc(sysCustomer.updatedAt)).limit(1);
  return c ?? null;
}

// ------------------------------------------------------------------------------------------------- order updates
export const ORDER_WORDS: Record<string, { ar: string; en: string }> = {
  new: { ar: 'وصلنا وسنؤكّده قريباً', en: 'received; we will confirm it shortly' },
  confirmed: { ar: 'تم تأكيده ونحن نجهّزه الآن', en: 'confirmed, and we are preparing it' },
  ready: { ar: 'جاهز للاستلام من المتجر', en: 'ready to collect from the shop' },
  out: { ar: 'خرج للتوصيل وسيصلك قريباً', en: 'on its way to you' },
  delivered: { ar: 'تم التسليم', en: 'delivered' },
  canceled: { ar: 'أُلغي', en: 'canceled' },
};

/** What the WhatsApp message says about an order, and where the customer follows it. */
export async function orderJob(tx: Database, org: string, orderId: string, shop: string) {
  const [o] = await tx.select().from(shopOrder).where(and(eq(shopOrder.organizationId, org), eq(shopOrder.id, orderId)));
  if (!o || !ORDER_WORDS[o.status]) return null;
  const lang = o.lang === 'en' ? 'en' as const : 'ar' as const, origin = await shopOrigin(tx, org);
  return { recipe: 'order_update' as const, dedupe: `order_update:${o.id}:${o.status}`, phone: o.phone, lang, template: 'hemlo_order_update',
    params: [first(o.name), shop, String(o.number), ORDER_WORDS[o.status][lang], origin ? `${origin}/order/${o.code}` : '-'] };
}

/** Customers who owe the shop at least `min` (default 10,000 IQD): reminded once a month, never one who said stop. */
export async function debtJobs(tx: Database, org: string, shop: string, now: Date, settings: Record<string, unknown>) {
  const min = Math.max(1000, Number(settings.min) || 10_000), month = new Date(+now + 3 * 3600_000).toISOString().slice(0, 7);
  const rows = await tx.select({ id: sysCustomer.id, name: sysCustomer.name, phone: sysCustomer.phone, balance: sysCustomer.balance }).from(sysCustomer)
    .where(and(eq(sysCustomer.organizationId, org), isNull(sysCustomer.archivedAt), isNotNull(sysCustomer.phone), gte(sysCustomer.balance, min))).limit(300);
  return rows.map((r) => ({ recipe: 'debt_reminder' as const, dedupe: `debt_reminder:${r.id}:${month}`, phone: r.phone!, lang: 'ar' as const, template: 'hemlo_debt_reminder',
    params: [first(r.name), shop, iqd(r.balance, 'ar')] }));
}

// ------------------------------------------------------------------------------------------------- the assistant
export const STORE_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['reply', 'handoff', 'items', 'name'],
  properties: { reply: { type: 'string' }, handoff: { type: 'boolean' }, items: { type: 'array', items: { type: 'integer' } }, name: { type: 'string' } },
};
type StoreReply = { reply: string; handoff: boolean; items: number[]; name: string };

export const STORE_ASSISTANT = (shop: string, persona: Channel['persona'], online: boolean, delivery: string) => `You are the WhatsApp assistant of ${shop}, a shop in Iraq. You answer its customers.
Rules that never bend:
- Reply in the customer's language (Iraqi-friendly Arabic, English, or Kurdish if they write Kurdish). Warm, short (under 60 words), one question at a time, no emojis.
- Use ONLY the products and facts given. Never invent a product, a price, a discount, stock, a delivery time or a promise. Never state a price yourself: the product cards you pick carry it.
- To show products, put their numbers in "items" (at most 4, only from the list). Say a word about them. A product marked "out of stock" can be named but say it is out of stock now.
- ${online ? 'To order, the customer opens the product link (the cards carry it) and orders online with cash on delivery; tell them so.' : 'To order, a colleague takes the order: set handoff true and say a colleague will confirm it.'}
${delivery ? `- Delivery: ${delivery}\n` : ''}- If they ask about their order, use the order facts only.
- If they ask for a person, complain, ask for a discount, ask about returns, or ask anything the facts don't answer: set handoff true and say a colleague will reply shortly.
- If they tell you their name, put it in "name".
${persona?.hours ? `Opening hours: ${persona.hours}.\n` : ''}${persona?.notes ? `About the shop (from the owner): ${persona.notes.slice(0, 600)}\n` : ''}Return JSON only.`;

/** The products worth showing for this chat: the ones its words name (name, category), then the newest; at most 14. */
async function productsFor(tx: Database, org: string, chat: string) {
  const all = await tx.select({ id: sysProduct.id, name: sysProduct.name, category: sysProduct.category, price: sysProduct.price, stock: sysProduct.stock, trackStock: sysProduct.trackStock,
    lowStock: sysProduct.lowStock, online: sysProduct.online, slug: sysProduct.slug, unit: sysProduct.unit }).from(sysProduct)
    .where(and(eq(sysProduct.organizationId, org), isNull(sysProduct.archivedAt))).orderBy(desc(sysProduct.online), asc(sysProduct.name)).limit(600);
  const words = chat.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 3);
  const score = (p: typeof all[number]) => { const hay = `${p.name} ${p.category ?? ''}`.toLowerCase(); return words.reduce((s, w) => s + (hay.includes(w) ? 2 : 0), 0) + (p.online ? 1 : 0); };
  return all.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s).slice(0, 14).map((x) => x.p);
}

/** The assistant's answer in a shop's chat (the engine calls this instead of the agency's). Returns what to send. */
export async function storeAnswer(d: Deps, ch: Channel, ctx: { conv: typeof connectConversation.$inferSelect; msgs: (typeof connectMessage.$inferSelect)[]; last: typeof connectMessage.$inferSelect },
  shop: string, inventedNumbers: (reply: string, facts: string) => string[]) {
  const org = ch.organizationId;
  const chat = ctx.msgs.map((m) => `${m.direction === 'in' ? 'Customer' : 'Shop'}: ${m.body.slice(0, 600)}`).join('\n');
  const data = await withOrg(d.db, org, async (tx) => {
    const list = await productsFor(tx, org, ctx.msgs.filter((m) => m.direction === 'in').slice(-4).map((m) => m.body).join(' '));
    const origin = await shopOrigin(tx, org);
    const [site] = await tx.select({ settings: webSite.settings }).from(webSite).where(eq(webSite.organizationId, org));
    const orders = await tx.select({ number: shopOrder.number, status: shopOrder.status, total: shopOrder.total, createdAt: shopOrder.createdAt }).from(shopOrder)
      .where(and(eq(shopOrder.organizationId, org), eq(shopOrder.phone, ctx.conv.phone))).orderBy(desc(shopOrder.createdAt)).limit(2);
    return { list, origin, shopSettings: site?.settings?.shop ?? null, orders };
  });
  const [snap, engine] = await Promise.all([snapshot(d.db, org), engineFor(d, 'store', 'connect_reply', org)]);
  if (snap.off || !engine) return null;
  if (engine.paid && await overBudget(d.db, Number(d.env.AI_BUDGET_USD) || DEFAULT_BUDGET_USD)) return null;
  const stockOf = (p: typeof data.list[number]) => (!p.trackStock ? 'available' : p.stock <= 0 ? 'out of stock' : p.lowStock != null && p.stock <= p.lowStock ? 'few left' : 'in stock');
  const facts = data.list.map((p, i) => `#${i + 1} | ${p.name}${p.category ? ` (${p.category})` : ''} | ${p.price} IQD per ${p.unit} | ${stockOf(p)}${p.online && data.origin ? ' | can be ordered online' : ''}`).join('\n');
  const s = data.shopSettings;
  const delivery = s && s.delivery !== false ? [`delivery fee ${s.fee ?? 0} IQD`, ...(s.fees ?? []).map((f) => `${f.city}: ${f.fee} IQD`), s.freeOver ? `free from ${s.freeOver} IQD` : '', s.pickup ? 'pickup from the shop is possible' : ''].filter(Boolean).join(', ') : s?.pickup ? 'pickup from the shop only' : '';
  const orderFacts = data.orders.length ? `This customer's latest orders: ${data.orders.map((o) => `#${o.number} (${o.status}, ${o.total} IQD)`).join('; ')}.` : '';
  const text = `Products (the only ones you may mention):\n${facts || '(none yet)'}\n\n${orderFacts}\n\nThe conversation so far:\n${chat}\n\nWrite the shop's next reply.`;
  const t0 = Date.now();
  let out: StoreReply;
  try {
    const r = await engine.json<StoreReply>({ system: STORE_ASSISTANT(shop, ch.persona, !!data.origin, delivery), text, schema: STORE_SCHEMA, maxTokens: 600 });
    out = r.data;
    await record(d.db, org, { userId: null, feature: 'connect_reply', engine: engine.name, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costMicros: r.costMicros, ms: Date.now() - t0, ok: true, counted: false });
  } catch (e) {
    await record(d.db, org, { userId: null, feature: 'connect_reply', engine: engine.name, ms: Date.now() - t0, ok: false, counted: false }).catch(() => {});
    if (!(e instanceof AiError)) console.error('[connect ai store]', e instanceof Error ? e.message : e);
    return null;
  }
  const lang = arabic(ctx.last.body) ? 'ar' as const : 'en' as const;
  const reply = String(out?.reply ?? '').trim().slice(0, 1200);
  const invented = inventedNumbers(reply, `${facts}\n${orderFacts}\n${delivery}\n${chat}`);
  const handoff = !!out?.handoff || !reply || invented.length > 0;
  const picks = (Array.isArray(out?.items) ? out.items : []).map(Number).map((n) => data.list[n - 1]).filter(Boolean).slice(0, 4);
  const cards = picks.map((p) => `▫️ ${p.name} · ${iqd(p.price, lang)}${p.online && p.slug && data.origin ? `\n${data.origin}/products/${p.slug}` : ''}`).join('\n\n');
  const safe = lang === 'ar' ? 'شكراً لرسالتك. سيرد عليك أحد زملائنا بعد قليل.' : 'Thank you for your message. A colleague will reply shortly.';
  const body = invented.length || !reply ? safe : cards ? `${reply}\n\n${cards}` : reply;
  const name = typeof out?.name === 'string' && out.name.trim() ? out.name.trim().slice(0, 80) : null;
  return { body, handoff, meta: { items: picks.map((p) => p.id), handoff }, name };
}

/** The last seven days for a shop: chats, what Connect sent, online orders. */
export async function storeWeek(db: Database, org: string, since: string) {
  const [r] = rowsOf(await withOrg(db, org, (tx) => tx.execute(sql`select (select count(*) from shop_order where organization_id = ${org} and created_at > ${since})::int as orders`)));
  return Number(r?.orders ?? 0);
}
