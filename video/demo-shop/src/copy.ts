// Every word on screen, in both languages. Short, plain, the way a shop owner talks.
export type Lang = 'ar' | 'en';

export const COPY = {
  en: {
    eyebrow: 'Hemlo Systems · Stores & Markets',
    title: ['Your whole shop.', 'One system.'],
    captions: {
      web: ['hemlohq.com', 'Try it in one tap. No sign-up.'],
      opening: ['Al-Noor Market', 'Your own demo shop, stocked and ready.'],
      today: ['Today', 'Sales, profit and debts, at a glance.'],
      week: ['7 days', 'A whole week of trading, already there.'],
      sell: ['Selling', 'Scan a can, a whole carton, or a weighed item.'],
      display: ['Customer display', 'Your customer sees every item, on their own screen.'],
      pay: ['Payment', 'Cash, card, FIB or on account. The change, worked out.'],
      debt: ['Debt book', 'Who owes you what, to the last dinar.'],
      drawer: ['The drawer', 'Close the day. Know if the drawer is short.'],
      phone: ['Anywhere', 'On the counter or in your pocket. Even offline.'],
    },
    end: { title: 'Try the demo shop.', url: 'hemlohq.com/systems', sub: 'Free for the first shops.' },
  },
  ar: {
    eyebrow: 'هيملو الأنظمة · المتاجر والماركتات',
    title: ['محلك كله،', 'بنظام واحد.'],
    captions: {
      web: ['hemlohq.com', 'جرّبه بضغطة واحدة. بلا تسجيل.'],
      opening: ['ماركت النور', 'متجرك التجريبي، جاهز بالبضاعة.'],
      today: ['اليوم', 'المبيعات والربح والديون، بنظرة واحدة.'],
      week: ['٧ أيام', 'أسبوع كامل من البيع، جاهز أمامك.'],
      sell: ['البيع', 'امسح علبة، أو كارتون كامل، أو شيئاً موزوناً.'],
      display: ['شاشة الزبون', 'والزبون يشوف كل قطعة على شاشته.'],
      pay: ['الدفع', 'نقداً، بطاقة، FIB أو على الحساب. والباقي محسوب.'],
      debt: ['الدفتر', 'منو عليه دين، وكم، لآخر دينار.'],
      drawer: ['الصندوق', 'سلّم الصندوق، واعرف إذا ناقص.'],
      phone: ['في كل مكان', 'على الكاونتر أو بجيبك. حتى بدون إنترنت.'],
    },
    end: { title: 'جرّب المتجر التجريبي.', url: 'hemlohq.com/systems', sub: 'مجاناً لأول المحلات.' },
  },
} as const;
