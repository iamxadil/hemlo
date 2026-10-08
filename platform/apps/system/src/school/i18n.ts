// Hemlo School's words: Arabic first (as Iraqi schools say it), English. Kurdish shows the Arabic until a native speaker
// writes it, like the other editions.
import { useApp } from '../lib/app';

const ar = {
  nav: { today: 'اليوم', students: 'الطلاب', student: 'ملف الطالب', attendance: 'الحضور', fees: 'الأقساط', school: 'المدرسة', plan: 'الاشتراك', settings: 'الإعدادات', more: 'المزيد' },
  shell: { search: 'ابحث عن طالب أو وليّ أمر…', searchHint: 'الاسم، رقم الطالب، أو هاتف وليّ الأمر', addStudent: 'طالب جديد', takeRoll: 'تسجيل الحضور', collect: 'استلام قسط', go: 'انتقل', students: 'الطلاب', actions: 'إجراءات', none: 'لا نتائج لـ «{q}»', keys: '↑↓ للتنقل · Enter للفتح · Esc للإغلاق', year: 'العام الدراسي {y}', signOut: 'تسجيل الخروج', morning: 'صباح الخير', evening: 'مساء الخير' },
  roles: { owner: 'المالك', admin: 'المدير', manager: 'الإدارة', teacher: 'معلم', receptionist: 'شؤون الطلاب', accountant: 'المحاسب', viewer: 'اطّلاع' } as Record<string, string>,
  kinds: { school: 'مدرسة أهلية', institute: 'معهد تقوية', kindergarten: 'روضة' } as Record<string, string>,
  marks: { present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'مُجاز' } as Record<string, string>,
  marksShort: { present: 'ح', absent: 'غ', late: 'ت', excused: 'ج' } as Record<string, string>,
  methods: { cash: 'نقداً', fib: 'FIB', zaincash: 'زين كاش', transfer: 'تحويل', other: 'أخرى' } as Record<string, string>,
  relations: { father: 'الأب', mother: 'الأم', brother: 'الأخ', sister: 'الأخت', grandparent: 'الجد/الجدة', uncle: 'العم/الخال', guardian: 'وليّ الأمر' } as Record<string, string>,
  chargeKinds: { tuition: 'قسط', registration: 'تسجيل', transport: 'نقل', books: 'كتب', uniform: 'زي', activity: 'نشاط', discount: 'خصم', other: 'أخرى' } as Record<string, string>,
  gender: { m: 'ذكر', f: 'أنثى' } as Record<string, string>,
  today: {
    attendance: 'حضور اليوم', taken: '{n} من {total} صفاً سُجّل', notYet: 'لم يُسجَّل بعد', absentN: '{n} غائب', lateN: '{n} متأخر', present: 'حاضرون',
    classes: 'الصفوف', takeIt: 'سجّل الحضور', done: 'تم', absentToday: 'الغائبون اليوم', noAbsent: 'لا غياب اليوم حتى الآن 🎉', thisMonth: 'غاب {n} مرات هذا الشهر',
    collectedToday: 'استُلم اليوم', collectedMonth: 'هذا الشهر {v}', late: 'أقساط متأخرة', lateStudents: '{n} طالب', weekDue: 'يستحق هذا الأسبوع', seeFees: 'كل الأقساط',
    noClasses: 'لا صفوف بعد. أضف الصفوف من صفحة المدرسة.', message: 'رسالة لوليّ الأمر',
  },
  students: {
    title: 'الطلاب', count: '{n} طالب', search: 'ابحث بالاسم أو الرقم أو هاتف وليّ الأمر', all: 'الكل', owing: 'عليهم أقساط متأخرة', empty: 'لا طلاب بعد', emptyBody: 'أضف أول طالب، أو أدخل صفاً كاملاً دفعة واحدة.',
    noMatch: 'لا طالب يطابق بحثك.', more: 'عرض المزيد', number: 'رقم {n}', add: 'طالب جديد', addTitle: 'تسجيل طالب جديد', addSub: 'يُضاف إلى الصف، ويُطبَّق عليه قسط السنة تلقائياً.',
    name: 'اسم الطالب الثلاثي', gender: 'الجنس', klass: 'الصف', birth: 'تاريخ الميلاد', guardian: 'وليّ الأمر', guardianName: 'اسم وليّ الأمر', relation: 'الصلة', phone: 'رقم الهاتف (واتساب)',
    phoneHint: 'إن كان لوليّ الأمر طالب آخر عندكم، يُربطان تلقائياً.', health: 'ملاحظات صحية', healthHint: 'حساسية، أمراض مزمنة… تظهر للكادر عند الحاجة', save: 'تسجيل الطالب', added: 'سُجّل {name} برقم {n}',
    balance: 'عليه {v}', overdue: 'متأخر {v}', paid: 'مسدَّد', noClass: 'بلا صف',
  },
  file: {
    overview: 'نظرة عامة', fees: 'الأقساط', attendance: 'الحضور', guardians: 'أولياء الأمر', siblings: 'إخوته في المدرسة', health: 'تنبيه صحي', details: 'التفاصيل', joined: 'سُجّل في', born: 'مواليد',
    familyLink: 'رابط وليّ الأمر', familyLinkHint: 'صفحة خاصة يرى فيها وليّ الأمر الحضور والأقساط، دون تطبيق.', copy: 'نسخ الرابط', copied: 'نُسخ الرابط', send: 'إرسال على واتساب', newLink: 'رابط جديد (يُبطل القديم)',
    linkMsg: 'السلام عليكم {name}، هذه صفحة {student} في {school}: الحضور والأقساط أولاً بأول.\n{link}', addGuardian: 'إضافة وليّ أمر', move: 'نقل إلى صف آخر', moved: 'نُقل إلى {klass}',
    charged: 'المطلوب', paidT: 'المدفوع', balance: 'المتبقي', overdue: 'المتأخر', nextDue: 'القسط القادم {date}', noCharges: 'لا أقساط مسجّلة.', receipt: 'وصل رقم {n}', voided: 'ملغى',
    addCharge: 'إضافة مبلغ أو خصم', void: 'إلغاء الوصل', voidAsk: 'سبب الإلغاء', voidDo: 'ألغِ الوصل', voidedOk: 'أُلغي الوصل', print: 'طباعة', ledger: 'الحساب',
    absentDays: 'أيام الغياب', lateDays: 'أيام التأخر', presentDays: 'أيام الحضور', last120: 'آخر ٤ أشهر', noAttendance: 'لم يُسجَّل حضور بعد.', status: { active: 'مستمر', left: 'منسحب', graduated: 'متخرّج' } as Record<string, string>,
  },
  pay: {
    title: 'استلام مبلغ', for: 'من {student}', amount: 'المبلغ', method: 'طريقة الدفع', payer: 'اسم الدافع (اختياري)', note: 'ملاحظة (اختياري)', overdue: 'المتأخر', next: 'القسط القادم', all: 'كامل المتبقي',
    take: 'استلام {v}', done: 'استُلم {v} · وصل رقم {n}', receiptTitle: 'وصل قبض', receiptNo: 'رقم الوصل', student: 'الطالب', klass: 'الصف', received: 'المبلغ المستلم', by: 'استلمه', after: 'المتبقي بعد الدفع',
    print: 'طباعة الوصل', whatsapp: 'إرسال الوصل على واتساب', close: 'تم', receiptMsg: 'السلام عليكم، استلمنا {amount} عن {student} (وصل رقم {n}). المتبقي: {balance}. شكراً لكم — {school}',
    charge: { title: 'إضافة مبلغ أو خصم', kind: 'النوع', label: 'الوصف', amount: 'المبلغ', due: 'تاريخ الاستحقاق', save: 'إضافة', discountHint: 'الخصم يُطرح من المطلوب.' },
  },
  roll: {
    title: 'الحضور', klass: 'الصف', day: 'اليوم', allPresent: 'الكل حاضر', save: 'حفظ الحضور', saved: 'حُفظ حضور {klass}', summary: '{p} حاضر · {a} غائب · {l} متأخر', empty: 'لا طلاب في هذا الصف.',
    taken: 'سُجّل الحضور {time}', notTaken: 'لم يُسجَّل بعد', tapHint: 'اضغط على الطالب لتبديل الحالة', notify: 'أخبر أولياء أمور الغائبين', absentMsg: 'السلام عليكم، نود إعلامكم بأن {student} غاب اليوم {date}. نتمنى له السلامة. — {school}',
    lateMsg: 'السلام عليكم، وصل {student} متأخراً اليوم {date}. — {school}', prev: 'اليوم السابق', next: 'اليوم التالي', note: 'ملاحظة', unsaved: 'تغييرات غير محفوظة',
  },
  fees: {
    title: 'الأقساط', collectedToday: 'اليوم', collectedMonth: 'هذا الشهر', collectedYear: 'هذا العام', ofDue: '{p}٪ من المستحق حتى اليوم', late: 'المتأخرون', soon: 'يستحق قريباً', receipts: 'الوصولات', plans: 'خطط الأقساط',
    noLate: 'لا أقساط متأخرة. ممتاز!', noSoon: 'لا أقساط تستحق خلال أسبوعين.', noReceipts: 'لا وصولات بعد.', remind: 'تذكير', collect: 'استلام', lastPaid: 'آخر دفعة {date}', never: 'لم يدفع بعد', due: 'يستحق {date}',
    remindMsg: 'السلام عليكم، تذكير لطيف: على {student} مبلغ {amount} مستحق. {link} شكراً لتعاونكم — {school}', newPlan: 'خطة أقساط جديدة', planName: 'اسم الخطة', grade: 'الصفوف', allGrades: 'كل الصفوف',
    installments: 'الدفعات', addInstallment: 'إضافة دفعة', label: 'الوصف', dueOn: 'تاريخ الاستحقاق', amount: 'المبلغ', total: 'المجموع', savePlan: 'حفظ وتطبيق على الطلاب', planSaved: 'حُفظت الخطة وطُبّقت على {n} قسطاً',
    planHint: 'تُطبَّق على الطلاب المسجّلين الآن وعلى كل طالب يُسجَّل بعدها.', noPlans: 'لا خطط بعد. أنشئ خطة القسط السنوي لتُحسب الأقساط تلقائياً.', total2: 'المجموع {v}', retire: 'إيقاف', active: 'فعّالة', retired: 'متوقفة',
    voidedTag: 'ملغى', expected: 'المطلوب هذا العام {v}',
  },
  setup: {
    title: 'المدرسة', details: 'معلومات المدرسة', kind: 'النوع', city: 'المدينة', phone: 'الهاتف', whatsapp: 'واتساب', save: 'حفظ', saved: 'حُفظ', grades: 'الصفوف والشعب', gradesHint: 'كل صف دراسي وشُعبه لهذا العام، ومعلم كل شعبة.',
    addGrade: 'إضافة صف', gradeName: 'اسم الصف', addSection: 'شعبة', sectionName: 'اسم الشعبة', teacher: 'مربّي الشعبة', noTeacher: 'بلا مربٍّ', room: 'القاعة', students: '{n} طالب', remove: 'حذف',
    year: 'العام الدراسي', current: 'الحالي', newYear: 'بدء عام دراسي جديد', newYearHint: 'تُنسخ الصفوف والشعب ومربّوها إلى العام الجديد. الطلاب يُنقلون لاحقاً.', starts: 'يبدأ', ends: 'ينتهي', startYear: 'ابدأ العام',
    messages: 'رسائل أولياء الأمور', absentText: 'رسالة الغياب', feeText: 'رسالة تذكير القسط', placeholders: 'يمكن استخدام: {student} {date} {amount} {school} {link}',
    stages: { kg: 'روضة', primary: 'ابتدائي', intermediate: 'متوسط', preparatory: 'إعدادي', course: 'دورة' } as Record<string, string>,
  },
  start: {
    title: 'لنبدأ مدرستك', sub: '٣٠ يوماً مجاناً. تُجهَّز الصفوف تلقائياً، وتستطيع تعديلها متى شئت.', name: 'اسم المدرسة أو المعهد', kind: 'نوعها', city: 'المدينة', phone: 'هاتف المدرسة (واتساب)',
    go: 'ابدأ مجاناً', skip: 'ليس الآن', kindSub: { school: 'ابتدائي، يُجهَّز بستة صفوف', institute: 'دورات للصفوف المنتهية', kindergarten: 'روضة وتمهيدي' } as Record<string, string>,
  },
  family: {
    hello: 'أهلاً {name}', sub: 'صفحة خاصة بك من {school}', attendance: 'الحضور (آخر ٣٠ يوماً)', absent: 'غياب', late: 'تأخر', present: 'حضور', owed: 'المتبقي', overdue: 'متأخر',
    next: 'القسط القادم', last: 'آخر دفعة', receipt: 'وصل {n}', allPaid: 'لا مبالغ متأخرة', call: 'اتصل بالمدرسة', message: 'راسل المدرسة', notFound: 'هذا الرابط لم يعد يعمل', notFoundBody: 'اطلب من المدرسة رابطاً جديداً.',
    powered: 'بواسطة هيملو للمدارس',
  },
  errors: {
    BAD_NAME: 'اكتب الاسم', BAD_CLASS: 'اختر الصف', BAD_PHONE: 'رقم الهاتف غير صحيح', BAD_AMOUNT: 'مبلغ غير صحيح', BAD_INSTALLMENTS: 'تحقّق من الدفعات: الوصف والتاريخ والمبلغ', DUPLICATE_LABEL: 'وصف كل دفعة يجب أن يختلف',
    TOO_OLD: 'لا يمكن تعديل حضور أقدم من أسبوع', FUTURE_DAY: 'لا يمكن تسجيل حضور يوم لم يأتِ', CLASS_HAS_STUDENTS: 'في الشعبة طلاب؛ انقلهم أولاً', NO_YEAR: 'لا عام دراسي حالي', TRIAL_USED: 'استخدمت التجربة المجانية من قبل',
  } as Record<string, string>,
};

