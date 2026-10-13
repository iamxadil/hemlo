// Hemlo AI Studio: marketing for a business from what it sells: an agency's listings, a shop's products. Campaign copy in Arabic and English for
// WhatsApp, Instagram and Facebook; a content plan for the coming weeks; post images. Every call is checked on the server:
// the add-on is on, the month's allowance (copy, images, video, and the IQD set aside for media), a daily guard, and
// Hemlo's own monthly ceilings. Images and video run only on a model the team chose in admin, at the price they entered;
// video needs a provider with a video API, which no engine has yet, so it answers VIDEO_PROVIDER_MISSING.
import { Hono } from 'hono';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg } from '@hemlo/db';
import { reProperty, sysFile, sysProduct } from '@hemlo/db/schema';
import { editionOf } from '../connect/core';
import type { Context } from 'hono';
import { HttpError } from '../principal';
import { actor, bad, type Actor } from './sys-common';
import { addonEntitlement, limitsOf } from '../addons';
import { costsOf, usdToIqd } from '../costs';
import { engineFor } from '../ai/router';
import { AiError } from '../ai/engine';
import { record, baghdadStarts, overBudget, mediaOverBudget, DAILY_CAP, DEFAULT_BUDGET_USD } from '../ai/meter';
import { inventedNumbers } from '../connect/core';
import { priceText, typeName } from './realestate/common';
import { fileKey } from '../files';
import { publicFile } from './files';
import { isDemoOrg } from './demo';
import type { AppEnv, Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const DEMO = { studioMonth: 10, imagesMonth: 2, videosMonth: 0 }; // a demo tries it; it never spends real money at scale
const GOALS = ['sell', 'rent', 'launch', 'open_house', 'price_drop', 'brand', 'offer', 'season', 'bestseller'] as const;
const CHANNELS = ['whatsapp', 'instagram', 'facebook'] as const;

/** The month's use of AI Studio for one business, in one query: copy, images, video, what media cost, and today's calls. */
async function usageOf(d: Deps, org: string) {
  const { month, day } = baghdadStarts();
  const [r] = rowsOf(await withOrg(d.db, org, (tx) => tx.execute(sql`select
      count(*) filter (where feature = 'studio_copy' and ok)::int as copy,
      count(*) filter (where feature = 'studio_image' and ok)::int as images,
      count(*) filter (where feature = 'studio_video' and ok)::int as videos,
      coalesce(sum(cost_micros) filter (where kind in ('image', 'video')), 0)::bigint as media_micros,
      count(*) filter (where created_at >= ${day.toISOString()})::int as today
    from ai_usage where organization_id = ${org} and feature like 'studio%' and created_at >= ${month.toISOString()}`)));
  return { copy: Number(r?.copy ?? 0), images: Number(r?.images ?? 0), videos: Number(r?.videos ?? 0), mediaMicros: Number(r?.media_micros ?? 0), today: Number(r?.today ?? 0) };
}

async function stateOf(d: Deps, org: string) {
  const [access, used, costs, demo] = await Promise.all([addonEntitlement(d.db, org, 'ai-studio'), usageOf(d, org), costsOf(d.db), isDemoOrg(d, org)]);
  const l = limitsOf(access.offer);
  const limits = demo ? { ...l, studioMonth: Math.min(l.studioMonth, DEMO.studioMonth), imagesMonth: Math.min(l.imagesMonth, DEMO.imagesMonth), videosMonth: DEMO.videosMonth } : l;
  const mediaIqd = usdToIqd(costs, used.mediaMicros); // null while the dollar rate isn't entered
  return { active: access.active, offer: access.offer, limits, used: { ...used, mediaIqd }, costs, demo };
}

/** An agency reads and writes through its listings permissions; a shop through its products. */
const who = (c: Context<AppEnv>, write: boolean): Actor => { try { return actor(c, 'listings', write ? 'update' : 'read'); } catch { return actor(c, 'products', 'manage'); } };

export function studioRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const need = async (a: Actor) => {
    const s = await stateOf(d, a.organizationId);
    if (!s.active) throw new HttpError(402, 'ADDON_NOT_ACTIVE');
    if (s.used.today >= DAILY_CAP) throw new HttpError(429, 'DAILY_LIMIT');
    return s;
  };
  const listings = (a: Actor, ids: string[]) => withOrg(d.db, a.organizationId, (tx) => tx.select({ id: reProperty.id, ref: reProperty.ref, title: reProperty.title, titleEn: reProperty.titleEn,
    type: reProperty.type, purpose: reProperty.purpose, price: reProperty.price, currency: reProperty.currency, rentPeriod: reProperty.rentPeriod, area: reProperty.area, city: reProperty.city,
    bedrooms: reProperty.bedrooms, size: reProperty.size, features: reProperty.features, slug: reProperty.slug })
    .from(reProperty).where(and(eq(reProperty.organizationId, a.organizationId), isNotNull(reProperty.publishedAt), ...(ids.length ? [inArray(reProperty.id, ids)] : [])))
    .orderBy(desc(reProperty.publishedAt)).limit(ids.length ? 6 : 12));
  type Item = { id: string; ref: number; title: string; titleEn: string | null; facts: string; image: string };
  const shopItems = async (a: Actor, ids: string[]): Promise<Item[]> => {
    const rows = await withOrg(d.db, a.organizationId, (tx) => tx.select({ id: sysProduct.id, name: sysProduct.name, category: sysProduct.category, price: sysProduct.price, unit: sysProduct.unit, description: sysProduct.description })
      .from(sysProduct).where(and(eq(sysProduct.organizationId, a.organizationId), sql`${sysProduct.archivedAt} is null`, ...(ids.length ? [inArray(sysProduct.id, ids)] : [])))
      .orderBy(desc(sysProduct.online), desc(sysProduct.updatedAt)).limit(ids.length ? 6 : 16));
    return rows.map((p, i) => ({ id: p.id, ref: i + 1, title: p.name, titleEn: null, image: [p.name, p.category].filter(Boolean).join(', '),
      facts: [`#${i + 1}`, p.category ? `${p.name} (${p.category})` : p.name, `${p.price} IQD per ${p.unit}`, p.description ? p.description.slice(0, 200) : ''].filter(Boolean).join(' | ') }));
  };
  /** What the business sells, in one shape: an id, a number to point at, a title, the facts the model may use. */
  const itemsOf = async (a: Actor, ids: string[]): Promise<{ shop: boolean; items: Item[] }> => {
    if ((await editionOf(d, a.organizationId)) !== 'realestate') return { shop: true, items: await shopItems(a, ids) };
    const ps = await listings(a, ids);
    return { shop: false, items: ps.map((p) => ({ id: p.id, ref: p.ref, title: p.title, titleEn: p.titleEn, facts: factsOf([p]),
      image: [typeName(p.type, 'en') + ' in ' + [p.area, p.city].filter(Boolean).join(', ') + ', Iraq', p.bedrooms ? p.bedrooms + ' bedrooms' : ''].filter(Boolean).join(', ') })) };
  };
  const factsOf = (ps: Awaited<ReturnType<typeof listings>>) => ps.map((p) => `#${p.ref} | ${typeName(p.type, 'en')} for ${p.purpose} | ${[p.area, p.city].filter(Boolean).join(', ')} | ${p.bedrooms ?? '-'} bedrooms | ${p.size ?? '-'} m² | ${priceText(p.price == null ? null : Number(p.price), p.currency, 'en', p.purpose === 'rent' ? p.rentPeriod : null)} | ${(p.features ?? []).slice(0, 8).join(', ')} | AR title: ${p.title}${p.titleEn ? ` | EN title: ${p.titleEn}` : ''}`).join('\n');
  const agencyOf = async (org: string) => rowsOf(await withOrg(d.db, org, (tx) => tx.execute(sql`select name from organization where id = ${org}`)))[0]?.name ?? 'Hemlo';

  /** One text job, metered: the model's JSON, or a clear reason it couldn't. */
  async function text<T>(a: Actor, system: string, prompt: string, schema: Record<string, unknown>, maxTokens: number) {
    const engine = await engineFor(d, await editionOf(d, a.organizationId), 'studio_copy', a.organizationId);
    if (!engine) throw new HttpError(503, 'AI_UNAVAILABLE');
    if (engine.paid && await overBudget(d.db, Number(d.env.AI_BUDGET_USD) || DEFAULT_BUDGET_USD)) throw new HttpError(503, 'AI_BUSY');
    const t0 = Date.now();
    try {
      const out = await engine.json<T>({ system, text: prompt, schema, maxTokens });
      await record(d.db, a.organizationId, { userId: a.userId, feature: 'studio_copy', engine: engine.name, model: out.model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, costMicros: out.costMicros, ms: Date.now() - t0, ok: true, counted: false });
      return out.data;
    } catch (e) {
      await record(d.db, a.organizationId, { userId: a.userId, feature: 'studio_copy', engine: engine.name, ms: Date.now() - t0, ok: false, counted: false }).catch(() => {});
      throw new HttpError(503, e instanceof AiError && e.message === 'REFUSED' ? 'AI_REFUSED' : 'AI_FAILED');
    }
  }

  /** What the Studio page shows: on or not, the month's allowance and use, and which tools can run here. */
  r.get('/', async (c) => {
    const a = who(c, false);
    const s = await stateOf(d, a.organizationId);
    const edition = await editionOf(d, a.organizationId);
    const [image, video] = await Promise.all([engineFor(d, edition, 'studio_image', a.organizationId), engineFor(d, edition, 'studio_video', a.organizationId)]);
    return c.json({
      active: s.active, offer: s.offer ? { code: s.offer.code, name: s.offer.name, description: s.offer.description, priceMonth: s.offer.priceMonth, priceYear: s.offer.priceYear } : null,
      allowance: { copy: s.limits.studioMonth, images: s.limits.imagesMonth, videos: s.limits.videosMonth },
      used: { copy: s.used.copy, images: s.used.images, videos: s.used.videos },
      tools: { copy: true, plan: true, image: !!image?.image, video: !!video?.video }, edition,
    });
  });

  /** A campaign: copy for each channel, in Arabic and English, from the chosen listings (only their facts). */
  r.post('/campaign', async (c) => {
    const a = who(c, true);
    const s = await need(a);
    if (s.used.copy >= s.limits.studioMonth) throw new HttpError(429, 'STUDIO_ALLOWANCE_USED');
    const b = await c.req.json<{ propertyIds?: string[]; goal?: string; channels?: string[]; note?: string }>().catch(() => ({} as any));
    const ids = Array.isArray(b.propertyIds) ? b.propertyIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 6) : [];
    if (!ids.length) bad('PICK_LISTINGS');
    const goal = (GOALS as readonly string[]).includes(String(b.goal)) ? String(b.goal) : 'sell';
    const channels = ((Array.isArray(b.channels) ? b.channels : [...CHANNELS]) as string[]).filter((x) => (CHANNELS as readonly string[]).includes(x));
    if (!channels.length) bad('PICK_CHANNELS');
    const { shop, items } = await itemsOf(a, ids);
    if (!items.length) throw new HttpError(404, shop ? 'PRODUCT_NOT_FOUND' : 'PROPERTY_NOT_FOUND');
    const agency = await agencyOf(a.organizationId), facts = items.map((x) => x.facts).join('\n');
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 400) : '';
    const per = { type: 'object', additionalProperties: false, required: [...channels, 'hashtags'],
      properties: { ...Object.fromEntries(channels.map((ch: string) => [ch, { type: 'string' }])), hashtags: { type: 'array', items: { type: 'string' } } } };
    const out = await text<Record<'ar' | 'en', Record<string, any>> & { headline: { ar: string; en: string } }>(a,
      `You write ${shop ? 'marketing for ' + agency + ', a shop in Iraq' : 'real-estate marketing for ' + agency + ', an agency in Iraq'}. Write one campaign, in Arabic (Iraqi-friendly, not stiff) and in English.
Channels: ${channels.join(', ')}. WhatsApp: a short broadcast message (under 70 words) that ends with a question. Instagram: a caption with line breaks and a call to action. Facebook: a slightly longer post.
Rules that never bend: use ONLY the facts given (${shop ? 'products, prices, descriptions' : 'prices, sizes, places, features'}); never invent a number, a discount, an address or a promise. No emojis in WhatsApp text; a few are fine elsewhere. Hashtags: 5 to 8, without the # sign, in the language of the text. Return JSON only.`,
      `Goal: ${goal.replace('_', ' ')}.${note ? `\nThe ${shop ? 'shop' : 'agency'}'s note: ${note}` : ''}\n${shop ? 'Products' : 'Listings'} (the only facts you may use):\n${facts}`,
      { type: 'object', additionalProperties: false, required: ['headline', 'ar', 'en'], properties: { headline: { type: 'object', additionalProperties: false, required: ['ar', 'en'], properties: { ar: { type: 'string' }, en: { type: 'string' } } }, ar: per, en: per } },
      1800);
    const all = JSON.stringify(out);
    return c.json({ campaign: out, listings: items.map((p) => ({ id: p.id, ref: p.ref, title: p.title, titleEn: p.titleEn })), checked: inventedNumbers(all, facts + '\n' + note).length === 0 });
  });

  /** A content plan for the coming weeks: what to post, where, on which day, about which listing. */
  r.post('/plan', async (c) => {
    const a = who(c, true);
    const s = await need(a);
    if (s.used.copy >= s.limits.studioMonth) throw new HttpError(429, 'STUDIO_ALLOWANCE_USED');
    const b = await c.req.json<{ weeks?: number; focus?: string; lang?: string }>().catch(() => ({} as any));
    const weeks = Math.min(4, Math.max(1, Math.floor(Number(b.weeks) || 4)));
    const lang = b.lang === 'en' ? 'English' : 'Arabic';
    const { shop, items } = await itemsOf(a, []);
    const agency = await agencyOf(a.organizationId);
    const out = await text<{ weeks: { title: string; posts: { day: string; channel: string; idea: string; ref: number }[] }[] }>(a,
      `You plan social media for ${agency}, ${shop ? 'a shop' : 'a real-estate agency'} in Iraq. Plan ${weeks} week(s), 3 to 4 posts a week across WhatsApp status, Instagram and Facebook: ${shop ? 'a mix of its products, tips on using them, the season and occasions in Iraq, and the shop itself' : "a mix of listings, buyer tips, the local market and the agency's team"}. Write in ${lang}. Days are weekday names. "ref" is ${shop ? "a product's" : "a listing's"} number when a post is about one, else 0. Use only the ${shop ? 'products' : 'listings'} given; never invent prices, discounts or facts. Return JSON only.`,
      `${typeof b.focus === 'string' && b.focus.trim() ? `Focus: ${b.focus.trim().slice(0, 300)}\n` : ''}${shop ? 'Products' : 'Listings'}:\n${items.map((x) => x.facts).join('\n') || '(none yet)'}`,
      { type: 'object', additionalProperties: false, required: ['weeks'], properties: { weeks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'posts'],
        properties: { title: { type: 'string' }, posts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['day', 'channel', 'idea', 'ref'],
          properties: { day: { type: 'string' }, channel: { type: 'string' }, idea: { type: 'string' }, ref: { type: 'integer' } } } } } } } } },
      2500);
    return c.json({ plan: { weeks: (out.weeks ?? []).slice(0, weeks) }, items: items.map((x) => ({ id: x.id, ref: x.ref, title: x.title, titleEn: x.titleEn })) });
  });

  /** A post image from a description (and, optionally, a listing's facts). Paid models count against the month's media
   *  allowance in IQD and Hemlo's monthly media ceiling; every image counts against the month's number of images. */
  r.post('/image', async (c) => {
    const a = who(c, true);
    const s = await need(a);
    if (s.used.images >= s.limits.imagesMonth) throw new HttpError(429, 'IMAGE_ALLOWANCE_USED');
    const engine = await engineFor(d, await editionOf(d, a.organizationId), 'studio_image', a.organizationId);
    if (!engine?.image) throw new HttpError(503, 'IMAGE_PROVIDER_MISSING');
    if (engine.paid) {
      if (s.used.mediaIqd == null) throw new HttpError(503, 'COSTS_NOT_SET'); // a paid model with no dollar rate: the spend can't be checked
      if (s.used.mediaIqd >= s.limits.mediaIqd) throw new HttpError(429, 'MEDIA_ALLOWANCE_USED');
      if (await mediaOverBudget(d.db, s.costs.mediaBudgetUsd)) throw new HttpError(503, 'AI_BUSY');
    }
    if (!d.files) throw new HttpError(503, 'UPLOADS_UNAVAILABLE');
    const b = await c.req.json<{ prompt?: string; propertyId?: string; style?: string }>().catch(() => ({} as any));
    const ask = typeof b.prompt === 'string' ? b.prompt.trim().slice(0, 600) : '';
    const shop = (await editionOf(d, a.organizationId)) !== 'realestate';
    const [p] = b.propertyId ? (await itemsOf(a, [String(b.propertyId)])).items : [];
    if (!ask && !p) bad('BAD_PROMPT');
    const style = ['photo', 'minimal', 'luxury', 'warm'].includes(String(b.style)) ? String(b.style) : 'photo';
    const prompt = [`A ${style === 'photo' ? 'photorealistic' : style} ${shop ? 'product marketing photo for a shop' : 'real-estate marketing image'}.`, p ? `${p.image}.` : '', ask && ask.replace(/[.\s]*$/, '.'),
      'No text, no letters, no logos, no watermarks.'].filter(Boolean).join(' ');
    const t0 = Date.now();
    let img;
    try { img = await engine.image(prompt); }
    catch (e) {
      await record(d.db, a.organizationId, { userId: a.userId, feature: 'studio_image', engine: engine.name, ms: Date.now() - t0, ok: false, counted: false, kind: 'image' }).catch(() => {});
      throw new HttpError(503, 'AI_FAILED', e instanceof Error ? e.message.slice(0, 200) : undefined);
    }
    await record(d.db, a.organizationId, { userId: a.userId, feature: 'studio_image', engine: engine.name, model: img.model, costMicros: img.costMicros, ms: Date.now() - t0, ok: true, counted: false, kind: 'image' });
    const id = newId(), body = img.bytes.buffer.slice(img.bytes.byteOffset, img.bytes.byteOffset + img.bytes.byteLength) as ArrayBuffer;
    await d.files.put(fileKey(a.organizationId, id), body, img.mime);
    const [f] = await withOrg(d.db, a.organizationId, (tx) => tx.insert(sysFile).values({ id, organizationId: a.organizationId, purpose: 'studio', refId: p?.id ?? null, mime: img.mime, bytes: body.byteLength, createdBy: a.userId }).returning());
    return c.json({ file: await publicFile(d, f) }, 201);
  });

  /** Promotional video: only with a provider that makes video (none is connected yet). Checked like images. */
  r.post('/video', async (c) => {
    const a = who(c, true);
    const s = await need(a);
    const engine = await engineFor(d, await editionOf(d, a.organizationId), 'studio_video', a.organizationId);
    if (!engine?.video) throw new HttpError(503, 'VIDEO_PROVIDER_MISSING');
    if (s.used.videos >= s.limits.videosMonth) throw new HttpError(429, 'VIDEO_ALLOWANCE_USED');
    throw new HttpError(503, 'VIDEO_PROVIDER_MISSING');
  });

  return r;
}
