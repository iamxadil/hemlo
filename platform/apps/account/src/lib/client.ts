// Browser-side helpers shared by every account screen.
import { createAuthClient } from 'better-auth/client';
import { emailOTPClient, phoneNumberClient, organizationClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { normalizeIraqiPhone, isAllowedReturnUrl, formatIraqiPhone } from '@hemlo/core';
import { STRINGS, fill, langFromPath, pathFor, type Lang, type Strings } from './i18n';

export const API = (import.meta.env.PUBLIC_API_URL as string | undefined) ?? 'http://localhost:8787';
/** Hemlo Systems: where a business is run (the workspace) */
export const SYSTEM = (import.meta.env.PUBLIC_SYSTEM_URL as string | undefined) ?? 'https://system.hemlohq.com/';
const RETURN_HOSTS = ((import.meta.env.PUBLIC_RETURN_HOSTS as string | undefined) ?? 'hemlohq.com,*.hemlohq.com,localhost').split(',');

export const authClient = createAuthClient({
  baseURL: `${API}/v1/auth`,
  fetchOptions: { credentials: 'include', headers: { 'x-hemlo-locale': langFromPath(location.pathname) } }, // emails to new people follow the page language
  plugins: [emailOTPClient(), phoneNumberClient(), organizationClient(), passkeyClient()],
});

export const lang: Lang = langFromPath(location.pathname);
export const t: Strings = STRINGS[lang];
export { fill, formatIraqiPhone, normalizeIraqiPhone };
export const page = (name = '') => pathFor(lang, name);

export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

/** Hemlo's own routes (/v1/…). Throws ApiError with a stable code. */
export async function api<T = any>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { method: init.method ?? (init.body ? 'POST' : 'GET'), credentials: 'include',
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers }, body: init.body ? JSON.stringify(init.body) : undefined });
  } catch { throw new ApiError(0, 'NETWORK', t.errors.network); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? json.code ?? 'ERROR', json.message ?? '');
  return json as T;
}

/** Unwraps Better Auth client results ({ data, error }) into data or ApiError. */
export async function ba<T>(p: Promise<{ data: T | null; error: any }>): Promise<T> {
  let r;
  try { r = await p; } catch { throw new ApiError(0, 'NETWORK', t.errors.network); }
  if (r.error) throw new ApiError(r.error.status ?? 400, r.error.code ?? 'ERROR', r.error.message ?? '');
  return r.data as T;
}

/** A person-friendly message for any error. */
export function messageFor(e: unknown): string {
  if (!(e instanceof ApiError)) return t.errors.generic;
  const c = e.code;
  if (c === 'NETWORK') return t.errors.network;
  if (e.status === 429 || /TOO_MANY/.test(c)) return t.errors.tooMany;
  if (/INVALID_OTP|INVALID_CODE|OTP_NOT_FOUND/.test(c)) return t.errors.invalidCode;
  if (/EXPIRED/.test(c) && /OTP|CODE/.test(c)) return t.errors.expiredCode;
  if (c === 'SESSION_NOT_FRESH') return t.errors.notFresh;
  if (c === 'NOT_ALLOWED' || c === 'PERMISSION_ABOVE_YOUR_OWN') return t.errors.notAllowed;
  if (c === 'ROLE_TOO_HIGH') return t.errors.roleTooHigh;
  if (c === 'PIN_TOO_EASY') return t.errors.pinWeak;
  if (c === 'PIN_FORMAT') return t.errors.pinFormat;
  if (c === 'INVALID_PHONE' || /INVALID_PHONE/.test(c)) return t.errors.invalidPhone;
  if (c === 'INVALID_EMAIL') return t.errors.invalidEmail;
  if (/PHONE_NUMBER_EXIST/.test(c)) return t.errors.phoneUsed;
  return e.message && lang === 'en' ? e.message : t.errors.generic;
}

// ---------- tiny DOM helpers ----------
type Attrs = Record<string, any>;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | false | undefined)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids) if (kid != null && kid !== false) el.append(kid);
  return el;
}
export const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

export function toast(text: string, kind: 'ok' | 'error' = 'ok') {
  const el = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status', text });
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

/** Runs a button action with a busy state and friendly errors. */
export async function busy(btn: HTMLButtonElement | null, fn: () => Promise<unknown>, onError?: (msg: string, e: unknown) => void) {
  if (btn) { btn.disabled = true; btn.dataset.busy = '1'; }
  try { await fn(); }
  catch (e) { const m = messageFor(e); onError ? onError(m, e) : toast(m, 'error'); if (e instanceof ApiError && e.code === 'SESSION_NOT_FRESH') reconfirm(); }
  finally { if (btn) { btn.disabled = false; delete btn.dataset.busy; } }
}

/** Where to go after signing in: a validated return_to, or the account page. */
export function returnTarget(): string {
  const r = new URLSearchParams(location.search).get('return_to');
  return r && isAllowedReturnUrl(r, RETURN_HOSTS) ? r : page();
}

export function goSignIn(returnTo = location.href) {
  location.href = `${page('sign-in')}?return_to=${encodeURIComponent(returnTo)}`;
}

/** Ask the person to sign in again (for actions that need a sign-in from the last 10 minutes). */
export function reconfirm() {
  setTimeout(() => goSignIn(location.href), 1400);
}

export interface Me {
  user: { id: string; name: string; email: string | null; emailVerified: boolean; phoneNumber: string | null; phoneNumberVerified: boolean; locale: string; image: string | null; createdAt: string; hemloStaff: boolean };
  session: { id: string; loginMethod: string | null; secondFactorPending: boolean; createdAt: string; fresh: boolean };
  organizations: { id: string; name: string; slug: string; logo: string | null; role: string; kind?: string | null }[];
  activeOrganizationId: string | null;
  permissions: Record<string, string[]>;
  backup: { passkeys: number; email: boolean };
  needsBackup: boolean;
  canCreateBusiness: boolean;
}

/** Loads "me", sending people to sign-in or to the confirmation step when needed. */
export async function requireMe(): Promise<Me> {
  try {
    const me = await api<Me>('/v1/me');
    if (me.session.secondFactorPending && !location.pathname.includes('/confirm/')) {
      location.href = `${page('confirm')}?return_to=${encodeURIComponent(location.href)}`;
      await new Promise(() => {});
    }
    return me;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { goSignIn(); await new Promise(() => {}); }
    throw e;
  }
}

export const can = (me: Me, resource: string, action: string) => !!me.permissions?.[resource]?.includes(action);
export const roleName = (role: string) => role.split(',').map((r) => (t.roles as any)[r] ?? r).join('، ');
// one letter for Arabic-script names (two read oddly, like «أا»), two for Latin names
export const initials = (name: string) => { const w = (name || '؟').trim().split(/\s+/); return /[؀-ۿ]/.test(w[0]) ? w[0][0] : w.slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
export const when = (iso: string | Date) => new Date(iso).toLocaleString(lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
export const passkeysSupported = () => typeof window.PublicKeyCredential === 'function';
