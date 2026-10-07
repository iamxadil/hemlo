// Import from Excel or CSV: pick a file, match the columns (Arabic, Kurdish or English headers are recognised), preview,
// import. One importer for every list a business brings with it: products, the debt book, patients, gym members.
// Each kind says which columns it has; the server checks every row and reports the ones it skipped, with why.
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, fill } from '../lib/app';
import { Icon, Sheet, toLatin } from './ui';

type Kind = 'text' | 'number' | 'code' | 'phone' | 'unit' | 'date';
type Col = { key: string; kind?: Kind; required?: boolean; synonyms: string[] };
export type ImportKind = 'products' | 'customers' | 'patients' | 'members';

const C = (key: string, synonyms: string[], kind: Kind = 'text', required = false): Col => ({ key, synonyms, kind, required });
const NAME = ['name', 'full name', 'customer', 'client', 'patient', 'member', 'اسم', 'الاسم', 'الاسم الكامل', 'الزبون', 'العميل', 'المريض', 'المشترك', 'ناو', 'ناوی تەواو'];
const PHONE = ['phone', 'mobile', 'tel', 'telephone', 'number', 'whatsapp', 'هاتف', 'الهاتف', 'رقم الهاتف', 'موبايل', 'الموبايل', 'جوال', 'واتساب', 'تەلەفۆن', 'مۆبایل'];
const BALANCE = ['balance', 'debt', 'owes', 'owed', 'opening balance', 'الدين', 'الديون', 'عليه', 'المبلغ', 'الرصيد', 'الباقي', 'قەرز'];
const NOTE = ['note', 'notes', 'remarks', 'ملاحظة', 'ملاحظات', 'تێبینی'];
const GENDER = ['gender', 'sex', 'الجنس', 'النوع', 'ڕەگەز'];
const BIRTH = ['birth date', 'date of birth', 'dob', 'birthday', 'تاريخ الميلاد', 'المواليد', 'التولد', 'ڕێکەوتی لەدایکبوون'];

