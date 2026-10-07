// Who is making this request, and on behalf of which business?
//   user     → a signed-in person (session cookie, or Bearer token from the mobile app)
//   counter  → a trusted shop device, optionally unlocked by a staff member's PIN
//   apikey   → an integration key owned by a business
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { and, eq, isNull } from 'drizzle-orm';
import { hmac } from '@hemlo/core';
import { withSystem } from '@hemlo/db';
import { counterDevice } from '@hemlo/db/schema';
import { roleCan, counterCan, type Resource } from '@hemlo/auth/permissions';
import { FRESH_SECONDS } from '@hemlo/auth/server';
import type { AppEnv, Deps } from './types';

export type Principal =
  | { kind: 'user'; userId: string; sessionId: string; session: any; user: any; organizationId: string | null; role: string | null; memberId: string | null }
  | { kind: 'counter'; deviceId: string; organizationId: string; teamId: string | null; userId: string | null; memberId: string | null; role: string | null; device: any }
  | { kind: 'apikey'; keyId: string; organizationId: string; permissions: Record<string, string[]> };

export const COUNTER_COOKIE = 'hemlo.counter';
export const COUNTER_IDLE_MS = 10 * 60 * 1000;

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 402 | 403 | 404 | 409 | 410 | 413 | 423 | 429 | 503, public code: string, message?: string) { super(message ?? code); }
}

export const counterTokenHash = (secret: string, token: string) => hmac(secret, `counter:${token}`);

// A signed-in person is remembered for a few seconds on this server instance, keyed by their exact credentials: the
// bearer token, or the whole cookie header (Better Auth re-issues its session cookies whenever the session changes, such
// as switching business, so a change arrives under a new key). A session lookup costs ~10 ms of CPU and one screen
// sends several requests at once. Only reads use it: changes always check the database. For reads, a sign-out
// elsewhere, a removed member or a changed role take effect within PRINCIPAL_TTL_MS.
export const PRINCIPAL_TTL_MS = 15_000;
const remembered = new Map<string, { p: Principal; at: number }>();
const reading = (c: Context<AppEnv>) => c.req.method === 'GET' || c.req.method === 'HEAD';
const credentials = (c: Context<AppEnv>) => `${c.req.header('authorization') ?? ''}|${c.req.header('cookie') ?? ''}`;
/** Drop the remembered person for this request's credentials (sign-out, leaving the demo). */
export const forgetPrincipal = (c: Context<AppEnv>) => { remembered.delete(credentials(c)); };
/** Forget everyone remembered on this server instance (accounts were just deleted, e.g. the demo clean-up). */
export const forgetAllPrincipals = () => { remembered.clear(); };

/** Resolves the principal once per request; routes read it with c.get('principal'). Never throws. */
export function resolvePrincipal(deps: Deps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('principal', await find(c, deps));
    await next();
    // a change may have touched who this person is (name, role, business): the next request reads it afresh
    if (!reading(c)) forgetPrincipal(c);
  };
}

async function find(c: Context<AppEnv>, d: Deps): Promise<Principal | null> {
  const { auth } = d;
  const apiKey = c.req.header('x-api-key');
  if (apiKey) {
    const r: any = await auth.api.verifyApiKey({ body: { key: apiKey } }).catch(() => null);
    if (!r?.valid || !r.key) return null;
    const perms = typeof r.key.permissions === 'string' ? JSON.parse(r.key.permissions) : r.key.permissions ?? {};
    return { kind: 'apikey', keyId: r.key.id, organizationId: r.key.referenceId, permissions: perms };
  }

  // A person who is signed in acts as themselves. The counter screen asks for the device explicitly
  // (x-hemlo-as: counter), so staff at a shared device never borrow someone else's session.
  if (c.req.header('x-hemlo-as') === 'counter') return counterPrincipal(c, d);
  // No session cookie and no bearer token: nobody is signed in, so skip the session lookup (it costs CPU per request).
  if (!c.req.header('authorization') && !/session_token=/.test(c.req.header('cookie') ?? '')) return counterPrincipal(c, d);
  // only reads use a remembered person; every change is authorised against the database
  const key = credentials(c), hit = reading(c) ? remembered.get(key) : undefined;
  if (hit && Date.now() - hit.at < PRINCIPAL_TTL_MS) return hit.p;
  // Authorization reads the database (Better Auth's 5-minute cookie cache is for display only), at most every PRINCIPAL_TTL_MS.
  const s: any = await auth.api.getSession({ headers: c.req.raw.headers, query: { disableCookieCache: true } }).catch(() => null);
  if (s?.session) {
    const orgId = s.session.activeOrganizationId ?? null;
    const m = orgId ? await findMember(d, orgId, { userId: s.user.id }) : null;
    const p: Principal = { kind: 'user', userId: s.user.id, sessionId: s.session.id, session: s.session, user: s.user, organizationId: m ? orgId : null, role: m?.role ?? null, memberId: m?.id ?? null };
    // a session still waiting for its second factor changes any moment: never remembered
    if (!s.session.secondFactorPending) {
      if (remembered.size >= 1000) remembered.delete(remembered.keys().next().value!);
      remembered.set(key, { p, at: Date.now() });
    }
    return p;
  }
  remembered.delete(key);
  return counterPrincipal(c, d);
}

