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
export { ScreenHub } from './screen-hub';
import type { Env } from './types';

type WorkerEnv = Env & { HYPERDRIVE?: { connectionString: string }; DATABASE_URL?: string; UPLOADS?: unknown; AI?: unknown; SCREENS?: DurableObjectNamespace };
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

const build = (env: WorkerEnv) => createApp({ db, env, files: filesOf(env), ai: engineFrom(env), screens: screensOf(env), waitUntil: (p) => scope.getStore()?.ctx.waitUntil(p) }).app;
let app: ReturnType<typeof createApp>['app'] | null = (() => { try { return build(startupEnv as unknown as WorkerEnv); } catch { return null; } })();

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    if (!url) return new Response('Database not configured', { status: 503 });
    app ??= build(env);
    const requestDb = createPostgresDb(url, 1);
    try {
      // a waiting-room screen's live line: check its link once, then hand the connection to the clinic's hub
      const path = new URL(request.url).pathname;
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

  /** Every 6 hours (wrangler.jsonc triggers): demo shops older than a day, and images never attached, are deleted. */
  async scheduled(_event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) {
    const url = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
    if (!url) return;
    const db = createPostgresDb(url);
    try {
      console.log('[demo purge]', await purgeDemos(db, undefined, filesOf(env)));
      console.log('[orphan images]', await purgeOrphanFiles(db, filesOf(env)));
    }
    finally { ctx.waitUntil((db as any).$client?.end?.({ timeout: 5 }).catch(() => {})); }
  },
};
