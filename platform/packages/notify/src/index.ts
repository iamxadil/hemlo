// One way to send messages, whatever the channel. Adapters are chosen from the environment.
//   email     → Resend (RESEND_API_KEY), or the console in development. Branded HTML + plain text (email.ts).
//   whatsapp  → not connected yet (planned: Meta Cloud API, authentication template)
//   sms       → not connected yet (planned: an Iraqi gateway such as OTPIQ)
// Phone codes go WhatsApp → SMS. When neither is connected, phone sign-in is switched off (except in development).
import { renderEmail, type EmailBlock } from './email';

export type Locale = 'ar' | 'ckb' | 'en';
export type Channel = 'email' | 'whatsapp' | 'sms';
export interface Outgoing { channel: Channel; to: string; subject?: string; text: string; html?: string; kind: string }
export interface Transport { send(m: Outgoing): Promise<void> }

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  WHATSAPP_TOKEN?: string;      // reserved: Meta Cloud API
  WHATSAPP_PHONE_ID?: string;   // reserved
  SMS_API_KEY?: string;         // reserved: Iraqi SMS gateway
  DEV_CONSOLE_MESSAGES?: string; // "1" = print every message instead of sending (local development and tests)
}

/** Messages kept in memory when running in development or tests (the last 200). */
export const outbox: Outgoing[] = [];

const consoleTransport: Transport = {
  async send(m) {
    outbox.push(m); if (outbox.length > 200) outbox.shift();
    console.log(`[notify:${m.channel}] → ${m.to} · ${m.kind}\n${m.text}\n`);
  },
};

const resendTransport = (key: string, from: string): Transport => ({
  async send(m) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html, headers: { 'X-Entity-Ref-ID': crypto.randomUUID() } }),
    });
    if (!res.ok) throw new Error(`email failed: ${res.status} ${await res.text()}`);
  },
});

/** +9647701234567 → 0770 123 4567 */
const local = (e164: string) => e164.replace(/^\+964(\d{3})(\d{3})(\d{4})$/, '0$1 $2 $3');
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
type Two = { ar: string; en: string };
const L = (l: Locale) => (l === 'en' ? 'en' : 'ar'); // Kurdish falls back to Arabic until reviewed

const ROLE: Record<string, Two> = {
  owner: { ar: 'مالك', en: 'owner' }, admin: { ar: 'مسؤول', en: 'admin' }, manager: { ar: 'مدير', en: 'manager' }, cashier: { ar: 'كاشير', en: 'cashier' },
  technician: { ar: 'فنّي', en: 'technician' }, accountant: { ar: 'محاسب', en: 'accountant' }, viewer: { ar: 'مشاهد', en: 'viewer' },
};

// ---------- SMS / WhatsApp text (short, code first so it shows in notifications) ----------
const SHORT = {
  code: { ar: 'رمز الدخول إلى هيملو: {code}\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.', en: 'Your Hemlo code: {code}\nIt works for 5 minutes. Don’t share it with anyone.' },
  newDevice: { ar: 'هيملو: تسجيل دخول جديد إلى حسابك ({device}). إذا لم تكن أنت: {url}', en: 'Hemlo: new sign-in to your account ({device}). Not you? {url}' },
  invite: { ar: '{inviter} أضافك إلى {org} على هيملو.\nللانضمام: {url}\nالرابط صالح لمدة 7 أيام.', en: '{inviter} added you to {org} on Hemlo.\nJoin here: {url}\nThe link works for 7 days.' },
  access: { ar: 'مرحباً {name}، وصولك المبكر إلى هيملو جاهز.\nافتح هذا الرابط لإنشاء حسابك وتجهيز {business}:\n{url}\nالرابط خاص بك وصالح لمدة 14 يوماً.', en: 'Hi {name}, your early access to Hemlo is ready.\nOpen this link to create your account and set up {business}:\n{url}\nThe link is yours alone and works for 14 days.' },
} satisfies Record<string, Two>;

