// Hemlo Studio copy, Arabic (default) and English. One page: the sentence, the receipt, the price list.
export type Lang = 'ar' | 'en';
export const EMAIL = 'hello@hemlohq.com';
export const MAIN = { ar: 'https://hemlohq.com/', en: 'https://hemlohq.com/en/' };
export const home = (lang: Lang) => (lang === 'ar' ? '/' : '/en/');

const ar = {
  meta: {
    title: 'هيملو ستوديو · قل ما تحتاجه، واعرف سعره',
    desc: 'مواقع ومتاجر وتطبيقات وأنظمة للشركات العراقية. اكتب ما تحتاجه بجملة واحدة وشاهد السعر بالدينار فوراً.',
  },
  nav: { build: 'احسب', prices: 'الأسعار', work: 'أعمالنا', how: 'كيف نعمل', write: 'راسلنا', switchTo: 'English' },

  hero: { eyebrow: 'هيملو ستوديو', title: 'قل لنا ما تحتاجه.<br>والسعر يظهر أمامك.' },
  fit: {
    what: 'ما هو؟', when: 'تحتاجه عندما', not: 'ليس لك إذا',
    whatBody: 'نبني لك شيئاً خاصاً بعملك: موقع، متجر إلكتروني، تطبيق، أو نظام مفصّل. تدفع مرة واحدة، وتملكه أنت.',
    whenList: ['تريد أن يجدك الزبائن على الإنترنت', 'تريد أن تبيع أونلاين وتستلم الطلبات', 'عملك له طريقة خاصة لا يناسبها أي برنامج جاهز'],
    notBody: 'إذا كان عملك متجراً أو ورشة أو عيادة، فغالباً يكفيك هيملو للأنظمة، وهو أرخص. وإذا احتجت فاتورة فقط، فأدوات هيملو مجانية.',
    systems: 'هيملو للأنظمة', tools: 'أدوات هيملو',
  },
  sentence: {
    need: 'أحتاج إلى',
    types: { website: 'موقع لشركتي', store: 'متجر إلكتروني', webapp: 'تطبيق ويب', mobile: 'تطبيق موبايل', system: 'نظام لإدارة عملي' },
    with: 'من',
    catalogue: { s: 'يعرض حتى 50 منتجاً', m: 'يعرض حتى 500 منتج', l: 'يعرض حتى 2,000 منتج' },
    complexity: { simple: 'بسيط', moderate: 'متوسط التعقيد', complex: 'معقّد' },
    integrations: ['يعمل وحده', 'يرتبط بنظام آخر', 'يرتبط بنظامين آخرين', 'يرتبط بـ 3 أنظمة أخرى', 'يرتبط بـ 4 أنظمة أخرى'],
    languages: ['بالعربية فقط', 'بالعربية والإنجليزية', 'بالعربية والإنجليزية والكردية'],
    also: 'وأريد أيضاً',
    extras: { cms: 'لوحة لتعديله بنفسي', blog: 'مدونة', booking: 'حجوزات أونلاين', payments: 'دفعاً إلكترونياً', copy: 'أن تكتبوا المحتوى', seo: 'تهيئة لمحركات البحث', brand: 'شعاراً وهوية', rush: 'تسليماً أسرع', accounts: 'حسابات وصلاحيات', reports: 'لوحات وتقارير', workflows: 'موافقات وسير عمل', notify: 'إشعارات واتساب' },
    after: 'وبعد الإطلاق،',
    care: { none: 'أتولّاه بنفسي', basic: 'تتولّاه هيملو (الرعاية الأساسية)', business: 'تتولّاه هيملو (رعاية الأعمال)', priority: 'تتولّاه هيملو (رعاية الأولوية)' },
    less: 'أقل', more: 'أكثر',
  },
  receipt: {
    title: 'تقدير سعر', no: 'رقم', total: 'المجموع', range: 'تقدير أولي، يُثبَّت بعد مكالمة قصيرة',
    then: 'ثم {x} شهرياً', ready: 'جاهز خلال', pay: 'على ثلاث دفعات', payParts: ['عند البدء', 'في المنتصف', 'عند التسليم'],
    send: 'أرسله لنا', copy: 'انسخ الرابط', copied: 'تم النسخ', pdf: 'احفظ PDF', usd: 'بالدولار', iqd: 'بالدينار',
    mailSubject: 'تقدير سعر من هيملو ستوديو', mailIntro: 'مرحباً، هذا ما أحتاجه:',
    lines: { website: 'موقع · {p}', store: 'متجر إلكتروني', catalogue_m: 'حتى 500 منتج', catalogue_l: 'حتى 2,000 منتج', webapp: 'تطبيق ويب', mobile: 'تطبيق موبايل', system: 'نظام أعمال', complexity_moderate: 'تعقيد متوسط ×1.3', complexity_complex: 'تعقيد عالٍ ×1.6', m_accounts: 'حسابات وصلاحيات', m_reports: 'لوحات وتقارير', m_workflows: 'موافقات وسير عمل', m_notify: 'إشعارات', integrations: 'ربط مع أنظمة · {n}', cms: 'لوحة إدارة المحتوى', blog: 'مدونة', copy: 'كتابة المحتوى · {p}', booking: 'حجوزات', payments: 'دفع إلكتروني', seo: 'محركات البحث', brand: 'شعار وهوية', languages: 'لغات إضافية · {n}', rush: 'تسليم أسرع' },
    weeks: 'أسابيع', days: 'يوماً', dock: 'السعر',
  },

  list: {
    title: 'قائمة الأسعار.', sub: 'كل الأسعار هنا، بالدينار. لا يوجد «تواصل معنا لمعرفة السعر».',
    from: 'من', perMonth: 'شهرياً', perPage: 'للصفحة', each: 'لكل ربط',
    websites: 'المواقع', firstPage: 'الصفحة الأولى، مع التصميم الكامل', extraPage: 'كل صفحة إضافية',
    cms: 'لوحة لتعديل المحتوى بنفسك', lang: 'كل لغة إضافية', blog: 'مدونة أو أخبار', booking: 'حجوزات أونلاين', payments: 'دفع إلكتروني (FIB، زين كاش، بطاقات)', copy: 'نكتب المحتوى', seo: 'تهيئة لمحركات البحث وخرائط Google', brand: 'شعار وهوية أساسية', rush: 'تسليم أسرع بنحو 30%',
    stores: 'المتاجر', storeNote: 'سلة، طلبات، لوحة إدارة، ودفع عند الاستلام.', catalogue: ['حتى 50 منتجاً', 'حتى 500 منتج', 'حتى 2,000 منتج'],
    apps: 'التطبيقات والأنظمة', appsNote: 'أسعار بداية، تُضرب ×1.3 للمتوسط و×1.6 للمعقّد.', types: ['تطبيق ويب', 'تطبيق موبايل (iOS و Android)', 'نظام أعمال'],
    modules: ['حسابات وصلاحيات', 'لوحات وتقارير', 'موافقات وسير عمل', 'إشعارات واتساب / SMS', 'ربط مع نظام آخر'],
    care: 'الرعاية بعد الإطلاق', careNote: 'ادفع 10 أشهر واحصل على 12.',
    carePlans: [['الأساسية', 'استضافة، SSL، نسخ احتياطي يومي، ومراقبة على مدار الساعة.'], ['الأعمال', 'كل ما سبق، وساعتا تعديلات شهرياً.'], ['الأولوية', 'كل ما سبق، و6 ساعات تعديلات، ورد في نفس اليوم.']],
  },

  afterLaunch: {
    title: 'ما بعد الإطلاق؟ ببساطة.',
    sub: 'الموقع مثل السيارة: بعد أن تستلمه، يحتاج وقوداً وصيانة وتأميناً حتى يبقى يعمل. هذا ما يحدث كل يوم دون أن تراه:',
    what: 'ما هو', without: 'بدون ذلك', all: 'في كل الخطط', some: 'الأعمال والأولوية', yearly: 'بسعره السنوي',
    items: [
      ['server', 'الاستضافة', 'المكان الذي «يسكن» فيه موقعك على الإنترنت، مثل إيجار المحل.', 'يختفي موقعك من الإنترنت.', 'all'],
      ['globe', 'النطاق', 'عنوان موقعك، مثل yourname.com. يُجدَّد كل سنة.', 'لا يصل إليك أحد، وقد يحجزه غيرك.', 'yearly'],
      ['lock', 'القفل (SSL)', 'القفل بجانب العنوان: يحمي بيانات زوّارك.', 'يحذّر المتصفح زوّارك أن موقعك «غير آمن».', 'all'],
      ['copy', 'النسخ الاحتياطي', 'نسخة كاملة من موقعك كل يوم.', 'إن حدث خطأ، يضيع كل شيء.', 'all'],
      ['pulse', 'المراقبة', 'نراقب موقعك ليلاً ونهاراً، ونصلحه إن توقف، غالباً قبل أن تلاحظ.', 'تعرف بالعطل من زبون غاضب.', 'all'],
      ['pencil', 'التعديلات', 'سعر جديد، صور جديدة، صفحة إضافية: نعدّلها لك.', 'تطلب كل تعديل وحده، وتنتظر دوره.', 'some'],
    ] as [string, string, string, string, 'all' | 'some' | 'yearly'][],
    must: 'هل يجب أن أشترك؟', mustBody: 'لا. الموقع ملكك، وتستطيع أن تتولّاه بنفسك أو مع أي جهة. فقط تذكّر أن أحداً يجب أن يقوم بكل ما سبق.',
    cta: 'شاهد خطط الرعاية وأسعارها', help: 'ما هذا؟',
  },

  work: {
    title: 'أعمالنا.', sub: 'متجر عميل كامل، ومتجر تجريبي تجرّبه بنفسك، وكل ما تعمل عليه هيملو، بُني بالمعيار نفسه الذي سنبني به مشروعك.',
    featured: {
      domain: 'alwafi.net', url: 'https://alwafi.net/ar/', name: 'الوافي للحاسبات', tag: 'عميل · متجر إلكتروني', visit: 'زر المتجر',
      desc: 'متجر إلكتروني كامل لمحل حاسبات في بغداد بخبرة ثلاثة عقود: لابتوبات وقطع وإكسسوارات، بالعربية والإنجليزية. يدير أصحابه كل منتج وسعر وعرض وصفحة من لوحة المحتوى الخاصة بهم، والمتجر مربوط بكل خدمة يحتاجها.',
      features: ['لوحة إدارة محتوى (CMS)', 'عربي وإنجليزي', 'حسابات العملاء وقائمة الأمنيات', 'سلة وطلبات وتتبّع الطلب', 'التقسيط', 'برنامج المسوّقين بالعمولة', 'صفحات العلامات والعروض', 'بحث سريع', 'واتساب', 'تحليلات الزوار', 'شبكة توزيع للصور', 'تهيئة لمحركات البحث'],
      alt: 'الصفحة الرئيسية لمتجر الوافي للحاسبات',
    },
    demo: {
      domain: 'demo.hemlohq.com', url: 'https://demo.hemlohq.com/?lang=ar', panelUrl: 'https://demo.hemlohq.com/admin?lang=ar', name: 'نفحة، متجر تجرّبه بنفسك', tag: 'تجربة حيّة · متجر ولوحة تحكم',
      desc: 'متجر عطور كامل مع لوحة تحكمه، بنيناه لتلمس كيف سيعمل متجرك قبل أن نبدأ. افتح اللوحة، غيّر سعراً أو صورة أو لون المتجر، وشاهد المتجر يتغيّر أمامك. اطلب من المتجر، ثم حرّك الطلب من اللوحة. بلا تسجيل، وكل شيء يبقى في متصفحك.',
      features: ['لوحة تحكم (CMS)', 'معاينة مباشرة', 'عربي وإنجليزي', 'الطلبات وحالتها', 'أكواد الخصم', 'رفع الصور من الهاتف', 'مصمّم للهاتف أولاً', 'دينار عراقي وأردني'],
      open: 'افتح المتجر', panel: 'جرّب لوحة التحكم', alt: 'لوحة تحكم متجر نفحة بجانب معاينة مباشرة للمتجر', phoneAlt: 'متجر نفحة على الهاتف',
    },
    groups: { client: 'لعملائنا', demo: 'جرّبه بنفسك', own: 'منتجات هيملو' },
    systems: {
      domain: 'system.hemlohq.com', url: 'https://hemlohq.com/gym/', demoUrl: 'https://system.hemlohq.com/?demo=gym&lang=ar', name: 'أنظمة هيملو', tag: 'من هيملو · نظام أعمال',
      desc: 'النظام الذي تدير به الأندية الرياضية وعيادات الأسنان والمحلات يومها: الكاشير، المشتركون والتجديد، المواعيد، البضاعة ودفتر الديون. يستمر بالعمل عند انقطاع الإنترنت، ويقرأ فاتورة المورّد من صورة.',
      features: ['يعمل بدون إنترنت', 'عربي وكردي وإنجليزي', 'كاشير بالباركود وإيصالات', 'تذكير بالواتساب', 'صلاحيات للموظفين', 'قراءة الفواتير بالذكاء الاصطناعي'],
      open: 'جرّب النادي التجريبي', visit: 'شاهد المنتج', alt: 'شاشة الاستقبال في نظام هيملو لنادٍ رياضي', phoneAlt: 'نظام النادي على الهاتف',
    },
    hemlo: {
      domain: 'hemlohq.com', url: 'https://hemlohq.com/', name: 'هيملو', tag: 'من هيملو · موقع',
      desc: 'بيت هيملو على الإنترنت، بالعربية والإنجليزية. سريع مع إنترنت ضعيف، واضح على أي هاتف، وفيه صفحة لكل منتج.',
      features: ['عربي وإنجليزي', 'سريع على أي اتصال', 'صفحة لكل منتج', 'الوضع الداكن'], visit: 'زر الموقع', alt: 'موقع هيملو كاملاً', phoneAlt: 'موقع هيملو على الهاتف',
    },
    tools: {
      domain: 'tools.hemlohq.com', url: 'https://tools.hemlohq.com/?lang=ar', name: 'أدوات هيملو', tag: 'من هيملو · تطبيق ويب مجاني',
      desc: 'أدوات مجانية للأعمال الصغيرة: صانع الفواتير وعروض الأسعار، وإيصال التصليح مع بطاقة الضمان، وغيرها. بلا تسجيل، والبيانات تبقى على جهازك، وتعمل بدون إنترنت.',
      features: ['تعمل بدون إنترنت', 'بلا تسجيل', 'طباعة A4 و80 ملم', 'المبلغ كتابةً'], visit: 'افتح الأدوات', alt: 'صفحة أدوات هيملو المجانية', phoneAlt: 'أدوات هيملو على الهاتف',
    },
    ui: { hover: 'مرّر المؤشر فوق النافذة لتتصفح الصفحة', touch: 'اسحب للتصفح', prev: 'المشروع السابق', next: 'المشروع التالي', projects: 'المشاريع' },
  },

  how: {
    title: 'كيف نعمل.',
    steps: [['مكالمة 15 دقيقة', 'نفهم ما تحتاجه.'], ['عرض ثابت خلال 48 ساعة', 'السعر لا يتغيّر إلا إذا غيّرت الطلب.'], ['نبني', '50% عند البدء، 30% في المنتصف.'], ['نُطلق', '20% عند التسليم، ونُدرّب فريقك.'], ['نرعاه', 'إن أردت، بخطة شهرية.']],
  },

  faq: [
    ['من يملك الموقع؟', 'أنت. الكود والمحتوى والنطاق ملكك بالكامل.'],
    ['هل الاستضافة مشمولة؟', 'نعم، مع أي خطة رعاية. النطاق (.com مثلاً) بسعره السنوي.'],
    ['ماذا تُعدّ «صفحة»؟', 'كل صفحة مستقلة: الرئيسية، الخدمات، من نحن، التواصل. منتجات المتجر تُحسب بحجم الكتالوج.'],
    ['هل تعملون خارج بغداد؟', 'نعم، في كل العراق، عن بعد وحضورياً عند الحاجة.'],
  ],
  end: { title: 'جاهز؟ اكتب لنا.', sub: 'أو أرسل التقدير من الأعلى، ونرد خلال يوم عمل.' },
  footer: { rights: 'جميع الحقوق محفوظة.', part: 'جزء من', made: 'صُنع في بغداد.', founder: 'أسّسها', founderName: 'عادل تحسين' },
};

