// The demo shop: one tap on hemlohq.com gives a visitor their own private copy of a ready-made market, on the real system.
// No sign-up. A temporary visitor account + business, a bearer session (never a cookie, so a real sign-in on the same
// browser is untouched), deleted after 24 hours by the hourly clean-up.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { hmac, newId } from '@hemlo/core';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { organization, member } from '@hemlo/db/schema';
import { HttpError, forgetPrincipal, forgetAllPrincipals } from '../principal';
import { seedDemoShop, DEMO_BARCODES } from '../demo-data';
import { seedDemoClinic, DEMO_CLINIC } from '../demo-dental';
import { seedDemoGym, DEMO_GYM } from '../demo-gym';
import { seedDemoRealEstate, DEMO_AGENCY } from '../demo-realestate';
import { seedDemoSchool, DEMO_SCHOOL } from '../demo-school';
import { addonOffer } from '../addons';
import type { AppEnv, Deps } from '../types';
import { fileKey, type FileStore } from '../files';

export const DEMO_DOMAIN = 'demo.hemlohq.invalid';
export const DEMO_HOURS = 24;
// generous per address: Iraqi mobile networks put many customers behind one shared IP
export const PER_IP_PER_HOUR = 30;
// ~0.45 MB each: 150 demo shops ≈ 70 MB, safe inside Neon's free 0.5 GB (raise after moving to a paid plan)
export const MAX_ACTIVE = 150;
export const isDemoEmail = (e?: string | null) => !!e && e.endsWith(`@${DEMO_DOMAIN}`);
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** Is this business a demo shop? (blocks FIB, invitations, shop devices and API keys) */
export async function isDemoOrg(d: Deps, orgId: string | null | undefined) {
  if (!orgId) return false;
  const org = await (await d.auth.$context).adapter.findOne<any>({ model: 'organization', where: [{ field: 'id', value: orgId }] });
  let meta: any = {}; try { meta = typeof org?.metadata === 'string' ? JSON.parse(org.metadata) : org?.metadata ?? {}; } catch {}
  return !!meta?.demo;
}

const ORG_TABLES = ['sch_attendance', 'sch_payment', 'sch_charge', 'sch_fee_plan', 'sch_enrollment', 'sch_student_guardian', 'sch_guardian', 'sch_student', 'sch_class', 'sch_grade', 'sch_year', 'sch_settings', 're_report', 're_notice', 're_stat', 're_activity', 're_payment', 're_offer', 're_deal', 're_followup', 're_viewing', 're_collection_item', 're_collection',
  're_contract', 're_lead_property', 're_lead', 're_document', 're_media', 're_property', 're_owner', 're_agent', 're_branch', 're_settings', 'gym_measure', 'gym_booking', 'gym_class', 'gym_checkin', 'gym_membership', 'gym_member', 'gym_plan', 'gym_trainer', 'gym_settings', 'dent_access_log', 'dent_image', 'dent_consent', 'dent_installment', 'dent_perio', 'dent_lab_order', 'dent_rx', 'dent_visit_item', 'dent_visit', 'dent_plan_item', 'dent_plan',
  'dent_finding', 'dent_appointment', 'dent_patient', 'dent_procedure', 'dent_dentist', 'dent_chair', 'dent_settings', 'hemlo_subscription',
  'connect_job', 'connect_message', 'connect_conversation', 'connect_recipe', 'connect_channel', 'web_page', 'web_site', 'hemlo_addon_payment', 'hemlo_addon_request', 'hemlo_addon_entitlement',
  'sys_reminder', 'sys_return_line', 'sys_return', 'sys_sale_line', 'sys_sale', 'sys_ledger', 'sys_stock_move', 'sys_purchase_line', 'sys_purchase', 'sys_supplier_ledger', 'sys_supplier',
  'ai_usage', 'sys_expense', 'sys_file', 'sys_shift', 'sys_sequence', 'sys_customer', 'sys_product', 'sys_settings', 'sys_fib_payment', 'counter_lock', 'counter_pin', 'counter_device', 'staff_invite', 'auth_event',
  'invitation', 'member'];
