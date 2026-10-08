// The film's voiceover script, in each language: twelve lines, recorded one by one (see tools/prep-vo.mjs). The words
// here are also what the picture syncs to: tools/make-ad2-audio.mjs times every word, and the film shows each word on
// screen as it is said. Arabic is warm Modern Standard Arabic, lightly vowelled where a voice could misread it.
export const SCRIPT = {
  en: [
    'Running a business means keeping track of everything.',
    'Debts, in a notebook. Bookings, on WhatsApp. Memberships, from memory.',
    "There's a better way.",
    'Meet Hemlo.',
    'One system, for your whole business.',
    'For gyms, members check in with a scan, and renew on their own.',
    'For clinics, every appointment, every treatment plan, in one place.',
    'For shops, sell in seconds. Even when the internet drops.',
    'For real estate, every property gets its own page, and finds its buyer.',
    'In Arabic. In dinars. Right on your phone.',
    'Hemlo. Everything, in one place.',
    'Try it free for thirty days, at hemlo H Q dot com.',
  ],
  ar: [
    'إدارةُ عملٍ تعني أن تتابعَ كلَّ شيء.',
    'الديونُ، في دفتر. الحجوزاتُ، على الواتساب. والاشتراكاتُ، في الذاكرة.',
    'هناك طريقةٌ أفضل.',
    'تعرّفْ على هيملو.',
    'نظامٌ واحد، لعملِك كلِّه.',
    'للأندية الرياضية: يدخلُ المشتركُ بمسحةِ بطاقة، ويجدّدُ اشتراكَه وحدَه.',
    'للعيادات: كلُّ موعد، وكلُّ خطةِ علاج، في مكانٍ واحد.',
    'للمتاجر: بِعْ في ثوانٍ. حتى حين ينقطعُ الإنترنت.',
    'لمكاتب العقارات: لكلِّ عقارٍ صفحتُه، ويجدُ زبونَه.',
    'بالعربية. بالدينار. على هاتفِك.',
    'هيملو. كلُّ شيء، في مكانٍ واحد.',
    'جرّبْه مجاناً ثلاثين يوماً، على هيملو إتش كيو دوت كوم.',
  ],
};
