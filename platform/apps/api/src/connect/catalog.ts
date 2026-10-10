// What Connect sells and sends: the two plans, the automations (recipes), and the WhatsApp message templates each one
// uses to start a conversation. Templates are written once here, in Arabic and English; Hemlo submits them to the
// business's WhatsApp account when it connects, and an automation only sends once its template is approved.
// (WhatsApp's rule: a business may write freely only within 24 hours of the customer's last message; outside that
// window, only an approved template. No variable may open or close a template, so each one ends in fixed words.)
import type { ConnectRecipeKey } from '@hemlo/db/schema';
import type { WaTemplateDef } from './wa';

export const PLAN_CODES = ['connect', 'connect-pro'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
/** Per month. "messages" are the ones Hemlo starts (reminders, alerts, reports); replies inside a chat are free. */
export const LIMITS: Record<PlanCode, { messages: number; ai: number }> = {
  connect: { messages: 500, ai: 0 },
  'connect-pro': { messages: 2000, ai: 1500 },
};

export type Recipe = { key: ConnectRecipeKey; plan: PlanCode; template: string | null; on: boolean; marketing?: boolean };
export const RECIPES: Recipe[] = [
  { key: 'instant_reply', plan: 'connect', template: 'hemlo_inquiry_reply', on: true },
  { key: 'viewing_reminder', plan: 'connect', template: 'hemlo_viewing_reminder', on: true },
  { key: 'viewing_followup', plan: 'connect', template: 'hemlo_viewing_followup', on: true },
  { key: 'new_listing', plan: 'connect', template: 'hemlo_new_listing', on: false, marketing: true },
  { key: 'rent_due', plan: 'connect', template: 'hemlo_rent_due', on: false },
  { key: 'cold_lead', plan: 'connect-pro', template: 'hemlo_cold_lead', on: false, marketing: true },
  { key: 'owner_report', plan: 'connect-pro', template: 'hemlo_owner_report', on: false },
];
export const recipeOf = (key: string) => RECIPES.find((r) => r.key === key);
export const planAllows = (plan: PlanCode | null, recipe: Recipe) => !!plan && (recipe.plan === 'connect' || plan === 'connect-pro');

type T = { category: 'UTILITY' | 'MARKETING'; ar: string; en: string; example: { ar: string[]; en: string[] } };
export const TEMPLATES: Record<string, T> = {
  hemlo_inquiry_reply: { category: 'UTILITY',
    ar: 'مرحباً {{1}}، شكراً لتواصلك مع {{2}}. وصلنا طلبك عن {{3}} وسيتواصل معك أحد مستشارينا قريباً. يمكنك الرد على هذه الرسالة بأي سؤال.',
    en: 'Hello {{1}}, thank you for contacting {{2}}. We received your request about {{3}} and one of our advisers will contact you shortly. You can reply to this message with any question.',
    example: { ar: ['أحمد', 'دار النخيل للعقارات', 'فيلا في دريم ستي'], en: ['Ahmed', 'Nakheel Real Estate', 'a villa in Dream City'] } },
  hemlo_viewing_reminder: { category: 'UTILITY',
    ar: 'مرحباً {{1}}، معك {{2}}. نذكّرك بموعد معاينة {{3}} في {{4}}. للتأكيد أو تغيير الموعد يرجى الرد على هذه الرسالة.',
    en: 'Hello {{1}}, this is {{2}}. A reminder of your viewing of {{3}} on {{4}}. Please reply to this message to confirm or change the time.',
    example: { ar: ['أحمد', 'دار النخيل للعقارات', 'فيلا في دريم ستي', 'السبت 5:00 م'], en: ['Ahmed', 'Nakheel Real Estate', 'a villa in Dream City', 'Saturday 5:00 PM'] } },
  hemlo_viewing_followup: { category: 'UTILITY',
    ar: 'مرحباً {{1}}، معك {{2}}. شكراً لمعاينة {{3}}. ما رأيك فيه؟ إن أعجبك نرتّب الخطوة التالية، وإن لم يناسبك نرسل لك خيارات أقرب لما تبحث عنه.',
    en: 'Hello {{1}}, this is {{2}}. Thank you for viewing {{3}}. What did you think? If you liked it we will arrange the next step, and if not we will send options closer to what you want.',
    example: { ar: ['أحمد', 'دار النخيل للعقارات', 'فيلا في دريم ستي'], en: ['Ahmed', 'Nakheel Real Estate', 'a villa in Dream City'] } },
  hemlo_new_listing: { category: 'MARKETING',
    ar: 'مرحباً {{1}}، معك {{2}}. وصلنا عقار جديد يناسب ما تبحث عنه: {{3}} بسعر {{4}}. الصور والتفاصيل: {{5}} ردّ على هذه الرسالة لترتيب معاينة.',
    en: 'Hello {{1}}, this is {{2}}. A new listing matches what you are looking for: {{3}} at {{4}}. Photos and details: {{5}} Reply to this message to arrange a viewing.',
    example: { ar: ['أحمد', 'دار النخيل للعقارات', 'فيلا 4 غرف في دريم ستي', '$240,000', 'https://hemlohq.com/p/villa-a1b2c3'], en: ['Ahmed', 'Nakheel Real Estate', 'a 4-bedroom villa in Dream City', '$240,000', 'https://hemlohq.com/p/villa-a1b2c3'] } },
  hemlo_cold_lead: { category: 'MARKETING',
    ar: 'مرحباً {{1}}، معك {{2}}. هل ما زلت تبحث عن {{3}}؟ لدينا عروض جديدة قد تناسبك، ردّ بكلمة نعم ونرسلها لك.',
    en: 'Hello {{1}}, this is {{2}}. Are you still looking for {{3}}? We have new listings that may suit you. Reply yes and we will send them.',
    example: { ar: ['أحمد', 'دار النخيل للعقارات', 'فيلا في دريم ستي'], en: ['Ahmed', 'Nakheel Real Estate', 'a villa in Dream City'] } },
  hemlo_owner_report: { category: 'UTILITY',
    ar: 'مرحباً {{1}}، معك {{2}}. تقرير عقارك {{3}} خلال الشهر الماضي: {{4}} مشاهدة، {{5}} تواصل، {{6}} معاينة. التقرير الكامل: {{7}} شكراً لثقتك بنا.',
    en: 'Hello {{1}}, this is {{2}}. Your property {{3}} last month: {{4}} views, {{5}} contacts, {{6}} viewings. The full report: {{7}} Thank you for trusting us.',
    example: { ar: ['حجي كمال', 'دار النخيل للعقارات', 'فيلا دريم ستي', '214', '18', '3', 'https://hemlohq.com/r/abc123'], en: ['Kamal', 'Nakheel Real Estate', 'Dream City villa', '214', '18', '3', 'https://hemlohq.com/r/abc123'] } },
  hemlo_rent_due: { category: 'UTILITY',
    ar: 'مرحباً {{1}}، معك {{2}}. تذكير بموعد دفعة إيجار {{3}} بتاريخ {{4}} بقيمة {{5}}. لأي استفسار يرجى الرد على هذه الرسالة.',
    en: 'Hello {{1}}, this is {{2}}. A reminder that the rent for {{3}} is due on {{4}}: {{5}}. Please reply to this message with any question.',
    example: { ar: ['أحمد', 'دار النخيل للعقارات', 'شقة عنكاوة', '2026-11-01', '$650'], en: ['Ahmed', 'Nakheel Real Estate', 'the Ankawa apartment', '2026-11-01', '$650'] } },
};

/** A template with its blanks filled: what the customer reads (shown in the inbox, and sent as text inside the 24-hour window). */
export const fill = (name: string, lang: 'ar' | 'en', params: string[]) =>
  (TEMPLATES[name]?.[lang] ?? '').replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? '');

/** Every template in both languages, as WhatsApp wants them submitted. */
export const templateDefs = (): WaTemplateDef[] => Object.entries(TEMPLATES).flatMap(([name, t]) =>
  (['ar', 'en'] as const).map((lang) => ({ name, category: t.category, lang, body: t[lang], example: t.example[lang] })));

/** "stop" in the ways people write it: the customer never gets an automatic message again. "start" undoes it. */
export const isStop = (s: string) => /^\s*(stop|unsubscribe|إيقاف|ايقاف|توقف|الغاء|إلغاء|الغاء الاشتراك|راوەستان)\s*[.!]?\s*$/i.test(s);
export const isStart = (s: string) => /^\s*(start|subscribe|اشتراك|ابدأ)\s*[.!]?\s*$/i.test(s);
