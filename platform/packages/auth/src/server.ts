// Hemlo ID: the Better Auth configuration. Design: docs/architecture/auth-system-design.md
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { admin, bearer, emailOTP, jwt, lastLoginMethod, organization, phoneNumber } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { apiKey } from '@better-auth/api-key';
import { oauthProvider } from '@better-auth/oauth-provider';
import { hmac, safeEqual, isCanonicalIraqiPhone, placeholderEmail, isPlaceholderEmail, newId } from '@hemlo/core';
import type { Notifier, Locale } from '@hemlo/notify';
import * as schema from '@hemlo/db/schema';
import type { Database } from '@hemlo/db';
import { ac, roles, PRIVILEGED, canAssignRole, type RoleName } from './permissions';
import { audit, rememberDevice } from './audit';

export interface AuthEnv {
  AUTH_SECRET: string;
  API_URL: string;            // https://api.hemlohq.com
  ACCOUNT_URL: string;        // https://account.hemlohq.com
  COOKIE_DOMAIN?: string;     // .hemlohq.com (unset in local development)
  TRUSTED_ORIGINS: string;    // comma-separated, wildcards allowed: https://*.hemlohq.com
  PASSKEY_RP_ID: string;      // hemlohq.com (localhost in development)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  PHONE_SIGN_IN?: string;     // "1" to allow phone codes (needs a connected WhatsApp or SMS channel)
  BUSINESS_CREATION?: string; // "open" = anyone signed in may create a business; default: Hemlo staff and approved early access only
  STAFF_PASSKEY?: string;     // "0" relaxes the passkey rule for Hemlo staff (tests only)
}

export const SESSION_DAYS = 30;
export const FRESH_SECONDS = 10 * 60;
export const DORMANT_DAYS = 180;
const API_BASE_PATH = '/v1/auth';

/** Paths that change who controls an account or a business: they need a sign-in from the last 10 minutes. */
const FRESH_PATHS = [
  '/passkey/delete-passkey', '/passkey/generate-register-options', '/email-otp/request-email-change', '/email-otp/change-email',
  '/change-email', '/organization/update-member-role', '/organization/remove-member', '/organization/delete',
  '/organization/update', '/api-key/create', '/api-key/delete', '/revoke-other-sessions', '/revoke-sessions', '/delete-user', '/unlink-account',
];
/** Codes per address per hour. The per-IP limit is looser: Iraqi carriers put many phones behind one IP. */
const CODES_PER_ADDRESS = 5;

/** A fixed one-hour window per (hashed) email or phone, kept in Better Auth's rate_limit table. */
async function limitPerAddress(adapter: any, hash: string) {
  const key = `addr:${hash}`, now = Date.now();
  const row = await adapter.findOne({ model: 'rateLimit', where: [{ field: 'key', value: key }] });
  if (!row) return adapter.create({ model: 'rateLimit', data: { key, count: 1, lastRequest: now } });
  if (now - Number(row.lastRequest) > 3600_000) return adapter.update({ model: 'rateLimit', where: [{ field: 'key', value: key }], update: { count: 1, lastRequest: now } });
  if (row.count >= CODES_PER_ADDRESS) throw new APIError('TOO_MANY_REQUESTS', { message: 'Too many codes for this address. Try again later.', code: 'TOO_MANY_CODES' });
  await adapter.update({ model: 'rateLimit', where: [{ field: 'key', value: key }], update: { count: row.count + 1 } });
}
/** While a second factor is pending (phone-only sign-in to a protected account), only these paths work. */
const PENDING_ALLOWED = [
  '/get-session', '/sign-out', '/sign-in/email-otp', '/email-otp/send-verification-otp', '/phone-number/send-otp', '/phone-number/verify',
  '/passkey/generate-authenticate-options', '/passkey/verify-authentication', '/ok', '/error',
];
// Better Auth endpoints we don't use: passwords, and email-only invitations (ours support phone numbers: /v1/invites).
const DISABLED = [
  '/sign-in/email', '/sign-up/email', '/sign-in/phone-number', '/phone-number/request-password-reset', '/phone-number/reset-password',
  '/request-password-reset', '/reset-password', '/change-password', '/set-password', '/email-otp/reset-password', '/forget-password/email-otp',
  '/organization/invite-member', '/organization/accept-invitation', '/organization/reject-invitation', '/organization/cancel-invitation',
  '/organization/get-invitation', '/organization/list-invitations', '/organization/list-user-invitations',
];