const en: typeof ar = {
  meta: {
    title: 'Hemlo Studio · Say what you need, see what it costs',
    desc: 'Websites, stores, apps and systems for Iraqi businesses. Describe what you need in one sentence and see the price in dinars, instantly.',
  },
  nav: { build: 'Price it', prices: 'Prices', work: 'Work', how: 'How', write: 'Write to us', switchTo: 'العربية' },

  hero: { eyebrow: 'Hemlo Studio', title: 'Tell us what you need.<br>Watch the price write itself.' },
  fit: {
    what: 'What it is', when: 'You need it when', not: 'It’s not for you if',
    whatBody: 'We build something just for your business: a website, an online store, an app, or a custom system. You pay once, and you own it.',
    whenList: ['You want customers to find you online', 'You want to sell online and take orders', 'Your business works in its own way that no ready-made software fits'],
    notBody: 'If you run a shop, a workshop or a clinic, Hemlo Systems probably fits already, and costs less. And if you just need an invoice, Hemlo Tools are free.',
    systems: 'Hemlo Systems', tools: 'Hemlo Tools',
  },
  sentence: {
    need: 'I need',
    types: { website: 'a company website', store: 'an online store', webapp: 'a web app', mobile: 'a mobile app', system: 'a business system' },
    with: 'with',
    catalogue: { s: 'for up to 50 products', m: 'for up to 500 products', l: 'for up to 2,000 products' },
    complexity: { simple: 'that’s simple', moderate: 'that’s fairly involved', complex: 'that’s complex' },
    integrations: ['working on its own', 'linked to 1 other system', 'linked to 2 other systems', 'linked to 3 other systems', 'linked to 4 other systems'],
    languages: ['in Arabic only', 'in Arabic and English', 'in Arabic, English and Kurdish'],
    also: 'I’d also like',
    extras: { cms: 'to edit it myself', blog: 'a blog', booking: 'online bookings', payments: 'online payments', copy: 'you to write the text', seo: 'search setup', brand: 'a logo and brand', rush: 'it sooner', accounts: 'user accounts', reports: 'dashboards and reports', workflows: 'approvals', notify: 'WhatsApp alerts' },
    after: 'After launch,',
    care: { none: 'I’ll look after it myself', basic: 'Hemlo looks after it (Basic care)', business: 'Hemlo looks after it (Business care)', priority: 'Hemlo looks after it (Priority care)' },
    less: 'Fewer', more: 'More',
  },
  receipt: {
    title: 'Estimate', no: 'No.', total: 'Total', range: 'Early estimate, fixed after a short call',
    then: 'then {x} a month', ready: 'Ready in', pay: 'Paid in three', payParts: ['to start', 'midway', 'on delivery'],
    send: 'Send it to us', copy: 'Copy link', copied: 'Copied', pdf: 'Save PDF', usd: 'USD', iqd: 'IQD',
    mailSubject: 'Estimate from Hemlo Studio', mailIntro: 'Hello, here’s what I need:',
    lines: { website: 'Website · {p}', store: 'Online store', catalogue_m: 'Up to 500 products', catalogue_l: 'Up to 2,000 products', webapp: 'Web app', mobile: 'Mobile app', system: 'Business system', complexity_moderate: 'Fairly involved ×1.3', complexity_complex: 'Complex ×1.6', m_accounts: 'User accounts', m_reports: 'Dashboards and reports', m_workflows: 'Approvals', m_notify: 'Alerts', integrations: 'Integrations · {n}', cms: 'Content editing (CMS)', blog: 'Blog', copy: 'Copywriting · {p}', booking: 'Bookings', payments: 'Online payments', seo: 'Search setup', brand: 'Logo and brand', languages: 'Extra languages · {n}', rush: 'Sooner delivery' },
    weeks: 'weeks', days: 'days', dock: 'Price',
  },

  list: {
    title: 'The price list.', sub: 'Every price, in dinars. No “contact us for pricing”.',
    from: 'from', perMonth: '/ month', perPage: '/ page', each: 'each',
    websites: 'Websites', firstPage: 'First page, with the full design', extraPage: 'Each extra page',
    cms: 'Edit the content yourself (CMS)', lang: 'Each extra language', blog: 'Blog or news', booking: 'Online bookings', payments: 'Online payments (FIB, ZainCash, cards)', copy: 'We write the text', seo: 'Search and Google Maps setup', brand: 'Logo and brand basics', rush: 'About 30% sooner',
    stores: 'Stores', storeNote: 'Cart, orders, admin, and cash on delivery.', catalogue: ['Up to 50 products', 'Up to 500 products', 'Up to 2,000 products'],
    apps: 'Apps and systems', appsNote: 'Starting prices, ×1.3 when fairly involved and ×1.6 when complex.', types: ['Web app', 'Mobile app (iOS and Android)', 'Business system'],
    modules: ['User accounts and roles', 'Dashboards and reports', 'Approvals and workflows', 'WhatsApp / SMS alerts', 'Link to another system'],
    care: 'Care after launch', careNote: 'Pay for 10 months, get 12.',
    carePlans: [['Basic', 'Hosting, SSL, daily backups and 24/7 monitoring.'], ['Business', 'All of that, plus 2 hours of changes a month.'], ['Priority', 'All of that, plus 6 hours of changes and same-day replies.']],
  },

  afterLaunch: {
    title: 'After launch, simply put.',
    sub: 'A website is like a car: once it’s yours, it needs fuel, servicing and insurance to keep running. This is what happens every day, out of sight:',
    what: 'What it is', without: 'Without it', all: 'In every plan', some: 'Business and Priority', yearly: 'Billed yearly',
    items: [
      ['server', 'Hosting', 'Where your website “lives” on the internet, like the rent on a shop.', 'Your website disappears.', 'all'],
      ['globe', 'Domain', 'Your website’s address, like yourname.com. Renewed every year.', 'Nobody can reach you, and someone else can take the name.', 'yearly'],
      ['lock', 'The padlock (SSL)', 'The padlock next to the address: it keeps your visitors’ details safe.', 'Browsers warn your visitors the site is “not secure”.', 'all'],
      ['copy', 'Backups', 'A full copy of your website, every day.', 'If something goes wrong, everything is lost.', 'all'],
      ['pulse', 'Monitoring', 'We watch your website day and night, and fix it if it stops, usually before you notice.', 'You hear about the outage from an angry customer.', 'all'],
      ['pencil', 'Changes', 'A new price, new photos, an extra page: we make them for you.', 'Each change is a separate request, and waits its turn.', 'some'],
    ] as [string, string, string, string, 'all' | 'some' | 'yearly'][],
    must: 'Do I have to sign up?', mustBody: 'No. The website is yours, and you can look after it yourself or with anyone. Just remember that someone has to do all of the above.',
    cta: 'See the care plans and prices', help: 'What’s this?',
  },

  work: {
    title: 'Our work.', sub: 'A client’s complete online store, a demo store you can try yourself, and everything Hemlo runs on, built to the standard we’ll build yours.',
    featured: {
      domain: 'alwafi.net', url: 'https://alwafi.net/', name: 'Al-Wafi for Computers', tag: 'Client · Online store', visit: 'Visit the store',
      desc: 'A complete online store for a Baghdad computer shop with three decades behind it: laptops, PC parts and accessories, in Arabic and English. The owners run every product, price, offer and page from their own CMS, and the store is connected to every service it needs.',
      features: ['Content management (CMS)', 'Arabic and English', 'Customer accounts and wishlists', 'Cart, orders and order tracking', 'Installments', 'Affiliate program', 'Brand and offer pages', 'Instant search', 'WhatsApp', 'Visitor analytics', 'Image CDN', 'Search engine setup'],
      alt: 'The home page of the Al-Wafi for Computers store',
    },
    demo: {
      domain: 'demo.hemlohq.com', url: 'https://demo.hemlohq.com/?lang=en', panelUrl: 'https://demo.hemlohq.com/admin?lang=en', name: 'Nafha, a store you can try', tag: 'Live demo · Store and control panel',
      desc: 'A complete perfume store with its control panel, built so you can feel how your own store would work before we start. Open the panel, change a price, a photo or the store’s colour, and watch the store change. Order from the store, then move the order along in the panel. Nothing to sign up for; everything stays in your browser.',
      features: ['Control panel (CMS)', 'Live preview', 'Arabic and English', 'Orders and their status', 'Discount codes', 'Photo uploads from your phone', 'Designed for phones first', 'Iraqi and Jordanian dinar'],
      open: 'Open the store', panel: 'Try the control panel', alt: 'The Nafha control panel beside a live preview of the store', phoneAlt: 'The Nafha store on a phone',
    },
    groups: { client: 'For clients', demo: 'Try it yourself', own: 'Built for Hemlo' },
    systems: {
      domain: 'system.hemlohq.com', url: 'https://hemlohq.com/en/gym/', demoUrl: 'https://system.hemlohq.com/?demo=gym&lang=en', name: 'Hemlo Systems', tag: 'Hemlo’s own · Business system',
      desc: 'The system gyms, dental clinics and shops run their day on: the till, members and renewals, appointments, stock and the debt book. It keeps working when the internet drops, and reads a supplier’s invoice from a photo.',
      features: ['Works offline', 'Arabic, Kurdish and English', 'Barcode till and receipts', 'WhatsApp reminders', 'Staff permissions', 'AI invoice reading'],
      open: 'Try the demo gym', visit: 'See the product', alt: 'The front desk of a gym in Hemlo Systems', phoneAlt: 'The gym system on a phone',
    },
    hemlo: {
      domain: 'hemlohq.com', url: 'https://hemlohq.com/en/', name: 'hemlohq.com', tag: 'Hemlo’s own · Website',
      desc: 'Hemlo’s home, in Arabic and English. Fast on a weak connection, clear on any phone, with a page for every product.',
      features: ['Arabic and English', 'Fast on any connection', 'A page per product', 'Dark mode'], visit: 'Visit the site', alt: 'The whole Hemlo website', phoneAlt: 'The Hemlo website on a phone',
    },
    tools: {
      domain: 'tools.hemlohq.com', url: 'https://tools.hemlohq.com/?lang=en', name: 'Hemlo Tools', tag: 'Hemlo’s own · Free web app',
      desc: 'Free tools for small businesses: an invoice and quotation maker, a repair receipt with a warranty card, and more. No sign-up; the data stays on the device, and it works offline.',
      features: ['Works offline', 'No sign-up', 'Prints on A4 and 80 mm', 'Amounts in words'], visit: 'Open the tools', alt: 'The Hemlo Tools page', phoneAlt: 'Hemlo Tools on a phone',
    },
    ui: { hover: 'Hover over the window to scroll the page', touch: 'Swipe to scroll', prev: 'Previous project', next: 'Next project', projects: 'Projects' },
  },

  how: {
    title: 'How it goes.',
    steps: [['A 15-minute call', 'We understand what you need.'], ['A fixed quote in 48 hours', 'It only changes if you change the request.'], ['We build', '50% to start, 30% midway.'], ['We launch', '20% on delivery, and we train your team.'], ['We look after it', 'If you want, on a monthly plan.']],
  },

  faq: [
    ['Who owns the site?', 'You do. The code, the content and the domain are all yours.'],
    ['Is hosting included?', 'Yes, with any care plan. The domain (like .com) is billed at its yearly price.'],
    ['What counts as a “page”?', 'Each separate page: home, services, about, contact. Store products are priced by catalogue size.'],
    ['Do you work outside Baghdad?', 'Yes, across Iraq, remotely, and in person when needed.'],
  ],
  end: { title: 'Ready? Write to us.', sub: 'Or send the estimate from above. We reply within a working day.' },
  footer: { rights: 'All rights reserved.', part: 'Part of', made: 'Made in Baghdad.', founder: 'Founded by', founderName: 'Adil Tahseen' },
};

export const STRINGS = { ar, en };
export const t = (lang: Lang) => STRINGS[lang];

// "5 pages" / "5 صفحات", with Arabic number agreement
export function pagesLabel(n: number, lang: Lang) {
  if (lang === 'en') return n === 1 ? '1 page' : `${n} pages`;
  if (n === 1) return 'صفحة واحدة';
  if (n === 2) return 'صفحتين';
  return n <= 10 ? `${n} صفحات` : `${n} صفحة`;
}
