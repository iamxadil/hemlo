// Shared pieces of the agency's screens: icons, status pills, the property card, the match score and its reasons, the
// timeline, the floating panel, and the share sheet (WhatsApp with a ready message, link, QR, caption, A4 flyer).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { go, initials } from '../lib/app';
import { Icon, Sheet } from '../components/ui';
import { useR } from './i18n';
import { fmt, price, titleOf, waLink, statusTone, ago, localPhone, type Card, type Reason, type Activity, type Share, type Lead } from './data';

export { HMark } from '../dental/ui';

const P: Record<string, ReactNode> = {
  bed: <><path d="M3 18V8M3 14h18v4M21 18v-6a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></>,
  bath: <><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z" /><path d="M6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" /></>,
  size: <path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6" />, pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />, eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  share: <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5" />, qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" /></>,
  link: <><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1 1" /><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1-1" /></>,
  villa: <><path d="M3 21h18M5 21V11l7-6 7 6v10" /><path d="M9 21v-5h6v5" /></>, apartment: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  land: <><path d="M3 20h18" /><path d="m5 20 4-9 3 5 2-3 5 7" /></>, office: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>, flame: <path d="M12 3c2 4 6 5 6 10a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 4 5 0-3 0-5 0-8Z" />,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>, sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />, file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
};
const TYPE_ICON: Record<string, string> = { apartment: 'apartment', house: 'villa', villa: 'villa', land: 'land', office: 'office', shop: 'store', commercial: 'office', building: 'apartment', warehouse: 'box', farm: 'land' };
/** An icon from the shared set, or one of the agency's own. */
export const RIcon = ({ n, className = '' }: { n: string; className?: string }) => (P[n]
  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{P[n]}</svg>
  : <Icon n={n} className={className} />);
export const TypeIcon = ({ type, className = '' }: { type: string; className?: string }) => <RIcon n={TYPE_ICON[type] ?? 'villa'} className={className} />;

export function StatusPill({ status, solid = false }: { status: string; solid?: boolean }) {
  const { r } = useR();
  return <span className={`re-pill t-${statusTone(status)}${solid ? ' solid' : ''}`}><i />{r.status[status] ?? status}</span>;
}
export const Pill = ({ tone = '', children }: { tone?: string; children: ReactNode }) => <span className={`re-pill${tone ? ` t-${tone}` : ''}`}>{children}</span>;

