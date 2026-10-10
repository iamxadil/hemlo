// Cloudflare Worker entry: Postgres (Neon) through Hyperdrive.
// The app (Better Auth + routes) is built once per isolate, while the Worker starts up: that CPU isn't charged to a
// request (the free plan allows 10 ms of CPU per request, and building the app costs more than that on its own).
// Each request still gets its own database client (connections can't be shared between requests in Workers),
// reached through a proxy that looks up "the current request's database".
import { AsyncLocalStorage } from 'node:async_hooks';
import { env as startupEnv } from 'cloudflare:workers';
import { createPostgresDb } from '@hemlo/db/postgres';
import type { Database } from '@hemlo/db';
import { createApp } from './app';
import { purgeDemos } from './routes/demo';
import { purgeOrphanFiles } from './routes/files';
import { r2Store, type FileStore } from './files';
import { engineFrom } from './ai/engine';
import { screenOrg } from './routes/dental/screen';
import { doorOrg } from './routes/gym/door';
import { websitePathRoute, businessRootRedirect } from './website-routing';
import { tick as connectTick } from './connect/core';
export { ScreenHub } from './screen-hub';
import type { Env } from './types';

type WorkerService = { fetch(request: Request): Promise<Response> };
type WorkerEnv = Env & {
  HYPERDRIVE?: { connectionString: string }; DATABASE_URL?: string; UPLOADS?: unknown; AI?: unknown; SCREENS?: DurableObjectNamespace;
  SYSTEM_APP: WorkerService; ACCOUNT_APP: WorkerService; ADMIN_APP: WorkerService; STUDIO_APP: WorkerService; TOOLS_APP: WorkerService; DEMO_APP: WorkerService;
};
/** "this clinic's queue changed": its hub tells the open screens (after the response, never slowing it) */
const screensOf = (env: WorkerEnv) => (env.SCREENS ? { changed(org: string) {
  const p = env.SCREENS!.get(env.SCREENS!.idFromName(org)).fetch('https://hub/changed', { method: 'POST' }).catch(() => {});
  const ctx = scope.getStore()?.ctx; if (ctx) ctx.waitUntil(p);
} } : undefined);
const filesOf = (env: WorkerEnv): FileStore | undefined => (env.UPLOADS ? r2Store(env.UPLOADS) : undefined);
type RequestScope = { db: Database; ctx: ExecutionContext };

const scope = new AsyncLocalStorage<RequestScope>();
const db = new Proxy({} as Database, {
  get(_target, prop) {
    const current = scope.getStore()?.db;
    if (!current) throw new Error('database used outside a request');
    const value = (current as any)[prop];
    return typeof value === 'function' ? value.bind(current) : value;
  },
});

