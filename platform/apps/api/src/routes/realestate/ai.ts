// AI inside the work, not beside it: write a listing from the agent's rough notes (Arabic and English), shorten, expand,
// polish or translate it; and answer questions about the agency from its own data. The same allowance, daily cap,
// on/off switch and budget as every Hemlo AI feature (ai/meter.ts). Two rules:
//  - a description may only use the facts it's given: any number in the result that isn't in the facts is flagged;
//  - questions are routed to ONE of a fixed set of read-only questions (the AI picks, our queries answer), so an answer
//    never contains a made-up number, and the model never touches the database.
import { Hono } from 'hono';
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { reProperty, reLead, reViewing, reFollowup, reDeal, reActivity } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, type Actor } from '../sys-common';
import { subscriptionOf } from '../../subscription';
import { AiError, type Engine, type JsonSchema } from '../../ai/engine';
import { allowanceOf, snapshot, overBudget, record, DAILY_CAP, DEFAULT_BUDGET_USD } from '../../ai/meter';
import { engineFor, editionOf } from '../../ai/router';
import { inRe, str, oneOf, typeName, featureName, leadScope, memberOf, dayStart, like, settingsOf, RE_TYPES } from './common';
import { cardCols, withCovers, leadsFor } from './properties';
import { matchesFor } from './leads';
import type { AppEnv, Deps } from '../../types';

/** One AI action, metered like the rest of Hemlo AI. */
export function aiGuard(d: Deps) {
  const look = async (a: Actor, feature: string) => {
    const [snap, sub] = await Promise.all([snapshot(d.db, a.organizationId), subscriptionOf(d.db, a.organizationId)]);
    const engine = await engineFor(d, editionOf(sub, snap.kind), feature);
    return { engine, s: { demo: snap.demo, off: snap.off, used: snap.month, today: snap.day, allowance: allowanceOf(sub, snap.demo), available: engine?.name ?? null } };
  };
  const status = async (a: Actor, feature = 're_describe') => (await look(a, feature)).s;
  const run = async <T,>(a: Actor, feature: string, fn: (e: Engine) => Promise<{ data: T; model: string; inputTokens: number; outputTokens: number; costMicros: number }>) => {
    const { s, engine } = await look(a, feature);
    if (s.off) throw new HttpError(403, 'AI_OFF');
    if (!engine) throw new HttpError(503, 'AI_UNAVAILABLE');
    if (s.used >= s.allowance) throw new HttpError(429, 'AI_LIMIT');
    if (s.today >= DAILY_CAP) throw new HttpError(429, 'AI_DAILY_LIMIT');
    if (engine.paid && await overBudget(d.db, Number(d.env.AI_BUDGET_USD) || DEFAULT_BUDGET_USD)) throw new HttpError(503, 'AI_BUSY');
    const t0 = Date.now();
    try {
      const out = await fn(engine);
      await record(d.db, a.organizationId, { userId: a.userId, feature, engine: engine.name, model: out.model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, costMicros: out.costMicros, ms: Date.now() - t0, ok: true });
      return { data: out.data, used: s.used + 1, allowance: s.allowance };
    } catch (err) {
      await record(d.db, a.organizationId, { userId: a.userId, feature, engine: engine.name, ms: Date.now() - t0, ok: false }).catch(() => {});
      console.error('[ai]', feature, err instanceof Error ? err.message : err);
      throw new HttpError(503, err instanceof AiError && err.message === 'REFUSED' ? 'AI_REFUSED' : 'AI_FAILED');
    }
  };
  return { status, run };
}

// ---------- descriptions ----------
export const TEXT_SCHEMA: JsonSchema = { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } };
const MODES = ['write', 'shorten', 'expand', 'polish', 'translate'] as const;
export const DESCRIBE = `You write property listings for an Iraqi real-estate agency's public page.
Rules that never bend:
- Use ONLY the facts given. Never invent a number, a size, a price, a distance, a feature, a neighbourhood landmark or a promise.
- If a fact is missing, leave it out. Do not guess.
- No exaggeration ("the best", "unmissable"), no emojis, no hashtags, no contact details, no price unless asked.
- Arabic: clear Modern Standard Arabic an Iraqi buyer reads easily. English: plain, warm, professional.
- 60–140 words for "write" and "expand"; under 60 for "shorten". Short paragraphs. Return JSON: {"text": "..."}.`;

