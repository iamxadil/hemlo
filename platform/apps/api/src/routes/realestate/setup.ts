// Starting an agency (self-serve, 30-day free trial) and its set-up: the agency's public face, branches, and each
// agent's own card (their WhatsApp on their listings, their share of commission). Nothing has to be configured before
// the first listing: name and city, then straight to "add a property".
import { Hono } from 'hono';
import { and, asc, eq, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { organization, member, hemloSubscription, sysSettings, reSettings, reBranch, reAgent } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError, requireUser, forgetPrincipal } from '../../principal';
import { actor, bad, type Actor } from '../sys-common';
import { isDemoEmail } from '../demo';
import { TRIAL_DAYS, subscriptionOf } from '../../subscription';
import { inRe, rowsOf, settingsOf, str, phone, intIn, oneOf, CURRENCIES, DEFAULT_SHARE, FEATURES, TYPE_NAMES } from './common';
import type { AppEnv, Deps } from '../../types';

/** The team: every member of the agency, with their agent card if they have one. */
export async function teamOf(tx: any, org: string) {
  return rowsOf(await tx.execute(sql`select m.id, m.role, u.name, u.image, a.phone, a.whatsapp, a.title, a.branch_id as "branchId", a.agent_share as "agentShare", coalesce(a.active, true) as active
    from member m join "user" u on u.id = m.user_id left join re_agent a on a.member_id = m.id where m.organization_id = ${org} order by u.name`));
}

