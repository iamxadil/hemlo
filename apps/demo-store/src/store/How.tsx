// "How does your store work?" — the page Hemlo Studio's clients read before they buy: the three parts of an online
// store (what customers see, where the owner changes things, what it connects to), who looks after what, and the
// photographers behind every picture in this demo.
import { useEffect } from 'preact/hooks';
import { CREDITS } from '../data/photo-credits';
import { lang } from '../lib/i18n';
import { observeReveals } from '../lib/motion';
import { warmProps } from '../lib/preload';
import { Icon, Img, type IconName } from '../ui/kit';

const C = {
  ar: {
    kicker: 'كيف يعمل متجرك؟', title: 'ثلاثة أجزاء.\nوأنت تتحكم بالأهم.',
    sub: 'كل متجر إلكتروني نبنيه يتكوّن من ثلاثة أجزاء تعمل معاً. هذا المتجر التجريبي يعمل بالطريقة نفسها: غيّر أي شيء في لوحة التحكم وشاهده في المتجر فوراً.',
    store: ['١ · المتجر', 'ما يراه زبائنك', 'الصفحة الرئيسية، الأقسام، صفحة لكل منتج، السلة والطلب. سريع على الهاتف، بالعربية والإنجليزية، ويظهر في جوجل.'],
    panel: ['٢ · لوحة التحكم', 'حيث تغيّر ما تشاء، بنفسك', 'تضيف منتجاً بصوره وسعره وكميته، تغيّر صور الواجهة والعروض، تنشئ كود خصم، وتتابع الطلبات من «جديد» إلى «وصل». بدون مبرمج.'],
    links: ['٣ · الربط', 'ما يتصل به متجرك', 'نربطها نحن مرة واحدة، وتعمل وحدها.'],
    services: [['shield', 'الدفع الإلكتروني'], ['truck', 'شركات التوصيل'], ['whatsapp', 'طلبات واتساب'], ['chart', 'إحصاءات الزوار'], ['search', 'جوجل'], ['image', 'إنستغرام']] as [IconName, string][],
    mock: { title: 'نفحة نوار', price: 'السعر', stock: 'الكمية', live: 'معروض في المتجر', save: 'حفظ' },
    flowTitle: 'رحلة طلب واحد', flow: ['الزبون يضيف عطراً للسلة', 'يدفع أو يختار الدفع عند الاستلام', 'يظهر الطلب في لوحتك فوراً', 'تجهّزه وتسلّمه للمندوب', 'الزبون يتابع حالة طلبه'],
    youTitle: 'أنت تغيّر', you: ['المنتجات والأسعار والكميات', 'صور الواجهة والإعلانات', 'أكواد الخصم والعروض', 'حالة كل طلب', 'اسم المتجر وألوانه ورسوم التوصيل'],
    weTitle: 'ونحن نتولّى', we: ['الاستضافة والسرعة والأمان', 'النسخ الاحتياطي', 'ربط الدفع والتوصيل وواتساب', 'التحديثات والإصلاحات', 'أي ميزة جديدة تحتاجها'],
    try: 'جرّب لوحة التحكم', back: 'العودة للمتجر', credits: 'التصوير', creditsSub: 'كل صورة في هذا المتجر التجريبي صورة حقيقية من Unsplash. شكراً لـ:',
  },
  en: {
    kicker: 'How does your store work?', title: 'Three parts.\nYou control the one that matters.',
    sub: 'Every online store we build has three parts working together. This demo store works exactly the same way: change anything in the control panel and watch the store update.',
    store: ['1 · The store', 'What your customers see', 'The home page, categories, a page for every product, the bag and checkout. Fast on phones, in Arabic and English, and found on Google.'],
    panel: ['2 · The control panel', 'Where you change anything, yourself', 'Add a product with its photos, price and stock, change the home banners and offers, create a discount code, and move orders from “new” to “delivered”. No developer needed.'],
    links: ['3 · The connections', 'What your store talks to', 'We connect them once; they run by themselves.'],
    services: [['shield', 'Online payments'], ['truck', 'Delivery companies'], ['whatsapp', 'WhatsApp orders'], ['chart', 'Visitor analytics'], ['search', 'Google'], ['image', 'Instagram']] as [IconName, string][],
    mock: { title: 'Nafha Noir', price: 'Price', stock: 'Stock', live: 'Shown in the store', save: 'Save' },
    flowTitle: 'The journey of one order', flow: ['A customer adds a perfume to the bag', 'Pays, or chooses cash on delivery', 'The order appears in your panel at once', 'You prepare it and hand it to the courier', 'The customer follows their order'],
    youTitle: 'You change', you: ['Products, prices and stock', 'Home banners and announcements', 'Discount codes and offers', 'Each order’s status', 'The store’s name, colours and delivery fee'],
    weTitle: 'We look after', we: ['Hosting, speed and security', 'Backups', 'Payments, delivery and WhatsApp links', 'Updates and fixes', 'Any new feature you need'],
    try: 'Try the control panel', back: 'Back to the store', credits: 'Photography', creditsSub: 'Every picture in this demo store is a real photograph from Unsplash. Thank you to:',
  },
};

