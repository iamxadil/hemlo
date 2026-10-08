// Hemlo's legal pages, Arabic (default) and English: one source for hemlohq.com/legal/ and its documents.
// A block is a paragraph (string) or a list (string[]). In text, {doc:slug} becomes a link to that document and
// {email} the contact address. Written to be read by a shop owner, not a lawyer; a lawyer should still review it.
import type { Lang } from './strings';

export type Block = string | string[];
export type LegalDoc = { slug: string; title: string; short: string; summary: string; sections: [string, Block[]][] };
export type LegalSet = {
  hubTitle: string; hubIntro: string; eyebrow: string; updated: string; contents: string; others: string; questions: string; questionsBody: string;
  company: [string, string][]; docs: LegalDoc[];
};

export const LEGAL_UPDATED = '2026-10-08';
export const LEGAL_SLUGS = ['terms', 'privacy', 'data', 'billing', 'acceptable-use', 'ai', 'cookies'] as const;

const ar: LegalSet = {
  eyebrow: 'الشؤون القانونية',
  hubTitle: 'الشروط والسياسات',
  hubIntro: 'الشروط التي تعمل بها هيملو، مكتوبة لتُقرأ. إن لم يتضح شيء، راسلنا وسنشرحه.',
  updated: 'آخر تحديث: ٨ تشرين الأول ٢٠٢٦',
  contents: 'المحتويات',
  others: 'وثائق أخرى',
  questions: 'سؤال عن هذه الشروط؟',
  questionsBody: 'راسلنا على {email} وسنرد خلال يومَي عمل.',
  company: [['الشركة', 'هيملو (Hemlo)'], ['المقر', 'بغداد، العراق'], ['المؤسس', 'عادل تحسين'], ['البريد', 'hello@hemlohq.com'], ['الموقع', 'hemlohq.com']],
  docs: [
    {
      slug: 'terms', title: 'شروط الخدمة', short: 'شروط الخدمة',
      summary: 'الاتفاق بينك وبين هيملو عند استخدامك أي منتج من منتجاتها.',
      sections: [
        ['من نحن', [
          'هيملو («هيملو» أو «نحن») شركة برمجيات مقرها بغداد، العراق. تشمل هذه الشروط كل منتجاتنا:',
          ['أنظمة هيملو (المتاجر، النوادي الرياضية، عيادات الأسنان، مكاتب العقارات) على system.hemlohq.com',
            'حساب هيملو على account.hemlohq.com',
            'أدوات هيملو المجانية على tools.hemlohq.com',
            'الموقع hemlohq.com وكل صفحاته'],
          'أعمال استوديو هيملو (مواقع وتطبيقات تُبنى حسب الطلب) يحكمها اتفاق مكتوب خاص بكل مشروع، وتنطبق هذه الشروط فيما لم يذكره ذلك الاتفاق.',
        ]],
        ['قبول الشروط', [
          'بإنشائك حساباً أو استخدامك خدماتنا فأنت توافق على هذه الشروط وعلى {doc:privacy}. إن كنت تستخدم هيملو باسم عمل تجاري، فأنت تؤكد أنك مخوّل بإلزامه بها.',
          'يجب أن يكون عمرك ١٨ سنة أو أكثر لإنشاء حساب.',
        ]],
        ['حسابك', [
          ['قدّم معلومات صحيحة وحدّثها عند تغيّرها.',
            'احفظ وسائل الدخول (رموز التحقق ومفاتيح المرور) ولا تشاركها.',
            'أنت مسؤول عمّا يحدث في حسابك وعمّا يفعله موظفوك الذين تمنحهم الوصول.',
            'صاحب العمل يتحكم بمن يدخل وبصلاحيات كل موظف، ويستطيع إيقاف الوصول في أي وقت.',
            'أخبرنا فوراً إن شككت أن أحداً دخل حسابك دون إذن.'],
        ]],
        ['بياناتك ملكك', [
          'كل ما تُدخله في هيملو من منتجات ومبيعات وزبائن ومشتركين ومرضى وعقارات وعقود هو ملكك. تمنحنا إذناً محدوداً بحفظه ومعالجته وعرضه لك ولموظفيك فقط لتقديم الخدمة، كما توضح {doc:privacy} و{doc:data}.',
          'لا نبيع بياناتك، ولا نستخدمها للإعلانات، ولا نستخدم محتوى عملك لتدريب نماذج الذكاء الاصطناعي.',
          'تستطيع تصدير بياناتك في أي وقت، حتى بعد انتهاء اشتراكك.',
        ]],
        ['التجربة والخطط والدفع', [
          'يبدأ كل عمل جديد بتجربة مجانية مدتها ٣٠ يوماً، ثم يختار خطة مدفوعة ليستمر. تفاصيل الأسعار والدفع والتجديد والاسترداد في {doc:billing}.',
        ]],
        ['الاستخدام المقبول', [
          'استخدم هيملو لعمل مشروع وبطريقة لا تضر غيرك. ما لا نسمح به مذكور في {doc:acceptable-use}، ومخالفته قد تؤدي إلى إيقاف الحساب.',
        ]],
        ['مزايا الذكاء الاصطناعي', [
          'بعض المزايا تستعمل الذكاء الاصطناعي لتقترح مسودة (مثل قراءة فاتورة من صورة). المسودة تراجعها أنت قبل الحفظ، وقد تكون فيها أخطاء. التفاصيل في {doc:ai}.',
        ]],
        ['توفر الخدمة وتغييرها', [
          'نعمل لتبقى هيملو متاحة وسريعة، لكننا لا نضمن خدمة بلا انقطاع: قد تتوقف لصيانة أو لعطل لدى مزوّدينا أو في الإنترنت.',
          'نطوّر هيملو باستمرار، فقد نضيف مزايا أو نغيّرها. إن أزلنا ميزة مهمة من خطة مدفوعة فسنخبرك مسبقاً.',
          'الحسابات التجريبية (العرض التوضيحي) مؤقتة وتُحذف خلال ٢٤ ساعة.',
        ]],
        ['مسؤوليتك القانونية عن عملك', [
          'هيملو أداة لإدارة عملك، والالتزامات القانونية لعملك تبقى عليك، ومنها:',
          ['الضرائب والفواتير والسجلات التجارية.',
            'حفظ السجلات الطبية وسريتها في عيادتك.',
            'موافقة زبائنك ومرضاك ومشتركيك على حفظ بياناتهم والتواصل معهم.',
            'صحة الإعلانات العقارية ومحتوى العقود التي تصدرها.'],
          'قوالب العقود والمستندات التي يولّدها النظام نقطة بداية مفيدة وليست استشارة قانونية؛ راجعها مع مختص عند الحاجة.',
        ]],
        ['الملكية الفكرية', [
          'برمجيات هيملو وتصميمها واسمها وعلامتها (حرف H) ملك لهيملو. نمنحك حقاً محدوداً وغير حصري وغير قابل للنقل لاستخدام الخدمات طوال اشتراكك.',
          'لا يجوز نسخ هيملو أو إعادة بيعها أو محاولة استخراج شيفرتها المصدرية.',
          'إن أرسلت لنا اقتراحاً أو ملاحظة فيحق لنا استعمالها لتحسين هيملو دون مقابل.',
        ]],
        ['إنهاء الاستخدام', [
          'تستطيع التوقف في أي وقت، وطلب حذف حسابك على {email}.',
          'قد نوقف حساباً أو ننهيه عند مخالفة جسيمة لهذه الشروط، أو عند عدم الدفع، أو إن طلب القانون ذلك. عند انتهاء الاشتراك دون دفع يصبح العمل للقراءة والتصدير فقط ولا تُحجب بياناته.',
          'عندما تطلب إغلاق عملك نحذف بياناته خلال ٩٠ يوماً، باستثناء ما يُلزمنا القانون بحفظه (مثل سجلات المدفوعات).',
        ]],
        ['إخلاء المسؤولية', [
          'نقدّم الخدمات «كما هي» وبالقدر الذي يسمح به القانون. لا نضمن أن تناسب كل احتياج، ولا أن تخلو نتائج الذكاء الاصطناعي من الأخطاء.',
        ]],
        ['حدود المسؤولية', [
          'لسنا مسؤولين عن الخسائر غير المباشرة، مثل فوات الربح أو خسارة ناتجة عن خطأ في إدخال البيانات أو عن استخدام الحساب من قبل شخص منحته الوصول.',
          'مجموع مسؤوليتنا تجاهك لا يتجاوز ما دفعته لهيملو خلال الأشهر الاثني عشر السابقة للمطالبة. ولا يحدّ هذا من أي مسؤولية لا يجوز تحديدها قانوناً.',
        ]],
        ['تغيير الشروط', [
          'قد نحدّث هذه الشروط، وننشر كل تحديث بتاريخه. التغييرات المهمة نخبرك بها قبل ١٤ يوماً على الأقل بالبريد أو داخل التطبيق. استمرارك في الاستخدام بعدها يعني موافقتك.',
        ]],
        ['القانون وحل النزاعات', [
          'تخضع هذه الشروط لقوانين جمهورية العراق. إن نشأ خلاف فتواصل معنا أولاً وسنحاول حلّه ودّياً، فإن تعذّر فالاختصاص لمحاكم بغداد.',
        ]],
        ['التواصل', ['راسلنا على {email}.']],
      ],
    },
    {
      slug: 'privacy', title: 'سياسة الخصوصية', short: 'الخصوصية',
      summary: 'ما الذي نجمعه، ولماذا، ومع من نشاركه، وما حقوقك.',
      sections: [
        ['نطاق هذه السياسة', [
          'تنطبق على hemlohq.com وحساب هيملو وأنظمتها وأدواتها. ولنا فيها دوران:',
          ['بيانات حسابك وعملك لدى هيملو: نحن المسؤولون عنها.',
            'البيانات التي يُدخلها عملك عن زبائنه ومرضاه ومشتركيه وعملائه: العمل هو المسؤول عنها، ونحن نعالجها نيابةً عنه، كما في {doc:data}.'],
        ]],
        ['ما نجمعه', [
          ['الحساب: الاسم، البريد الإلكتروني، رقم الهاتف، المفتاح العام لمفتاح المرور (لا نرى مفتاحك السري أبداً)، وسجلات الدخول (الوقت، نوع الجهاز، عنوان IP).',
            'العمل: الاسم، المدينة، النوع، الموظفون وأدوارهم، الخطة والمدفوعات.',
            'طلبات الوصول المبكر: الاسم، اسم العمل، الهاتف، المدينة، البريد.',
            'ما تُدخله في النظام: المنتجات، المبيعات، الفواتير، الزبائن، المشتركون، المرضى والزيارات، العقارات، العقود، والصور والملفات التي ترفعها.',
            'الاستخدام: أي المزايا تُستخدم، والأخطاء، وعدد استخدامات الذكاء الاصطناعي، لنشغّل هيملو ونحسّنها.',
            'الرسائل التي ترسلها لنا.'],
        ]],
        ['ما لا نفعله', [
          ['لا نبيع بياناتك.', 'لا نعرض إعلانات ولا نستخدم ملفات تعريف للتتبع.', 'لا نستخدم محتوى عملك لتدريب نماذج الذكاء الاصطناعي.'],
        ]],
        ['لماذا نستخدمها', [
          ['لتقديم الخدمات التي طلبتها وتشغيلها.', 'للأمان ومنع الاحتيال وحماية الحسابات.', 'للفوترة وتفعيل الخطط.', 'للدعم والرد على رسائلك.', 'لتحسين هيملو، بأرقام إجمالية لا تكشف عملاً بعينه.', 'للالتزام بالقانون.'],
        ]],
        ['من يعالج البيانات معنا', [
          'نستعين بمزوّدين موثوقين لتشغيل هيملو، وقد تكون خوادمهم خارج العراق:',
          ['Cloudflare: الاستضافة، وتخزين الملفات، وبعض نماذج الذكاء الاصطناعي.',
            'Neon: قاعدة البيانات.',
            'Resend: إرسال البريد الإلكتروني (رموز الدخول والدعوات).',
            'مزوّدو الذكاء الاصطناعي الذين نختارهم لمهمة معيّنة (مثل Google أو Anthropic أو OpenAI عبر واجهاتهم أو عبر OpenRouter وGroq): نرسل لهم فقط ما تحتاجه تلك المهمة، كصورة الفاتورة.',
            'جهات الدفع (مثل FIB وزين كاش) عندما تدفع عبرها.'],
          'لا نشارك بياناتك مع غيرهم إلا إن ألزمنا القانون بذلك.',
        ]],
        ['مدة الاحتفاظ', [
          ['بيانات الحساب: ما دام الحساب قائماً. عند حذفه تُزال خلال ٣٠ يوماً.',
            'بيانات العمل: ما دام العمل قائماً، وتُحذف خلال ٩٠ يوماً من طلب إغلاقه.',
            'سجلات المدفوعات: المدة التي يتطلبها القانون.',
            'سجلات الأمان والدخول: حتى ١٢ شهراً.',
            'العرض التوضيحي: يُحذف خلال ٢٤ ساعة.',
            'النسخ الاحتياطية تتجدد وتُستبدل تلقائياً خلال ٣٠ يوماً.'],
        ]],
        ['كيف نحميها', [
          ['كل الاتصالات مشفّرة (HTTPS)، والتخزين مشفّر لدى مزوّدينا.',
            'بيانات كل عمل معزولة عن غيره داخل قاعدة البيانات نفسها، فلا يرى عمل بيانات عمل آخر.',
            'دخول فريق هيملو إلى لوحة الإدارة بمفاتيح المرور فقط، وكل ما يفعله مسجّل.',
            'مفاتيح مزوّدي الذكاء الاصطناعي محفوظة مشفّرة.',
            'لا يطّلع أحد من فريقنا على بيانات عملك إلا لدعمك أو لإصلاح مشكلة أو إن طلب القانون ذلك.'],
        ]],
        ['حقوقك', [
          'يحق لك أن تطلب نسخة من بياناتك، أو تصحيحها، أو تصديرها، أو حذفها، أو أن تعترض على استخدام معيّن لها. راسلنا على {email} وسنرد خلال ٣٠ يوماً.',
          'إن كانت بياناتك محفوظة لدى عمل يستخدم هيملو (كأن تكون مريضاً في عيادة أو مشتركاً في نادٍ)، فتواصل مع ذلك العمل أولاً لأنه المسؤول عنها، وسنساعده في تلبية طلبك.',
        ]],
        ['الأطفال', [
          'خدماتنا للبالغين (١٨ سنة فأكثر). قد تحفظ الأعمال بيانات قاصرين (كمشترك في نادٍ أو مريض في عيادة)، وذلك على مسؤوليتها وبموافقة وليّ الأمر.',
        ]],
        ['ملفات تعريف الارتباط', ['نستخدم الحد الأدنى اللازم لتسجيل الدخول فقط. التفاصيل في {doc:cookies}.']],
        ['تغيير السياسة', ['قد نحدّث هذه السياسة وننشر كل تحديث بتاريخه، ونخبرك بالتغييرات المهمة مسبقاً.']],
        ['التواصل', ['لأي سؤال عن الخصوصية راسلنا على {email}.']],
      ],
    },
    {
      slug: 'data', title: 'شروط معالجة البيانات', short: 'معالجة البيانات',
      summary: 'كيف نتعامل مع بيانات زبائن عملك ومرضاه ومشتركيه وعملائه.',
      sections: [
        ['الأدوار', [
          'عملك هو المسؤول عن البيانات التي يحفظها عن الناس في هيملو، وهيملو تعالجها نيابةً عنه وبحسب تعليماته فقط، لغرض واحد: تقديم الخدمة.',
        ]],
        ['التزاماتك', [
          ['أن يكون لديك سبب مشروع أو موافقة لجمع بيانات الناس وحفظها.',
            'أن تكون لديك موافقة للتواصل معهم. تذكيرات واتساب في هيملو تُرسل من هاتفك وحسابك أنت، لا من هيملو.',
            'في عيادات الأسنان: البيانات الصحية حساسة؛ احصل على موافقة المريض والتزم بالسرية المهنية.',
            'امنح كل موظف الصلاحيات التي يحتاجها فقط، وأوقف وصول من يغادر.',
            'لا تنشر في صفحات العقارات العامة بيانات شخصية لمالك أو مستأجر.'],
        ]],
        ['التزاماتنا', [
          ['معالجة البيانات لتقديم الخدمة فقط، لا لأي غرض آخر.',
            'عزل بيانات كل عمل عن غيره.',
            'تطبيق إجراءات الأمان المذكورة في {doc:privacy}.',
            'إلزام فريقنا بالسرية، وتسجيل كل وصول إداري.',
            'عدم بيع البيانات أو مشاركتها إلا مع المزوّدين المذكورين أدناه.',
            'إخبارك دون تأخير (خلال ٧٢ ساعة من تأكدنا) إن حدث اختراق يمسّ بيانات عملك، مع ما نعرفه وما فعلناه.',
            'مساعدتك في الرد على طلبات الناس بخصوص بياناتهم.',
            'تمكينك من تصدير البيانات في أي وقت، وحذفها عند إغلاق العمل.'],
        ]],
        ['المزوّدون الفرعيون', [
          ['Cloudflare: الاستضافة وتخزين الملفات وبعض نماذج الذكاء الاصطناعي.',
            'Neon: قاعدة البيانات.',
            'Resend: البريد الإلكتروني.',
            'مزوّد الذكاء الاصطناعي المختار لكل مهمة: يتلقى فقط ما تحتاجه المهمة، وحين تستخدم تلك الميزة.'],
          'سنُعلن على هذه الصفحة عن أي مزوّد جديد قبل استخدامه لبيانات الأعمال.',
        ]],
        ['الصفحات العامة', [
          'إعلانات العقارات التي تختار نشرها (روابط hemlohq.com/p/) عامة بطبيعتها ويستطيع أي أحد فتحها. لا تُنشر إلا الحقائق التي تختارها.',
        ]],
        ['عند انتهاء العلاقة', [
          'تستطيع تصدير كل بياناتك في أي وقت، حتى بعد انتهاء الاشتراك. عند طلب الإغلاق نحذف البيانات خلال ٩٠ يوماً، ما عدا ما يلزمنا القانون بحفظه.',
        ]],
      ],
    },
    {
      slug: 'billing', title: 'الاشتراكات والدفع والاسترداد', short: 'الاشتراكات والدفع',
      summary: 'كيف تعمل التجربة والخطط والدفع والتجديد والاسترداد.',
      sections: [
        ['الخطط', [
          'لكل نظام (المتجر، النادي، العيادة، العقارات) خطط بحسب الحجم، وكل خطة فيها كل المزايا. الأسعار بالدينار العراقي ومعروضة على hemlohq.com وداخل التطبيق.',
        ]],
        ['التجربة المجانية', [
          '٣٠ يوماً مجاناً بأكبر خطة، دون أي بيانات دفع. في نهايتها تختار خطة لتستمر.',
        ]],
        ['الدفع', [
          ['شهرياً أو سنوياً، بالسعر المعروض عند الدفع.',
            'نقداً أو عبر FIB أو زين كاش أو تحويل مصرفي.',
            'تُفعّل الخطة بعد تأكيد استلام الدفعة، ونرسل لك ما يثبتها.',
            'إن كانت هناك ضريبة مستحقة فسنعرضها قبل الدفع.'],
        ]],
        ['التجديد', [
          'لا نسحب أي مبلغ تلقائياً. نذكّرك قبل نهاية المدة المدفوعة، وتجدد أنت عندما تريد.',
        ]],
        ['مهلة السماح وما بعدها', [
          'بعد نهاية المدة المدفوعة لديك ٧ أيام سماح يعمل فيها كل شيء كالمعتاد.',
          'بعدها يصبح العمل للقراءة والتصدير فقط: تفتح كل بياناتك وتصدّرها، لكن لا تضيف ولا تعدّل حتى تجدد. لا نحجب سجلاتك الطبية أو التجارية عنك أبداً.',
        ]],
        ['تغيير الخطة', [
          ['الترقية في أي وقت، وتدفع فرق السعر للمدة المتبقية.',
            'التخفيض عند التجديد التالي، إن كان استخدامك ضمن حدود الخطة الأصغر.'],
        ]],
        ['تغيير الأسعار', [
          'نخبرك بأي تغيير في الأسعار قبل ٣٠ يوماً على الأقل، والسعر الذي دفعته يبقى كما هو حتى نهاية المدة التي دفعتها.',
        ]],
        ['الاسترداد', [
          ['الخطة الشهرية: لا يُسترد مبلغ الشهر بعد بدئه.',
            'الخطة السنوية: استرداد كامل إن ألغيت خلال ١٤ يوماً من الدفع. بعدها لا يُسترد الباقي، ويبقى الوصول حتى نهاية السنة.',
            'إن توقفت هيملو بسبب منّا أكثر من ٧٢ ساعة متواصلة، نضيف إلى اشتراكك أياماً مقابلة دون طلب منك.'],
          'لطلب الاسترداد راسلنا على {email}.',
        ]],
        ['المؤسسات والاستوديو', [
          'خطط المؤسسات وأعمال استوديو هيملو لها عروض أسعار واتفاقات خاصة.',
        ]],
      ],
    },
    {
      slug: 'acceptable-use', title: 'سياسة الاستخدام المقبول', short: 'الاستخدام المقبول',
      summary: 'ما لا يُسمح به على هيملو، حمايةً لك وللأعمال الأخرى.',
      sections: [
        ['لا يُسمح بـ', [
          ['أي نشاط مخالف للقانون، أو احتيال، أو غسيل أموال.',
            'بيع بضائع ممنوعة أو مقلّدة، أو مواد تتطلب ترخيصاً لا تملكه.',
            'حفظ بيانات أشخاص دون حق، أو استعمال أرقامهم في هيملو لإزعاجهم أو لرسائل جماعية غير مرغوبة.',
            'محاولة الوصول إلى بيانات عمل آخر، أو فحص أنظمتنا أو مهاجمتها، أو تجاوز الحدود، أو سحب البيانات آلياً.',
            'محاولة استخراج الشيفرة المصدرية، أو نسخ هيملو، أو إعادة بيعها.',
            'مشاركة حساب واحد بين عدة أشخاص للالتفاف على حدود الخطة.',
            'رفع برمجيات خبيثة أو ملفات ضارة.',
            'نشر إعلانات عقارية كاذبة أو مضلِّلة.',
            'استعمال مزايا الذكاء الاصطناعي لإنتاج محتوى مسيء أو مضلِّل.'],
        ]],
        ['ما نفعله عند المخالفة', [
          'بحسب خطورة الأمر: ننبّهك، أو نوقف الحساب مؤقتاً، أو ننهيه. ونبلّغ الجهات المختصة إن ألزمنا القانون بذلك.',
        ]],
        ['الإبلاغ', ['إن رأيت إساءة استخدام لهيملو فأخبرنا على {email}.']],
      ],
    },
    {
      slug: 'ai', title: 'مزايا الذكاء الاصطناعي', short: 'الذكاء الاصطناعي',
      summary: 'كيف تعمل مزايا الذكاء الاصطناعي في هيملو، وما الذي يُرسل، ومن يقرر.',
      sections: [
        ['ما الذي يفعله', [
          ['قراءة فاتورة مورّد من صورة وتحويلها إلى مشتريات.',
            'الإجابة عن أسئلة عن عملك بالأرقام من بياناتك.',
            'تحويل صورة صفحة من سجلّ المشتركين إلى مشتركين في النظام.',
            'كتابة وصف لإعلان عقاري من حقائق العقار.',
            'البحث في العقارات والعملاء بسؤال عادي.'],
        ]],
        ['الإنسان يقرر', [
          'الذكاء الاصطناعي يكتب مسودة، وأنت تراجعها قبل الحفظ أو النشر. قد يخطئ (كأن يقرأ رقماً خطأ)، ولهذا نُظهر ما يحتاج إلى تدقيق. ما تحفظه أو تنشره مسؤوليتك.',
          'أرقام إجابات «اسأل متجرك» تأتي من بياناتك مباشرة، لا يخترعها النموذج.',
        ]],
        ['ما يُرسل', [
          'نرسل فقط ما تحتاجه المهمة (الصورة، أو السؤال، أو حقائق العقار) إلى مزوّد الذكاء الاصطناعي الذي يشغّل تلك المهمة، وقد يكون خارج العراق. نختار النموذج لكل مهمة بما يحقق الجودة والكلفة المناسبتين، وقد نغيّره.',
          'لا تستخدم هيملو محتوى عملك لتدريب النماذج.',
        ]],
        ['الحدود والتحكم', [
          'لكل خطة عدد شهري من استخدامات الذكاء الاصطناعي وحدّ يومي. ويستطيع صاحب العمل إيقاف كل مزايا الذكاء الاصطناعي من الإعدادات.',
        ]],
        ['ما ليس من عمله', [
          'لا تقرأ هيملو صور الأشعة ولا تتخذ قرارات طبية، ولا تقدّم استشارة قانونية عن العقود.',
        ]],
      ],
    },
    {
      slug: 'cookies', title: 'ملفات تعريف الارتباط', short: 'ملفات الارتباط',
      summary: 'نستخدم الحد الأدنى اللازم فقط، دون تتبع ولا إعلانات.',
      sections: [
        ['ما نستخدمه', [
          ['ملف جلسة الدخول: يُبقيك مسجّلاً في حساب هيملو. آمن ولا تقرؤه الصفحات.',
            'ملف «hemlo.hint»: يخبر الموقع أنك مسجّل لتظهر الأزرار المناسبة. لا يحمل أي بيانات شخصية.',
            'التخزين المحلي في المتصفح: اللغة والتفضيلات، ونسخة مؤقتة تجعل النظام أسرع وتعمل عند ضعف الاتصال، وجلسة العرض التوضيحي.'],
        ]],
        ['ما لا نستخدمه', ['لا ملفات إعلانية، ولا ملفات تتبع، ولا أدوات تحليل من جهات خارجية.']],
        ['التحكم', ['تستطيع حذف هذه الملفات أو حظرها من إعدادات متصفحك، لكن حظر ملف الجلسة يمنع تسجيل الدخول.']],
      ],
    },
  ],
};