function accessMail(l: 'ar' | 'en', v: { name: string; business: string; url: string }): Mail {
  return l === 'ar' ? {
    subject: 'وصولك المبكر إلى هيملو جاهز',
    block: {
      preheader: `جهّز ${v.business} على هيملو`, title: `أهلاً ${v.name}، وصولك جاهز`,
      intro: `وافقنا على طلبك. أنشئ حسابك وسيكون ${v.business} جاهزاً فوراً، وأنت مالكه.`,
      button: { label: 'ابدأ الآن', url: v.url },
      note: 'الرابط خاص بك وصالح لمدة 14 يوماً. إذا احتجت مساعدة في الإعداد، ردّ على هذه الرسالة أو راسلنا على واتساب.',
      footerReason: 'وصلتك هذه الرسالة لأنك طلبت الوصول المبكر إلى هيملو.',
    },
  } : {
    subject: 'Your early access to Hemlo is ready',
    block: {
      preheader: `Set up ${v.business} on Hemlo`, title: `Welcome, ${v.name}. You’re in.`,
      intro: `We approved your request. Create your account and ${v.business} will be ready straight away, with you as its owner.`,
      button: { label: 'Get started', url: v.url },
      note: 'The link is yours alone and works for 14 days. If you’d like help setting up, reply to this email or message us on WhatsApp.',
      footerReason: 'You got this email because you asked for early access to Hemlo.',
    },
  };
}

function teamInviteMail(l: 'ar' | 'en', v: { inviter: string; role: string; url: string }): Mail {
  return l === 'ar' ? {
    subject: `${v.inviter} يدعوك إلى فريق هيملو`,
    block: {
      preheader: `انضم إلى فريق هيملو بدور ${v.role}`, title: 'انضم إلى فريق هيملو',
      intro: `${v.inviter} يدعوك للانضمام إلى فريق هيملو في لوحة الإدارة، بدور ${v.role}.`,
      button: { label: 'قبول الدعوة', url: v.url },
      note: 'الرابط صالح لمدة 7 أيام ويعمل لهذا البريد فقط. ستنشئ مفتاح مرور عند الدخول الأول.',
      footerReason: 'وصلتك هذه الرسالة لأن أحد أعضاء فريق هيملو أدخل بريدك. إذا لم تتوقعها، يمكنك تجاهلها.',
    },
  } : {
    subject: `${v.inviter} invited you to the Hemlo team`,
    block: {
      preheader: `Join the Hemlo team as ${v.role}`, title: 'Join the Hemlo team',
      intro: `${v.inviter} invited you to the Hemlo admin dashboard, as ${v.role}.`,
      button: { label: 'Accept invitation', url: v.url },
      note: 'The link works for 7 days, for this email address only. You’ll create a passkey the first time you sign in.',
      footerReason: 'You got this email because someone on the Hemlo team entered your address. If you weren’t expecting it, you can ignore it.',
    },
  };
}

// ---------- emails ----------
type Mail = { subject: string; block: EmailBlock };

function codeMail(l: 'ar' | 'en', code: string, purpose: 'sign-in' | 'change-email'): Mail {
  const change = purpose === 'change-email';
  return l === 'ar' ? {
    subject: change ? `رمز تأكيد بريدك في هيملو: ${code}` : `رمز الدخول إلى هيملو: ${code}`,
    block: {
      preheader: `رمزك ${code} · صالح لمدة 5 دقائق`,
      title: change ? 'أكّد بريدك الجديد' : 'رمز الدخول',
      intro: change ? 'استخدم هذا الرمز لتأكيد بريدك الإلكتروني الجديد في حساب هيملو.' : 'استخدم هذا الرمز لإكمال الدخول إلى حسابك في هيملو.',
      code, note: 'الرمز صالح لمدة 5 دقائق، ويُستخدم مرة واحدة فقط.',
      warning: 'لم تطلب هذا الرمز؟ تجاهل هذه الرسالة، فلن يتمكن أحد من الدخول بدونه. فريق هيملو لن يطلب منك هذا الرمز أبداً.',
      footerReason: change ? 'وصلتك هذه الرسالة لأن أحداً طلب ربط هذا البريد بحساب في هيملو.' : 'وصلتك هذه الرسالة لأن أحداً طلب الدخول إلى هيملو بهذا البريد.',
    },
  } : {
    subject: change ? `Confirm your new Hemlo email: ${code}` : `Your Hemlo sign-in code: ${code}`,
    block: {
      preheader: `Your code is ${code} · valid for 5 minutes`,
      title: change ? 'Confirm your new email' : 'Your sign-in code',
      intro: change ? 'Use this code to confirm the new email address on your Hemlo account.' : 'Use this code to finish signing in to your Hemlo account.',
      code, note: 'The code works for 5 minutes and only once.',
      warning: 'Didn’t ask for this code? Ignore this email: nobody can sign in without it. Hemlo will never ask you for this code.',
      footerReason: change ? 'You got this email because someone asked to link this address to a Hemlo account.' : 'You got this email because someone asked to sign in to Hemlo with this address.',
    },
  };
}

