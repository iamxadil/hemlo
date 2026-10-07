// Where may we send people after they sign in? Only to our own sites (no open redirects).
export function isAllowedReturnUrl(url: string, allowedHosts: string[]): boolean {
  try {
    const u = new URL(url);
    if (u.username || u.password) return false;
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return false;
    return allowedHosts.some((h) => (h.startsWith('*.') ? u.hostname.endsWith(h.slice(1)) : u.hostname === h));
  } catch { return false; }
}
export const safeReturnUrl = (url: string | null | undefined, allowedHosts: string[], fallback: string) =>
  url && isAllowedReturnUrl(url, allowedHosts) ? url : fallback;
