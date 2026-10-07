// Test harness: the real API app on an in-memory Postgres (PGlite, running as a non-superuser so RLS applies),
// plus a tiny browser-like client with a cookie jar. Messages are captured in the notify outbox.
import { createPgliteDb } from '@hemlo/db/pglite';
import { outbox } from '@hemlo/notify';
import { createApp } from '../apps/api/src/app';
import { memoryStore } from '../apps/api/src/files';
import type { Env } from '../apps/api/src/types';
import type { Engine } from '../apps/api/src/ai/engine';

export const ORIGIN = 'http://localhost:4321';

export const testEnv: Env = {
  AUTH_SECRET: 'test-secret-test-secret-test-secret-00',
  API_URL: 'http://localhost:8787',
  ACCOUNT_URL: ORIGIN,
  TRUSTED_ORIGINS: `${ORIGIN},http://localhost:8787`,
  PASSKEY_RP_ID: 'localhost',
  PHONE_SIGN_IN: '1',
  DEV_CONSOLE_MESSAGES: '1',
  BUSINESS_CREATION: 'open', // most tests create businesses freely; tests/access.test.ts uses the real rule
  STAFF_PASSKEY: '0',
};

export async function setup(overrides: Partial<Env> = {}, ai?: Engine) {
  const { db, client } = await createPgliteDb();
  const files = memoryStore();
  const { app, auth } = createApp({ db, env: { ...testEnv, ...overrides }, files, ai });
  return { db, client, app, auth, files };
}

export type App = Awaited<ReturnType<typeof setup>>['app'];

let ipCounter = 1;
export class Browser {
  jar = new Map<string, string>();
  ip = `10.0.0.${ipCounter++}`;
  constructor(private app: App, public ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36') {}

  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { origin: ORIGIN, 'user-agent': this.ua, 'x-forwarded-for': this.ip, ...headers };
    if (this.jar.size) h.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const raw = body instanceof Uint8Array; // an upload: sent as is
    if (body !== undefined && !raw) h['content-type'] = 'application/json';
    const res = await this.app.request(`http://localhost:8787${path}`, { method, headers: h, body: body === undefined ? undefined : raw ? (body as any) : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
      const expired = attrs.some((a) => /max-age=0\b/i.test(a) || /expires=Thu, 01 Jan 1970/i.test(a));
      if (!value || expired) this.jar.delete(name); else this.jar.set(name, value);
    }
    const text = await res.text();
    let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json, headers: res.headers };
  }
  get = (p: string, h?: Record<string, string>) => this.req('GET', p, undefined, h);
  post = (p: string, b: unknown = {}, h?: Record<string, string>) => this.req('POST', p, b, h);
  put = (p: string, b: unknown = {}) => this.req('PUT', p, b);
  del = (p: string, b?: unknown) => this.req('DELETE', p, b);
  upload = (p: string, bytes: Uint8Array, type = 'image/png', h: Record<string, string> = {}) => this.req('POST', p, bytes, { 'content-type': type, ...h });
}

export function lastCode(to: string): string {
  const m = [...outbox].reverse().find((x) => x.to.toLowerCase() === to.toLowerCase() && x.kind === 'code');
  const code = m?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no code sent to ${to}`);
  return code;
}

export async function signInEmail(b: Browser, email: string) {
  const s = await b.post('/v1/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
  if (s.status !== 200) throw new Error(`send email code: ${s.status} ${JSON.stringify(s.json)}`);
  const r = await b.post('/v1/auth/sign-in/email-otp', { email, otp: lastCode(email) });
  if (r.status !== 200) throw new Error(`email sign-in: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

export async function signInPhone(b: Browser, phoneNumber: string) {
  const s = await b.post('/v1/auth/phone-number/send-otp', { phoneNumber });
  if (s.status !== 200) throw new Error(`send phone code: ${s.status} ${JSON.stringify(s.json)}`);
  const r = await b.post('/v1/auth/phone-number/verify', { phoneNumber, code: lastCode(phoneNumber) });
  if (r.status !== 200) throw new Error(`phone sign-in: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

export async function createOrg(b: Browser, name: string) {
  const r = await b.post('/v1/auth/organization/create', { name, slug: name.toLowerCase().replace(/\W+/g, '-') + '-' + Math.random().toString(36).slice(2, 6) });
  if (r.status !== 200) throw new Error(`create org: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}
