// Iraqi phone numbers: accept what people actually type, store one canonical form (+9647XXXXXXXXX).
//   "0770 123 4567", "770-123-4567", "+964 770 123 4567", "00964…", "٠٧٧٠١٢٣٤٥٦٧", "۰۷۷۰…"

const EASTERN = /[٠-٩۰-۹]/g;
const toLatinDigits = (s: string) => s.replace(EASTERN, (d) => String((d.charCodeAt(0) & 0xf) % 10));

/** Returns +9647XXXXXXXXX, or null when the input isn't an Iraqi mobile number. */
export function normalizeIraqiPhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  let s = toLatinDigits(input).replace(/[\s\-().‎‏]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('964')) s = s.slice(3);
  if (s.startsWith('0')) s = s.slice(1);
  return /^7\d{9}$/.test(s) ? `+964${s}` : null;
}

export const isCanonicalIraqiPhone = (s: string) => /^\+9647\d{9}$/.test(s);

/** "+9647701234567" → "0770 123 4567" (how Iraqis write it) */
export const formatIraqiPhone = (e164: string) =>
  isCanonicalIraqiPhone(e164) ? `0${e164.slice(4, 7)} ${e164.slice(7, 10)} ${e164.slice(10)}` : e164;

/** "+9647701234567" → "0770 ••• ••67" */
export const maskPhone = (e164: string) => (isCanonicalIraqiPhone(e164) ? `0${e164.slice(4, 7)} ••• ••${e164.slice(-2)}` : '•••');

// Better Auth needs an email on every user. People who sign up with a phone get a placeholder that is never shown
// and can never receive mail (the .invalid top-level domain is reserved for exactly this).
export const PHONE_EMAIL_DOMAIN = 'phone.hemlohq.invalid';
export const placeholderEmail = (e164: string) => `p${e164.replace(/\D/g, '')}@${PHONE_EMAIL_DOMAIN}`;
export const isPlaceholderEmail = (email?: string | null) => !!email && email.endsWith(`@${PHONE_EMAIL_DOMAIN}`);
