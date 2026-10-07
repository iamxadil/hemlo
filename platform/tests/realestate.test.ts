// Hemlo Systems · Real Estate: an agency from its first day. The matcher on its own; then the whole loop on a real
// database — a listing, its photos and public page, a lead and their matches, a collection, a viewing request from the
// page, viewings and follow-ups, a negotiation to a closed deal and its commission, the owner's report — and who may
// see what (an agent's leads, the money), with one agency never seeing another's data.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, signInPhone } from './helpers';
import { matchOf, rank, placeKey, inCurrency, type LeadWants, type PropertyFacts } from '../apps/api/src/routes/realestate/match';
import { parseQuery } from '../apps/api/src/routes/realestate/today';
import { shareText } from '../apps/api/src/routes/realestate/common';
import { commissionOf } from '../apps/api/src/routes/realestate/work';
import { strayNumbers, allowedNumbers } from '../apps/api/src/routes/realestate/ai';
import type { Engine, AskJson } from '../apps/api/src/ai/engine';

const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const asked: AskJson[] = [];
const fake: Engine = {
  name: 'test',
  async json<T>(req: AskJson) {
    asked.push(req);
    const data: any = req.system.includes('route a real-estate')
      ? (/villa|فلل/i.test(req.text) ? { tool: 'find_properties', type: 'villa', area: 'Dream City', max: 200000, min: 0, bedrooms: 0, purpose: '', name: '', ref: 0 } : { tool: 'viewings_today', type: '', area: '', max: 0, min: 0, bedrooms: 0, purpose: '', name: '', ref: 0 })
      : { text: 'A bright 4-bedroom villa of 320 m² in Dream City, with a renovated kitchen and a private garage. Only 5 minutes from the airport.' };
    return { data: data as T, model: 'test', inputTokens: 10, outputTokens: 10, costMicros: 0 };
  },
};

// ---------------------------------------------------------------- the matcher alone
const ahmed: LeadWants = { purpose: 'sale', types: ['villa'], areas: ['Dream City', 'Zawa'], city: 'Erbil', budgetMin: 150_000, budgetMax: 220_000, currency: 'USD', bedrooms: 3, bathrooms: null, sizeMin: 250, sizeMax: null, must: [] };
const villa = (x: Partial<PropertyFacts> = {}): PropertyFacts => ({ purpose: 'sale', type: 'villa', status: 'available', area: 'Dream City', city: 'Erbil', price: 185_000, currency: 'USD', bedrooms: 4, bathrooms: 3, size: 320, features: ['garage'], ...x });

describe('the matcher', () => {
  it('a villa that fits every requirement scores 100, with every reason a yes', () => {
    const m = matchOf(ahmed, villa())!;
    expect(m.score).toBe(100);
    expect(m.reasons.map((r) => r.key)).toEqual(['price', 'type', 'location', 'bedrooms', 'size']);
    expect(m.reasons.every((r) => r.fit === 'yes')).toBe(true);
  });
  it('the wrong purpose, the wrong kind, a sold home, or far over budget is no match at all', () => {
    expect(matchOf(ahmed, villa({ purpose: 'rent' }))).toBeNull();
    expect(matchOf(ahmed, villa({ type: 'apartment' }))).toBeNull();
    expect(matchOf(ahmed, villa({ status: 'sold' }))).toBeNull();
    expect(matchOf(ahmed, villa({ price: 260_000 }))).toBeNull(); // 18% over
  });
  it('a little over budget, elsewhere in the city, a bedroom short: nearly, and the score says by how much', () => {
    const m = matchOf(ahmed, villa({ price: 235_000, area: 'Ankawa', bedrooms: 2 }))!;
    expect(m.reasons.find((r) => r.key === 'price')!.fit).toBe('near');
    expect(m.reasons.find((r) => r.key === 'location')!.fit).toBe('near');
    expect(m.reasons.find((r) => r.key === 'bedrooms')!.fit).toBe('near');
    expect(m.score).toBeGreaterThan(50);
    expect(m.score).toBeLessThan(80);
  });
  it('only what the lead asked for counts', () => {
    const loose: LeadWants = { ...ahmed, types: [], areas: [], city: null, bedrooms: null, sizeMin: null };
    expect(matchOf(loose, villa({ bedrooms: 1, size: 90 }))!.score).toBe(100); // only the budget was given, and it fits
  });
  it('dinars and dollars are compared at the agency’s rate', () => {
    expect(inCurrency(100_000, 'USD', 'IQD', 1450)).toBe(145_000_000);
    expect(matchOf({ ...ahmed, currency: 'IQD', budgetMin: null, budgetMax: 300_000_000 }, villa({ price: 185_000 }), 1450)!.reasons[0]).toEqual({ key: 'price', fit: 'yes' });
  });
  it('place names match however they are written', () => {
    expect(placeKey('Al-Mansour')).toBe(placeKey('mansour'));
    expect(placeKey('المنصور')).toBe(placeKey('منصور'));
    expect(placeKey('عين كاوة')).toBe(placeKey('عين كاوه'));
  });
  it('ranks the best first and leaves out weak ones', () => {
    const list = [villa({ price: 240_000, area: 'Ankawa', bedrooms: 2 }), villa(), villa({ area: 'Zawa', size: 280 })];
    const r = rank(ahmed, list);
    expect(r[0].p).toBe(list[1]);
    expect(r.every((x) => x.m.score >= 60)).toBe(true);
  });
});