const SPECS: Record<ImportKind, { cols: Col[]; endpoint: string; invalidate: string[]; preview: string[]; template: [string[], string[]] }> = {
  products: {
    endpoint: '/v1/sys/products/import', invalidate: ['products'], preview: ['name', 'barcode', 'price', 'cost', 'stock'],
    cols: [
      C('name', ['name', 'product', 'item', 'اسم', 'الاسم', 'المنتج', 'اسم المنتج', 'المادة', 'ناو', 'بەرهەم'], 'text', true),
      C('barcode', ['barcode', 'code', 'sku', 'باركود', 'الباركود', 'الكود', 'رمز'], 'code'),
      C('price', ['price', 'selling price', 'sell', 'سعر', 'السعر', 'سعر البيع', 'نرخ'], 'number', true),
      C('cost', ['cost', 'cost price', 'purchase price', 'buy', 'سعر الشراء', 'الكلفة', 'التكلفة', 'الشراء'], 'number'),
      C('stock', ['stock', 'qty', 'quantity', 'الكمية', 'كمية', 'المخزون', 'العدد'], 'number'),
      C('category', ['category', 'group', 'type', 'الصنف', 'الفئة', 'القسم', 'النوع']),
      C('unit', ['unit', 'الوحدة', 'وحدة'], 'unit'),
      C('lowStock', ['low stock', 'min', 'minimum', 'reorder', 'حد التنبيه', 'الحد الأدنى'], 'number'),
      C('packSize', ['pack size', 'pieces per carton', 'carton size', 'قطع الكارتون', 'عدد الكارتون', 'الكارتون'], 'number'),
      C('packBarcode', ['carton barcode', 'pack barcode', 'باركود الكارتون'], 'code'),
      C('packPrice', ['carton price', 'pack price', 'سعر الكارتون'], 'number'),
    ],
    template: [['بيبسي 330 مل,6281036001017,500,375,48,مشروبات,قطعة,12,24,6281036001024,11000', 'رز سايب,,1750,1400,50,مواد غذائية,كغ,10,,,'], ['Pepsi 330ml,6281036001017,500,375,48,Drinks,piece,12,24,6281036001024,11000', 'Rice (loose),,1750,1400,50,Grocery,kg,10,,,']],
  },
  customers: {
    endpoint: '/v1/sys/customers/import', invalidate: ['customers'], preview: ['name', 'phone', 'balance', 'note'],
    cols: [C('name', NAME, 'text', true), C('phone', PHONE, 'phone'), C('balance', BALANCE, 'number'), C('note', NOTE)],
    template: [['أبو علي,07701234567,25000,يدفع كل خميس', 'أم زهراء,07801234567,0,'], ['Abu Ali,07701234567,25000,pays on Thursdays', 'Um Zahraa,07801234567,0,']],
  },
  patients: {
    endpoint: '/v1/dent/patients/import', invalidate: ['dent-patients', 'dent-find'], preview: ['fileNo', 'name', 'phone', 'gender', 'birthDate'],
    cols: [
      C('name', NAME, 'text', true), C('phone', PHONE, 'phone'), C('fileNo', ['file', 'file no', 'file number', 'رقم الملف', 'الملف', 'ژمارەی فایل'], 'number'),
      C('gender', GENDER), C('birthDate', BIRTH, 'date'), C('address', ['address', 'العنوان', 'السكن', 'ناونیشان']), C('occupation', ['occupation', 'job', 'المهنة', 'العمل', 'پیشە']),
      C('referral', ['referral', 'source', 'how they found us', 'كيف عرفنا', 'المصدر']), C('balance', BALANCE, 'number'), C('notes', NOTE),
    ],
    template: [['زينب حسين,07801234567,120,أنثى,1990-04-12,المنصور,مدرّسة,انستغرام,75000,', 'علي كاظم,07701234568,121,ذكر,1972-09-01,الكرادة,,صديق,0,سكري'], ['Zainab Hussein,07801234567,120,female,1990-04-12,Al-Mansour,Teacher,Instagram,75000,', 'Ali Kadhim,07701234568,121,male,1972-09-01,Karrada,,A friend,0,Diabetic']],
  },
  members: {
    endpoint: '/v1/gym/members/import', invalidate: ['gym-members', 'gym-today', 'gym-renewals'], preview: ['name', 'phone', 'plan', 'endsOn', 'balance'],
    cols: [
      C('name', NAME, 'text', true), C('phone', PHONE, 'phone'), C('memberNo', ['member no', 'member number', 'no', 'id', 'رقم المشترك', 'الرقم', 'ژمارە'], 'number'),
      C('gender', GENDER), C('birthDate', BIRTH, 'date'), C('plan', ['plan', 'membership', 'subscription', 'package', 'الاشتراك', 'نوع الاشتراك', 'الباقة', 'بەشداری']),
      C('startsOn', ['start', 'starts', 'start date', 'from', 'البداية', 'تاريخ البداية', 'من', 'دەستپێک'], 'date'), C('endsOn', ['end', 'ends', 'end date', 'expiry', 'expires', 'until', 'النهاية', 'تاريخ الانتهاء', 'ينتهي', 'إلى', 'کۆتایی'], 'date'),
      C('visitsLeft', ['visits left', 'sessions left', 'remaining', 'الزيارات المتبقية', 'المتبقي', 'الجلسات'], 'number'), C('balance', BALANCE, 'number'), C('notes', NOTE),
    ],
    template: [['علي حسين,07501112233,1,ذكر,1998-03-10,ثلاثة أشهر,,2026-12-31,,15000,', 'سارة أحمد,07501112244,2,أنثى,,12 زيارة خلال شهر,2026-10-01,2026-10-31,4,0,'], ['Ali Hussein,07501112233,1,male,1998-03-10,Three months,,2026-12-31,,15000,', 'Sara Ahmed,07501112244,2,female,,12 visits in a month,2026-10-01,2026-10-31,4,0,']],
  },
};
const UNIT_WORDS: Record<string, string> = { قطعة: 'piece', حبة: 'piece', كغ: 'kg', كيلو: 'kg', كيلوغرام: 'kg', غرام: 'g', لتر: 'l', كارتون: 'box', علبة: 'pack', باكيت: 'pack', piece: 'piece', pcs: 'piece', kg: 'kg', g: 'g', l: 'l', box: 'box', pack: 'pack' };
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[_\-]+/g, ' ');

