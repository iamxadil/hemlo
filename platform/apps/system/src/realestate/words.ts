// Amounts in words, as contracts write them: «فقط مئة وخمسة وثمانون ألف دولار أمريكي لا غير» /
// "One hundred eighty-five thousand US dollars only". Whole amounts up to the trillions.

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
// one, two, three to ten, eleven and up: ألف · ألفان · آلاف · ألف
const SCALES: [string, string, string][] = [['', '', ''], ['ألف', 'ألفان', 'آلاف'], ['مليون', 'مليونان', 'ملايين'], ['مليار', 'ملياران', 'مليارات'], ['ترليون', 'ترليونان', 'ترليونات']];

function arUnder1000(n: number) {
  const h = Math.floor(n / 100), rest = n % 100, parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest) parts.push(rest < 20 ? ONES[rest] : rest % 10 ? `${ONES[rest % 10]} و${TENS[Math.floor(rest / 10)]}` : TENS[Math.floor(rest / 10)]);
  return parts.join(' و');
}
function arWords(n: number) {
  if (n === 0) return 'صفر';
  const groups: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const g = n % 1000;
    if (!g) continue;
    if (i === 0) { groups.unshift(arUnder1000(g)); continue; }
    const [one, two, few] = SCALES[i];
    groups.unshift(g === 1 ? one : g === 2 ? two : g <= 10 ? `${arUnder1000(g)} ${few}` : `${arUnder1000(g)} ${one}`);
  }
  return groups.join(' و');
}

const E1 = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const E10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ESC = ['', 'thousand', 'million', 'billion', 'trillion'];
function enUnder1000(n: number) {
  const h = Math.floor(n / 100), rest = n % 100, parts: string[] = [];
  if (h) parts.push(`${E1[h]} hundred`);
  if (rest) parts.push(rest < 20 ? E1[rest] : `${E10[Math.floor(rest / 10)]}${rest % 10 ? `-${E1[rest % 10]}` : ''}`);
  return parts.join(' ');
}
function enWords(n: number) {
  if (n === 0) return 'zero';
  const groups: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) { const g = n % 1000; if (g) groups.unshift(`${enUnder1000(g)}${ESC[i] ? ` ${ESC[i]}` : ''}`); }
  return groups.join(' ');
}

/** The amount in words with its currency, the way it is written under the figure in a contract. */
export function inWords(n: number | null | undefined, currency: string, lang: 'ar' | 'en' | string) {
  if (n == null || !Number.isFinite(n) || n < 0) return '';
  const v = Math.round(n);
  if (lang === 'en') { const w = enWords(v); return `${w[0].toUpperCase()}${w.slice(1)} ${currency === 'USD' ? 'US dollars' : 'Iraqi dinars'} only`; }
  return `فقط ${arWords(v)} ${currency === 'USD' ? 'دولار أمريكي' : 'دينار عراقي'} لا غير`;
}