const USER_TABLES = ['session', 'account', 'passkey', 'known_device', 'auth_event', 'member'];

/** Wipe demo businesses and demo visitors in ONE statement (a delete per table, all in one round trip; foreign keys are
 *  checked at the end of the statement). Returns the stored images' keys, for the file store. */
async function wipeDemos(tx: Database, orgs: string[], users: string[]) {
  if (!orgs.length && !users.length) return [] as string[];
  const O = sql`(select json_array_elements_text(${JSON.stringify(orgs)}::json))`, U = sql`(select json_array_elements_text(${JSON.stringify(users)}::json))`;
  const del = [
    ...ORG_TABLES.map((t) => sql`delete from ${sql.identifier(t)} where organization_id in ${O}`),
    sql`delete from team_member where team_id in (select id from team where organization_id in ${O})`,
    sql`delete from team where organization_id in ${O}`, sql`delete from apikey where reference_id in ${O}`, sql`delete from organization where id in ${O}`,
    ...USER_TABLES.map((t) => sql`delete from ${sql.identifier(t)} where user_id in ${U}`), sql`delete from "user" where id in ${U}`,
  ];
  const parts = del.map((q, i) => sql`${sql.raw(`w${i}`)} as (${q})`);
  const files = rowsOf(await tx.execute(sql`with ${sql.join(parts, sql`, `)} select organization_id as org, id from sys_file where organization_id in ${O}`));
  return files.map((f) => fileKey(f.org, f.id));
}

/** Delete demo shops (and their visitors) older than DEMO_HOURS. Safe to run any time; the Worker runs it on a schedule. */
export async function purgeDemos(db: Database, olderThanHours = DEMO_HOURS, files?: FileStore) {
  const out = await withSystem(db, async (tx) => {
    const found = rowsOf(await tx.execute(sql`select 'o' as k, id from organization where coalesce(metadata, '') like '%"demo":true%' and created_at < now() - make_interval(hours => ${olderThanHours})
      union all select 'u', id from "user" where email like ${'%@' + DEMO_DOMAIN} and created_at < now() - make_interval(hours => ${olderThanHours})`));
    const orgs = found.filter((r) => r.k === 'o').map((r) => r.id as string), users = found.filter((r) => r.k === 'u').map((r) => r.id as string);
    return { shops: orgs.length, visitors: users.length, keys: await wipeDemos(tx, orgs, users) };
  });
  if (out.visitors) forgetAllPrincipals(); // a deleted visitor's token stops working at once, not after the cache runs out
  if (out.keys.length && files) await files.delete(out.keys);
  return { shops: out.shops, visitors: out.visitors, images: out.keys.length };
}

