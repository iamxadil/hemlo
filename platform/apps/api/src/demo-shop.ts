// The demo shop's add-ons, on: Hemlo Website as an online store (most of the shelf online, delivery and pickup), a few
// online orders at different steps, and Hemlo Connect in its sandbox with the chats a shop has (a customer asking
// a price, an order update, a debt reminder). Written with the shop's own rows, in the same statement.
import { newId } from '@hemlo/core';
import { connectChannel, connectConversation, connectMessage, connectRecipe, hemloAddonEntitlement, hemloSubscription, shopOrder, shopOrderLine, webPage, webSite } from '@hemlo/db/schema';
import { starterPages } from './routes/website';
import { productSlug } from './routes/systems';
import type { Batch } from './demo-data';

const HOUR = 3600_000, DAY = 24 * HOUR;
export type ShopGrants = { grants: { id: string; price: number }[]; subdomain: string };

/** products and customers are the demo's own rows (they get their online fields here, before they're written). */
export function shopAddOns(org: string, userId: string, lang: 'ar' | 'en', products: any[], customers: any[], x: ShopGrants): Batch[] {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const at = (days: number, hour: number, min = 0) => new Date(Date.now() - ((Date.now() + 3 * HOUR) % DAY) + days * DAY + (hour - 3) * HOUR + min * 60_000);
  // what's sold by the piece goes online (loose produce stays in the shop)
  for (const p of products) { p.slug = productSlug(p.name, p.id); p.online = p.unit !== 'kg' && p.trackStock; }
  const name = { ar: 'ماركت النور', en: 'Al-Noor Market' };
  const site = { id: newId(), organizationId: org, vertical: 'store', status: 'setup', lang, name, subdomain: x.subdomain, createdBy: userId,
    tagline: { ar: 'كل حاجات بيتك، توصلك لباب البيت في بغداد.', en: 'Everything for your home, delivered to your door in Baghdad.' },
    about: { ar: 'ماركت عائلي في الكرادة منذ 2009. أسعارنا كما في المحل، والتوصيل خلال ساعتين داخل بغداد.', en: 'A family market in Karrada since 2009. Shop prices online too, and delivery within two hours in Baghdad.' },
    theme: { accent: '#A8532E' },
    settings: { contact: { phone: '+9647701230099', whatsapp: '+9647701230099', address: L('الكرادة، شارع 62، بغداد', 'Karrada, 62nd Street, Baghdad') }, cta: { whatsapp: true, phone: true },
      shop: { delivery: true, pickup: true, fee: 3000, freeOver: 50000, minOrder: 5000, cities: [L('بغداد', 'Baghdad')], note: { ar: 'نوصّل خلال ساعتين داخل بغداد.', en: 'We deliver within two hours in Baghdad.' } } },
    createdAt: at(-2, 11), updatedAt: at(-2, 12) };
  const pages = starterPages('store', name).map((p) => ({ id: newId(), organizationId: org, websiteId: site.id, createdBy: userId, ...p }));

  // three orders: one just in, one on its way, one delivered yesterday
  const online = products.filter((p) => p.online);
  const orders: any[] = [], lines: any[] = [];
  const order = (n: number, status: string, cu: { name: string; phone: string }, items: [number, number][], when: Date, delivery: 'delivery' | 'pickup' = 'delivery') => {
    const id = newId(), ls = items.map(([i, q]) => { const p = online[i % online.length]; return { id: newId(), organizationId: org, orderId: id, productId: p.id, name: p.name, qty: q, price: p.price, total: q * p.price }; });
    const subtotal = ls.reduce((s, l) => s + l.total, 0), fee = delivery === 'delivery' && subtotal < 50000 ? 3000 : 0;
    orders.push({ id, organizationId: org, number: n, code: `demo${n}${org.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`, status, name: cu.name, phone: cu.phone, delivery, city: delivery === 'delivery' ? L('بغداد', 'Baghdad') : null,
      area: delivery === 'delivery' ? L('الكرادة', 'Karrada') : null, address: delivery === 'delivery' ? L('قرب جامع الأخوين', 'Near Al-Akhawain mosque') : null, subtotal, deliveryFee: fee, total: subtotal + fee, lang,
      customerId: (cu as any).id ?? null, createdAt: when, updatedAt: when, confirmedAt: status === 'new' ? null : when, deliveredAt: status === 'delivered' ? new Date(+when + 2 * HOUR) : null });
    lines.push(...ls);
  };
  const nowH = Math.max(9, Math.floor(((Date.now() + 3 * HOUR) % DAY) / HOUR) - 1);
  order(3, 'new', { name: L('زينب حسن', 'Zainab Hassan'), phone: '+9647709871234' }, [[0, 6], [9, 1], [15, 2]], at(0, nowH, 10));
  order(2, 'out', customers[3], [[4, 12], [12, 1], [24, 3]], at(0, Math.max(9, nowH - 2)));
  order(1, 'delivered', customers[1], [[7, 2], [16, 2], [19, 1]], at(-1, 17), 'delivery');

  // WhatsApp, in the sandbox: who wrote and who answered
  const convs: any[] = [], msgs: any[] = [];
  type M = [by: 'customer' | 'ai' | 'automation' | 'agent', text: string, minutes: number, recipe?: string];
  const chat = (phone: string, nm: string, customerId: string | null, when: Date, ms: M[], o: { unread?: number; handoff?: boolean } = {}) => {
    const id = newId(), start = +when; let last = when, lastIn: Date | null = null;
    for (const [by, text, min, recipe] of ms) {
      last = new Date(start + min * 60_000); if (by === 'customer') lastIn = last;
      msgs.push({ id: newId(), organizationId: org, conversationId: id, direction: by === 'customer' ? 'in' : 'out', author: by, userId: by === 'agent' ? userId : null,
        kind: recipe ? 'template' : 'text', body: text, recipe: recipe ?? null, status: by === 'customer' ? 'received' : 'read', createdAt: last });
    }
    convs.push({ id, organizationId: org, phone, name: nm, customerId, handoff: !!o.handoff, unread: o.unread ?? 0, lastMessageAt: last, lastInboundAt: lastIn, preview: ms[ms.length - 1][1].slice(0, 120), createdAt: when });
  };
  const tea = products.find((p) => /tea|شاي/i.test(p.name)) ?? online[0], nido = products.find((p) => /nido|نيدو/i.test(p.name)) ?? online[1];
  const iqd = (n: number) => `${n.toLocaleString('en-US')} ${L('د.ع', 'IQD')}`;
  chat('+9647715550188', L('مصطفى رعد', 'Mustafa Raad'), null, at(0, Math.max(9, nowH - 1)), [
    ['customer', L(`عندكم ${nido.name}؟ وكم سعره؟`, `Do you have ${nido.name}? How much is it?`), 0],
    ['ai', L(`أهلاً بك. نعم، متوفر الآن. تقدر تطلبه من موقعنا والدفع عند الاستلام، والتوصيل داخل بغداد خلال ساعتين.\n\n▫️ ${nido.name} · ${iqd(nido.price)}`, `Hello! Yes, it's in stock. You can order it on our website with cash on delivery, and we deliver in Baghdad within two hours.\n\n▫️ ${nido.name} · ${iqd(nido.price)}`), 0.2],
    ['customer', L('تمام، وإذا أخذت كرتونة؟', 'Great, and if I take a whole box?'), 4],
  ], { unread: 1, handoff: true });
  chat(customers[3].phone, customers[3].name, customers[3].id, at(0, Math.max(9, nowH - 2), 5), [
    ['automation', L(`مرحباً ${customers[3].name}، معك ماركت النور. طلبك رقم 2: خرج للتوصيل وسيصلك قريباً.`, `Hello ${customers[3].name}, this is Al-Noor Market. Your order number 2: on its way to you.`), 0, 'order_update'],
    ['customer', L('شكراً، أنا بالبيت', 'Thanks, I’m home'), 6],
  ]);
  chat(customers[0].phone, customers[0].name, customers[0].id, at(-2, 11), [
    ['automation', L(`مرحباً ${customers[0].name}، معك ماركت النور. نذكّرك بأن المتبقي على حسابك ${iqd(15000)}.`, `Hello ${customers[0].name}, this is Al-Noor Market. A reminder that the balance on your account is ${iqd(15000)}.`), 0, 'debt_reminder'],
    ['customer', L('إن شاء الله أمرّ عليكم الخميس وأسدّد', 'I’ll come by on Thursday and pay, God willing'), 35],
    ['agent', L('تدلّل أم علي، بانتظارك', 'Of course, Umm Ali, see you then'), 50],
  ]);
  void tea;

  return [
    [hemloSubscription, [{ organizationId: org, edition: 'store', status: 'trial', trialEndsAt: at(30, 12) }]],
    [hemloAddonEntitlement, x.grants.map((g) => ({ id: newId(), organizationId: org, addonId: g.id, edition: 'store', status: 'active', billing: 'month', price: g.price, updatedBy: 'demo' }))],
    [webSite, [site]], [webPage, pages],
    [shopOrder, orders], [shopOrderLine, lines],
    [connectChannel, [{ organizationId: org, provider: 'sandbox', status: 'connected', ai: true, persona: { hours: L('كل يوم، 8 صباحاً إلى 11 مساءً', 'Every day, 8 am to 11 pm') }, connectedAt: at(-5, 10) }]],
    [connectRecipe, ['instant_reply', 'order_update', 'debt_reminder'].map((key) => ({ organizationId: org, key, enabled: true, settings: {} }))],
    [connectConversation, convs], [connectMessage, msgs],
  ];
}