describe('small helpers', () => {
  it('the search box understands plain requests', () => {
    expect(parseQuery('villas under 200k in Dream City')).toMatchObject({ type: 'villa', max: 200_000, area: 'dream city' });
    expect(parseQuery('شقق للإيجار تحت 800 ألف في المنصور')).toMatchObject({ type: 'apartment', purpose: 'rent', max: 800_000, area: 'المنصور' });
    expect(parseQuery('3 bedroom house over 150k')).toMatchObject({ type: 'house', beds: 3, min: 150_000 });
    expect(parseQuery('viewings today').viewingsToday).toBe(true);
    expect(parseQuery('Ahmed').rest).toBe('ahmed');
  });
  it('the WhatsApp message carries the facts and the link, and skips what is missing', () => {
    const t = shareText({ ref: 4821, title: 'Villa in Dream City', titleEn: null, type: 'villa', purpose: 'sale', price: 185000, currency: 'USD', rentPeriod: null, area: 'Dream City', city: 'Erbil', size: 320, bedrooms: 4, bathrooms: 3, slug: 'villa-abc123' }, 'en', 'https://hemlohq.com/p/villa-abc123');
    expect(t).toContain('🏠 Villa in Dream City');
    expect(t).toContain('💰 $185,000');
    expect(t).toContain('📐 320 m²');
    expect(t).toContain('🛏 4 bedrooms');
    expect(t).toContain('https://hemlohq.com/p/villa-abc123');
    expect(shareText({ ref: 1, title: 'Land', titleEn: null, type: 'land', purpose: 'sale', price: null, currency: 'USD', rentPeriod: null, area: null, city: null, size: null, bedrooms: null, bathrooms: null, slug: 'land-xyz789' }, 'ar', 'L')).not.toContain('🛏');
  });
  it('commission: a percentage of the agreed price (or the asking), split with the agent', () => {
    expect(commissionOf({ agreed: 190_000, asking: 200_000, commissionKind: 'percent', commissionValue: 200, agentShare: 4000 })).toEqual({ total: 3800, agent: 1520 });
    expect(commissionOf({ agreed: null, asking: 200_000, commissionKind: 'fixed', commissionValue: 2500, agentShare: 5000 })).toEqual({ total: 2500, agent: 1250 });
  });
  it('numbers the AI made up are caught', () => {
    const allowed = allowedNumbers({ size_m2: 320, bedrooms: 4 }, 'renovated kitchen');
    expect(strayNumbers('A 4-bedroom villa of 320 m², 5 minutes from the airport', allowed)).toEqual(['5']);
  });
});

// ---------------------------------------------------------------- the whole loop
let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, agentB: Browser, other: Browser, desk: Browser;
let agencyId: string;
const ids: Record<string, any> = {};
const join = async (role: string, phone: string, name: string) => {
  const inv = await owner.post('/v1/invites', { phone, role, name });
  expect(inv.status).toBe(201);
  const b = new Browser(t.app);
  await signInPhone(b, '+964' + phone.slice(1));
  await b.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  await b.post('/v1/auth/organization/set-active', { organizationId: agencyId });
  return b;
};

