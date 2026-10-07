// تفقيط: amounts in words, Arabic and English, for Iraqi dinars and US dollars.
// Arabic follows the form used on Iraqi invoices and cheques:
//   1,250,000 IQD -> "فقط مليون ومئتان وخمسون ألف دينار عراقي لا غير"
// Works in the browser (window.Tafqit) and in Node (module.exports) for testing.
(function (root) {
  const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
  // scale words: [one, two, plural (3–10), singular for 11+]
  const SCALES = [
    null,
    ['ألف', 'ألفان', 'آلاف', 'ألف'],
    ['مليون', 'مليونان', 'ملايين', 'مليون'],
    ['مليار', 'ملياران', 'مليارات', 'مليار'],
    ['ترليون', 'ترليونان', 'ترليونات', 'ترليون'],
  ];

  // 1..999 in Arabic
  function below1000(n) {
    const h = Math.floor(n / 100), r = n % 100, parts = [];
    if (h) parts.push(HUNDREDS[h]);
    if (r) {
      if (r < 10) parts.push(ONES[r]);
      else if (r < 20) parts.push(TEENS[r - 10]);
      else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${ONES[o]} و${TENS[t]}` : TENS[t]); }
    }
    return parts.join(' و');
  }
  // a group (1..999) with its scale word
  function group(n, s) {
    if (s === 0) return below1000(n);
    const w = SCALES[s];
    if (n === 1) return w[0];
    if (n === 2) return w[1];
    if (n >= 3 && n <= 10) return `${below1000(n)} ${w[2]}`;
    return `${below1000(n)} ${w[3]}`;
  }
  function arInt(n) {
    if (n === 0) return 'صفر';
    const groups = [];
    let s = 0;
    while (n > 0) { const g = n % 1000; if (g) groups.unshift(group(g, s)); n = Math.floor(n / 1000); s++; }
    return groups.join(' و');
  }

  const CUR = {
    IQD: { ar: 'دينار عراقي', arSub: 'فلس', en: ['Iraqi dinar', 'Iraqi dinars'], enSub: ['fils', 'fils'], dec: 3 },
    USD: { ar: 'دولار أمريكي', arSub: 'سنت', en: ['US dollar', 'US dollars'], enSub: ['cent', 'cents'], dec: 2 },
  };

  function splitAmount(amount, currency) {
    const c = CUR[currency] || CUR.IQD;
    const factor = Math.pow(10, c.dec);
    const total = Math.round(Math.abs(Number(amount) || 0) * factor);
    return { whole: Math.floor(total / factor), sub: total % factor, c };
  }

  function ar(amount, currency = 'IQD') {
    const { whole, sub, c } = splitAmount(amount, currency);
    let s = `فقط ${arInt(whole)} ${c.ar}`;
    if (sub) s += ` و${arInt(sub)} ${c.arSub}`;
    return s + ' لا غير';
  }

  // English
  const E1 = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const E10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const ESC = ['', 'thousand', 'million', 'billion', 'trillion'];
  function enBelow1000(n) {
    const h = Math.floor(n / 100), r = n % 100, parts = [];
    if (h) parts.push(`${E1[h]} hundred`);
    if (r) parts.push(r < 20 ? E1[r] : E10[Math.floor(r / 10)] + (r % 10 ? '-' + E1[r % 10] : ''));
    return parts.join(' and ');
  }
  function enInt(n) {
    if (n === 0) return 'zero';
    const out = []; let s = 0;
    while (n > 0) { const g = n % 1000; if (g) out.unshift(enBelow1000(g) + (ESC[s] ? ' ' + ESC[s] : '')); n = Math.floor(n / 1000); s++; }
    return out.join(', ');
  }
  function en(amount, currency = 'IQD') {
    const { whole, sub, c } = splitAmount(amount, currency);
    let s = `${enInt(whole)} ${whole === 1 ? c.en[0] : c.en[1]}`;
    if (sub) s += ` and ${enInt(sub)} ${sub === 1 ? c.enSub[0] : c.enSub[1]}`;
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s + ' only';
  }

  const api = { ar, en, arInt, enInt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tafqit = api;
})(typeof window !== 'undefined' ? window : globalThis);
