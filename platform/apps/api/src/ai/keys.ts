// AI providers' API keys, kept encrypted in the database (AES-GCM). The encryption key comes from a Worker secret
// (AI_KEYS_SECRET, else AUTH_SECRET), so the database alone never reveals a key. A key goes in once and never comes back
// out to anyone: the dashboard only ever sees its last four characters.
const enc = new TextEncoder(), dec = new TextDecoder();
const cryptoKeys = new Map<string, Promise<CryptoKey>>();

function keyFrom(secret: string) {
  let k = cryptoKeys.get(secret);
  if (!k) {
    k = crypto.subtle.digest('SHA-256', enc.encode(`hemlo-ai-keys:${secret}`)).then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
    cryptoKeys.set(secret, k);
  }
  return k;
}
const b64 = (u: Uint8Array) => { let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const masterSecret = (env: { AI_KEYS_SECRET?: string; AUTH_SECRET: string }) => env.AI_KEYS_SECRET || env.AUTH_SECRET;

/** "v1.<iv>.<ciphertext>" */
export async function sealKey(secret: string, apiKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(secret), enc.encode(apiKey)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}
export async function openKey(secret: string, sealed: string | null | undefined): Promise<string | null> {
  if (!sealed) return null;
  const [v, iv, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !ct) return null;
  try { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await keyFrom(secret), unb64(ct))); } catch { return null; }
}
export const hintOf = (apiKey: string) => apiKey.slice(-4);