function newDeviceMail(l: 'ar' | 'en', device: string, time: string, url: string): Mail {
  return l === 'ar' ? {
    subject: 'تسجيل دخول جديد إلى حسابك في هيملو',
    block: {
      preheader: `دخول جديد من ${device}`, title: 'تسجيل دخول جديد', intro: 'تم الدخول إلى حسابك في هيملو من جهاز لم نره من قبل.',
      details: [['الجهاز', device], ['الوقت', time]], button: { label: 'مراجعة أجهزتي', url },
      warning: 'إذا كان هذا أنت، فلا داعي لأي إجراء.\nإذا لم تكن أنت، افتح صفحة حسابك واختر «تسجيل الخروج من الأجهزة الأخرى»، ثم أضف مفتاح مرور.',
      footerReason: 'نرسل هذا التنبيه عند كل دخول من جهاز جديد لحماية حسابك.',
    },
  } : {
    subject: 'New sign-in to your Hemlo account',
    block: {
      preheader: `New sign-in from ${device}`, title: 'New sign-in', intro: 'Your Hemlo account was just signed in from a device we haven’t seen before.',
      details: [['Device', device], ['Time', time]], button: { label: 'Review my devices', url },
      warning: 'If this was you, there’s nothing to do.\nIf it wasn’t, open your account page, choose “Sign out of other devices”, then add a passkey.',
      footerReason: 'We send this alert for every sign-in from a new device, to keep your account safe.',
    },
  };
}

function inviteMail(l: 'ar' | 'en', v: { inviter: string; org: string; role: string; url: string }): Mail {
  const role = ROLE[v.role]?.[l] ?? v.role;
  return l === 'ar' ? {
    subject: `${v.inviter} أضافك إلى ${v.org} على هيملو`,
    block: {
      preheader: `انضم إلى ${v.org} بدور ${role}`, title: `انضم إلى ${v.org}`,
      intro: `${v.inviter} يدعوك للانضمام إلى فريق ${v.org} على هيملو بدور ${role}.`,
      button: { label: 'قبول الدعوة', url: v.url },
      note: 'الرابط صالح لمدة 7 أيام. للقبول، ادخل بهذا البريد نفسه.',
      footerReason: `وصلتك هذه الرسالة لأن ${v.inviter} أدخل بريدك في ${v.org}. إذا لم تتوقعها، يمكنك تجاهلها.`,
    },
  } : {
    subject: `${v.inviter} added you to ${v.org} on Hemlo`,
    block: {
      preheader: `Join ${v.org} as ${role}`, title: `Join ${v.org}`,
      intro: `${v.inviter} invited you to join the ${v.org} team on Hemlo as ${role}.`,
      button: { label: 'Accept invitation', url: v.url },
      note: 'The link works for 7 days. To accept, sign in with this same email.',
      footerReason: `You got this email because ${v.inviter} entered your address at ${v.org}. If you didn’t expect it, you can ignore it.`,
    },
  };
}

function lockoutMail(l: 'ar' | 'en', v: { name: string; device: string; url: string }): Mail {
  return l === 'ar' ? {
    subject: `تم قفل رمز PIN لـ ${v.name}`,
    block: {
      preheader: `5 محاولات خاطئة على «${v.device}»`, title: 'تم قفل رمز PIN',
      intro: `أُدخل رمز PIN خاطئ 5 مرات لـ ${v.name} على جهاز الكاشير «${v.device}»، فتم قفله على هذا الجهاز.`,
      button: { label: 'فتح إدارة العمل', url: v.url },
      note: 'إذا كان خطأً عادياً، افتح القفل من «أجهزة الكاشير». وإذا شككت بشيء، اطلب من الموظف تغيير رمزه.',
      footerReason: 'نرسل هذا التنبيه لمالكي العمل فقط.',
    },
  } : {
    subject: `A counter PIN was locked for ${v.name}`,
    block: {
      preheader: `5 wrong tries on “${v.device}”`, title: 'A PIN was locked',
      intro: `A wrong PIN was entered 5 times for ${v.name} on the counter device “${v.device}”, so it’s now locked on that device.`,
      button: { label: 'Open Manage business', url: v.url },
      note: 'If it was an honest mistake, unlock it under “Counter devices”. If something feels off, ask them to change their PIN.',
      footerReason: 'We send this alert to business owners only.',
    },
  };
}

