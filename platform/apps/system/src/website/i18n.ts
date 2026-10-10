// The Website add-on's words: Arabic first, English. Kurdish shows the Arabic until a native speaker writes it (like
// the other editions' Kurdish, it needs review before it goes out).
import { useApp } from '../lib/app';
import type { Lang } from '../lib/i18n';

const ar = {
  title: 'موقعك',
  sub: 'موقع جاهز لعملك، يُبنى من بياناتك في هيملو وتشاركه برابط واحد. بياناتك تبقى في هيملو دائماً.',
  off: {
    head: 'لم يُفعَّل موقعك بعد', cta: 'فعّل الموقع', working: 'يُجهَّز موقعك…',
    body: 'سنجهّز لك موقعاً أولياً من بيانات عملك: صفحة رئيسية، ومن نحن، وتواصل. تستطيع تعديل كل شيء بعدها.',
  },
  status: { not_enabled: 'غير مفعّل', setup: 'قيد الإعداد', draft: 'مسودة', published: 'منشور' } as Record<string, string>,
  live: { head: 'موقعك منشور', open: 'افتح الموقع', copy: 'انسخ الرابط', copied: 'نُسخ' },
  ready: { head: 'موقعك جاهز للمشاركة', body: 'اطّلع عليه، ثم انشره ليراه الناس.' },
  preview: 'معاينة',
  publish: 'انشر الموقع', publishChanges: 'انشر التعديلات', draftNotice: 'لديك تعديلات محفوظة لم تُنشر بعد.', unpublish: 'أوقف النشر', publishing: 'يُنشر…', published: 'نُشر موقعك', unpublished: 'أُوقف النشر',
  needsHome: 'أضف الصفحة الرئيسية قبل النشر.',
  identity: 'الهوية', name: 'اسم الموقع', tagline: 'سطر تعريفي', about: 'نبذة عن العمل', lang: 'لغة الموقع',
  langName: { ar: 'العربية', en: 'English' } as Record<string, string>,
  look: 'الشكل',
  themes: { classic: 'كلاسيكي', modern: 'عصري', minimal: 'بسيط', bold: 'جريء' } as Record<string, string>,
  accent: 'اللون الأساسي', dark: 'الوضع الليلي', radius: 'استدارة الحواف', fonts: { system: 'افتراضي', serif: 'مُذيّل', sans: 'عصري' } as Record<string, string>,
  contact: 'التواصل', phone: 'الهاتف', whatsapp: 'واتساب', email: 'البريد', address: 'العنوان', mapUrl: 'رابط الخريطة (اختياري)',
  social: 'حسابات التواصل الاجتماعي', instagram: 'إنستغرام', facebook: 'فيسبوك', tiktok: 'تيك توك', youtube: 'يوتيوب', x: 'إكس (تويتر)',
  actions: 'أزرار الإجراء', actionWa: 'زر واتساب', actionPhone: 'زر الاتصال', actionInquiry: 'نموذج استفسار',
  addressSec: 'عنوان الموقع', subdomain: 'الرابط', subdomainHint: 'سيكون موقعك متاحاً على هذا النطاق الفرعي ضمن hemlohq.com.',
  pages: 'الصفحات', addPage: 'صفحة جديدة', page: 'صفحة', pageTitle: 'عنوان الصفحة', pageKind: 'نوع الصفحة', slug: 'الرابط الفرعي', slugHint: 'اتركه فارغاً للصفحة الرئيسية.',
  kinds: { home: 'الرئيسية', about: 'من نحن', contact: 'تواصل', listings: 'العقارات', services: 'الخدمات', team: 'الفريق', faq: 'أسئلة شائعة', custom: 'مخصّصة' } as Record<string, string>,
  sections: '{n} أقسام', sectionsOne: 'قسم واحد', noSections: 'بلا أقسام',
  content: 'محتوى الصفحة', addSection: 'أضف قسماً', removeSection: 'احذف القسم', sectionType: 'نوع القسم', sectionTitle: 'عنوان القسم', sectionText: 'النص',
  seo: 'ظهور الصفحة في البحث', seoTitle: 'عنوان نتيجة البحث', seoDescription: 'وصف نتيجة البحث', noindex: 'لا تُظهر الصفحة في محركات البحث',
  edit: 'تعديل', done: 'تمّ', remove: 'حذف', removeQ: 'حذف هذه الصفحة نهائياً؟', save: 'حفظ', saved: 'حُفظ', cancel: 'إلغاء',
  emptyPages: 'لا صفحات بعد.', homeFixed: 'الرئيسية لا تُحذف.',
  errors: {
    SUBDOMAIN_TAKEN: 'هذا الرابط محجوز، جرّب غيره.', BAD_SUBDOMAIN: 'الرابط غير صالح: أحرف إنجليزية وأرقام وشرطات فقط.',
    NEEDS_HOME: 'أضف الصفحة الرئيسية قبل النشر.', PAGE_SLUG_TAKEN: 'يوجد صفحة بهذا الرابط.', PAGE_NOT_FOUND: 'الصفحة غير موجودة.',
    SITE_NOT_FOUND: 'الموقع غير موجود.', BAD_SLUG: 'رابط الصفحة غير صالح.', BAD_PHONE: 'تحقّق من رقم الهاتف.', BAD_EMAIL: 'تحقّق من البريد.',
    BAD_URL: 'تحقّق من الرابط (يبدأ بـ http).', BAD_TEXT: 'النص طويل جداً.', NOT_ALLOWED: 'ليست لديك صلاحية لهذا.',
  } as Record<string, string>,
};

