// Hemlo Systems · the Website add-on: turning a site on, its starter pages, editing its identity and look, publishing
// it, and managing its pages — with one business never seeing another's site.
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { withOrg, withSystem } from '@hemlo/db';
import { hemloSubscription, hemloAddonEntitlement, reProperty, reLead, reLeadProperty } from '@hemlo/db/schema';
import { newId } from '@hemlo/core';
import { setup, Browser, signInEmail, createOrg } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser;
let orgId: string;
let homeId: string;

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'web-owner@example.com');
  const org = await createOrg(owner, 'Baghdad Gadgets');
  orgId = org.id;
  await owner.post('/v1/auth/organization/set-active', { organizationId: orgId });
  await withSystem(t.db, async (tx) => {
    await tx.insert(hemloSubscription).values({ organizationId: orgId, edition: 'realestate', status: 'trial', seats: 1, trialEndsAt: new Date(Date.now() + 20 * 86400_000) });
  });
  await withOrg(t.db, orgId, async (tx) => {
    await tx.insert(hemloAddonEntitlement).values({ id: newId(), organizationId: orgId, addonId: 'website', edition: 'realestate', status: 'active', billing: 'month', price: 1000 });
  });
});

describe('the website dashboard', () => {
  it('starts empty: no site yet, but the edition, themes and section kinds are known', async () => {
    const r = await owner.get('/v1/web/site');
    expect(r.status).toBe(200);
    expect(r.json.site).toBeNull();
    expect(r.json.pages).toEqual([]);
    expect(r.json.vertical).toBe('realestate');
    expect(r.json.themes).toContain('modern');
    expect(r.json.sectionTypes).toContain('hero');
  });

  it('is off until asked for: enabling creates the site and a starter shop site', async () => {
    const r = await owner.post('/v1/web/site/enable');
    expect(r.status).toBe(200);
    expect(r.json.site.status).toBe('setup');
    expect(r.json.site.vertical).toBe('realestate');
    expect(r.json.site.subdomain).toBeTruthy();
    expect(r.json.url).toMatch(/^https:\/\/[a-z0-9-]+\.hemlohq\.com$/);
    expect(r.json.pages).toHaveLength(3);
    const home = r.json.pages.find((p: any) => p.slug === '');
    expect(home.kind).toBe('home');
    expect(home.sections[0].type).toBe('hero');
    expect(home.sections[1].type).toBe('listings'); // an agency leads with its available properties
    homeId = home.id;
  });

  it('edits the site’s identity, look and words', async () => {
    const r = await owner.put('/v1/web/site', { name: { ar: 'أجهزة بغداد', en: 'Baghdad Gadgets' }, tagline: { en: 'Phones and repairs' }, theme: { preset: 'modern', accent: '#0EA5E9', dark: true }, settings: { contact: { whatsapp: '07701234567' }, cta: { whatsapp: true } } });
    expect(r.status).toBe(200);
    expect(r.json.site.name.en).toBe('Baghdad Gadgets');
    expect(r.json.site.theme).toEqual({ preset: 'modern', accent: '#0ea5e9', dark: true });
    expect(r.json.site.settings.contact.whatsapp).toBe('+9647701234567');
    expect(r.json.site.settings.cta.whatsapp).toBe(true);
  });

  it('rejects a bad theme accent and a reserved subdomain', async () => {
    expect((await owner.put('/v1/web/site', { theme: { preset: 'ugly' } })).json.site.theme.preset).toBeUndefined();
    expect((await owner.put('/v1/web/site', { subdomain: 'api' })).status).toBe(400);
  });

  it('publishes and unpublishes, and cannot publish without a home page', async () => {
    await owner.put('/v1/web/site', { name: {}, settings: { contact: {} } });
    expect((await owner.post('/v1/web/site/publish')).json.error).toBe('NEEDS_BUSINESS_NAME');
    await owner.put('/v1/web/site', { name: { ar: 'أجهزة بغداد', en: 'Baghdad Gadgets' } });
    expect((await owner.post('/v1/web/site/publish')).json.error).toBe('NEEDS_CONTACT');
    await owner.put('/v1/web/site', { settings: { contact: { whatsapp: '07701234567' } } });
    expect((await owner.post('/v1/web/site/publish')).json.site.status).toBe('published');
    expect((await owner.post('/v1/web/site/unpublish')).json.site.status).toBe('draft');
  });

  it('manages pages: add, edit, and remove', async () => {
    const added = await owner.post('/v1/web/pages', { slug: 'services', kind: 'services', title: { ar: 'خدماتنا', en: 'Services' }, sections: [{ type: 'services', title: { en: 'What we do' } }] });
    expect(added.status).toBe(201);
    const id = added.json.page.id;
    expect(added.json.page.slug).toBe('services');
    const edited = await owner.put(`/v1/web/pages/${id}`, { title: { en: 'Our services' }, sections: [{ type: 'services' }, { type: 'contct' }] });
    expect(edited.status).toBe(400); // an unknown section type is refused
    const ok = await owner.put(`/v1/web/pages/${id}`, { title: { en: 'Our services' } });
    expect(ok.json.page.title.en).toBe('Our services');
    expect((await owner.del(`/v1/web/pages/${id}`)).json.ok).toBe(true);
    expect((await owner.del(`/v1/web/pages/${id}`)).status).toBe(404);
  });

  it('refuses a duplicate page address', async () => {
    expect((await owner.post('/v1/web/pages', { slug: 'about', kind: 'custom', title: { en: 'About' } })).status).toBe(409);
  });

  it('a second business sees nothing of the first', async () => {
    const other = new Browser(t.app);
    await signInEmail(other, 'other-web@example.com');
    const org = await createOrg(other, 'Erbil Books');
    await other.post('/v1/auth/organization/set-active', { organizationId: org.id });
    const r = await other.get('/v1/web/site');
    expect(r.json.site).toBeNull();
    expect(r.json.pages).toEqual([]);
  });

  it('needs a signed-in manager', async () => {
    const anon = new Browser(t.app);
    expect((await anon.get('/v1/web/site')).status).toBe(401);
  });

  it('does not allow a free workspace to activate Website', async () => {
    const other = new Browser(t.app);
    await signInEmail(other, 'free-web@example.com');
    const org = await createOrg(other, 'Free Workshop');
    await other.post('/v1/auth/organization/set-active', { organizationId: org.id });
    expect((await other.post('/v1/web/site/enable')).status).toBe(402);
  });
});

