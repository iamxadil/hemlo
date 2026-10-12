// The public sample of Hemlo Website (business.hemlohq.com/s/sample): the demo agency's homes, rendered by the very same
// renderer and design a customer gets, so what the marketing page shows can never drift from the product. Nothing is
// read from or written to the database; an inquiry on the sample goes nowhere.
import { LISTINGS } from '../../demo-realestate';
import { priceText } from '../realestate/common';
import type { WebsiteListing, WebsiteListingFilter, WebsiteProperty } from './adapters';
import type { Lang } from './theme';

export const SAMPLE_SUB = 'sample';
const AREA_AR: Record<string, string> = {
  'Dream City': 'دريم ستي', 'English Village': 'القرية الإنكليزية', 'Italian Village': 'القرية الإيطالية', 'Empire World': 'إمباير وورلد', Gulan: 'كولان',
  Ankawa: 'عنكاوة', '100m Street': 'شارع 100', Kasnazan: 'كسنزان', Shaqlawa: 'شقلاوة', Zayouna: 'زيونة', Mansour: 'المنصور',
};
const CITY_AR: Record<string, string> = { Erbil: 'أربيل', Baghdad: 'بغداد' };
const slugOf = (key: string, type: string) => `${type}-${key}`.replace(/[^a-z0-9-]/g, '-');

// made-up clients for the sample office (the sample is labelled as such on every page)
const VOICES = [
  { quote: { ar: 'أرسلنا ما نريد على واتساب، وبعد يومين كنا نعاين بيتين يطابقان طلبنا تماماً. لا وقت ضائع.', en: 'We sent what we wanted on WhatsApp, and two days later we were viewing two homes that matched it exactly. No time wasted.' }, author: { ar: 'سارة م.', en: 'Sara M.' }, role: { ar: 'اشترت فيلا في دريم ستي', en: 'Bought a villa in Dream City' } },
  { quote: { ar: 'السعر الذي سمعناه في أول رسالة هو نفسه الذي كُتب في العقد. هذا نادر.', en: 'The price we heard in the first message was the price in the contract. That is rare.' }, author: { ar: 'كرار ح.', en: 'Karrar H.' }, role: { ar: 'استأجر شقة في عنكاوة', en: 'Rented an apartment in Ankawa' } },
  { quote: { ar: 'رافقونا من العربون حتى نقل الملكية، وكانوا يردّون حتى في المساء.', en: 'They stayed with us from the deposit to the transfer, and answered even in the evening.' }, author: { ar: 'زينب ع.', en: 'Zainab A.' }, role: { ar: 'اشترت بيتاً في المنصور', en: 'Bought a house in Mansour' } },
];

/** The site as the database would hold it, published. Arabic is its first language; English is ?lang=en, as on any site. */
export const sampleSite = (lang: Lang) => {
  const cfg = {
    lang: 'ar' as Lang, name: { ar: 'دار النخيل للعقارات', en: 'Nakheel Real Estate' },
    tagline: { ar: 'بيوت مختارة في أربيل وبغداد، بأسعار واضحة ومواعيد معاينة تناسبك.', en: 'Considered homes in Erbil and Baghdad, honestly priced, shown when it suits you.' },
    about: { ar: 'مكتب عائلي منذ 2009. لا نعرض إلا ما زرناه بأنفسنا، ونقول السعر كما هو، ونرتّب المعاينة حين تناسبك.', en: 'A family office since 2009. We only show homes we have walked through ourselves, we tell you the price as it is, and we arrange viewings when it suits you.' },
    theme: { accent: '#1F6F5C' }, settings: { contact: { phone: '+9647701234567', whatsapp: '+9647701234567', email: 'hello@nakheel.example', address: lang === 'ar' ? 'شارع 100، أربيل' : '100 Street, Erbil' }, cta: { whatsapp: true, phone: true, inquiry: true } },
    logoId: null, faviconId: null,
    pages: [
      { id: 's-home', slug: '', kind: 'home', sort: 0, title: { ar: 'الرئيسية', en: 'Home' }, seo: {}, sections: [{ id: 'h', type: 'hero' }, { id: 'l', type: 'listings' }, { id: 'a', type: 'about', title: { ar: 'من نحن', en: 'About us' } }, { id: 'v', type: 'testimonials', items: VOICES }, { id: 'c', type: 'contact' }] },
      { id: 's-about', slug: 'about', kind: 'about', sort: 1, title: { ar: 'من نحن', en: 'About us' }, seo: {}, sections: [{ id: 'a2', type: 'about', title: { ar: 'من نحن', en: 'About us' } }, { id: 'c2', type: 'contact' }] },
      { id: 's-contact', slug: 'contact', kind: 'contact', sort: 2, title: { ar: 'تواصل معنا', en: 'Contact' }, seo: {}, sections: [{ id: 'c3', type: 'contact' }] },
    ],
  };
  return { id: 'sample', organizationId: 'sample', vertical: 'realestate', status: 'published', subdomain: SAMPLE_SUB, ...cfg, publishedSnapshot: cfg };
};

