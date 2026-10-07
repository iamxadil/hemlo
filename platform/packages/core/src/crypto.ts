// Small WebCrypto helpers that run the same in Cloudflare Workers, Node and the browser.
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string) {
  let k = keyCache.get(secret);
  if (!k) { k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); keyCache.set(secret, k); }
  return k;
}

/** Keyed hash for short secrets (codes, PINs, tokens). Without the server secret the hashes are useless. */
export async function hmac(secret: string, data: string): Promise<string> {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data)));
}

export async function sha256(data: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(data)));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** URL-safe random token (default 32 bytes = 256 bits). */
export function randomToken(bytes = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Ids: 22 URL-safe characters (132 random bits), drawn from a pool refilled 4 KB at a time, since one
// getRandomValues call per id is what made building a demo shop (thousands of rows) slow.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const pool = new Uint8Array(4096);
let poolAt = pool.length;
export function newId(prefix = ''): string {
  if (poolAt + 22 > pool.length) { crypto.getRandomValues(pool); poolAt = 0; }
  let s = prefix;
  for (let i = 0; i < 22; i++) s += ALPHABET[pool[poolAt++] & 63];
  return s;
}

// ---- sealing small secrets at rest (e.g. a shop's FIB client secret) ----
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sealKeys = new Map<string, Promise<CryptoKey>>();
function sealKey(secret: string, purpose: string) {
  const id = `${purpose}\u0000${secret}`;
  let k = sealKeys.get(id);
  if (!k) {
    k = (async () => {
      const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
      return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('hemlo-seal-v1'), info: enc.encode(purpose) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    })();
    sealKeys.set(id, k);
  }
  return k;
}

/** Encrypt with AES-256-GCM under a key derived from the server secret. Output: "v1.<iv>.<ciphertext>" (base64). */
export async function seal(secret: string, purpose: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(secret, purpose), enc.encode(plaintext)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

/** The reverse of seal(). Throws if the value was tampered with or sealed for another purpose. */
export async function unseal(secret: string, purpose: string, sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('bad sealed value');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await sealKey(secret, purpose), unb64(ct));
  return new TextDecoder().decode(pt);
}
