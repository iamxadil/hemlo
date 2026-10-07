// Small pieces the shop and the control panel share: icons, pictures, a price, a toast.
import { signal, useSignal } from '@preact/signals';
import type { Frame } from '../lib/art';
import { price } from '../lib/format';
import { mediaTick, photoAt, photoOf, picUrl, srcsetOf } from '../lib/media';
import type { Pic } from '../lib/types';

const PATHS = {
  bag: 'M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8zM9 8V6.5a3 3 0 0 1 6 0V8',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.6-4.6',
  menu: 'M4 8.5h16M4 15.5h16',
  close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chev: 'M9 6l6 6-6 6',
  back: 'M19 12H5M11 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3z',
  whatsapp: 'M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a5 5 0 0 1-2.2-2.2l.8-1-1-2z',
  truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  shield: 'M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1zm0 0c1.5-3 5-3 5-1s-3 1-5 1z',
  drop: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  image: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4 3-3L20 16M15.5 9.5h.01',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chart: 'M4 20h16M7 16V10M12 16V5M17 16v-4',
  layout: 'M4 4h16v16H4zM4 9h16M9 9v11',
  reset: 'M4 4v6h6M4.5 15a8 8 0 1 0 1.9-8.3L4 10',
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  panel: 'M4 5h16v14H4zM9 5v14M12.5 9h4M12.5 12.5h4',
};
export type IconName = keyof typeof PATHS;
export const Icon = ({ n, class: c = '' }: { n: IconName; class?: string }) => (
  <svg class={`ic ${c}`} viewBox="0 0 24 24" aria-hidden="true"><path d={PATHS[n]} /></svg>
);

/**
 * A picture in a fixed-shape box that never shifts the page. Store photographs come as AVIF (WebP fallback) in the
 * size the screen needs, cropped around their subject, over a blurred preview that sharpens as the photo arrives.
 * `ratio="auto"` fills the parent instead (hero banners). `tall` is a portrait version for phones: the browser fetches
 * only the one the screen needs. `vt` names it for a page transition.
 */
export function Img({ pic, tall, alt = '', ratio = '4 / 5', eager = false, class: c = '', sizes = '(min-width: 1024px) 25vw, 50vw', frame, focal, vt }: {
  pic?: Pic; tall?: Pic; alt?: string; ratio?: string; eager?: boolean; class?: string; sizes?: string; frame?: Frame; focal?: string; vt?: string;
}) {
  mediaTick.value; // draw again when an uploaded photo becomes ready
  const ok = useSignal(false);
  const fill = ratio === 'auto';
  const style: Record<string, string> = fill ? {} : { aspectRatio: ratio };
  if (vt) style.viewTransitionName = vt;
  const ph = photoOf(pic);
  if (ph) {
    const [key, p] = ph, tp = photoOf(tall);
    style['--lqip'] = `url(data:image/webp;base64,${p.lqip})`;
    style.backgroundColor = p.color;
    style['--focal'] = focal ?? p.focal;
    if (tp) { style['--lqip-tall'] = `url(data:image/webp;base64,${tp[1].lqip})`; style['--focal-tall'] = tp[1].focal; }
    return (
      <div class={`pic${fill ? ' fill' : ''}${tp ? ' has-tall' : ''}${ok.value ? ' ok' : ''} ${c}`} style={style}>
        <picture>
          {tp && <source media="(max-width: 720px)" type="image/avif" srcset={srcsetOf(tp[0], tp[1], 'avif')} sizes={sizes} />}
          {tp && <source media="(max-width: 720px)" type="image/webp" srcset={srcsetOf(tp[0], tp[1], 'webp')} sizes={sizes} />}
          <source type="image/avif" srcset={srcsetOf(key, p, 'avif')} sizes={sizes} />
          <img src={photoAt(key, p, 960)} srcset={srcsetOf(key, p, 'webp')} sizes={sizes} alt={alt} width={p.w} height={p.h}
            loading={eager ? 'eager' : 'lazy'} decoding="async" fetchpriority={eager ? 'high' : 'auto'}
            ref={(el) => { if (el?.complete && el.naturalWidth && !ok.value) ok.value = true; }} onLoad={() => (ok.value = true)} />
        </picture>
      </div>
    );
  }
  const src = picUrl(pic, frame);
  return (
    <div class={`pic${fill ? ' fill' : ''}${ok.value || src?.startsWith('data:') ? ' ok' : ''} ${c}`} style={style}>
      {src && <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" style={focal ? { objectPosition: focal } : undefined} onLoad={() => (ok.value = true)} />}
    </div>
  );
}

export function Price({ value, was, class: c = '' }: { value: number; was?: number | null; class?: string }) {
  return (
    <span class={`price num ${c}`}>
      <span>{price(value)}</span>
      {was != null && was > value && <s class="was">{price(was)}</s>}
    </span>
  );
}

// ---- a toast: one short message at a time ----
const toastMsg = signal<{ text: string; id: number } | null>(null);
let toastTimer = 0;
export function toast(text: string) {
  clearTimeout(toastTimer);
  toastMsg.value = { text, id: Date.now() };
  toastTimer = window.setTimeout(() => (toastMsg.value = null), 2600);
}
export const Toast = () => (toastMsg.value ? <div class="toast" role="status" key={toastMsg.value.id}>{toastMsg.value.text}</div> : null);