beforeAll(async () => {
  t = await setup({}, fake);
  owner = new Browser(t.app);
  await signInEmail(owner, 'sara@nakhla-homes.iq');
  await owner.post('/v1/auth/update-user', { name: 'Sara Kareem' });
});

describe('an agency', () => {
  it('starts a 30-day trial with just a name and a city, and the owner is its first agent', async () => {
    const r = await owner.post('/v1/re/start', { name: 'Nakhla Homes', city: 'Erbil', phone: '07501234567' });
    expect(r.status).toBe(201);
    agencyId = r.json.organizationId;
    await owner.post('/v1/auth/organization/set-active', { organizationId: agencyId });
    const me = (await owner.get('/v1/sys/me')).json;
    expect(me.business.kind).toBe('realestate');
    expect(me.subscription).toMatchObject({ edition: 'realestate', status: 'trial' });
    expect(me.can['listings.publish']).toBe(true);
    const s = (await owner.get('/v1/re/setup')).json;
    expect(s.settings).toMatchObject({ currency: 'USD', city: 'Erbil', whatsapp: '+9647501234567' });
    expect(s.team).toHaveLength(1);
    expect((await owner.post('/v1/re/start', { name: 'Again' })).json.error).toBe('TRIAL_USED');
  });
  it('a team: a second agent and a receptionist', async () => {
    agentB = await join('agent', '07701110001', 'Omar Agent');
    desk = await join('receptionist', '07701110002', 'Desk');
    const team = (await owner.get('/v1/re/setup')).json.team;
    ids.memberB = team.find((x: any) => x.role === 'agent').id;
    ids.memberOwner = team.find((x: any) => x.role === 'owner').id;
    expect((await agentB.get('/v1/sys/me')).status).toBe(200); // an agent has no stock: the app still opens
  });
});

