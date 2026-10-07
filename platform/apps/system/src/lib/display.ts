import type { Lang } from './i18n';
// The customer display: a second window on the till's second screen, fed by the checkout over a BroadcastChannel.
export type DisplayMsg =
  | { type: 'cart'; shop: string; logo?: string | null; lang: Lang; lines: { name: string; qty: string; total: number }[]; total: number; count: number }
  | { type: 'fib'; shop: string; lang: Lang; qr: string; code: string; amount: number }
  | { type: 'done'; shop: string; lang: Lang; total: number; change?: number }
  | { type: 'hello' };

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hemlo-display') : null;
export const toDisplay = (m: DisplayMsg) => channel?.postMessage(m);
export function onDisplay(fn: (m: DisplayMsg) => void) {
  const h = (e: MessageEvent) => fn(e.data as DisplayMsg);
  channel?.addEventListener('message', h);
  return () => channel?.removeEventListener('message', h);
}
export const openDisplay = () => window.open('/#/display', 'hemlo-display', 'popup,width=1100,height=720');