/** A date from a sheet: an Excel date, 2026-10-05, 2026/10/05, or 05/10/2026 (day first, as written in Iraq). */
export function dateCell(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(+v)) return v.toISOString().slice(0, 10);
  const s = toLatin(String(v ?? '')).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) { let [d, mo] = [Number(m[1]), Number(m[2])]; if (mo > 12 && d <= 12) [d, mo] = [mo, d]; return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  return s; // the server says what's wrong with it
}

/** A small CSV reader: quotes, commas / semicolons / tabs. */
function parseCsv(text: string): string[][] {
  const sep = [',', ';', '\t'].sort((a, b) => text.split('\n')[0].split(b).length - text.split('\n')[0].split(a).length)[0];
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function Importer({ kind = 'products', onClose, extra, onDone }: { kind?: ImportKind; onClose(): void; extra?: Record<string, unknown>; onDone?: () => void }) {
  const { t, lang, num, toast } = useApp();
  const spec = SPECS[kind], k = t.importer.kinds[kind];
  const qc = useQueryClient();
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; memberships?: number; errors: { row: number; code: string }[] } | null>(null);
  const [error, setError] = useState('');
  const label = (key: string) => t.importer.fields[key] ?? key;

  const template = () => {
    const head = spec.cols.map((c) => (lang !== 'en' ? label(c.key) : c.key)).join(',');
    const blob = new Blob(['﻿' + [head, ...spec.template[lang === 'en' ? 1 : 0]].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hemlo-${kind}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const pick = async (file: File) => {
    setError(''); setResult(null);
    try {
      const data: unknown[][] = /\.csv$/i.test(file.name) || file.type === 'text/csv'
        ? parseCsv((await file.text()).replace(/^﻿/, ''))
        : await (await import('read-excel-file/browser')).readSheet(file) as unknown[][];
      if (data.length < 2) throw new Error('empty');
      const head = data[0].map(norm), guess: Record<string, number> = {};
      for (const c of spec.cols) {
        guess[c.key] = head.findIndex((h, i) => !Object.values(guess).includes(i) && (c.synonyms.some((s) => h === norm(s)) || h === norm(label(c.key)) || h === c.key.toLowerCase()));
      }
      if (guess.name < 0) guess.name = 0;
      setMap(guess); setRows(data);
    } catch { setError(t.importer.badFile); setRows(null); }
  };

  const body = rows ? rows.slice(1) : [];
  const toRow = (r: unknown[]) => {
    const o: Record<string, unknown> = {};
    for (const c of spec.cols) {
      const i = map[c.key]; if (i == null || i < 0) continue;
      let v = r[i]; if (v == null || v === '') continue;
      if (c.kind === 'number') v = typeof v === 'number' ? v : Number(toLatin(String(v)).replace(/[,\s٬]/g, '').replace('٫', '.'));
      else if (c.kind === 'unit') v = UNIT_WORDS[norm(v)] ?? UNIT_WORDS[String(v).trim()] ?? 'piece';
      else if (c.kind === 'date') v = dateCell(v);
      else if (c.kind === 'code') v = typeof v === 'number' ? String(Math.round(v)) : toLatin(String(v)).trim();
      else if (c.kind === 'phone') v = typeof v === 'number' ? String(Math.round(v)).replace(/^(7\d{9})$/, '0$1') : toLatin(String(v)).trim(); // Excel drops a phone's leading 0
      else v = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
      o[c.key] = v;
    }
    return o;
  };
  const preview = useMemo(() => body.slice(0, 5).map(toRow), [rows, map]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = spec.cols.some((c) => c.required && (map[c.key] == null || map[c.key] < 0));

  const run = async () => {
    const all = body.map(toRow);
    const errors: { row: number; code: string }[] = []; let created = 0, updated = 0, memberships = 0;
    setProgress(0);
    try {
      for (let s = 0; s < all.length; s += 1000) {
        const r = await api(spec.endpoint, { body: { rows: all.slice(s, s + 1000), ...extra } });
        created += r.created; updated += r.updated; memberships += r.memberships ?? 0;
        errors.push(...r.errors.map((e: any) => ({ row: e.row + s + 2, code: e.code }))); // +2: the header, and rows count from 1
        setProgress(Math.round(((s + 1000) / all.length) * 100));
      }
      setResult({ created, updated, memberships, errors });
      for (const q of spec.invalidate) qc.invalidateQueries({ queryKey: [q] });
      onDone?.();
    } catch (e: any) { toast(t.importer.codes[e?.code] ?? t.errors[e?.code] ?? t.errors.generic, 'bad'); }
    setProgress(null);
  };

  return (
    <Sheet title={k.title} onClose={onClose} icon={<span className="thumb"><Icon n="upload" className="h-5 w-5" /></span>}
      footer={result ? <button className="btn btn-accent justify-center" onClick={onClose}>{t.close}</button>
        : <button className="btn btn-accent justify-center" disabled={!rows || progress != null || missing} onClick={run}>
          {progress != null ? fill(t.importer.importing, { p: Math.min(100, progress) }) : fill(k.go, { n: num(body.length) })}</button>}>
      {result ? <>
        <div className="change"><span>{fill(t.importer.done, { c: num(result.created), u: num(result.updated) })}{result.memberships ? ` · ${fill(t.importer.memberships, { n: num(result.memberships) })}` : ''}</span><Icon n="check" className="h-5 w-5" /></div>
        {result.errors.length > 0 && <section><p className="sec-t">{fill(t.importer.skipped, { n: num(result.errors.length) })}</p>
          <ul className="ledger max-h-72 overflow-y-auto">{result.errors.slice(0, 200).map((e, i) => <li key={i}><span>{fill(t.importer.row, { n: e.row })}</span><span className="text-[var(--warn)]">{t.importer.codes[e.code] ?? e.code}</span></li>)}</ul></section>}
      </> : <>
        <p className="muted text-sm">{k.body}</p>
        <div className="flex flex-wrap gap-2">
          <label className="btn btn-accent btn-sm cursor-pointer"><Icon n="upload" className="h-4 w-4" />{t.importer.choose}
            <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} /></label>
          <button className="btn btn-secondary btn-sm" onClick={template}><Icon n="download" className="h-4 w-4" />{t.importer.template}</button>
        </div>
        {error && <p className="error">{error}</p>}
        {rows && <>
          <p className="pill ok justify-self-start">{fill(t.importer.found, { n: num(body.length) })}</p>
          <section><p className="sec-t">{t.importer.columns}</p>
            <div className="grid grid-cols-2 gap-2">{spec.cols.map((c) => (
              <label key={c.key} className="field">{label(c.key)}{c.required ? ' *' : ''}
                <select className="input" value={map[c.key] ?? -1} onChange={(e) => setMap((m) => ({ ...m, [c.key]: Number(e.target.value) }))}>
                  <option value={-1}>{t.importer.ignore}</option>{rows[0].map((h, i) => <option key={i} value={i}>{String(h ?? `#${i + 1}`)}</option>)}
                </select></label>
            ))}</div></section>
          <div className="overflow-x-auto rounded-2xl border border-[var(--line)]"><table className="w-full text-sm"><thead><tr>{spec.preview.map((f) => <th key={f} className="p-2 text-start font-medium muted">{label(f)}</th>)}</tr></thead>
            <tbody>{preview.map((r, i) => <tr key={i} className="border-t border-[var(--line)]">{spec.preview.map((f) => <td key={f} className="p-2" dir="auto">{String(r[f] ?? '')}</td>)}</tr>)}</tbody></table></div>
        </>}
      </>}
    </Sheet>
  );
}