describe('a listing', () => {
  it('an owner, then the property: a draft with an agency number and a slug', async () => {
    const o = await owner.post('/v1/re/owners', { name: 'Hajji Kamal', phone: '07701234500', commission: { kind: 'percent', value: 200 } });
    expect(o.status).toBe(201);
    ids.owner = o.json.owner.id;
    expect((await owner.post('/v1/re/owners', { name: 'Kamal again', phone: '0770 123 4500' })).json.error).toBe('OWNER_EXISTS');
    const p = await owner.post('/v1/re/properties', { title: 'Villa in Dream City', titleEn: 'Villa in Dream City', type: 'villa', purpose: 'sale', price: 185000, area: 'Dream City', size: 320, bedrooms: 4, bathrooms: 3,
      features: ['garden', 'garage', 'generator'], ownerId: ids.owner, address: 'Street 12, house 44', notes: 'Owner travels in March', ownerMin: 172000, description: { en: 'A family villa with a garden.' } });
    expect(p.status).toBe(201);
    expect(p.json.property).toMatchObject({ status: 'draft', ref: 1001, currency: 'USD', city: 'Erbil' });
    expect(p.json.property.slug).toMatch(/^villa-[a-z0-9]{6}$/);
    ids.villa = p.json.property.id; ids.slug = p.json.property.slug;
  });
  it('the same home again: Hemlo says it looks familiar, and still lets the agent decide', async () => {
    const s = await owner.post('/v1/re/properties/similar', { type: 'villa', area: 'dream city', size: 318, bedrooms: 4 });
    expect(s.json.similar.map((x: any) => x.id)).toContain(ids.villa);
    const p = await owner.post('/v1/re/properties', { title: 'Twin', type: 'villa', area: 'Dream City', size: 321, bedrooms: 4, ownerId: ids.owner });
    expect(p.status).toBe(201);
    expect(p.json.similar.length).toBeGreaterThan(0);
    ids.twin = p.json.property.id;
  });
  it('bad input is refused with a reason', async () => {
    expect((await owner.post('/v1/re/properties', { title: 'x', type: 'castle' })).json.error).toBe('BAD_TYPE');
    expect((await owner.post('/v1/re/properties', { title: 'x', type: 'villa', price: -5 })).json.error).toBe('BAD_PRICE');
    expect((await owner.post('/v1/re/properties', { title: 'x', type: 'villa', lat: 99, lng: 44 })).json.error).toBe('BAD_LOCATION');
  });
  it('no photo, no public page; a photo, and it goes live', async () => {
    expect((await owner.post(`/v1/re/properties/${ids.villa}/publish`, {})).json.error).toBe('NEEDS_PHOTO');
    expect((await owner.get(`/v1/re/pub/p/${ids.slug}`)).status).toBe(404); // a draft doesn't exist publicly
    const up = await owner.upload(`/v1/re/properties/${ids.villa}/photos?w=1600&h=1200`, PNG);
    expect(up.status).toBe(201);
    expect(up.json.cover).toBe(true);
    const up2 = await owner.upload(`/v1/re/properties/${ids.villa}/photos`, PNG);
    await owner.put(`/v1/re/properties/${ids.villa}/photos`, { order: [up2.json.photo.id, up.json.photo.id], coverId: up2.json.photo.id });
    expect((await owner.upload(`/v1/re/properties/${ids.villa}/photos`, new TextEncoder().encode('<svg/>'))).json.error).toBe('NOT_AN_IMAGE');
    const pub = await owner.post(`/v1/re/properties/${ids.villa}/publish`, {});
    expect(pub.status).toBe(200);
    expect(pub.json.property.status).toBe('available');
    expect(pub.json.share.text.en).toContain(`/p/${ids.slug}`);
  });
  it('its public page shows what is public, and nothing else', async () => {
    const visitor = new Browser(t.app);
    const r = await visitor.get(`/v1/re/pub/p/${ids.slug}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    const html = String(r.json);
    expect(html).toContain('Villa in Dream City');
    expect(html).toContain('$185,000');
    expect(html).toContain('og:image');
    expect(html).toContain('RealEstateListing');
    expect(html).toContain('index,follow');
    expect(html).toContain('wa.me/9647501234567'); // the agent's WhatsApp (the owner here), with the property in the message
    for (const secret of ['Street 12', 'Owner travels', '172000', '172,000', 'Hajji Kamal', '07701234500']) expect(html).not.toContain(secret);
    const d = (await owner.get(`/v1/re/properties/${ids.villa}`)).json;
    expect(d.property.stats.views).toBe(1);
    expect(d.funnel.views).toBe(1);
  });
  it('previews (WhatsApp, Facebook) are not counted as views', async () => {
    const bot = new Browser(t.app, 'WhatsApp/2.23.20.0');
    expect((await bot.get(`/v1/re/pub/p/${ids.slug}`)).status).toBe(200);
    expect((await owner.get(`/v1/re/properties/${ids.villa}`)).json.property.stats.views).toBe(1);
  });
  it('a price change lands on the timeline; the lowest price stays with those who see the money', async () => {
    const r = await owner.req('PATCH', `/v1/re/properties/${ids.villa}`, { price: 182000 });
    expect(r.json.property.price).toBe(182000);
    const d = (await owner.get(`/v1/re/properties/${ids.villa}`)).json;
    expect(d.activity.find((x: any) => x.kind === 'property.price').detail).toMatchObject({ from: 185000, to: 182000 });
    expect(d.property.ownerMin).toBe(172000);
    const asAgent = (await agentB.get(`/v1/re/properties/${ids.villa}`)).json;
    expect(asAgent.property.ownerMin).toBeUndefined();
  });
  it('an honest lifecycle: a draft can’t be sold, a sale listing can’t be rented', async () => {
    expect((await owner.post(`/v1/re/properties/${ids.twin}/status`, { status: 'sold' })).json.error).toBe('BAD_STATUS_MOVE');
    expect((await owner.post(`/v1/re/properties/${ids.villa}/status`, { status: 'rented' })).json.error).toBe('BAD_STATUS_MOVE');
    expect((await owner.post(`/v1/re/properties/${ids.twin}/status`, { status: 'archived' })).json.property.status).toBe('archived');
  });
});

describe('a lead', () => {
  it('Ahmed wants a villa under $220k: Hemlo finds the match, and says why', async () => {
    const r = await owner.post('/v1/re/leads', { name: 'Ahmed Saleh', phone: '07709998877', source: 'whatsapp', types: ['villa'], areas: ['Dream City', 'Zawa'], budgetMin: 150000, budgetMax: 220000, bedrooms: 3, sizeMin: 250 });
    expect(r.status).toBe(201);
    ids.ahmed = r.json.lead.id;
    expect(r.json.matchCount).toBe(1);
    expect(r.json.matches[0]).toMatchObject({ score: 100, property: { id: ids.villa } });
    const dup = await owner.post('/v1/re/leads', { name: 'Ahmed', phone: '+964 770 999 8877' });
    expect(dup.status).toBe(409);
    expect(dup.json.twin.id).toBe(ids.ahmed);
  });
  it('a listing that doesn’t fit isn’t offered', async () => {
    const p = await owner.post('/v1/re/properties', { title: 'Flat in Ankawa', type: 'apartment', purpose: 'sale', price: 90000, area: 'Ankawa', bedrooms: 2 });
    ids.flat = p.json.property.id;
    await owner.upload(`/v1/re/properties/${ids.flat}/photos`, PNG);
    await owner.post(`/v1/re/properties/${ids.flat}/publish`, {});
    const m = (await owner.get(`/v1/re/leads/${ids.ahmed}/matches`)).json;
    expect(m.matches.map((x: any) => x.property.id)).toEqual([ids.villa]);
  });
  it('the listing knows Ahmed may want it', async () => {
    const m = (await owner.get(`/v1/re/properties/${ids.villa}/matches`)).json.matches;
    expect(m[0]).toMatchObject({ lead: { id: ids.ahmed }, score: 100 });
  });
  it('send it on WhatsApp: remembered, and the link tells us when he opens it', async () => {
    const s = await owner.post(`/v1/re/leads/${ids.ahmed}/send`, { propertyIds: [ids.villa] });
    expect(s.status).toBe(200);
    expect(s.json.wa).toMatch(/^https:\/\/wa\.me\/9647709998877\?text=/);
    const l = new URL(s.json.text.match(/https:\/\/\S+/)[0]).searchParams.get('l');
    await new Browser(t.app).get(`/v1/re/pub/p/${ids.slug}?l=${l}`);
    const d = (await owner.get(`/v1/re/leads/${ids.ahmed}`)).json;
    expect(d.sent[0]).toMatchObject({ status: 'opened', opens: 1 });
    expect(d.activity.map((x: any) => x.kind)).toEqual(expect.arrayContaining(['lead.sent', 'lead.opened']));
    expect(d.lead.status).toBe('active');
    expect((await owner.post(`/v1/re/leads/${ids.ahmed}/send`, { propertyIds: [ids.twin] })).json.error).toBe('NOT_PUBLISHED');
  });
  it('a collection: one link, he browses and saves one, and the agent sees it', async () => {
    const r = await owner.post('/v1/re/collections', { title: 'Ahmed’s villa selection', leadId: ids.ahmed, propertyIds: [ids.villa, ids.flat], note: 'Two to start with.' });
    expect(r.status).toBe(201);
    const token = r.json.collection.token;
    const page = await new Browser(t.app).get(`/v1/re/pub/c/${token}`);
    expect(page.status).toBe(200);
    expect(String(page.json)).toContain('Ahmed’s villa selection');
    expect(String(page.json)).toContain('noindex');
    await new Browser(t.app).post(`/v1/re/pub/c/${token}/fav`, { propertyId: ids.villa, on: true });
    const d = (await owner.get(`/v1/re/leads/${ids.ahmed}`)).json;
    expect(d.sent.find((x: any) => x.propertyId === ids.villa).status).toBe('favorite');
    expect(d.activity.map((x: any) => x.kind)).toEqual(expect.arrayContaining(['collection.opened', 'lead.favorite']));
    const col = (await owner.get(`/v1/re/collections/${r.json.collection.id}`)).json;
    expect(col.items.find((x: any) => x.propertyId === ids.villa).favorite).toBe(true);
  });
});

describe('from the public page', () => {
  it('a stranger asks for a viewing: a new lead, a viewing to schedule, a notice', async () => {
    const r = await new Browser(t.app).post(`/v1/re/pub/p/${ids.slug}/request`, { name: 'Zainab', phone: '0780 555 1212', preferred: 'Tomorrow', message: 'After 5 please' });
    expect(r.status).toBe(201);
    const leads = (await owner.get('/v1/re/leads?q=Zainab')).json.leads;
    expect(leads[0]).toMatchObject({ source: 'website', phone: '+9647805551212', purpose: 'sale', types: ['villa'], areas: ['Dream City'] });
    ids.zainab = leads[0].id;
    const today = (await owner.get('/v1/re/today?scope=all')).json;
    expect(today.requests.find((x: any) => x.lead.id === ids.zainab)).toMatchObject({ status: 'requested', preferred: 'Tomorrow' });
    expect(today.brief.requests).toBeGreaterThan(0);
    expect(today.notices.some((n: any) => n.kind === 'request')).toBe(true);
  });
  it('a bot that fills the hidden field is ignored; a bad phone is refused', async () => {
    const v = new Browser(t.app);
    expect((await v.post(`/v1/re/pub/p/${ids.slug}/request`, { name: 'x', phone: '0780 555 0000', hp: 'spam' })).status).toBe(200);
    expect((await owner.get('/v1/re/leads?q=0780555')).json.leads.some((l: any) => l.phone === '+9647805550000')).toBe(false);
    expect((await v.post(`/v1/re/pub/p/${ids.slug}/request`, { name: 'x', phone: '12' })).json.error).toBe('BAD_PHONE');
  });
  it('taps on WhatsApp and call are counted', async () => {
    await new Browser(t.app).post(`/v1/re/pub/p/${ids.slug}/event`, { kind: 'wa' });
    await new Browser(t.app).post(`/v1/re/pub/p/${ids.slug}/event`, { kind: 'call' });
    const s = (await owner.get(`/v1/re/properties/${ids.villa}`)).json.property.stats;
    expect(s).toMatchObject({ wa: 1, calls: 1, requests: 1 });
  });
});

describe('viewings and follow-ups', () => {
  const at = (h: number) => new Date(Date.now() + 2 * 86400_000 + h * 3600_000).toISOString();
  it('book a viewing; the same agent at the same time is a clash (unless they insist)', async () => {
    const v = await owner.post('/v1/re/viewings', { propertyId: ids.villa, leadId: ids.ahmed, startsAt: at(0) });
    expect(v.status).toBe(201);
    expect(v.json.text).toContain('Villa in Dream City');
    ids.viewing = v.json.viewing.id;
    const clash = await owner.post('/v1/re/viewings', { propertyId: ids.flat, leadId: ids.zainab, startsAt: at(0.25) });
    expect(clash.status).toBe(409);
    expect(clash.json.error).toBe('VIEWING_CONFLICT');
    expect((await owner.post('/v1/re/viewings', { propertyId: ids.flat, leadId: ids.zainab, startsAt: at(0.25), force: true })).status).toBe(201);
    expect((await owner.get(`/v1/re/leads/${ids.ahmed}`)).json.lead.status).toBe('viewing');
  });
  it('done, he liked it: Hemlo suggests a follow-up, and the follow-up shows up when due', async () => {
    const r = await owner.req('PATCH', `/v1/re/viewings/${ids.viewing}`, { status: 'completed', outcome: 'liked', feedback: 'Loved the garden' });
    expect(r.json.suggestFollowup).toBe(true);
    const f = await owner.post('/v1/re/followups', { leadId: ids.ahmed, kind: 'call', dueAt: new Date(Date.now() - 3600_000).toISOString(), note: 'Ask about an offer' });
    expect(f.status).toBe(201);
    const list = (await owner.get('/v1/re/followups')).json.followups;
    expect(list.find((x: any) => x.id === f.json.followup.id).when).toBe('overdue');
    expect((await owner.get(`/v1/re/leads/${ids.ahmed}`)).json.lead.nextFollowAt).toBeTruthy();
    await owner.req('PATCH', `/v1/re/followups/${f.json.followup.id}`, { done: true });
    expect((await owner.get(`/v1/re/leads/${ids.ahmed}`)).json.lead.nextFollowAt).toBeNull();
  });
});

describe('a deal', () => {
  it('Ahmed makes an offer; the owner counters; they agree; it closes', async () => {
    const d = await owner.post('/v1/re/deals', { propertyId: ids.villa, leadId: ids.ahmed });
    expect(d.status).toBe(201);
    ids.deal = d.json.deal.id;
    expect(d.json.deal).toMatchObject({ asking: 182000, commissionKind: 'percent', commissionValue: 200 }); // the owner's agreement
    const z = await owner.post('/v1/re/deals', { propertyId: ids.villa, leadId: ids.zainab });
    ids.dealZ = z.json.deal.id;
    expect((await owner.post('/v1/re/deals/' + ids.deal + '/offers', { kind: 'offer', amount: 170000 })).status).toBe(201);
    expect((await owner.get(`/v1/re/properties/${ids.villa}`)).json.property.status).toBe('negotiating');
    await owner.post(`/v1/re/deals/${ids.deal}/offers`, { kind: 'counter', amount: 178000 });
    await owner.post(`/v1/re/deals/${ids.deal}/offers`, { kind: 'agreed', amount: 176000 });
    const full = (await owner.get(`/v1/re/deals/${ids.deal}`)).json;
    expect(full.offers.map((o: any) => [o.kind, o.amount])).toEqual([['asking', 182000], ['offer', 170000], ['counter', 178000], ['agreed', 176000]]);
    expect(full.deal.commission).toEqual({ total: 3520, agent: 1408 });
    const closed = await owner.req('PATCH', `/v1/re/deals/${ids.deal}`, { stage: 'closed' });
    expect(closed.json.deal.stage).toBe('closed');
    const p = (await owner.get(`/v1/re/properties/${ids.villa}`)).json;
    expect(p.property.status).toBe('sold');
    expect(p.deals.find((x: any) => x.id === ids.dealZ).stage).toBe('lost');
    expect((await owner.get(`/v1/re/leads/${ids.ahmed}`)).json.lead.status).toBe('won');
  });
  it('commission: expected, collected, pending', async () => {
    await owner.post(`/v1/re/deals/${ids.deal}/payments`, { amount: 2000, from: 'owner' });
    const c = (await owner.get('/v1/re/commission')).json;
    expect(c.totals.USD).toMatchObject({ expected: 3520, collected: 2000, pending: 1520 });
  });
  it('the sold page says so, and stops asking to be indexed or visited', async () => {
    const html = String((await new Browser(t.app).get(`/v1/re/pub/p/${ids.slug}`)).json);
    expect(html).toContain('Sold');
    expect(html).toContain('noindex');
    expect(html).not.toContain('id="req"');
    expect((await new Browser(t.app).post(`/v1/re/pub/p/${ids.slug}/request`, { name: 'Late', phone: '07805551999' })).status).toBe(201); // quietly ignored
    expect((await owner.get('/v1/re/leads?q=Late')).json.leads).toHaveLength(0);
  });
  it('the owner’s report: views, inquiries, viewings and offers, on a private link', async () => {
    const r = await owner.post('/v1/re/owners/reports', { propertyId: ids.villa });
    expect(r.status).toBe(201);
    expect(r.json.wa).toContain('wa.me/9647701234500');
    const html = String((await new Browser(t.app).get('/v1/re/pub/r/' + r.json.url.split('/r/')[1] + '?lang=en')).json);
    expect(html).toContain('Property performance');
    expect(html).toContain('noindex');
    expect(html).not.toContain('Ahmed'); // buyers' names are never in an owner's report
  });
});

describe('who sees what', () => {
  it('an agent sees their own leads (and unassigned ones), never another agent’s', async () => {
    const mine = await agentB.post('/v1/re/leads', { name: 'Omar’s client', phone: '07711112222' });
    expect(mine.status).toBe(201);
    expect(mine.json.lead.agentId).toBe(ids.memberB);
    const list = (await agentB.get('/v1/re/leads')).json.leads.map((l: any) => l.name);
    expect(list).toContain('Omar’s client');
    expect(list).not.toContain('Ahmed Saleh');
    expect((await agentB.get(`/v1/re/leads/${ids.ahmed}`)).status).toBe(404);
    expect((await owner.get('/v1/re/leads')).json.leads.map((l: any) => l.name)).toContain('Omar’s client');
    expect((await agentB.req('PATCH', `/v1/re/leads/${mine.json.lead.id}`, { agentId: ids.memberOwner })).status).toBe(403); // reassigning is a manager's call
  });
  it('the desk sees every lead but no money; an agent can’t change a commission', async () => {
    expect((await desk.get('/v1/re/leads')).json.leads.length).toBeGreaterThan(2);
    expect((await desk.get('/v1/re/commission')).status).toBe(403);
    expect((await agentB.req('PATCH', `/v1/re/deals/${ids.dealZ}`, { commissionValue: 1000 })).status).toBe(404); // not theirs: it doesn't exist for them
    const lead = (await agentB.get('/v1/re/leads?q=Omar')).json.leads[0];
    const own = await agentB.post('/v1/re/deals', { propertyId: ids.flat, leadId: lead.id });
    expect(own.status).toBe(201);
    expect(own.json.deal.commission).toBeTruthy(); // an agent sees their own deal's commission…
    expect((await agentB.req('PATCH', `/v1/re/deals/${own.json.deal.id}`, { commissionValue: 1000 })).status).toBe(403); // …but can't change it
    expect((await agentB.get('/v1/re/commission')).json.deals.every((x: any) => x.agentId === ids.memberB)).toBe(true);
    expect((await agentB.post(`/v1/re/deals/${ids.deal}/payments`, { amount: 10 })).status).toBe(403);
    expect((await desk.post('/v1/re/properties', { title: 'x', type: 'villa' })).status).toBe(403);
  });
  it('another agency sees nothing of this one', async () => {
    other = new Browser(t.app);
    await signInEmail(other, 'rival@other-homes.iq');
    const r = await other.post('/v1/re/start', { name: 'Other Homes', city: 'Baghdad' });
    await other.post('/v1/auth/organization/set-active', { organizationId: r.json.organizationId });
    expect((await other.get(`/v1/re/properties/${ids.villa}`)).status).toBe(404);
    expect((await other.get('/v1/re/properties?status=all')).json.total).toBe(0);
    expect((await other.get('/v1/re/leads')).json.total).toBe(0);
    expect((await other.get(`/v1/re/deals/${ids.deal}`)).status).toBe(404);
    expect((await other.req('PATCH', `/v1/re/properties/${ids.flat}`, { price: 1 })).status).toBe(404);
    expect((await other.get('/v1/re/search?q=villa')).json.properties).toHaveLength(0);
  });
});

describe('the day', () => {
  it('the brief counts what matters; search understands a plain request', async () => {
    const today = (await owner.get('/v1/re/today?scope=all')).json;
    expect(today.brief).toHaveProperty('followups');
    expect(today.business.live).toBeGreaterThan(0);
    expect(today.business.commission.USD).toBeTruthy();
    const s = (await owner.get('/v1/re/search?q=' + encodeURIComponent('apartments under 100k in Ankawa'))).json;
    expect(s.properties.map((p: any) => p.id)).toEqual([ids.flat]);
    expect(s.parsed).toMatchObject({ type: 'apartment', max: 100000 });
    expect((await owner.get('/v1/re/search?q=Ahmed')).json.leads[0].id).toBe(ids.ahmed);
    const rep = (await owner.get('/v1/re/reports')).json;
    expect(rep.funnel.views).toBeGreaterThan(0);
    expect(rep.sources.find((x: any) => x.source === 'website')).toBeTruthy();
  });
  it('AI writes a description and flags a number it made up; questions are answered from our data', async () => {
    const r = await owner.post('/v1/re/ai/describe', { propertyId: ids.flat, mode: 'write', lang: 'en', notes: 'bright, near the market' });
    expect(r.status).toBe(200);
    expect(r.json.stray).toContain('5');
    const q = await owner.post('/v1/re/ai/ask', { question: 'villas under 200k in Dream City' });
    expect(q.json.tool).toBe('find_properties');
    expect(q.json.answer.kind).toBe('properties');
  });
});
