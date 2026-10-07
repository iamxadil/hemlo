// First Iraqi Bank (FIB) online payments, per shop: each business connects its own FIB business account,
// so money goes straight to the shop. Docs: fib.iq/integrations/web-payments (tokens last 60 s; IQD only).
export const FIB_BASE = { sandbox: 'https://fib.stage.fib.iq', production: 'https://fib.prod.fib.iq' } as const;
export type FibEnv = keyof typeof FIB_BASE;

export class FibError extends Error {
  constructor(public status: number, public detail: string) { super(`FIB ${status}: ${detail}`); }
}

export interface FibPayment { paymentId: string; readableCode: string; qrCode: string; personalAppLink?: string; businessAppLink?: string; validUntil: string }
export interface FibStatus { paymentId: string; status: 'PAID' | 'UNPAID' | 'DECLINED'; paidAt: string | null; declinedAt?: string | null; decliningReason?: string | null; paidBy?: { name?: string; iban?: string } | null; amount?: { amount: number | string; currency: string } }

const tokens = new Map<string, { token: string; until: number }>();

/** A client for one shop's FIB account. `base` overrides the environment's address (tests use a fake FIB). */
export function fibClient(env: FibEnv, clientId: string, clientSecret: string, base?: string) {
  const root = (base ?? FIB_BASE[env]).replace(/\/$/, '');
  const cacheKey = `${root}|${clientId}`;

  async function token(fresh = false) {
    const hit = tokens.get(cacheKey);
    if (!fresh && hit && hit.until > Date.now()) return hit.token;
    const res = await fetch(`${root}/auth/realms/fib-online-shop/protocol/openid-connect/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    }).catch((e) => { throw new FibError(0, String(e)); });
    if (!res.ok) throw new FibError(res.status, 'AUTH_FAILED');
    const j: any = await res.json();
    tokens.set(cacheKey, { token: j.access_token, until: Date.now() + Math.max(10, (j.expires_in ?? 60) - 10) * 1000 });
    return j.access_token as string;
  }

  async function call<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const res = await fetch(`${root}/protected/v1${path}`, {
      method, headers: { authorization: `Bearer ${await token()}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
    }).catch((e) => { throw new FibError(0, String(e)); });
    if (res.status === 401 && retry) { tokens.delete(cacheKey); return call(method, path, body, false); }
    if (!res.ok) throw new FibError(res.status, (await res.text().catch(() => '')).slice(0, 300));
    return (res.status === 204 ? null : await res.json().catch(() => null)) as T;
  }

  return {
    /** Checks the credentials by getting a token. */
    verify: () => token(true).then(() => true),
    create: (v: { amount: number; description: string; callbackUrl: string }) => call<FibPayment>('POST', '/payments', {
      monetaryValue: { amount: v.amount.toFixed(2), currency: 'IQD' }, statusCallbackUrl: v.callbackUrl, description: v.description.slice(0, 50), refundableFor: 'P7D',
    }),
    status: (id: string) => call<FibStatus>('GET', `/payments/${encodeURIComponent(id)}/status`),
    cancel: (id: string) => call<null>('POST', `/payments/${encodeURIComponent(id)}/cancel`),
    refund: (id: string) => call<null>('POST', `/payments/${encodeURIComponent(id)}/refund`),
  };
}
