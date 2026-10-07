// Branded emails. Built for real inboxes: tables, inline styles, system fonts, no web fonts or SVG,
// a hidden preheader, a plain-text twin, and right-to-left for Arabic. One layout for every message.
export type EmailLocale = 'ar' | 'ckb' | 'en';

const C = { ink: '#0E1420', text: '#2B3445', muted: '#6B7280', line: '#E3E1DA', stone: '#F4F3EF', paper: '#FFFFFF', brass: '#B38B3A' };
const ASSETS = 'https://account.hemlohq.com/email';

export interface EmailBlock {
  preheader: string;          // the grey line inboxes show after the subject
  title: string;
  intro?: string;
  code?: string;              // a one-time code, shown large
  note?: string;              // small text under the code or button
  button?: { label: string; url: string };
  details?: [string, string][]; // label → value rows (device, time …)
  warning?: string;           // "not you?" block
  footerReason: string;       // why they got this email
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const para = (s: string) => esc(s).replace(/\n/g, '<br>');

export function renderEmail(locale: EmailLocale, b: EmailBlock): { html: string; text: string } {
  const rtl = locale !== 'en';
  const dir = rtl ? 'rtl' : 'ltr', align = rtl ? 'right' : 'left';
  const font = rtl ? "Tahoma, 'Segoe UI', Arial, sans-serif" : "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const logo = rtl ? { src: `${ASSETS}/hemlo-ar.png`, w: 111 } : { src: `${ASSETS}/hemlo-en.png`, w: 151 };
  const brandName = rtl ? 'هيملو' : 'Hemlo';
  const footerLine = rtl ? 'هيملو · بغداد، العراق' : 'Hemlo · Baghdad, Iraq';
  const help = rtl ? 'تحتاج مساعدة؟ راسلنا على' : 'Need help? Write to';

  const code = b.code ? `
    <tr><td style="padding:8px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.stone};border-radius:14px">
        <tr><td align="center" dir="ltr" style="padding:22px 12px;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:${C.ink}">${esc(b.code)}</td></tr>
      </table>
    </td></tr>` : '';

  const button = b.button ? `
    <tr><td style="padding:12px 32px 0" align="${align}">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="border-radius:999px;background:${C.ink}">
          <a href="${esc(b.button.url)}" style="display:inline-block;padding:14px 26px;font-family:${font};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(b.button.label)}</a>
        </td></tr></table>
    </td></tr>` : '';

  const details = b.details?.length ? `
    <tr><td style="padding:16px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line}">
        ${b.details.map(([k, v]) => `<tr>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${font};font-size:14px;color:${C.muted}" align="${align}">${esc(k)}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-family:${font};font-size:14px;color:${C.ink};font-weight:600" align="${rtl ? 'left' : 'right'}">${esc(v)}</td></tr>`).join('')}
      </table>
    </td></tr>` : '';

  const warning = b.warning ? `
    <tr><td style="padding:20px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6EC;border-radius:12px;border-${rtl ? 'right' : 'left'}:3px solid ${C.brass}">
        <tr><td style="padding:14px 16px;font-family:${font};font-size:14px;line-height:22px;color:${C.text}" align="${align}">${para(b.warning)}</td></tr>
      </table>
    </td></tr>` : '';

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(b.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.stone};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(b.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.stone}">
  <tr><td align="center" style="padding:32px 14px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:520px">
      <tr><td align="${align}" style="padding:0 6px 20px">
        <img src="${logo.src}" width="${logo.w}" height="36" alt="${brandName}" style="display:block;border:0;height:36px;width:${logo.w}px">
      </td></tr>
      <tr><td style="background:${C.paper};border-radius:20px;border:1px solid ${C.line}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="height:4px;background:${C.brass};border-radius:20px 20px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td style="padding:32px 32px 0;font-family:${font};font-size:24px;line-height:32px;font-weight:700;color:${C.ink}" align="${align}">${esc(b.title)}</td></tr>
          ${b.intro ? `<tr><td style="padding:10px 32px 8px;font-family:${font};font-size:16px;line-height:26px;color:${C.text}" align="${align}">${para(b.intro)}</td></tr>` : ''}
          ${code}${button}
          ${b.note ? `<tr><td style="padding:14px 32px 0;font-family:${font};font-size:14px;line-height:22px;color:${C.muted}" align="${align}">${para(b.note)}</td></tr>` : ''}
          ${details}${warning}
          <tr><td style="padding:28px 32px 32px"></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:22px 10px 0;font-family:${font};font-size:12px;line-height:20px;color:${C.muted}" align="center">
        ${esc(b.footerReason)}<br>
        ${help} <a href="mailto:hello@hemlohq.com" style="color:${C.muted}">hello@hemlohq.com</a><br>
        <span style="color:#9AA0A8">${footerLine}</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [b.title, '', b.intro, b.code ? `\n    ${b.code}\n` : '', b.button ? `${b.button.label}: ${b.button.url}` : '', b.note,
    ...(b.details ?? []).map(([k, v]) => `${k}: ${v}`), b.warning ? `\n${b.warning}` : '', '', '—', b.footerReason, `${help} hello@hemlohq.com`, footerLine]
    .filter((x) => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
  return { html, text };
}