/** Every number that may appear in a description (from the facts and the agent's own notes). */
export function allowedNumbers(facts: Record<string, unknown>, notes: string) {
  const s = new Set<string>();
  const add = (v: unknown) => { for (const m of String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/,/g, '').matchAll(/\d+(?:\.\d+)?/g)) s.add(String(Number(m[0]))); };
  for (const v of Object.values(facts)) add(v);
  add(notes);
  return s;
}
/** Numbers in the text that weren't in the facts (to show the agent before they accept it). */
export function strayNumbers(text: string, allowed: Set<string>) {
  const found = [...text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/,/g, '').matchAll(/\d+(?:\.\d+)?/g)].map((m) => String(Number(m[0])));
  return [...new Set(found.filter((n) => !allowed.has(n) && Number(n) > 1))];
}

// ---------- questions ----------
const TOOLS = ['viewings_today', 'followups_due', 'find_properties', 'top_interest', 'not_converting', 'lead_summary', 'leads_for_property', 'negotiations', 'quiet_leads', 'unknown'] as const;
export const ASK_SCHEMA: JsonSchema = { type: 'object', additionalProperties: false, required: ['tool', 'type', 'area', 'max', 'min', 'bedrooms', 'purpose', 'name', 'ref'],
  properties: { tool: { type: 'string', enum: [...TOOLS] }, type: { type: 'string', enum: ['', ...RE_TYPES] }, area: { type: 'string' }, max: { type: 'number' }, min: { type: 'number' }, bedrooms: { type: 'number' },
    purpose: { type: 'string', enum: ['', 'sale', 'rent'] }, name: { type: 'string' }, ref: { type: 'number' } } };
export const ROUTER = `You route a real-estate agent's question (Iraqi Arabic, Arabic, English or Kurdish) to ONE tool. Reply with JSON only.
Tools:
- viewings_today: today's viewings ("شنو معاينات اليوم؟", "show me today's viewings")
- followups_due: leads that need a follow-up now ("منو لازم أتابع؟", "which leads need follow-up?")
- find_properties: search listings; fill type, area, min, max (plain numbers, "200k" = 200000, "مليون" = 1000000), bedrooms, purpose ("فلل تحت 200 ألف بدريم ستي", "villas under $200k in Dream City")
- top_interest: listings getting the most interest ("which properties are hot?")
- not_converting: listings with interest but no offers, or why one isn't selling; put its number in ref if given
- lead_summary: one customer's history; put their name in name ("summarize Ahmed's history")
- leads_for_property: customers who may want one listing; put its number in ref ("who might want villa 4821?")
- negotiations: deals waiting on an answer
- quiet_leads: customers nobody has contacted lately
- unknown: anything else
Unused fields: "" for text, 0 for numbers.`;