type Row = { listing: WebsiteListing; property: WebsiteProperty; daysListed: number; price: number | null };
function rows(lang: Lang, photosAt: string, origin: string): Row[] {
  const at = `${photosAt.replace(/\/$/, '')}/demo/re/`;
  return LISTINGS.filter(([, , , status]) => status !== 'draft').map(([key, type, purpose, status, tAr, tEn, area, city, price, currency, size, land, beds, baths, floors, parking, year, , , features, photos, , daysListed, x = {}]) => {
    const slug = slugOf(key, type), title = lang === 'ar' ? tAr : tEn;
    const a = lang === 'ar' ? AREA_AR[area] ?? area : area, c = lang === 'ar' ? CITY_AR[city] ?? city : city;
    const text = priceText(price, currency, lang, purpose === 'rent' ? x.rentPeriod ?? 'month' : null);
    const listing: WebsiteListing = { slug, title, area: a, city: c, type, purpose, status, price: text, bedrooms: beds, bathrooms: baths, size, cover: `${at}${photos[0]}.webp`,
      href: `${origin}/properties/${slug}`, fresh: daysListed < 14 };
    const property: WebsiteProperty = { slug, title, type, purpose, status, price: text, currency, negotiable: true, city: c, area: a, size, land, bedrooms: beds, bathrooms: baths,
      floors, parking, yearBuilt: year, furnished: null, condition: null, features, description: x.desc ? { ar: x.desc[0], en: x.desc[1] } : {}, video: null, map: null,
      photos: photos.map((p) => ({ url: `${at}${p}.webp`, caption: null })) };
    return { listing, property, daysListed, price };
  });
}

/** The same filters and orders the real adapter applies, over the sample's homes. */
export function sampleListings(lang: Lang, photosAt: string, origin: string, f: WebsiteListingFilter = {}) {
  const has = (v: string | null | undefined, q: string) => !!v && v.toLowerCase().includes(q.toLowerCase());
  let out = rows(lang, photosAt, origin).filter(({ listing: l, price }) =>
    (!f.purpose || l.purpose === f.purpose) && (!f.type || l.type === f.type) && (!f.city || has(l.city, f.city)) && (!f.area || has(l.area, f.area))
    && (!f.place || has(l.area, f.place) || has(l.city, f.place) || has(AREA_AR[l.area ?? ''], f.place)) && (!f.q || has(l.title, f.q) || has(l.area, f.q) || has(l.city, f.q))
    && (!f.currency || f.currency === 'USD') && (f.min == null || (price ?? 0) >= f.min) && (f.max == null || (price ?? Infinity) <= f.max));
  out = f.sort === 'price-asc' ? out.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)) : f.sort === 'price-desc' ? out.sort((a, b) => (b.price ?? -1) - (a.price ?? -1)) : out.sort((a, b) => a.daysListed - b.daysListed);
  return out.slice(0, f.limit ?? 36).map((r) => r.listing);
}
export const sampleProperty = (lang: Lang, photosAt: string, origin: string, slug: string) => rows(lang, photosAt, origin).find((r) => r.listing.slug === slug)?.property ?? null;
