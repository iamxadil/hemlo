// Hemlo coming-soon site: serves the static page from ./public and sends www to the bare domain.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.hemlohq.com') {
      url.hostname = 'hemlohq.com';
      return Response.redirect(url.toString(), 301);
    }
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('X-Content-Type-Options', 'nosniff');
    out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    out.headers.set('Strict-Transport-Security', 'max-age=31536000');
    return out;
  },
};
