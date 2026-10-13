/** Parse customer Website paths on the already-routed business hostname. */
export function websitePathRoute(hostname: string, pathname: string):
  | { siteSlug: string; apiPath: string; siteBase: string }
  | { invalid: true }
  | null {
  if (hostname.toLowerCase() !== 'business.hemlohq.com') return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 's') return null;
  if (!parts[1]) return { invalid: true };
  let siteSlug: string;
  try { siteSlug = decodeURIComponent(parts[1]).toLowerCase(); } catch { return { invalid: true }; }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(siteSlug)) return { invalid: true };
  const tail = parts.slice(2);
  return { siteSlug, apiPath: `/v1/web/pub${tail.length ? `/${tail.join('/')}` : ''}`, siteBase: `/s/${encodeURIComponent(siteSlug)}` };
}

/** business.hemlohq.com on its own is not a site: it shows what a Hemlo Website is, the live sample (keeping ?lang). */
export function businessRootRedirect(hostname: string, pathname: string, search: string): string | null {
  if (hostname.toLowerCase() !== 'business.hemlohq.com' || (pathname !== '/' && pathname !== '')) return null;
  const lang = new URLSearchParams(search).get('lang');
  return `https://business.hemlohq.com/s/sample${lang === 'en' ? '?lang=en' : ''}`;
}
