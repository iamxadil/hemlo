// The Gym edition's words (Arabic first, English, Kurdish in i18n-ckb.ts). Loaded only for gyms.
import { useApp } from '../lib/app';
import type { Lang } from '../lib/i18n';
import { ckb } from './i18n-ckb';

const ar = {
  nav: { desk: 'الاستقبال', members: 'المشتركون', renewals: 'التجديدات', classes: 'الكلاسات', reports: 'التقارير', gym: 'إعداد النادي', shop: 'المتجر', accounts: 'الحسابات', member: 'المشترك' },
  shell: {
    gym: 'النادي', account: 'حسابي', more: 'المزيد', new: 'جديد', search: 'ابحث عن مشترك…', searchLong: 'الاسم أو الهاتف أو رقم المشترك أو البطاقة',
    newMember: 'مشترك جديد', sell: 'بيع اشتراك', booking: 'حجز كلاس', door: 'شاشة الباب', members: 'المشتركون', goTo: 'انتقل إلى', actions: 'إجراءات', recent: 'آخر من حضر',
    none: 'لا نتائج لـ «{q}»', addAs: 'أضف «{q}» كمشترك جديد', keys: '↑↓ للتنقل · Enter للفتح · Esc للإغلاق', pickMember: 'لأي مشترك؟',
    morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير', greetFmt: '{greet}، {name}',
  },
  desk: {
    scan: 'امسح البطاقة، أو اكتب الاسم أو الهاتف أو الرقم', camera: 'الكاميرا', inNow: 'يتمرّنون الآن', visits: 'زيارات اليوم', lastWeek: '{n} بنفس الوقت الأسبوع الماضي',
    active: 'اشتراكات فعّالة', due: 'تجديدات مستحقة', dueSub: '{n} هذا الأسبوع · {m} انتهت مؤخراً', feed: 'حضروا اليوم', empty: 'لا أحد بعد اليوم. أول مسح سيظهر هنا.',
    shape: 'اليوم حتى الآن', today: 'اليوم', lastWeekLegend: 'الأسبوع الماضي', turnedBack: '{n} رُدّوا', sold: 'المبيعات اليوم', collected: 'المقبوض اليوم', owed: 'ديون المشتركين',
    undo: 'تراجع', undone: 'أُلغي التسجيل', open: 'الملف', sound: 'الصوت', pt: '{n} جلسة تدريب', shop: 'المتجر {v}', memberships: 'الاشتراكات {v}', ready: 'جاهز للمسح',
  },
  pass: {
    ok: 'أهلاً بك', again: 'موجود بالفعل · نفس الزيارة', denied: 'لا يمكن الدخول', override: 'أدخله على أي حال', overridden: 'أدخله الاستقبال',
    daysLeft: 'يوم متبقٍّ', daysLeftN: '{n} يوم متبقٍّ', lastDay: 'آخر يوم', visitsLeft: 'زيارة متبقية', lastVisit: 'آخر زيارة', unlimited: 'غير محدود', renew: 'جدّد الاشتراك',
    reasons: { expired: 'انتهى الاشتراك', frozen: 'الاشتراك متوقف مؤقتاً', no_visits: 'انتهت الزيارات', none: 'لا يوجد اشتراك', not_started: 'لم يبدأ الاشتراك بعد', hours: 'ليس وقته (وقت السيدات)', gender: 'ليس وقته' } as Record<string, string>,
    warn: { ending: 'ينتهي قريباً · اعرض التجديد', grace: 'في أيام السماح', owes: 'عليه {v}', birthday: 'عيد ميلاده اليوم 🎂', no_photo: 'بلا صورة · التقط له صورة' } as Record<string, string>,
    ended: 'انتهى {date}', resume: 'استئناف', since: 'منذ {date}',
  },
  state: { active: 'فعّال', ending: 'ينتهي قريباً', expired: 'منتهٍ', frozen: 'متوقف', future: 'يبدأ قريباً', none: 'بلا اشتراك', used: 'انتهت الزيارات', grace: 'أيام سماح', ended: 'منتهٍ', canceled: 'ملغى' } as Record<string, string>,
  members: {
    search: 'ابحث بالاسم أو الهاتف أو الرقم، أو امسح البطاقة', new: 'مشترك جديد', empty: 'لا مشتركين بعد. أضف أول مشترك.', none: 'لا نتائج.',
    filters: { active: 'فعّالون', ending: 'ينتهون قريباً', expired: 'انتهوا مؤخراً', frozen: 'متوقفون', owing: 'عليهم ديون', all: 'الكل' } as Record<string, string>,
    no: 'رقم {n}', lastVisit: 'آخر زيارة {when}', never: 'لم يحضر بعد', more: 'عرض المزيد', ends: 'ينتهي {date}', ended: 'انتهى {date}',
  },
  form: {
    new: 'مشترك جديد', edit: 'تعديل بيانات المشترك', name: 'الاسم الكامل', phone: 'الهاتف', gender: 'الجنس', f: 'أنثى', m: 'ذكر', birth: 'تاريخ الميلاد',
    goal: 'هدفه', goals: { lose: 'إنقاص الوزن', build: 'بناء العضل', fit: 'لياقة عامة', strength: 'قوة', rehab: 'تأهيل وعلاج', sport: 'رياضة' } as Record<string, string>,
    photo: 'الصورة', takePhoto: 'التقط صورة', changePhoto: 'تغيير الصورة', health: 'الصحة', healthHint: 'ما يجب أن يعرفه المدرب قبل تدريبه.',
    conditions: { heart: 'القلب', hypertension: 'ضغط الدم', diabetes: 'السكري', asthma: 'الربو', epilepsy: 'الصرع', injury: 'إصابة', back: 'الظهر', knee: 'الركبة', pregnant: 'حامل', surgery: 'عملية حديثة' } as Record<string, string>,
    healthNotes: 'ملاحظات صحية', emergency: 'شخص للطوارئ', emergencyPhone: 'هاتف الطوارئ', referral: 'كيف عرفنا',
    referrals: ['إنستغرام', 'تيك توك', 'فيسبوك', 'صديق', 'مرّ من أمام النادي', 'قوقل'], trainer: 'المدرب', noTrainer: 'بدون', notes: 'ملاحظات',
    save: 'حفظ', saved: 'تم الحفظ', created: 'أُضيف المشترك', more: 'المزيد', andSell: 'حفظ وبيع اشتراك',
  },
  file: {
    tabs: { memberships: 'الاشتراكات', visits: 'الزيارات', progress: 'التقدّم', profile: 'الملف' } as Record<string, string>,
    call: 'اتصال', whatsapp: 'واتساب', card: 'البطاقة', sell: 'بيع / تجديد', checkin: 'تسجيل دخول', freeze: 'إيقاف مؤقت', unfreeze: 'استئناف', cancel: 'إلغاء الاشتراك',
    cancelSure: 'إلغاء هذا الاشتراك؟ المال لا يتغيّر: الاسترجاع يكون من المبيعات.', edit: 'تصحيح', month: 'زيارة في 30 يوماً', total: 'زيارة بالمجموع', since: 'مشترك منذ {date}',
    noMs: 'لا اشتراكات بعد.', ends: 'ينتهي {date}', ended: 'انتهى {date}', starts: 'يبدأ {date}', paused: 'متوقف منذ {date}', freezeLeft: 'متبقٍّ {n} يوم إيقاف',
    used: 'المستخدمة', session: 'جلسة تمت', sessions: '{u} من {n} جلسة', coach: 'المدرب', owes: 'عليه', pay: 'استلام دفعة', account: 'كشف الحساب', bookings: 'كلاسات محجوزة',
    archive: 'أرشفة المشترك', archived: 'أُرشف', newCard: 'بطاقة جديدة (فُقدت القديمة)', newCardSure: 'البطاقة القديمة لن تفتح الباب بعد الآن. متابعة؟', newCardDone: 'بطاقة جديدة جاهزة',
    noVisits: 'لم يحضر بعد.', visitsMap: 'آخر 12 أسبوعاً', health: 'الصحة', emergency: 'الطوارئ', goal: 'الهدف', referral: 'عرفنا من', noHealth: 'لا ملاحظات صحية.',
    pausedNow: 'أُوقف مؤقتاً', resumed: 'استؤنف · أُضيف {n} يوم', canceled: 'أُلغي', sessionDone: 'سُجّلت الجلسة', via: { desk: 'الاستقبال', door: 'الباب', pt: 'تدريب شخصي', class: 'كلاس' } as Record<string, string>,
  },
  sell: {
    title: 'بيع اشتراك', renew: 'تجديد الاشتراك', plan: 'الاشتراك', starts: 'يبدأ', after: 'يكمل بعد الحالي: {date}', today: 'اليوم', ends: 'ينتهي {date}', visits: '{n} زيارة',
    price: 'السعر', discount: 'خصم', total: 'المجموع', paid: 'المدفوع الآن', method: 'الدفع', cash: 'نقداً', card: 'بطاقة', fib: 'FIB', rest: 'يُسجَّل {v} على حسابه', coach: 'المدرب',
    note: 'ملاحظة', done: 'تم البيع', go: 'بيع · {v}', print: 'طباعة الوصل',
    cats: { gym: 'النادي', pt: 'تدريب شخصي', class: 'كلاسات', other: 'أخرى' } as Record<string, string>,
  },
  progress: {
    add: 'إضافة قياسات', weight: 'الوزن', height: 'الطول', bodyFat: 'الدهون', muscle: 'العضل', waist: 'الخصر', chest: 'الصدر', arm: 'الذراع', thigh: 'الفخذ', hip: 'الورك',
    kg: 'كغ', cm: 'سم', pct: '٪', empty: 'لا قياسات بعد. قِس في اليوم الأول: رؤية التقدّم هي ما يُبقي الناس.', since: 'منذ {date}', bmi: 'مؤشر الكتلة', date: 'التاريخ', saved: 'حُفظت القياسات', history: 'السجل',
  },
  card: { title: 'بطاقة المشترك', share: 'إرسال', download: 'حفظ الصورة', print: 'طباعة', hint: 'تُمسح عند الاستقبال أو على الباب.', no: 'رقم المشترك', kicker: 'بطاقة عضوية', until: 'حتى {date}', visits: 'متبقٍّ {n} زيارة', starts: 'تبدأ {date}', making: 'نجهّز البطاقة…', printHint: 'تُطبع بحجم البطاقة الحقيقي، مع خط للقص.' },
  register: {
    open: 'صوّر سجلّ المشتركين', title: 'صوّر سجلّ المشتركين', lead: 'صفحة واحدة في كل مرة. يقرأ هيملو الأسماء والأرقام والاشتراكات والديون، وأنت تراجع قبل أن يُحفظ أي شيء.',
    steps: ['صوّر صفحة', 'راجع ما قرأناه', 'أضفهم'], camera: 'التقط صورة', gallery: 'اختر صورة', sample: 'جرّب صفحة نموذجية',
    reading: 'نقرأ الصفحة…', readingSub: 'الأسماء، الأرقام، الاشتراكات، والديون', found: 'وجدنا {n} مشتركاً', check: '{n} تحتاج نظرة',
    allGood: 'كل شيء واضح', hint: 'صحّح ما تحتاجه. الحقول المعلّمة لم نتأكد منها.', none: 'لم نجد أسماء في هذه الصفحة. صوّرها بإضاءة أفضل ومن الأعلى.',
    name: 'الاسم', phone: 'الهاتف', plan: 'الاشتراك', asWritten: 'كما كُتب: {p}', noPlan: 'بدون اشتراك', ends: 'ينتهي', owes: 'عليه',
    remove: 'احذف', another: 'صوّر صفحة أخرى', add: 'أضف {n} مشتركاً', adding: 'نضيفهم…', done: 'أُضيف {n} مشتركاً', doneSub: '{m} اشتراك سُجّل، والديون في الدفتر.',
    view: 'افتح المشتركين', sampleNote: 'صفحة نموذجية: نتيجتها مجهّزة مسبقاً، ولا تُحسب من رصيدك.', pageTitle: 'سجل المشتركين',
    cols: ['الاسم', 'الهاتف', 'الاشتراك', 'من', 'الباقي'], skipped: 'لم نضف {n}: {why}', fix: 'صحّحها',
  },
  renewals: {
    ending: 'تنتهي هذا الأسبوع', lapsed: 'انتهت مؤخراً ولم تُجدَّد', remind: 'تذكير', reminded: 'أُرسل', renew: 'تجديد', none: 'لا شيء مستحق. الجميع مجدِّد.',
    birthdays: 'أعياد ميلاد هذا الأسبوع', greet: 'هنّئه', today: 'اليوم', inDays: 'بعد {n} يوم', agoDays: 'قبل {n} يوم',
    msg: 'أهلاً {name} 👋 اشتراكك ({plan}) في {gym} ينتهي {date}. جدّد من الاستقبال وكمّل تقدّمك 💪',
    lapsedMsg: 'أهلاً {name}، اشتقنا لك في {gym}! انتهى اشتراكك {date}. نشوفك هذا الأسبوع؟ 💪', birthdayMsg: 'عيد ميلاد سعيد {name}! 🎂 من كل فريق {gym}.',
  },
  classes: {
    week: 'هذا الأسبوع', next: 'الأسبوع القادم', empty: 'لا كلاسات في الجدول بعد.', setup: 'جهّز الجدول', spots: '{n} من {c}', full: 'ممتلئ', open: 'مفتوح',
    who: { all: 'للجميع', f: 'للسيدات', m: 'للرجال' } as Record<string, string>, book: 'حجز مشترك', came: 'حضر', noShow: 'لم يحضر', cancel: 'إلغاء', booked: 'تم الحجز', nobody: 'لا حجوزات بعد.', with: 'مع {coach}', min: '{n} د',
  },
  reports: {
    period: { 7: '7 أيام', 30: '30 يوماً', 90: '3 أشهر' } as Record<string, string>, memberships: 'الاشتراكات', shop: 'المتجر', collected: 'المقبوض', expenses: 'المصاريف',
    newMembers: 'مشتركون جدد', activeNow: 'فعّالون الآن', visits: 'الزيارات', visitors: '{n} شخص مختلف', renewal: 'نسبة التجديد', renewalSub: '{r} من {e} جدّدوا', busy: 'متى يزدحم النادي',
    busySub: 'الزيارات حسب اليوم والساعة', peak: 'الذروة: {day} الساعة {h}', plans: 'ما يُباع', coaches: 'التدريب الشخصي', sessions: '{n} جلسة', share: 'حصة المدرب', worth: 'قيمة الجلسات', money: 'الدخل يومياً',
    days: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'], noData: 'لا بيانات بعد لهذه الفترة.', people: 'المشتركون', f: 'سيدات', m: 'رجال', shopProfit: 'ربح المتجر {v}', turnedBack: '{n} رُدّوا على الباب',
  },
  setup: {
    plans: 'الاشتراكات والأسعار', addPlan: 'اشتراك جديد', plan: 'الاشتراك', name: 'الاسم', category: 'النوع', duration: 'المدة', unit: { day: 'يوم', month: 'شهر' } as Record<string, string>,
    visits: 'عدد الزيارات', unlimited: 'غير محدود', price: 'السعر', gender: 'لمن', freeze: 'أيام الإيقاف المسموحة', active: 'معروض للبيع', hidden: 'مخفي',
    coaches: 'المدربون', addCoach: 'مدرب جديد', coach: 'المدرب', phone: 'الهاتف', specialty: 'الاختصاص', share: 'حصته من التدريب الشخصي (٪)', account: 'حسابه في هيملو', noAccount: 'بدون حساب',
    timetable: 'جدول الكلاسات الأسبوعي', addClass: 'كلاس جديد', klass: 'الكلاس', day: 'اليوم', time: 'الوقت', minutes: 'المدة (دقيقة)', capacity: 'الأماكن', noLimit: 'بلا حد',
    hours: 'أوقات الدوام', hoursHint: 'أضف أوقات السيدات أو الرجال: الباب يردّ غيرهم (ويستطيع الاستقبال إدخالهم).', closed: 'مغلق', addBlock: 'إضافة وقت', from: 'من', to: 'إلى',
    who: { all: 'الجميع', f: 'السيدات', m: 'الرجال' } as Record<string, string>,
    door: 'الباب', reentry: 'العودة خلال (دقيقة) تُحسب نفس الزيارة', grace: 'أيام السماح بعد انتهاء الاشتراك', self: 'المشتركون يسجّلون دخولهم بأنفسهم على شاشة الباب',
    reminder: 'رسالة التذكير بالتجديد', reminderHint: 'يمكنك استخدام {name} {plan} {date} {gym}', openDoor: 'افتح شاشة الباب', resetDoor: 'رابط جديد للشاشة', resetSure: 'كل شاشة مفتوحة ستتوقف. متابعة؟',
    saved: 'تم الحفظ', edit: 'تعديل', color: 'اللون', doorHint: 'تلفاز أو تابلت عند المدخل: يرحّب بكل مشترك ويعرض كلاسات اليوم وعدد المتمرّنين الآن.',
    days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  },
  start: {
    title: 'ابدأ ناديك على هيملو', sub: '30 يوماً مجاناً، بكل المزايا. بلا بطاقة ولا التزام.', name: 'اسم النادي', namePh: 'نادي {name}', city: 'المدينة', cityPh: 'بغداد',
    who: 'من يتمرّن عندك', whoOpts: { all: 'الجميع', m: 'رجال', f: 'سيدات' } as Record<string, string>, go: 'ابدأ التجربة المجانية', used: 'استخدمت تجربتك المجانية من قبل.',
  },
  door: {
    start: 'تشغيل الشاشة', sound: 'الصوت', scanHere: 'امسح بطاقتك هنا', welcome: 'أهلاً {name}', see: 'راجع الاستقبال من فضلك', inNow: 'يتمرّنون الآن',
    classes: 'كلاسات اليوم', noClasses: 'لا كلاسات اليوم', ladiesUntil: 'وقت السيدات حتى {t}', menUntil: 'وقت الرجال حتى {t}', openUntil: 'مفتوح حتى {t}', closedNow: 'مغلق الآن',
    spots: 'متبقٍّ {n}', full: 'ممتلئ', reset: 'تغيّر رابط هذه الشاشة. افتح الرابط الجديد من التطبيق.', offline: 'جارٍ إعادة الاتصال…', nolink: 'افتح هذه الشاشة من تطبيق النادي.',
    days: '{n} يوم متبقٍّ', visits: '{n} زيارة متبقية', last: 'آخر يوم · جدّد من الاستقبال', again: 'أهلاً من جديد', camera: 'كاميرا', fullscreen: 'ملء الشاشة',
    mottos: ['كل يوم تحضر فيه يُحسب.', 'الاستمرار يغلب الحماس.', 'اشرب ماءً بين المجموعات.', 'التقدّم البطيء يبقى تقدّماً.', 'أرجِع الأوزان إلى مكانها بعد التمرين.'],
  },
  importPlan: 'اشتراك سابق',
  common: { save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق', edit: 'تعديل', add: 'إضافة', back: 'رجوع', all: 'الكل', none: '—', optional: 'اختياري', yes: 'نعم', no: 'لا', more: 'المزيد', done: 'تم' },
  errors: {
    MEMBER_NOT_FOUND: 'لم يُعثر على المشترك.', CARD_UNKNOWN: 'هذه البطاقة ليست من النادي.', PRICE_LOCKED: 'تغيير السعر للمدير فقط. يمكنك إعطاء خصم.', NO_FREEZE_LEFT: 'لم تبقَ أيام إيقاف لهذا الاشتراك.',
    CANT_FREEZE: 'يمكن إيقاف الاشتراك الفعّال فقط.', NOT_FROZEN: 'الاشتراك غير متوقف.', CLASS_FULL: 'الكلاس ممتلئ.', CLASS_GENDER: 'هذا الكلاس مخصص لجنس آخر.', ALREADY_BOOKED: 'محجوز بالفعل.',
    BAD_CLASS: 'لا كلاس في هذا اليوم.', NO_VISITS_LEFT: 'انتهت الجلسات.', NOT_ACTIVE: 'الاشتراك غير فعّال.', FROZEN: 'الاشتراك متوقف.', TOO_LATE: 'فات وقت التراجع.', TRIAL_USED: 'استخدمت تجربتك المجانية من قبل.',
    ALREADY_A_TRAINER: 'هذا الحساب مدرب هنا بالفعل.', BAD_HOURS: 'راجع الأوقات: يجب أن ينتهي كل وقت بعد أن يبدأ.', EMPTY_MEASURE: 'أدخل قياساً واحداً على الأقل.', SELF_CHECKIN_OFF: 'التسجيل الذاتي غير مفعّل.',
    BAD_PLAN: 'اختر اشتراكاً.', ALREADY_CANCELED: 'أُلغي من قبل.', BAD_DATE: 'تاريخ غير صحيح.',
  } as Record<string, string>,
};

const en: typeof ar = {
  nav: { desk: 'Front desk', members: 'Members', renewals: 'Renewals', classes: 'Classes', reports: 'Reports', gym: 'Gym set-up', shop: 'Shop', accounts: 'Accounts', member: 'Member' },
  shell: {
    gym: 'Gym', account: 'My account', more: 'More', new: 'New', search: 'Find a member…', searchLong: 'Name, phone, member number or card',
    newMember: 'New member', sell: 'Sell a membership', booking: 'Book a class', door: 'Door screen', members: 'Members', goTo: 'Go to', actions: 'Actions', recent: 'Came in lately',
    none: 'Nothing found for “{q}”', addAs: 'Add “{q}” as a new member', keys: '↑↓ to move · Enter to open · Esc to close', pickMember: 'For which member?',
    morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', greetFmt: '{greet}, {name}',
  },
  desk: {
    scan: 'Scan a card, or type a name, phone or number', camera: 'Camera', inNow: 'Training now', visits: 'Visits today', lastWeek: '{n} by now last week',
    active: 'Active memberships', due: 'Renewals due', dueSub: '{n} this week · {m} lapsed', feed: 'Came in today', empty: 'No one yet today. The first scan shows up here.',
    shape: 'The day so far', today: 'Today', lastWeekLegend: 'Last week', turnedBack: '{n} turned back', sold: 'Sold today', collected: 'Collected today', owed: 'Members owe',
    undo: 'Undo', undone: 'Check-in undone', open: 'File', sound: 'Sound', pt: '{n} training sessions', shop: 'Shop {v}', memberships: 'Memberships {v}', ready: 'Ready to scan',
  },
  pass: {
    ok: 'Welcome in', again: 'Already in · same visit', denied: 'Can’t come in', override: 'Let them in anyway', overridden: 'Let in by the desk',
    daysLeft: 'days left', daysLeftN: '{n} days left', lastDay: 'Last day', visitsLeft: 'visits left', lastVisit: 'Last visit', unlimited: 'Unlimited', renew: 'Renew',
    reasons: { expired: 'Membership ended', frozen: 'Membership paused', no_visits: 'No visits left', none: 'No membership', not_started: 'Hasn’t started yet', hours: 'Not their hours (ladies’ time)', gender: 'Not their hours' },
    warn: { ending: 'Ending soon · offer a renewal', grace: 'In grace days', owes: 'Owes {v}', birthday: 'Birthday today 🎂', no_photo: 'No photo yet · take one' },
    ended: 'Ended {date}', resume: 'Resume', since: 'Since {date}',
  },
  state: { active: 'Active', ending: 'Ending soon', expired: 'Ended', frozen: 'Paused', future: 'Starts soon', none: 'No membership', used: 'Visits used up', grace: 'Grace days', ended: 'Ended', canceled: 'Cancelled' },
  members: {
    search: 'Search by name, phone or number, or scan a card', new: 'New member', empty: 'No members yet. Add your first.', none: 'Nothing found.',
    filters: { active: 'Active', ending: 'Ending soon', expired: 'Lapsed lately', frozen: 'Paused', owing: 'Owing', all: 'All' },
    no: 'No. {n}', lastVisit: 'Last visit {when}', never: 'Hasn’t come yet', more: 'Show more', ends: 'Ends {date}', ended: 'Ended {date}',
  },
  form: {
    new: 'New member', edit: 'Edit member', name: 'Full name', phone: 'Phone', gender: 'Gender', f: 'Female', m: 'Male', birth: 'Date of birth',
    goal: 'Goal', goals: { lose: 'Lose weight', build: 'Build muscle', fit: 'Get fit', strength: 'Strength', rehab: 'Recovery', sport: 'Sport' },
    photo: 'Photo', takePhoto: 'Take a photo', changePhoto: 'Change photo', health: 'Health', healthHint: 'What a coach must know before training them.',
    conditions: { heart: 'Heart', hypertension: 'Blood pressure', diabetes: 'Diabetes', asthma: 'Asthma', epilepsy: 'Epilepsy', injury: 'Injury', back: 'Back', knee: 'Knee', pregnant: 'Pregnant', surgery: 'Recent surgery' },
    healthNotes: 'Health notes', emergency: 'Emergency contact', emergencyPhone: 'Emergency phone', referral: 'How they found us',
    referrals: ['Instagram', 'TikTok', 'Facebook', 'A friend', 'Walked past', 'Google'], trainer: 'Coach', noTrainer: 'None', notes: 'Notes',
    save: 'Save', saved: 'Saved', created: 'Member added', more: 'More', andSell: 'Save and sell a membership',
  },
  file: {
    tabs: { memberships: 'Memberships', visits: 'Visits', progress: 'Progress', profile: 'Profile' },
    call: 'Call', whatsapp: 'WhatsApp', card: 'Card', sell: 'Sell / renew', checkin: 'Check in', freeze: 'Pause', unfreeze: 'Resume', cancel: 'Cancel membership',
    cancelSure: 'Cancel this membership? The money doesn’t change: a refund is a return on its sale.', edit: 'Correct', month: 'visits in 30 days', total: 'visits in all', since: 'Member since {date}',
    noMs: 'No memberships yet.', ends: 'Ends {date}', ended: 'Ended {date}', starts: 'Starts {date}', paused: 'Paused since {date}', freezeLeft: '{n} pause days left',
    used: 'Used', session: 'Session done', sessions: '{u} of {n} sessions', coach: 'Coach', owes: 'Owes', pay: 'Take a payment', account: 'Account', bookings: 'Booked classes',
    archive: 'Archive member', archived: 'Archived', newCard: 'New card (lost the old one)', newCardSure: 'The old card won’t open the door any more. Go ahead?', newCardDone: 'New card ready',
    noVisits: 'Hasn’t come yet.', visitsMap: 'The last 12 weeks', health: 'Health', emergency: 'Emergency', goal: 'Goal', referral: 'Found us through', noHealth: 'No health notes.',
    pausedNow: 'Paused', resumed: 'Resumed · {n} days added', canceled: 'Cancelled', sessionDone: 'Session recorded', via: { desk: 'Desk', door: 'Door', pt: 'Personal training', class: 'Class' },
  },
  sell: {
    title: 'Sell a membership', renew: 'Renew', plan: 'Membership', starts: 'Starts', after: 'Continues after the current one: {date}', today: 'Today', ends: 'Ends {date}', visits: '{n} visits',
    price: 'Price', discount: 'Discount', total: 'Total', paid: 'Paid now', method: 'Payment', cash: 'Cash', card: 'Card', fib: 'FIB', rest: '{v} goes on their account', coach: 'Coach',
    note: 'Note', done: 'Sold', go: 'Sell · {v}', print: 'Print receipt',
    cats: { gym: 'Gym', pt: 'Personal training', class: 'Classes', other: 'Other' },
  },
  progress: {
    add: 'Add measurements', weight: 'Weight', height: 'Height', bodyFat: 'Body fat', muscle: 'Muscle', waist: 'Waist', chest: 'Chest', arm: 'Arm', thigh: 'Thigh', hip: 'Hip',
    kg: 'kg', cm: 'cm', pct: '%', empty: 'No measurements yet. Measure on day one: seeing progress is what keeps people coming.', since: 'since {date}', bmi: 'BMI', date: 'Date', saved: 'Measurements saved', history: 'History',
  },
  card: { title: 'Member card', share: 'Send', download: 'Save image', print: 'Print', hint: 'Scanned at the desk or the door.', no: 'Member No.', kicker: 'Membership card', until: 'until {date}', visits: '{n} visits left', starts: 'starts {date}', making: 'Making the card…', printHint: 'Prints at real card size, with a line to cut along.' },
  register: {
    open: 'Photograph your register', title: 'Photograph your register', lead: 'One page at a time. Hemlo reads names, phones, memberships and debts, and you check before anything is saved.',
    steps: ['Photograph a page', 'Check what we read', 'Add them'], camera: 'Take a photo', gallery: 'Choose a photo', sample: 'Try a sample page',
    reading: 'Reading the page…', readingSub: 'Names, phones, memberships and debts', found: '{n} members found', check: '{n} need a look',
    allGood: 'All clear', hint: 'Fix anything you need to. Marked fields are ones we weren’t sure of.', none: 'We didn’t find names on this page. Try again from above, in better light.',
    name: 'Name', phone: 'Phone', plan: 'Membership', asWritten: 'As written: {p}', noPlan: 'No membership', ends: 'Ends', owes: 'Owes',
    remove: 'Remove', another: 'Photograph another page', add: 'Add {n} members', adding: 'Adding them…', done: '{n} members added', doneSub: '{m} memberships recorded, and debts are in the debt book.',
    view: 'Open members', sampleNote: 'A sample page: its result is prepared, and it doesn’t count against your allowance.', pageTitle: 'سجل المشتركين',
    cols: ['الاسم', 'الهاتف', 'الاشتراك', 'من', 'الباقي'], skipped: '{n} not added: {why}', fix: 'Fix them',
  },
  renewals: {
    ending: 'Ending this week', lapsed: 'Ended lately, not renewed', remind: 'Remind', reminded: 'Sent', renew: 'Renew', none: 'Nothing due. Everyone’s renewed.',
    birthdays: 'Birthdays this week', greet: 'Wish them', today: 'Today', inDays: 'in {n} days', agoDays: '{n} days ago',
    msg: 'Hi {name} 👋 your {plan} at {gym} ends {date}. Renew at the desk and keep your progress going 💪',
    lapsedMsg: 'Hi {name}, we miss you at {gym}! Your membership ended {date}. See you this week? 💪', birthdayMsg: 'Happy birthday {name}! 🎂 From everyone at {gym}.',
  },
  classes: {
    week: 'This week', next: 'Next week', empty: 'No classes in the timetable yet.', setup: 'Set up the timetable', spots: '{n} of {c}', full: 'Full', open: 'Open',
    who: { all: 'Everyone', f: 'Ladies', m: 'Men' }, book: 'Book a member', came: 'Came', noShow: 'Didn’t come', cancel: 'Cancel', booked: 'Booked', nobody: 'No one booked yet.', with: 'with {coach}', min: '{n} min',
  },
  reports: {
    period: { 7: '7 days', 30: '30 days', 90: '3 months' }, memberships: 'Memberships', shop: 'Shop', collected: 'Collected', expenses: 'Expenses',
    newMembers: 'New members', activeNow: 'Active now', visits: 'Visits', visitors: '{n} different people', renewal: 'Renewal rate', renewalSub: '{r} of {e} renewed', busy: 'When it’s busy',
    busySub: 'Visits by day and hour', peak: 'Busiest: {day} at {h}', plans: 'What sells', coaches: 'Personal training', sessions: '{n} sessions', share: 'Coach’s share', worth: 'Sessions worth', money: 'Money in, by day',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], noData: 'No data for this period yet.', people: 'Members', f: 'Women', m: 'Men', shopProfit: 'Shop profit {v}', turnedBack: '{n} turned back at the door',
  },
  setup: {
    plans: 'Memberships and prices', addPlan: 'New membership', plan: 'Membership', name: 'Name', category: 'Kind', duration: 'Length', unit: { day: 'days', month: 'months' },
    visits: 'Visits', unlimited: 'Unlimited', price: 'Price', gender: 'For', freeze: 'Pause days allowed', active: 'On sale', hidden: 'Hidden',
    coaches: 'Coaches', addCoach: 'New coach', coach: 'Coach', phone: 'Phone', specialty: 'Specialty', share: 'Their share of personal training (%)', account: 'Their Hemlo account', noAccount: 'No account',
    timetable: 'Weekly timetable', addClass: 'New class', klass: 'Class', day: 'Day', time: 'Time', minutes: 'Length (minutes)', capacity: 'Places', noLimit: 'No limit',
    hours: 'Opening hours', hoursHint: 'Add ladies’ or men’s hours: the door turns others back (the desk can still let them in).', closed: 'Closed', addBlock: 'Add hours', from: 'From', to: 'To',
    who: { all: 'Everyone', f: 'Ladies', m: 'Men' },
    door: 'The door', reentry: 'Coming back within (minutes) is the same visit', grace: 'Grace days after a membership ends', self: 'Members check themselves in at the door screen',
    reminder: 'Renewal reminder message', reminderHint: 'You can use {name} {plan} {date} {gym}', openDoor: 'Open the door screen', resetDoor: 'New screen link', resetSure: 'Every open screen will stop. Go ahead?',
    saved: 'Saved', edit: 'Edit', color: 'Colour', doorHint: 'A TV or tablet at the entrance: it greets every member, shows today’s classes and how many are training now.',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  start: {
    title: 'Start your gym on Hemlo', sub: '30 days free, with everything. No card, no commitment.', name: 'Gym name', namePh: '{name}’s Gym', city: 'City', cityPh: 'Baghdad',
    who: 'Who trains with you', whoOpts: { all: 'Everyone', m: 'Men', f: 'Women' }, go: 'Start the free trial', used: 'You’ve already used your free trial.',
  },
  door: {
    start: 'Start the screen', sound: 'Sound', scanHere: 'Scan your card here', welcome: 'Welcome, {name}', see: 'Please see the front desk', inNow: 'training now',
    classes: 'Today’s classes', noClasses: 'No classes today', ladiesUntil: 'Ladies’ hours until {t}', menUntil: 'Men’s hours until {t}', openUntil: 'Open until {t}', closedNow: 'Closed now',
    spots: '{n} places left', full: 'Full', reset: 'This screen’s link was changed. Open the new one from the app.', offline: 'Reconnecting…', nolink: 'Open this screen from the gym’s app.',
    days: '{n} days left', visits: '{n} visits left', last: 'Last day · renew at the desk', again: 'Welcome back', camera: 'Camera', fullscreen: 'Full screen',
    mottos: ['Every day you show up counts.', 'Consistency beats motivation.', 'Drink water between sets.', 'Slow progress is still progress.', 'Rack your weights when you’re done.'],
  },
  importPlan: 'Previous membership',
  common: { save: 'Save', cancel: 'Cancel', close: 'Close', edit: 'Edit', add: 'Add', back: 'Back', all: 'All', none: '—', optional: 'optional', yes: 'Yes', no: 'No', more: 'More', done: 'Done' },
  errors: {
    MEMBER_NOT_FOUND: 'Member not found.', CARD_UNKNOWN: 'That card isn’t one of ours.', PRICE_LOCKED: 'Only a manager can change the price. You can give a discount.', NO_FREEZE_LEFT: 'No pause days left on this membership.',
    CANT_FREEZE: 'Only a running membership can be paused.', NOT_FROZEN: 'This membership isn’t paused.', CLASS_FULL: 'That class is full.', CLASS_GENDER: 'That class is for the other gender.', ALREADY_BOOKED: 'Already booked.',
    BAD_CLASS: 'No class that day.', NO_VISITS_LEFT: 'No sessions left.', NOT_ACTIVE: 'This membership isn’t active.', FROZEN: 'This membership is paused.', TOO_LATE: 'Too late to undo.', TRIAL_USED: 'You’ve already used your free trial.',
    ALREADY_A_TRAINER: 'That account is already a coach here.', BAD_HOURS: 'Check the hours: each must end after it starts.', EMPTY_MEASURE: 'Enter at least one measurement.', SELF_CHECKIN_OFF: 'Self check-in is off.',
    BAD_PLAN: 'Choose a membership.', ALREADY_CANCELED: 'Already cancelled.', BAD_DATE: 'That date isn’t right.',
  },
};

export type GStrings = typeof ar;
export const GSTRINGS: Record<Lang, GStrings> = { ar, en, ckb };
/** The gym's words in the app's language, and an error message that knows the gym's codes. */
export function useG() {
  const app = useApp();
  const g = GSTRINGS[app.lang];
  const err = (e: any) => (e?.code && g.errors[e.code]) || app.errorText(e);
  return { ...app, g, err };
}
