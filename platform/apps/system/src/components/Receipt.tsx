// The receipt: hidden on screen, the only thing printed (80 mm / 58 mm thermal rolls via the browser's print).
import { STRINGS, locale, rtl, type Lang } from '../lib/i18n';
import { useApp } from '../lib/app';
import type { Customer, Sale, SaleLine } from '../lib/api';
import { printDirect, printerPrefs, type ReceiptData } from '../lib/escpos';

export const printReceipt = () => window.print();

/** The receipt as data for the direct (ESC/POS) printer. */
export function receiptData(lang: Lang, v: { shop: string; logo?: string | null; city?: string | null; cashier: string; dateTime: string; sale: Sale; lines: SaleLine[]; customer: Customer | null; change?: number }): ReceiptData {
  const t = STRINGS[lang];
  const n = (x: number) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 3 }).format(x);
  const s = v.sale;
  return {
    shop: v.shop, logo: v.logo ?? null, city: v.city, rtl: rtl(lang), title: `${t.receipt.no} #${s.number}`,
    meta: [`${t.receipt.date}: ${v.dateTime}`, `${t.receipt.cashier}: ${v.cashier}`, ...(v.customer ? [`${t.sell.customer}: ${v.customer.name}`] : [])],
    lines: v.lines.map((l) => ({ name: l.name + (l.packSize ? ` (${t.pack.carton} ${l.packSize})` : ''), detail: `${n(l.qty)} × ${n(l.price)}`, amount: n(l.total) })),
    totals: [
      ...(s.discount ? [{ label: t.sell.discount, value: `−${n(s.discount)}` }] : []),
      { label: t.sell.total, value: `${n(s.total)} ${t.iqd}`, strong: true },
      ...(s.method === 'fib' ? [{ label: 'FIB', value: n(s.paid) }] : []),
      ...(s.due > 0 ? [{ label: t.receipt.paid, value: n(s.paid) }, { label: t.receipt.due, value: n(s.due) }] : []),
      ...(v.change ? [{ label: t.receipt.change, value: n(v.change) }] : []),
    ],
    footer: t.receipt.thanks,
  };
}

/** Print a sale the way this device is set up: straight to the thermal printer (opening the drawer for cash), or the print dialog. */
export async function printSale(data: ReceiptData, cash: boolean, onFallback?: () => void) {
  const prefs = printerPrefs.get();
  if (prefs.mode === 'direct') {
    try { await printDirect(data, { kick: cash && prefs.drawer }); return; } catch { onFallback?.(); }
  }
  window.print();
}

export function Receipt({ sale, lines, customer, change }: { sale: Sale | null; lines: SaleLine[]; customer: Customer | null; change?: number }) {
  const { t, sys, num, dateTime, me } = useApp();
  if (!sale) return null;
  return (
    <div className="receipt" aria-hidden="true">
      {sys.business.logoUrl && <img className="r-logo" src={sys.business.logoUrl} alt="" />}
      <h3>{sys.business.name}</h3>
      {sys.business.city && <p className="c">{sys.business.city}</p>}
      <hr />
      <p>{t.receipt.no} #{sale.number}</p>
      <p>{t.receipt.date}: {dateTime(sale.createdAt)}</p>
      <p>{t.receipt.cashier}: {me.user.name}</p>
      {customer && <p>{t.sell.customer}: {customer.name}</p>}
      <hr />
      <table><tbody>
        {lines.map((l) => <tr key={l.id}><td>{l.name}{l.packSize ? ` (${t.pack.carton} ${l.packSize})` : ''}<br />{num(l.qty)} × {num(l.price)}</td><td>{num(l.total)}</td></tr>)}
      </tbody></table>
      <hr />
      <table><tbody>
        {sale.discount > 0 && <tr><td>{t.sell.discount}</td><td>−{num(sale.discount)}</td></tr>}
        <tr className="g"><td>{t.sell.total}</td><td>{num(sale.total)} {t.iqd}</td></tr>
        {sale.due > 0 && <><tr><td>{t.receipt.paid}</td><td>{num(sale.paid)}</td></tr><tr><td>{t.receipt.due}</td><td>{num(sale.due)}</td></tr></>}
        {change ? <tr><td>{t.receipt.change}</td><td>{num(change)}</td></tr> : null}
      </tbody></table>
      <hr />
      <p className="c">{t.receipt.thanks}</p>
      <p className="c" style={{ fontSize: '8pt' }}>Hemlo · hemlohq.com</p>
    </div>
  );
}

/** The same receipt as plain text, for WhatsApp. */
export function receiptText(lang: Lang, shop: string, s: Sale, lines: SaleLine[], customer: Customer | null) {
  const t = STRINGS[lang];
  const n = (v: number) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 3 }).format(v);
  return [
    `*${shop}*`, `${t.receipt.no} #${s.number}`, '',
    ...lines.map((l) => `${l.name}  ${n(l.qty)} × ${n(l.price)} = ${n(l.total)}`), '',
    s.discount ? `${t.sell.discount}: −${n(s.discount)}` : '',
    `*${t.sell.total}: ${n(s.total)} ${t.iqd}*`,
    s.due > 0 ? `${t.receipt.due}: ${n(s.due)} ${t.iqd}` : '',
    customer && customer.balance > 0 ? `${t.sell.balance}: ${n(customer.balance)} ${t.iqd}` : '',
    '', t.receipt.thanks,
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
}