export function Empty({ icon = 'store', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return <div className="re-empty"><span className="art"><RIcon n={icon} /></span><b>{title}</b>{body && <p>{body}</p>}{action && <div className="mt-2">{action}</div>}</div>;
}
export const Sec = ({ title, action }: { title: ReactNode; action?: ReactNode }) => <div className="re-sec"><h2>{title}</h2>{action}</div>;
export const Avatar = ({ name, lg = false }: { name: string; lg?: boolean }) => <span className={`re-av${lg ? ' lg' : ''}`}>{initials(name)}</span>;

/** A property, as a card: the photo first, its status, the price, the title, the essentials. */
export function PropCard({ p, onClick, selected, onSelect, extra }: { p: Card; onClick?(): void; selected?: boolean; onSelect?(): void; extra?: ReactNode }) {
  const { r, lang } = useR();
  const open = onClick ?? (() => go(`#/property?id=${p.id}`));
  return (
    <div className="re-card">
      <button className="re-card-ph" onClick={open} aria-label={titleOf(p, lang)}>
        {p.cover ? <img src={p.cover} alt="" loading="lazy" decoding="async" /> : <span className="noph"><TypeIcon type={p.type} /></span>}
        <span className="re-card-tags"><StatusPill status={p.status} solid />{p.purpose === 'rent' && <span className="re-pill solid">{r.purpose.rent}</span>}</span>
      </button>
      {onSelect && <button className="re-card-sel" aria-pressed={!!selected} onClick={onSelect} aria-label={r.props.select}><Icon n="check" /></button>}
      <button className="re-card-b" onClick={open}>
        <span className="re-card-price">{price(p.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}</span>
        <span className="re-card-t">{titleOf(p, lang)}</span>
        <span className="re-card-m">
          {p.area && <span><RIcon n="pin" />{p.area}</span>}
          {p.size ? <span><RIcon n="size" />{fmt(r.props.m2, { n: p.size })}</span> : p.land ? <span><RIcon n="size" />{fmt(r.props.m2, { n: p.land })}</span> : null}
          {p.bedrooms ? <span><RIcon n="bed" />{p.bedrooms}</span> : null}
          {p.bathrooms ? <span><RIcon n="bath" />{p.bathrooms}</span> : null}
        </span>
        <span className="re-card-foot"><span className="re-num">#{p.ref}</span><span className="sp" />
          {p.publishedAt ? <span className="inline-flex items-center gap-1"><RIcon n="eye" className="h-3.5 w-3.5" />{p.stats?.views ?? 0}</span> : <span>{r.props.unpublished}</span>}
        </span>
        {extra}
      </button>
    </div>
  );
}

/** A match score (a ring) and why: each requirement, fitting, close, or not. */
export const Score = ({ s }: { s: number }) => <span className="re-score" style={{ ['--s' as any]: s }}><span>{s}</span></span>;
export function Why({ reasons }: { reasons: Reason[] }) {
  const { r } = useR();
  return <span className="re-why">{reasons.map((x) => <span key={x.key} className={x.fit} title={r.fit[x.fit]}>{x.fit === 'yes' ? '✓' : x.fit === 'near' ? '≈' : '✕'} {r.reasons[x.key] ?? x.key}</span>)}</span>;
}

/** The timeline: what happened, in plain words, newest first. */
export function Timeline({ items, names = {} }: { items: Activity[]; names?: Record<string, string> }) {
  const { r, lang } = useR();
  if (!items.length) return <p className="sub p-4">{r.prop.noActivity}</p>;
  const money = (v: any, cur?: string) => (v == null ? '' : price(Number(v), cur ?? 'USD', lang));
  return (
    <ol className="re-tl">
      {items.map((a) => {
        const d = a.detail ?? {};
        const text = fmt(r.activity[a.kind] ?? a.kind, { from: money(d.from, d.currency), to: a.kind === 'property.price' ? money(d.to, d.currency) : a.kind.endsWith('status') || a.kind === 'deal.stage' ? (r.status[d.to] ?? r.stages[d.to] ?? r.leadStatus[d.to] ?? d.to) : String(d.to ?? ''),
          amount: money(d.amount, d.currency), title: String(d.title ?? ''), note: String(d.note ?? ''), property: (a.propertyId && names[a.propertyId]) || '' });
        return <li key={a.id} className={a.userId ? '' : 'hot'}><span>{text}</span><time>{ago(a.at, r)}</time></li>;
      })}
    </ol>
  );
}

/** A floating panel: under the top bar on big screens, a bottom sheet on phones. */
export function Panel({ children, onClose, className = '' }: { children: ReactNode; onClose(): void; className?: string }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return createPortal(<><div className="re-scrim" onClick={onClose} /><div className={`re-panel ${className}`} role="dialog" aria-modal="true">{children}</div></>, document.body);
}

/** A QR code as crisp SVG (it opens the property's page, marked as a scan). */
export function Qr({ text, className = '' }: { text: string; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { let on = true; import('qrcode-generator').then(({ default: qrcode }) => { const q = qrcode(0, 'M'); q.addData(text); q.make(); if (on) setSvg(q.createSvgTag({ cellSize: 6, margin: 2, scalable: true })); }); return () => { on = false; }; }, [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
/** Download the QR as a PNG (for printing on a sign). */
export async function downloadQr(text: string, name: string) {
  const { default: qrcode } = await import('qrcode-generator');
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), cell = 24, pad = 4 * cell, size = n * cell + pad * 2;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#14201C';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(pad + k * cell, pad + r * cell, cell, cell);
  const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `${name}.png`; a.click();
}

/** Share a property: WhatsApp with a ready (editable) message, copy, native share, QR, a caption, the A4 flyer. */
export function ShareSheet({ propertyId, card, onClose, lead }: { propertyId: string; card: Card & { description?: any; features?: string[] }; onClose(): void; lead?: Lead | null }) {
  const { r, lang, toast } = useR();
  const [mLang, setMLang] = useState<'ar' | 'en'>(lead?.lang === 'en' ? 'en' : lang === 'en' ? 'en' : 'ar');
  const share = useQuery<Share>({ queryKey: ['re-share', propertyId], queryFn: () => api(`/v1/re/properties/${propertyId}/share`, { body: {} }) });
  const [text, setText] = useState('');
  useEffect(() => { if (share.data) setText(share.data.text[mLang]); }, [share.data, mLang]);
  const [tab, setTab] = useState<'wa' | 'qr' | 'caption'>('wa');
  const log = (channel: string) => api(`/v1/re/properties/${propertyId}/share`, { body: { channel } }).catch(() => {});
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast(r.share.copied); } catch { /* no clipboard */ } };
  const caption = useMemo(() => {
    const f = card.features ?? [];
    const lines = mLang === 'ar'
      ? [`✨ ${card.title}`, card.area ? `📍 ${card.area}` : '', `💰 ${price(card.price, card.currency, 'ar', card.purpose === 'rent' ? card.rentPeriod : null)}`, [card.size && `${card.size} م²`, card.bedrooms && `${card.bedrooms} غرف`, card.bathrooms && `${card.bathrooms} حمّام`].filter(Boolean).join(' · '), f.length ? `#${f.slice(0, 3).join(' #')}` : '', '', 'التفاصيل والصور: الرابط في البايو', `#عقارات #${(card.area ?? '').replace(/\s+/g, '_')}`]
      : [`✨ ${card.titleEn || card.title}`, card.area ? `📍 ${card.area}` : '', `💰 ${price(card.price, card.currency, 'en', card.purpose === 'rent' ? card.rentPeriod : null)}`, [card.size && `${card.size} m²`, card.bedrooms && `${card.bedrooms} bedrooms`, card.bathrooms && `${card.bathrooms} bathrooms`].filter(Boolean).join(' · '), '', 'Photos and details: link in bio', `#realestate #${(card.area ?? '').replace(/\s+/g, '')}`];
    return lines.filter((x, i) => x !== '' || i > 4).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }, [card, mLang]);
  const to = lead ? (lead.whatsapp ?? lead.phone) : null;
  return (
    <Sheet title={r.share.title} sub={`#${card.ref} · ${titleOf(card, lang)}`} onClose={onClose}>
      <div className="seg">{(['wa', 'qr', 'caption'] as const).map((k) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k === 'wa' ? r.prop.whatsapp : k === 'qr' ? r.prop.qr : r.share.caption}</button>)}</div>
      {!card.publishedAt && <p className="note"><Icon n="info" />{r.errors.NOT_PUBLISHED}</p>}
      {tab === 'wa' && <>
        <div className="flex items-center justify-between gap-2"><span className="sec-t m-0">{r.share.message}</span>
          <div className="re-tabs">{(['ar', 'en'] as const).map((l) => <button key={l} aria-pressed={mLang === l} onClick={() => setMLang(l)}>{l === 'ar' ? 'العربية' : 'English'}</button>)}</div></div>
        {share.isLoading ? <div className="skeleton h-36" /> : <textarea className="re-share-msg" value={text} onChange={(e) => setText(e.target.value)} dir="auto" />}
        <div className="grid gap-2">
          <a className="btn btn-wa justify-center" href={waLink(to, text) ?? `https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" onClick={() => log('whatsapp')}><Icon n="wa" />{lead ? `${r.share.sendWa} · ${lead.name}` : r.share.sendWa}</a>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-secondary justify-center" onClick={() => { copy(text); log('copy'); }}><Icon n="sales" />{r.share.copyText}</button>
            <button className="btn btn-secondary justify-center" onClick={() => { copy(share.data?.url ?? ''); log('link'); }}><RIcon n="link" />{r.share.copyLink}</button>
          </div>
          {'share' in navigator && <button className="btn btn-secondary justify-center" onClick={() => { navigator.share({ title: titleOf(card, lang), text, url: share.data?.url }).catch(() => {}); log('native'); }}><RIcon n="share" />{r.share.native}</button>}
          {share.data && <a className="btn btn-secondary justify-center" href={share.data.url} target="_blank" rel="noopener"><Icon n="globe" />{r.prop.viewPage}</a>}
        </div>
      </>}
      {tab === 'qr' && share.data && <>
        <div className="re-qr"><Qr text={share.data.qr} /><b className="re-num">#{card.ref}</b></div>
        <p className="sub text-center">{r.share.qrHint}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-secondary justify-center" onClick={() => { downloadQr(share.data!.qr, `${card.slug}-qr`); log('qr'); }}><Icon n="download" />{r.share.downloadQr}</button>
          <button className="btn btn-secondary justify-center" onClick={() => { log('flyer'); printFlyer(card, share.data!, mLang); }}><Icon n="print" />{r.share.flyer}</button>
        </div>
      </>}
      {tab === 'caption' && <>
        <textarea className="re-share-msg" defaultValue={caption} key={caption} dir="auto" id="re-caption" />
        <button className="btn btn-secondary justify-center" onClick={() => { copy((document.getElementById('re-caption') as HTMLTextAreaElement)?.value ?? caption); log('caption'); }}><Icon n="sales" />{r.share.copyText}</button>
      </>}
    </Sheet>
  );
}

/** The A4 flyer: printed straight from the browser (or saved as a PDF), with the QR to the page. */
export async function printFlyer(card: Card & { description?: any; photos?: string[]; agencyName?: string; agentName?: string; phone?: string | null }, share: Share, lang: 'ar' | 'en') {
  const { default: qrcode } = await import('qrcode-generator');
  const q = qrcode(0, 'M'); q.addData(share.qr); q.make();
  const root = document.createElement('div'); root.className = 're-flyer-root';
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const desc = (card as any).description?.[lang] ?? '';
  root.innerHTML = `<div class="re-flyer" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">${card.cover ? `<img class="cover" src="${esc(card.cover)}">` : ''}
    <h1>${esc(lang === 'en' ? card.titleEn || card.title : card.title)}</h1><div>${esc([card.area, card.city].filter(Boolean).join(' · '))}</div>
    <div class="price">${esc(price(card.price, card.currency, lang, card.purpose === 'rent' ? card.rentPeriod : null))}</div>
    <div class="facts">${[card.size && `${card.size} ${lang === 'ar' ? 'م²' : 'm²'}`, card.bedrooms && `${card.bedrooms} ${lang === 'ar' ? 'غرف نوم' : 'bedrooms'}`, card.bathrooms && `${card.bathrooms} ${lang === 'ar' ? 'حمّامات' : 'bathrooms'}`].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}</div>
    <p>${esc(desc).slice(0, 600).replace(/\n/g, '<br>')}</p>
    <div class="foot"><div><b>#${card.ref}</b><br>${esc(share.url)}</div>${q.createSvgTag({ cellSize: 4, margin: 1, scalable: true })}</div></div>`;
  document.body.appendChild(root);
  const done = () => { root.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  const img = root.querySelector('img');
  if (img && !img.complete) await new Promise((ok) => { img.onload = ok; img.onerror = ok; setTimeout(ok, 2500); });
  window.print();
}

/** Pick a lead, as you type. */
export function LeadPicker({ onPick, autoFocus = true }: { onPick(l: Lead): void; autoFocus?: boolean }) {
  const { r } = useR();
  const [q, setQ] = useState(''), [d, setD] = useState('');
  useEffect(() => { const t = setTimeout(() => setD(q.trim()), 150); return () => clearTimeout(t); }, [q]);
  const found = useQuery({ queryKey: ['re-leads', 'pick', d], queryFn: async () => (await api(`/v1/re/leads?status=open&limit=12${d ? `&q=${encodeURIComponent(d)}` : ''}`)).leads as Lead[], placeholderData: (x) => x });
  return (
    <div className="grid gap-2">
      <div className="search"><Icon n="search" /><input className="input" autoFocus={autoFocus} placeholder={r.leads.search} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="panel max-h-80 overflow-y-auto">
        {(found.data ?? []).map((l) => (
          <button key={l.id} className="re-item" onClick={() => onPick(l)}><Avatar name={l.name} /><span className="min-w-0 flex-1"><b className="block truncate font-medium">{l.name}</b><span className="sub" dir="ltr">{localPhone(l.phone)}</span></span></button>
        ))}
        {found.data && !found.data.length && <p className="sub p-4">{r.leads.none}</p>}
      </div>
    </div>
  );
}