async function counterPrincipal(c: Context<AppEnv>, d: Deps): Promise<Principal | null> {
  const token = c.req.header('x-hemlo-counter') ?? getCookie(c, COUNTER_COOKIE);
  if (!token) return null;
  const tokenHash = await counterTokenHash(d.env.AUTH_SECRET, token);
  const device = await withSystem(d.db, async (tx) => (await tx.select().from(counterDevice).where(and(eq(counterDevice.tokenHash, tokenHash), isNull(counterDevice.revokedAt))))[0]);
  if (!device || device.expiresAt <= new Date()) return null;
  let memberId: string | null = null, userId: string | null = null, role: string | null = null;
  if (device.activeMemberId && device.activeUntil && device.activeUntil > new Date()) {
    const m = await findMember(d, device.organizationId, { memberId: device.activeMemberId });
    if (m) { memberId = m.id; userId = m.userId; role = m.role; }
  }
  return { kind: 'counter', deviceId: device.id, organizationId: device.organizationId, teamId: device.teamId, memberId, userId, role, device };
}


export async function findMember({ auth }: Deps, organizationId: string, by: { userId?: string; memberId?: string }) {
  const ctx = await auth.$context;
  const where = [{ field: 'organizationId', value: organizationId }, by.memberId ? { field: 'id', value: by.memberId } : { field: 'userId', value: by.userId! }];
  return ctx.adapter.findOne<{ id: string; userId: string; role: string; organizationId: string }>({ model: 'member', where });
}

// ---------- guards ----------
export function requireUser(c: Context<AppEnv>, opts: { fresh?: boolean } = {}) {
  const p = c.get('principal');
  if (!p || p.kind !== 'user') throw new HttpError(401, 'SIGN_IN_REQUIRED');
  if (p.session.secondFactorPending) throw new HttpError(403, 'SECOND_FACTOR_REQUIRED');
  if (opts.fresh && Date.now() - new Date(p.session.createdAt).getTime() > FRESH_SECONDS * 1000) throw new HttpError(403, 'SESSION_NOT_FRESH');
  return p;
}

export function requireOrgUser(c: Context<AppEnv>, opts: { fresh?: boolean } = {}) {
  const p = requireUser(c, opts);
  if (!p.organizationId || !p.role) throw new HttpError(403, 'NO_ACTIVE_ORGANIZATION');
  return p as typeof p & { organizationId: string; role: string; memberId: string };
}

/** Any principal (person, counter, key) that may do resource:action in its business. Returns the business id. */
export function requirePermission(c: Context<AppEnv>, resource: Resource, action: string): { organizationId: string; principal: Principal } {
  const p = c.get('principal');
  if (!p) throw new HttpError(401, 'SIGN_IN_REQUIRED');
  if (p.kind === 'user') {
    const u = requireOrgUser(c);
    if (!roleCan(u.role, resource, action)) throw new HttpError(403, 'NOT_ALLOWED');
    return { organizationId: u.organizationId, principal: p };
  }
  if (p.kind === 'counter') {
    if (!p.role) throw new HttpError(423, 'COUNTER_LOCKED');
    if (!counterCan(p.role, resource, action)) throw new HttpError(403, 'NOT_ALLOWED_ON_COUNTER');
    return { organizationId: p.organizationId, principal: p };
  }
  if (!p.permissions?.[resource]?.includes(action)) throw new HttpError(403, 'NOT_ALLOWED');
  return { organizationId: p.organizationId, principal: p };
}