export const loginMethodFromPath = (path = '') =>
  path.startsWith('/phone-number') ? 'phone'
    : path.startsWith('/sign-in/email-otp') || path.startsWith('/email-otp') ? 'email'
      : path.startsWith('/passkey') ? 'passkey'
        : path.startsWith('/callback') || path.startsWith('/sign-in/social') ? 'google'
          : path.startsWith('/oauth2') ? 'oauth' : 'other';

export interface CreateAuthOptions {
  db: Database;
  env: AuthEnv;
  notifier: Notifier;
  /** Cloudflare's ctx.waitUntil, so messages send after the response. */
  waitUntil?: (p: Promise<unknown>) => void;
}

export function createAuth({ db, env, notifier, waitUntil }: CreateAuthOptions) {
  const trusted = env.TRUSTED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  const codeKey = (s: string) => hmac(env.AUTH_SECRET, `phone-code:${s}`);
  const prod = env.API_URL.startsWith('https://');
  const phoneOn = env.PHONE_SIGN_IN === '1' && notifier.phoneAvailable;
  const bg = (p: Promise<unknown>) => { const q = p.catch((e) => console.error('[auth background]', e)); waitUntil ? waitUntil(q) : void q; };

  const asLocale = (v: unknown): Locale | null => (v === 'en' || v === 'ar' || v === 'ckb' ? v : null);
  // The person's saved language; for someone new, the language of the page they're on (x-hemlo-locale).
  const localeOf = (u: any, ctx?: any): Locale => asLocale(u?.locale) ?? asLocale(ctx?.request?.headers?.get('x-hemlo-locale')) ?? 'ar';
  const when = (l: Locale) => new Intl.DateTimeFormat(l === 'en' ? 'en-GB' : 'ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Baghdad' }).format(new Date());
  const accountPage = (l: Locale) => `${env.ACCOUNT_URL}${l === 'en' ? '/en' : ''}/`;
  const reachable = (u: any) => ({ email: u?.email && !isPlaceholderEmail(u.email) && u.emailVerified ? u.email : undefined, phone: u?.phoneNumberVerified ? u.phoneNumber : undefined });

  return betterAuth({
    appName: 'Hemlo',
    baseURL: env.API_URL,
    basePath: API_BASE_PATH,
    secret: env.AUTH_SECRET,
    trustedOrigins: trusted,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: { enabled: false },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' } } : {},
    account: { accountLinking: { enabled: true, trustedProviders: ['google', 'email-otp', 'phone-number'] } },
    user: {
      additionalFields: {
        locale: { type: 'string', required: false, defaultValue: 'ar', input: true },
        // granted by Hemlo (an approved early-access link): may create businesses
        earlyAccess: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
      changeEmail: { enabled: true },
      deleteUser: { enabled: true },
    },
    session: {
      expiresIn: 60 * 60 * 24 * SESSION_DAYS,
      updateAge: 60 * 60 * 24,
      // 0 turns off Better Auth's own freshness rule (it blocks merely *viewing* your sessions after 10 minutes).
      // The before-hook below enforces FRESH_SECONDS on the paths that actually change control: FRESH_PATHS.
      freshAge: 0,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
      additionalFields: {
        loginMethod: { type: 'string', required: false, input: false },
        secondFactorPending: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
    },
    rateLimit: {
      enabled: true, storage: 'database', window: 60, max: 60,
      customRules: {
        '/phone-number/send-otp': { window: 60 * 60, max: 20 },
        '/email-otp/send-verification-otp': { window: 60 * 60, max: 20 },
        '/phone-number/verify': { window: 60 * 5, max: 10 },
        '/sign-in/email-otp': { window: 60 * 5, max: 10 },
        '/passkey/verify-authentication': { window: 60, max: 20 },
      },
    },
    disabledPaths: DISABLED,
    advanced: {
      cookiePrefix: 'hemlo',
      useSecureCookies: prod,
      crossSubDomainCookies: env.COOKIE_DOMAIN ? { enabled: true, domain: env.COOKIE_DOMAIN } : undefined,
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
      backgroundTasks: waitUntil ? { handler: waitUntil } : undefined,
      database: { generateId: () => newId() },
    },

    plugins: [
      phoneNumber({
        otpLength: 6, expiresIn: 5 * 60, allowedAttempts: 5,
        phoneNumberValidator: (p) => phoneOn && isCanonicalIraqiPhone(p),
        sendOTP: async ({ phoneNumber: to, code }, ctx) => {
          const user = await ctx?.context.adapter.findOne<any>({ model: 'user', where: [{ field: 'phoneNumber', value: to }] });
          bg(notifier.sendCode({ phone: to }, code, localeOf(user, ctx)));
        },
        // Codes are stored as a keyed hash (see databaseHooks.verification), so we check them ourselves.
        verifyOTP: async ({ phoneNumber: identifier, code }, ctx) => {
          const a = ctx!.context.internalAdapter;
          const row = await a.findVerificationValue(identifier);
          if (!row || row.expiresAt < new Date()) return false;
          const [stored, rawAttempts] = row.value.split(':');
          const attempts = Number(rawAttempts) || 0;
          if (attempts >= 5) { await a.deleteVerificationByIdentifier(identifier); throw new APIError('FORBIDDEN', { message: 'Too many attempts', code: 'TOO_MANY_ATTEMPTS' }); }
          if (!safeEqual(stored, await codeKey(`${identifier}:${code}`))) {
            await a.updateVerificationByIdentifier(identifier, { value: `${stored}:${attempts + 1}` });
            return false;
          }
          return true;
        },
        signUpOnVerification: { getTempEmail: placeholderEmail, getTempName: () => '' },
      }),
      emailOTP({
        otpLength: 6, expiresIn: 5 * 60, allowedAttempts: 5, storeOTP: 'hashed', resendStrategy: 'rotate',
        changeEmail: { enabled: true, verifyCurrentEmail: false },
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          const user = await ctx?.context.adapter.findOne<any>({ model: 'user', where: [{ field: 'email', value: email }] });
          bg(notifier.sendCode({ email }, otp, localeOf(user, ctx), type === 'change-email' ? 'change-email' : 'sign-in'));
        },
      }),
      passkey({
        rpID: env.PASSKEY_RP_ID, rpName: 'Hemlo', origin: [...new Set([env.ACCOUNT_URL, ...trusted.filter((o) => !o.includes('*'))])], // where passkey prompts may run
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      }),
      organization({
        ac, roles, creatorRole: 'owner',
        teams: { enabled: true, maximumTeams: 50, allowRemovingAllTeams: false },
        // demo visitors (…@demo.hemlohq.invalid) never create businesses: their demo shop is made for them and deleted after a day
        allowUserToCreateOrganization: async (user: any) => !String(user.email ?? '').endsWith('@demo.hemlohq.invalid') && (env.BUSINESS_CREATION === 'open' || user.role === 'admin' || user.earlyAccess === true), organizationLimit: 10, membershipLimit: 500,
        organizationHooks: {
          afterCreateOrganization: async ({ organization: o, user }) => { await audit(db, { kind: 'org.created', userId: user.id, organizationId: o.id, detail: { name: o.name } }); },
          afterAddMember: async ({ member, organization: o }) => { await audit(db, { kind: 'member.added', userId: member.userId, organizationId: o.id, detail: { role: member.role } }); },
          afterRemoveMember: async ({ member, organization: o }) => { await audit(db, { kind: 'member.removed', userId: member.userId, organizationId: o.id, detail: { role: member.role } }); },
          afterUpdateMemberRole: async ({ member, previousRole, organization: o }) => { await audit(db, { kind: 'member.role_changed', userId: member.userId, organizationId: o.id, detail: { from: previousRole, to: member.role } }); },
        },
      }),
      apiKey({ references: 'organization', defaultPrefix: 'hk_', requireName: true, enableMetadata: true, rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 120 } }),
      // no JWT on every session check (nothing reads set-auth-jwt; it cost a key load, decrypt and signature per request)
      jwt({ disableSettingJwtHeader: true }),
      oauthProvider({ loginPage: `${env.ACCOUNT_URL}/sign-in/`, consentPage: `${env.ACCOUNT_URL}/consent/`, allowDynamicClientRegistration: false }),
      admin({ adminRoles: ['admin'] }),
      bearer(),
      lastLoginMethod(),
    ],

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = ctx.path;
        // Replacing the phone number on an account is as sensitive as changing the email.
        const changingPhone = path === '/phone-number/verify' && !!(ctx.body as any)?.updatePhoneNumber;
        const needsFresh = changingPhone || FRESH_PATHS.some((p) => path.startsWith(p));
        if (path === '/email-otp/send-verification-otp' || path === '/phone-number/send-otp') {
          const to = String((ctx.body as any)?.email ?? (ctx.body as any)?.phoneNumber ?? '').trim().toLowerCase();
          if (to) await limitPerAddress(ctx.context.adapter, await hmac(env.AUTH_SECRET, `codes:${to}`));
        }
        const isPublic = PENDING_ALLOWED.some((p) => path.startsWith(p)) || path.startsWith('/.well-known') || path.startsWith('/jwks');
        if (!needsFresh && isPublic) return;
        const s = await getSessionFromCtx(ctx);
        if (!s) return; // Better Auth answers 401 itself where a session is required
        if ((s.session as any).secondFactorPending && (!isPublic || changingPhone))
          throw new APIError('FORBIDDEN', { message: 'Confirm it’s you with your passkey or email first', code: 'SECOND_FACTOR_REQUIRED' });
        if (needsFresh && Date.now() - new Date(s.session.createdAt).getTime() > FRESH_SECONDS * 1000)
          throw new APIError('FORBIDDEN', { message: 'Please confirm it’s you', code: 'SESSION_NOT_FRESH' });
        if (path === '/organization/update-member-role') {
          const body = ctx.body as { role?: string | string[]; organizationId?: string };
          const orgId = body.organizationId ?? (s.session as any).activeOrganizationId;
          const me = orgId && await ctx.context.adapter.findOne<any>({ model: 'member', where: [{ field: 'organizationId', value: orgId }, { field: 'userId', value: s.user.id }] });
          const targets = ([] as string[]).concat(body.role ?? []);
          if (!me || targets.some((r) => !canAssignRole(me.role, r))) throw new APIError('FORBIDDEN', { message: 'You can’t give that role', code: 'ROLE_TOO_HIGH' });
        }
      }),
    },

    databaseHooks: {
      verification: {
        create: {
          // Phone codes: store HMAC(code) instead of the code (Better Auth keeps phone codes as "code:attempts").
          before: async (v) => {
            const m = /^(\d{4,8}):(\d+)$/.exec(String(v.value));
            if (m && isCanonicalIraqiPhone(String(v.identifier))) return { data: { ...v, value: `${await codeKey(`${v.identifier}:${m[1]}`)}:${m[2]}` } };
          },
        },
      },
      user: {
        create: { after: async (u, ctx) => { await audit(db, { kind: 'user.created', userId: u.id, ip: ctx?.request?.headers.get('cf-connecting-ip'), detail: { method: loginMethodFromPath(ctx?.path) } }); } },
      },
      session: {
        create: {
          before: async (session, ctx) => {
            const method = loginMethodFromPath(ctx?.path);
            let pending = false;
            if (method === 'phone' && ctx) pending = await needsSecondFactor(ctx.context.adapter, session.userId);
            // Reopen the business the person used last, so a new sign-in lands where they left off.
            let activeOrganizationId = (session as any).activeOrganizationId ?? null;
            if (!activeOrganizationId && ctx) activeOrganizationId = await lastBusiness(ctx.context.adapter, session.userId);
            return { data: { ...session, loginMethod: method, secondFactorPending: pending, activeOrganizationId } };
          },
          after: async (session, ctx) => {
            const s = session as any;
            const ua = ctx?.request?.headers.get('user-agent') ?? s.userAgent ?? '';
            await audit(db, { kind: s.secondFactorPending ? 'session.pending_second_factor' : 'session.created', userId: s.userId, ip: s.ipAddress, userAgent: ua, detail: { method: s.loginMethod } });
            if (!ctx) return;
            const a = ctx.context.adapter;
            // A completed second factor replaces the waiting session.
            if (!s.secondFactorPending) {
              const waiting = await a.findMany<any>({ model: 'session', where: [{ field: 'userId', value: s.userId }, { field: 'secondFactorPending', value: true }] });
              for (const w of waiting) await a.delete({ model: 'session', where: [{ field: 'id', value: w.id }] });
            }
            // New device → alert (not on the very first sign-in).
            if (await rememberDevice(db, s.userId, deviceFamily(ua))) {
              const user = await a.findOne<any>({ model: 'user', where: [{ field: 'id', value: s.userId }] });
              await audit(db, { kind: 'session.new_device', userId: s.userId, ip: s.ipAddress, userAgent: ua });
              bg(notifier.newDeviceAlert(reachable(user), localeOf(user), deviceFamily(ua).replace(' on ', ' · '), when(localeOf(user)), accountPage(localeOf(user))));
            }
          },
        },
        delete: { after: async (s: any) => { await audit(db, { kind: 'session.ended', userId: s.userId }); } },
      },
    },
  });

  async function lastBusiness(a: any, userId: string): Promise<string | null> {
    const members = await a.findMany({ model: 'member', where: [{ field: 'userId', value: userId }] });
    if (!members.length) return null;
    const ids = new Set(members.map((m: any) => m.organizationId));
    const recent = await a.findMany({ model: 'session', where: [{ field: 'userId', value: userId }], sortBy: { field: 'updatedAt', direction: 'desc' }, limit: 20 });
    return recent.find((s: any) => s.activeOrganizationId && ids.has(s.activeOrganizationId))?.activeOrganizationId ?? members[0].organizationId;
  }

  /** A phone code alone can't open an account that has a stronger way in, if it runs a business or has been dormant. */
  async function needsSecondFactor(a: any, userId: string) {
    const user = await a.findOne({ model: 'user', where: [{ field: 'id', value: userId }] });
    const passkeys = await a.findMany({ model: 'passkey', where: [{ field: 'userId', value: userId }], limit: 1 });
    const hasBackup = passkeys.length > 0 || (!!user?.email && !isPlaceholderEmail(user.email) && !!user.emailVerified);
    if (!hasBackup) return false;
    const memberships = await a.findMany({ model: 'member', where: [{ field: 'userId', value: userId }] });
    if (memberships.some((m: any) => String(m.role).split(',').some((r: string) => PRIVILEGED.includes(r as RoleName)))) return true;
    const last = await a.findMany({ model: 'session', where: [{ field: 'userId', value: userId }], sortBy: { field: 'updatedAt', direction: 'desc' }, limit: 1 });
    const lastSeen = last[0]?.updatedAt ? new Date(last[0].updatedAt).getTime() : new Date(user?.createdAt ?? Date.now()).getTime();
    return Date.now() - lastSeen > DORMANT_DAYS * 86400_000;
  }
}

/** "Chrome on Android", "Safari on iPhone"… Coarse on purpose: the same phone keeps the same family. */
export function deviceFamily(ua: string): string {
  const os = /iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'iPad' : 'iPhone') : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'device';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Hemlo/.test(ua) ? 'Hemlo app' : 'browser';
  return `${br} on ${os}`;
}

export type Auth = ReturnType<typeof createAuth>;