/** Work after the response (Connect's replies): its own database connection, so it may outlive the request's. */
const laterOf = (env: WorkerEnv) => (task: () => Promise<void>) => {
  const ctx = scope.getStore()?.ctx, url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!ctx || !url) { void task().catch(() => {}); return; }
  const own = createPostgresDb(url, 1);
  ctx.waitUntil(scope.run({ db: own, ctx }, async () => {
    try { await task(); } catch (e) { console.error('[later]', e instanceof Error ? e.message : e); }
    finally { await (own as any).$client?.end?.({ timeout: 5 }).catch(() => {}); }
  }));
};
const build = (env: WorkerEnv) => createApp({ db, env, files: filesOf(env), ai: engineFrom(env), screens: screensOf(env), waitUntil: (p) => scope.getStore()?.ctx.waitUntil(p), later: laterOf(env) }).app;
let app: ReturnType<typeof createApp>['app'] | null = (() => { try { return build(startupEnv as unknown as WorkerEnv); } catch { return null; } })();

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const host = new URL(request.url).hostname.toLowerCase();
    // The wildcard route also sees Hemlo's existing app hosts. Preserve their original Workers with service bindings.
    const existingApps: Record<string, WorkerService> = {
      'system.hemlohq.com': env.SYSTEM_APP,
      'account.hemlohq.com': env.ACCOUNT_APP,
      'admin.hemlohq.com': env.ADMIN_APP,
      'studio.hemlohq.com': env.STUDIO_APP,
      'tools.hemlohq.com': env.TOOLS_APP,
      'demo.hemlohq.com': env.DEMO_APP,
    };
    if (host === 'www.hemlohq.com') {
      const url = new URL(request.url);
      url.hostname = 'hemlohq.com';
      return Response.redirect(url, 301);
    }
    if (existingApps[host]) return existingApps[host].fetch(request);
    const root = businessRootRedirect(host, new URL(request.url).pathname, new URL(request.url).search);
    if (root) return Response.redirect(root, 302);
    const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    if (!url) return new Response('Database not configured', { status: 503 });
    app ??= build(env);
    const requestDb = createPostgresDb(url, 1);
    try {
      const path = new URL(request.url).pathname;
      // Legacy path URLs remain readable while customer websites use their own Hemlo subdomains.
      const websitePath = websitePathRoute(host, path);
      if (websitePath && 'invalid' in websitePath) return new Response('Not found', { status: 404 });
      if (websitePath && 'siteSlug' in websitePath) {
        const url = new URL(request.url);
        url.pathname = websitePath.apiPath;
        const headers = new Headers(request.headers);
        headers.set('x-hemlo-site', websitePath.siteSlug);
        headers.set('x-hemlo-site-base', websitePath.siteBase);
        const rewritten = new Request(url.toString(), { method: request.method, headers, body: request.body, redirect: 'manual' });
        return await scope.run({ db: requestDb, ctx }, () => app!.fetch(rewritten, env, ctx));
      }
      const INFRA = ['api', 'www', 'account', 'admin', 'system', 'studio', 'tools', 'demo', 'business'];
      const bare = host.endsWith('.hemlo.site') ? host.slice(0, -'.hemlo.site'.length)
        : host.endsWith('.hemlohq.com') ? host.slice(0, -'.hemlohq.com'.length) : null;
      const sub = bare && !INFRA.includes(bare) ? bare : null;
      if (sub) {
        const inner = new URL(request.url);
        inner.pathname = '/v1/web/pub' + (path === '/' ? '' : path);
        const headers = new Headers(request.headers);
        headers.set('x-hemlo-site', sub);
        const rewritten = new Request(inner.toString(), { method: request.method, headers, body: request.body, redirect: 'manual' });
        return await scope.run({ db: requestDb, ctx }, () => app!.fetch(rewritten, env, ctx));
      }
      // a waiting-room screen's live line: check its link once, then hand the connection to the clinic's hub
      // (a gym's door screen the same way: its hub is "gym:<org>")
      if ((path === '/v1/dent/screen/live' || path === '/v1/gym/door/live') && env.SCREENS) {
        if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('expected a websocket', { status: 426 });
        const gym = path === '/v1/gym/door/live', k = new URL(request.url).searchParams.get('k');
        const org = gym ? await doorOrg(requestDb, k) : await screenOrg(requestDb, k);
        if (!org) return new Response('no screen', { status: 404 });
        return env.SCREENS.get(env.SCREENS.idFromName(gym ? `gym:${org}` : org)).fetch(request);
      }
      return await scope.run({ db: requestDb, ctx }, () => app!.fetch(request, env, ctx));
    } finally {
      ctx.waitUntil((requestDb as any).$client?.end?.({ timeout: 5 }).catch(() => {}));
    }
  },

  /** wrangler.jsonc triggers. Every 6 hours: demo shops older than a day, and images never attached, are deleted.
   *  Every hour: Hemlo Connect's automations (one small query when no business uses Connect). */
  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) {
    const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    if (!url) return;
    const db = createPostgresDb(url);
    try {
      if (event.cron === '7 * * * *') {
        app ??= build(env);
        const deps = { db, env, files: filesOf(env), ai: engineFrom(env) } as any;
        console.log('[connect]', await scope.run({ db, ctx }, () => connectTick(deps)));
        return;
      }
      console.log('[demo purge]', await purgeDemos(db, undefined, filesOf(env)));
      console.log('[orphan images]', await purgeOrphanFiles(db, filesOf(env)));
    }
    finally { ctx.waitUntil((db as any).$client?.end?.({ timeout: 5 }).catch(() => {})); }
  },
};
