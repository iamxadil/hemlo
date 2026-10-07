// hemlohq.com: serves the static site from ./dist, sends www to the bare domain, adds security headers,
// and answers byte-range requests for videos (Safari and iPhones won't play an MP4 without them).
import VIDEO_SIZES from './video-sizes.json';
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === 'www.hemlohq.com') { url.hostname = 'hemlohq.com'; return Response.redirect(url.toString(), 301); }
    // Workshops became Systems (workshops is now its first edition)
    if (/^\/(en\/)?workshops\/?$/.test(url.pathname)) return Response.redirect(`${url.origin}/${url.pathname.startsWith('/en/') ? 'en/' : ''}systems/`, 301);
    // each business became its own product with a short link: /systems/gym/ → /gym/ (and /systems/stores/ → /store/)
    const moved = /^\/(en\/)?systems\/(gym|dental|stores)\/?$/.exec(url.pathname);
    if (moved) return Response.redirect(`${url.origin}/${moved[1] ?? ''}${moved[2] === 'stores' ? 'store' : moved[2]}/${url.search}`, 301);
    // Studio moved to its own site
    if (/^\/(en\/)?studio\/?$/.test(url.pathname)) return Response.redirect('https://studio.hemlohq.com/' + (url.pathname.startsWith('/en/') ? 'en/' : ''), 301);
    // Hemlo Real Estate's public pages: a property (/p/slug), a lead's collection (/c/token), an owner's report (/r/token)
    if (/^\/(p|c|r)\/[A-Za-z0-9-]+(\/(event|request|fav))?\/?$/.test(url.pathname) && env.API) {
      const to = new URL(`https://api.hemlohq.com/v1/re/pub${url.pathname.replace(/\/$/, '')}${url.search}`);
      const headers = new Headers(request.headers);
      const ip = request.headers.get('cf-connecting-ip');
      if (ip) headers.set('x-forwarded-for', ip);
      const res = await env.API.fetch(new Request(to, { method: request.method, headers, body: request.body, redirect: 'manual' }));
      const out = new Response(res.body, res);
      out.headers.set('X-Content-Type-Options', 'nosniff');
      out.headers.set('Strict-Transport-Security', 'max-age=31536000');
      return out;
    }
    const isVideo = url.pathname.endsWith('.mp4');
    let res = await env.ASSETS.fetch(isVideo ? new Request(url.toString(), { method: 'GET' }) : request);
    if (isVideo && res.status === 200) res = videoPart(request, res, ctx, VIDEO_SIZES[url.pathname]);
    const out = new Response(res.body, res);
    out.headers.set('X-Content-Type-Options', 'nosniff');
    out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    out.headers.set('Strict-Transport-Security', 'max-age=31536000');
    out.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (/\.(woff2|png|svg|ico|mp4|jpg)$/.test(url.pathname) || url.pathname.startsWith('/_astro/')) out.headers.set('Cache-Control', 'public, max-age=2592000');
    return out;
  },
};

/** The part of the file the browser asked for (Range: bytes=a-b), streamed straight through without buffering it. */
function videoPart(request, res, ctx, knownSize) {
  const total = Number(res.headers.get('content-length') ?? knownSize ?? 0);
  const headers = new Headers(res.headers);
  headers.set('Accept-Ranges', 'bytes'); if (total) headers.set('Content-Length', String(total));
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (request.method === 'HEAD') { res.body?.cancel(); return new Response(null, { status: 200, headers }); }
  if (!m || !total || (m[1] === '' && m[2] === '')) return new Response(res.body, { status: 200, headers });
  const start = m[1] === '' ? Math.max(0, total - Number(m[2])) : Number(m[1]);
  const end = m[1] === '' || m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  if (start >= total || start > end) {
    res.body?.cancel(); headers.delete('Content-Length'); headers.set('Content-Range', `bytes */${total}`);
    return new Response(null, { status: 416, headers });
  }
  const length = end - start + 1;
  let pos = 0;
  const cut = new TransformStream({
    transform(chunk, out) {
      const a = Math.max(start - pos, 0), b = Math.min(end + 1 - pos, chunk.byteLength);
      if (b > a) out.enqueue(chunk.subarray(a, b));
      pos += chunk.byteLength;
      if (pos > end) out.terminate();
    },
  });
  const fixed = new FixedLengthStream(length); // so the response carries an exact Content-Length
  ctx.waitUntil(res.body.pipeThrough(cut).pipeTo(fixed.writable).catch(() => {}));
  headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  headers.set('Content-Length', String(length));
  return new Response(fixed.readable, { status: 206, headers });
}