export function reAiRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const g = aiGuard(d);

  r.get('/ai', async (c) => c.json(await g.status(actor(c, 'listings', 'read'))));

  /** Write or rework a listing description. { propertyId?, facts?, notes?, text?, mode, lang, from? } → { text, stray } */
  r.post('/ai/describe', async (c) => {
    const a = actor(c, 'listings', 'update');
    const b = await c.req.json<any>();
    const mode = oneOf(b.mode, MODES, 'BAD_MODE', 'write');
    const lang = oneOf(b.lang, ['ar', 'en'] as const, 'BAD_LANG', 'ar');
    const notes = str(b.notes, 1500, 'BAD_TEXT') ?? '';
    const text = str(b.text, 6000, 'BAD_TEXT') ?? '';
    if (mode !== 'write' && !text) bad('BAD_TEXT');
    // the facts come from the listing itself when there is one (one source of truth), else from the form
    let facts: Record<string, unknown> = {};
    if (b.propertyId) {
      const [p] = await inRe(d, a, (tx) => tx.select().from(reProperty).where(eq(reProperty.id, String(b.propertyId))));
      if (!p) throw new HttpError(404, 'PROPERTY_NOT_FOUND');
      facts = { type: typeName(p.type, lang), purpose: p.purpose, area: p.area, city: p.city, size_m2: p.size, land_m2: p.land, bedrooms: p.bedrooms, bathrooms: p.bathrooms, floors: p.floors, parking: p.parking,
        year_built: p.yearBuilt, furnished: p.furnished, condition: p.condition, features: (p.features ?? []).map((f) => featureName(f, lang)).join(', '), title: p.title };
    } else if (b.facts && typeof b.facts === 'object') {
      const f = b.facts;
      facts = { type: typeName(String(f.type ?? ''), lang), purpose: f.purpose, area: str(f.area, 80, 'BAD_TEXT'), city: str(f.city, 60, 'BAD_TEXT'), size_m2: f.size, land_m2: f.land, bedrooms: f.bedrooms, bathrooms: f.bathrooms,
        floors: f.floors, parking: f.parking, year_built: f.yearBuilt, furnished: f.furnished, condition: f.condition, features: Array.isArray(f.features) ? f.features.slice(0, 40).map((x: string) => featureName(String(x), lang)).join(', ') : '' };
    }
    for (const k of Object.keys(facts)) if (facts[k] == null || facts[k] === '') delete facts[k];
    const ask = mode === 'write' ? `Write the listing in ${lang === 'ar' ? 'Arabic' : 'English'}.\nFacts: ${JSON.stringify(facts)}\nAgent's notes (may be messy, in any language): ${notes || '—'}`
      : mode === 'translate' ? `Translate this listing into ${lang === 'ar' ? 'Arabic' : 'English'}, faithfully, keeping every fact and adding none.\n${text}`
      : `${mode === 'shorten' ? 'Shorten' : mode === 'expand' ? 'Expand (only with the facts given)' : 'Make more professional'} this listing, in ${lang === 'ar' ? 'Arabic' : 'English'}.\nFacts: ${JSON.stringify(facts)}\nListing:\n${text}`;
    const out = await g.run<{ text: string }>(a, 're_describe', (e) => e.json<{ text: string }>({ system: DESCRIBE, text: ask, schema: TEXT_SCHEMA, maxTokens: 900 }));
    const result = String(out.data?.text ?? '').trim().slice(0, 5000);
    if (!result) throw new HttpError(503, 'AI_FAILED');
    return c.json({ text: result, stray: strayNumbers(result, allowedNumbers(facts, notes + ' ' + text)), used: out.used, allowance: out.allowance });
  });

  /** Ask the agency a question. The AI picks the question; our queries answer it. */
  r.post('/ai/ask', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<{ question?: string }>().catch(() => ({} as { question?: string }));
    const question = String(b.question ?? '').trim();
    if (question.length < 2 || question.length > 400) bad('BAD_QUESTION');
    const routed = await g.run<any>(a, 're_ask', (e) => e.json<any>({ system: ROUTER, text: question, schema: ASK_SCHEMA, maxTokens: 200 }));
    const plan = routed.data ?? {};
    const tool = TOOLS.includes(plan.tool) ? plan.tool : 'unknown';
    const me = memberOf(a);
    const answer = await inRe(d, a, async (tx) => {
      switch (tool) {
        case 'viewings_today':
          return { kind: 'viewings', items: (await tx.select({ v: reViewing, title: reProperty.title, ref: reProperty.ref, lead: reLead.name }).from(reViewing).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId)).leftJoin(reLead, eq(reLead.id, reViewing.leadId))
            .where(and(gte(reViewing.startsAt, dayStart(0)), lt(reViewing.startsAt, dayStart(1)), inArray(reViewing.status, ['scheduled', 'confirmed'])))).map((x) => ({ ...x.v, title: x.title, ref: x.ref, lead: x.lead })) };
        case 'followups_due':
          return { kind: 'followups', items: (await tx.select({ f: reFollowup, lead: reLead.name, leadId: reLead.id }).from(reFollowup).leftJoin(reLead, eq(reLead.id, reFollowup.leadId))
            .where(and(isNull(reFollowup.doneAt), lt(reFollowup.dueAt, dayStart(1)))).orderBy(reFollowup.dueAt).limit(20)).map((x) => ({ ...x.f, lead: x.lead })) };
        case 'find_properties': {
          const w = [inArray(reProperty.status, ['available', 'negotiating']), RE_TYPES.includes(plan.type) ? eq(reProperty.type, plan.type) : undefined, plan.purpose === 'rent' || plan.purpose === 'sale' ? eq(reProperty.purpose, plan.purpose) : undefined,
            plan.max > 0 ? lte(reProperty.price, Math.round(plan.max)) : undefined, plan.min > 0 ? gte(reProperty.price, Math.round(plan.min)) : undefined, plan.bedrooms > 0 ? gte(reProperty.bedrooms, Math.round(plan.bedrooms)) : undefined,
            plan.area ? or(like(reProperty.area, String(plan.area).slice(0, 60)), like(reProperty.city, String(plan.area).slice(0, 60))) : undefined];
          return { kind: 'properties', filters: { type: plan.type || null, area: plan.area || null, max: plan.max || null, min: plan.min || null, bedrooms: plan.bedrooms || null },
            items: await withCovers(d, tx, a.organizationId, await tx.select(cardCols).from(reProperty).where(and(...w)).orderBy(reProperty.price).limit(20)) };
        }
        case 'top_interest':
          return { kind: 'properties', items: await withCovers(d, tx, a.organizationId, await tx.select(cardCols).from(reProperty).where(inArray(reProperty.status, ['available', 'negotiating']))
            .orderBy(desc(sql`coalesce((${reProperty.stats}->>'views')::int, 0) + 5 * (coalesce((${reProperty.stats}->>'wa')::int, 0) + coalesce((${reProperty.stats}->>'requests')::int, 0))`)).limit(8)) };
        case 'not_converting': {
          const [p] = plan.ref > 0 ? await tx.select().from(reProperty).where(eq(reProperty.ref, Math.round(plan.ref))) : [];
          if (p) {
            // plain reasons from the numbers, not a guess: few views, views but no inquiries, viewings but no offers, priced above similar listings
            const s = (p.stats ?? {}) as Record<string, number>;
            const [cmp] = await tx.select({ avg: sql<number>`avg(price / nullif(size, 0))::float`, n: sql<number>`count(*)::int` }).from(reProperty)
              .where(and(eq(reProperty.type, p.type), eq(reProperty.purpose, p.purpose), eq(reProperty.currency, p.currency), sql`lower(${reProperty.area}) = lower(${p.area ?? ''})`, sql`${reProperty.id} <> ${p.id}`, sql`${reProperty.size} > 0`));
            const [v] = await tx.select({ n: sql<number>`count(*) filter (where status = 'completed')::int` }).from(reViewing).where(eq(reViewing.propertyId, p.id));
            const perM2 = p.price && p.size ? Number(p.price) / p.size : null;
            return { kind: 'diagnosis', property: { id: p.id, ref: p.ref, title: p.title }, views: s.views ?? 0, inquiries: (s.wa ?? 0) + (s.calls ?? 0) + (s.requests ?? 0), viewings: v.n,
              days: Math.round((Date.now() - +p.statusAt) / 86400_000), priceVsArea: perM2 && cmp?.avg && cmp.n >= 2 ? Math.round(((perM2 - cmp.avg) / cmp.avg) * 100) : null, comparable: cmp?.n ?? 0, published: !!p.publishedAt };
          }
          return { kind: 'properties', items: await withCovers(d, tx, a.organizationId, await tx.select(cardCols).from(reProperty).where(and(eq(reProperty.status, 'available'),
            sql`coalesce((${reProperty.stats}->>'views')::int, 0) > 30`, sql`not exists (select 1 from re_offer o join re_deal x on x.id = o.deal_id where x.property_id = ${reProperty.id} and o.kind = 'offer')`)).limit(8)) };
        }
        case 'lead_summary': {
          const [l] = plan.name ? await tx.select().from(reLead).where(and(leadScope(a), like(reLead.name, String(plan.name).slice(0, 60)))).orderBy(desc(reLead.updatedAt)).limit(1) : [];
          if (!l) return { kind: 'none' };
          const events = await tx.select().from(reActivity).where(eq(reActivity.leadId, l.id)).orderBy(desc(reActivity.at)).limit(25);
          const m = await matchesFor(d, tx, a.organizationId, l, 3);
          return { kind: 'lead', lead: l, activity: events, matches: m.matches, matchCount: m.total };
        }
        case 'leads_for_property': {
          const [p] = plan.ref > 0 ? await tx.select().from(reProperty).where(eq(reProperty.ref, Math.round(plan.ref))) : [];
          if (!p) return { kind: 'none' };
          return { kind: 'leads', property: { id: p.id, ref: p.ref, title: p.title }, items: (await leadsFor(tx, a, p, (await settingsOf(tx, a.organizationId)).usdRate)).slice(0, 15) };
        }
        case 'negotiations':
          return { kind: 'deals', items: await tx.select({ id: reDeal.id, stage: reDeal.stage, title: reProperty.title, ref: reProperty.ref, lead: reLead.name, updatedAt: reDeal.updatedAt }).from(reDeal)
            .innerJoin(reProperty, eq(reProperty.id, reDeal.propertyId)).leftJoin(reLead, eq(reLead.id, reDeal.leadId)).where(inArray(reDeal.stage, ['offer', 'negotiation', 'reserved'])).orderBy(reDeal.updatedAt).limit(15) };
        case 'quiet_leads':
          return { kind: 'leadlist', items: await tx.select({ id: reLead.id, name: reLead.name, phone: reLead.phone, lastContactAt: reLead.lastContactAt }).from(reLead)
            .where(and(leadScope(a), inArray(reLead.status, ['new', 'active', 'viewing', 'negotiating']), isNull(reLead.archivedAt), or(isNull(reLead.lastContactAt), lt(reLead.lastContactAt, new Date(Date.now() - 10 * 86400_000)))))
            .orderBy(reLead.lastContactAt).limit(15) };
        default: return { kind: 'none' };
      }
    });
    return c.json({ tool, answer, used: routed.used, allowance: routed.allowance, me });
  });

  return r;
}