export function reSetupRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** Start an agency: the business, a 30-day trial, the owner (also its first agent), the agency's settings. */
  r.post('/start', async (c) => {
    const p = requireUser(c);
    if (isDemoEmail(p.user.email)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const name = str(b.name, 80, 'BAD_NAME', true)!;
    if (name.length < 2) bad('BAD_NAME');
    const city = str(b.city, 60, 'BAD_CITY');
    const currency = oneOf(b.currency, CURRENCIES, 'BAD_CURRENCY', 'USD');
    const ph = phone(b.phone);
    const [used] = await withSystem(d.db, async (tx) => rowsOf(await tx.execute(sql`select 1 from hemlo_subscription s join member m on m.organization_id = s.organization_id
      where s.edition = 'realestate' and m.user_id = ${p.userId} and m.role like '%owner%' limit 1`)));
    if (used) throw new HttpError(409, 'TRIAL_USED');

    const orgId = newId(), memberId = newId(), now = new Date(), trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'agency'}-${orgId.slice(0, 6).toLowerCase()}`;
    await withOrg(d.db, orgId, async (tx) => {
      await tx.insert(organization).values({ id: orgId, name, slug, createdAt: now, metadata: JSON.stringify({ kind: 'realestate', city }) });
      await tx.insert(member).values({ id: memberId, organizationId: orgId, userId: p.userId, role: 'owner', createdAt: now } as any);
      await tx.insert(hemloSubscription).values({ organizationId: orgId, edition: 'realestate', status: 'trial', seats: 1, trialEndsAt });
      await tx.insert(sysSettings).values({ organizationId: orgId });
      await tx.insert(reSettings).values({ organizationId: orgId, city, currency, phone: ph, whatsapp: ph });
      await tx.insert(reAgent).values({ memberId, organizationId: orgId, userId: p.userId, name: p.user.name || name, phone: ph, whatsapp: ph });
    });
    forgetPrincipal(c);
    await audit(d.db, { kind: 're.trial_started', userId: p.userId, organizationId: orgId, detail: { name, city } });
    return c.json({ organizationId: orgId, trialEndsAt }, 201);
  });

  /** What every screen shares: the agency's settings, the team (with agent cards), branches, words for types and features. */
  r.get('/setup', async (c) => {
    const a = actor(c, 'listings', 'read');
    const out = await inRe(d, a, async (tx) => ({
      settings: await settingsOf(tx, a.organizationId),
      team: await teamOf(tx, a.organizationId),
      branches: await tx.select().from(reBranch).orderBy(asc(reBranch.name)),
    }));
    return c.json({ ...out, types: TYPE_NAMES, features: FEATURES, shareDefault: DEFAULT_SHARE, subscription: await subscriptionOf(d.db, a.organizationId) });
  });

  r.put('/settings', async (c) => {
    const a = actor(c, 'agency', 'configure');
    const b = await c.req.json<Record<string, any>>();
    const set: Partial<typeof reSettings.$inferInsert> = { updatedAt: new Date() };
    if (b.phone !== undefined) set.phone = phone(b.phone);
    if (b.whatsapp !== undefined) set.whatsapp = phone(b.whatsapp);
    if (b.email !== undefined) set.email = str(b.email, 120, 'BAD_EMAIL');
    if (set.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(set.email)) bad('BAD_EMAIL');
    if (b.address !== undefined) set.address = str(b.address, 200, 'BAD_TEXT');
    if (b.city !== undefined) set.city = str(b.city, 60, 'BAD_CITY');
    if (b.about !== undefined) set.about = { ar: str(b.about?.ar, 1200, 'BAD_TEXT') ?? undefined, en: str(b.about?.en, 1200, 'BAD_TEXT') ?? undefined };
    if (b.currency !== undefined) set.currency = oneOf(b.currency, CURRENCIES, 'BAD_CURRENCY');
    if (b.usdRate !== undefined) set.usdRate = intIn(b.usdRate, 500, 5000, 'BAD_RATE') ?? 1450;
    if (b.defaultCommission !== undefined) set.defaultCommission = intIn(b.defaultCommission, 0, 2000, 'BAD_COMMISSION') ?? 200;
    if (b.shareTemplate !== undefined) {
      const t = { ar: str(b.shareTemplate?.ar, 800, 'BAD_TEXT') ?? undefined, en: str(b.shareTemplate?.en, 800, 'BAD_TEXT') ?? undefined };
      for (const v of [t.ar, t.en]) if (v && !v.includes('{link}')) bad('SHARE_NEEDS_LINK'); // the message must carry the page
      set.shareTemplate = t;
    }
    if (b.autoMatch !== undefined) set.autoMatch = !!b.autoMatch;
    // asking Hemlo to connect the official WhatsApp Business API (it needs Meta's approval and the agency's own number)
    if (b.waApi === 'request') set.waApi = { status: 'requested', requestedAt: new Date().toISOString() };
    const [row] = await inRe(d, a, (tx) => tx.insert(reSettings).values({ organizationId: a.organizationId, ...set } as any)
      .onConflictDoUpdate({ target: reSettings.organizationId, set }).returning());
    if (b.waApi === 'request') await audit(d.db, { kind: 're.whatsapp_api_requested', organizationId: a.organizationId, userId: a.userId });
    return c.json({ settings: row });
  });

  // ---- branches ----
  const branchInput = (b: any) => ({ name: str(b.name, 80, 'BAD_NAME', true)!, city: str(b.city, 60, 'BAD_CITY'), phone: phone(b.phone), ...(b.active !== undefined ? { active: !!b.active } : {}) });
  r.post('/branches', async (c) => {
    const a = actor(c, 'agency', 'configure');
    const input = branchInput(await c.req.json());
    const [row] = await inRe(d, a, (tx) => tx.insert(reBranch).values({ id: newId(), organizationId: a.organizationId, ...input }).returning());
    return c.json({ branch: row }, 201);
  });
  r.patch('/branches/:id', async (c) => {
    const a = actor(c, 'agency', 'configure');
    const [row] = await inRe(d, a, async (tx) => tx.update(reBranch).set(branchInput(await c.req.json())).where(eq(reBranch.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ branch: row });
  });

  /** An agent's card: their own number, title, branch, share. An agent may edit their own number and title. */
  r.put('/agents/:memberId', async (c) => {
    const id = c.req.param('memberId');
    let a: Actor; let self = false;
    try { a = actor(c, 'agency', 'configure'); } catch (e) { a = actor(c, 'listings', 'read'); self = (a.principal as any).memberId === id; if (!self) throw e; }
    const b = await c.req.json<Record<string, any>>();
    const row = await inRe(d, a, async (tx) => {
      const [m] = rowsOf(await tx.execute(sql`select m.id, m.user_id, u.name from member m join "user" u on u.id = m.user_id where m.id = ${id} and m.organization_id = ${a.organizationId}`));
      if (!m) throw new HttpError(404, 'NOT_FOUND');
      const set: Partial<typeof reAgent.$inferInsert> = {};
      if (b.phone !== undefined) set.phone = phone(b.phone);
      if (b.whatsapp !== undefined) set.whatsapp = phone(b.whatsapp);
      if (b.title !== undefined) set.title = str(b.title, 60, 'BAD_TEXT');
      if (!self) {
        if (b.branchId !== undefined) set.branchId = b.branchId || null;
        if (b.agentShare !== undefined) set.agentShare = intIn(b.agentShare, 0, 10000, 'BAD_SHARE') ?? 0;
        if (b.active !== undefined) set.active = !!b.active;
      }
      const [x] = await tx.insert(reAgent).values({ memberId: id, organizationId: a.organizationId, userId: m.user_id, name: m.name, ...set })
        .onConflictDoUpdate({ target: reAgent.memberId, set: { ...set, name: m.name } }).returning();
      return x;
    });
    return c.json({ agent: row });
  });

  return r;
}