const en: LegalSet = {
  eyebrow: 'Legal',
  hubTitle: 'Terms & policies',
  hubIntro: 'The terms Hemlo works under, written to be read. If anything is unclear, write to us and we’ll explain it.',
  updated: 'Last updated: 8 October 2026',
  contents: 'Contents',
  others: 'Other documents',
  questions: 'A question about these terms?',
  questionsBody: 'Write to {email} and we’ll reply within two working days.',
  company: [['Company', 'Hemlo (هيملو)'], ['Based in', 'Baghdad, Iraq'], ['Founder', 'Adil Tahseen'], ['Email', 'hello@hemlohq.com'], ['Website', 'hemlohq.com']],
  docs: [
    {
      slug: 'terms', title: 'Terms of Service', short: 'Terms of Service',
      summary: 'The agreement between you and Hemlo when you use any Hemlo product.',
      sections: [
        ['Who we are', [
          'Hemlo (“Hemlo”, “we”) is a software company based in Baghdad, Iraq. These terms cover all our products:',
          ['Hemlo Systems (Stores, Gyms, Dental clinics, Real estate offices) at system.hemlohq.com',
            'Your Hemlo account at account.hemlohq.com',
            'Hemlo’s free Tools at tools.hemlohq.com',
            'The website hemlohq.com and all its pages'],
          'Hemlo Studio work (websites and apps built to order) is governed by a written agreement for each project; these terms apply to anything that agreement doesn’t cover.',
        ]],
        ['Accepting these terms', [
          'By creating an account or using our services, you agree to these terms and to the {doc:privacy}. If you use Hemlo for a business, you confirm you are authorised to bind it to them.',
          'You must be 18 or older to create an account.',
        ]],
        ['Your account', [
          ['Give accurate information and keep it up to date.',
            'Keep your sign-in methods (codes and passkeys) safe and don’t share them.',
            'You are responsible for what happens in your account and for what the staff you give access to do.',
            'The business owner controls who can sign in and what each staff member can do, and can remove access at any time.',
            'Tell us straight away if you think someone has used your account without permission.'],
        ]],
        ['Your data is yours', [
          'Everything you put into Hemlo (products, sales, customers, members, patients, properties, contracts) belongs to you. You give us a limited permission to store, process and show it to you and your staff, only to provide the service, as the {doc:privacy} and the {doc:data} explain.',
          'We don’t sell your data, we don’t use it for advertising, and we don’t use your business’s content to train AI models.',
          'You can export your data at any time, even after your subscription ends.',
        ]],
        ['Trials, plans and payment', [
          'Every new business starts with a free 30-day trial, then chooses a paid plan to continue. Prices, payment, renewal and refunds are explained in {doc:billing}.',
        ]],
        ['Acceptable use', [
          'Use Hemlo for a lawful business and in a way that doesn’t harm others. What isn’t allowed is listed in the {doc:acceptable-use}; breaking it can lead to suspension.',
        ]],
        ['AI features', [
          'Some features use AI to suggest a draft (for example, reading an invoice from a photo). You review the draft before saving it, and it can contain mistakes. Details in {doc:ai}.',
        ]],
        ['Availability and changes', [
          'We work to keep Hemlo available and fast, but we can’t promise uninterrupted service: it may stop for maintenance or for problems at our providers or on the internet.',
          'We improve Hemlo all the time, so features may be added or changed. If we remove an important feature from a paid plan, we’ll tell you in advance.',
          'Demo accounts are temporary and are deleted within 24 hours.',
        ]],
        ['Your legal duties as a business', [
          'Hemlo is a tool for running your business; your business’s legal obligations stay with you, including:',
          ['Taxes, invoices and business records.',
            'Keeping medical records and their confidentiality in your clinic.',
            'Consent from your customers, patients and members to store their data and contact them.',
            'The accuracy of your property listings and the content of contracts you issue.'],
          'Contract templates and documents the system generates are a useful starting point, not legal advice; have them checked by a professional when needed.',
        ]],
        ['Intellectual property', [
          'Hemlo’s software, design, name and mark (the H) belong to Hemlo. We give you a limited, non-exclusive, non-transferable right to use the services during your subscription.',
          'You may not copy or resell Hemlo, or try to extract its source code.',
          'If you send us a suggestion or feedback, we may use it to improve Hemlo without owing you anything.',
        ]],
        ['Ending', [
          'You can stop at any time, and ask us to delete your account at {email}.',
          'We may suspend or end an account for a serious breach of these terms, for non-payment, or when the law requires. When a subscription ends unpaid, the business becomes read-and-export only; its data is never held back.',
          'When you ask us to close your business, we delete its data within 90 days, except what the law requires us to keep (such as payment records).',
        ]],
        ['Disclaimer', [
          'We provide the services “as is”, to the extent the law allows. We don’t promise they fit every need, or that AI results are free of mistakes.',
        ]],
        ['Limitation of liability', [
          'We are not responsible for indirect losses, such as lost profit, or losses caused by data entered incorrectly or by someone you gave access to.',
          'Our total liability to you is limited to what you paid Hemlo in the 12 months before the claim. This doesn’t limit any liability that can’t be limited by law.',
        ]],
        ['Changes to these terms', [
          'We may update these terms and will publish each update with its date. We’ll tell you about important changes at least 14 days in advance, by email or in the app. Continuing to use Hemlo after that means you accept them.',
        ]],
        ['Law and disputes', [
          'These terms are governed by the laws of the Republic of Iraq. If a disagreement arises, contact us first and we’ll try to settle it amicably; if that fails, the courts of Baghdad have jurisdiction.',
        ]],
        ['Contact', ['Write to {email}.']],
      ],
    },
    {
      slug: 'privacy', title: 'Privacy Policy', short: 'Privacy',
      summary: 'What we collect, why, who we share it with, and your rights.',
      sections: [
        ['What this policy covers', [
          'It applies to hemlohq.com, your Hemlo account, Hemlo Systems and Tools. We have two roles in it:',
          ['Your account and business details at Hemlo: we are responsible for them.',
            'The data your business enters about its customers, patients, members and clients: the business is responsible for it, and we process it on its behalf, as set out in the {doc:data}.'],
        ]],
        ['What we collect', [
          ['Account: name, email, phone number, your passkey’s public key (we never see your private key), and sign-in records (time, device type, IP address).',
            'Business: name, city, type, staff and their roles, plan and payments.',
            'Early-access requests: name, business name, phone, city, email.',
            'What you enter: products, sales, invoices, customers, members, patients and visits, properties, contracts, and the photos and files you upload.',
            'Usage: which features are used, errors, and how often AI is used, to run and improve Hemlo.',
            'Messages you send us.'],
        ]],
        ['What we don’t do', [
          ['We don’t sell your data.', 'We don’t show ads or use tracking cookies.', 'We don’t use your business’s content to train AI models.'],
        ]],
        ['Why we use it', [
          ['To provide and run the services you asked for.', 'For security, fraud prevention and protecting accounts.', 'For billing and activating plans.', 'For support and replying to you.', 'To improve Hemlo, using totals that don’t reveal any one business.', 'To comply with the law.'],
        ]],
        ['Who processes data with us', [
          'We use trusted providers to run Hemlo; their servers may be outside Iraq:',
          ['Cloudflare: hosting, file storage, and some AI models.',
            'Neon: the database.',
            'Resend: email (sign-in codes and invitations).',
            'The AI providers we choose for a given job (such as Google, Anthropic or OpenAI, directly or through OpenRouter, and Groq): we send them only what that job needs, such as the invoice photo.',
            'Payment providers (such as FIB and ZainCash) when you pay through them.'],
          'We don’t share your data with anyone else unless the law requires it.',
        ]],
        ['How long we keep it', [
          ['Account data: while the account exists; removed within 30 days of deletion.',
            'Business data: while the business exists; deleted within 90 days of a request to close it.',
            'Payment records: as long as the law requires.',
            'Security and sign-in logs: up to 12 months.',
            'Demo: deleted within 24 hours.',
            'Backups rotate out automatically within 30 days.'],
        ]],
        ['How we protect it', [
          ['All connections are encrypted (HTTPS), and storage is encrypted at our providers.',
            'Each business’s data is isolated inside the database itself, so no business can see another’s.',
            'Hemlo’s team signs in to the admin dashboard with passkeys only, and everything it does is logged.',
            'AI providers’ keys are stored encrypted.',
            'Nobody on our team looks at your business’s data except to support you, fix a problem, or when the law requires.'],
        ]],
        ['Your rights', [
          'You can ask for a copy of your data, or ask us to correct, export or delete it, or object to a particular use of it. Write to {email} and we’ll reply within 30 days.',
          'If your data is held by a business that uses Hemlo (for example, you are a patient at a clinic or a member of a gym), contact that business first, as it is responsible for it; we’ll help it answer you.',
        ]],
        ['Children', [
          'Our services are for adults (18 and over). Businesses may keep minors’ data (such as a gym member or a patient) under their own responsibility and with a guardian’s consent.',
        ]],
        ['Cookies', ['We use only what is needed to sign you in. Details in {doc:cookies}.']],
        ['Changes', ['We may update this policy and will publish each update with its date, telling you about important changes in advance.']],
        ['Contact', ['For any privacy question, write to {email}.']],
      ],
    },
    {
      slug: 'data', title: 'Data Processing Terms', short: 'Data processing',
      summary: 'How we handle the data your business keeps about its customers, patients, members and clients.',
      sections: [
        ['Roles', [
          'Your business is responsible for the data it keeps about people in Hemlo. Hemlo processes it on your behalf and on your instructions only, for one purpose: providing the service.',
        ]],
        ['Your commitments', [
          ['Have a lawful reason or consent to collect and keep people’s data.',
            'Have consent to contact them. WhatsApp reminders in Hemlo are sent from your own phone and account, not by Hemlo.',
            'For dental clinics: health data is sensitive; get the patient’s consent and keep professional confidentiality.',
            'Give each staff member only the access they need, and remove access when someone leaves.',
            'Don’t publish an owner’s or tenant’s personal details on public property pages.'],
        ]],
        ['Our commitments', [
          ['Process the data only to provide the service, for no other purpose.',
            'Keep each business’s data isolated from every other.',
            'Apply the security measures described in the {doc:privacy}.',
            'Bind our team to confidentiality, and log every admin access.',
            'Never sell the data, or share it except with the providers listed below.',
            'Tell you without delay (within 72 hours of confirming it) of any breach affecting your business’s data, with what we know and what we have done.',
            'Help you answer people’s requests about their data.',
            'Let you export the data at any time, and delete it when the business closes.'],
        ]],
        ['Sub-processors', [
          ['Cloudflare: hosting, file storage, and some AI models.',
            'Neon: the database.',
            'Resend: email.',
            'The AI provider chosen for each job: receives only what that job needs, and only when you use that feature.'],
          'We’ll announce any new provider on this page before it handles business data.',
        ]],
        ['Public pages', [
          'Property listings you choose to publish (hemlohq.com/p/ links) are public by design and anyone can open them. Only the facts you choose are published.',
        ]],
        ['When the relationship ends', [
          'You can export all your data at any time, even after the subscription ends. When you ask to close, we delete the data within 90 days, except what the law requires us to keep.',
        ]],
      ],
    },
    {
      slug: 'billing', title: 'Subscriptions, Payments & Refunds', short: 'Subscriptions & payments',
      summary: 'How the trial, plans, payment, renewal and refunds work.',
      sections: [
        ['Plans', [
          'Each system (Store, Gym, Dental, Real Estate) has plans by size, and every plan includes every feature. Prices are in Iraqi dinars and shown on hemlohq.com and in the app.',
        ]],
        ['Free trial', ['30 days free on the biggest plan, with no payment details. At the end, choose a plan to continue.']],
        ['Paying', [
          ['Monthly or yearly, at the price shown when you pay.',
            'In cash, or by FIB, ZainCash or bank transfer.',
            'Your plan is activated once we confirm the payment, and we send you proof of it.',
            'If a tax applies, we’ll show it before you pay.'],
        ]],
        ['Renewal', ['We never charge you automatically. We remind you before your paid period ends, and you renew when you choose.']],
        ['Grace period and after', [
          'After your paid period ends you have 7 days of grace, with everything working as usual.',
          'After that the business becomes read-and-export only: you can open and export all your data, but not add or change anything until you renew. We never hold your medical or business records back from you.',
        ]],
        ['Changing plans', [
          ['Upgrade at any time and pay the difference for the remaining period.', 'Downgrade at your next renewal, if your use fits the smaller plan’s limits.'],
        ]],
        ['Price changes', ['We’ll tell you about any price change at least 30 days in advance, and the price you paid stays the same until the end of the period you paid for.']],
        ['Refunds', [
          ['Monthly plans: a month is not refundable once it has started.',
            'Yearly plans: a full refund if you cancel within 14 days of paying. After that the rest isn’t refunded, and you keep access until the year ends.',
            'If Hemlo is down through our fault for more than 72 hours in a row, we add matching days to your subscription without you having to ask.'],
          'To ask for a refund, write to {email}.',
        ]],
        ['Enterprise and Studio', ['Enterprise plans and Hemlo Studio work have their own quotes and agreements.']],
      ],
    },
    {
      slug: 'acceptable-use', title: 'Acceptable Use Policy', short: 'Acceptable use',
      summary: 'What isn’t allowed on Hemlo, to protect you and every other business.',
      sections: [
        ['Not allowed', [
          ['Any unlawful activity, fraud or money laundering.',
            'Selling prohibited or counterfeit goods, or goods that need a licence you don’t have.',
            'Keeping people’s data without the right to, or using numbers in Hemlo to harass people or send unwanted bulk messages.',
            'Trying to reach another business’s data, probing or attacking our systems, getting around limits, or scraping.',
            'Trying to extract the source code, copying Hemlo, or reselling it.',
            'Sharing one login between several people to get around plan limits.',
            'Uploading malware or harmful files.',
            'Publishing false or misleading property listings.',
            'Using AI features to produce abusive or misleading content.'],
        ]],
        ['What we do about it', ['Depending on how serious it is: we warn you, suspend the account, or end it. We report to the authorities when the law requires.']],
        ['Reporting', ['If you see Hemlo being misused, tell us at {email}.']],
      ],
    },
    {
      slug: 'ai', title: 'AI Features', short: 'AI features',
      summary: 'How Hemlo’s AI features work, what is sent, and who decides.',
      sections: [
        ['What it does', [
          ['Reads a supplier invoice from a photo and turns it into a purchase.',
            'Answers questions about your business with numbers from your own data.',
            'Turns a photo of a register page into members in the system.',
            'Writes a property listing description from the property’s facts.',
            'Searches properties and clients from an everyday question.'],
        ]],
        ['A person decides', [
          'AI writes a draft; you review it before saving or publishing. It can be wrong (for example, misreading a digit), which is why we show what needs checking. What you save or publish is your responsibility.',
          'The numbers in “Ask your shop” answers come straight from your data; the model doesn’t make them up.',
        ]],
        ['What is sent', [
          'We send only what the job needs (the photo, the question, or the property facts) to the AI provider running that job, which may be outside Iraq. We choose the model for each job to get the right quality and cost, and may change it.',
          'Hemlo doesn’t use your business’s content to train models.',
        ]],
        ['Limits and control', ['Each plan has a monthly number of AI actions and a daily limit. The business owner can switch every AI feature off in Settings.']],
        ['What it isn’t for', ['Hemlo doesn’t read X-rays or make medical decisions, and doesn’t give legal advice about contracts.']],
      ],
    },
    {
      slug: 'cookies', title: 'Cookies', short: 'Cookies',
      summary: 'Only what is needed: no tracking, no ads.',
      sections: [
        ['What we use', [
          ['Sign-in session cookie: keeps you signed in to your Hemlo account. Secure, and pages can’t read it.',
            '“hemlo.hint” cookie: tells the website you’re signed in, so it shows the right buttons. It holds no personal data.',
            'Local storage in your browser: language and preferences, a cached copy that makes the system faster and work on a weak connection, and the demo session.'],
        ]],
        ['What we don’t use', ['No advertising cookies, no tracking cookies, and no third-party analytics.']],
        ['Your control', ['You can delete or block these in your browser settings, but blocking the session cookie means you can’t sign in.']],
      ],
    },
  ],
};

export const LEGAL: Record<Lang, LegalSet> = { ar, en };
export const legalPath = (lang: Lang, slug?: string) => (lang === 'ar' ? '' : '/en') + '/legal/' + (slug ? `${slug}/` : '');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** A paragraph as HTML: escaped, with {doc:slug} as a link to that document and {email} as a mail link. */
export function rich(text: string, lang: Lang, link: (slug: string) => string = (slug) => legalPath(lang, slug)) {
  return esc(text)
    .replace(/\{doc:([a-z-]+)\}/g, (_, slug) => { const d = LEGAL[lang].docs.find((x) => x.slug === slug); return d ? `<a href="${link(slug)}">${esc(d.title)}</a>` : slug; })
    .replace(/\{email\}/g, '<a href="mailto:hello@hemlohq.com" dir="ltr">hello@hemlohq.com</a>');
}