const en: typeof ar = {
  title: 'Your website',
  sub: 'A ready site for your business, built from your Hemlo data and shared with one link. Your data always stays in Hemlo.',
  off: {
    head: 'Your website isn’t on yet', cta: 'Turn on the website', working: 'Setting up your site…',
    body: 'We’ll prepare a first version from your business data: a home page, an about page and contact. You can change everything after.',
  },
  status: { not_enabled: 'Off', setup: 'Setting up', draft: 'Draft', published: 'Published' },
  live: { head: 'Your website is live', open: 'Open the site', copy: 'Copy link', copied: 'Copied' },
  ready: { head: 'Your site is ready to share', body: 'Have a look, then publish it for people to see.' },
  preview: 'Preview',
  publish: 'Publish the site', publishChanges: 'Publish changes', draftNotice: 'You have saved changes that are not live yet.', unpublish: 'Take it down', publishing: 'Publishing…', published: 'Your site is live', unpublished: 'Taken down',
  needsHome: 'Add the home page before publishing.',
  identity: 'Identity', name: 'Site name', tagline: 'Tagline', about: 'About the business', lang: 'Site language',
  langName: { ar: 'العربية', en: 'English' },
  look: 'Look',
  themes: { classic: 'Classic', modern: 'Modern', minimal: 'Minimal', bold: 'Bold' },
  accent: 'Accent colour', dark: 'Dark mode', radius: 'Corner roundness', fonts: { system: 'Default', serif: 'Serif', sans: 'Sans' },
  contact: 'Contact', phone: 'Phone', whatsapp: 'WhatsApp', email: 'Email', address: 'Address', mapUrl: 'Map link (optional)',
  social: 'Social accounts', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', x: 'X (Twitter)',
  actions: 'Call-to-action buttons', actionWa: 'WhatsApp button', actionPhone: 'Call button', actionInquiry: 'Inquiry form',
  addressSec: 'Address', subdomain: 'Link', subdomainHint: 'Your site will be available at this subdomain under hemlohq.com.',
  pages: 'Pages', addPage: 'New page', page: 'Page', pageTitle: 'Page title', pageKind: 'Page kind', slug: 'Address', slugHint: 'Leave empty for the home page.',
  kinds: { home: 'Home', about: 'About', contact: 'Contact', listings: 'Listings', services: 'Services', team: 'Team', faq: 'FAQ', custom: 'Custom' },
  sections: '{n} sections', sectionsOne: '1 section', noSections: 'No sections',
  content: 'Page content', addSection: 'Add a section', removeSection: 'Remove section', sectionType: 'Section type', sectionTitle: 'Section title', sectionText: 'Text',
  seo: 'Search appearance', seoTitle: 'Search result title', seoDescription: 'Search result description', noindex: 'Hide this page from search engines',
  edit: 'Edit', done: 'Done', remove: 'Delete', removeQ: 'Delete this page for good?', save: 'Save', saved: 'Saved', cancel: 'Cancel',
  emptyPages: 'No pages yet.', homeFixed: 'The home page can’t be deleted.',
  errors: {
    SUBDOMAIN_TAKEN: 'That link is taken, try another.', BAD_SUBDOMAIN: 'That link isn’t valid: letters, numbers and hyphens only.',
    NEEDS_HOME: 'Add the home page before publishing.', PAGE_SLUG_TAKEN: 'There’s already a page at that address.', PAGE_NOT_FOUND: 'Page not found.',
    SITE_NOT_FOUND: 'Site not found.', BAD_SLUG: 'That page address isn’t valid.', BAD_PHONE: 'Check the phone number.', BAD_EMAIL: 'Check the email.',
    BAD_URL: 'Check the link (it starts with http).', BAD_TEXT: 'That text is too long.', NOT_ALLOWED: 'You don’t have permission for that.',
  },
};

export type WStrings = typeof ar;
export const WSTRINGS: Record<Lang, WStrings> = { ar, en, ckb: ar };
/** The Website add-on's words in the app's language, and an error message that knows its codes. */
export function useW() {
  const app = useApp();
  const w = WSTRINGS[app.lang];
  const err = (e: any) => (e?.code && w.errors[e.code]) || app.errorText(e);
  return { ...app, w, err };
}