const en: typeof ar = {
  nav: { today: 'Today', students: 'Students', student: 'Student', attendance: 'Attendance', fees: 'Fees', school: 'School', plan: 'Plan', settings: 'Settings', more: 'More' },
  shell: { search: 'Search a student or parent…', searchHint: 'Name, student number, or a parent’s phone', addStudent: 'New student', takeRoll: 'Take attendance', collect: 'Take a payment', go: 'Go to', students: 'Students', actions: 'Actions', none: 'Nothing for “{q}”', keys: '↑↓ to move · Enter to open · Esc to close', year: 'School year {y}', signOut: 'Sign out', morning: 'Good morning', evening: 'Good evening' },
  roles: { owner: 'Owner', admin: 'Admin', manager: 'Management', teacher: 'Teacher', receptionist: 'Registrar', accountant: 'Accountant', viewer: 'View only' },
  kinds: { school: 'Private school', institute: 'Tutoring institute', kindergarten: 'Kindergarten' },
  marks: { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' },
  marksShort: { present: 'P', absent: 'A', late: 'L', excused: 'E' },
  methods: { cash: 'Cash', fib: 'FIB', zaincash: 'ZainCash', transfer: 'Transfer', other: 'Other' },
  relations: { father: 'Father', mother: 'Mother', brother: 'Brother', sister: 'Sister', grandparent: 'Grandparent', uncle: 'Uncle', guardian: 'Guardian' },
  chargeKinds: { tuition: 'Tuition', registration: 'Registration', transport: 'Bus', books: 'Books', uniform: 'Uniform', activity: 'Activity', discount: 'Discount', other: 'Other' },
  gender: { m: 'Boy', f: 'Girl' },
  today: {
    attendance: 'Today’s attendance', taken: '{n} of {total} classes taken', notYet: 'Not taken yet', absentN: '{n} absent', lateN: '{n} late', present: 'present',
    classes: 'Classes', takeIt: 'Take attendance', done: 'Done', absentToday: 'Absent today', noAbsent: 'No one absent so far 🎉', thisMonth: 'Absent {n} times this month',
    collectedToday: 'Collected today', collectedMonth: 'This month {v}', late: 'Late fees', lateStudents: '{n} students', weekDue: 'Due this week', seeFees: 'All fees',
    noClasses: 'No classes yet. Add them on the School page.', message: 'Message the parent',
  },
  students: {
    title: 'Students', count: '{n} students', search: 'Search by name, number or a parent’s phone', all: 'All', owing: 'Late on fees', empty: 'No students yet', emptyBody: 'Add your first student, or bring a whole class in at once.',
    noMatch: 'No student matches your search.', more: 'Show more', number: 'No. {n}', add: 'New student', addTitle: 'Admit a student', addSub: 'Added to the class, with the year’s tuition applied automatically.',
    name: 'Student’s full name', gender: 'Gender', klass: 'Class', birth: 'Date of birth', guardian: 'Parent', guardianName: 'Parent’s name', relation: 'Relation', phone: 'Phone (WhatsApp)',
    phoneHint: 'If this parent has another child here, they’re linked automatically.', health: 'Health notes', healthHint: 'Allergies, conditions… shown to staff when it matters', save: 'Admit student', added: '{name} admitted as no. {n}',
    balance: 'Owes {v}', overdue: 'Late {v}', paid: 'Paid up', noClass: 'No class',
  },
  file: {
    overview: 'Overview', fees: 'Fees', attendance: 'Attendance', guardians: 'Parents', siblings: 'Brothers and sisters here', health: 'Health note', details: 'Details', joined: 'Joined', born: 'Born',
    familyLink: 'Parent’s link', familyLinkHint: 'A private page where the parent sees attendance and fees, no app needed.', copy: 'Copy link', copied: 'Link copied', send: 'Send on WhatsApp', newLink: 'New link (the old one stops)',
    linkMsg: 'Hello {name}, this is {student}’s page at {school}: attendance and fees, always up to date.\n{link}', addGuardian: 'Add a parent', move: 'Move to another class', moved: 'Moved to {klass}',
    charged: 'Charged', paidT: 'Paid', balance: 'Balance', overdue: 'Late', nextDue: 'Next instalment {date}', noCharges: 'No fees recorded.', receipt: 'Receipt no. {n}', voided: 'Void',
    addCharge: 'Add a charge or discount', void: 'Void receipt', voidAsk: 'Why void it?', voidDo: 'Void receipt', voidedOk: 'Receipt voided', print: 'Print', ledger: 'Account',
    absentDays: 'Days absent', lateDays: 'Days late', presentDays: 'Days present', last120: 'Last 4 months', noAttendance: 'No attendance yet.', status: { active: 'Enrolled', left: 'Left', graduated: 'Graduated' },
  },
  pay: {
    title: 'Take a payment', for: 'From {student}', amount: 'Amount', method: 'Method', payer: 'Paid by (optional)', note: 'Note (optional)', overdue: 'Late', next: 'Next instalment', all: 'Full balance',
    take: 'Take {v}', done: '{v} received · receipt no. {n}', receiptTitle: 'Payment receipt', receiptNo: 'Receipt no.', student: 'Student', klass: 'Class', received: 'Amount received', by: 'Received by', after: 'Balance after',
    print: 'Print receipt', whatsapp: 'Send receipt on WhatsApp', close: 'Done', receiptMsg: 'Hello, we received {amount} for {student} (receipt no. {n}). Balance: {balance}. Thank you — {school}',
    charge: { title: 'Add a charge or discount', kind: 'Type', label: 'Description', amount: 'Amount', due: 'Due on', save: 'Add', discountHint: 'A discount is taken off what is owed.' },
  },
  roll: {
    title: 'Attendance', klass: 'Class', day: 'Day', allPresent: 'All present', save: 'Save attendance', saved: '{klass} saved', summary: '{p} present · {a} absent · {l} late', empty: 'No students in this class.',
    taken: 'Taken {time}', notTaken: 'Not taken yet', tapHint: 'Tap a student to change their mark', notify: 'Tell the absent students’ parents', absentMsg: 'Hello, {student} was absent today, {date}. We hope all is well. — {school}',
    lateMsg: 'Hello, {student} arrived late today, {date}. — {school}', prev: 'Previous day', next: 'Next day', note: 'Note', unsaved: 'Unsaved changes',
  },
  fees: {
    title: 'Fees', collectedToday: 'Today', collectedMonth: 'This month', collectedYear: 'This year', ofDue: '{p}% of what is due by today', late: 'Late', soon: 'Due soon', receipts: 'Receipts', plans: 'Fee plans',
    noLate: 'No late fees. Excellent!', noSoon: 'Nothing falls due in the next two weeks.', noReceipts: 'No receipts yet.', remind: 'Remind', collect: 'Take', lastPaid: 'Last paid {date}', never: 'Hasn’t paid yet', due: 'Due {date}',
    remindMsg: 'Hello, a gentle reminder: {amount} is due for {student}. {link} Thank you — {school}', newPlan: 'New fee plan', planName: 'Plan name', grade: 'Grades', allGrades: 'All grades',
    installments: 'Instalments', addInstallment: 'Add an instalment', label: 'Description', dueOn: 'Due on', amount: 'Amount', total: 'Total', savePlan: 'Save and apply to students', planSaved: 'Plan saved, {n} instalments added',
    planHint: 'Applied to the students enrolled now and to every student admitted after.', noPlans: 'No plans yet. Create the yearly tuition plan and instalments are worked out for you.', total2: 'Total {v}', retire: 'Retire', active: 'Active', retired: 'Retired',
    voidedTag: 'Void', expected: 'Expected this year {v}',
  },
  setup: {
    title: 'School', details: 'School details', kind: 'Type', city: 'City', phone: 'Phone', whatsapp: 'WhatsApp', save: 'Save', saved: 'Saved', grades: 'Grades and sections', gradesHint: 'Every grade and its sections this year, with each section’s teacher.',
    addGrade: 'Add a grade', gradeName: 'Grade name', addSection: 'Section', sectionName: 'Section name', teacher: 'Homeroom teacher', noTeacher: 'No teacher', room: 'Room', students: '{n} students', remove: 'Remove',
    year: 'School year', current: 'Current', newYear: 'Start a new school year', newYearHint: 'Grades, sections and their teachers are copied to the new year. Students move later.', starts: 'Starts', ends: 'Ends', startYear: 'Start the year',
    messages: 'Messages to parents', absentText: 'Absence message', feeText: 'Fee reminder', placeholders: 'You can use: {student} {date} {amount} {school} {link}',
    stages: { kg: 'Kindergarten', primary: 'Primary', intermediate: 'Intermediate', preparatory: 'Preparatory', course: 'Course' },
  },
  start: {
    title: 'Let’s start your school', sub: '30 days free. Your grades are set up for you, and you can change them any time.', name: 'School or institute name', kind: 'Type', city: 'City', phone: 'School phone (WhatsApp)',
    go: 'Start free', skip: 'Not now', kindSub: { school: 'Primary, six grades set up', institute: 'Courses for exam years', kindergarten: 'Kindergarten and preparatory' },
  },
  family: {
    hello: 'Hello {name}', sub: 'Your private page from {school}', attendance: 'Attendance (last 30 days)', absent: 'Absent', late: 'Late', present: 'Present', owed: 'Balance', overdue: 'Late',
    next: 'Next instalment', last: 'Last payment', receipt: 'Receipt {n}', allPaid: 'Nothing late', call: 'Call the school', message: 'Message the school', notFound: 'This link no longer works', notFoundBody: 'Ask the school for a new link.',
    powered: 'By Hemlo School',
  },
  errors: {
    BAD_NAME: 'Write the name', BAD_CLASS: 'Choose the class', BAD_PHONE: 'That phone number isn’t right', BAD_AMOUNT: 'That amount isn’t right', BAD_INSTALLMENTS: 'Check the instalments: description, date and amount', DUPLICATE_LABEL: 'Each instalment needs its own description',
    TOO_OLD: 'Attendance older than a week can’t be changed', FUTURE_DAY: 'That day hasn’t come yet', CLASS_HAS_STUDENTS: 'The section has students; move them first', NO_YEAR: 'No current school year', TRIAL_USED: 'You’ve used the free trial before',
  },
};

export type SStrings = typeof ar;
export const SSTRINGS = { ar, en };
export const sOf = (lang: string): SStrings => (lang === 'en' ? en : ar);

/** The app's context plus the School's words. */
export function useS() {
  const app = useApp();
  return { ...app, s: sOf(app.lang) };
}
