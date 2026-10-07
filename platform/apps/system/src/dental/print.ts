import type { Lang } from '../lib/i18n';
// Printing clinic documents (quotes, prescriptions, consents, statements): an A5/A4 page with the clinic's logo and
// name, in the page's language, opened in its own window and printed.
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export { esc };

export function printDoc(o: { lang: Lang; clinic: string; logo?: string | null; header?: string | null; title: string; body: string; size?: 'A4' | 'A5' }) {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return false;
  const rtl = o.lang !== 'en';
  w.document.write(`<!doctype html><html lang="${o.lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(o.title)}</title>
<style>
  @page { size: ${o.size ?? 'A5'}; margin: 12mm; }
  body { font-family: ${rtl ? 'Vazirmatn, Tahoma' : '"Readex Pro", Arial'}, sans-serif; color: #111; font-size: 11pt; line-height: 1.5; margin: 0; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
  header img { height: 48px; max-width: 120px; object-fit: contain; }
  header h1 { font-size: 15pt; margin: 0; } header p { margin: 2px 0 0; font-size: 9pt; color: #444; white-space: pre-line; }
  h2 { font-size: 13pt; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; } th, td { text-align: start; padding: 5px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { font-size: 9pt; color: #555; font-weight: 600; } .num { text-align: end; white-space: nowrap; } .total td { font-weight: 700; border-top: 2px solid #111; }
  .meta { display: flex; justify-content: space-between; font-size: 10pt; color: #333; } .muted { color: #666; font-size: 9pt; }
  .sign { margin-top: 28px; display: flex; justify-content: space-between; gap: 24px; } .sign div { flex: 1; border-top: 1px solid #111; padding-top: 4px; font-size: 9pt; }
  .rx li { margin: 6px 0; } .rx b { font-size: 11.5pt; } .consent { white-space: pre-line; } img.signature { height: 70px; }
  footer { margin-top: 18px; font-size: 8pt; color: #888; text-align: center; }
</style></head><body>
<header>${o.logo ? `<img src="${esc(o.logo)}" alt="">` : ''}<div><h1>${esc(o.clinic)}</h1>${o.header ? `<p>${esc(o.header)}</p>` : ''}</div></header>
${o.body}
<footer>Hemlo · hemlohq.com</footer>
<script>window.onload = () => { const imgs = [...document.images]; Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 150)); };</script>
</body></html>`);
  w.document.close();
  return true;
}
