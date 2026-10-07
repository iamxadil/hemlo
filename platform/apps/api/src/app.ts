// api.hemlohq.com: Better Auth at /v1/auth/*, plus Hemlo's own auth routes. The same app runs on Cloudflare and in Node.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth } from '@hemlo/auth/server';
import { createNotifier } from '@hemlo/notify';
import type { Database } from '@hemlo/db';
import { HttpError, resolvePrincipal, forgetPrincipal } from './principal';
import { counterRoutes, touchCounter } from './routes/counter';
import { inviteRoutes } from './routes/invites';
import { accountRoutes } from './routes/account';
import { earlyAccessRoutes } from './routes/early-access';
import { adminRoutes, teamJoinRoutes } from './routes/admin';
import { systemsRoutes } from './routes/systems';
import { systemsOpsRoutes } from './routes/systems-ops';
import { systemsTillRoutes, fibCallbackRoutes } from './routes/systems-till';
import { demoRoutes } from './routes/demo';
import { sysFileRoutes, publicFileRoutes } from './routes/files';
import type { FileStore } from './files';
import { subscriptionGuard } from './subscription';
import { aiRoutes } from './routes/ai';
import { storeStartRoutes } from './routes/store-start';
import { sysImportRoutes } from './routes/sys-import';
import { publicPlanRoutes, billingRoutes } from './routes/pricing';
import type { Engine } from './ai/engine';
import { dentalRoutes } from './routes/dental';
import { gymRoutes } from './routes/gym';
import type { AppEnv, Deps, Env } from './types';

const originAllowed = (origin: string, patterns: string[]) =>
  patterns.some((p) => {
    if (!p.includes('*')) return p === origin;
    const [scheme, host] = p.split('://');
    try { const u = new URL(origin); return u.protocol === `${scheme}:` && u.hostname.endsWith(host.replace('*', '')); } catch { return false; }
  });

export function createApp(opts: { db: Database; env: Env; waitUntil?: (p: Promise<unknown>) => void; files?: FileStore; ai?: Engine; screens?: Deps['screens'] }) {
  const notifier = createNotifier(opts.env);
  const auth = createAuth({ db: opts.db, env: opts.env, notifier, waitUntil: opts.waitUntil });
  const deps: Deps = { db: opts.db, auth, env: opts.env, notifier, files: opts.files, ai: opts.ai, screens: opts.screens };
  const trusted = opts.env.TRUSTED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  const prod = opts.env.API_URL.startsWith('https://');

  const app = new Hono<AppEnv>();

  app.use('*', cors({
    origin: (o) => (o && originAllowed(o, trusted) ? o : null),
    credentials: true,
    allowHeaders: ['content-type', 'authorization', 'x-api-key', 'x-hemlo-counter', 'x-hemlo-as', 'x-hemlo-locale'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['set-auth-token'],
    maxAge: 600,
  }));

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store'); // images set their own
    if (prod) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });

  app.get('/', (c) => c.json({ name: 'Hemlo API', docs: 'https://hemlohq.com' }));
  app.get('/v1/health', (c) => c.json({ ok: true }));
  app.get('/v1/config', (c) => c.json({
    phone: opts.env.PHONE_SIGN_IN === '1' && notifier.phoneAvailable,
    google: !!(opts.env.GOOGLE_CLIENT_ID && opts.env.GOOGLE_CLIENT_SECRET),
    passkeyRpId: opts.env.PASSKEY_RP_ID,
    locales: ['ar', 'en'],
  }));

  // Better Auth handles everything under /v1/auth (sign-in, sessions, passkeys, organizations, OAuth …)
  // A readable, non-secret flag ("hemlo.hint=1") follows the session cookie across *.hemlohq.com, so the public sites
  // know to ask who is signed in, without calling the API for every anonymous visitor.
  const hint = (on: boolean) => ['hemlo.hint=' + (on ? '1' : ''), 'Path=/', 'SameSite=Lax', on ? 'Max-Age=' + 60 * 60 * 24 * 30 : 'Max-Age=0',
    opts.env.COOKIE_DOMAIN ? 'Domain=' + opts.env.COOKIE_DOMAIN : '', prod ? 'Secure' : ''].filter(Boolean).join('; ');
  app.on(['GET', 'POST'], '/v1/auth/*', async (c) => {
    if (c.req.method === 'POST') forgetPrincipal(c as any); // sign-out, switching business, …: read the session afresh next time
    const res = await auth.handler(c.req.raw);
    const session = res.headers.getSetCookie().find((x) => /session_token=/.test(x));
    if (!session) return res;
    const cleared = /session_token=;|Max-Age=0/i.test(session);
    const out = new Response(res.body, res);
    out.headers.append('set-cookie', hint(!cleared));
    return out;
  });

  // OpenID discovery at the well-known locations
  app.get('/.well-known/openid-configuration', (c) => auth.handler(new Request(new URL('/v1/auth/.well-known/openid-configuration', opts.env.API_URL), { headers: c.req.raw.headers })));
  app.get('/.well-known/oauth-authorization-server', (c) => auth.handler(new Request(new URL('/v1/auth/.well-known/oauth-authorization-server', opts.env.API_URL), { headers: c.req.raw.headers })));

  const v1 = new Hono<AppEnv>();
  v1.use('*', resolvePrincipal(deps));
  v1.use('*', async (c, next) => { await next(); await touchCounter(deps, c.get('principal')).catch(() => {}); });
  v1.route('/counter', counterRoutes(deps));
  v1.route('/invites', inviteRoutes(deps));
  v1.route('/early-access', earlyAccessRoutes(deps));
  v1.route('/admin', adminRoutes(deps));
  v1.route('/team-invites', teamJoinRoutes(deps));
  // after a trial or paid period ends: read and export yes, change no (starting a new clinic is always allowed)
  v1.route('/store', storeStartRoutes(deps));
  v1.route('/plans', publicPlanRoutes(deps));     // the price list (website, app)
  v1.route('/billing', billingRoutes(deps));      // a business's own plan: open even after a trial ends, to ask for a plan // a shop's free trial starts here (no business yet, so before the guard)
  v1.use('/sys/*', subscriptionGuard);
  v1.use('/dent/*', async (c, next) => (c.req.path.endsWith('/dent/start') ? next() : subscriptionGuard(c, next)));
  v1.route('/dent', dentalRoutes(deps));
  // the door screen's own routes (and starting a gym) are not a gym member's changes
  v1.use('/gym/*', async (c, next) => (/\/gym\/(start|door|door\/checkin)$/.test(c.req.path) ? next() : subscriptionGuard(c, next)));
  v1.route('/gym', gymRoutes(deps));
  v1.route('/sys/ai', aiRoutes(deps));
  v1.route('/sys/files', sysFileRoutes(deps));
  v1.route('/files', publicFileRoutes(deps));
  v1.route('/sys', systemsRoutes(deps));
  v1.route('/sys', systemsOpsRoutes(deps));
  v1.route('/sys', systemsTillRoutes(deps));
  v1.route('/sys', sysImportRoutes(deps));
  v1.route('/fib', fibCallbackRoutes(deps));
  v1.route('/demo', demoRoutes(deps));
  v1.route('/', accountRoutes(deps));
  app.route('/v1', v1);

  app.notFound((c) => c.json({ error: 'NOT_FOUND' }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.code, message: err.message }, err.status);
    const status = (err as any)?.statusCode ?? (err as any)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) return c.json({ error: (err as any).body?.code ?? 'BAD_REQUEST', message: err.message }, status as any);
    console.error('[api]', err);
    return c.json({ error: 'INTERNAL' }, 500);
  });

  return { app, auth, deps };
}
