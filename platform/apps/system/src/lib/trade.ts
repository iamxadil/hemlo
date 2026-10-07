// Which product this visitor came for (Hemlo Gym, Hemlo Dental, Hemlo Store), so the screens before sign-in speak to
// their business only. Learned from the link (?for= / ?start= / ?demo= from hemlohq.com/gym etc.) or from the business
// they last opened on this device; unknown means a general welcome.
export type Trade = 'store' | 'dental' | 'gym' | 'realestate';
const KEY = 'hemlo.trade';
const norm = (v: string | null): Trade | null => (v === 'gym' || v === 'dental' || v === 'realestate' ? v : v === 'estate' ? 'realestate' : v === 'store' || v === 'stores' || v === '1' ? 'store' : null);

export function rememberTrade(t: Trade | null | undefined) {
  if (t) try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
}

export function readTrade(): Trade | null {
  const q = new URLSearchParams(location.search);
  const fromLink = norm(q.get('for')) ?? norm(q.get('start')) ?? norm(q.get('kind')) ?? norm(q.get('demo'));
  if (fromLink) { rememberTrade(fromLink); return fromLink; }
  try { return norm(localStorage.getItem(KEY)); } catch { return null; }
}

/** The product's own page on hemlohq.com. */
export const productPath = (t: Trade | null) => (t === 'gym' ? '/gym/' : t === 'dental' ? '/dental/' : t === 'store' ? '/store/' : t === 'realestate' ? '/realestate/' : '/systems/');