/** A small drawing of the control panel: a price being changed and a switch turning on, on a loop. */
function PanelMock({ m }: { m: (typeof C)['en']['mock'] }) {
  return (
    <div class="mock" aria-hidden="true">
      <div class="mock-bar"><i /><i /><i /></div>
      <div class="mock-body">
        <div class="mock-row"><Img pic="photo:noir" ratio="1 / 1" sizes="64px" /><b>{m.title}</b></div>
        <div class="mock-field"><small>{m.price}</small><span class="mock-price"><s>85,000</s><b>99,000</b></span></div>
        <div class="mock-field"><small>{m.stock}</small><span>24</span></div>
        <div class="mock-switch"><span class="mock-toggle" /><small>{m.live}</small></div>
        <span class="mock-save">{m.save}</span>
      </div>
    </div>
  );
}

export default function How() {
  const c = C[lang.value];
  useEffect(() => {
    observeReveals();
    if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' }));
  }, [lang.value]);
  return (
    <div class="how">
      <header class="how-hero" data-tone="dark">
        <Img pic="photo:atelier" ratio="auto" eager sizes="100vw" alt="" />
        <span class="how-shade" />
        <div class="wrap how-hero-copy">
          <p class="eyebrow">{c.kicker}</p>
          <h1 class="display">{c.title.split('\n').map((l) => <span>{l}</span>)}</h1>
          <p>{c.sub}</p>
        </div>
      </header>

      <section class="wrap how-parts">
        <article class="how-part rv">
          <div class="how-visual"><Img pic="photo:cat-perfumes" ratio="auto" sizes="(min-width: 900px) 33vw, 100vw" alt="" /></div>
          <p class="eyebrow">{c.store[0]}</p><h2>{c.store[1]}</h2><p>{c.store[2]}</p>
        </article>
        <article class="how-part rv" style={{ '--d': 1 }}>
          <div class="how-visual mock-wrap"><PanelMock m={c.mock} /></div>
          <p class="eyebrow">{c.panel[0]}</p><h2>{c.panel[1]}</h2><p>{c.panel[2]}</p>
        </article>
        <article class="how-part rv" style={{ '--d': 2 }}>
          <div class="how-visual services">{c.services.map(([ic, label], k) => <span style={{ '--d': k }}><Icon n={ic} />{label}</span>)}</div>
          <p class="eyebrow">{c.links[0]}</p><h2>{c.links[1]}</h2><p>{c.links[2]}</p>
        </article>
      </section>

      <section class="wrap how-flow">
        <h2 class="display rv">{c.flowTitle}</h2>
        <ol>{c.flow.map((x, i) => <li class="rv" style={{ '--d': i }}><span class="num">{i + 1}</span>{x}</li>)}</ol>
      </section>

      <section class="wrap how-split">
        <div class="rv"><h2 class="display">{c.youTitle}</h2><ul>{c.you.map((x) => <li><Icon n="check" />{x}</li>)}</ul></div>
        <div class="rv" style={{ '--d': 1 }}><h2 class="display">{c.weTitle}</h2><ul>{c.we.map((x) => <li><Icon n="check" />{x}</li>)}</ul></div>
      </section>

      <section class="wrap how-end">
        <a href="/admin" class="btn btn-accent btn-lg" {...warmProps}>{c.try}</a>
        <a href="/" class="btn btn-line btn-lg">{c.back}</a>
      </section>

      <section class="wrap credits" id="credits">
        <h2 class="display">{c.credits}</h2>
        <p class="muted">{c.creditsSub}</p>
        <ul>{CREDITS.map((c) => <li><a href={c.url} target="_blank" rel="noopener" dir="ltr">{c.name}</a></li>)}</ul>
      </section>
    </div>
  );
}