export interface Notifier {
  /** Can we send phone codes right now? */
  phoneAvailable: boolean;
  sendCode(to: { email?: string; phone?: string }, code: string, locale: Locale, purpose?: 'sign-in' | 'change-email'): Promise<void>;
  newDeviceAlert(to: { email?: string; phone?: string }, locale: Locale, device: string, time: string, url: string): Promise<void>;
  invitation(to: { email?: string }, locale: Locale, v: { inviter: string; org: string; role: string; url: string }): Promise<void>;
  counterLockout(to: { email?: string }, locale: Locale, v: { name: string; device: string; url: string }): Promise<void>;
  /** Tells Hemlo (hello@) about a new early-access request. phone is +964… */
  /** "Your early access is ready" with the private link. */
  accessGranted(to: { email: string }, locale: Locale, v: { name: string; business: string; url: string }): Promise<void>;
  teamInvitation(to: { email: string }, locale: Locale, v: { inviter: string; role: string; url: string }): Promise<void>;
  earlyAccessAlert(to: string, v: { name: string; phone: string; business: string; kind: string; city?: string | null; note?: string | null; locale: string }): Promise<void>;
}

export function createNotifier(env: NotifyEnv): Notifier {
  const dev = env.DEV_CONSOLE_MESSAGES === '1';
  const email: Transport | null = dev ? consoleTransport : env.RESEND_API_KEY ? resendTransport(env.RESEND_API_KEY, env.EMAIL_FROM || 'Hemlo <no-reply@hemlohq.com>') : null;
  const whatsapp: Transport | null = dev ? consoleTransport : null; // connect Meta Cloud API here (see docs/architecture/auth-system-design.md §8)
  const sms: Transport | null = dev ? consoleTransport : null;       // connect an Iraqi SMS gateway here
  const phoneTransports = [whatsapp, sms].filter(Boolean) as Transport[];

  async function toPhone(to: string, text: string, kind: string) {
    let last: unknown;
    for (const t of phoneTransports) {
      try { return await t.send({ channel: t === whatsapp ? 'whatsapp' : 'sms', to, text, kind }); } catch (e) { last = e; }
    }
    throw last ?? new Error('phone channel not connected');
  }
  async function mail(to: string, locale: Locale, m: Mail, kind: string) {
    if (!email) throw new Error('email channel not connected');
    const { html, text } = renderEmail(locale, m.block);
    await email.send({ channel: 'email', to, subject: m.subject, text, html, kind });
  }

  return {
    phoneAvailable: phoneTransports.length > 0,
    async sendCode(to, code, locale, purpose = 'sign-in') {
      if (to.phone) return toPhone(to.phone, fill(SHORT.code[L(locale)], { code }), 'code');
      if (to.email) return mail(to.email, locale, codeMail(L(locale), code, purpose), 'code');
    },
    async newDeviceAlert(to, locale, device, time, url) {
      if (to.email) return mail(to.email, locale, newDeviceMail(L(locale), device, time, url), 'new-device');
      if (to.phone && phoneTransports.length) return toPhone(to.phone, fill(SHORT.newDevice[L(locale)], { device, url }), 'new-device');
    },
    async invitation(to, locale, v) {
      if (to.email) return mail(to.email, locale, inviteMail(L(locale), v), 'invitation');
    },
    async counterLockout(to, locale, v) {
      if (to.email) return mail(to.email, locale, lockoutMail(L(locale), v), 'counter-lockout');
    },
    async teamInvitation(to, locale, v) {
      return mail(to.email, locale, teamInviteMail(L(locale), v), 'team-invitation');
    },
    async accessGranted(to, locale, v) {
      return mail(to.email, locale, accessMail(L(locale), v), 'access-granted');
    },
    async earlyAccessAlert(to, v) {
      return mail(to, 'ar', { subject: `طلب وصول مبكر: ${v.business}`, block: {
        preheader: `${v.name} · ${local(v.phone)} · ${v.kind}`, title: 'طلب وصول مبكر جديد', intro: 'وصل طلب جديد من صفحة الوصول المبكر في hemlohq.com.',
        details: [['الاسم', v.name], ['الهاتف', local(v.phone)], ['العمل', v.business], ['النوع', v.kind], ['المدينة', v.city || '—'], ['لغة الصفحة', v.locale], ...(v.note ? [['ملاحظة', v.note]] as [string, string][] : [])],
        button: { label: 'مراسلة على واتساب', url: `https://wa.me/${v.phone.replace(/\D/g, '')}` },
        footerReason: 'تنبيه داخلي لفريق هيملو.',
      } }, 'early-access');
    },
  };
}

/** Text for sharing an invitation through the owner's own WhatsApp (free: a wa.me link opened on their phone). */
/** The WhatsApp message Hemlo sends (from its own phone) with the private early-access link. */
export function accessShareText(locale: Locale, v: { name: string; business: string; url: string }) {
  return fill(SHORT.access[L(locale)], v);
}

export function inviteShareText(locale: Locale, v: { inviter: string; org: string; url: string }) {
  return fill(SHORT.invite[L(locale)], v);
}

export { renderEmail };
