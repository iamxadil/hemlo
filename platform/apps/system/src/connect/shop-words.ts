// Hemlo Connect's words for a shop (and any system that isn't an agency): laid over the agency's (words.ts), so the
// screen is the same and only what differs is said differently. The Kurdish should be read by a native speaker.
import type { Copy } from './words';

type Extra = {
  sendProduct: string; sendProductSub: string; productSearch: string; noProducts: string; productSent: string;
  openCustomer: string; owes: string; orderWord: string; wsOrders: string; debtMin: string; status: Record<string, string>;
};
type Shop = Partial<Copy> & Extra;

const ar: Shop = {
  heroBody: 'كل زبون يكتب لك يصله رد خلال ثوانٍ من منتجاتك وأسعارك الحقيقية، وكل طلب أونلاين يصل صاحبه تحديثه على واتساب. وكل شيء يبقى في هيملو: الزبون، والمحادثة، والطلب.',
  flow: [['يكتب الزبون', 'من موقعك أو إعلانك أو مباشرة'], ['يرد Connect فوراً', 'من منتجاتك وأسعارك، بلغته'], ['يُربط بدفترك', 'الزبون وديونه وطلباته'], ['يتابع عنك', 'تحديثات الطلب وتذكير الديون']],
  recommended: 'الأنسب للمتاجر',
  basicFeatures: ['صندوق محادثات واتساب للفريق كله', 'تحديث كل طلب أونلاين على واتساب: تأكيد، توصيل، تسليم', 'تذكير لطيف للزبائن بما عليهم من دين', 'رسائل موقعك تصل إلى صندوق المحادثات'],
  proFeatures2: ['كل ما في Basic', 'مساعد ذكي يرد من منتجاتك وأسعارك ومخزونك الحقيقي', 'اقتراح الرد وتلخيص المحادثة بضغطة', 'يرسل للزبون رابط المنتج ليطلبه من موقعك'],
  studioFeatures: ['كل ما في Pro', 'حملات تسويقية بنصوص عربية وإنكليزية لواتساب وإنستغرام وفيسبوك', 'تصاميم منشورات من منتجاتك', 'خطة محتوى للأسابيع القادمة'],
  setupTitle: 'اربط رقم واتساب متجرك', askManager: 'يربط مدير المتجر رقم واتساب من هنا.',
  connectSteps: ['سجّل دخولك بحساب فيسبوك التجاري', 'اختر رقم المتجر أو أضف رقماً جديداً', 'نرسل قوالب الرسائل لموافقة واتساب تلقائياً'],
  tryBody: 'اكتب كأنك زبون، وشاهد كيف يرد المساعد من منتجاتك وأسعارك.',
  simText: 'مرحباً، عندكم شاي أحمد؟ وكم سعره؟',
  filters: { all: 'الكل', unread: 'غير مقروءة', waiting: 'تنتظرك', mine: 'لي' },
  assistantBody: 'يرد على زبائنك من منتجاتك وأسعارك ومخزونك الحقيقي فقط، ولا يخترع سعراً أو عرضاً، ويحوّل المحادثة لزميل عند الحاجة.',
  notes: 'ما يجب أن يعرفه المساعد عن متجرك', notesHint: 'مثلاً: نوصّل داخل بغداد خلال يوم، الدفع عند الاستلام، الاستبدال خلال 3 أيام.',
  hours: 'ساعات العمل', hoursHint: 'كل يوم، 9 صباحاً – 11 مساءً',
  recipes: { instant_reply: 'الرد الفوري', order_update: 'تحديثات الطلب', debt_reminder: 'تذكير الديون', opt_out: 'إيقاف الرسائل', weekly_summary: 'ملخص الأسبوع' },
  recipeBody: {
    instant_reply: 'كل من يكتب لك لأول مرة يصله ترحيب خلال ثوانٍ، في أي ساعة.',
    order_update: 'كل طلب أونلاين: يصل الزبون تأكيده، ثم خروجه للتوصيل أو جاهزيته للاستلام، ثم تسليمه، برابط يتابع منه.',
    debt_reminder: 'مرة في الشهر، رسالة لطيفة لكل زبون عليه دين يتجاوز المبلغ الذي تحدده، بما عليه بالضبط.',
  },
  recipeIcon: { instant_reply: 'wa', order_update: 'truck', debt_reminder: 'wallet' },
  thisWeek: 'هذا الأسبوع', wsOrders: ' طلب أونلاين',
  quickDefaults: [{ title: 'التوصيل', text: 'نوصّل داخل المدينة خلال يوم، والدفع عند الاستلام.' }, { title: 'الموقع', text: 'متجرنا في [العنوان]. نستقبلكم كل يوم من 9 صباحاً حتى 11 مساءً.' }, { title: 'شكراً', text: 'شكراً لتواصلك معنا! نحن بالخدمة لأي سؤال آخر.' }],
  sendProduct: 'أرسل منتجاً', sendProductSub: 'يصل الزبون الاسم والسعر ورابط المنتج ليطلبه من موقعك.', productSearch: 'ابحث بالاسم أو الباركود', noProducts: 'لا منتجات بهذا البحث.', productSent: 'أُرسل المنتج.',
  openCustomer: 'دفتر الزبون', owes: 'عليه', orderWord: 'طلب', debtMin: 'عندما يتجاوز الدين',
  status: { new: 'جديد', confirmed: 'مؤكَّد', ready: 'جاهز', out: 'في الطريق', delivered: 'سُلِّم', canceled: 'ملغى' },
};
const en: Shop = {
  heroBody: 'Everyone who writes to you hears back within seconds, from your real products and prices, and every online order’s customer gets its updates on WhatsApp. It all stays in Hemlo: the customer, the chat, the order.',
  flow: [['A customer writes', 'from your website, an ad, or directly'], ['Connect answers at once', 'from your products and prices, in their language'], ['Linked to your book', 'the customer, what they owe, their orders'], ['It follows up', 'order updates and debt reminders']],
  recommended: 'Best for shops',
  basicFeatures: ['A WhatsApp inbox for the whole team', 'Every online order’s updates on WhatsApp: confirmed, out for delivery, delivered', 'A gentle reminder to customers of what they owe', 'Messages from your website land in the inbox'],
  proFeatures2: ['Everything in Basic', 'An AI assistant that answers from your real products, prices and stock', 'Suggested replies and chat summaries in one tap', 'It sends the product’s link so the customer orders it online'],
  studioFeatures: ['Everything in Pro', 'Marketing campaigns in Arabic and English for WhatsApp, Instagram and Facebook', 'Post designs from your products', 'A content plan for the weeks ahead'],
  setupTitle: 'Connect your shop’s WhatsApp number', askManager: 'The shop’s manager connects the WhatsApp number here.',
  connectSteps: ['Log in with your Facebook business account', 'Pick the shop’s number, or add a new one', 'We submit the message templates for WhatsApp’s approval'],
  tryBody: 'Write as a customer, and watch the assistant answer from your products and prices.',
  simText: 'Hi, do you have Ahmad tea? How much is it?',
  filters: { all: 'All', unread: 'Unread', waiting: 'Waiting', mine: 'Mine' },
  assistantBody: 'Answers your customers from your real products, prices and stock only, never invents a price or an offer, and hands the chat to a colleague when needed.',
  notes: 'What the assistant should know about your shop', notesHint: 'e.g. We deliver in Baghdad within a day, cash on delivery, exchanges within 3 days.',
  hours: 'Opening hours', hoursHint: 'Every day, 9 am – 11 pm',
  recipes: { instant_reply: 'Instant reply', order_update: 'Order updates', debt_reminder: 'Debt reminder', opt_out: 'Stop messages', weekly_summary: 'Weekly summary' },
  recipeBody: {
    instant_reply: 'Whoever writes to you for the first time hears back within seconds, at any hour.',
    order_update: 'Every online order: the customer hears it’s confirmed, then out for delivery or ready to collect, then delivered, with a link to follow it.',
    debt_reminder: 'Once a month, a gentle message to each customer who owes more than the amount you set, with exactly what they owe.',
  },
  recipeIcon: { instant_reply: 'wa', order_update: 'truck', debt_reminder: 'wallet' },
  thisWeek: 'This week', wsOrders: ' online orders',
  quickDefaults: [{ title: 'Delivery', text: 'We deliver within the city in a day, cash on delivery.' }, { title: 'Location', text: 'Our shop is at [address]. We’re open every day, 9 am to 11 pm.' }, { title: 'Thanks', text: 'Thank you for reaching out! We’re here for any other question.' }],
  sendProduct: 'Send a product', sendProductSub: 'The customer gets the name, the price and the product’s link to order it online.', productSearch: 'Search by name or barcode', noProducts: 'No products match.', productSent: 'Product sent.',
  openCustomer: 'Customer’s book', owes: 'owes', orderWord: 'Order', debtMin: 'When the debt is over',
  status: { new: 'New', confirmed: 'Confirmed', ready: 'Ready', out: 'On the way', delivered: 'Delivered', canceled: 'Canceled' },
};
const ckb: Shop = {
  ...ar,
  heroBody: 'هەر کڕیارێک بۆت بنووسێت لە چەند چرکەیەکدا وەڵام وەردەگرێت لە بەرهەم و نرخە ڕاستەقینەکانت، و هەر داواکارییەکی ئۆنلاین نوێکارییەکانی لە واتسئاپ دەگاتە خاوەنەکەی.',
  recommended: 'باشترین بۆ دوکانەکان',
  basicFeatures: ['سندوقی گفتوگۆی واتسئاپ بۆ هەموو تیمەکە', 'نوێکاریی هەر داواکارییەکی ئۆنلاین لە واتسئاپ', 'بیرخستنەوەیەکی نەرم بە قەرزی کڕیاران', 'نامەکانی ماڵپەڕەکەت دەگەنە سندوقی گفتوگۆ'],
  proFeatures2: ['هەموو ئەوەی لە Basic دایە', 'یاریدەدەرێکی زیرەک کە لە بەرهەم و نرخ و کۆگای ڕاستەقینەت وەڵام دەداتەوە', 'پێشنیاری وەڵام و کورتەی گفتوگۆ بە یەک کرتە', 'لینکی بەرهەم دەنێرێت بۆ ئەوەی کڕیار ئۆنلاین داوای بکات'],
  setupTitle: 'ژمارەی واتسئاپی دوکانەکەت پەیوەست بکە',
  recipes: { instant_reply: 'وەڵامی خێرا', order_update: 'نوێکاریی داواکاری', debt_reminder: 'بیرخستنەوەی قەرز', opt_out: 'ڕاگرتنی نامەکان', weekly_summary: 'پوختەی هەفتە' },
  recipeBody: {
    instant_reply: 'هەر کەسێک بۆ یەکەم جار بنووسێت لە چەند چرکەیەکدا بەخێرهاتنی بۆ دەچێت.',
    order_update: 'هەر داواکارییەکی ئۆنلاین: کڕیار پشتڕاستکردنەوە، ناردن یان ئامادەبوون، و گەیاندنی بە لینکێکەوە وەردەگرێت.',
    debt_reminder: 'مانگی جارێک، نامەیەکی نەرم بۆ هەر کڕیارێک کە قەرزەکەی لەو بڕە زیاترە کە دیاری دەکەیت.',
  },
  wsOrders: ' داواکاریی ئۆنلاین',
  sendProduct: 'بەرهەمێک بنێرە', sendProductSub: 'کڕیار ناو، نرخ و لینکی بەرهەمەکە وەردەگرێت.', productSearch: 'بە ناو یان بارکۆد بگەڕێ', noProducts: 'هیچ بەرهەمێک نییە.', productSent: 'بەرهەمەکە نێردرا.',
  openCustomer: 'دەفتەری کڕیار', owes: 'قەرزی هەیە', orderWord: 'داواکاری', debtMin: 'کاتێک قەرز زیاترە لە',
  status: { new: 'نوێ', confirmed: 'پشتڕاستکراوە', ready: 'ئامادەیە', out: 'لە ڕێگادایە', delivered: 'گەیەندرا', canceled: 'هەڵوەشاوە' },
};

export const shopCopy = (lang: string): Shop => (lang === 'en' ? en : lang === 'ckb' ? ckb : ar);
export type ShopCopy = Copy & Extra;