export function demoRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.post('/start', async (c) => {
    const b = await c.req.json<{ lang?: string; kind?: string }>().catch(() => ({} as any));
    const lang = b.lang === 'en' ? 'en' as const : 'ar' as const;
    const kind = b.kind === 'dental' || b.kind === 'gym' || b.kind === 'realestate' || b.kind === 'school' ? b.kind : 'store';
    const dental = kind === 'dental', gym = kind === 'gym', estate = kind === 'realestate', school = kind === 'school';
    const ctx = await d.auth.$context;
    // how long each part takes, in the Server-Timing header (browser dev tools show it)
    const marks: string[] = []; let last = Date.now();
    const mark = (name: string) => { const t = Date.now(); marks.push(`${name};dur=${t - last}`); last = t; };

    // limits: per connection, and overall
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `demo:${await hmac(d.env.AUTH_SECRET, `demo-ip:${ip}`)}`, now = Date.now();
    // one round trip: count this address's demo (the hour's window restarts after an hour; the count stops one past
    // the limit, so "over" means blocked) and how many demos are live
    const [lim] = rowsOf(await d.db.execute(sql`with hit as (
        insert into rate_limit (id, key, count, last_request) values (${newId()}, ${key}, 1, ${now})
        on conflict (key) do update set
          count = case when rate_limit.last_request < ${now - 3600_000} then 1 else least(rate_limit.count + 1, ${PER_IP_PER_HOUR + 1}) end,
          last_request = case when rate_limit.last_request < ${now - 3600_000} then ${now} else rate_limit.last_request end
        returning count)
      select (select count from hit) as hits, (select count(*)::int from "user" where email like ${'%@' + DEMO_DOMAIN}) as active`));
    if (Number(lim?.hits) > PER_IP_PER_HOUR) throw new HttpError(429, 'DEMO_LIMIT');
    if (Number(lim?.active ?? 0) >= MAX_ACTIVE) throw new HttpError(429, 'DEMO_BUSY');
    mark('limits');

    // a visitor, their own shop, a week of history, a session
    const user = await ctx.internalAdapter.createUser({
      email: `visitor-${newId().toLowerCase().replace(/[^a-z0-9]/g, '')}@${DEMO_DOMAIN}`, name: dental ? DEMO_CLINIC[lang].owner : gym ? DEMO_GYM[lang].owner : estate ? DEMO_AGENCY[lang].owner : school ? DEMO_SCHOOL[lang].owner : lang === 'ar' ? 'أبو علي' : 'Abu Ali', emailVerified: true, locale: lang,
    } as any, {} as any);
    mark('visitor');
    // the business is made directly (demo visitors can't create businesses themselves), with the visitor as owner,
    // in the same transaction and round trip as its stock and history
    const org = { id: newId(), name: dental ? DEMO_CLINIC[lang].name : gym ? DEMO_GYM[lang].name : estate ? DEMO_AGENCY[lang].name : school ? DEMO_SCHOOL[lang].name : lang === 'ar' ? 'ماركت النور' : 'Al-Noor Market', slug: `demo-${newId().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`, createdAt: new Date(),
      metadata: JSON.stringify({ demo: true, kind, city: lang === 'ar' ? 'بغداد' : 'Baghdad' }) };
    const owner = { id: newId(), organizationId: org.id, userId: user.id, role: 'owner', createdAt: new Date() };
    const first: Parameters<typeof seedDemoShop>[4] = [[organization, [org]], [member, [owner]]];
    // the real estate demo has Website and Connect Pro on (the bundle), so a visitor tries them rather than being asked to buy
    const offer = estate ? await addonOffer(d.db, 'web-connect') : null;
    const bundle = offer?.active ? { id: offer.id, price: offer.priceMonth ?? 0 } : null;
    const seeded: Record<string, number> = await withOrg(d.db, org.id, (tx): Promise<Record<string, number>> => (dental ? seedDemoClinic(tx, org.id, user.id, owner.id, lang, first) : gym ? seedDemoGym(tx, org.id, user.id, owner.id, lang, first) : estate ? seedDemoRealEstate(tx, org.id, user.id, owner.id, lang, first, d.env.SYSTEM_URL, { bundle, subdomain: org.slug }) : school ? seedDemoSchool(tx, org.id, user.id, owner.id, lang, first) : seedDemoShop(tx, org.id, user.id, lang, first)));
    mark('shop');
    const session = await ctx.internalAdapter.createSession(user.id, false, { activeOrganizationId: org.id, loginMethod: 'demo' } as any);
    mark('session');
    c.header('server-timing', marks.join(', '));
    return c.json({ token: session.token, expiresAt: new Date(now + DEMO_HOURS * 3600_000).toISOString(), business: org.name, kind, ...(kind === 'store' ? { barcodes: DEMO_BARCODES } : {}), ...seeded }, 201);
  });

  // leaving the demo deletes it at once (the visitor, their business, everything in it)
  r.post('/end', async (c) => {
    const p = c.get('principal');
    if (!p || p.kind !== 'user' || !isDemoEmail(p.user?.email)) throw new HttpError(403, 'NOT_A_DEMO');
    const orgs = p.organizationId && p.role === 'owner' && await isDemoOrg(d, p.organizationId) ? [p.organizationId] : [];
    const keys = await withSystem(d.db, (tx) => wipeDemos(tx, orgs, [p.userId]));
    forgetPrincipal(c);
    if (keys.length && d.files) await d.files.delete(keys).catch(() => {});
    return c.body(null, 204);
  });

  return r;
}
