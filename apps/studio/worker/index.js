// studio.hemlohq.com: serves the static site from ./dist and adds security and cache headers.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // the old separate pages now live on the one page
    const old = url.pathname.match(/^\/(en\/)?(pricing|quote)\/?$/);
    if (old) return Response.redirect(`${url.origin}/${old[1] || ''}${url.search}#${old[2] === 'pricing' ? 'prices' : 'build'}`, 301);
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('X-Content-Type-Options', 'nosniff');
    out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    out.headers.set('Strict-Transport-Security', 'max-age=31536000');
    out.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (/\.(woff2|png|svg|ico)$/.test(url.pathname) || url.pathname.startsWith('/_astro/')) out.headers.set('Cache-Control', 'public, max-age=2592000');
    return out;
  },
};