describe('the public website', () => {
  const sub = 'baghdad-gadgets';
  const siteHeaders = { 'x-hemlo-site': sub, host: `${sub}.hemlohq.com` };
  let pub: Browser;

  beforeAll(async () => {
    pub = new Browser(t.app);
    await withOrg(t.db, orgId, (tx) => tx.insert(reProperty).values({ id: newId(), organizationId: orgId, ref: 1, slug: 'villa-mansour', title: 'Villa in Mansour', titleEn: 'Mansour villa', type: 'villa', purpose: 'sale', status: 'available', publishedAt: new Date(), price: 240_000_000, currency: 'USD' }));
    const r = await owner.put('/v1/web/site', { subdomain: sub, name: { ar: 'أجهزة بغداد', en: 'Baghdad Gadgets' }, tagline: { en: 'Phones and repairs' }, settings: { contact: { whatsapp: '07701234567' }, cta: { whatsapp: true } } });
    expect(r.status).toBe(200);
    await owner.post('/v1/web/site/publish');
  });

  it('serves the published home page with the business’s own live data', async () => {
    const r = await pub.get('/v1/web/pub', siteHeaders);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    expect(String(r.json)).toContain('أجهزة بغداد'); // the Arabic page shows the Arabic name
    expect(String((await pub.get('/v1/web/pub?lang=en', siteHeaders)).json)).toContain('Baghdad Gadgets');
    expect(String(r.json)).toContain('wa.me/9647701234567');
    expect(String(r.json)).toContain('Villa in Mansour'); // live data, never a copy
    expect(String(r.json)).toContain('id="inq"');  // the inquiry form
    expect(String(r.json)).toContain('https://baghdad-gadgets.hemlohq.com');
    expect(String(r.json)).toContain('href="/properties/villa-mansour"'); // same-origin, so the photo carries over into the property page
  });

  it('keeps edits in draft until the next publish while property data stays live', async () => {
    const pages = (await owner.get('/v1/web/site')).json.pages;
    const about = pages.find((p: any) => p.slug === 'about');
    await owner.put(`/v1/web/pages/${about.id}`, { title: { en: 'Draft About' } });
    await owner.put('/v1/web/site', { name: { en: 'Draft Brand' } });
    expect((await owner.get('/v1/web/site')).json.hasUnpublishedChanges).toBe(true);
    const oldHome = String((await pub.get('/v1/web/pub?lang=en', siteHeaders)).json);
    const oldAbout = String((await pub.get('/v1/web/pub/about?lang=en', siteHeaders)).json);
    expect(oldHome).toContain('Baghdad Gadgets');
    expect(oldHome).not.toContain('Draft Brand');
    expect(oldAbout).toContain('About us');
    expect(oldAbout).not.toContain('Draft About');
    await owner.post('/v1/web/site/publish');
    expect((await owner.get('/v1/web/site')).json.hasUnpublishedChanges).toBe(false);
    expect(String((await pub.get('/v1/web/pub', siteHeaders)).json)).toContain('Draft Brand');
    expect(String((await pub.get('/v1/web/pub/about?lang=en', siteHeaders)).json)).toContain('Draft About');
    await owner.put(`/v1/web/pages/${about.id}`, { title: { ar: 'من نحن', en: 'About us' } });
    await owner.put('/v1/web/site', { name: { ar: 'أجهزة بغداد', en: 'Baghdad Gadgets' } });
    await owner.post('/v1/web/site/publish');
  });

  it('serves an inner page, robots.txt and sitemap.xml', async () => {
    expect(String((await pub.get('/v1/web/pub/about?lang=en', siteHeaders)).json)).toContain('About us');
    expect(String((await pub.get('/v1/web/pub/robots.txt', siteHeaders)).json)).toContain('Sitemap: https://baghdad-gadgets.hemlohq.com/sitemap.xml');
    expect(String((await pub.get('/v1/web/pub/sitemap.xml', siteHeaders)).json)).toContain('<loc>https://baghdad-gadgets.hemlohq.com/');
  });

  it('serves a property page with links and inquiry endpoint on its own subdomain', async () => {
    const r = await pub.get('/v1/web/pub/properties/villa-mansour?lang=en', siteHeaders);
    expect(r.status).toBe(200);
    expect(String(r.json)).toContain('Mansour villa');
    expect(String(r.json)).toContain('href="/properties?lang=en"'); // an English visitor stays in English
    expect(String(r.json)).toContain('endpoint":"/inquiry"');
    expect(String(r.json)).toContain('"page":"property:villa-mansour"');
  });

  it('turns an inquiry into a lead in the business’s existing workflow', async () => {
    const before = await withSystem(t.db, (tx) => tx.select().from(reLead).where(eq(reLead.organizationId, orgId)));
    const r = await pub.post('/v1/web/pub/inquiry', { name: 'Ali', phone: '07709998877', message: 'Do you have it in blue?' }, siteHeaders);
    expect(r.status).toBe(201);
    const rows = await withSystem(t.db, (tx) => tx.select().from(reLead).where(eq(reLead.organizationId, orgId)));
    expect(rows.length).toBe(before.length + 1);
    expect(rows.some((lead) => lead.phone === '+9647709998877' && lead.source === 'website')).toBe(true);
    const propertyInquiry = await pub.post('/v1/web/pub/inquiry', { name: 'Sara', phone: '07709998866', propertySlug: 'villa-mansour', page: 'property:villa-mansour' }, siteHeaders);
    expect(propertyInquiry.status).toBe(201);
    const lead = (await withSystem(t.db, (tx) => tx.select().from(reLead).where(eq(reLead.phone, '+9647709998866'))))[0];
    expect(lead?.source).toBe('website');
    expect((await withSystem(t.db, (tx) => tx.select().from(reLeadProperty).where(eq(reLeadProperty.leadId, lead.id)))).length).toBe(1);
    expect((await pub.post('/v1/web/pub/inquiry', { name: 'Bad', phone: '12' }, siteHeaders)).status).toBe(400);
  });

  it('keeps an unpublished site out of the public eye', async () => {
    await owner.post('/v1/web/site/unpublish');
    const r = await pub.get('/v1/web/pub', siteHeaders);
    expect(r.status).toBe(200);
    expect(String(r.json)).toContain('noindex');
    await owner.post('/v1/web/site/publish');
  });

  it('stages an agency in its own design: the home search, and a place search across areas and cities', async () => {
    const home = String((await pub.get('/v1/web/pub?lang=en', siteHeaders)).json);
    expect(home).toContain('class="d-estate'); // real estate gets the estate design, not the shared baseline
    expect(home).toContain('class="esearch');
    expect(home).toContain('name="where"');
    expect(home).toContain('class="mbar"'); // WhatsApp stays one thumb away on a phone
    await withOrg(t.db, orgId, (tx) => tx.insert(reProperty).values({ id: newId(), organizationId: orgId, ref: 2, slug: 'flat-ankawa', title: 'Flat in Ankawa', city: 'Erbil', area: 'Ankawa', type: 'apartment', purpose: 'rent', status: 'available', publishedAt: new Date(), price: 900, currency: 'USD' }));
    const byCity = String((await pub.get('/v1/web/pub/properties?lang=en&where=erbil', siteHeaders)).json);
    expect(byCity).toContain('Flat in Ankawa');
    expect(byCity).not.toContain('Mansour villa');
    expect(String((await pub.get('/v1/web/pub/properties?lang=en&where=ankawa', siteHeaders)).json)).toContain('Flat in Ankawa');
  });

  it('keeps Hemlo’s own hosts out of customers’ hands', async () => {
    expect((await owner.put('/v1/web/site', { subdomain: 'business' })).status).toBe(400);
  });

  it('does not serve an unknown subdomain', async () => {
    expect((await pub.get('/v1/web/pub', { 'x-hemlo-site': 'nobody' })).status).toBe(404);
  });
});
