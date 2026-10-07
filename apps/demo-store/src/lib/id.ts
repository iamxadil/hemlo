// Short random ids for things made in the browser (products, orders, photos).
export const uid = () => {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(b, (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x & 31]).join('');
};

/** A URL name from a title: Latin letters and digits, Arabic kept as is, spaces to dashes. */
export const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || uid();
